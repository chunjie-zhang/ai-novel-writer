import { defineStore } from "pinia";
import { ref, computed } from "vue";

/** 6 大写作场景预设 */
export type WritingScene = "quick-write" | "polish" | "plot-idea" | "character-gen" | "logic-check" | "outline";

export interface ScenePreset {
  label: string;
  emoji: string;
  icon: string;
  iconColor: string;
  desc: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export const SCENE_PRESETS: Record<WritingScene, ScenePreset> = {
  "quick-write": {
    label: "快速续写",
    emoji: "⚡",
    icon: "lucide:zap",
    iconColor: "linear-gradient(135deg,#f59e0b,#f97316)",
    desc: "延续剧情快速输出，创意优先",
    temperature: 0.9,
    maxTokens: 4096,
    systemPrompt: "你是一位小说续写师。请延续上文的风格和剧情快速输出后续内容。保持叙事节奏，直接输出续写内容，不加说明。",
  },
  polish: {
    label: "精细润色",
    emoji: "✨",
    icon: "lucide:sparkles",
    iconColor: "linear-gradient(135deg,#a855f7,#ec4899)",
    desc: "优化文笔措辞，提升语言质量",
    temperature: 0.4,
    maxTokens: 2048,
    systemPrompt: "你是一位文字编辑。请细致润色以下文本，优化用词、句式节奏和表达流畅度。保留原意和风格，直接输出润色后的内容。",
  },
  "plot-idea": {
    label: "剧情构思",
    emoji: "💡",
    icon: "lucide:lightbulb",
    iconColor: "linear-gradient(135deg,#facc15,#f59e0b)",
    desc: "创意发散，拓展剧情方向",
    temperature: 1.2,
    maxTokens: 2048,
    systemPrompt: "你是一位创意策划。请发散思维，提供多个有趣的剧情方向和情节设计。鼓励大胆创意，每个方向简述其潜力和可能发展。",
  },
  "character-gen": {
    label: "人设生成",
    emoji: "👤",
    icon: "lucide:user-round",
    iconColor: "linear-gradient(135deg,#10b981,#14b8a6)",
    desc: "生成立体丰满的角色设定",
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: "你是一位角色设计师。请生成有深度、有魅力的角色设定。包含：基本信息、性格画像、背景故事、能力特长、人际关系、动机目标、角色弧光。角色要有缺点才真实。",
  },
  "logic-check": {
    label: "逻辑纠错",
    emoji: "🔍",
    icon: "lucide:shield-check",
    iconColor: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    desc: "检查剧情漏洞和逻辑矛盾",
    temperature: 0.2,
    maxTokens: 2048,
    systemPrompt: "你是一位剧情审计员。请仔细检查以下内容的逻辑问题：时间线矛盾、角色行为不一致、力量体系冲突、因果关系断裂。列出每个问题及其严重程度（致命/重要/轻微），并给出修复建议。",
  },
  outline: {
    label: "大纲优化",
    emoji: "📋",
    icon: "lucide:list-ordered",
    iconColor: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    desc: "梳理和优化故事大纲结构",
    temperature: 0.6,
    maxTokens: 3072,
    systemPrompt: "你是一位大纲规划师。请帮助梳理和优化故事大纲。关注：故事内核清晰度、三幕结构合理性、情节节奏分布、伏笔设置、角色弧光完整性。给出具体优化建议。",
  },
};

/** 日更目标配置 */
export interface DailyGoal {
  enabled: boolean;
  targetWords: number;
}

const STORAGE_KEY = "novel-writing-stats";

interface PersistedStats {
  date: string;
  writtenToday: number;
  dailyGoal: DailyGoal;
  totalWrittenAllTime: number;
}

function loadStats(): PersistedStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("loadStats 失败:", e); }
  return { date: "", writtenToday: 0, dailyGoal: { enabled: false, targetWords: 3000 }, totalWrittenAllTime: 0 };
}

