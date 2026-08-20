/**
 * 本地 NLP 工具集
 * 关键词提取、语义相似度、动态上下文拼接
 * 纯前端实现，不消耗 API Token
 */

// ===== 中文停用词 =====
const STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
  "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些",
  "什么", "怎么", "如何", "因为", "所以", "但是", "然而", "如果", "虽然",
  "可以", "这个", "那个", "已经", "还是", "只是", "不是", "就是", "但是",
  "把", "被", "让", "给", "对", "从", "向", "在", "于", "与", "以",
  "而", "且", "或", "但", "又", "再", "才", "就", "便", "还", "也",
  "很", "太", "更", "最", "越", "稍", "略", "颇", "极",
  "来", "去", "起", "出", "过", "回", "开", "走", "进", "上", "下",
]);

// ===== 自定义词库（网文常见专有名词） =====
const NOVEL_DICTIONARY = new Set([
  // 常见姓氏
  "李", "王", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴", "徐", "孙",
  "马", "胡", "朱", "郭", "何", "罗", "高", "林",
  // 常见玄幻词缀
  "大帝", "尊者", "宗师", "圣主", "神王", "魔帝", "剑圣",
  "斗气", "灵力", "真气", "元力", "魂力", "法力",
  "大陆", "帝国", "王朝", "宗门", "圣地", "魔域",
]);

// ===== 关键词提取 =====
export interface KeywordResult {
  word: string;
  score: number;
}

/** 中文分词（简单实现：按字符 + 双字词匹配） */
function segmentChinese(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < text.length) {
    // 尝试匹配双字词
    if (i + 1 < text.length) {
      const twoChar = text.slice(i, i + 2);
      if (NOVEL_DICTIONARY.has(twoChar) || !STOP_WORDS.has(twoChar)) {
        tokens.push(twoChar);
        i += 2;
        continue;
      }
    }
    // 单字
    const char = text[i];
    if (/[\u4e00-\u9fff]/.test(char) && !STOP_WORDS.has(char)) {
      tokens.push(char);
    }
    i++;
  }
  return tokens;
}

