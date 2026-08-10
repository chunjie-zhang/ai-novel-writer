/**
 * 行级 Diff 工具（LCS 最长公共子序列）
 * 用于「章节历史版本回溯」的对比预览：当前内容 vs 历史版本。
 */

export interface LineDiff {
  /** same: 两版本相同；add: 相对 oldText 新增；del: 相对 oldText 删除 */
  type: "same" | "add" | "del";
  text: string;
}

/** 超过该行数时不做行级对比（避免 O(n*m) 内存过大导致卡顿），降级为纯文本 */
const MAX_DIFF_LINES = 1500;

/**
 * 对比两段文本的逐行差异。
 * @param oldText 基准文本（当前内容）
 * @param newText 对比文本（历史版本）
 * @returns 合并后的行序列：add = newText 有而 oldText 没有；del = oldText 有而 newText 没有
 */
export function diffLines(oldText: string, newText: string): LineDiff[] {
  // 空文本视为 0 行（避免 "".split("\n") 产生一个空行）
  const oldLines = oldText === "" ? [] : oldText.split("\n");
  const newLines = newText === "" ? [] : newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;

  // 行数过大时降级：整段视为差异（保证不卡顿）
  if (n * m > MAX_DIFF_LINES * MAX_DIFF_LINES) {
    const result: LineDiff[] = [];
    if (oldLines.length > 0) {
      result.push({ type: "del", text: oldText });
    }
    if (newLines.length > 0) {
      result.push({ type: "add", text: newText });
    }
    return result;
  }

  // LCS DP（用 Int32Array 控制内存）
  const dp = new Int32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const idx = i * (m + 1) + j;
      if (oldLines[i] === newLines[j]) {
        dp[idx] = dp[(i + 1) * (m + 1) + j + 1] + 1;
      } else {
        dp[idx] = Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
      }
    }
  }

  // 回溯构造差异
  const result: LineDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: "same", text: oldLines[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) {
      result.push({ type: "del", text: oldLines[i] });
      i++;
    } else {
      result.push({ type: "add", text: newLines[j] });
      j++;
    }
  }
  while (i < n) {
    result.push({ type: "del", text: oldLines[i] });
    i++;
  }
  while (j < m) {
    result.push({ type: "add", text: newLines[j] });
    j++;
  }
  return result;
}

/** 统计一段差异里增/删/相同各有多少行（供 UI 展示汇总） */
export function summarizeDiff(diffs: LineDiff[]) {
  let add = 0;
  let del = 0;
  let same = 0;
  for (const d of diffs) {
    if (d.type === "add") add++;
    else if (d.type === "del") del++;
    else same++;
  }
  return { add, del, same };
}
