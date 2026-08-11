import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface NovelTemplate {
  id: string;
  name: string;
  emoji: string;
  /** lucide 图标名（组件库 Icon），卡片展示用 */
  icon: string;
  description: string;
  /** 推荐 temperature */
  temperature: number;
  /** 风格说明 prompt */
  stylePrompt: string;
  /** 角色命名风格 */
  namingStyle: string;
  /** 世界设定倾向 */
  worldTendency: string;
  /** 节奏建议 */
  paceAdvice: string;
  /** 常用标签 */
  tags: string[];
}

const STORAGE_KEY = "novel-templates-active";

const ALL_TEMPLATES: NovelTemplate[] = [
  {
    id: "xuanhuan",
    name: "玄幻仙侠",
    emoji: "🐉",
    icon: "lucide:gem",
    description: "修炼升级、宗门争霸、天地法则",
    temperature: 0.85,
    stylePrompt: "文风偏向古风雅韵，修炼体系需有明确等级（炼气→筑基→金丹→元婴等），打斗场面要气势恢宏。注重境界突破的感悟描写。",
    namingStyle: "古风/道家风格（如：青云、紫霄、太初、九天）",
    worldTendency: "东方玄幻世界，包含修仙门派、妖兽森林、秘境遗迹",
    paceAdvice: "前慢后快：前期铺垫世界观和修炼体系，中后期节奏加快连续突破",
    tags: ["修炼", "升级", "宗门", "法宝"],
  },
  {
    id: "dushi",
    name: "都市生活",
    emoji: "🏙️",
    icon: "lucide:building-2",
    description: "现代都市、职场商战、情感生活",
    temperature: 0.8,
    stylePrompt: "文风偏写实，对话要自然贴近生活，场景描写要真实具体。人物心理活动细腻，情感表达克制而真实。",
    namingStyle: "现代中文名（如：陈默、林薇、苏晚晴）",
    worldTendency: "现代都市环境，写字楼/公寓/咖啡馆等日常场景",
    paceAdvice: "匀速推进：以日常剧情穿插高潮事件，避免过于平淡",
    tags: ["现代", "职场", "情感", "现实"],
  },
  {
    id: "yanqing",
    name: "言情恋爱",
    emoji: "💕",
    icon: "lucide:heart",
    description: "甜蜜恋爱、虐恋情深、欢喜冤家",
    temperature: 0.9,
    stylePrompt: "情感描写细腻丰富，注重人物互动中的微表情和氛围感。对话要有张力，眼神/动作的描写比直白告白更能打动读者。",
    namingStyle: "唯美风格（如：苏念、顾轻轻、沈墨寒）",
    worldTendency: "以校园/都市为背景，重点在人物关系而非世界设定",
    paceAdvice: "前慢后浓：前期慢热铺垫感情，中期推进关系，后期情感爆发",
    tags: ["恋爱", "甜宠", "虐恋", "校园"],
  },
  {
    id: "kehuan",
    name: "科幻未来",
    emoji: "🚀",
    icon: "lucide:rocket",
    description: "星际文明、人工智能、赛博朋克",
    temperature: 0.85,
    stylePrompt: "科技描写要有一定硬科幻基础（但不需过度解释原理）。世界观可以有独特科技设定，需要保持自洽。文风可冷峻理性或人文关怀两种方向。",
    namingStyle: "科技感/国际化风格（如：Zero、Elena、秦洛、星野）",
    worldTendency: "未来科技世界，包含星际航行/虚拟现实/基因改造等要素",
    paceAdvice: "快慢结合：科技说明慢一些，动作场面快一些",
    tags: ["科幻", "星际", "AI", "赛博"],
  },
  {
    id: "xuanyi",
    name: "悬疑推理",
    emoji: "🔍",
    icon: "lucide:search",
    description: "案件推理、心理悬疑、层层反转",
    temperature: 0.7,
    stylePrompt: "逻辑严密，线索在前剧情在后（不能凭空出现破案关键）。氛围渲染要到位，读者应该有'我早该想到'的感觉。对话包含误导与伏笔。",
    namingStyle: "普通中文名（过于独特的名字容易暴露凶手身份）",
    worldTendency: "现实世界为基础，案件发生环境（警局/小镇/密闭空间）",
    paceAdvice: "先缓后急：前期埋线索节奏可慢，后期揭露真相要紧凑",
    tags: ["推理", "悬疑", "反转", "犯罪"],
  },
  {
    id: "qihuan",
    name: "奇幻冒险",
    emoji: "⚔️",
    icon: "lucide:sword",
    description: "西方奇幻、魔法世界、勇者征程",
    temperature: 0.85,
    stylePrompt: "史诗感文风，场景描写宏大。魔法/种族/世界设定需要系统化和自洽。冒险过程中逐渐揭示世界真相。",
    namingStyle: "西式幻想风格（如：亚瑟、莉安娜、格罗姆）",
    worldTendency: "西式奇幻世界，精灵/矮人/龙族等经典种族",
    paceAdvice: "冒险节奏：以'出发→遇险→成长→决战'为循环",
    tags: ["奇幻", "冒险", "魔法", "史诗"],
  },
  {
    id: "lishi",
    name: "历史穿越",
    emoji: "🏯",
    icon: "lucide:landmark",
    description: "穿越历史、改变命运、王朝争霸",
    temperature: 0.8,
    stylePrompt: "需要一定的历史考据，但不过度拘泥史实。主角利用现代知识改变历史走向要有逻辑。文风可偏文言简练或通俗白话。",
    namingStyle: "古风历史风格（贴合所穿越朝代）",
    worldTendency: "以真实历史朝代为基础，加入架空改写",
    paceAdvice: "前期铺垫现代背景宜快，穿越后的历史改造宜慢推进",
    tags: ["穿越", "历史", "争霸", "权谋"],
  },
  {
    id: "kongbu",
    name: "恐怖灵异",
    emoji: "👻",
    icon: "lucide:ghost",
    description: "灵异惊悚、克苏鲁、心理恐惧",
    temperature: 0.9,
    stylePrompt: "氛围第一，Jump Scare第二。通过环境描写和细节暗示制造不安感。未知比直白展示更可怕。第一人称视角效果更佳。",
    namingStyle: "普通中文名（增强代入感和真实感）",
    worldTendency: "以现实世界为基础，逐渐揭露灵异/超自然层面",
    paceAdvice: "慢热渐强：前期营造氛围，中后期逐步释放恐怖",
    tags: ["恐怖", "灵异", "悬疑", "惊悚"],
  },
];

export const useTemplateStore = defineStore("templates", () => {
  const activeTemplateId = ref<string | null>(
    (() => {
      try {
        return localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    })()
  );

  const allTemplates = computed(() => ALL_TEMPLATES);
  const activeTemplate = computed(() =>
    ALL_TEMPLATES.find((t) => t.id === activeTemplateId.value) || null
  );

  function setTemplate(id: string | null) {
    activeTemplateId.value = id;
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function getTemplate(id: string): NovelTemplate | undefined {
    return ALL_TEMPLATES.find((t) => t.id === id);
  }

  return {
    activeTemplateId,
    allTemplates,
    activeTemplate,
    setTemplate,
    getTemplate,
  };
});
