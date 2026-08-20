/**
 * 极简 Markdown 渲染器（AI 流式预览 / 分析报告展示共用）
 *
 * 处理：标题 / 段落 / 无序列表 / 有序列表 / 引用 / 代码块 / 粗体 / 斜体 / 行内代码 / 水平线 / 表格。
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

  // ===== 表格（GitHub 风格：| 列 | 列 | + 分隔行 |---|） =====
  const isTableSep = (line: string) =>
    /^\s*\|[\s:|-]*\|\s*$/.test(line) && line.includes("-");
  const parseTableRow = (line: string) =>
    line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => inline(c.trim()));
  const renderTable = (headers: string[], rows: string[][]) => {
    const thead = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`;
    const tbody = rows.length
      ? `<tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody>`
      : "";
    return `<table>${thead}${tbody}</table>`;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
    // 表格：当前行以 | 开头且下一行是分隔行
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushList();
      const headers = parseTableRow(line);
      i += 2; // 跳过表头行与分隔行
      const rows: string[][] = [];
      while (i < lines.length) {
        const r = lines[i].trim();
        if (!r.startsWith("|")) break;
        rows.push(parseTableRow(r));
        i++;
      }
      i--; // 抵消 for 自增，让循环回到首个非表格行
      out.push(renderTable(headers, rows));
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
