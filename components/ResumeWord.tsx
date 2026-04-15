import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ISectionOptions,
} from "docx";
import type { ResumePdfJson, TemplateType, ResumeLang } from "@/components/ResumePDF";

// Localization headers
const H: Record<ResumeLang, { summary: string; edu: string; exp: string; skills: string; languages: string; gpa: string; contact: string; }> = {
  zh: { summary: "个人总结", edu: "教育背景", exp: "工作经历", skills: "专业技能", languages: "语言能力", gpa: "GPA", contact: "联系方式" },
  en: { summary: "Summary", edu: "Education", exp: "Experience", skills: "Skills", languages: "Languages", gpa: "GPA", contact: "Contact" },
  de: { summary: "Zusammenfassung", edu: "Ausbildung", exp: "Berufserfahrung", skills: "Kenntnisse", languages: "Sprachen", gpa: "GPA", contact: "Kontakt" },
};

function splitBullets(desc?: string): string[] {
  if (!desc) return [];
  return desc
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[-•]\s*/, ""));
}

function joinContact(info: ResumePdfJson["personalInfo"]): string {
  if (!info) return "";
  const bits: string[] = [];
  if (info.phone) bits.push(info.phone);
  if (info.email) bits.push(info.email);
  if (info.linkedin) bits.push(`LinkedIn: ${info.linkedin}`);
  if (info.github) bits.push(`GitHub: ${info.github}`);
  return bits.join("  |  ");
}

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "auto" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
  left: { style: BorderStyle.NONE, size: 0, color: "auto" },
  right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
};

const FONT = { ascii: "Arial", cs: "Arial", eastAsia: "Microsoft YaHei", hAnsi: "Arial" };

function createHeading(title: string) {
  return new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_2,
    border: {
      bottom: { color: "cccccc", space: 1, style: BorderStyle.SINGLE, size: 6 }
    }
  });
}

function createItemTitle(leftStr: string, rightStr: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorder,
            children: [
              new Paragraph({
                children: [new TextRun({ text: leftStr, bold: true, size: 22 })],
              })
            ]
          }),
          new TableCell({
            borders: noBorder,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: rightStr, color: "666666", size: 20 })],
              })
            ]
          })
        ]
      })
    ]
  });
}

function createBullet(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    children: [new TextRun({ text, size: 20, color: "444444" })],
    spacing: { before: 40, after: 40 }
  });
}

function buildChinaSections(resume: ResumePdfJson, l: ResumeLang): ISectionOptions[] {
  const h = H[l];
  const info = resume.personalInfo || {};
  const children: any[] = [];

  // Header
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: info.name || "", bold: true, size: 40 })],
      spacing: { after: 100 }
    })
  );

  const contact = joinContact(info);
  if (contact) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: contact, size: 20, color: "666666" })],
        spacing: { after: 240 }
      })
    );
  }

  if (resume.summary?.trim()) {
    children.push(createHeading(h.summary));
    children.push(new Paragraph({ children: [new TextRun({ text: resume.summary.trim(), size: 20 })] }));
  }

  const edus = (resume.education || []).filter(e => e.school || e.major);
  if (edus.length > 0) {
    children.push(createHeading(h.edu));
    edus.forEach(e => {
      children.push(createItemTitle(e.school || "", e.period || ""));
      const meta = [e.major, e.gpa ? `${h.gpa}: ${e.gpa}` : ""].filter(Boolean).join("  |  ");
      if (meta) {
        children.push(new Paragraph({ children: [new TextRun({ text: meta, size: 20, color: "444444" })] }));
      }
    });
  }

  const exps = (resume.experience || []).filter(e => e.company || e.position);
  if (exps.length > 0) {
    children.push(createHeading(h.exp));
    exps.forEach(e => {
      const title = [e.company, e.position].filter(Boolean).join(" — ");
      children.push(createItemTitle(title, e.period || ""));
      splitBullets(e.description).forEach(b => {
        children.push(createBullet(b));
      });
    });
  }

  const skills = (resume.skills || []).filter(Boolean);
  if (skills.length > 0) {
    children.push(createHeading(h.skills));
    children.push(new Paragraph({ children: [new TextRun({ text: skills.join("  ·  "), size: 20 })] }));
  }

  const languages = (resume.languages || []).filter(Boolean);
  if (languages.length > 0) {
    children.push(createHeading(h.languages));
    children.push(new Paragraph({ children: [new TextRun({ text: languages.join("  ·  "), size: 20 })] }));
  }

  return [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }];
}

