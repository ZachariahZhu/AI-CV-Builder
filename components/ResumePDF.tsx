/**
 * ResumePDF — @react-pdf/renderer document component.
 *
 * Runs server-side (called from app/api/pdf/route.tsx). No "use client"
 * directive, no browser APIs — pure @react-pdf primitives that work in Node.
 *
 * ── The two keys to CJK correctness ────────────────────────────────
 *
 *   1. Hyphenation callback
 *      @react-pdf's default hyphenator assumes Latin word boundaries (spaces),
 *      so a 50-character Chinese sentence is treated as a single unbreakable
 *      "word" and OVERFLOWS the container. We register a callback that splits
 *      CJK strings into individual characters so the layout engine can break
 *      between any two glyphs. Latin words are returned unmodified.
 *
 *   2. Flex-row layout
 *      A child <Text> inside a flex-row parent with `justifyContent:
 *      "space-between"` won't wrap unless we give it `flex: 1` AND
 *      `minWidth: 0` (default minWidth is content-size, which defeats shrinking).
 *      Every title/meta row in every template applies both.
 *
 * ── Fonts ──────────────────────────────────────────────────────────
 *   We pre-fetch Noto Sans SC (Simplified Chinese subset, WOFF, ~1.5 MB)
 *   from Fontsource on jsDelivr, register it as a Buffer so @react-pdf
 *   doesn't have to do any lazy network I/O during layout. Fonts are cached
 *   in module memory, so only the first request pays the download cost.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ── Hyphenation: break CJK between any two characters ─────────────

const CJK_RE =
  /[\u2E80-\u9FFF\u3000-\u303F\u3040-\u30FF\uAC00-\uD7AF\uFF00-\uFFEF]/;

Font.registerHyphenationCallback((word) => {
  if (CJK_RE.test(word)) {
    return Array.from(word);
  }
  return [word];
});

// ── Font preload (server-side) ────────────────────────────────────

export const PDF_FONT_FAMILY = "NotoSansSC";

const FONTSOURCE_VER = "5.2.8";
const FONT_URL_REGULAR = `https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@${FONTSOURCE_VER}/files/noto-sans-sc-chinese-simplified-400-normal.woff`;
const FONT_URL_BOLD = `https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@${FONTSOURCE_VER}/files/noto-sans-sc-chinese-simplified-700-normal.woff`;

let fontReadyPromise: Promise<boolean> | null = null;

function toBase64DataUrl(buf: ArrayBuffer, mime: string): string {
  // Encode the font bytes as a data: URL. `@react-pdf/font` types declare
  // `src: string`, so we can't pass a raw Buffer directly — but the library
  // internally calls fetch(src), and fetch() natively understands data URLs.
  // After the first render the font bytes are cached on the FontSource, so
  // the base64 decoding cost is paid exactly once per process.
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

/**
 * Pre-download + register the embedded Chinese font. Idempotent:
 * concurrent callers share one in-flight promise; once resolved the result
 * is cached for the life of the Node.js process.
 *
 * Returns `true` on success, `false` on failure. On failure we do NOT throw
 * — the caller can still render the PDF; @react-pdf will fall back to the
 * built-in Helvetica (Latin-only) for any Chinese glyphs.
 */
