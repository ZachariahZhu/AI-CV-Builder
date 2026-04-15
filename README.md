<div align="center">

# 🎯 ResumeAI

**多语言学生 / 实习简历生成器**

[中文](#中文) · [English](#english) · [Deutsch](#deutsch)

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

</div>

<br>

---

<br>

<a id="中文"></a>

## 🇨🇳 中文

> 用 AI 打造你的完美简历 —— 智能分析职位描述，一键生成中 / 英 / 德三语专业简历。

<br>

### ✨ 核心功能

| | 功能 | 说明 |
|---|---|---|
| 📄 | **文档上传与解析** | 支持 PDF / DOCX / TXT，自动提取文字内容 |
| 📝 | **动态多步表单** | 姓名、联系方式、教育背景（动态增删）、LinkedIn / GitHub |
| 🎨 | **模板系统** | 3 种内置模板（中国式 · 欧洲式 · ATS）+ 自定义模板上传 |
| 🤖 | **多模型 AI** | DeepSeek / OpenAI / Anthropic Claude / Google Gemini / 自定义 |
| 🌍 | **三语严格输出** | 简历输出内容强制适配 中文 / English / Deutsch，并无缝重译所有字段 |
| 💾 | **极速多格式导出** | 服务端无阻塞渲染 PDF（内置中文字体）与 Word (.docx) 文档 |
| ⚡ | **智能零消耗重渲染** | 如果内容未改动仅切换模板，纯本地无感刷新，真正做到 0 Token 消耗 |
| 📱 | **响应式设计** | 桌面 + 手机端完美适配，苹果极简视觉 |

<br>

### 🛠 技术栈

```
框架        Next.js 16 · App Router · React 19
语言        TypeScript 5
样式        Tailwind CSS 4
UI 组件     shadcn/ui (Radix)
多语言      next-intl
AI 接入     OpenAI SDK（兼容 DeepSeek / Gemini）· Anthropic API
生成导出    @react-pdf/renderer · docx
文档解析    pdf-parse · mammoth
图标        Lucide React
```

<br>

### 🚀 本地运行

```bash
# 克隆项目
git clone https://github.com/your-username/resume-ai-builder.git
cd resume-ai-builder

# 安装依赖
npm install

# 配置环境变量（可选，也可通过界面配置）
cp .env.example .env.local
# 编辑 .env.local，填入你的 DeepSeek API Key

# 启动开发服务器
npm run dev
```

打开 **http://localhost:3000** 即可访问。

<br>

### 📖 使用流程

```
首页                  →  点击「开始创建简历」
  ↓
Step 1 · 基本信息      →  填写姓名、联系方式、教育背景，上传补充资料
  ↓
Step 2 · 职位描述      →  粘贴目标岗位 JD，选择输出语言和排版模板
  ↓
生成简历 (自动拦截)     →  按需触发 AI 进行文案高度撰写组装；如仅换装模板，光速重渲染
  ↓
查看结果与预览          →  下载生成的结构化 PDF 和 Word(.docx)
```

<br>

### 🤖 支持的模型

| 提供商 | 默认模型 | 获取 Key |
|--------|---------|----------|
| DeepSeek | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| OpenAI | `gpt-4o` | [platform.openai.com](https://platform.openai.com/api-keys) |
| Anthropic | `claude-sonnet-4-20250514` | [console.anthropic.com](https://console.anthropic.com/) |
| Google Gemini | `gemini-2.0-flash` | [aistudio.google.com](https://aistudio.google.com/apikey) |
| 自定义 | 用户指定 | 任意 OpenAI 兼容服务 |

<br>

### 🗓 路线与计划

- **Week 2 (✅ 已完成)** — AI 强锁定多重语言提示生成 · Token 防消耗拦截防卡顿机制 · PDF/Word 完美还原导出
- **Week 3 (🚀 正在进行)** — 简历历史记录 · 在线直接编辑调整 · 多版本数据管理系统
- **Week 4** — 简历评分系统 · 面试模拟演练 · 部署上线

<br>

---

<br>

<a id="english"></a>

## 🇬🇧 English

> Build your perfect resume with AI — smart JD analysis, one-click generation in Chinese / English / German.

<br>

### ✨ Key Features

| | Feature | Description |
|---|---|---|
| 📄 | **Document Upload** | PDF / DOCX / TXT with automatic text extraction for AI usage |
| 📝 | **Dynamic Form** | Name, contact, education (add/remove block), LinkedIn / GitHub |
| 🎨 | **Template Engine** | 3 built-in layouts (Chinese · European · ATS) + Custom template logic |
| 🤖 | **Multi-Model LLM** | DeepSeek / OpenAI / Anthropic Claude / Google Gemini / custom endpoints |
| 🌍 | **Strict Trilingual** | Forces final resume content directly into 中文 / English / Deutsch precisely |
| 💾 | **Instant Exports** | High-performance Server-rendered PDF and Word (.docx) downloads |
| ⚡ | **Zero-Token Reload** | Evaluates structural change, triggers zero-cost instant UI rebuilds when only toggling layouts |
| 📱 | **Responsive Design** | Desktop + mobile fluid layout with an Apple-inspired minimalist vibe |

<br>

### 🛠 Tech Stack

```
Framework     Next.js 16 · App Router · React 19
Language      TypeScript 5
Styling       Tailwind CSS 4
UI            shadcn/ui (Radix)
i18n          next-intl
AI            OpenAI SDK (DeepSeek / Gemini compatible) · Anthropic API
Export        @react-pdf/renderer · docx
Parsing       pdf-parse · mammoth
Icons         Lucide React
```

<br>

### 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/resume-ai-builder.git
cd resume-ai-builder

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Start the dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

<br>

### 🗓 Roadmap

- **Week 2 (✅ Done)** — Intelligent LLM strict prompt-shaping · Local token-efficiency reloads · Word & PDF layout engine
- **Week 3 (🚀 WIP)** — Resume generation history tracking · online Markdown editing · localized data vault
- **Week 4** — Resume ATS scoring · AI mock interview · Launch

<br>

---

<br>

<a id="deutsch"></a>

## 🇩🇪 Deutsch

> Erstelle deinen perfekten Lebenslauf mit KI — intelligente Stellenanalyse, Ein-Klick-Generierung auf Chinesisch / Englisch / Deutsch.

<br>

### ✨ Hauptfunktionen

| | Funktion | Beschreibung |
|---|---|---|
| 📄 | **Dokument-Upload** | PDF / DOCX / TXT mit automatischer Textextraktion |
| 📝 | **Dynamisches Formular**| Name, Kontakt, Ausbildung (hinzufügen/entfernen), LinkedIn / GitHub |
| 🎨 | **Vorlagensystem** | 3 integrierte Vorlagen (Chinesisch · Europäisch · ATS) + eigene Vorlage |
| 🤖 | **Multi-Modell-KI** | DeepSeek / OpenAI / Anthropic Claude / Google Gemini / benutzerdefiniert |
| 🌍 | **Strikte Mehrsprachigkeit**| Erzwingt die Ausgabe des Lebenslaufs auf 中文 / English / Deutsch |
| 💾 | **Nahtloser Export** | Leistungsstarkes Generieren von PDF- und Word (.docx)-Dokumenten |
| ⚡ | **Zero-Token-Reload** | Vorlagenwechsel ohne zusätzliche API-Kosten durch lokales Caching |
| 📱 | **Responsives Design** | Desktop + Mobil, Apple-inspirierter minimalistischer Stil |

<br>

### 🛠 Technologie-Stack

```
Framework     Next.js 16 · App Router · React 19
Sprache       TypeScript 5
Styling       Tailwind CSS 4
UI            shadcn/ui (Radix)
i18n          next-intl
AI            OpenAI SDK (DeepSeek / Gemini kompatibel) · Anthropic API
Export        @react-pdf/renderer · docx
Analyse       pdf-parse · mammoth
Icons         Lucide React
```

<br>

### 🚀 Lokale Installation

```bash
git clone https://github.com/your-username/resume-ai-builder.git
cd resume-ai-builder
npm install
cp .env.example .env.local
npm run dev
```

Öffne **http://localhost:3000** im Browser.

<br>

### 🗓 Zukunftsplanung

- **Woche 2 (✅ Erledigt)** — KI-Generierung mit strenger Sprachbindung · Intelligentes Token-Management · PDF/Word Export
- **Woche 3 (🚀 In Arbeit)** — Lebenslauf-Verlauf · Online-Bearbeitung · Versionierung lokal
- **Woche 4** — Lebenslauf-Bewertung · Interview-Simulation · Online-Deployment

<br>

---

<br>

<div align="center">

### 📁 项目结构 / Project Structure / Struktur

</div>

```text
resume-ai-builder/
├── app/
│   ├── api/
│   │   ├── generate/route.ts    # AI 生成核心路由（对接 DeepSeek/OpenAI/Anthropic等）
│   │   ├── parse/route.ts       # 文档解析路由 (mammoth/pdf-parse)
│   │   └── pdf/route.tsx        # 服务端 PDF 高性能构建与推流层
│   ├── builder/page.tsx         # 简历创建页面 (支持智能不耗费 Token 重渲)
│   ├── history/page.tsx         # 历史记录面板 (开发中)
│   ├── layout.tsx               # 根布局与国际化上下文
│   ├── loading.tsx              # 加载骨架
│   └── page.tsx                 # 引导页
├── components/
│   ├── api-config-sheet.tsx     # 云端与本地独立 API 配置管理器
│   ├── navbar.tsx               # 顶部导航
│   ├── sidebar.tsx              # 侧边栏
│   ├── ResumePDF.tsx            # PDF React 组件与多模板灵活布局渲染引擎
│   ├── ResumeWord.tsx           # Word (Docx) 表格/段落原生导出引擎
│   └── ui/                      # 基础交互组件库
├── lib/
│   ├── api-config.ts            # API 设置状态持久化
│   ├── i18n.ts                  # locale 路由分发
│   ├── prompts.ts               # 定制化强锁定语种底层 Prompt 生成器
│   └── utils.ts                 # 助手库
├── messages/                    # 本地化文案
│   ├── zh.json                  
│   ├── en.json                  
│   └── de.json                  
├── .env.example
├── next.config.ts
├── package.json
└── README.md
```

<br>

---

<br>

<div align="center">

**MIT License** · Made with ❤️

⭐ 如果觉得有帮助，请给个 Star！

⭐ If you find this useful, please give it a Star!

⭐ Wenn dir das Projekt gefällt, gib ihm einen Stern!

</div>
