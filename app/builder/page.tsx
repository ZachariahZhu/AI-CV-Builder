"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  Save,
  Globe,
  Upload,
  Download,
  X,
  FileText,
  FileType2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Plus,
  User,
  FileCheck,
  AlignLeft,
  ImagePlus,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Lightbulb,
  FileEdit,
} from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { ApiConfigSheet } from "@/components/api-config-sheet";
import {
  type ApiConfig,
  loadApiConfig,
  getProvider,
  resolveModel,
  maskKey,
} from "@/lib/api-config";
import type { Locale } from "@/lib/i18n";

// ── Constants ──────────────────────────────────────────────

const STORAGE_KEY = "resumeai-builder-draft";
const RESUME_LANG_KEY = "resumeai-output-lang";
const TOTAL_STEPS = 2;
const ACCEPT_DOCS =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

const INPUT_CLS =
  "h-11 rounded-xl border-[#e5e5e5] bg-white text-[15px] focus-visible:border-[#111111] focus-visible:ring-[#111111]/10";
const INPUT_INNER_CLS =
  "h-11 rounded-xl border-[#e5e5e5] bg-[#fafafa] text-[15px] focus-visible:border-[#111111] focus-visible:ring-[#111111]/10";

const TEMPLATE_KEY = "resumeai-template";
const CUSTOM_TPL_KEY = "resumeai-custom-template";

type TemplateId = "china" | "europe" | "ats" | "custom";

const builtinTemplates: { id: TemplateId; icon: React.ElementType; labelKey: string }[] = [
  { id: "china", icon: User, labelKey: "tplChina" },
  { id: "europe", icon: FileCheck, labelKey: "tplEurope" },
  { id: "ats", icon: AlignLeft, labelKey: "tplAts" },
  { id: "custom", icon: ImagePlus, labelKey: "tplCustom" },
];

// ── Types ──────────────────────────────────────────────────

interface EduEntry {
  school: string;
  major: string;
  start: string;
  end: string;
  gpa: string;
}

interface FormData {
  name: string;
  phone: string;
  email: string;
  linkedin: string;
  github: string;
  educations: EduEntry[];
  jd: string;
}

interface UploadedFile {
  name: string;
  category: string;
  charCount: number;
}

interface ParsedDoc {
  name: string;
  text: string;
}

const PARSED_DOCS_KEY = "resumeai-parsed-documents";

// ── Resume JSON schema + Markdown converter ────────────────

interface ResumeJson {
  personalInfo?: {
    name?: string;
    phone?: string;
    email?: string;
    linkedin?: string;
    github?: string;
    photoPlaceholder?: string;
  };
  education?: Array<{
    school?: string;
    major?: string;
    period?: string;
    gpa?: string;
  }>;
  experience?: Array<{
    company?: string;
    position?: string;
    period?: string;
    description?: string;
  }>;
  skills?: string[];
  summary?: string;
  language?: string;
  suggestions?: string[];
}

const MD_HEADINGS: Record<Locale, {
  info: string;
  edu: string;
  exp: string;
  skills: string;
  summary: string;
  gpa: string;
}> = {
  zh: { info: "个人信息", edu: "教育背景", exp: "工作经历", skills: "技能", summary: "个人总结", gpa: "GPA" },
  en: { info: "Contact", edu: "Education", exp: "Experience", skills: "Skills", summary: "Summary", gpa: "GPA" },
  de: { info: "Kontakt", edu: "Ausbildung", exp: "Berufserfahrung", skills: "Kenntnisse", summary: "Zusammenfassung", gpa: "GPA" },
};

function resumeJsonToMarkdown(resume: ResumeJson, fallbackLang: Locale): string {
  const lang: Locale =
    resume.language === "zh" || resume.language === "en" || resume.language === "de"
      ? (resume.language as Locale)
      : fallbackLang;
  const h = MD_HEADINGS[lang];
  const lines: string[] = [];

  const p = resume.personalInfo ?? {};
  if (p.name) lines.push(`# ${p.name}`);

  const contactBits: string[] = [];
  if (p.phone) contactBits.push(p.phone);
  if (p.email) contactBits.push(p.email);
  if (p.linkedin) contactBits.push(`LinkedIn: ${p.linkedin}`);
  if (p.github) contactBits.push(`GitHub: ${p.github}`);
  if (contactBits.length > 0) lines.push(contactBits.join(" · "));

  if (resume.summary?.trim()) {
    lines.push("", `## ${h.summary}`, "", resume.summary.trim());
  }

  const edus = (resume.education ?? []).filter((e) => e && (e.school || e.major));
  if (edus.length > 0) {
    lines.push("", `## ${h.edu}`);
    for (const e of edus) {
      const title = [e.school, e.major].filter(Boolean).join(" — ");
      lines.push("", `**${title}**`);
      const meta = [e.period, e.gpa ? `${h.gpa}: ${e.gpa}` : ""].filter(Boolean).join(" · ");
      if (meta) lines.push(meta);
    }
  }

  const exps = (resume.experience ?? []).filter((e) => e && (e.company || e.position));
  if (exps.length > 0) {
    lines.push("", `## ${h.exp}`);
    for (const e of exps) {
      const title = [e.company, e.position].filter(Boolean).join(" — ");
      lines.push("", `**${title}**`);
      if (e.period) lines.push(`*${e.period}*`);
      if (e.description?.trim()) {
        const bullets = e.description
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => (s.startsWith("-") || s.startsWith("•") ? s.replace(/^[-•]\s*/, "") : s));
        lines.push("");
        for (const b of bullets) lines.push(`- ${b}`);
      }
    }
  }

  const skills = (resume.skills ?? []).filter(Boolean);
  if (skills.length > 0) {
    lines.push("", `## ${h.skills}`, "", skills.map((s) => `\`${s}\``).join(" · "));
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const emptyEdu: EduEntry = { school: "", major: "", start: "", end: "", gpa: "" };

const emptyForm: FormData = {
  name: "",
  phone: "",
  email: "",
  linkedin: "",
  github: "",
  educations: [{ ...emptyEdu }],
  jd: "",
};

function loadParsedDocs(): ParsedDoc[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PARSED_DOCS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveParsedDocs(docs: ParsedDoc[]) {
  try {
    localStorage.setItem(PARSED_DOCS_KEY, JSON.stringify(docs));
  } catch { /* quota */ }
}

// ── Draft persistence ──────────────────────────────────────

interface Draft {
  step: number;
  form: FormData;
  files: UploadedFile[];
}

function sanitizeEdu(raw: unknown): EduEntry {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    school: String(obj.school ?? ""),
    major: String(obj.major ?? ""),
    start: String(obj.start ?? obj.startDate ?? ""),
    end: String(obj.end ?? obj.endDate ?? ""),
    gpa: String(obj.gpa ?? ""),
  };
}

function sanitizeFile(raw: unknown): UploadedFile {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: String(obj.name ?? ""),
    category: String(obj.category ?? ""),
    charCount: typeof obj.charCount === "number" ? obj.charCount : 0,
  };
}

