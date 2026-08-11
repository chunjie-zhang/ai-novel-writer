/**
 * SKILL.md 解析 / 序列化工具
 *
 * 格式约定（仿 Claude/inkos Agent Skill）：
 * ```markdown
 * ---
 * id: my-skill
 * name: 我的技能
 * description: 技能描述
 * emoji: ✨
 * icon: lucide:sparkles
 * category: writing
 * tags:
 *   - 标签1
 *   - 标签2
 * when: 适用场景
 * version: 1.0.0
 * author: xxx
 * homepage: https://...
 * ---
 * （System Prompt 正文）
 * ```
 *
 * 只实现 YAML 子集：`key: value`（含引号）、`key:` + 缩进 `- item` 列表。
 */

import type { WritingSkill, SkillCategory } from "@/skills/types";

/** frontmatter 起始/结束标记 */
const FM_DELIMITER = "---";

/** 合法分类 */
const VALID_CATEGORIES: SkillCategory[] = [
  "world",
  "character",
  "plot",
  "writing",
  "review",
  "translate",
  "utils",
];

/** 解析单行标量值（去掉引号、注释） */
function parseScalar(raw: string): string {
  let v = raw.trim();
  // 去掉行内注释（# 开头且在引号外）——简单处理：仅当 # 在开头
  if (v.startsWith("#")) return "";
  // 去引号
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

/** 把 body 字符串按行解析成一个 frontmatter 对象 */
function parseFrontmatter(body: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = body.split("\n");
  let currentKey: string | null = null;
  const listBuffer: string[] = [];

  const flushList = () => {
    if (currentKey && listBuffer.length > 0) {
      result[currentKey] = listBuffer.slice();
    }
    listBuffer.length = 0;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // 列表项：- item
    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch) {
      if (currentKey) {
        listBuffer.push(parseScalar(listMatch[1]));
      }
      continue;
    }

    // key: value 或 key:
    const kvMatch = line.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      flushList();
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === "" || value === "|" || value === ">") {
        // 多行/空值，等待后续列表项或跳过
        result[currentKey] = "";
      } else {
        result[currentKey] = parseScalar(value);
      }
      continue;
    }

    // 空行：结束当前列表
    if (line.trim() === "") {
      flushList();
      currentKey = null;
    }
  }
  flushList();

  // 清理空列表
  for (const k of Object.keys(result)) {
    if (Array.isArray(result[k]) && (result[k] as string[]).length === 0) {
      delete result[k];
    }
  }

  return result;
}

/** 把 SKILL.md 内容解析为 WritingSkill */
export function parseSkillMarkdown(md: string): WritingSkill {
  const text = md.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 提取 frontmatter
  let frontmatter = "";
  let body = text;
  if (text.startsWith(FM_DELIMITER + "\n")) {
    const endIdx = text.indexOf("\n" + FM_DELIMITER, 4);
    if (endIdx !== -1) {
      frontmatter = text.slice(4, endIdx);
      body = text.slice(endIdx + FM_DELIMITER.length + 1).trimStart();
    }
  }

  const fm = parseFrontmatter(frontmatter);

  const str = (k: string): string => {
    const v = fm[k];
    return typeof v === "string" ? v : "";
  };
  const arr = (k: string): string[] => {
    const v = fm[k];
    return Array.isArray(v) ? v : typeof v === "string" && v ? [v] : [];
  };

  const category = (VALID_CATEGORIES as string[]).includes(str("category"))
    ? (str("category") as SkillCategory)
    : "writing";

  const id = str("id") || `custom-${Date.now().toString(36)}`;

  const skill: WritingSkill = {
    id,
    name: str("name") || "未命名技能",
    description: str("description") || "",
    emoji: str("emoji") || "🧩",
    icon: str("icon") || undefined,
    category,
    tags: arr("tags"),
    when: str("when") || "",
    systemPrompt: body.trimEnd() || "",
    userPromptTemplate: str("userPromptTemplate") || undefined,
    enabled: true,
    version: str("version") || "1.0.0",
    source: "custom",
    author: str("author") || undefined,
    homepage: str("homepage") || undefined,
    installedAt: new Date().toISOString(),
    body: body.trimEnd(),
  };

  return skill;
}

/** 将值序列化为 YAML 标量（带引号保护特殊字符） */
function yamlScalar(v: string): string {
  if (v === "") return '""';
  // 含特殊字符时用双引号包裹
  if (/[:#\-\[\]{}&*!|>'"%@`,\n]/.test(v)) {
    return `"${v.replace(/"/g, '\\"')}"`;
  }
  return v;
}

/** 把 WritingSkill 序列化为 SKILL.md 文本 */
export function serializeSkillMarkdown(skill: WritingSkill): string {
  const lines: string[] = [];
  lines.push(FM_DELIMITER);

  const push = (key: string, val: string | undefined, required = false) => {
    if (val !== undefined && val !== "") {
      lines.push(`${key}: ${yamlScalar(val)}`);
    } else if (required) {
      lines.push(`${key}: ${yamlScalar(val ?? "")}`);
    }
  };

  push("id", skill.id, true);
  push("name", skill.name, true);
  push("description", skill.description, true);
  push("emoji", skill.emoji);
  push("icon", skill.icon);
  push("category", skill.category, true);
  if (skill.tags && skill.tags.length > 0) {
    lines.push("tags:");
    for (const t of skill.tags) {
      lines.push(`  - ${yamlScalar(t)}`);
    }
  }
  push("when", skill.when);
  push("version", skill.version);
  push("author", skill.author);
  push("homepage", skill.homepage);
  push("userPromptTemplate", skill.userPromptTemplate);

  lines.push(FM_DELIMITER);
  lines.push("");
  lines.push(skill.systemPrompt || skill.body || "");
  lines.push("");

  return lines.join("\n");
}

/** 生成安全的技能目录名（含 id，仅保留安全字符） */
export function skillDirName(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return safe || "skill";
}