function buildEuropeSections(resume: ResumePdfJson, l: ResumeLang): ISectionOptions[] {
  const h = H[l];
  const info = resume.personalInfo || {};

  const leftChildren: any[] = [];
  const rightChildren: any[] = [];

  // Left column (Name, Contact, Skills, Langs)
  leftChildren.push(new Paragraph({
    children: [new TextRun({ text: info.name || "", bold: true, size: 36 })],
    spacing: { after: 200 }
  }));
  
  if (info.phone) leftChildren.push(new Paragraph({ children: [new TextRun({ text: info.phone, size: 20 })] }));
  if (info.email) leftChildren.push(new Paragraph({ children: [new TextRun({ text: info.email, size: 20 })] }));
  if (info.linkedin) leftChildren.push(new Paragraph({ children: [new TextRun({ text: info.linkedin, size: 20 })] }));
  if (info.github) leftChildren.push(new Paragraph({ children: [new TextRun({ text: info.github, size: 20 })] }));

  const skills = (resume.skills || []).filter(Boolean);
  if (skills.length > 0) {
    leftChildren.push(new Paragraph({ text: h.skills, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));
    skills.forEach(s => leftChildren.push(new Paragraph({ children: [new TextRun({ text: s, size: 20 })] })));
  }

  const langs = (resume.languages || []).filter(Boolean);
  if (langs.length > 0) {
    leftChildren.push(new Paragraph({ text: h.languages, heading: HeadingLevel.HEADING_3, spacing: { before: 200 } }));
    langs.forEach(s => leftChildren.push(new Paragraph({ children: [new TextRun({ text: s, size: 20 })] })));
  }

  // Right column (Summary, Exp, Edu)
  if (resume.summary?.trim()) {
    rightChildren.push(createHeading(h.summary));
    rightChildren.push(new Paragraph({ children: [new TextRun({ text: resume.summary.trim(), size: 20 })] }));
  }

  const exps = (resume.experience || []).filter(e => e.company || e.position);
  if (exps.length > 0) {
    rightChildren.push(createHeading(h.exp));
    exps.forEach(e => {
      const title = [e.company, e.position].filter(Boolean).join(" — ");
      rightChildren.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22 })] }));
      if (e.period) rightChildren.push(new Paragraph({ children: [new TextRun({ text: e.period, size: 18, color: "666666" })] }));
      splitBullets(e.description).forEach(b => {
        rightChildren.push(createBullet(b));
      });
    });
  }

  const edus = (resume.education || []).filter(e => e.school || e.major);
  if (edus.length > 0) {
    rightChildren.push(createHeading(h.edu));
    edus.forEach(e => {
      rightChildren.push(new Paragraph({ children: [new TextRun({ text: e.school || "", bold: true, size: 22 })] }));
      if (e.major) rightChildren.push(new Paragraph({ children: [new TextRun({ text: e.major, size: 20 })] }));
      const meta = [e.period, e.gpa ? `${h.gpa}: ${e.gpa}` : ""].filter(Boolean).join("  |  ");
      if (meta) rightChildren.push(new Paragraph({ children: [new TextRun({ text: meta, size: 18, color: "666666" })] }));
    });
  }

  // Fallback if empty
  if (leftChildren.length === 0) leftChildren.push(new Paragraph(""));
  if (rightChildren.length === 0) rightChildren.push(new Paragraph(""));

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            margins: { right: 200 },
            borders: noBorder,
            children: leftChildren,
          }),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            margins: { left: 200 },
            borders: noBorder,
            children: rightChildren,
          })
        ]
      })
    ]
  });

  return [{ properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: [table] }];
}

function buildAtsSections(resume: ResumePdfJson, l: ResumeLang): ISectionOptions[] {
  return buildChinaSections(resume, l); // ATS and Custom share structural similarities with China in Word format
}

export async function generateWordDocument(
  resume: ResumePdfJson,
  templateType: TemplateType,
  fallbackLang: ResumeLang = "en"
): Promise<Blob> {
  const lang = (["zh", "en", "de"].includes(resume.language || "") ? resume.language : fallbackLang) as ResumeLang;
  
  let sections: ISectionOptions[] = [];
  if (templateType === "europe") {
    sections = buildEuropeSections(resume, lang);
  } else if (templateType === "ats" || templateType === "custom") {
    sections = buildAtsSections(resume, lang);
  } else {
    sections = buildChinaSections(resume, lang);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, color: "222222" },
          paragraph: { spacing: { line: 320 } }
        },
        heading2: {
          run: { font: FONT, size: 24, bold: true, color: "111111" },
          paragraph: { spacing: { before: 240, after: 120 } }
        },
        heading3: {
          run: { font: FONT, size: 20, bold: true, color: "666666" },
          paragraph: { spacing: { before: 120, after: 40 } }
        }
      }
    },
    sections
  });

  return Packer.toBlob(doc);
}
