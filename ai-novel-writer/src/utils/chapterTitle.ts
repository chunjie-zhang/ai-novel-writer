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
