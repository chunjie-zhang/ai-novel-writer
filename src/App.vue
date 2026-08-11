<template>
  <div class="app-container" :class="{ 'focus-mode': isFocusMode }">
    <!-- 顶部标题栏（macOS Overlay 下充当标题栏拖拽区） -->
    <header
      class="app-header"
      :class="{ 'is-mac': isMac }"
      data-tauri-drag-region="deep"
    >
      <div class="header-left">
        <span class="app-logo"><Icon icon="lucide:pen-line" :width="16" :height="16" /> AI 小说创作工具</span>
      </div>
      <div class="header-center">
        <template v-if="projectStore.hasProject">
          <span class="project-name">{{ projectStore.currentProject?.name }}</span>
        </template>
        <span v-else class="no-project">未选择项目</span>
      </div>
      <div class="header-right">
        <el-button text circle @click="showGuide = true" title="新手引导 / 帮助">
          <el-icon><Icon icon="lucide:circle-question-mark" /></el-icon>
        </el-button>
        <el-button text circle @click="showNewProject = true" title="新建项目">
          <el-icon><Icon icon="lucide:folder-plus" /></el-icon>
        </el-button>
        <el-button text circle @click="showSettings = true" title="设置">
          <el-icon><Icon icon="lucide:settings" /></el-icon>
        </el-button>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="app-main">
      <!-- 左侧：项目树 -->
      <aside class="sidebar-left" :class="{ collapsed: !projectStore.hasProject }" :style="{ width: leftPanelWidth + 'px' }">
        <ProjectTree @create-project="showNewProject = true" />
      </aside>

      <!-- 左侧拖拽分隔条 -->
      <div class="resize-handle handle-left" :class="{ dragging: resizing === 'left' }" @mousedown="startResize('left', $event)"></div>

      <!-- 中间：编辑器 -->
      <main class="main-content">
        <MainEditor />
      </main>

      <!-- 右侧拖拽分隔条 -->
      <div class="resize-handle handle-right" :class="{ dragging: resizing === 'right' }" @mousedown="startResize('right', $event)"></div>

      <!-- 右侧：AI 对话面板 -->
      <aside class="sidebar-right" :style="{ width: rightPanelWidth + 'px' }">
        <AIChatPanel />
      </aside>
    </div>

    <!-- 新建项目对话框 -->
    <el-dialog v-model="showNewProject" title="新建小说项目" width="500px" :close-on-click-modal="false">
      <el-form :model="newProjectForm" label-width="80px">
        <el-form-item label="作品名称" required>
          <el-input v-model="newProjectForm.name" placeholder="输入小说名称" />
        </el-form-item>
        <el-form-item label="作品简介">
          <el-input
            v-model="newProjectForm.description"
            type="textarea"
            :rows="4"
            placeholder="可选：输入小说的简介或创作方向"
          />
        </el-form-item>
        <el-form-item label="存储位置">
          <div class="storage-picker">
            <el-input v-model="newProjectForm.storagePath" :disabled="true" placeholder="默认存储位置" />
            <el-button :disabled="!defaultStoragePath" @click="handleSelectStorage">
              <el-icon><Icon icon="lucide:folder-open" /></el-icon> 选择
            </el-button>
          </div>
          <div class="form-hint">
            默认：{{ defaultStoragePath || '加载中...' }}<br />
            不选择则使用默认位置
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewProject = false">取消</el-button>
        <el-button type="primary" @click="handleCreateProject" :loading="projectStore.isLoading">
          创建项目
        </el-button>
      </template>
    </el-dialog>

    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="设置" width="620px">
      <el-tabs>
        <el-tab-pane label="模型配置">
          <ModelConfig @saved="showSettings = false" />
        </el-tab-pane>
        <el-tab-pane label="外观主题">
          <AppearanceSettings />
        </el-tab-pane>
        <el-tab-pane label="存储位置">
          <StorageSettings />
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 新手引导（首次启动自动弹出，也可通过顶部 ? 按钮打开） -->
    <WelcomeGuide v-model:visible="showGuide" @finish="handleGuideFinish" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/project";
