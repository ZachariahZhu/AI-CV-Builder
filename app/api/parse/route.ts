import { NextResponse } from "next/server";

const ACCEPTED_TYPES: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "text/plain": "txt",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function classify(text: string): "courses" | "transcript" | "experience" {
  const lower = text.toLowerCase();
  const courseRe =
    /\b(course|curriculum|syllabus|credit|semester|课程|学分|学期|必修|选修|kurs|vorlesung|seminar|ects)\b/gi;
  const transcriptRe =
    /\b(transcript|grade|gpa|score|成绩|绩点|分数|成绩单|zeugnis|note|durchschnitt)\b/gi;

  const courseHits = (lower.match(courseRe) || []).length;
  const transcriptHits = (lower.match(transcriptRe) || []).length;

  if (courseHits > transcriptHits) return "courses";
  if (transcriptHits > 0) return "transcript";
  return "experience";
}

async function parsePDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseTXT(file: File): Promise<string> {
  return await file.text();
}

interface ParseResult {
  name: string;
  text: string;
  type: string;
  category: string;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    console.log(`[parse] Received ${files.length} file(s)`);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    const results: ParseResult[] = [];

    for (const file of files) {
      const fileType = ACCEPTED_TYPES[file.type];
      console.log(
        `[parse] Processing: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)} KB)`
      );

      if (!fileType) {
        console.warn(`[parse] Rejected unsupported type: ${file.type}`);
        results.push({
          name: file.name,
          text: "",
          type: file.type,
          category: "error",
          error: `Unsupported type: ${file.type}`,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        console.warn(`[parse] Rejected oversized file: ${file.size} bytes`);
        results.push({
          name: file.name,
          text: "",
          type: fileType,
          category: "error",
          error: "File too large (max 10 MB)",
        });
        continue;
      }

      try {
        let text = "";

        if (fileType === "pdf") {
          const buffer = Buffer.from(await file.arrayBuffer());
          console.log(`[parse] Parsing PDF (${buffer.length} bytes)…`);
          text = await parsePDF(buffer);
        } else if (fileType === "docx") {
          const buffer = Buffer.from(await file.arrayBuffer());
          console.log(`[parse] Parsing DOCX (${buffer.length} bytes)…`);
          text = await parseDOCX(buffer);
        } else {
          console.log(`[parse] Reading TXT…`);
          text = await parseTXT(file);
        }

        text = text.replace(/\r\n/g, "\n").trim();
        const category = classify(text);

        console.log(
          `[parse] ✓ ${file.name}: ${text.length} chars, category=${category}`
        );

        results.push({
          name: file.name,
          text,
          type: fileType,
          category,
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown parse error";
        console.error(`[parse] ✗ ${file.name}: ${message}`);
        results.push({
          name: file.name,
          text: "",
          type: fileType,
          category: "error",
          error: message,
        });
      }
    }

    const ok = results.filter((r) => r.category !== "error").length;
    const failed = results.length - ok;
    console.log(`[parse] Done: ${ok} succeeded, ${failed} failed`);

    return NextResponse.json({ results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error(`[parse] Fatal: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