function loadDraft(): Draft {
  if (typeof window === "undefined")
    return { step: 0, form: emptyForm, files: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { step: 0, form: emptyForm, files: [] };
    const p = JSON.parse(raw);
    const form: FormData = { ...emptyForm, ...p.form };

    const rawEdus = Array.isArray(form.educations) ? form.educations : [];
    form.educations = rawEdus.length > 0
      ? rawEdus.map(sanitizeEdu)
      : [{ ...emptyEdu }];

    const rawFiles: unknown[] = Array.isArray(p.files) ? p.files : [];

    return {
      step: typeof p.step === "number" ? p.step : 0,
      form,
      files: rawFiles.map(sanitizeFile),
    };
  } catch {
    return { step: 0, form: emptyForm, files: [] };
  }
}

function saveDraft(step: number, form: FormData, files?: UploadedFile[]) {
  try {
    const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step, form, files: files ?? prev.files ?? [] })
    );
  } catch {
    /* quota exceeded */
  }
}

// ── Sub-components ─────────────────────────────────────────

function StepIndicator({
  current,
  labels,
}: {
  current: number;
  labels: [string, string];
}) {
  return (
    <div className="flex items-center justify-center gap-0">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
            current === 0
              ? "bg-[#111111] text-white"
              : "bg-[#f5f5f7] text-[#999999]"
          }`}
        >
          1
        </div>
        <span
          className={`hidden text-[13px] font-medium sm:inline ${
            current === 0 ? "text-[#111111]" : "text-[#999999]"
          }`}
        >
          {labels[0]}
        </span>
      </div>
      <div className="mx-3 h-px w-12 bg-[#e5e5e5] sm:w-20" />
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
            current === 1
              ? "bg-[#111111] text-white"
              : "bg-[#f5f5f7] text-[#999999]"
          }`}
        >
          2
        </div>
        <span
          className={`hidden text-[13px] font-medium sm:inline ${
            current === 1 ? "text-[#111111]" : "text-[#999999]"
          }`}
        >
          {labels[1]}
        </span>
      </div>
    </div>
  );
}

// ── Minimal markdown renderer tailored to our resume output ────────

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-inline-${idx++}`;
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-[#111111]">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded-md bg-[#f5f5f7] px-1.5 py-0.5 font-mono text-[12px] text-[#333333]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(
        <em key={key} className="text-[#666666]">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function ResumeMarkdownRender({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p className="text-center text-[13px] text-[#999999]">—</p>;
  }
  const lines = markdown.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push(
        <h1
          key={`h1-${keyIdx++}`}
          className="text-[24px] font-bold tracking-tight text-[#111111]"
        >
          {renderInline(trimmed.slice(2), `h1-${keyIdx}`)}
        </h1>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push(
        <h2
          key={`h2-${keyIdx++}`}
          className="mt-4 border-b border-[#f0f0f2] pb-1.5 text-[14px] font-bold uppercase tracking-wider text-[#111111]"
        >
          {renderInline(trimmed.slice(3), `h2-${keyIdx}`)}
        </h2>,
      );
      i++;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push(
        <ul key={`ul-${keyIdx++}`} className="ml-2 flex flex-col gap-1.5">
          {items.map((it, j) => (
            <li
              key={j}
              className="flex gap-2 text-[13.5px] leading-relaxed text-[#333333]"
            >
              <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#999999]" />
              <span>{renderInline(it, `li-${keyIdx}-${j}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    blocks.push(
      <p
        key={`p-${keyIdx++}`}
        className="text-[13.5px] leading-relaxed text-[#333333]"
      >
        {renderInline(trimmed, `p-${keyIdx}`)}
      </p>,
    );
    i++;
  }

  return <div className="flex flex-col gap-2.5">{blocks}</div>;
}

function PhotoUpload({ label, hint }: { label: string; hint: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-[13px] text-[#666666]">{label}</Label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f5f7] transition-colors hover:bg-[#ebebeb]"
        >
          {preview ? (
            <img
              src={preview}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          ) : (
            <Camera
              className="h-6 w-6 text-[#999999] transition-colors group-hover:text-[#666666]"
              strokeWidth={1.6}
            />
          )}
        </button>
        <span className="text-[12px] leading-relaxed text-[#999999]">
          {hint}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    </div>
  );
}

// ── Resume output language ─────────────────────────────────

const resumeLangOptions: { value: Locale; label: string }[] = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
];

function loadResumeLang(fallback: Locale): Locale {
  if (typeof window === "undefined") return fallback;
  const saved = localStorage.getItem(RESUME_LANG_KEY);
  if (saved === "zh" || saved === "en" || saved === "de") return saved;
  return fallback;
}

// ── Main page component ────────────────────────────────────