import { useAIStore } from "@/stores/ai";
import { useSkillStore } from "@/skills/store";
import ProjectTree from "@/components/layout/ProjectTree.vue";
import MainEditor from "@/components/layout/MainEditor.vue";
import AIChatPanel from "@/components/layout/AIChatPanel.vue";
import ModelConfig from "@/components/ai/ModelConfig.vue";
import StorageSettings from "@/components/ai/StorageSettings.vue";
import AppearanceSettings from "@/components/ai/AppearanceSettings.vue";
import WelcomeGuide from "@/components/onboarding/WelcomeGuide.vue";
import { useThemeStore } from "@/stores/theme";

const projectStore = useProjectStore();
const aiStore = useAIStore();
const themeStore = useThemeStore();
const skillStore = useSkillStore();

// macOS：系统标题栏已设为 Overlay 透明，需为左上角红绿灯按钮预留空间
const isMac = ref(
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
);

const showNewProject = ref(false);
const showSettings = ref(false);
const showGuide = ref(false);
const isFocusMode = ref(false);
const defaultStoragePath = ref("");

// ===== 面板拖拽调宽 =====
const leftPanelWidth = ref(280);
const rightPanelWidth = ref(360);
const resizing = ref<"left" | "right" | null>(null);
/** 中间内容区最小宽度：拖拽时不允许把编辑器压缩到小于该值 */
const MIN_CONTENT_WIDTH = 420;
/** 左右两条拖拽分隔条总宽（5px × 2） */
const HANDLES_WIDTH = 10;

/** 左面板最大允许宽度：保证内容区 ≥ MIN_CONTENT_WIDTH */
function maxLeftPanelWidth() {
  return Math.max(
    180,
    window.innerWidth - MIN_CONTENT_WIDTH - rightPanelWidth.value - HANDLES_WIDTH
  );
}
/** 右面板最大允许宽度：保证内容区 ≥ MIN_CONTENT_WIDTH */
function maxRightPanelWidth() {
  return Math.max(
    240,
    window.innerWidth - MIN_CONTENT_WIDTH - leftPanelWidth.value - HANDLES_WIDTH
  );
}
function clampLeftPanel(w: number) {
  return Math.min(Math.max(w, 180), Math.min(600, maxLeftPanelWidth()));
}
function clampRightPanel(w: number) {
  return Math.min(Math.max(w, 240), Math.min(700, maxRightPanelWidth()));
}

function restorePanelWidths() {
  try {
    const lRaw = localStorage.getItem("panel-left-width");
    if (lRaw !== null) {
      const l = Number(lRaw);
      if (Number.isFinite(l)) leftPanelWidth.value = clampLeftPanel(l);
    }
    const rRaw = localStorage.getItem("panel-right-width");
    if (rRaw !== null) {
      const r = Number(rRaw);
      if (Number.isFinite(r)) rightPanelWidth.value = clampRightPanel(r);
    }
  } catch {}
}

function startResize(side: "left" | "right", e: MouseEvent) {
  e.preventDefault();
  resizing.value = side;
  document.body.style.cursor = "col-resize";
  document.body.style.userSelect = "none";
}

function onMouseMove(e: MouseEvent) {
  if (resizing.value === "left") {
    const w = clampLeftPanel(e.clientX);
    leftPanelWidth.value = w;
    localStorage.setItem("panel-left-width", String(w));
  } else if (resizing.value === "right") {
    const w = clampRightPanel(window.innerWidth - e.clientX);
    rightPanelWidth.value = w;
    localStorage.setItem("panel-right-width", String(w));
  }
}

function onMouseUp() {
  if (resizing.value) {
    resizing.value = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
}

/** 窗口尺寸变化时：收缩面板，保证中间内容区不被压缩到最小宽度以下 */
function onWindowResize() {
  const nl = clampLeftPanel(leftPanelWidth.value);
  if (nl !== leftPanelWidth.value) {
    leftPanelWidth.value = nl;
    localStorage.setItem("panel-left-width", String(nl));
  }
  const nr = clampRightPanel(rightPanelWidth.value);
  if (nr !== rightPanelWidth.value) {
    rightPanelWidth.value = nr;
    localStorage.setItem("panel-right-width", String(nr));
  }
}

// 监听专注模式变化
window.addEventListener("focus-mode-toggle", ((e: CustomEvent) => {
  isFocusMode.value = e.detail;
}) as EventListener);

// 监听「新建小说项目」事件（欢迎页按钮触发）
window.addEventListener("open-new-project", () => {
  showNewProject.value = true;
});
const newProjectForm = ref({ name: "", description: "", storagePath: "" });

async function handleCreateProject() {
  if (!newProjectForm.value.name.trim()) return;
  await projectStore.createProject(
    newProjectForm.value.name.trim(),
    newProjectForm.value.description.trim(),
    newProjectForm.value.storagePath || undefined
  );
  newProjectForm.value = { name: "", description: "", storagePath: "" };
  showNewProject.value = false;
}

async function handleSelectStorage() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择本项目存储目录",
    });
    if (selected) {
      newProjectForm.value.storagePath = selected as string;
    }
  } catch {
    // 浏览器环境无 Tauri 对话框
  }
}

