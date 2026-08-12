<template>
  <div class="project-tree">
    <div class="tree-header" data-tauri-drag-region="deep">
      <span class="tree-title">项目列表</span>
      <div class="tree-header-actions">
        <el-tooltip content="大纲管理" placement="bottom">
          <el-button text size="small" @click="showOutline = !showOutline" :type="showOutline ? 'primary' : ''">
            <el-icon><Icon icon="lucide:list-tree" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="备份管理" placement="bottom">
          <el-button text size="small" @click="showBackup = !showBackup" :type="showBackup ? 'primary' : ''">
            <el-icon><Icon icon="lucide:database-backup" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="新建项目" placement="bottom">
          <el-button text size="small" @click="$emit('createProject')">
            <el-icon><Icon icon="lucide:folder-plus" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 大纲面板 -->
    <div v-if="showOutline" class="outline-section">
      <OutlinePanel @close="showOutline = false" />
    </div>

    <!-- 备份面板 -->
    <div v-if="showBackup" class="outline-section">
      <BackupManager :project-id="projectStore.currentProject?.id || ''" />
    </div>

    <!-- 项目列表 -->
    <div v-if="projectStore.projects.length === 0" class="empty-state">
      <el-icon :size="40" color="var(--text-3)"><Icon icon="lucide:folder-open" /></el-icon>
      <p>暂无项目</p>
      <el-button type="primary" size="small" @click="$emit('createProject')">
        新建项目
      </el-button>
    </div>

    <el-menu
      v-else
      :default-openeds="openMenus"
      @select="handleSelect"
      class="tree-menu"
    >
      <template v-for="proj in projectStore.projects" :key="proj.id">
        <el-sub-menu
          :index="proj.id"
          :class="{ 'proj-active': projectStore.currentProject?.id === proj.id }"
        >
          <template #title>
            <div
              class="project-node"
              :class="{ active: projectStore.currentProject?.id === proj.id }"
              @click="handleProjectNodeClick(proj)"
            >
              <el-icon><Icon icon="lucide:folder" /></el-icon>
              <span class="node-name">{{ proj.name }}</span>
              <span class="node-date">{{ formatDate(proj.updated_at) }}</span>
              <el-tooltip content="更改存储位置" placement="top">
                <el-button
                  text
                  size="small"
                  class="node-move-btn"
                  @click.stop="handleMoveProject(proj)"
                >
                  <el-icon><Icon icon="lucide:folder-input" /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除小说" placement="top">
                <el-button
                  text
                  size="small"
                  class="node-del-btn"
                  @click.stop="handleDeleteProject(proj)"
                >
                  <el-icon><Icon icon="lucide:trash-2" /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </template>

          <!-- 小说功能（收起到可折叠分组，放在章节上方，避免上千章时被挤到最底部找不到） -->
          <el-sub-menu :index="`${proj.id}:__features__`">
            <template #title>
              <el-icon><Icon icon="lucide:layers" /></el-icon>
              <span>小说功能</span>
            </template>

            <!-- 角色管理 -->
            <el-menu-item :index="`${proj.id}:__characters__`">
              <el-icon><Icon icon="lucide:users" /></el-icon>
              <span>角色管理</span>
            </el-menu-item>

            <!-- 世界观 -->
            <el-menu-item :index="`${proj.id}:__world__`">
              <el-icon><Icon icon="lucide:globe" /></el-icon>
              <span>世界观设定</span>
            </el-menu-item>

            <el-menu-item :index="`${proj.id}:__report__`">
              <el-icon><Icon icon="lucide:bar-chart-3" /></el-icon>
              <span>写作报表</span>
            </el-menu-item>
            <el-menu-item :index="`${proj.id}:__plot__`">
              <el-icon><Icon icon="lucide:alert-triangle" /></el-icon>
              <span>伏笔管理</span>
            </el-menu-item>
            <el-menu-item :index="`${proj.id}:__search__`">
              <el-icon><Icon icon="lucide:search" /></el-icon>
              <span>全文搜索</span>
            </el-menu-item>
            <el-menu-item :index="`${proj.id}:__qa__`">
              <el-icon><Icon icon="lucide:message-circle-question-mark" /></el-icon>
              <span>全书问答</span>
            </el-menu-item>
            <el-menu-item :index="`${proj.id}:__novel_info__`">
              <el-icon><Icon icon="lucide:book-open" /></el-icon>
              <span>小说信息</span>
            </el-menu-item>
            <el-menu-item :index="`${proj.id}:__templates__`">
              <el-icon><Icon icon="lucide:layout-template" /></el-icon>
              <span>题材模板</span>
            </el-menu-item>
          </el-sub-menu>

          <!-- 章节列表（收纳进可折叠「章节」文件夹，避免上千章平铺太散） -->
          <el-sub-menu :index="`${proj.id}:__chapters__`" class="chapters-submenu">
            <template #title>
              <el-icon><Icon icon="lucide:folder" /></el-icon>
              <span>章节</span>
              <span class="chapters-count">{{ getChapters(proj.id).length }}章</span>
              <el-tooltip content="新建卷" placement="top">
                <el-button
                  text
                  size="small"
                  class="add-volume-btn"
                  @mousedown.stop
                  @click.stop="handleAddVolume(proj)"
                >
                  <el-icon><Icon icon="lucide:plus" /></el-icon>
                </el-button>
              </el-tooltip>
            </template>
            <template v-for="g in getChapterGroups(proj.id)" :key="g || '__root__'">
              <el-menu-item-group v-if="g">
                <template #title>
                  <span class="group-title-text">{{ g }}</span>
                  <el-tooltip content="删除卷（含卷内所有章节）" placement="top">
                    <el-button
                      text
                      size="small"
                      class="group-del-btn"
                      @click.stop="handleDeleteGroup(proj, g)"
                    >
                      <el-icon><Icon icon="lucide:trash-2" /></el-icon>
                    </el-button>
                  </el-tooltip>
                </template>
                <el-menu-item
                  v-for="chapter in getGroupChapters(proj.id, g)"
                  :key="chapter.file_name"
                  :index="`${proj.id}:${chapter.file_name}`"
                >
                  <el-icon><Icon icon="lucide:file-text" /></el-icon>
                  <span class="chapter-name">{{ chapter.title }}</span>
                  <span class="chapter-words">{{ chapter.word_count }}字</span>
                  <el-tooltip content="删除章节" placement="top">
                    <el-button
                      text
                      size="small"
                      class="chapter-del-btn"
                      @click.stop="handleDeleteChapter(proj, chapter)"
                    >
                      <el-icon><Icon icon="lucide:trash-2" /></el-icon>
                    </el-button>
                  </el-tooltip>
                </el-menu-item>
              </el-menu-item-group>
              <!-- 未分组的章节直接平铺展示 -->
              <el-menu-item
                v-for="chapter in getGroupChapters(proj.id, g)"
                v-else
                :key="chapter.file_name"
                :index="`${proj.id}:${chapter.file_name}`"
              >
                <el-icon><Icon icon="lucide:file-text" /></el-icon>
                <span class="chapter-name">{{ chapter.title }}</span>
                <span class="chapter-words">{{ chapter.word_count }}字</span>
                <el-tooltip content="删除章节" placement="top">
                  <el-button
                    text
                    size="small"
                    class="chapter-del-btn"
                    @click.stop="handleDeleteChapter(proj, chapter)"
                  >
                    <el-icon><Icon icon="lucide:trash-2" /></el-icon>
                  </el-button>
                </el-tooltip>
              </el-menu-item>
            </template>
          </el-sub-menu>
        </el-sub-menu>
      </template>
    </el-menu>

    <!-- 报表对话框 -->
    <WritingReport v-model:visible="showReport" />

    <!-- 伏笔管理对话框 -->
    <PlotHoleDialog v-model:visible="showPlotHoles" />

    <!-- 角色管理对话框 -->
    <el-dialog v-model="showCharacters" title="角色管理" width="700px" destroy-on-close>
      <CharacterManager
        :characters="projectStore.currentProject ? projectStore.currentStructure?.characters || [] : []"
        :project-id="projectStore.currentProject?.id || ''"
        @save="handleCharacterSave"
        @delete="handleCharacterDelete"
      />
    </el-dialog>

    <!-- 搜索对话框 -->
    <SearchDialog v-model:visible="showSearch" />

    <!-- 全书问答对话框 -->
    <NovelQA
      v-model:visible="showQA"
      :project-id="projectStore.currentProject?.id || ''"
    />

    <!-- 小说信息对话框 -->
    <NovelInfoDialog v-model:visible="showNovelInfo" />

    <!-- 题材模板对话框 -->
    <TemplateSelector v-model:visible="showTemplates" />

    <!-- 世界观对话框 -->
    <el-dialog v-model="showWorld" title="世界观设定" width="650px" destroy-on-close>
      <WorldSetting
        :world-setting="projectStore.currentProject ? projectStore.currentStructure?.world_setting || null : null"
        @save="handleWorldSave"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { useVersionsStore } from "@/stores/versions";
