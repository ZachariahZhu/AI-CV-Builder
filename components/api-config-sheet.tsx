"use client";

import { useState, useEffect } from "react";
import {
  X,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ApiConfig,
  type ProviderId,
  PROVIDERS,
  loadApiConfig,
  saveApiConfig,
  getProvider,
  maskKey,
} from "@/lib/api-config";

interface ApiConfigSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (config: ApiConfig) => void;
}

export function ApiConfigSheet({ open, onClose, onSave }: ApiConfigSheetProps) {
  const t = useTranslations("Builder");

  const [config, setConfig] = useState<ApiConfig>(loadApiConfig);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setConfig(loadApiConfig());
      setResult(null);
      setShowKey(false);
    }
  }, [open]);

  // Lock body scroll while sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  function update<K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  async function testConnection() {
    if (!config.apiKey) return;
    setTesting(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Say hello in one sentence.",
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model || undefined,
          baseURL: config.provider === "custom" ? config.baseURL : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        saveApiConfig(config);
        onSave(config);
        setResult({ ok: true, msg: t("configSaved") });
      } else {
        setResult({ ok: false, msg: data.error || "Unknown error" });
      }
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setTesting(false);
    }
  }

  function handleSaveOnly() {
    saveApiConfig(config);
    onSave(config);
    setResult({ ok: true, msg: t("configSaved") });
  }

  const provider = getProvider(config.provider);
  const effectiveModel = config.model || provider.defaultModel;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Sheet panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ebebeb] px-6 py-4">
          <h2 className="text-[17px] font-semibold text-[#111111]">
            {t("apiSettings")}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666666] transition-colors hover:bg-[#f5f5f7] hover:text-[#111111]"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="flex flex-col gap-6">
            {/* ── Provider select ── */}
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] text-[#666666]">
                {t("selectProvider")}
              </Label>
              <div className="relative">
                <select
                  value={config.provider}
                  onChange={(e) =>
                    update("provider", e.target.value as ProviderId)
                  }
                  className="h-11 w-full appearance-none rounded-xl border border-[#e5e5e5] bg-white px-4 pr-10 text-[15px] text-[#111111] outline-none transition-colors focus:border-[#111111] focus:ring-1 focus:ring-[#111111]/10"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === "custom" ? t("providerCustom") : p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              </div>
            </div>

            {/* ── API Key ── */}
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] text-[#666666]">
                {t("apiKeyLabel")}
              </Label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) => update("apiKey", e.target.value)}
                  placeholder={t("apiKeyPlaceholder")}
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-[#e5e5e5] bg-white px-4 pr-11 font-mono text-[15px] text-[#111111] outline-none transition-colors focus:border-[#111111] focus:ring-1 focus:ring-[#111111]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#999999] transition-colors hover:text-[#666666]"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {config.apiKey && (
                <span className="text-[12px] text-[#bbbbbb]">
                  Key: {maskKey(config.apiKey)}
                </span>
              )}
            </div>

            {/* ── Model override ── */}
            <div className="flex flex-col gap-2">
              <Label className="text-[13px] text-[#666666]">
                {t("modelLabel")}
                <span className="ml-1 text-[12px] text-[#bbbbbb]">
                  ({t("optional")})
                </span>
              </Label>
              <Input
                value={config.model}
                onChange={(e) => update("model", e.target.value)}
                placeholder={
                  provider.defaultModel || t("modelPlaceholder")
                }
                className="h-11 rounded-xl border-[#e5e5e5] bg-white text-[15px] focus-visible:border-[#111111] focus-visible:ring-[#111111]/10"
              />
            </div>

            {/* ── Custom Base URL ── */}
            {config.provider === "custom" && (
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] text-[#666666]">
                  {t("customBaseURL")}
                </Label>
                <Input
                  value={config.baseURL}
                  onChange={(e) => update("baseURL", e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="h-11 rounded-xl border-[#e5e5e5] bg-white font-mono text-[15px] focus-visible:border-[#111111] focus-visible:ring-[#111111]/10"
                />
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={!config.apiKey || testing}
                onClick={testConnection}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#111111] text-[14px] font-medium text-white transition-all hover:bg-[#333333] active:scale-[0.98] disabled:opacity-40"
              >
                {testing && <Loader2 className="h-4 w-4 animate-spin" />}
                {testing ? t("testLoading") : t("testConnection")}
              </button>
              <button
                type="button"
                onClick={handleSaveOnly}
                disabled={!config.apiKey}
                className="flex h-11 items-center justify-center rounded-xl border border-[#e5e5e5] px-5 text-[14px] font-medium text-[#666666] transition-all hover:border-[#cccccc] hover:text-[#111111] active:scale-[0.98] disabled:opacity-40"
              >
                {t("saveDraft")}
              </button>
            </div>

            {/* ── Test result ── */}
            {result && (
              <div
                className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed ${
                  result.ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                }`}
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span className="break-all">{result.msg}</span>
              </div>
            )}

            {/* ── Current config summary ── */}
            <div className="rounded-xl bg-[#f5f5f7] px-4 py-3">
              <span className="text-[12px] font-medium text-[#999999]">
                {t("currentModel")}
              </span>
              <p className="mt-1 text-[14px] font-medium text-[#111111]">
                {provider.label} · {effectiveModel || "—"}
              </p>
              {config.apiKey && (
                <p className="mt-0.5 text-[12px] text-[#bbbbbb]">
                  Key: {maskKey(config.apiKey)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
