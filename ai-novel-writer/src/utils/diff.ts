/**
 * Diff 增量改写工具
 * 支持局部修改、采纳/驳回/微调机制
 */

export interface DiffEdit {
  id: string;
  original: string;
  modified: string;
  type: "rewrite" | "expand" | "abridge" | "polish";
  status: "pending" | "accepted" | "rejected" | "adjusted";
  adjustments: string[];
  created_at: number;
}

let diffIdCounter = 0;

/** 创建 Diff 编辑记录 */
export function createDiffEdit(
  original: string,
  modified: string,
  type: DiffEdit["type"]
): DiffEdit {
  return {
    id: `diff_${Date.now()}_${diffIdCounter++}`,
    original,
    modified,
    type,
    status: "pending",
    adjustments: [],
    created_at: Date.now(),
  };
}

/** 采纳修改 */
export function acceptDiff(diff: DiffEdit): DiffEdit {
  return { ...diff, status: "accepted" };
}

/** 驳回修改 */
export function rejectDiff(diff: DiffEdit): DiffEdit {
  return { ...diff, status: "rejected" };
}

/** 微调修改 */
export function adjustDiff(diff: DiffEdit, newText: string): DiffEdit {
  return {
    ...diff,
    modified: newText,
    status: "adjusted",
    adjustments: [...diff.adjustments, newText],
  };
}

/** 将 Diff 修改应用到全文 */
export function applyDiffToContent(
  fullContent: string,
  original: string,
  replacement: string
): string {
  return fullContent.replace(original, replacement);
}

/** 构建 AI Diff 改写 Prompt */
export function buildDiffPrompt(
  selectedText: string,
  instruction: string,
  type: DiffEdit["type"]
): string {
  const typeMap: Record<string, string> = {
    rewrite: "请按以下要求改写这段文字，保持原意但改变表达方式",
    expand: "请扩写这段文字，增加细节和描写，丰富内容",
    abridge: "请精简这段文字，保留核心信息，去掉冗余",
    polish: "请润色这段文字，优化语言表达，提升文采",
  };

  return `【改写指令】${typeMap[type] || "改写"}

【用户要求】${instruction}

【原文】
${selectedText}

请直接输出修改后的内容，不要加说明。保留原文的核心信息。`;
}

/** 比较两个文本的差异，返回变更的行号集合 */
export function findChangedRanges(
  original: string,
  modified: string
): { startLine: number; endLine: number }[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const changes: { startLine: number; endLine: number }[] = [];

  let i = 0;
  while (i < origLines.length || i < modLines.length) {
    if (origLines[i] !== modLines[i]) {
      const start = i;
      while (
        i < origLines.length ||
        i < modLines.length
      ) {
        if (origLines[i] === modLines[i]) break;
        i++;
      }
      changes.push({ startLine: start, endLine: i - 1 });
    } else {
      i++;
    }
  }

  return changes;
}