import { invoke } from "@tauri-apps/api/core";
import OutlinePanel from "@/components/novel/OutlinePanel.vue";
import BackupManager from "@/components/novel/BackupManager.vue";
import WritingReport from "@/components/novel/WritingReport.vue";
import PlotHoleDialog from "@/components/novel/PlotHoleDialog.vue";
import CharacterManager from "@/components/novel/CharacterManager.vue";
import WorldSetting from "@/components/novel/WorldSetting.vue";
import SearchDialog from "@/components/novel/SearchDialog.vue";
import NovelQA from "@/components/novel/NovelQA.vue";
import NovelInfoDialog from "@/components/novel/NovelInfoDialog.vue";
import TemplateSelector from "@/components/novel/TemplateSelector.vue";

defineEmits<{
  createProject: [];
}>();

const showOutline = ref(false);
const showBackup = ref(false);
const showReport = ref(false);
const showPlotHoles = ref(false);
const showCharacters = ref(false);
const showWorld = ref(false);
const showSearch = ref(false);
const showQA = ref(false);
const showNovelInfo = ref(false);
const showTemplates = ref(false);

const projectStore = useProjectStore();
const editorStore = useEditorStore();
const openMenus = ref<string[]>([]);
// 初始化时自动展开已打开的项目（「章节」文件夹默认折叠收纳，点开才显示章节）
if (projectStore.currentProject?.id) {
  openMenus.value = [projectStore.currentProject.id];
}

