/**
 * 极简 Markdown 渲染器（AI 流式预览 / 分析报告展示共用）
 *
 * 处理：标题 / 段落 / 无序列表 / 有序列表 / 引用 / 代码块 / 粗体 / 斜体 / 行内代码 / 水平线。
 * 所有输入先 HTML 转义再渲染，防止 XSS。
 */
export function renderMarkdown(text: string): string {
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // 先转义再处理行内样式。行类型判断（如引用 >）必须在转义前，否则 > 变 &gt; 无法识别
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const lines = text.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeBuf: string[] = [];
  let ulBuf: string[] = [];
  let olBuf: string[] = [];

  const flushList = () => {
    if (ulBuf.length) {
      out.push(`<ul>${ulBuf.map((li) => `<li>${li}</li>`).join("")}</ul>`);
      ulBuf = [];
    }
    if (olBuf.length) {
      out.push(`<ol>${olBuf.map((li) => `<li>${li}</li>`).join("")}</ol>`);
      olBuf = [];
    }
  };

  for (const raw of lines) {
    const line = raw;
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushList();
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(escapeHtml(line));
      continue;
    }
    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)![0].length;
      const content = inline(line.replace(/^#+\s*/, ""));
      out.push(`<h${Math.min(level, 6)}>${content}</h${Math.min(level, 6)}>`);
    } else if (/^\s*[-*+]\s+/.test(line)) {
      flushList();
      ulBuf.push(inline(line.replace(/^\s*[-*+]\s+/, "")));
    } else if (/^\s*\d+[.)]\s+/.test(line)) {
      flushList();
      olBuf.push(inline(line.replace(/^\s*\d+[.)]\s+/, "")));
    } else if (/^\s*>\s?/.test(line)) {
      flushList();
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
    } else if (/^\s*-{3,}\s*$/.test(trimmed)) {
      flushList();
      out.push(`<hr/>`);
    } else if (line.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  if (inCode) out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
  return out.join("\n");
}
