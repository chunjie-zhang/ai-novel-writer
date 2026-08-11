<template>
  <div class="skill-market-page">
    <!-- 页头 -->
    <div class="smp-header">
      <div class="smp-header-left">
        <el-button text circle @click="goBack" title="返回">
          <el-icon><Icon icon="lucide:arrow-left" /></el-icon>
        </el-button>
        <span class="smp-title"><el-icon><Icon icon="lucide:store" /></el-icon> 技能市场</span>
        <span class="smp-subtitle">浏览、安装与使用写作技能</span>
      </div>
      <div class="smp-header-right">
        <el-input
          v-model="searchQuery"
          placeholder="搜索技能..."
          clearable
          prefix-icon="Search"
          class="smp-search"
          size="default"
        />
        <el-button type="primary" @click="importFromFile">
          <el-icon><Icon icon="lucide:file-archive" /></el-icon> 导入技能包 (.zip)
        </el-button>
        <el-tooltip content="打开技能存储目录" placement="bottom">
          <el-button @click="openSkillsDir">
            <el-icon><Icon icon="lucide:folder-open" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 存储目录 -->
    <div v-if="skillStore.skillsDir" class="smp-dir">
      存储目录：<code class="smp-dir-path">{{ skillStore.skillsDir }}</code>
    </div>

    <!-- 分类筛选 -->
    <div class="smp-cats">
      <el-tag
        :type="activeCategory === null ? 'primary' : 'info'"
        effect="plain"
        class="smp-cat-tag"
        @click="activeCategory = null"
      >全部 <span class="smp-cat-count">{{ allFiltered.length }}</span></el-tag>
      <el-tag
        v-for="cat in SKILL_CATEGORIES_ARR"
        :key="cat.key"
        :type="activeCategory === cat.key ? 'primary' : 'info'"
        effect="plain"
        class="smp-cat-tag"
        @click="activeCategory = activeCategory === cat.key ? null : cat.key"
      >
        <el-icon :size="14" style="vertical-align:-2px"><Icon :icon="cat.icon" /></el-icon> {{ cat.label }}
        <span class="smp-cat-count">{{ categoryCount(cat.key) }}</span>
      </el-tag>
    </div>

    <!-- 内容 -->
    <div class="smp-body">
      <!-- 官方技能（商店货架） -->
      <section class="smp-section">
        <div class="smp-section-head">
          <span class="smp-section-title">
            <el-icon><Icon icon="lucide:shield-check" /></el-icon> 官方技能
          </span>
          <span class="smp-section-desc">由平台提供，稳定维护，随应用更新</span>
          <span class="smp-count">{{ filteredBuiltin.length }}</span>
        </div>

        <div v-if="filteredBuiltin.length === 0" class="smp-empty">
          <el-empty description="没有匹配的官方技能" :image-size="80" />
        </div>

        <div v-else class="smp-grid">
          <div
            v-for="skill in filteredBuiltin"
            :key="skill.id"
            class="smp-card"
            :class="{ active: skillStore.activeSkillIds.includes(skill.id) }"
          >
            <div class="smp-card-top">
              <div class="smp-card-icon">
                <Icon v-if="skill.icon" :icon="skill.icon" :width="26" :height="26" />
                <span v-else>{{ skill.emoji }}</span>
              </div>
              <div class="smp-card-name">{{ skill.name }}</div>
              <el-tag size="small" type="primary" effect="plain" class="smp-source-tag">官方</el-tag>
            </div>
            <div class="smp-card-desc">{{ skill.description }}</div>
            <div class="smp-card-tags">
              <el-tag v-for="t in skill.tags.slice(0, 3)" :key="t" size="small" class="smp-tag">{{ t }}</el-tag>
            </div>
            <div class="smp-card-foot">
              <span class="smp-card-cat">
                <el-icon :size="13" style="vertical-align:-2px"><Icon :icon="SKILL_CATEGORIES[skill.category]?.icon" /></el-icon>
                {{ SKILL_CATEGORIES[skill.category]?.label }}
              </span>
              <el-button
                size="small"
                :type="skillStore.activeSkillIds.includes(skill.id) ? 'success' : 'primary'"
                :plain="!skillStore.activeSkillIds.includes(skill.id)"
                @click="applySkill(skill)"
              >
                {{ skillStore.activeSkillIds.includes(skill.id) ? '使用中' : '使用' }}
              </el-button>
            </div>
          </div>
        </div>
      </section>

      <!-- 用户自定义技能 -->
      <section class="smp-section">
        <div class="smp-section-head">
          <span class="smp-section-title">
            <el-icon><Icon icon="lucide:users" /></el-icon> 我的技能
          </span>
          <span class="smp-section-desc">导入的技能包 / 自定义技能</span>
          <span class="smp-count">{{ filteredCustom.length }}</span>
        </div>

        <div v-if="filteredCustom.length === 0" class="smp-empty">
          <el-empty description="还没有自定义技能，点击右上角「导入技能包」安装" :image-size="80" />
        </div>

        <div v-else class="smp-grid">
          <div
            v-for="skill in filteredCustom"
            :key="skill.id"
            class="smp-card smp-card-custom"
            :class="{ active: skillStore.activeSkillIds.includes(skill.id) }"
          >
            <div class="smp-card-top">
              <div class="smp-card-icon">
                <Icon v-if="skill.icon" :icon="skill.icon" :width="26" :height="26" />
                <span v-else>{{ skill.emoji }}</span>
              </div>
              <div class="smp-card-name">{{ skill.name }}</div>
              <el-tag size="small" type="warning" effect="plain" class="smp-source-tag">自定义</el-tag>
            </div>
            <div class="smp-card-desc">{{ skill.description }}</div>
            <div class="smp-card-meta">
              <span v-if="skill.author">作者：{{ skill.author }}</span>
              <span v-if="skill.version">v{{ skill.version }}</span>
              <span v-if="skill.resources && skill.resources.length">{{ skill.resources.length }} 个资源</span>
            </div>
            <div class="smp-card-foot">
              <div class="smp-card-ops">
                <el-tooltip content="导出为技能包 (.zip)" placement="top">
                  <el-button size="small" text @click="exportSkill(skill)">
                    <el-icon><Icon icon="lucide:download" /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="删除该技能" placement="top">
                  <el-button size="small" text type="danger" @click="removeSkill(skill)">
                    <el-icon><Icon icon="lucide:trash-2" /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
              <el-button
                size="small"
                :type="skillStore.activeSkillIds.includes(skill.id) ? 'success' : 'primary'"
                :plain="!skillStore.activeSkillIds.includes(skill.id)"
                @click="applySkill(skill)"
              >
                {{ skillStore.activeSkillIds.includes(skill.id) ? '使用中' : '使用' }}
              </el-button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 说明 -->
    <div class="smp-footnote">
      <el-icon><Icon icon="lucide:info" /></el-icon>
      <span>技能以「技能包」形式分发：一个 .zip 包内含一个或多个技能目录，每个技能目录包含 SKILL.md 定义及配套脚本/资源。导入 / 导出均为 .zip，可直接分享给其他用户安装。使用技能后，回到右侧 AI 助手的输入框即可生效。</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { Icon } from "@iconify/vue";
