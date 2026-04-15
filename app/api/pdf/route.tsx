/**
 * Server-side PDF generation route.
 *
 * Why this exists:
 *   Browser-side PDF generation (PDFDownloadLink) blocks the main thread
 *   while fetching fonts + running the layout engine, causing Chrome to
 *   pop the dreaded "page unresponsive" dialog on slower machines.
 *
 *   Server-side generation is fully async, multi-request safe (font bytes
 *   cached in module memory after first call), and the client only has to
 *   fetch a pre-rendered binary blob — no UI thread impact.
 *
 * Request:
 *   POST /api/pdf
 *   body: { resumeJson, templateType, fallbackLang }
 *
 * Response:
 *   200  application/pdf (binary stream)
 *   400  application/json { success:false, error }   — bad input
 *   500  application/json { success:false, error }   — render failure
 */

import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import ResumePDF, {
  ensurePdfFontsLoaded,
  type ResumePdfJson,
  type TemplateType,
  type ResumeLang,
} from "@/components/ResumePDF";

// @react-pdf/renderer is Node.js-only (uses pdfkit + node streams under the
// hood). Pin the runtime so Next never tries to run this on the Edge runtime.
export const runtime = "nodejs";
// Every request is unique — never cache response bodies.
export const dynamic = "force-dynamic";

const VALID_TEMPLATES: TemplateType[] = ["china", "europe", "ats", "custom"];
const VALID_LANGS: ResumeLang[] = ["zh", "en", "de"];

interface PdfRequestBody {
  resumeJson?: ResumePdfJson;
  templateType?: string;
  fallbackLang?: string;
}

function sanitizeForFilename(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_")
    .trim();
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(req: NextRequest) {
  let body: PdfRequestBody;
  try {
    body = (await req.json()) as PdfRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { resumeJson } = body;
  const templateType = (body.templateType ?? "custom") as TemplateType;
  const fallbackLang = (body.fallbackLang ?? "en") as ResumeLang;

  if (!resumeJson || typeof resumeJson !== "object") {
    return NextResponse.json(
      { success: false, error: "Missing resumeJson" },
      { status: 400 }
    );
  }
  if (!VALID_TEMPLATES.includes(templateType)) {
    return NextResponse.json(
      { success: false, error: `Invalid templateType: ${templateType}` },
      { status: 400 }
    );
  }
  if (!VALID_LANGS.includes(fallbackLang)) {
    return NextResponse.json(
      { success: false, error: `Invalid fallbackLang: ${fallbackLang}` },
      { status: 400 }
    );
  }

  try {
    // Fire-and-await font preload. Non-fatal if it fails — PDF still renders
    // with Helvetica fallback (Chinese may show as boxes in that case, but
    // the user gets *something* rather than a server error).
    const fontsOk = await ensurePdfFontsLoaded();

    const buffer = await renderToBuffer(
      <ResumePDF
        resumeJson={resumeJson}
        templateType={templateType}
        fallbackLang={fallbackLang}
      />
    );

    // Build a Chinese-safe Content-Disposition header.
    //   filename=    → ASCII fallback for legacy clients
    //   filename*=   → RFC 5987 UTF-8 percent-encoded, supported by all
    //                  modern browsers (Chrome/Firefox/Safari/Edge).
    const rawName = resumeJson.personalInfo?.name?.trim() || "Resume";
    const date = todayISO();
    const asciiName = `Resume_${date}.pdf`;
    const utf8Name = `简历_${sanitizeForFilename(rawName)}_${date}.pdf`;
    const contentDisposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
      utf8Name
    )}`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store, max-age=0",
        "X-Pdf-Font-Embedded": fontsOk ? "notosanssc" : "helvetica-fallback",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/pdf] render failure:", err);
    return NextResponse.json(
      { success: false, error: `PDF generation failed: ${msg}` },
      { status: 500 }
    );
  }
}
