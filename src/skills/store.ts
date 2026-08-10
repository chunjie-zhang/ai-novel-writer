import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BUILTIN_SKILLS, getSkillById } from "./definitions";
import type { WritingSkill, SkillCategory } from "./types";
import { SKILL_CATEGORIES } from "./types";

export const useSkillStore = defineStore("skill", () => {
  // ===== 状态 =====
  /** 当前选中的技能 */
  const activeSkillId = ref<string | null>(null);
  /** 用户启用的技能 ID 列表（null = 全部启用） */
  const enabledSkillIds = ref<Set<string> | null>(null);
  /** 搜索关键词 */
  const searchQuery = ref("");
  /** 当前筛选的分类 */
  const activeCategory = ref<SkillCategory | null>(null);

  // ===== 计算属性 =====
  /** 当前所有可用技能（考虑启用/禁用） */
  const allSkills = computed(() => BUILTIN_SKILLS);

  /** 当前激活的技能对象 */
  const activeSkill = computed<WritingSkill | null>(() => {
    if (!activeSkillId.value) return null;
    return getSkillById(activeSkillId.value) ?? null;
  });

  /** 按分类组织的技能（过滤后） */
  const categorizedSkills = computed(() => {
    const filtered = filteredSkills.value;
    const map: Record<string, WritingSkill[]> = {};
    for (const skill of filtered) {
      if (!map[skill.category]) map[skill.category] = [];
      map[skill.category].push(skill);
    }
    return map;
  });

  /** 有技能的已激活分类列表 */
  const activeCategories = computed(() => {
    const cats = Object.keys(categorizedSkills.value) as SkillCategory[];
    return cats
      .filter((c) => categorizedSkills.value[c].length > 0)
      .map((c) => ({
        key: c,
        ...SKILL_CATEGORIES[c],
        count: categorizedSkills.value[c].length,
      }));
  });

  /** 过滤后的技能列表 */
  const filteredSkills = computed(() => {
    let list = allSkills.value;

    // 按分类筛选
    if (activeCategory.value) {
      list = list.filter((s) => s.category === activeCategory.value);
    }

    // 按搜索关键词筛选
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // ===== 方法 =====
  /** 选中一个技能 */
  function selectSkill(skillId: string | null) {
    activeSkillId.value = skillId;
  }

  /** 切换分类筛选 */
  function setCategory(category: SkillCategory | null) {
    activeCategory.value = category;
  }

  /** 设置搜索关键词 */
  function setSearch(query: string) {
    searchQuery.value = query;
  }

  /** 切换技能启用状态 */
  function toggleSkill(skillId: string) {
    if (!enabledSkillIds.value) {
      // 首次切换：初始化集合
      enabledSkillIds.value = new Set(BUILTIN_SKILLS.map((s) => s.id));
    }
    if (enabledSkillIds.value.has(skillId)) {
      enabledSkillIds.value.delete(skillId);
    } else {
      enabledSkillIds.value.add(skillId);
    }
  }

  /** 重置为默认状态 */
  function reset() {
    activeSkillId.value = null;
    enabledSkillIds.value = null;
    searchQuery.value = "";
    activeCategory.value = null;
  }

  return {
    activeSkillId,
    activeSkill,
    searchQuery,
    activeCategory,
    allSkills,
    categorizedSkills,
    activeCategories,
    filteredSkills,
    selectSkill,
    setCategory,
    setSearch,
    toggleSkill,
    reset,
  };
});