// 缓存每个项目的章节列表
const chaptersCache = ref<Record<string, any[]>>({});

function getChapters(projectId: string) {
  if (projectStore.currentProject?.id === projectId) {
    return projectStore.chapters;
  }
  return chaptersCache.value[projectId] || [];
}

/** 章节分组列表（保持出现顺序，未分组为 ""；包含已创建的空卷） */
function getChapterGroups(projectId: string) {
  const groups: string[] = [];
  const seen = new Set<string>();
  // 已创建的卷（仅当前项目，含空卷）
  if (projectId === projectStore.currentProject?.id) {
    for (const g of projectStore.groups) {
      if (g && !seen.has(g)) {
        seen.add(g);
        groups.push(g);
      }
    }
  }
  // 章节中实际出现的分组
  for (const c of getChapters(projectId)) {
    const g = c.group || "";
    if (!seen.has(g)) {
      seen.add(g);
      groups.push(g);
    }
  }
  return groups;
}

/** 某个分组下的章节 */
function getGroupChapters(projectId: string, group: string) {
  return getChapters(projectId).filter((c) => (c.group || "") === group);
}

/** 确保打开指定项目 */
async function ensureOpen(projectId: string) {
  if (projectStore.currentProject?.id !== projectId) {
    await projectStore.openProject(projectId);
  }
  // 展开项目节点（「章节」文件夹保持折叠收纳，由用户点击展开）
  if (!openMenus.value.includes(projectId)) {
    openMenus.value.push(projectId);
  }
}

/** 点击小说节点标题：直接打开/选中该小说（不阻止菜单展开） */
async function handleProjectNodeClick(proj: any) {
  await ensureOpen(proj.id);
}

/** 新建卷：在 chapters/ 下创建一个空卷目录 */
async function handleAddVolume(proj: any) {
  try {
    const { value } = await ElMessageBox.prompt(
      "输入新卷名称（如：第一卷 / 第二卷），创建后可往卷里新建章节。",
      "新建卷",
      {
        confirmButtonText: "创建",
        cancelButtonText: "取消",
        inputValue: `第${projectStore.groups.length + 1}卷`,
        inputPlaceholder: "如：第一卷",
      }
    );
    if (!value || !value.trim()) return;
    await invoke("create_group", {
      projectId: proj.id,
      group: value.trim(),
    });
    ElMessage.success(`已创建卷「${value.trim()}」`);
    await projectStore.openProject(proj.id);
  } catch {
    // 用户取消
  }
}