import { useSkillStore } from "@/skills/store";
import { SKILL_CATEGORIES } from "@/skills/types";
import type { WritingSkill, SkillCategory } from "@/skills/types";

const router = useRouter();
const skillStore = useSkillStore();

const searchQuery = ref("");
const activeCategory = ref<SkillCategory | null>(null);

const SKILL_CATEGORIES_ARR = (Object.keys(SKILL_CATEGORIES) as SkillCategory[]).map((key) => ({
  key,
  ...SKILL_CATEGORIES[key],
}));

/** 按当前分类 + 搜索过滤 */
function filterSkills(list: WritingSkill[]): WritingSkill[] {
  let result = list;
  if (activeCategory.value) {
    result = result.filter((s) => s.category === activeCategory.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }
  return result;
}

const allFiltered = computed(() => filterSkills(skillStore.allSkills));
const filteredBuiltin = computed(() => filterSkills(skillStore.builtinSkills));
const filteredCustom = computed(() => filterSkills(skillStore.customSkills));

function categoryCount(cat: SkillCategory): number {
  const list = skillStore.allSkills.filter((s) => s.category === cat);
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list.length;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q))
  ).length;
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

/** 应用技能：加入当前激活技能（可多选，再次点击取消） */
function applySkill(skill: WritingSkill) {
  skillStore.selectSkill(skill.id);
  const isActive = skillStore.activeSkillIds.includes(skill.id);
  ElMessage.success(isActive ? `已启用技能「${skill.name}」，在 AI 助手中生效` : `已取消技能「${skill.name}」`);
}

