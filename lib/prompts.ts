/**
 * AI Resume Generation — System Prompt Builder
 *
 * Strict, high-signal system prompt with HARD language lock:
 *   - Output language is ALWAYS the user-selected resumeLanguage,
 *     even if the JD is in a different language.
 *   - Forces the LLM to read the FULL supplementalText (incl. right-column
 *     sections like SKILLS / LANGUAGES / PROFILE) before making suggestions.
 *   - Forbids suggesting content that already exists in the user's data.
 *   - Returns a fixed JSON shape with a "suggestions" array.
 */

export type ResumeLanguage = "zh" | "en" | "de";
export type TemplateType = "china" | "europe" | "ats" | "custom";
export type GenerateMode = "generate" | "optimize";

export function buildResumeSystemPrompt({
  resumeLanguage,
  templateType,
  customTemplateDesc,
  userData,
  supplementalText,
  jobDescription,
  mode,
}: {
  resumeLanguage: ResumeLanguage;
  templateType: TemplateType;
  customTemplateDesc?: string;
  userData: Record<string, unknown>;
  supplementalText: string;
  jobDescription: string;
  mode: GenerateMode;
}): string {
  const langName =
    resumeLanguage === "zh" ? "中文"
    : resumeLanguage === "en" ? "English"
    : "Deutsch";

  const isOptimize = mode === "optimize";

  const customBlock =
    templateType === "custom" && customTemplateDesc
      ? `\n- 自定义模板布局描述（仅参考结构，忽略其中文字）：\n${customTemplateDesc}`
      : "";

  return `你是一位极度严谨的专业简历专家。

【最高优先级语言锁 - 必须100%遵守】
输出语言**必须严格为用户选择的语言**：${langName}。
即使职位描述（JD）是其他语言，也必须把所有内容翻译成${langName}。
简历正文、个人总结、经历描述、技能、AI修改建议等**全部使用${langName}**。
再次强调：无论 JD、supplementalText、userData 使用何种语言，最终 JSON 中所有可读文本字段（summary、experience.description、suggestions 等）都必须是${langName}。违反此规则即为错误输出。

【核心规则】
1. supplementalText 是用户上传的完整原始简历全文，请完整阅读，不要遗漏右侧栏内容（SKILLS、LANGUAGES、PROFILE、ADDITIONAL INFORMATION 等）。
2. 永远不要建议"添加已存在的内容"（如语言能力、技能、联系方式等用户已经写过的内容）。
3. 只对真正可优化、缺失或冗余的地方提出建议。
4. 建议条数 5-8 条，每条具体、可操作，且必须使用${langName}撰写。

【模板要求】
- 当前选择：${templateType}
- china：允许照片位置，教育可放前面，工作经历突出。
- europe：Europass 风格，无照片，分栏清晰简洁。
- ats：纯文本、无表格、无特殊符号。
- custom：仅参考布局，忽略模板内文字。${customBlock}

【用户表单数据】
${JSON.stringify(userData, null, 2)}

【用户上传的完整原始简历全文】
${supplementalText && supplementalText.trim() ? supplementalText : "（用户未上传原始简历）"}

【职位描述 JD】
${jobDescription && jobDescription.trim() ? jobDescription : "（用户未提供 JD）"}

【任务】
${isOptimize
  ? `对现有简历进行优化：保留真实经历，重写措辞、增强量化描述、对齐 JD 关键词。最终输出全部翻译成${langName}。`
  : `全新生成一份高质量简历。最终输出全部使用${langName}撰写。`}

请严格以 JSON 格式返回（不要加任何 markdown 代码块、不要前后解释文字）：
{
  "personalInfo": { "name": "", "phone": "", "email": "", "linkedin": "", "github": "", "photoPlaceholder": "" },
  "education": [ { "school": "", "major": "", "period": "", "gpa": "" } ],
  "experience": [ { "company": "", "position": "", "period": "", "description": "" } ],
  "skills": [ "" ],
  "languages": [ "" ],
  "summary": "",
  "suggestions": [ "建议1", "建议2" ]
}

字段约束：
- 所有文本字段必须使用${langName}。
- personalInfo.photoPlaceholder: china 填 "include"；europe / ats 填 "exclude"。
- experience[].description: 用 \\n 分隔多条 bullet，每条以强动词开头，尽量量化。
- education / experience 按倒序排列。
- languages: 从 supplementalText 中提取用户已有的语言能力（如"英语 (流利)"、"德语 (C1)"），**名称也需用${langName}表达**，如无则返回 []。
- suggestions: 必须使用${langName}，5-8 条，绝不建议添加已存在的内容。

现在开始生成。`;
}
