/**
 * 写作技能类型定义
 * 仿 @actalk/inkos SKILL.md 模式：YAML frontmatter + Markdown body
 */

/** 技能分类 */
export type SkillCategory =
  | "world"      // 世界观
  | "character"  // 角色
  | "plot"       // 剧情
  | "writing"    // 写作
  | "review"     // 审校
  | "translate"  // 翻译
  | "utils";     // 工具

/** 技能来源 */
export type SkillSource = "builtin" | "custom";

/** 技能分类元信息 */
export const SKILL_CATEGORIES: Record<SkillCategory, { label: string; emoji: string; icon: string; desc: string }> = {
  world:     { label: "世界观", emoji: "🌍", icon: "lucide:globe", desc: "世界构建、势力设定、地理环境" },
  character: { label: "角色",   emoji: "👤", icon: "lucide:user", desc: "角色设定、关系网、对话风格" },
  plot:      { label: "剧情",   emoji: "📜", icon: "lucide:scroll-text", desc: "大纲规划、章节设计、剧情推演" },
  writing:   { label: "写作",   emoji: "✍️", icon: "lucide:pen-line", desc: "续写、扩写、润色、改写" },
  review:    { label: "审校",   emoji: "🔍", icon: "lucide:spell-check", desc: "连续性检查、质量审校" },
  translate: { label: "翻译",   emoji: "🌐", icon: "lucide:languages", desc: "多语言翻译" },
  utils:     { label: "工具",   emoji: "🔧", icon: "lucide:wrench", desc: "格式转换、字数统计" },
};

/**
 * 写作技能定义
 * 对标 inkos 的 AgentSkillSchema:
 * { id, name, description, body, source?, baseDir? }
 */
export interface WritingSkill {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 简短描述 */
  description: string;
  /** emoji 图标 */
  emoji: string;
  /** lucide 图标名（如 lucide:globe），用于技能列表/选择器展示；缺省时回退 emoji */
  icon?: string;
  /** 分类 */
  category: SkillCategory;
  /** 标签 */
  tags: string[];
  /** 适用场景说明 */
  when: string;
  /** System Prompt 主体（被注入到 AI 的 system message） */
  systemPrompt: string;
  /** 用户输入的 prompt 模板（{input} 会被替换为用户输入） */
  userPromptTemplate?: string;
  /** 是否激活（可被用户启用/禁用） */
  enabled: boolean;
  /** 版本 */
  version: string;
  /** 技能来源：builtin=官方内置，custom=用户上传/自定义 */
  source: SkillSource;
  /** 作者（自定义技能） */
  author?: string;
  /** 技能描述/主页链接（自定义技能） */
  homepage?: string;
  /** 安装时间（ISO，自定义技能） */
  installedAt?: string;
  /** 技能原始文件内容（SKILL.md body，自定义技能；内置技能为 null） */
  body?: string;
  /** 技能目录下配套的资源文件（js 脚本等），仅自定义技能有 */
  resources?: string[];
}

/** 技能参数上下文（调用技能时注入的变量） */
export interface SkillContext {
  /** 项目名称 */
  projectName?: string;
  /** 当前章节标题 */
  chapterTitle?: string;
  /** 当前章节内容 */
  chapterContent?: string;
  /** 选中文本 */
  selectedText?: string;
  /** 世界观设定 */
  worldSetting?: string;
  /** 角色列表（摘要） */
  characters?: string;
  /** 近期记忆摘要 */
  recentMemories?: string;
}