/** 从本地 zip 技能包导入（一个 zip = 一个或多个技能目录） */
async function importFromFile() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({
      multiple: false,
      filters: [{ name: "技能包 (.zip)", extensions: ["zip"] }],
      title: "选择技能包 (.zip)",
    });
    if (!selected || Array.isArray(selected)) return;
    const path = selected as string;
    const bytes = await readFile(path);
    const imported = await skillStore.importSkillFromZip(bytes);
    ElMessage.success(`成功导入 ${imported.length} 个技能：${imported.join("、")}`);
  } catch (e) {
    console.error("导入技能包失败:", e);
    ElMessage.error("导入失败，请选择正确的 .zip 技能包");
  }
}

/** 导出技能为 zip 技能包（整个技能目录：SKILL.md + 配套资源） */
async function exportSkill(skill: WritingSkill) {
  try {
    const zipBytes = await skillStore.exportSkillAsZip(skill);
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: `${skill.id}.zip`,
      filters: [{ name: "技能包 (.zip)", extensions: ["zip"] }],
    });
    if (path) {
      await writeFile(path, zipBytes);
      ElMessage.success("技能包导出成功");
    }
  } catch (e) {
    console.error("导出技能包失败:", e);
    ElMessage.error("导出技能包失败");
  }
}

/** 删除自定义技能 */
async function removeSkill(skill: WritingSkill) {
  try {
    await ElMessageBox.confirm(
      `确定删除自定义技能「${skill.name}」吗？此操作不可恢复。`,
      "删除技能",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  await skillStore.deleteCustomSkill(skill);
  ElMessage.success("技能已删除");
}

/** 打开技能目录 */
async function openSkillsDir() {
  ElMessage.info(`技能目录：${skillStore.skillsDir || "（未加载）"}`);
}
</script>

<style scoped>
.skill-market-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  overflow: hidden;
}

/* ===== 页头 ===== */
.smp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
  background: var(--panel-bg);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.smp-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.smp-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
}

.smp-title .el-icon {
  color: var(--accent);
}

.smp-subtitle {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}

.smp-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.smp-search {
  width: 220px;
}

/* ===== 存储目录 ===== */
.smp-dir {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 20px 0;
  flex-shrink: 0;
}

.smp-dir-path {
  background: var(--panel-bg-2);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 480px;
}

/* ===== 分类筛选 ===== */
.smp-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 12px 20px 4px;
  flex-shrink: 0;
}

.smp-cat-tag {
  cursor: pointer;
}

.smp-cat-count {
  font-size: 11px;
  opacity: 0.65;
  margin-left: 3px;
}

/* ===== 内容 ===== */
.smp-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.smp-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.smp-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.smp-section-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.smp-section-title .el-icon {
  color: var(--accent);
}

.smp-section-desc {
  font-size: 12px;
  color: var(--text-3);
  flex: 1;
}

.smp-count {
  font-size: 12px;
  color: var(--text-3);
  background: var(--panel-bg-2);
  padding: 1px 8px;
  border-radius: 10px;
}

/* ===== 卡片网格（商店货架） ===== */
.smp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.smp-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel-bg);
  transition: all 0.18s;
}

.smp-card:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.smp-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.smp-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.smp-card-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 8px;
  font-size: 18px;
}

.smp-card-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smp-source-tag {
  flex-shrink: 0;
}

.smp-card-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
  min-height: 36px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.smp-card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.smp-tag {
  font-size: 10px !important;
  height: auto !important;
  line-height: 1.4 !important;
  padding: 0 4px !important;
}

.smp-card-meta {
  font-size: 11px;
  color: var(--text-3);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.smp-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 4px;
}

.smp-card-cat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-3);
}

.smp-card-ops {
  display: flex;
  gap: 2px;
}

/* ===== 空状态 / 说明 ===== */
.smp-empty {
  padding: 12px 0;
}

.smp-footnote {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--accent-soft);
  padding: 10px 16px;
  border-radius: 8px;
  line-height: 1.6;
  margin: 0 20px 16px;
  flex-shrink: 0;
}

.smp-footnote .el-icon {
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}
</style>
