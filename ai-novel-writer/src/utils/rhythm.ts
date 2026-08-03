/**
 * 剧情节奏检测 / 水文识别（本地轻量算法）
 * 分析章节文本的节奏健康度，识别：水文段落、节奏拖沓、对话注水、
 * 用词重复、场景单薄等问题，输出可操作的检查报告。
 */

export interface RhythmIssue {
  type: "water" | "rhythm" | "repetition" | "dialogue" | "thin";
  level: "info" | "warn" | "danger";
  title: string;
  desc: string;
  position?: string;
}

export interface RhythmReport {
  /** 0-100 节奏健康度 */
  score: number;
  summary: string;
  issues: RhythmIssue[];
  stats: {
    chars: number;
    paragraphs: number;
    avgLen: number;
    dialogueRatio: number;
    shortParas: number;
    longParas: number;
  };
}

/** 常见停用词（用于高频词统计） */
const STOP_WORDS = new Set([
  "的", "了", "是", "我", "你", "他", "她", "它", "们", "在", "有", "和", "就",
  "不", "也", "都", "而", "及", "与", "着", "或", "一个", "没有", "我们", "你们",
  "他们", "这个", "那个", "自己", "什么", "怎么", "因为", "所以", "但是", "如果",
  "然后", "还有", "已经", "可以", "一下", "一直", "现在", "这时", "那个", "就是",
]);

/** 拆分段落（保留每段的原文用于定位） */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** 是否为对话行/段 */
function isDialogue(para: string): boolean {
  return /[""「」『』]/.test(para) || /^[——]/.test(para.trim());
}

/** 提取高频重复词 */
function topRepeatedWords(text: string, topN = 5): { word: string; count: number }[] {
  const counts: Record<string, number> = {};
  // 用 2-gram 检测重复短语更有意义
  const cleaned = text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
  for (let i = 0; i < cleaned.length - 1; i++) {
    const w = cleaned.slice(i, i + 2);
    if (STOP_WORDS.has(w)) continue;
    counts[w] = (counts[w] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));
}

/**
 * 分析章节文本的节奏健康度
 */
export function analyzeRhythm(text: string): RhythmReport {
  const cleaned = text.replace(/\s/g, "");
  const chars = cleaned.length;
  const paragraphs = splitParagraphs(text);
  const issues: RhythmIssue[] = [];

  // 段落长度统计
  const lens = paragraphs.map((p) => p.replace(/\s/g, "").length);
  const avgLen = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const shortParas = lens.filter((l) => l > 0 && l < 15).length;
  const longParas = lens.filter((l) => l > 200).length;
  const shortRatio = lens.length ? shortParas / lens.length : 0;
  const longRatio = lens.length ? longParas / lens.length : 0;

  // 对话密度
  const dialogueParas = paragraphs.filter(isDialogue).length;
  const dialogueRatio = paragraphs.length ? dialogueParas / paragraphs.length : 0;

  // 重复词
  const repeats = topRepeatedWords(text);

  // ===== 判断各类问题 =====
  // 1. 水文：对话占比过高 + 段落过碎
  if (dialogueRatio > 0.55) {
    issues.push({
      type: "water",
      level: "warn",
      title: "对话注水",
      desc: `对话段落占比约 ${Math.round(dialogueRatio * 100)}%，对话偏多，可能存在"为了凑字数"的注水对话。建议精简对话、增加动作与场景描写。`,
    });
  }

  // 2. 段落过碎 → 水文/节奏碎
  if (shortRatio > 0.35) {
    issues.push({
      type: "water",
      level: shortRatio > 0.5 ? "danger" : "warn",
      title: "段落过碎",
      desc: `${shortParas} 段为超短段落（<15字），占比 ${Math.round(shortRatio * 100)}%。过碎段落通常信息量低，易读感像"水"。建议合并短段或补充细节。`,
    });
  }

  // 3. 节奏拖沓：长段落过多
  if (longRatio > 0.15 && chars > 2000) {
    issues.push({
      type: "rhythm",
      level: "warn",
      title: "节奏拖沓",
      desc: `${longParas} 段为超长段落（>200字），占比 ${Math.round(longRatio * 100)}%。长段过多易造成阅读节奏拖沓，建议拆分或插入场景/对话切换。`,
    });
  }

  // 4. 用词重复
  if (repeats.length >= 2) {
    issues.push({
      type: "repetition",
      level: repeats[0].count > 8 ? "warn" : "info",
      title: "用词重复",
      desc: `高频重复片段：${repeats.map((r) => `「${r.word}」×${r.count}`).join("、")}。同一短语频繁出现会显啰嗦，建议替换为同义词。`,
    });
  }

  // 5. 场景单薄：字数过少
  if (chars < 500) {
    issues.push({
      type: "thin",
      level: "warn",
      title: "场景单薄",
      desc: `本章仅约 ${chars} 字，内容偏单薄。建议补充环境描写、心理活动或事件细节。`,
    });
  } else if (chars < 1200) {
    issues.push({
      type: "thin",
      level: "info",
      title: "篇幅较短",
      desc: `本章约 ${chars} 字，篇幅偏短（常见章节约 2000-3000 字），可酌情扩充。`,
    });
  }

  // 6. 无问题提示
  if (issues.length === 0) {
    issues.push({
      type: "rhythm",
      level: "info",
      title: "节奏健康",
      desc: "未发现明显的节奏或注水问题，段落分布、对话密度与篇幅都比较合理。",
    });
  }

  // ===== 综合评分 =====
  let score = 100;
  if (dialogueRatio > 0.55) score -= 15;
  if (shortRatio > 0.35) score -= 15;
  if (longRatio > 0.15) score -= 10;
  if (repeats.length >= 2) score -= 10;
  if (chars < 500) score -= 20;
  else if (chars < 1200) score -= 8;
  score = Math.max(0, Math.min(100, score));

  const summary =
    score >= 80
      ? "节奏良好，可以放心连载。"
      : score >= 60
        ? "节奏尚可，有几处可以优化。"
        : "节奏偏弱，建议针对下方问题调整后再发表。";

  return {
    score,
    summary,
    issues,
    stats: {
      chars,
      paragraphs: paragraphs.length,
      avgLen: Math.round(avgLen),
      dialogueRatio,
      shortParas,
      longParas,
    },
  };
}