/** 提取关键词（TF-IDF 简化实现，不依赖 natural 包） */
export function extractKeywords(text: string, topN: number = 10): KeywordResult[] {
  const words = segmentChinese(text.toLowerCase());
  if (words.length === 0) return [];

  // 词频统计 (TF)
  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  // 简化 TF-IDF: 用词频 × (1 / 总词数) 作为分数
  // 较长的词（更有信息量）给予加权
  const totalWords = words.length;
  const scores: KeywordResult[] = Array.from(tf.entries())
    .map(([word, count]) => ({
      word,
      score: (count / totalWords) * (1 + word.length * 0.1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return scores;
}

/** 提取角色名（大写/中文专有名词启发式） */
export function extractCharacterNames(text: string): string[] {
  const words = segmentChinese(text);
  const names = new Set<string>();

  for (let i = 0; i < words.length - 1; i++) {
    // 双字姓名
    if (NOVEL_DICTIONARY.has(words[i]) && /[\u4e00-\u9fff]/.test(words[i + 1])) {
      names.add(words[i] + words[i + 1]);
    }
    // 三字姓名检测
    if (i < words.length - 2 &&
        NOVEL_DICTIONARY.has(words[i]) &&
        /[\u4e00-\u9fff]/.test(words[i + 1]) &&
        /[\u4e00-\u9fff]/.test(words[i + 2])) {
      names.add(words[i] + words[i + 1] + words[i + 2]);
    }
  }

  return Array.from(names).slice(0, 20);
}

/** 提取地名（"XX大陆"、"XX城" 等模式） */
export function extractPlaceNames(text: string): string[] {
  const places = new Set<string>();
  const patterns = [
    /[\u4e00-\u9fff]{2,3}(?:大陆|帝国|王朝|王国|公国|之城)/g,
    /[\u4e00-\u9fff]{2,3}(?:之城|之都|圣地|秘境|遗迹|深渊)/g,
    /[\u4e00-\u9fff]{1,3}(?:城|山|峰|谷|湖|河|海|岛|林|原|漠|渊)/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) matches.forEach((m) => places.add(m));
  }

  return Array.from(places).slice(0, 10);
}

// ===== 文本向量化 & 相似度 =====

/** 将文本转为词频向量 */
function textToVector(text: string): Map<string, number> {
  const words = segmentChinese(text.toLowerCase());
  const vector = new Map<string, number>();
  for (const word of words) {
    vector.set(word, (vector.get(word) || 0) + 1);
  }
  return vector;
}

/** 计算余弦相似度（两个文本之间） */
export function cosineSimilarity(textA: string, textB: string): number {
  const vecA = textToVector(textA);
  const vecB = textToVector(textB);

  // 获取所有唯一词
  const allWords = new Set([...vecA.keys(), ...vecB.keys()]);

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const word of allWords) {
    const aVal = vecA.get(word) || 0;
    const bVal = vecB.get(word) || 0;
    dotProduct += aVal * bVal;
    magA += aVal * aVal;
    magB += bVal * bVal;
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/** 计算 Jaccard 相似度 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const wordsA = new Set(segmentChinese(textA.toLowerCase()));
  const wordsB = new Set(segmentChinese(textB.toLowerCase()));

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ===== 智能记忆召回 =====

export interface MemoryItem {
  id: string;
  title: string;
  content: string;
  keywords: KeywordResult[];
  characters: string[];
}

/** 根据当前文本召回最相关的记忆片段 */
export function recallRelevantMemories(
  currentText: string,
  memories: { chapter_id: string; chapter_title: string; summary: string; key_events: string[] }[],
  topN: number = 5
): typeof memories {
  if (memories.length === 0 || !currentText) return [];

  // 提取当前文本关键词
  const currentKeywords = extractKeywords(currentText, 20);
  const currentChars = extractCharacterNames(currentText);
  const keywordSet = new Set(currentKeywords.map((k) => k.word));

  // 评分每个记忆
  const scored = memories.map((mem) => {
    const memText = mem.summary + " " + mem.key_events.join(" ");
    const memKeywords = extractKeywords(memText, 10);
    const memChars = extractCharacterNames(memText);

    // 关键词重叠得分
    let keywordScore = 0;
    for (const kw of memKeywords) {
      if (keywordSet.has(kw.word)) keywordScore += kw.score;
    }

    // 角色名重叠得分
    const charOverlap = memChars.filter((c) => currentChars.includes(c)).length;
    const charScore = charOverlap * 0.5;

    // 余弦相似度
    const cosScore = cosineSimilarity(currentText, memText) * 2;

    const totalScore = keywordScore + charScore + cosScore;
    return { memory: mem, score: totalScore };
  });

  // 按评分排序并返回 topN
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .filter((s) => s.score > 0.1)
    .map((s) => s.memory);
}

// ===== 智能上下文构建 =====

export interface ContextPackage {
  relevantMemories: string;
  characters: string;
  keywords: string;
}

/** 构建动态上下文：自动选择最相关的记忆拼接 */
export function buildSmartContext(
  currentContent: string,
  memories: { chapter_id: string; chapter_title: string; summary: string; key_events: string[] }[],
  characters: { name: string; personality: string; background: string }[],
  worldSetting: string,
  topN: number = 5
): string {
  const parts: string[] = [];

  // 1. 世界观（固定携带）
  if (worldSetting) {
    parts.push(`【世界观设定】\n${worldSetting.slice(0, 500)}\n`);
  }

  // 2. 角色档案（智能筛选：只选和当前内容相关的角色）
  const currentChars = extractCharacterNames(currentContent);
  const relevantChars = characters.filter(
    (c) => currentChars.includes(c.name) || currentChars.some((ch) => c.name.includes(ch))
  );
  if (relevantChars.length > 0) {
    const charDesc = relevantChars
      .map((c) => `- ${c.name}：性格=${c.personality}，背景=${c.background}`)
      .join("\n");
    parts.push(`【当前相关角色】\n${charDesc}\n`);
  } else if (characters.length > 0) {
    // 如果没有特别相关的，带上前 3 个主要角色
    const charDesc = characters
      .slice(0, 3)
      .map((c) => `- ${c.name}：性格=${c.personality}`)
      .join("\n");
    parts.push(`【主要角色】\n${charDesc}\n`);
  }

  // 3. 智能召回记忆（只选最相关的，数量由「携带章节数」决定）
  const relevantMemories = recallRelevantMemories(currentContent, memories, topN);
  if (relevantMemories.length > 0) {
    const memDesc = relevantMemories
      .map(
        (m) =>
          `【${m.chapter_title}】\n摘要：${m.summary}\n关键事件：${m.key_events.join("、")}`
      )
      .join("\n\n");
    parts.push(`【相关剧情记忆】\n${memDesc}\n`);
  }

  return parts.join("\n\n");
}