export function ensurePdfFontsLoaded(): Promise<boolean> {
  if (fontReadyPromise) return fontReadyPromise;
  fontReadyPromise = (async () => {
    try {
      const [regRes, boldRes] = await Promise.all([
        fetch(FONT_URL_REGULAR),
        fetch(FONT_URL_BOLD),
      ]);
      if (!regRes.ok || !boldRes.ok) {
        throw new Error(
          `Font fetch failed: regular=${regRes.status} bold=${boldRes.status}`
        );
      }
      const [regBuf, boldBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      Font.register({
        family: PDF_FONT_FAMILY,
        fonts: [
          { src: toBase64DataUrl(regBuf, "font/woff"), fontWeight: "normal" },
          { src: toBase64DataUrl(boldBuf, "font/woff"), fontWeight: "bold" },
        ],
      });
      return true;
    } catch (err) {
      console.warn(
        "[ResumePDF] Font preload failed — falling back to Helvetica:",
        err
      );
      fontReadyPromise = null;
      return false;
    }
  })();
  return fontReadyPromise;
}

// ── Types ──────────────────────────────────────────────────────────

export type TemplateType = "china" | "europe" | "ats" | "custom";
export type ResumeLang = "zh" | "en" | "de";

export interface ResumePdfJson {
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
  languages?: string[];
  summary?: string;
  language?: string;
}

// ── Section headings per language ──────────────────────────────────

const H: Record<
  ResumeLang,
  {
    summary: string;
    edu: string;
    exp: string;
    skills: string;
    languages: string;
    gpa: string;
    contact: string;
  }
> = {
  zh: {
    summary: "个人总结",
    edu: "教育背景",
    exp: "工作经历",
    skills: "技能",
    languages: "语言能力",
    gpa: "GPA",
    contact: "联系方式",
  },
  en: {
    summary: "Summary",
    edu: "Education",
    exp: "Experience",
    skills: "Skills",
    languages: "Languages",
    gpa: "GPA",
    contact: "Contact",
  },
  de: {
    summary: "Zusammenfassung",
    edu: "Ausbildung",
    exp: "Berufserfahrung",
    skills: "Kenntnisse",
    languages: "Sprachen",
    gpa: "GPA",
    contact: "Kontakt",
  },
};

// ── Palette (Apple-minimal) ────────────────────────────────────────

const C = {
  ink: "#111111",
  sub: "#444444",
  muted: "#888888",
  rule: "#E5E5E5",
  chipBg: "#F5F5F7",
  pageBg: "#FFFFFF",
  sidebarBg: "#F7F7F7",
};

// ── Helpers ────────────────────────────────────────────────────────

function splitBullets(desc?: string): string[] {
  if (!desc) return [];
  return desc
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^[-•]\s*/, ""));
}

function joinContact(info?: ResumePdfJson["personalInfo"]): string {
  if (!info) return "";
  const bits: string[] = [];
  if (info.phone) bits.push(info.phone);
  if (info.email) bits.push(info.email);
  if (info.linkedin) bits.push(`LinkedIn: ${info.linkedin}`);
  if (info.github) bits.push(`GitHub: ${info.github}`);
  return bits.join("  ·  ");
}

function resolveLang(resume: ResumePdfJson, fallback: ResumeLang): ResumeLang {
  if (
    resume.language === "zh" ||
    resume.language === "en" ||
    resume.language === "de"
  ) {
    return resume.language;
  }
  return fallback;
}

// ── Shared base styles ─────────────────────────────────────────────
//
// The `wrap` helper returns a style that all text-like children should use
// to guarantee wrapping inside flex rows.

const BASE_FONT = { fontFamily: PDF_FONT_FAMILY };

// ——— CHINA ———
const chinaStyles = StyleSheet.create({
  page: {
    ...BASE_FONT,
    paddingHorizontal: 44,
    paddingVertical: 40,
    color: C.ink,
    backgroundColor: C.pageBg,
    fontSize: 10,
    lineHeight: 1.6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 14,
    flexDirection: "column",
  },
  photo: {
    width: 68,
    height: 84,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.rule,
    backgroundColor: C.chipBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  photoText: { fontSize: 8, color: C.muted },
  name: { fontSize: 22, fontWeight: "bold", color: C.ink, marginBottom: 4 },
  contactLine: { fontSize: 9.5, color: C.sub, lineHeight: 1.5 },
  rule: {
    marginTop: 12,
    marginBottom: 12,
    height: 1,
    backgroundColor: C.rule,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: C.ink,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  section: { marginBottom: 12 },
  body: { fontSize: 10, color: C.sub, lineHeight: 1.6 },
  itemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 2,
  },
  itemTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    fontSize: 10.5,
    fontWeight: "bold",
    color: C.ink,
  },
  itemMeta: { fontSize: 9, color: C.muted, flexShrink: 0 },
  itemSub: { fontSize: 9.5, color: C.sub, marginBottom: 4 },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
    paddingRight: 2,
  },
  bulletDot: { width: 10, fontSize: 10, color: C.muted, flexShrink: 0 },
  bulletText: { flex: 1, minWidth: 0, fontSize: 10, color: C.sub, lineHeight: 1.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    marginRight: 6,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.chipBg,
    fontSize: 9,
    color: C.ink,
  },
  block: { marginBottom: 8 },
});

