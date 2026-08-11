<template>
  <el-dialog v-model="visible" width="720px" :close-on-click-modal="false">
    <template #header>
      <span class="dlg-title"><el-icon><Icon icon="lucide:store" /></el-icon> 技能市场</span>
    </template>

    <div class="sm-content">
      <!-- 顶部操作区 -->
      <div class="sm-actions">
        <el-button type="primary" @click="importFromFile">
          <el-icon><Icon icon="lucide:file-archive" /></el-icon> 导入技能包 (.zip)
        </el-button>
        <el-tooltip content="打开技能存储目录" placement="top">
          <el-button @click="openSkillsDir">
            <el-icon><Icon icon="lucide:folder-open" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
      <div v-if="skillStore.skillsDir" class="sm-dir">
        存储目录：<code class="sm-dir-path">{{ skillStore.skillsDir }}</code>
      </div>

      <!-- 官方内置技能 -->
      <div class="sm-section">
        <div class="sm-section-title">
          <el-icon><Icon icon="lucide:shield-check" /></el-icon>
          官方内置技能
          <span class="sm-count">{{ skillStore.builtinSkills.length }}</span>
        </div>
        <div class="sm-desc">由平台提供，稳定维护，随应用更新。不可删除。</div>
      </div>

      <!-- 用户自定义技能 -->
      <div class="sm-section">
        <div class="sm-section-title">
          <el-icon><Icon icon="lucide:users" /></el-icon>
          用户上传 / 自定义技能
          <span class="sm-count">{{ skillStore.customSkills.length }}</span>
        </div>

        <div v-if="skillStore.customSkills.length === 0" class="sm-empty">
          <el-empty description="还没有自定义技能，点击上方按钮导入或创建" :image-size="60" />
        </div>

        <div v-else class="sm-skill-list">
          <div v-for="skill in skillStore.customSkills" :key="skill.id" class="sm-skill-item">
            <div class="sm-skill-icon">
              <Icon v-if="skill.icon" :icon="skill.icon" :width="20" :height="20" />
              <span v-else>{{ skill.emoji }}</span>
            </div>
            <div class="sm-skill-body">
              <div class="sm-skill-name">{{ skill.name }}</div>
              <div class="sm-skill-desc">{{ skill.description }}</div>
              <div v-if="skill.author || skill.version" class="sm-skill-meta">
                <span v-if="skill.author">作者：{{ skill.author }}</span>
                <span v-if="skill.version">v{{ skill.version }}</span>
              </div>
              <div v-if="skill.resources && skill.resources.length" class="sm-skill-res">
                <el-icon><Icon icon="lucide:folder" /></el-icon>
                <span v-for="r in skill.resources" :key="r" class="sm-res-tag">{{ r }}</span>
              </div>
            </div>
            <div class="sm-skill-ops">
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
          </div>
        </div>
      </div>

      <!-- 说明 -->
      <div class="sm-footnote">
        <el-icon><Icon icon="lucide:info" /></el-icon>
        技能以「技能包」形式分发：一个 .zip 包内含一个或多个技能目录，每个技能目录包含 SKILL.md 定义及配套脚本/资源。导入 / 导出均为 .zip，可直接分享给其他用户安装。未来将支持在线技能市场一键安装。
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from "element-plus";
import { Icon } from "@iconify/vue";
import { useSkillStore } from "@/skills/store";
import type { WritingSkill } from "@/skills/types";

const visible = defineModel<boolean>("visible");
const skillStore = useSkillStore();

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
  // 展示目录给用户（Tauri 桌面端可在此处调用系统打开目录，这里先展示路径）
  ElMessage.info(`技能目录：${skillStore.skillsDir || "（未加载）"}`);
}
</script>

<style scoped>
.sm-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sm-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sm-dir {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sm-dir-path {
  background: var(--panel-bg-2);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 460px;
}

.sm-section {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--panel-bg-2);
}

.sm-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 4px;
}

.sm-section-title .el-icon {
  color: var(--accent);
}

.sm-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-3);
  background: var(--panel-bg);
  padding: 0 8px;
  border-radius: 10px;
}

.sm-desc {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}

.sm-empty {
  padding: 8px 0;
}

.sm-skill-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 260px;
  overflow-y: auto;
}

.sm-skill-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-bg);
}

.sm-skill-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent);
}

.sm-skill-body {
  flex: 1;
  min-width: 0;
}

.sm-skill-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.sm-skill-desc {
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-skill-meta {
  font-size: 11px;
  color: var(--text-3);
  display: flex;
  gap: 10px;
  margin-top: 2px;
}

.sm-skill-res {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
  flex-wrap: wrap;
}

.sm-skill-res .el-icon {
  color: var(--accent);
}

.sm-res-tag {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 5px;
  font-size: 10px;
  color: var(--text-2);
}

.sm-skill-ops {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.sm-footnote {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
  background: var(--accent-soft);
  padding: 8px 12px;
  border-radius: 8px;
  line-height: 1.5;
}

.sm-footnote .el-icon {
  color: var(--accent);
  margin-top: 2px;
}
</style>
