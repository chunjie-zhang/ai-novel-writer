import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { BUILTIN_SKILLS } from "./definitions";
import type { WritingSkill, SkillCategory } from "./types";
import { SKILL_CATEGORIES } from "./types";
import {
  parseSkillMarkdown,
  serializeSkillMarkdown,
  skillDirName,
} from "@/utils/skillMarkdown";

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
  /** 用户自定义技能（从应用目录加载） */
  const customSkills = ref<WritingSkill[]>([]);
  /** 是否正在加载自定义技能 */
  const isLoading = ref(false);
  /** 技能目录路径 */
  const skillsDir = ref("");

  // ===== 计算属性 =====
  /** 官方内置技能 */
  const builtinSkills = computed(() => BUILTIN_SKILLS);

  /** 当前所有可用技能 = 内置 + 自定义 */
  const allSkills = computed(() => [...builtinSkills.value, ...customSkills.value]);

  /** 当前激活的技能对象 */
  const activeSkill = computed<WritingSkill | null>(() => {
    if (!activeSkillId.value) return null;
    return allSkills.value.find((s) => s.id === activeSkillId.value) ?? null;
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

  // ===== 自定义技能：加载 / 保存 / 删除 / 导入导出 =====

  /** 从应用目录加载所有自定义技能 */
  async function loadCustomSkills() {
    isLoading.value = true;
    try {
      // Rust 返回：{ dirName, content, resources }[]
      const entries = await invoke<
        { dirName: string; content: string; resources?: string[] }[]
      >("list_custom_skills");
      customSkills.value = (entries || []).map((e) => {
        const skill = parseSkillMarkdown(e.content);
        skill.resources = e.resources || [];
        return skill;
      });
    } catch (e) {
      console.error("加载自定义技能失败:", e);
      customSkills.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  /** 保存一个自定义技能到应用目录（新建或覆盖） */
  async function saveCustomSkill(skill: WritingSkill): Promise<WritingSkill> {
    const md = serializeSkillMarkdown(skill);
    const dirName = skillDirName(skill.id);
    await invoke("save_custom_skill", { dirName, content: md });
    // 刷新列表
    await loadCustomSkills();
    // 返回已保存的技能
    return customSkills.value.find((s) => s.id === skill.id) ?? skill;
  }

  /** 从 zip 字节批量导入技能（返回导入的目录名列表） */
  async function importSkillFromZip(zipBytes: Uint8Array | number[]): Promise<string[]> {
    const bytes = Array.from(zipBytes);
    const imported = await invoke<string[]>("import_skill_zip", { zipBytes: bytes });
    await loadCustomSkills();
    return imported;
  }

  /** 删除一个自定义技能 */
  async function deleteCustomSkill(skill: WritingSkill): Promise<void> {
    if (skill.source !== "custom") return;
    const dirName = skillDirName(skill.id);
    try {
      await invoke("delete_custom_skill", { dirName });
    } catch (e) {
      console.error("删除自定义技能失败:", e);
    }
    // 若删除的是当前选中技能，清除选中
    if (activeSkillId.value === skill.id) {
      activeSkillId.value = null;
    }
    await loadCustomSkills();
  }

  /** 获取技能目录路径（展示给用户） */
  async function loadSkillsDir() {
    try {
      skillsDir.value = await invoke<string>("get_skills_dir_path");
    } catch (e) {
      console.error("获取技能目录失败:", e);
    }
  }

  /** 导出技能为 SKILL.md 文本 */
  function exportSkill(skill: WritingSkill): string {
    return serializeSkillMarkdown(skill);
  }

  /** 导出技能为 zip 字节（整个技能目录：SKILL.md + 配套资源） */
  async function exportSkillAsZip(skill: WritingSkill): Promise<Uint8Array> {
    const dirName = skillDirName(skill.id);
    const bytes = await invoke<number[]>("export_skill_zip", { dirName });
    return new Uint8Array(bytes);
  }

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
      enabledSkillIds.value = new Set(allSkills.value.map((s) => s.id));
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
    builtinSkills,
    customSkills,
    categorizedSkills,
    activeCategories,
    filteredSkills,
    isLoading,
    skillsDir,
    selectSkill,
    setCategory,
    setSearch,
    toggleSkill,
    reset,
    loadCustomSkills,
    saveCustomSkill,
    importSkillFromZip,
    deleteCustomSkill,
    loadSkillsDir,
    exportSkill,
    exportSkillAsZip,
  };
});