/** 删除单个章节（带确认） */
async function handleDeleteChapter(proj: any, chapter: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除章节「${chapter.title}」吗？此操作不可恢复。`,
      "删除章节",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    await invoke("delete_chapter", {
      projectId: proj.id,
      fileName: chapter.file_name,
    });
    // 同步清理该章节的历史版本
    useVersionsStore().clearChapter(proj.id, chapter.file_name);
    // 若删除的是当前正在编辑的章节，关闭编辑器并清空内容
    if (editorStore.currentChapter?.file_name === chapter.file_name) {
      editorStore.closeChapter();
    }
    ElMessage.success(`已删除章节「${chapter.title}」`);
    await projectStore.openProject(proj.id);
  } catch (e) {
    ElMessage.error("删除章节失败: " + e);
  }
}

/** 删除整个卷（含卷内所有章节，带确认） */
async function handleDeleteGroup(proj: any, group: string) {
  const count = getGroupChapters(proj.id, group).length;
  try {
    await ElMessageBox.confirm(
      `确定删除卷「${group}」吗？将同时删除卷内 ${count} 个章节，此操作不可恢复！`,
      "删除卷",
      { type: "error", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  try {
    // 清理卷内所有章节的历史版本
    for (const c of getGroupChapters(proj.id, group)) {
      useVersionsStore().clearChapter(proj.id, c.file_name);
    }
    // 若当前编辑章节在卷内，关闭编辑器并清空内容
    const deletedNames = new Set(
      getGroupChapters(proj.id, group).map((c) => c.file_name)
    );
    if (editorStore.currentChapter && deletedNames.has(editorStore.currentChapter.file_name)) {
      editorStore.closeChapter();
    }
    await invoke("delete_group", { projectId: proj.id, group });
    ElMessage.success(`已删除卷「${group}」`);
    await projectStore.openProject(proj.id);
  } catch (e) {
    ElMessage.error("删除卷失败: " + e);
  }
}

async function handleSelect(index: string) {
  const [projectId, ...rest] = index.split(":");
  const key = rest.join(":");

  // 展开当前项目菜单
  if (!openMenus.value.includes(projectId)) {
    openMenus.value.push(projectId);
  }

  // 小说专属功能：先确保打开该项目，再弹出对应面板
  if (key === "__characters__") { await ensureOpen(projectId); showCharacters.value = true; return; }
  if (key === "__world__") { await ensureOpen(projectId); showWorld.value = true; return; }
  if (key === "__report__") { await ensureOpen(projectId); showReport.value = true; return; }
  if (key === "__plot__") { await ensureOpen(projectId); showPlotHoles.value = true; return; }
  if (key === "__search__") { await ensureOpen(projectId); showSearch.value = true; return; }
  if (key === "__qa__") { await ensureOpen(projectId); showQA.value = true; return; }
  if (key === "__novel_info__") { await ensureOpen(projectId); showNovelInfo.value = true; return; }
  if (key === "__templates__") { await ensureOpen(projectId); showTemplates.value = true; return; }

  // 打开章节
  await ensureOpen(projectId);

  // 找到章节并读取内容
  const chapter = projectStore.chapters.find((c) => c.file_name === key);
  if (chapter) {
    try {
      const content = await invoke<string>("read_chapter", {
        projectId,
        fileName: key,
      });
      editorStore.openChapterWithMemory(chapter, content, projectId);
    } catch (e) {
      console.error("读取章节失败:", e);
    }
  }
}

/** 删除小说项目（永久删除，带确认） */
async function handleDeleteProject(proj: any) {
  try {
    await ElMessageBox.confirm(
      `确定删除小说「${proj.name}」吗？\n\n此操作将永久删除该小说的所有章节、角色、世界观等数据，无法恢复！`,
      "删除确认",
      { confirmButtonText: "永久删除", cancelButtonText: "取消", type: "error", confirmButtonClass: "el-button--danger" }
    );
  } catch {
    return;
  }

  try {
    await projectStore.deleteProject(proj.id);
    useVersionsStore().clearProject(proj.id);
    ElMessage.success(`已删除小说「${proj.name}」`);
  } catch (e) {
    ElMessage.error("删除失败: " + e);
  }
}

/** 迁移已有项目到新的存储位置 */
async function handleMoveProject(proj: any) {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: `选择「${proj.name}」的新存储目录`,
    });
    if (!selected) return;

    const target = selected as string;
    try {
      await ElMessageBox.confirm(
        `将把项目「${proj.name}」迁移到：\n\n${target}\n\n迁移后原位置文件会被移动。是否继续？`,
        "确认迁移位置",
        { confirmButtonText: "开始迁移", cancelButtonText: "取消", type: "warning" }
      );
    } catch {
      return;
    }

    await projectStore.moveProject(proj.id, target);
    ElMessage.success(`项目「${proj.name}」已迁移到新位置`);
  } catch (e) {
    ElMessage.error("迁移失败: " + e);
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return dateStr.slice(0, 10);
}

async function handleCharacterSave(char: any) {
  if (!projectStore.currentProject) return;
  try {
    await invoke("save_character", {
      projectId: projectStore.currentProject.id,
      character: char,
    });
    // 刷新
    await projectStore.openProject(projectStore.currentProject.id);
  } catch (e) {
    console.error("保存角色失败:", e);
  }
}

async function handleCharacterDelete(id: string) {
  if (!projectStore.currentProject) return;
  try {
    await invoke("delete_character", {
      projectId: projectStore.currentProject.id,
      characterId: id,
    });
    await projectStore.openProject(projectStore.currentProject.id);
  } catch (e) {
    console.error("删除角色失败:", e);
  }
}

async function handleWorldSave(world: any) {
  if (!projectStore.currentProject) return;
  try {
    await invoke("save_world", {
      projectId: projectStore.currentProject.id,
      worldSetting: world,
    });
    await projectStore.openProject(projectStore.currentProject.id);
  } catch (e) {
    console.error("保存世界观失败:", e);
  }
}
</script>

<style scoped>
.project-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  /* Windows/Linux 用：WebKit 专属拖拽（macOS 走 data-tauri-drag-region="deep"） */
  -webkit-app-region: drag;
}

/* 头部按钮不被拖拽拦截 */
.tree-header .el-button {
  -webkit-app-region: no-drag;
}

.tree-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 4px;
  min-width: 0;
  flex-shrink: 1;
}

.tree-header-actions :deep(.el-button) {
  --el-button-bg-color: transparent;
  --el-button-hover-bg-color: var(--panel-hover);
  --el-button-hover-text-color: var(--accent);
  border-radius: 8px;
  transition: all 0.2s ease;
  font-size: 15px;
  width: 28px;
  height: 28px;
  padding: 0;
}

.tree-header-actions :deep(.el-button:hover) {
  transform: scale(1.1);
  background: var(--panel-hover);
}

.tree-header-actions :deep(.el-button.is-active),
.tree-header-actions :deep(.el-button:active) {
  background: var(--accent-soft);
  color: var(--accent);
}

.tree-header-actions .more-btn {
  border: 1px dashed var(--border-light);
  border-radius: 6px;
  opacity: 0.7;
}

.tree-header-actions .more-btn:hover {
  opacity: 1;
  border-color: var(--accent);
}

.tree-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 下拉菜单美化 */
.tree-dropdown-menu :deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 13px;
  transition: all 0.15s;
  color: var(--text-2);
}

.tree-dropdown-menu :deep(.el-dropdown-menu__item .el-icon) {
  font-size: 16px;
  color: var(--text-2);
}

.tree-dropdown-menu :deep(.el-dropdown-menu__item:hover) {
  background: var(--panel-hover);
  color: var(--text-1);
}

.tree-dropdown-menu :deep(.el-dropdown-menu__item:hover .el-icon) {
  color: var(--accent);
}

.outline-section {
  border-bottom: 1px solid var(--border);
  background: var(--panel-bg-2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 20px;
  gap: 12px;
  color: var(--text-2);
}

.empty-state p {
  font-size: 13px;
  color: var(--text-2);
}

.tree-menu {
  border-right: none;
  background: transparent;
}

/* 覆盖 EP 对子菜单内 .el-icon 的默认规则（width: var(--el-menu-icon-width) + margin-right: 5px），
   避免按钮内图标被撑大后向左偏移 */
.tree-menu :deep(.el-button .el-icon) {
  width: auto;
  margin: 0;
  font-size: inherit;
}

/* 章节节点文字 */
.tree-menu :deep(.el-menu-item) {
  color: var(--text-2);
}

.tree-menu :deep(.el-menu-item.is-active) {
  color: var(--accent);
  background: var(--accent-soft);
}

.tree-menu :deep(.el-menu-item:hover) {
  background: var(--panel-hover);
}

.project-node {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-size: 13px;
  position: relative;
  /* 为选中态左侧指示条留出间距，避免竖线与文件夹图标贴在一起 */
  padding-left: 10px;
  min-width: 0;
}

/* 选中的小说：标题行整体高亮背景 + 左侧指示条 + 加粗蓝字 */
.tree-menu .el-sub-menu.proj-active > .el-sub-menu__title {
  background-color: var(--accent-soft) !important;
  color: var(--accent) !important;
}

.project-node.active {
  color: var(--accent);
  font-weight: 600;
}

.project-node.active .node-name {
  color: var(--accent);
}

.project-node.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  width: 3px;
  border-radius: 2px;
  background: var(--accent);
}

.node-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s;
}

.node-date {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 0.15s, width 0.15s, margin 0.15s;
}

/* hover 节点时：日期淡出，给名字和操作按钮让位 */
.el-sub-menu__title:hover .node-date,
.project-node:hover .node-date {
  opacity: 0;
  width: 0;
  margin: 0;
}

/* 「章节」收纳文件夹 */
.chapters-submenu :deep(.el-sub-menu__title) {
  color: var(--text-2);
  font-weight: 600;
  font-size: 13px;
}
.chapters-count {
  margin-left: auto;
  padding-right: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.add-volume-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  margin-right: 4px;
  color: var(--text-3);
  flex-shrink: 0;
}
.add-volume-btn:hover {
  color: var(--accent);
}

/* 卷分组标题 */
.chapters-submenu :deep(.el-menu-item-group__title) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
}
.group-title-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-del-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--text-3);
  opacity: 0;
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, color 0.15s;
}
.el-menu-item-group:hover .group-del-btn {
  opacity: 1;
}
.group-del-btn:hover {
  color: var(--red);
}

/* 章节删除按钮：hover 显示，垂直居中，与左侧内容保持间距 */
.chapter-del-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: 10px;
  color: var(--text-3);
  opacity: 0;
  flex-shrink: 0;
  align-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, color 0.15s;
}
.chapters-submenu :deep(.el-menu-item:hover .chapter-del-btn),
.el-menu-item:hover .chapter-del-btn {
  opacity: 1;
}
.chapter-del-btn:hover {
  color: var(--red);
}

/* 项目节点上的「迁移位置」按钮：hover 节点时展开显示，hover 变蓝 */
.node-move-btn {
  width: 0;
  height: 22px;
  padding: 0;
  color: var(--text-3);
  margin: 0;
  opacity: 0;
  overflow: hidden;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, opacity 0.15s, width 0.15s, margin 0.15s;
  border-radius: 4px;
}

.el-sub-menu__title:hover .node-move-btn,
.project-node:hover .node-move-btn {
  width: 22px;
  margin-left: 2px;
  opacity: 1;
}

.node-move-btn:hover {
  color: var(--accent) !important;
  background: var(--accent-soft) !important;
}

/* 项目节点上的「删除」按钮：hover 节点时展开显示 */
.node-del-btn {
  width: 0;
  height: 22px;
  padding: 0;
  color: var(--text-3);
  margin: 0;
  opacity: 0;
  overflow: hidden;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, opacity 0.15s, width 0.15s, margin 0.15s;
  border-radius: 4px;
}

.el-sub-menu__title:hover .node-del-btn,
.project-node:hover .node-del-btn {
  width: 22px;
  margin-left: 2px;
  opacity: 1;
}

.node-del-btn:hover {
  color: var(--red) !important;
  background: var(--red-soft) !important;
}

.chapter-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-2);
}

.chapter-words {
  font-size: 11px;
  color: var(--text-3);
}
</style>
