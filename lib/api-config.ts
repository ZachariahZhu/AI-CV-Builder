export type ProviderId = "deepseek" | "openai" | "anthropic" | "gemini" | "custom";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  baseURL: string;
  defaultModel: string;
  format: "openai" | "anthropic";
}

export const PROVIDERS: ProviderMeta[] = [
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com", defaultModel: "deepseek-chat", format: "openai" },
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o", format: "openai" },
  { id: "anthropic", label: "Anthropic (Claude)", baseURL: "https://api.anthropic.com", defaultModel: "claude-sonnet-4-20250514", format: "anthropic" },
  { id: "gemini", label: "Google Gemini", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash", format: "openai" },
  { id: "custom", label: "OpenAI-compatible", baseURL: "", defaultModel: "", format: "openai" },
];

export interface ApiConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseURL: string;
}

const STORAGE_KEY = "resumeai-api-config";

export const DEFAULT_CONFIG: ApiConfig = {
  provider: "deepseek",
  apiKey: "",
  model: "",
  baseURL: "",
};

export function loadApiConfig(): ApiConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveApiConfig(config: ApiConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* quota */ }
}

export function getProvider(id: ProviderId): ProviderMeta {
  return PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];
}

export function maskKey(key: string): string {
  if (!key || key.length < 8) return key ? "••••" : "";
  return "••••" + key.slice(-4);
}

export function resolveModel(config: ApiConfig): string {
  if (config.model) return config.model;
  return getProvider(config.provider).defaultModel;
}