// ——— EUROPE (Europass two-column) ———
const europeStyles = StyleSheet.create({
  page: {
    ...BASE_FONT,
    flexDirection: "row",
    color: C.ink,
    backgroundColor: C.pageBg,
    fontSize: 10,
    lineHeight: 1.6,
  },
  sidebar: {
    width: "34%",
    backgroundColor: C.sidebarBg,
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  main: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  sbName: {
    fontSize: 17,
    fontWeight: "bold",
    color: C.ink,
    marginBottom: 12,
    lineHeight: 1.3,
  },
  sbLabel: {
    fontSize: 8.5,
    fontWeight: "bold",
    letterSpacing: 1.2,
    color: C.muted,
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  sbText: { fontSize: 9.5, color: C.sub, marginBottom: 2, lineHeight: 1.5 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.ink,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.rule,
  },
  section: { marginBottom: 14 },
  itemTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: C.ink,
    lineHeight: 1.5,
  },
  itemSub: {
    fontSize: 9.5,
    color: C.sub,
    marginTop: 2,
    lineHeight: 1.5,
  },
  itemMeta: { fontSize: 9, color: C.muted, marginTop: 1, marginBottom: 4 },
  itemBlock: { marginBottom: 10 },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
    paddingRight: 2,
  },
  bulletDot: { width: 10, fontSize: 10, color: C.muted, flexShrink: 0 },
  bulletText: { flex: 1, minWidth: 0, fontSize: 10, color: C.sub, lineHeight: 1.6 },
  body: { fontSize: 10, color: C.sub, lineHeight: 1.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    marginRight: 5,
    marginBottom: 5,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.rule,
    fontSize: 9,
    color: C.ink,
  },
});

// ——— ATS (plain / parser-friendly) ———
const atsStyles = StyleSheet.create({
  page: {
    ...BASE_FONT,
    paddingHorizontal: 54,
    paddingVertical: 48,
    color: "#000000",
    backgroundColor: "#FFFFFF",
    fontSize: 10.5,
    lineHeight: 1.55,
  },
  name: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  contactLine: { fontSize: 10, marginBottom: 12, lineHeight: 1.5 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  section: { marginBottom: 10 },
  itemTitle: { fontSize: 10.5, fontWeight: "bold", lineHeight: 1.5 },
  itemSub: { fontSize: 10, lineHeight: 1.5 },
  itemMeta: { fontSize: 9.5, marginBottom: 2 },
  body: { fontSize: 10.5, lineHeight: 1.55 },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 1,
    paddingRight: 2,
  },
  bulletDot: { width: 12, fontSize: 10.5, flexShrink: 0 },
  bulletText: { flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 1.55 },
  block: { marginBottom: 6 },
});

