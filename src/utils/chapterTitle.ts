/**
 * 章节标题相关的纯函数工具：
 * 编辑器里章节内容首行的 Markdown 标题（# 标题）即章节标题，
 * 保存时据此同步文件名与左侧树。
 */

/** 从内容首行提取 Markdown 章节标题（仅当首行为 "# 标题" 时返回，否则 null） */
export function extractChapterTitle(content: string): string | null {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  const m = firstLine.match(/^\s*#\s+(.+?)\s*$/);
  return m ? m[1].trim() : null;
}

/**
 * 规范化章节标题，得到「纯标题」（与左侧/文件名一致）：
 * - 去掉 Markdown 标题标记（#）
 * - 去掉分组路径前缀（若含 "/"，取最后一段，避免把路径写进标题）
 * - 去掉 .md / .markdown / .txt 扩展名
 */
export function normalizeChapterTitle(raw: string): string {
  let t = (raw || "").trim();
  if (!t) return "";
  t = t.replace(/^#+\s*/, "");
  if (t.includes("/")) {
    t = t.split("/").pop() || t;
  }
  t = t.replace(/\.(md|markdown|txt)$/i, "");
  return t.trim();
}

/**
 * 检测并修复内容首行的「脏标题」（含分组路径 "/" 或 .md 扩展名），
 * 返回修复后的内容；首行不是 Markdown 标题或标题干净时原样返回。
 */
export function fixDirtyTitle(content: string): string {
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.trim().length > 0);
  if (idx < 0) return content;
  const m = lines[idx].match(/^\s*#\s+(.+?)\s*$/);
  if (!m) return content;
  const raw = m[1].trim();
  if (!raw.includes("/") && !/\.(md|markdown|txt)$/i.test(raw)) return content;
  const clean = normalizeChapterTitle(raw);
  if (!clean || clean === raw) return content;
  lines[idx] = `# ${clean}`;
  return lines.join("\n");
}

/** 与 Rust save_chapter 一致的文件名清理（保留中文/英文/数字/空格/-/_） */
export function sanitizeChapterName(title: string): string {
  return title.replace(/[^\u4e00-\u9fa5A-Za-z0-9 \-_]/g, "").trim();
}

/** 根据标题与分组生成章节相对文件名（含 .md，分组为空则直接放根目录） */
export function buildChapterFileName(title: string, group: string): string {
  const safe = sanitizeChapterName(title);
  const base = safe || `chapter_${Date.now()}`;
  return group ? `${group}/${base}.md` : `${base}.md`;
}
