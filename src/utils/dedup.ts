/**
 * 全文语义去重 / 水文优化（本地轻量算法）
 * 检测章节内的重复句子与高频重复短语，支持一键精简（删除重复出现的内容）。
 */

export interface DupItem {
  /** 重复的句子或短语 */
  text: string;
  /** 出现次数 */
  count: number;
}

/** 按中文标点切分句子 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？!?；;])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 检测文本中完全重复的句子
 * @param minLen 参与统计的最小句子长度（太短容易误报）
 */
export function detectDuplicateSentences(text: string, minLen = 8): DupItem[] {
  const counts: Record<string, number> = {};
  for (const s of splitSentences(text)) {
    if (s.length < minLen) continue;
    counts[s] = (counts[s] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([text, count]) => ({ text, count }));
}

/**
 * 检测高频重复短语（n-gram 滑动窗口）
 * 用最长短语优先，避免短短语被长短语重复统计
 */
export function detectRepeatedPhrases(
  text: string,
  minLen = 6,
  maxLen = 14,
  minCount = 3
): DupItem[] {
  const cleaned = text.replace(/\s/g, "");
  const counts: Record<string, number> = {};

  for (let len = minLen; len <= maxLen; len++) {
    for (let i = 0; i <= cleaned.length - len; i++) {
      const phrase = cleaned.slice(i, i + len);
      if (!/[\u4e00-\u9fa5]/.test(phrase)) continue;
      counts[phrase] = (counts[phrase] || 0) + 1;
    }
  }

  const candidates = Object.entries(counts)
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[0].length - a[0].length);

  const result: DupItem[] = [];
  const used: string[] = [];
  for (const [phrase, count] of candidates) {
    // 已被更长短语覆盖的跳过
    if (used.some((u) => u.includes(phrase))) continue;
    used.push(phrase);
    result.push({ text: phrase, count });
    if (result.length >= 10) break;
  }

  return result.sort((a, b) => b.count - a.count);
}

/**
 * 一键精简：删除重复出现的句子（保留第一次出现），返回精简后的文本
 * 返回 null 表示没有可精简的重复
 */
export function removeDuplicateSentences(text: string, minLen = 8): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  let removed = 0;

  for (const s of splitSentences(text)) {
    if (s.length >= minLen && seen.has(s)) {
      removed++;
      continue;
    }
    if (s.length >= minLen) seen.add(s);
    out.push(s);
  }

  return removed > 0 ? out.join("") : null;
}
