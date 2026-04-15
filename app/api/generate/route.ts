/**
 * AI Resume Generation Route
 *
 * Accepts structured resume data + provider config, builds a system prompt
 * via lib/prompts.ts, calls the chosen LLM, and returns parsed resume JSON.
 *
 * POST body:
 *   { mode, resumeLanguage, templateType, customTemplateDesc?,
 *     userData, supplementalText?, jobDescription?,
 *     provider?, apiKey?, model?, baseURL? }
 *
 * Response:
 *   { success: true, resumeJson: {...} }
 *   { success: false, error: string }
 */

import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildResumeSystemPrompt,
  type ResumeLanguage,
  type TemplateType,
  type GenerateMode,
} from "@/lib/prompts";

// ── Provider config ────────────────────────────────────────

type ProviderId = "deepseek" | "openai" | "anthropic" | "gemini" | "custom";

interface ProviderDefaults {
  baseURL: string;
  model: string;
  format: "openai" | "anthropic";
}

const PROVIDER_DEFAULTS: Record<ProviderId, ProviderDefaults> = {
  deepseek:  { baseURL: "https://api.deepseek.com",       model: "deepseek-chat",            format: "openai" },
  openai:    { baseURL: "https://api.openai.com/v1",      model: "gpt-4o",                   format: "openai" },
  anthropic: { baseURL: "https://api.anthropic.com",      model: "claude-sonnet-4-20250514", format: "anthropic" },
  gemini:    { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.0-flash", format: "openai" },
  custom:    { baseURL: "",                                model: "",                          format: "openai" },
};

// ── Request types ──────────────────────────────────────────

interface GenerateRequest {
  mode: GenerateMode;
  resumeLanguage: ResumeLanguage;
  templateType: TemplateType;
  customTemplateDesc?: string;
  userData: Record<string, unknown>;
  supplementalText?: string;
  jobDescription?: string;
  provider?: ProviderId;
  apiKey?: string;
  model?: string;
  baseURL?: string;
}

// ── Helpers ────────────────────────────────────────────────

function resolveApiKey(provider: ProviderId, bodyKey?: string): string | undefined {
  if (bodyKey) return bodyKey;
  if (provider === "deepseek") return process.env.DEEPSEEK_API_KEY;
  return undefined;
}

function extractJSON(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    text = text.slice(braceStart, braceEnd + 1);
  }
  return text;
}

function sanitizeStringArray(input: unknown, maxLen = 20): string[] {
  if (!Array.isArray(input)) return [];
  return (input as unknown[])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, maxLen);
}

// ── OpenAI-compatible call ─────────────────────────────────

async function callOpenAI(
  apiKey: string,
  baseURL: string,
  model: string,
  systemPrompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "请立即按照系统提示词中的要求，输出唯一的合法 JSON。" },
    ],
    max_tokens: 4096,
    temperature: 0.3,
  });
  return completion.choices[0]?.message?.content ?? "";
}

// ── Anthropic Messages API ─────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: "user", content: "请立即按照系统提示词中的要求，输出唯一的合法 JSON。" },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const blocks: { type: string; text?: string }[] = data.content ?? [];
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
}

// ── Route handler ──────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!body.userData || typeof body.userData !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid `userData` field" },
        { status: 400 },
      );
    }

    const mode: GenerateMode = body.mode === "optimize" ? "optimize" : "generate";
    const resumeLanguage: ResumeLanguage =
      (["zh", "en", "de"] as const).includes(body.resumeLanguage as ResumeLanguage)
        ? (body.resumeLanguage as ResumeLanguage)
        : "en";
    const templateType: TemplateType =
      (["china", "europe", "ats", "custom"] as const).includes(body.templateType as TemplateType)
        ? (body.templateType as TemplateType)
        : "europe";

    const provider: ProviderId =
      body.provider && body.provider in PROVIDER_DEFAULTS
        ? body.provider
        : "deepseek";

    const defaults = PROVIDER_DEFAULTS[provider];
    const apiKey = resolveApiKey(provider, body.apiKey);

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: `API key not provided for ${provider}` },
        { status: 400 },
      );
    }

    const systemPrompt = buildResumeSystemPrompt({
      resumeLanguage,
      templateType,
      customTemplateDesc: body.customTemplateDesc,
      userData: body.userData,
      supplementalText: body.supplementalText ?? "",
      jobDescription: body.jobDescription ?? "",
      mode,
    });

    const model = body.model || defaults.model;
    let rawText: string;

    if (defaults.format === "anthropic") {
      rawText = await callAnthropic(apiKey, model, systemPrompt);
    } else {
      const baseURL = (provider === "custom" && body.baseURL) ? body.baseURL : defaults.baseURL;
      if (!baseURL) {
        return NextResponse.json(
          { success: false, error: "baseURL is required for custom provider" },
          { status: 400 },
        );
      }
      rawText = await callOpenAI(apiKey, baseURL, model, systemPrompt);
    }

    const jsonString = extractJSON(rawText);
    let resumeJson: Record<string, unknown>;

    try {
      resumeJson = JSON.parse(jsonString);
    } catch {
      console.error("[generate] Failed to parse LLM output as JSON. Raw:", rawText.slice(0, 500));
      return NextResponse.json(
        {
          success: false,
          error: "AI returned invalid JSON. Please try again.",
          rawText: rawText.slice(0, 2000),
        },
        { status: 502 },
      );
    }

    resumeJson.suggestions = sanitizeStringArray(resumeJson.suggestions, 12);
    resumeJson.skills = sanitizeStringArray(resumeJson.skills, 40);
    resumeJson.languages = sanitizeStringArray(resumeJson.languages, 20);

    if (typeof resumeJson.language !== "string") {
      resumeJson.language = resumeLanguage;
    }

    return NextResponse.json({ success: true, resumeJson });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[generate] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