// ——— CUSTOM (clean neutral) ———
const customStyles = StyleSheet.create({
  page: {
    ...BASE_FONT,
    paddingHorizontal: 48,
    paddingVertical: 44,
    color: C.ink,
    backgroundColor: C.pageBg,
    fontSize: 10,
    lineHeight: 1.6,
  },
  header: { marginBottom: 6 },
  name: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  contactLine: { fontSize: 9.5, color: C.sub, lineHeight: 1.5 },
  rule: {
    marginTop: 12,
    marginBottom: 12,
    height: 1,
    backgroundColor: C.rule,
  },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: "bold",
    color: C.ink,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  section: { marginBottom: 12 },
  itemRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  itemTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    fontSize: 10.5,
    fontWeight: "bold",
    color: C.ink,
  },
  itemSub: { fontSize: 9.5, color: C.sub, lineHeight: 1.5 },
  itemMeta: { fontSize: 9, color: C.muted, flexShrink: 0 },
  body: { fontSize: 10, color: C.sub, lineHeight: 1.6 },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 2,
    paddingLeft: 2,
    paddingRight: 2,
  },
  bulletDot: { width: 10, fontSize: 10, color: C.muted, flexShrink: 0 },
  bulletText: { flex: 1, minWidth: 0, fontSize: 10, color: C.sub, lineHeight: 1.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    marginRight: 6,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.chipBg,
    fontSize: 9,
    color: C.ink,
  },
  block: { marginBottom: 8 },
});

// ── Layouts ────────────────────────────────────────────────────────