function saveStats(s: PersistedStats) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export const useWritingStore = defineStore("writing", () => {
  // ===== 写作场景 =====
  const activeScene = ref<WritingScene | null>(null);

  const currentScene = computed(() =>
    activeScene.value ? SCENE_PRESETS[activeScene.value] : null
  );

  function setScene(scene: WritingScene | null) {
    activeScene.value = scene;
  }

  // ===== 字数统计 + 日更目标 =====
  const stats = ref<PersistedStats>(loadStats());

  // 按天重置
  const today = computed(() => new Date().toISOString().slice(0, 10));

  function ensureToday() {
    if (stats.value.date !== today.value) {
      stats.value.date = today.value;
      stats.value.writtenToday = 0;
      saveStats(stats.value);
    }
  }

  // 监听用户实际输入的字数，自动累计（仅编辑器用户输入触发，打开/切换章节不计入）
  function initInputListener() {
    window.addEventListener("editor-user-input", ((e: Event) => {
      const added = (e as CustomEvent).detail as number;
      if (!added || added <= 0) return;
      ensureToday();
      stats.value.writtenToday += added;
      stats.value.totalWrittenAllTime += added;
      saveStats(stats.value);
      // 同时记录到每日统计历史
      try {
        const today = new Date().toISOString().slice(0, 10);
        const history = JSON.parse(localStorage.getItem("novel-daily-stats") || "{}");
        history[today] = (history[today] || 0) + added;
        localStorage.setItem("novel-daily-stats", JSON.stringify(history));
      } catch (e) { console.error("记录写作统计失败:", e); }
    }) as EventListener);
  }
  initInputListener();

  // 日更目标进度
  const dailyProgress = computed(() => {
    if (!stats.value.dailyGoal.enabled || stats.value.dailyGoal.targetWords === 0) return 1;
    return Math.min(stats.value.writtenToday / stats.value.dailyGoal.targetWords, 1);
  });

  const dailyProgressPercent = computed(() => Math.round(dailyProgress.value * 100));

  const isGoalMet = computed(() => dailyProgress.value >= 1);

  function setDailyGoal(enabled: boolean, targetWords?: number) {
    stats.value.dailyGoal.enabled = enabled;
    if (targetWords !== undefined) stats.value.dailyGoal.targetWords = targetWords;
    saveStats(stats.value);
  }

  // ===== 文风采样 =====
  const sampledStyle = ref<string | null>(null);
  const styleSample = ref<string>("");

  /** 采样选中的文本作为文风样本 */
  function sampleStyle(text: string) {
    styleSample.value = text;
    sampledStyle.value = `【用户文风样本】\n${text.slice(0, 2000)}\n\n请严格模仿以上文风进行创作，保持句式长度、用词习惯、修辞手法和叙事节奏完全一致。`;
  }

  function clearStyleSample() {
    sampledStyle.value = null;
    styleSample.value = "";
  }

  // ===== 人设校验 =====
  const characterProfiles = ref<string>("");

  /** 设置角色设定用于人设校验 */
  function setCharacterProfiles(profiles: string) {
    characterProfiles.value = profiles;
  }

  /** 构建人设校验 prompt */
  function buildOOCPrompt(content: string): string {
    if (!characterProfiles.value) return "";
    return `【人设校验】\n角色设定：${characterProfiles.value}\n\n请检查以下内容中是否有角色行为、台词、性格与设定不一致的地方（人设崩塌/OOC）。\n\n回复要求：第一行必须输出结论标记（二选一），然后换行输出详细检查报告：\n- 若发现人设不一致，第一行输出：【结论】存在人设不一致\n- 若未发现人设不一致，第一行输出：【结论】未发现人设不一致\n\n待检查内容：\n${content}`;
  }

  // ===== 敏感词库（仅保留多字词，避免单字“习”误报“学习/习惯”等正常词）=====
  const sensitiveWords = ref<string[]>([
    "他妈", "我操", "傻逼", "草泥马", "fuck", "shit",
    // 出版合规类
    "共产党", "天安门", "法轮功", "六四",
    // 网文平台敏感
    "吸毒", "卖淫", "赌博", "暴力血腥",
  ]);

  /** 敏感词校对 */
  function checkSensitiveWords(text: string): { word: string; position: number }[] {
    const results: { word: string; position: number }[] = [];
    for (const word of sensitiveWords.value) {
      let idx = text.indexOf(word);
      while (idx !== -1) {
        results.push({ word, position: idx });
        idx = text.indexOf(word, idx + 1);
      }
    }
    return results;
  }

  /** 替换敏感词 */
  function replaceSensitiveWords(text: string, replacement = "***"): string {
    let result = text;
    for (const word of sensitiveWords.value) {
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      result = result.replace(regex, replacement);
    }
    return result;
  }

  // ===== 排版规整 =====
  function formatText(text: string): string {
    return text
      .replace(/\r\n/g, "\n")           // 统一换行符
      .replace(/\n{4,}/g, "\n\n\n")     // 最多保留 2 个空行
      .replace(/[ 　]+/g, " ")          // 全角空格→半角，合并连续空格
      .replace(/^\s*$(?:\r\n?|\n)/gm, "\n") // 空行规范化
      .trim();
  }

  // ===== 情绪识别（简易版） =====
  const emotionKeywords: Record<string, number> = {
    "开心": 0.8, "快乐": 0.8, "喜悦": 0.8, "幸福": 0.7,
    "悲伤": 0.2, "难过": 0.2, "痛苦": 0.1, "绝望": 0.0,
    "愤怒": 0.9, "暴怒": 0.9, "生气": 0.7,
    "恐惧": 0.1, "害怕": 0.2, "惊恐": 0.0,
    "温馨": 0.7, "甜蜜": 0.8, "浪漫": 0.7,
    "紧张": 0.3, "悬疑": 0.3, "激烈": 0.8,
  };

  /** 简易情绪分析，返回建议的 temperature 值 */
  function suggestTemperature(text: string): number {
    const sample = text.slice(-500).toLowerCase();
    let score = 0.5; // 默认中等
    let matches = 0;

    for (const [word, val] of Object.entries(emotionKeywords)) {
      if (sample.includes(word)) {
        score += val - 0.5;
        matches++;
      }
    }

    if (matches > 0) {
      score = score / matches + 0.3;
    }

    // 热血/激烈场景 -> 高温度 (创意)
    if (/战斗|打斗|对决|激战|厮杀/.test(sample)) return 0.9;
    // 悬疑/推理 -> 中温度
    if (/推理|线索|真相|谜团/.test(sample)) return 0.5;
    // 情感/细腻 -> 中低温度
    if (/表白|告白|拥抱|亲吻|泪/.test(sample)) return 0.6;

    return Math.max(0.1, Math.min(1.5, score));
  }

  return {
    activeScene,
    currentScene,
    setScene,
    stats,
    dailyProgress,
    dailyProgressPercent,
    isGoalMet,
    setDailyGoal,
    sampledStyle,
    styleSample,
    sampleStyle,
    clearStyleSample,
    characterProfiles,
    setCharacterProfiles,
    buildOOCPrompt,
    sensitiveWords,
    checkSensitiveWords,
    replaceSensitiveWords,
    formatText,
    suggestTemperature,
  };
});