export default function BuilderPage() {
  const t = useTranslations("Builder");
  const uiLocale = useLocale() as Locale;

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [resumeLang, setResumeLang] = useState<Locale>(uiLocale);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("europe");
  const [customTplThumb, setCustomTplThumb] = useState<string | null>(null);
  const tplFileRef = useRef<HTMLInputElement>(null);

  const [apiConfigOpen, setApiConfigOpen] = useState(false);
  const [apiConfig, setApiConfig] = useState<ApiConfig | null>(null);

  const [savedToast, setSavedToast] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  // `resumeJson` is the AI-generated source of truth. Once set, switching
  // template / language re-renders locally WITHOUT a second AI call.
  const [resumeJson, setResumeJson] = useState<ResumeJson | null>(null);
  // Set to true the first time the AI call succeeds. Drives button behavior:
  // primary click re-renders with the new template instead of re-calling AI.
  const [hasGenerated, setHasGenerated] = useState(false);
  // Track the language / template used in the most recent successful AI call
  // so we can tell when a new AI call is actually needed vs a free re-render.
  const [lastLanguage, setLastLanguage] = useState<string | null>(null);
  const [lastTemplate, setLastTemplate] = useState<string | null>(null);
  const [lastDataHash, setLastDataHash] = useState<string | null>(null);
  const [resumePreviewMarkdown, setResumePreviewMarkdown] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfErrorTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const [wordDownloading, setWordDownloading] = useState(false);

  // ── Hydrate from localStorage ──

  useEffect(() => {
    const draft = loadDraft();
    setStep(draft.step);
    setForm(draft.form);
    setUploadedFiles(draft.files);
    setResumeLang(loadResumeLang(uiLocale));

    const savedTpl = localStorage.getItem(TEMPLATE_KEY);
    if (savedTpl === "china" || savedTpl === "europe" || savedTpl === "ats" || savedTpl === "custom") {
      setSelectedTemplate(savedTpl);
    }
    const savedThumb = localStorage.getItem(CUSTOM_TPL_KEY);
    if (savedThumb) setCustomTplThumb(savedThumb);

    setApiConfig(loadApiConfig());
    setHydrated(true);
  }, [uiLocale]);

  useEffect(() => {
    if (hydrated) saveDraft(step, form, uploadedFiles);
  }, [step, form, hydrated, uploadedFiles]);

  // ── Simple field helpers ──

  function updateField(key: keyof Omit<FormData, "educations">, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function bindField(key: keyof Omit<FormData, "educations">) {
    return {
      value: form[key] as string,
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        updateField(key, e.target.value),
    };
  }

  // ── Education list helpers ──

  function updateEdu(index: number, key: keyof EduEntry, value: string) {
    setForm((prev) => {
      const educations = prev.educations.map((edu, i) =>
        i === index ? { ...edu, [key]: value } : edu
      );
      return { ...prev, educations };
    });
  }

  function addEdu() {
    setForm((prev) => ({
      ...prev,
      educations: [...prev.educations, { ...emptyEdu }],
    }));
  }

  function removeEdu(index: number) {
    setForm((prev) => {
      const educations = prev.educations.filter((_, i) => i !== index);
      return {
        ...prev,
        educations: educations.length > 0 ? educations : [{ ...emptyEdu }],
      };
    });
  }

  // ── Template selection ──

  function selectTemplate(id: TemplateId) {
    if (id === "custom") {
      tplFileRef.current?.click();
      return;
    }
    setSelectedTemplate(id);
    localStorage.setItem(TEMPLATE_KEY, id);
  }

  function handleCustomTemplateFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCustomTplThumb(base64);
      setSelectedTemplate("custom");
      localStorage.setItem(TEMPLATE_KEY, "custom");
      localStorage.setItem(CUSTOM_TPL_KEY, base64);
    };
    reader.readAsDataURL(file);
  }

  function removeCustomTemplate() {
    setCustomTplThumb(null);
    setSelectedTemplate("europe");
    localStorage.setItem(TEMPLATE_KEY, "europe");
    localStorage.removeItem(CUSTOM_TPL_KEY);
  }

  // ── File upload ──

  const handleFilesUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setUploading(true);
      setUploadErrors([]);

      try {
        const body = new window.FormData();
        fileArray.forEach((f) => body.append("files", f));
        console.log(`[upload] Sending ${fileArray.length} file(s)…`);

        const res = await fetch("/api/parse", { method: "POST", body });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[upload] Server ${res.status}: ${errBody}`);
          setUploadErrors([`Server error ${res.status}`]);
          return;
        }

        const data = await res.json();
        const results: {
          name: string;
          text: string;
          category: string;
          error?: string;
        }[] = data.results ?? [];

        const newFiles: UploadedFile[] = [];
        const newDocs: ParsedDoc[] = [];
        const errors: string[] = [];

        for (const r of results) {
          if (r.category === "error") {
            console.warn(`[upload] ✗ ${r.name}: ${r.error}`);
            errors.push(`${r.name}: ${r.error}`);
            continue;
          }
          if (!r.text) continue;

          console.log(
            `[upload] ✓ ${r.name}: ${r.text.length} chars → ${r.category}`
          );
          newFiles.push({ name: r.name, category: r.category, charCount: r.text.length });
          newDocs.push({ name: r.name, text: r.text });
        }

        if (newFiles.length > 0) {
          setUploadedFiles((prev) => [...prev, ...newFiles]);
          const existingDocs = loadParsedDocs();
          saveParsedDocs([...existingDocs, ...newDocs]);
        }
        if (errors.length > 0) setUploadErrors(errors);
      } catch (err) {
        console.error("[upload] Network error:", err);
        setUploadErrors(["Network error — please try again"]);
      } finally {
        setUploading(false);
      }
    },
    []
  );

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFilesUpload(e.dataTransfer.files);
  }

  function removeFile(index: number) {
    const removed = uploadedFiles[index];
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    if (removed) {
      const docs = loadParsedDocs().filter((d) => d.name !== removed.name);
      saveParsedDocs(docs);
    }
  }

  // ── Generate resume ──

  async function handleGenerate() {
    if (generating) return;
    if (!apiConfig?.apiKey) {
      setApiConfigOpen(true);
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setResumeJson(null);
    setResumePreviewMarkdown("");
    setSuggestions([]);
    setJsonExpanded(false);

    try {
      const parsedDocs = loadParsedDocs();
      const supplementalText = parsedDocs.map((d) => d.text).join("\n\n---\n\n");

      const payload = {
        mode: "generate" as const,
        resumeLanguage: resumeLang,
        templateType: selectedTemplate,
        customTemplateDesc: selectedTemplate === "custom" && customTplThumb
          ? "User uploaded a custom template image. Use a clean professional layout."
          : undefined,
        userData: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          linkedin: form.linkedin,
          github: form.github,
          educations: form.educations,
        },
        supplementalText: supplementalText || undefined,
        jobDescription: form.jd || undefined,
        provider: apiConfig.provider,
        apiKey: apiConfig.apiKey,
        model: apiConfig.model || undefined,
        baseURL: apiConfig.baseURL || undefined,
      };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error ${res.status}`);
      }

      console.log("[generate] Resume JSON:", data.resumeJson);
      const parsedResume = data.resumeJson as ResumeJson;
      setResumeJson(parsedResume);
      setHasGenerated(true);
      // Record the language + template + data hash that were used for THIS AI call
      setLastLanguage(resumeLang);
      setLastTemplate(selectedTemplate);
      setLastDataHash(JSON.stringify({ form, files: uploadedFiles.map((f) => f.name + f.charCount) }));
      setResumePreviewMarkdown(resumeJsonToMarkdown(parsedResume, resumeLang));
      setSuggestions(
        Array.isArray(parsedResume.suggestions)
          ? parsedResume.suggestions.filter((s) => typeof s === "string" && s.trim().length > 0)
          : []
      );

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[generate] Error:", msg);
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  }

  // ── Re-render with a new template / language (NO AI call) ──
  //
  // Once the first successful AI generation has cached `resumeJson`, any
  // subsequent template or language change only needs to re-run the pure
  // JSON → Markdown transform locally. This costs zero tokens and returns
  // instantly. The PDF download endpoint always reads the CURRENT
  // `selectedTemplate` at click time, so the PDF layout also reflects the
  // switch automatically — no extra work needed here.

  function handleRenderWithNewTemplate() {
    if (!resumeJson) return;
    setGenerateError(null);
    // Record the template used for this re-render so the button label updates
    setLastTemplate(selectedTemplate);
    setResumePreviewMarkdown(resumeJsonToMarkdown(resumeJson, resumeLang));
    setSuggestions(
      Array.isArray(resumeJson.suggestions)
        ? resumeJson.suggestions.filter(
            (s) => typeof s === "string" && s.trim().length > 0,
          )
        : [],
    );
    setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }

  async function handleCopyMarkdown() {
    if (!resumePreviewMarkdown) return;
    try {
      await navigator.clipboard.writeText(resumePreviewMarkdown);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("[copy] Clipboard unavailable:", err);
    }
  }

  // ── Download PDF ──
  //
  // Streams a fully-rendered PDF from /api/pdf. The generation happens
  // server-side (see app/api/pdf/route.tsx), so the browser tab never blocks
  // on @react-pdf layout or font fetching.

  async function handleDownloadPdf() {
    if (!resumeJson || pdfDownloading) return;

    setPdfDownloading(true);
    setPdfError(null);
    if (pdfErrorTimer.current) {
      clearTimeout(pdfErrorTimer.current);
      pdfErrorTimer.current = null;
    }

    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resumeJson,
          templateType: selectedTemplate,
          fallbackLang: resumeLang,
        }),
      });

      if (!res.ok) {
        // Server replied with JSON { error } on failures
        let msg = `Server ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg = errJson.error;
        } catch {
          /* non-JSON error body; fall back to status */
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const rawName =
        (resumeJson.personalInfo?.name ?? "").trim() || "Resume";
      const safeName = rawName
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\s+/g, "_")
        .trim();
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const filename = `简历_${safeName}_${dateStr}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Release the blob URL on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[pdf] download failed:", msg);
      setPdfError(msg);
      pdfErrorTimer.current = setTimeout(() => setPdfError(null), 8000);
    } finally {
      setPdfDownloading(false);
    }
  }

  async function handleDownloadWord() {
    if (!resumeJson || wordDownloading) return;

    setWordDownloading(true);
    setPdfError(null);
    if (pdfErrorTimer.current) {
      clearTimeout(pdfErrorTimer.current);
      pdfErrorTimer.current = null;
    }

    try {
      const { generateWordDocument } = await import("@/components/ResumeWord");
      const { saveAs } = await import("file-saver");
      
      const blob = await generateWordDocument(resumeJson, selectedTemplate, resumeLang);
      
      const rawName = (resumeJson.personalInfo?.name ?? "").trim() || "Resume";
      const safeName = rawName
        .replace(/[\\/:*?"<>|]+/g, "")
        .replace(/\\s+/g, "_")
        .trim();
      const d = new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const filename = `简历_${safeName}_${dateStr}.docx`;

      saveAs(blob, filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Word generation failed";
      console.error("[word] download failed:", msg);
      setPdfError(msg);
      pdfErrorTimer.current = setTimeout(() => setPdfError(null), 8000);
    } finally {
      setWordDownloading(false);
    }
  }

  // ── Loading state ──

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5e5] border-t-[#111111]" />
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-white">
      <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <Sidebar
        activeItem="upload"
        onItemChange={() => {}}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onApiConfig={() => setApiConfigOpen(true)}
      />

      <main className="pt-14 md:ml-60">
        <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-16">
          <h1 className="mb-8 text-center text-[24px] font-bold tracking-tight text-[#111111] md:text-[32px]">
            {t("title")}
          </h1>

          <div className="mx-auto max-w-2xl">

          <div className="mb-10">
            <StepIndicator
              current={step}
              labels={[t("step1"), t("step2")]}
            />
          </div>

          {/* ═══ Card ═══ */}
          <div className="rounded-3xl bg-[#fafafa] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] md:p-10">
            {/* ─── Step 1 ─── */}
            {step === 0 && (
              <div className="flex flex-col gap-6">
                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name" className="text-[13px] text-[#666666]">
                    {t("name")}
                  </Label>
                  <Input
                    id="name"
                    placeholder={t("namePlaceholder")}
                    className={INPUT_CLS}
                    {...bindField("name")}
                  />
                </div>

                {/* Photo */}
                <PhotoUpload label={t("photo")} hint={t("photoHint")} />

                {/* Phone + Email */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone" className="text-[13px] text-[#666666]">
                      {t("phone")}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder={t("phonePlaceholder")}
                      className={INPUT_CLS}
                      {...bindField("phone")}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-[13px] text-[#666666]">
                      {t("email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      className={INPUT_CLS}
                      {...bindField("email")}
                    />
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="linkedin" className="text-[13px] text-[#666666]">
                    {t("linkedinLabel")}
                    <span className="ml-1 text-[12px] text-[#bbbbbb]">
                      ({t("optional")})
                    </span>
                  </Label>
                  <Input
                    id="linkedin"
                    placeholder="https://linkedin.com/in/yourname"
                    className={INPUT_CLS}
                    {...bindField("linkedin")}
                  />
                </div>

                {/* GitHub */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="github" className="text-[13px] text-[#666666]">
                    {t("githubLabel")}
                    <span className="ml-1 text-[12px] text-[#bbbbbb]">
                      ({t("optional")})
                    </span>
                  </Label>
                  <Input
                    id="github"
                    placeholder="https://github.com/yourname"
                    className={INPUT_CLS}
                    {...bindField("github")}
                  />
                </div>

                {/* ─── Education list ─── */}
                <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <h3 className="text-[15px] font-semibold text-[#111111]">
                    {t("education")}
                  </h3>

                  <div className="flex flex-col gap-5">
                    {(form.educations ?? []).map((edu, idx) => {
                      if (!edu) return null;
                      return (
                      <div
                        key={idx}
                        className="relative flex flex-col gap-4 rounded-xl bg-[#fafafa] p-4"
                      >
                        {/* Delete button */}
                        {(form.educations?.length ?? 0) > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEdu(idx)}
                            className="absolute right-3 top-3 rounded-lg p-1.5 text-[#cccccc] transition-colors hover:bg-white hover:text-[#ff3b30]"
                            title={t("removeEdu")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* School + Major */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:pr-8">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-[13px] text-[#666666]">
                              {t("school")}
                            </Label>
                            <Input
                              placeholder={t("schoolPlaceholder")}
                              className={INPUT_INNER_CLS}
                              value={edu.school}
                              onChange={(e) =>
                                updateEdu(idx, "school", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-[13px] text-[#666666]">
                              {t("major")}
                            </Label>
                            <Input
                              placeholder={t("majorPlaceholder")}
                              className={INPUT_INNER_CLS}
                              value={edu.major}
                              onChange={(e) =>
                                updateEdu(idx, "major", e.target.value)
                              }
                            />
                          </div>
                        </div>

                        {/* Start / End / GPA */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-[13px] text-[#666666]">
                              {t("eduStart")}
                            </Label>
                            <Input
                              placeholder="2020.09"
                              className={INPUT_INNER_CLS}
                              value={edu.start}
                              onChange={(e) =>
                                updateEdu(idx, "start", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-[13px] text-[#666666]">
                              {t("eduEnd")}
                            </Label>
                            <Input
                              placeholder="2024.06"
                              className={INPUT_INNER_CLS}
                              value={edu.end}
                              onChange={(e) =>
                                updateEdu(idx, "end", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <Label className="text-[13px] text-[#666666]">
                              GPA
                              <span className="ml-1 text-[11px] text-[#bbbbbb]">
                                ({t("optional")})
                              </span>
                            </Label>
                            <Input
                              placeholder="3.8 / 4.0"
                              className={INPUT_INNER_CLS}
                              value={edu.gpa}
                              onChange={(e) =>
                                updateEdu(idx, "gpa", e.target.value)
                              }
                            />
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>

                  {/* Add education button */}
                  <button
                    type="button"
                    onClick={addEdu}
                    className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#e5e5e5] py-3 text-[14px] font-medium text-[#999999] transition-colors hover:border-[#cccccc] hover:text-[#666666]"
                  >
                    <Plus className="h-4 w-4" />
                    {t("addEdu")}
                  </button>
                </div>

                {/* ─── File upload ─── */}
                <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#111111]">
                      {t("uploadTitle")}
                    </h3>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#999999]">
                      {t("uploadFormats")}
                    </p>
                  </div>

                  {/* Drop zone — idle / uploading / success */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-8 transition-all duration-300 ${
                      uploading
                        ? "border-[#e5e5e5] bg-[#fafafa]"
                        : uploadedFiles.length > 0
                          ? "animate-in zoom-in-95 border-emerald-200 bg-emerald-50/60"
                          : dragOver
                            ? "border-[#111111] bg-[#f5f5f7]"
                            : "border-[#e5e5e5] bg-[#fafafa] hover:border-[#cccccc] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-7 w-7 animate-spin text-[#999999]" />
                        <span className="text-[13px] font-medium text-[#999999]">
                          {t("uploadParsing")}
                        </span>
                      </>
                    ) : uploadedFiles.length > 0 ? (
                      <>
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" strokeWidth={1.6} />
                        <span className="text-[14px] font-semibold text-emerald-700">
                          {t("uploadDoneChars", { count: uploadedFiles.reduce((s, f) => s + (f.charCount || 0), 0) })}
                        </span>
                        <span className="text-[12px] text-emerald-600/70">
                          {t("uploadMore")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-7 w-7 text-[#999999]" strokeWidth={1.6} />
                        <span className="text-[13px] text-[#999999]">
                          {t("uploadDragHint")}
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPT_DOCS}
                    onChange={(e) => {
                      if (e.target.files) handleFilesUpload(e.target.files);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />

                  {/* Error messages */}
                  {uploadErrors.length > 0 && (
                    <div className="flex flex-col gap-1.5 rounded-xl bg-red-50 px-4 py-3">
                      {uploadErrors.map((err, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-[13px] text-red-600"
                        >
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{err}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File list */}
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {uploadedFiles.map((f, i) => (
                        <div
                          key={`${f.name}-${i}`}
                          className="flex items-center gap-3 rounded-xl bg-[#f5f5f7] px-4 py-2.5"
                        >
                          <FileText
                            className="h-4 w-4 shrink-0 text-[#999999]"
                            strokeWidth={1.6}
                          />
                          <span className="flex-1 truncate text-[13px] text-[#333333]">
                            {f.name}
                          </span>
                          <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-[#999999]">
                            {(f.charCount || 0).toLocaleString()} {t("chars")}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="shrink-0 rounded-lg p-1 text-[#bbbbbb] transition-colors hover:bg-white hover:text-[#666666]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ─── Step 2 ─── */}
            {step === 1 && (
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[13px] text-[#666666]">
                    {t("jd")}
                  </Label>
                  <p className="text-[12px] leading-relaxed text-[#999999]">
                    {t("jdHint")}
                  </p>
                  <Textarea
                    rows={14}
                    placeholder={t("jdPlaceholder")}
                    className="min-h-[280px] rounded-xl border-[#e5e5e5] bg-white text-[15px] leading-relaxed focus-visible:border-[#111111] focus-visible:ring-[#111111]/10 md:min-h-[360px]"
                    {...bindField("jd")}
                  />
                </div>

                {/* Resume output language */}
                <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-2">
                    <Globe
                      className="h-4 w-4 text-[#999999]"
                      strokeWidth={1.6}
                    />
                    <h3 className="text-[15px] font-semibold text-[#111111]">
                      {t("outputLang")}
                    </h3>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[#999999]">
                    {t("outputLangHint")}
                  </p>
                  <div className="flex rounded-xl bg-[#f5f5f7] p-1">
                    {resumeLangOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setResumeLang(opt.value);
                          localStorage.setItem(RESUME_LANG_KEY, opt.value);
                        }}
                        className={`flex-1 rounded-lg py-2.5 text-[14px] font-medium transition-all ${
                          resumeLang === opt.value
                            ? "bg-[#111111] text-white shadow-sm"
                            : "text-[#666666] hover:text-[#111111]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ─── Template selector ─── */}
                {/* Custom templates are layout references only — AI ignores all text content inside, recognizing structure only */}
                <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                  <h3 className="text-[15px] font-semibold text-[#111111]">
                    {t("tplTitle")}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {builtinTemplates.map(({ id, icon: Icon, labelKey }) => {
                      const active = selectedTemplate === id;
                      const isCustom = id === "custom";
                      const hasThumb = isCustom && customTplThumb;

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectTemplate(id)}
                          className={`group flex flex-col items-center gap-2.5 rounded-2xl border-2 px-3 py-5 transition-all ${
                            active
                              ? "border-[#111111] bg-[#f5f5f7] shadow-sm"
                              : "border-transparent bg-[#f5f5f7]/60 hover:bg-[#f0f0f2]"
                          }`}
                        >
                          {hasThumb ? (
                            <img
                              src={customTplThumb!}
                              alt="custom"
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                                active ? "bg-[#111111] text-white" : "bg-white text-[#999999] shadow-sm"
                              }`}
                            >
                              <Icon className="h-5 w-5" strokeWidth={1.6} />
                            </div>
                          )}
                          <span
                            className={`text-center text-[12px] font-medium leading-tight ${
                              active ? "text-[#111111]" : "text-[#666666]"
                            }`}
                          >
                            {isCustom && hasThumb ? t("tplCustomDone") : t(labelKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <input
                    ref={tplFileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
                    onChange={handleCustomTemplateFile}
                    className="hidden"
                  />
                  {selectedTemplate === "custom" && (
                    <p className="text-[11px] leading-relaxed text-[#999999]">
                      {t("tplCustomHint")}
                    </p>
                  )}

                  {/* Template preview */}
                  <div className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
                    <div className="flex items-center justify-between border-b border-[#f0f0f2] px-4 py-2">
                      <span className="text-[12px] font-medium text-[#999999]">
                        {t("tplPreview")}
                      </span>
                      {selectedTemplate === "custom" && customTplThumb && (
                        <button
                          type="button"
                          onClick={removeCustomTemplate}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#bbbbbb] transition-colors hover:bg-red-50 hover:text-[#ff3b30]"
                          title={t("tplDelete")}
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline">{t("tplDelete")}</span>
                        </button>
                      )}
                    </div>
                    {selectedTemplate === "custom" && customTplThumb ? (
                      <div className="flex items-center justify-center p-4">
                        <img
                          src={customTplThumb}
                          alt="template preview"
                          className="max-h-48 rounded-lg object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 p-5">
                        {selectedTemplate === "china" && (
                          <div className="flex gap-4">
                            <div className="h-14 w-14 shrink-0 rounded-full bg-[#e5e5e5]" />
                            <div className="flex flex-1 flex-col gap-2">
                              <div className="h-3 w-28 rounded bg-[#111111]" />
                              <div className="h-2 w-20 rounded bg-[#e5e5e5]" />
                            </div>
                          </div>
                        )}
                        {selectedTemplate === "europe" && (
                          <div className="flex flex-col gap-2">
                            <div className="h-3 w-32 rounded bg-[#111111]" />
                            <div className="h-2 w-24 rounded bg-[#e5e5e5]" />
                          </div>
                        )}
                        {selectedTemplate === "ats" && (
                          <div className="flex flex-col gap-2">
                            <div className="h-3 w-36 rounded bg-[#111111]" />
                            <div className="h-2 w-20 rounded bg-[#e5e5e5]" />
                          </div>
                        )}
                        <div className="h-px bg-[#f0f0f2]" />
                        <div className="flex flex-col gap-1.5">
                          <div className="h-2 w-16 rounded bg-[#cccccc]" />
                          <div className="h-2 w-full rounded bg-[#f0f0f2]" />
                          <div className="h-2 w-4/5 rounded bg-[#f0f0f2]" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="h-2 w-20 rounded bg-[#cccccc]" />
                          <div className="h-2 w-full rounded bg-[#f0f0f2]" />
                          <div className="h-2 w-3/4 rounded bg-[#f0f0f2]" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══ Action buttons ═══ */}
          <div className="mt-8 flex items-center justify-between">
            <div>
              {step > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep((s) => s - 1)}
                  className="h-11 rounded-full px-6 text-[14px] font-medium text-[#666666] hover:text-[#111111]"
                >
                  <ArrowLeft className="mr-1.5 h-4 w-4" />
                  {t("prev")}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  saveDraft(step, form, uploadedFiles);
                  setSavedToast(true);
                  if (savedTimer.current) clearTimeout(savedTimer.current);
                  savedTimer.current = setTimeout(() => setSavedToast(false), 2000);
                }}
                className="h-11 rounded-full border-[#e5e5e5] px-5 text-[14px] font-medium text-[#666666] hover:border-[#cccccc] hover:text-[#111111]"
              >
                {savedToast ? (
                  <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-500" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                {savedToast ? t("draftSaved") : t("saveDraft")}
              </Button>

              {step < TOTAL_STEPS - 1 && (
                <Button
                  onClick={() => setStep((s) => s + 1)}
                  className="group h-11 rounded-full bg-[#111111] px-7 text-[14px] font-medium text-white shadow-none transition-all hover:bg-[#333333]"
                >
                  {t("next")}
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              )}
            </div>
          </div>

          {/* ═══ Generate Resume — primary CTA + result area ═══ */}
          {step === TOTAL_STEPS - 1 && (() => {
            const currentDataHash = JSON.stringify({ form, files: uploadedFiles.map((f) => f.name + f.charCount) });
            const isDataChanged = lastDataHash !== null && lastDataHash !== currentDataHash;

            // Decide whether the primary button needs a full AI call.
            // True when: first generation, OR the user changed the output language, OR data/JD changed.
            const needRegenerateAI =
              !hasGenerated ||
              resumeLang !== lastLanguage ||
              isDataChanged;

            // True when only the template changed (language/data are the same) — free re-render.
            const onlyTemplateChanged =
              hasGenerated &&
              !needRegenerateAI &&
              selectedTemplate !== lastTemplate;

            // Choose the handler for the primary button.
            const primaryHandler = needRegenerateAI
              ? handleGenerate
              : handleRenderWithNewTemplate;

            // Choose the label for the primary button.
            const primaryLabel = generating
              ? t("generating")
              : needRegenerateAI && hasGenerated
                ? isDataChanged
                  ? t("forceAiRegenerate")
                  : (t("regenerateNewLang") ?? "重新生成简历（新语言）")
                : onlyTemplateChanged
                  ? (t("rerenderNewTemplate") ?? "使用新模板重新渲染（无需调用AI）")
                  : hasGenerated
                    ? t("regenerateWithNewTemplate")
                    : t("generateResume");

            return (
            <div className="mt-10 flex flex-col items-center gap-5">
              {/* ── Loading card ── */}
              {generating && (
                <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl bg-[#fafafa] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-[#e5e5e5] border-t-[#111111]" />
                    <Sparkles className="h-6 w-6 text-[#111111]" strokeWidth={1.6} />
                  </div>
                  <span className="text-[15px] font-semibold text-[#111111]">
                    {t("generating")}
                  </span>
                  <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[#e5e5e5]">
                    <div className="h-full w-1/2 animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-[#111111] via-[#555555] to-[#111111] bg-[length:200%_100%]" />
                  </div>
                </div>
              )}

              {/* ── Generate button ──
                  - Language changed   → full AI call (re-generate in new language)
                  - Template only      → local re-layout (zero tokens)
                  - First generation   → full AI call */}
              <Button
                onClick={primaryHandler}
                disabled={generating}
                className="group h-14 w-full max-w-md rounded-2xl bg-gradient-to-r from-[#111111] to-[#333333] px-10 text-[16px] font-semibold text-white shadow-lg transition-all hover:from-[#222222] hover:to-[#444444] hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {primaryLabel}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5 transition-transform group-hover:rotate-12" />
                    {primaryLabel}
                  </>
                )}
              </Button>

              {/* Secondary action — lets the user EXPLICITLY pay tokens for a
                  fresh AI pass (e.g. after editing JD or supplemental docs). */}
              {hasGenerated && !generating && !needRegenerateAI && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="-mt-1 text-[12.5px] font-medium text-[#999999] underline-offset-[3px] transition-colors hover:text-[#111111] hover:underline"
                >
                  {t("forceAiRegenerate")}
                </button>
              )}

              {/* ── Error card ── */}
              {generateError && (
                <div className="flex w-full max-w-md items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-4 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                    <AlertCircle className="h-5 w-5 text-red-500" strokeWidth={1.8} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[14px] font-semibold text-red-700">
                      {t("generateFailed")}
                    </span>
                    <span className="text-[13px] leading-relaxed text-red-600/80">
                      {generateError}
                    </span>
                  </div>
                </div>
              )}

            </div>
            );
          })()}

          </div>

          {/* ── Success card + preview + suggestions (wide wrapper) ── */}
          {step === TOTAL_STEPS - 1 && resumeJson && !generating && (
            <div className="mt-6 flex w-full flex-col items-center gap-5">
                <div ref={resultRef} className="flex w-full flex-col gap-4">
                  {/* Success banner */}
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.8} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[15px] font-semibold text-emerald-800">
                        {t("generateSuccess")}
                      </span>
                      <span className="text-[12px] text-emerald-600/70">
                        {t("generateSuccessHint")}
                      </span>
                    </div>
                  </div>

                  {/* ═══ Download actions (PDF + Word) ═══ */}
                  <div className="flex flex-col gap-3 rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f5f5f7]">
                          <Download className="h-5 w-5 text-[#111111]" strokeWidth={1.8} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[14px] font-semibold text-[#111111]">
                            {t("downloadTitle")}
                          </span>
                          <span className="text-[12px] text-[#999999]">
                            {t("downloadHint")}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2.5">
                        <Button
                          type="button"
                          onClick={handleDownloadPdf}
                          disabled={pdfDownloading}
                          className="group h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 text-[15px] font-semibold text-white shadow-md transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg active:scale-[0.98] disabled:opacity-70 sm:w-auto sm:px-7"
                        >
                          {pdfDownloading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("downloadPreparing")}
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4 transition-transform group-hover:-translate-y-0.5" strokeWidth={2} />
                              {t("downloadPdf")}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleDownloadWord}
                          disabled={wordDownloading}
                          className="group h-12 w-full rounded-2xl border border-[#e5e5e5] bg-white px-5 text-[15px] font-semibold text-[#111111] shadow-sm transition-all hover:bg-[#f5f5f7] hover:text-[#111111] active:scale-[0.98] disabled:opacity-70 sm:w-auto sm:px-7"
                        >
                          {wordDownloading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("downloadPreparing")}
                            </>
                          ) : (
                            <>
                              <FileType2 className="mr-2 h-4 w-4 text-[#4361EE] transition-transform group-hover:-translate-y-0.5" strokeWidth={2} />
                              {t("downloadWord")}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    {pdfError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold">{t("downloadFailed")}</span>
                          <span className="text-[12px] text-red-600/80">{pdfError}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Preview + Suggestions — stacked on mobile, side-by-side on large screens */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                    {/* ═══ Resume preview card ═══ */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm lg:col-span-3">
                      <div className="flex items-center justify-between border-b border-[#f0f0f2] px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <FileEdit className="h-4 w-4 text-[#111111]" strokeWidth={1.8} />
                          <span className="text-[14px] font-semibold text-[#111111]">
                            {t("resumePreview")}
                          </span>
                          <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[11px] font-medium text-[#666666]">
                            {resumeLangOptions.find((o) => o.value === (resumeJson.language as Locale) || o.value === resumeLang)?.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyMarkdown}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#666666] transition-colors hover:bg-[#f5f5f7] hover:text-[#111111]"
                        >
                          {copied ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-600">{t("markdownCopied")}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>{t("copyMarkdown")}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="max-h-[640px] overflow-auto p-6">
                        <ResumeMarkdownRender markdown={resumePreviewMarkdown} />
                      </div>
                    </div>

                    {/* ═══ Suggestions card ═══ */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white shadow-sm lg:col-span-2">
                      <div className="flex items-center gap-2 border-b border-amber-100/70 px-5 py-3.5">
                        <Lightbulb className="h-4 w-4 text-amber-500" strokeWidth={1.8} />
                        <span className="text-[14px] font-semibold text-[#111111]">
                          {t("aiSuggestions")}
                        </span>
                        {suggestions.length > 0 && (
                          <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            {suggestions.length}
                          </span>
                        )}
                      </div>
                      <div className="max-h-[640px] overflow-auto p-5">
                        {suggestions.length === 0 ? (
                          <p className="py-8 text-center text-[13px] text-[#999999]">
                            {t("noSuggestions")}
                          </p>
                        ) : (
                          <ol className="flex flex-col gap-3">
                            {suggestions.map((s, i) => (
                              <li
                                key={i}
                                className="flex gap-3 text-[13px] leading-relaxed text-[#333333]"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-700">
                                  {i + 1}
                                </span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Collapsible raw JSON (debug) */}
                  <div className="overflow-hidden rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() => setJsonExpanded((v) => !v)}
                      className="flex w-full items-center justify-between px-5 py-3 transition-colors hover:bg-[#fafafa]"
                    >
                      <span className="text-[13px] font-medium text-[#666666]">
                        {t("jsonPreview")}
                      </span>
                      {jsonExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[#999999]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[#999999]" />
                      )}
                    </button>
                    {jsonExpanded && (
                      <div className="border-t border-[#f0f0f2] bg-[#fafafa] p-4">
                        <pre className="max-h-[420px] overflow-auto rounded-xl bg-[#111111] p-5 text-[12px] leading-relaxed text-emerald-300">
                          {JSON.stringify(resumeJson, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          )}

        </div>
      </main>

      {/* ═══ Model badge — fixed bottom-right ═══ */}
      {apiConfig && (
        <button
          type="button"
          onClick={() => setApiConfigOpen(true)}
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white/90 px-3.5 py-2 shadow-sm backdrop-blur-md transition-all hover:border-[#cccccc] hover:shadow-md active:scale-[0.97] md:bottom-6 md:right-8"
        >
          <div
            className={`h-2 w-2 rounded-full ${
              apiConfig.apiKey ? "bg-emerald-400" : "bg-[#cccccc]"
            }`}
          />
          <span className="text-[12px] font-medium text-[#666666]">
            {apiConfig.apiKey
              ? `${getProvider(apiConfig.provider).label} · ${resolveModel(apiConfig)} · ${maskKey(apiConfig.apiKey)}`
              : t("notConfigured")}
          </span>
        </button>
      )}

      {/* ═══ API Config Sheet ═══ */}
      <ApiConfigSheet
        open={apiConfigOpen}
        onClose={() => setApiConfigOpen(false)}
        onSave={(cfg) => setApiConfig(cfg)}
      />
    </div>
  );
}