function ChinaLayout({
  resume,
  lang,
}: {
  resume: ResumePdfJson;
  lang: ResumeLang;
}) {
  const s = chinaStyles;
  const h = H[lang];
  const info = resume.personalInfo ?? {};
  const edus = (resume.education ?? []).filter((e) => e && (e.school || e.major));
  const exps = (resume.experience ?? []).filter(
    (e) => e && (e.company || e.position)
  );
  const skills = (resume.skills ?? []).filter(Boolean);
  const languages = (resume.languages ?? []).filter(Boolean);
  const showPhoto = info.photoPlaceholder !== "exclude";

  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.headerRow}>
        <View style={s.headerText}>
          <Text style={s.name}>{info.name || " "}</Text>
          {joinContact(info) ? (
            <Text style={s.contactLine}>{joinContact(info)}</Text>
          ) : null}
        </View>
        {showPhoto ? (
          <View style={s.photo}>
            <Text style={s.photoText}>PHOTO</Text>
          </View>
        ) : null}
      </View>

      <View style={s.rule} />

      {resume.summary?.trim() ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.summary}</Text>
          <Text style={s.body}>{resume.summary.trim()}</Text>
        </View>
      ) : null}

      {edus.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.edu}</Text>
          {edus.map((e, i) => (
            <View key={i} style={s.block} wrap={false}>
              <View style={s.itemRow}>
                <Text style={s.itemTitle}>{e.school || ""}</Text>
                <Text style={s.itemMeta}>{e.period || ""}</Text>
              </View>
              <Text style={s.itemSub}>
                {[e.major, e.gpa ? `${h.gpa}: ${e.gpa}` : ""]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {exps.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.exp}</Text>
          {exps.map((e, i) => (
            <View key={i} style={s.block}>
              <View style={s.itemRow}>
                <Text style={s.itemTitle}>
                  {[e.company, e.position].filter(Boolean).join(" — ")}
                </Text>
                <Text style={s.itemMeta}>{e.period || ""}</Text>
              </View>
              {splitBullets(e.description).map((b, j) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {skills.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.skills}</Text>
          <View style={s.chipRow}>
            {skills.map((sk, i) => (
              <Text key={i} style={s.chip}>
                {sk}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {languages.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.languages}</Text>
          <Text style={s.body}>{languages.join("  ·  ")}</Text>
        </View>
      ) : null}
    </Page>
  );
}

function EuropeLayout({
  resume,
  lang,
}: {
  resume: ResumePdfJson;
  lang: ResumeLang;
}) {
  const s = europeStyles;
  const h = H[lang];
  const info = resume.personalInfo ?? {};
  const edus = (resume.education ?? []).filter((e) => e && (e.school || e.major));
  const exps = (resume.experience ?? []).filter(
    (e) => e && (e.company || e.position)
  );
  const skills = (resume.skills ?? []).filter(Boolean);
  const languages = (resume.languages ?? []).filter(Boolean);

  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.sidebar}>
        <Text style={s.sbName}>{info.name || " "}</Text>

        <Text style={s.sbLabel}>{h.contact}</Text>
        {info.phone ? <Text style={s.sbText}>{info.phone}</Text> : null}
        {info.email ? <Text style={s.sbText}>{info.email}</Text> : null}
        {info.linkedin ? <Text style={s.sbText}>{info.linkedin}</Text> : null}
        {info.github ? <Text style={s.sbText}>{info.github}</Text> : null}

        {skills.length > 0 ? (
          <>
            <Text style={s.sbLabel}>{h.skills}</Text>
            <View style={s.chipRow}>
              {skills.map((sk, i) => (
                <Text key={i} style={s.chip}>
                  {sk}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        {languages.length > 0 ? (
          <>
            <Text style={s.sbLabel}>{h.languages}</Text>
            {languages.map((lg, i) => (
              <Text key={i} style={s.sbText}>
                {lg}
              </Text>
            ))}
          </>
        ) : null}
      </View>

      <View style={s.main}>
        {resume.summary?.trim() ? (
          <View style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>{h.summary}</Text>
            <Text style={s.body}>{resume.summary.trim()}</Text>
          </View>
        ) : null}

        {exps.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{h.exp}</Text>
            {exps.map((e, i) => (
              <View key={i} style={s.itemBlock}>
                <Text style={s.itemTitle}>
                  {[e.company, e.position].filter(Boolean).join(" — ")}
                </Text>
                <Text style={s.itemMeta}>{e.period || ""}</Text>
                {splitBullets(e.description).map((b, j) => (
                  <View key={j} style={s.bulletRow}>
                    <Text style={s.bulletDot}>•</Text>
                    <Text style={s.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {edus.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{h.edu}</Text>
            {edus.map((e, i) => (
              <View key={i} style={s.itemBlock} wrap={false}>
                <Text style={s.itemTitle}>{e.school || ""}</Text>
                <Text style={s.itemSub}>{e.major || ""}</Text>
                <Text style={s.itemMeta}>
                  {[e.period, e.gpa ? `${h.gpa}: ${e.gpa}` : ""]
                    .filter(Boolean)
                    .join("  ·  ")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Page>
  );
}

function AtsLayout({
  resume,
  lang,
}: {
  resume: ResumePdfJson;
  lang: ResumeLang;
}) {
  const s = atsStyles;
  const h = H[lang];
  const info = resume.personalInfo ?? {};
  const edus = (resume.education ?? []).filter((e) => e && (e.school || e.major));
  const exps = (resume.experience ?? []).filter(
    (e) => e && (e.company || e.position)
  );
  const skills = (resume.skills ?? []).filter(Boolean);
  const languages = (resume.languages ?? []).filter(Boolean);

  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.name}>{info.name || " "}</Text>
      {joinContact(info) ? (
        <Text style={s.contactLine}>{joinContact(info)}</Text>
      ) : null}

      {resume.summary?.trim() ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.summary}</Text>
          <Text style={s.body}>{resume.summary.trim()}</Text>
        </View>
      ) : null}

      {exps.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.exp}</Text>
          {exps.map((e, i) => (
            <View key={i} style={s.block}>
              <Text style={s.itemTitle}>
                {[e.company, e.position].filter(Boolean).join(" — ")}
              </Text>
              <Text style={s.itemMeta}>{e.period || ""}</Text>
              {splitBullets(e.description).map((b, j) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bulletDot}>-</Text>
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {edus.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.edu}</Text>
          {edus.map((e, i) => (
            <View key={i} style={s.block} wrap={false}>
              <Text style={s.itemTitle}>{e.school || ""}</Text>
              <Text style={s.itemSub}>{e.major || ""}</Text>
              <Text style={s.itemMeta}>
                {[e.period, e.gpa ? `${h.gpa}: ${e.gpa}` : ""]
                  .filter(Boolean)
                  .join("  |  ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {skills.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.skills}</Text>
          <Text style={s.body}>{skills.join(", ")}</Text>
        </View>
      ) : null}

      {languages.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.languages}</Text>
          <Text style={s.body}>{languages.join(", ")}</Text>
        </View>
      ) : null}
    </Page>
  );
}

function CustomLayout({
  resume,
  lang,
}: {
  resume: ResumePdfJson;
  lang: ResumeLang;
}) {
  const s = customStyles;
  const h = H[lang];
  const info = resume.personalInfo ?? {};
  const edus = (resume.education ?? []).filter((e) => e && (e.school || e.major));
  const exps = (resume.experience ?? []).filter(
    (e) => e && (e.company || e.position)
  );
  const skills = (resume.skills ?? []).filter(Boolean);
  const languages = (resume.languages ?? []).filter(Boolean);

  return (
    <Page size="A4" style={s.page} wrap>
      <View style={s.header}>
        <Text style={s.name}>{info.name || " "}</Text>
        {joinContact(info) ? (
          <Text style={s.contactLine}>{joinContact(info)}</Text>
        ) : null}
      </View>

      <View style={s.rule} />

      {resume.summary?.trim() ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.summary}</Text>
          <Text style={s.body}>{resume.summary.trim()}</Text>
        </View>
      ) : null}

      {exps.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.exp}</Text>
          {exps.map((e, i) => (
            <View key={i} style={s.block}>
              <View style={s.itemRow}>
                <Text style={s.itemTitle}>
                  {[e.company, e.position].filter(Boolean).join(" — ")}
                </Text>
                <Text style={s.itemMeta}>{e.period || ""}</Text>
              </View>
              {splitBullets(e.description).map((b, j) => (
                <View key={j} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {edus.length > 0 ? (
        <View style={s.section}>
          <Text style={s.sectionTitle}>{h.edu}</Text>
          {edus.map((e, i) => (
            <View key={i} style={s.block} wrap={false}>
              <View style={s.itemRow}>
                <Text style={s.itemTitle}>{e.school || ""}</Text>
                <Text style={s.itemMeta}>{e.period || ""}</Text>
              </View>
              <Text style={s.itemSub}>
                {[e.major, e.gpa ? `${h.gpa}: ${e.gpa}` : ""]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {skills.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.skills}</Text>
          <View style={s.chipRow}>
            {skills.map((sk, i) => (
              <Text key={i} style={s.chip}>
                {sk}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      {languages.length > 0 ? (
        <View style={s.section} wrap={false}>
          <Text style={s.sectionTitle}>{h.languages}</Text>
          <Text style={s.body}>{languages.join("  ·  ")}</Text>
        </View>
      ) : null}
    </Page>
  );
}

// ── Public component ───────────────────────────────────────────────

export interface ResumePDFProps {
  resumeJson: ResumePdfJson;
  templateType: TemplateType;
  /** UI fallback language, used if resumeJson.language isn't a known locale. */
  fallbackLang?: ResumeLang;
}

export default function ResumePDF({
  resumeJson,
  templateType,
  fallbackLang = "en",
}: ResumePDFProps) {
  const lang = resolveLang(resumeJson, fallbackLang);

  let body: React.ReactElement;
  switch (templateType) {
    case "china":
      body = <ChinaLayout resume={resumeJson} lang={lang} />;
      break;
    case "europe":
      body = <EuropeLayout resume={resumeJson} lang={lang} />;
      break;
    case "ats":
      body = <AtsLayout resume={resumeJson} lang={lang} />;
      break;
    case "custom":
    default:
      body = <CustomLayout resume={resumeJson} lang={lang} />;
      break;
  }

  const title = resumeJson.personalInfo?.name
    ? `Resume — ${resumeJson.personalInfo.name}`
    : "Resume";

  return (
    <Document
      title={title}
      author={resumeJson.personalInfo?.name || "ResumeAI"}
      producer="ResumeAI Builder"
      creator="ResumeAI Builder"
    >
      {body}
    </Document>
  );
}