async function loadStoragePath() {
  try {
    defaultStoragePath.value = await invoke<string>("get_storage_path");
  } catch {
    defaultStoragePath.value = "";
  }
}

onMounted(async () => {
  await projectStore.loadProjects();
  loadStoragePath();
  // 从磁盘恢复 AI 模型配置（比 localStorage 可靠，不怕清缓存丢配置）
  aiStore.initFromDisk();
  // 初始化主题（跟随系统 / 白天 / 黑夜）
  themeStore.init();
  // 加载用户自定义技能（技能市场）
  skillStore.loadCustomSkills();
  skillStore.loadSkillsDir();
  // 恢复面板宽度 + 注册拖拽监听
  restorePanelWidths();
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
  window.addEventListener("resize", onWindowResize);

  // 首次启动：自动弹出新手引导（仅一次，之后可通过顶部 ? 按钮再次打开）
  if (!localStorage.getItem("novel-onboarding-done")) {
    showGuide.value = true;
  }
});

/** 引导完成 / 跳过：记录已引导，避免每次启动都弹 */
function handleGuideFinish() {
  localStorage.setItem("novel-onboarding-done", "1");
}

onBeforeUnmount(() => {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);
  window.removeEventListener("resize", onWindowResize);
});
</script>

<style scoped>
.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
}

.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--panel-bg);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.25);
  /* Windows/Linux 用：WebKit 专属拖拽（macOS WKWebView 不支持，走 data-tauri-drag-region） */
  -webkit-app-region: drag;
  flex-shrink: 0;
  z-index: 20;
}

/* macOS：为左上角红绿灯按钮预留空间（标题栏透明叠加，70px 覆盖三颗按钮） */
.app-header.is-mac {
  padding-left: 70px;
}

/* 头部按钮需可点击（不被窗口拖拽拦截） */
.app-header .el-button,
.app-header .header-right {
  -webkit-app-region: no-drag;
}

/* data-tauri-drag-region 不继承：给非交互内容区显式标记可拖（含 header-left/center） */
.app-header .header-left,
.app-header .header-center {
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}

.app-logo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
  letter-spacing: 0.3px;
}

.header-center {
  flex: 1;
  min-width: 0;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-name {
  font-size: 14px;
  color: var(--accent);
  font-weight: 500;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-project {
  font-size: 13px;
  color: var(--text-3);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storage-picker {
  display: flex;
  gap: 8px;
  width: 100%;
}

.storage-picker .el-input {
  flex: 1;
}

.form-hint {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.6;
  margin-top: 4px;
  word-break: break-all;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 200px;
  justify-content: flex-end;
  -webkit-app-region: no-drag;
}

.app-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar-left {
  width: var(--sidebar-width);
  background: var(--panel-bg);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-left.collapsed {
  width: var(--sidebar-width);
}

/* 拖拽分隔条 */
.resize-handle {
  flex-shrink: 0;
  width: 5px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 10;
  position: relative;
}

.resize-handle:hover,
.resize-handle.dragging {
  background: var(--accent);
  opacity: 0.6;
}

/* 专注模式：隐藏侧边栏和分隔条 */
.focus-mode .sidebar-left,
.focus-mode .sidebar-right,
.focus-mode .resize-handle {
  display: none;
}

.focus-mode .main-content {
  margin: 0;
}

.focus-mode .app-header {
  opacity: 0.3;
}

.focus-mode .app-header:hover {
  opacity: 1;
}

.main-content {
  flex: 1;
  min-width: 420px;
  background: var(--panel-bg);
  margin: 0 1px;
}

.sidebar-right {
  width: var(--right-panel-width);
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
}
</style>
