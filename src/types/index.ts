// ===== 小说项目相关类型 =====

export interface NovelProject {
  id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
  description: string;
  config: ProjectConfig;
  /** 作者笔名 */
  author?: string;
  /** 题材 */
  genre?: string;
  /** 连载状态 */
  status?: string;
  /** 标签（逗号分隔） */
  tags?: string;
  /** 封面路径 */
  cover?: string;
}

/** DeepSeek 官方模型变体 */
export type DeepSeekVariant = "deepseek-v4-flash" | "deepseek-v4-pro";

export interface ProjectConfig {
  model_provider: "builtin" | "custom";
  /** DeepSeek 官方模式下的模型变体 */
  builtin_variant: DeepSeekVariant;
  api_key: string;
  base_url: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  context_limit: number;
}

/** DeepSeek 官方模型预设配置（用户仍需自行提供 API Key） */
export const DEEPSEEK_PRESETS: Record<
  DeepSeekVariant,
  { label: string; desc: string; model: string; base_url: string; max_tokens: number }
> = {
  "deepseek-v4-flash": {
    label: "DeepSeek V4 Flash",
    desc: "快速创作、日常续写、性价比高",
    model: "deepseek-chat",
    base_url: "https://api.deepseek.com",
    max_tokens: 4096,
  },
  "deepseek-v4-pro": {
    label: "DeepSeek V4 Pro",
    desc: "深度推理、复杂剧情、人设打磨",
    model: "deepseek-reasoner",
    base_url: "https://api.deepseek.com",
    max_tokens: 8192,
  },
};

export interface ChapterInfo {
  id: string;
  title: string;
  file_name: string;
  /** 章节分组（相对 chapters/ 的子目录名，空字符串表示根目录） */
  group: string;
  order: number;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: string;
  personality: string;
  appearance: string;
  background: string;
  relationships: string;
  speech_pattern: string;
  notes: string;
}

export interface MemorySummary {
  chapter_id: string;
  chapter_title: string;
  chapter_order: number;
  summary: string;
  key_events: string[];
  created_at: string;
}

export interface WorldSetting {
  content: string;
  factions: Faction[];
  rules: string[];
  geography: string;
}

export interface Faction {
  name: string;
  description: string;
  members: string[];
}

export interface ProjectStructure {
  project: NovelProject;
  chapters: ChapterInfo[];
  /** 已创建的卷分组目录名（含空卷） */
  groups: string[];
  characters: Character[];
  world_setting: WorldSetting;
  memories: MemorySummary[];
}

// ===== 参考小说（导入分析用）相关类型 =====

/** 写作模式：仿写/借鉴/续写/分析 */
export type WritingMode = "imitate" | "reference" | "continue-ref" | "analyze";

export const WRITING_MODES: Record<WritingMode, { label: string; emoji: string; desc: string }> = {
  imitate: {
    label: "仿写风格",
    emoji: "🎨",
    desc: "模仿参考小说的文风、叙事节奏和语言特点进行创作",
  },
  "reference": {
    label: "借鉴剧情",
    emoji: "📖",
    desc: "参考小说的剧情结构、人物关系、情节设计来构思自己的故事",
  },
  "continue-ref": {
    label: "续写风格",
    emoji: "✍️",
    desc: "延续参考小说的风格续写内容",
  },
  analyze: {
    label: "分析作品",
    emoji: "🔍",
    desc: "深度分析小说的文风、结构、人物和情节",
  },
};

/** 导入的参考小说 */
export interface ReferenceNovel {
  id: string;
  /** 原始文件名 */
  file_name: string;
  /** 显示名称 */
  title: string;
  /** 总字数 */
  total_words: number;
  /** 总章节数 */
  total_chapters: number;
  /** 导入时间 */
  imported_at: string;
  /** 原始文件路径 */
  source_path: string;
}

/** 参考小说的章节 */
export interface ReferenceChapter {
  index: number;
  title: string;
  content: string;
  word_count: number;
}

/** AI 小说分析结果 */
export interface NovelAnalysis {
  /** 题材（如：都市异能/玄幻/仙侠/科幻/悬疑） */
  genre: string;
  /** 整体风格描述 */
  style_summary: string;
  /** 写作特点 */
  writing_features: string[];
  /** 叙事视角 */
  narrative_perspective: string;
  /** 节奏特点 */
  pace_description: string;
  /** 对话风格 */
  dialogue_style: string;
  /** 主要角色 */
  main_characters: { name: string; role: string; traits: string }[];
  /** 情节结构 */
  plot_structure: string;
  /** 适合仿写的维度 */
  imitable_aspects: string[];
}

// ===== AI 相关类型 =====

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequest {
  messages: ChatMessage[];
  model: string;
  temperature: number;
  max_tokens: number;
  stream: boolean;
}

export interface AIResponse {
  content: string;
  finish_reason: string;
}

// ===== 编辑器相关类型 =====

export type AIActionType = "rewrite" | "expand" | "abridge" | "polish" | "continue";
