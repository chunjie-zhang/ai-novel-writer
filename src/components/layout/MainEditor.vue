<template>
  <div class="main-editor">
    <!-- 无项目时的欢迎页 -->
    <div v-if="!projectStore.hasProject" class="welcome">
      <div class="welcome-content">
        <div class="welcome-icon"><Icon icon="lucide:pen-line" :width="48" :height="48" /></div>
        <h1>AI 小说创作工具</h1>
        <p class="welcome-desc">
          专为长篇网文创作者设计的桌面端工具<br />
          默认支持 DeepSeek，也可接入任意大模型<br />
          本地存储，隐私安全
        </p>
        <el-button type="primary" size="large" @click="createNewProject">
          <el-icon><Icon icon="lucide:folder-plus" /></el-icon>
          <span>新建小说项目</span>
        </el-button>
      </div>
    </div>

    <!-- 有项目的编辑器 -->
    <template v-else>
      <!-- 编辑器工具栏（可拖拽窗口区域） -->
      <div class="editor-toolbar" data-tauri-drag-region="deep">
        <div class="toolbar-left">
          <span v-if="editorStore.currentChapter" class="chapter-title-label">
            当前章节：{{ editorStore.currentChapter.title }}
          </span>
          <span v-else class="chapter-title-label hint">请选择或创建章节</span>
        </div>
        <div class="toolbar-right">
          <!-- 字数统计（紧凑单行） -->
          <span class="word-count">本章 {{ editorStore.wordCount }}</span>
          <el-tooltip content="点击设置日更目标" placement="bottom">
            <span
              class="word-count daily"
              @click="handleDailyClick"
              style="cursor: pointer;"
              data-tauri-drag-region="false"
            >
              <template v-if="writingStore.stats.dailyGoal.enabled">
                今日 {{ writingStore.stats.writtenToday }}/{{ writingStore.stats.dailyGoal.targetWords }}
                <span :class="writingStore.isGoalMet ? 'goal-met' : 'goal-pending'">
                  ({{ writingStore.dailyProgressPercent }}%)
                </span>
              </template>
              <template v-else>
                累计 {{ writingStore.stats.totalWrittenAllTime }}
              </template>
            </span>
          </el-tooltip>

          <!-- 保存状态 -->
          <span class="save-status" :class="{ saving: editorStore.isSaving }">
            {{ editorStore.isSaving ? "保存中" : editorStore.isModified ? "未保存" : "已保存" }}
          </span>

          <!-- 核心操作 -->
          <el-button
            size="small"
            type="primary"
            :disabled="!editorStore.isModified"
            :loading="editorStore.isSaving"
            @click="handleSave"
          >保存</el-button>

          <el-button size="small" @click="handleNewChapter">
            <el-icon><Icon icon="lucide:file-plus" /></el-icon>章节
          </el-button>

          <!-- 专注模式 -->
          <el-tooltip content="专注模式" placement="bottom">
            <el-button
              size="small"
              :type="isFocusMode ? 'primary' : ''"
              @click="toggleFocusMode"
            >
              <el-icon><Icon icon="lucide:maximize-2" /></el-icon>
              <span>专注</span>
            </el-button>
          </el-tooltip>

          <!-- 更多工具（下拉折叠） -->
          <el-dropdown trigger="click" @command="handleToolCommand">
            <el-button size="small">
              <el-icon><Icon icon="lucide:ellipsis" /></el-icon>
              <span>工具</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="sample"
                  :class="writingStore.styleSample ? 'active-item' : ''"
                >
                  <el-icon><Icon icon="lucide:wand-2" /></el-icon> 文风采样
                </el-dropdown-item>
                <el-dropdown-item command="format">
                  <el-icon><Icon icon="lucide:align-justify" /></el-icon> 排版规整
                </el-dropdown-item>
                <el-dropdown-item command="proofread" divided>
                  <el-icon><Icon icon="lucide:spell-check" /></el-icon> AI 校对（错别字/语病）
                </el-dropdown-item>
                <el-dropdown-item command="sensitive">
                  <el-icon><Icon icon="lucide:shield-alert" /></el-icon> 敏感词检查
                </el-dropdown-item>
                <el-dropdown-item command="rhythm">
                  <el-icon><Icon icon="lucide:activity" /></el-icon> 剧情节奏检测
                </el-dropdown-item>
                <el-dropdown-item command="dedup">
                  <el-icon><Icon icon="lucide:copy-x" /></el-icon> 去重检测 / 水文优化
                </el-dropdown-item>
                <el-dropdown-item command="batch" divided>
                  <el-icon><Icon icon="lucide:list-checks" /></el-icon> 章节批量管理
                </el-dropdown-item>
                <el-dropdown-item command="export-md" divided>
                  <el-icon><Icon icon="lucide:file-down" /></el-icon> 导出 Markdown
                </el-dropdown-item>
                <el-dropdown-item command="export-txt">
                  <el-icon><Icon icon="lucide:file-text" /></el-icon> 导出 TXT
                </el-dropdown-item>
                <el-dropdown-item command="diff" divided>
                  <el-icon><Icon icon="lucide:git-compare" /></el-icon> Diff 增量改写
                </el-dropdown-item>
                <el-dropdown-item command="outline-detail">
                  <el-icon><Icon icon="lucide:list-ordered" /></el-icon> 大纲→细纲生成
                </el-dropdown-item>
                <el-dropdown-item command="outline-to-text">
                  <el-icon><Icon icon="lucide:pen-line" /></el-icon> 细纲→正文生成
                </el-dropdown-item>
                <el-dropdown-item command="version-history" divided>
                  <el-icon><Icon icon="lucide:history" /></el-icon> 章节版本回溯
                </el-dropdown-item>
                <el-dropdown-item command="multi-agent">
                  <el-icon><Icon icon="lucide:bot" /></el-icon> 多智能体分析
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>

      <!-- 编辑器内容区 -->
      <div class="editor-body">
        <!-- AI 流式创作预览（打字机实时显示在中间） -->
        <div v-if="aiStreaming" class="ai-stream-preview">
          <div class="asp-header">
            <span class="asp-spinner"></span>
            <span>AI 正在创作{{ streamTargetLabel }}…</span>
          </div>
          <div class="asp-content" v-html="renderStreamMarkdown(aiStore.streamingDraft)"></div>
        </div>

        <!-- 无章节时的提示 -->
        <div v-else-if="!editorStore.currentChapter" class="no-chapter-hint">
          <el-icon :size="48" color="var(--text-3)"><Icon icon="lucide:pen-line" /></el-icon>
          <p>请在左侧选择一个章节，或新建一个章节开始写作</p>
          <el-button type="primary" @click="handleNewChapter">新建章节</el-button>
        </div>

        <!-- Milkdown 富文本编辑器 -->
        <div v-else class="milkdown-wrapper">
          <!-- 顶部固定章节标题栏（可拖拽窗口区域） -->
          <div class="chapter-title-bar" data-tauri-drag-region="deep">
            <span v-if="chapterNo" class="ctb-no">第{{ chapterNo }}章</span>
            <el-input
              v-model="titleDraft"
              placeholder="请输入标题"
              size="large"
              class="ctb-input"
              @change="commitTitle"
            />
          </div>
          <MilkdownEditor
            ref="milkdownEditorRef"
            :model-value="editorStore.content"
            @update:model-value="editorStore.setContent"
            @cursor-update="handleCursorUpdate"
          />
        </div>
      </div>

      <!-- AI 快捷操作浮动栏 -->
      <div v-if="hasSelection" class="ai-float-bar">
        <el-button size="small" @click="handleAI('polish')">润色</el-button>
        <el-button size="small" @click="handleAI('rewrite')">改写</el-button>
        <el-button size="small" @click="handleAI('expand')">扩写</el-button>
        <el-button size="small" @click="handleAI('abridge')">缩写</el-button>
      </div>
    </template>

    <!-- 新建章节对话框 -->
    <el-dialog v-model="showNewChapter" title="新建章节" width="420px">
      <el-form label-width="56px" @submit.prevent="handleCreateChapter">
        <el-form-item label="章节名">
          <el-input
            v-model="newChapterTitle"
            placeholder="输入章节名称，如：第1章 天启城"
            @keyup.enter="handleCreateChapter"
          />
        </el-form-item>
        <el-form-item label="分组">
          <el-select
            v-model="newChapterGroup"
            placeholder="不选则放到根目录"
            clearable
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option
              v-for="g in existingChapterGroups"
              :key="g"
              :label="g"
              :value="g"
            />
          </el-select>
          <div class="form-tip">也可在章节名里直接写「分组/章节名」，如：第一卷/第1章 天启城</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewChapter = false">取消</el-button>
        <el-button type="primary" @click="handleCreateChapter">创建</el-button>
      </template>
    </el-dialog>

    <!-- 章节批量管理 -->
    <ChapterBatchManager
      v-model:visible="showBatchManager"
      :chapters="projectStore.chapters"
      :project-id="projectStore.currentProject?.id || ''"
      @refresh="projectStore.openProject(projectStore.currentProject!.id)"
    />

    <!-- Diff 增量改写对话框 -->
    <DiffDialog v-model:visible="showDiffDialog" />

    <!-- 剧情节奏检测对话框 -->
    <RhythmCheckDialog
      v-model:visible="showRhythmDialog"
      :content="editorStore.content"
    />

    <!-- 去重检测 / 水文优化对话框 -->
    <DedupDialog
      v-model:visible="showDedupDialog"
      :content="editorStore.content"
      @apply="editorStore.setContent"
    />

    <!-- 章节历史版本回溯对话框 -->
    <VersionHistoryDialog
      v-model:visible="showVersionHistoryDialog"
      :project-id="projectStore.currentProject?.id || ''"
      :chapter-file-name="editorStore.currentChapter?.file_name || ''"
    />

    <!-- 细纲→正文一键生成对话框 -->
    <OutlineToTextDialog
      v-model:visible="showOutlineToTextDialog"
      @apply-at-cursor="handleApplyAtCursor"
    />

    <!-- 多智能体分析对话框 -->
    <MultiAgentDialog
      v-model:visible="showMultiAgent"
      :content="editorStore.content"
    />

    <!-- 日更目标设置对话框 -->
    <el-dialog v-model="showGoalDialog" title="日更目标" width="400px">
      <el-form label-width="100px">
        <el-form-item label="开启日更目标">
          <el-switch v-model="goalEnabled" />
        </el-form-item>
        <el-form-item label="每日目标字数" v-if="goalEnabled">
          <el-input-number v-model="goalTarget" :min="500" :max="50000" :step="500" style="width: 160px" />
        </el-form-item>
        <el-form-item label="今日已写">
          <span style="font-size: 16px; font-weight: 600; color: var(--accent);">
            {{ writingStore.stats.writtenToday }}
          </span>
          <span style="color: var(--text-3); margin-left: 8px;">字</span>
        </el-form-item>
        <el-form-item label="累计总字数">
          <span style="font-size: 16px; font-weight: 600;">
            {{ writingStore.stats.totalWrittenAllTime }}
          </span>
          <span style="color: var(--text-3); margin-left: 8px;">字</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGoalDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSaveGoal">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { invoke } from "@tauri-apps/api/core";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { useAIStore } from "@/stores/ai";
import { useWritingStore } from "@/stores/writing";
import { buildEditPrompt } from "@/utils/ai";
import { buildProofreadPrompt, localSpellCheck } from "@/utils/correction";
import ChapterBatchManager from "@/components/novel/ChapterBatchManager.vue";
import MilkdownEditor from "@/components/editor/MilkdownEditor.vue";
import DiffDialog from "@/components/novel/DiffDialog.vue";
import RhythmCheckDialog from "@/components/novel/RhythmCheckDialog.vue";
import DedupDialog from "@/components/novel/DedupDialog.vue";
import VersionHistoryDialog from "@/components/novel/VersionHistoryDialog.vue";
import OutlineToTextDialog from "@/components/novel/OutlineToTextDialog.vue";
import MultiAgentDialog from "@/components/novel/MultiAgentDialog.vue";
import { renderMarkdown as renderStreamMarkdown } from "@/utils/markdown";

const projectStore = useProjectStore();
const editorStore = useEditorStore();
const aiStore = useAIStore();
const writingStore = useWritingStore();

const showNewChapter = ref(false);
const showBatchManager = ref(false);
const showDiffDialog = ref(false);
const showRhythmDialog = ref(false);
const showDedupDialog = ref(false);
const showVersionHistoryDialog = ref(false);
const showOutlineToTextDialog = ref(false);
const showMultiAgent = ref(false);
const newChapterTitle = ref("");
const newChapterGroup = ref("");
// 当前项目已有的分组（含已创建的空卷，供下拉选择）
const existingChapterGroups = computed(() => {
  const set = new Set<string>();
  for (const c of projectStore.chapters) if (c.group) set.add(c.group);
  for (const g of projectStore.groups) if (g) set.add(g);
  return Array.from(set);
});
const hasSelection = ref(false);
const milkdownEditorRef = ref<InstanceType<typeof MilkdownEditor> | null>(null);
const showGoalDialog = ref(false);
const goalEnabled = ref(writingStore.stats.dailyGoal.enabled);
const goalTarget = ref(writingStore.stats.dailyGoal.targetWords);

// 专注码字模式
const isFocusMode = ref(false);
function toggleFocusMode() {
  isFocusMode.value = !isFocusMode.value;
  window.dispatchEvent(new CustomEvent("focus-mode-toggle", { detail: isFocusMode.value }));
  if (isFocusMode.value) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    isFocusMode.value = false;
    window.dispatchEvent(new CustomEvent("focus-mode-toggle", { detail: false }));
  }
});

// 更多工具下拉菜单路由
function handleToolCommand(cmd: string) {
  switch (cmd) {
    case "sample": handleSampleStyle(); break;
    case "format": handleFormatText(); break;
    case "proofread": handleProofread(); break;
    case "sensitive": handleCheckSensitive(); break;
    case "rhythm": showRhythmDialog.value = true; break;
    case "dedup": showDedupDialog.value = true; break;
    case "batch": showBatchManager.value = true; break;
    case "export-md": handleExport("md"); break;
    case "export-txt": handleExport("txt"); break;
    case "diff": showDiffDialog.value = true; break;
    case "outline-detail": handleOutlineDetail(); break;
    case "outline-to-text": handleOutlineToText(); break;
    case "version-history": handleVersionHistory(); break;
    case "multi-agent": showMultiAgent.value = true; break;
  }
}

// 整书导出
async function handleExport(format: string) {
  if (!projectStore.currentProject) return;
  try {
    const content = await invoke<string>("export_book", {
      projectId: projectStore.currentProject.id,
      format,
    });
    
    // 使用 Blob 下载
    const ext = format === "md" ? "md" : "txt";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectStore.currentProject.name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    
    ElMessage.success(`已导出 ${projectStore.currentProject.name}.${ext}`);
  } catch (e) {
    ElMessage.error("导出失败: " + e);
  }
}

// 点击日更统计打开设置
watch(() => writingStore.stats.writtenToday, () => {
  goalEnabled.value = writingStore.stats.dailyGoal.enabled;
  goalTarget.value = writingStore.stats.dailyGoal.targetWords;
});

function handleSaveGoal() {
  writingStore.setDailyGoal(goalEnabled.value, goalTarget.value);
  showGoalDialog.value = false;
  if (goalEnabled.value) {
    ElMessage.success(`日更目标已设为每日 ${goalTarget.value} 字`);
  }
}

function handleDailyClick() {
  goalEnabled.value = writingStore.stats.dailyGoal.enabled;
  goalTarget.value = writingStore.stats.dailyGoal.targetWords;
  showGoalDialog.value = true;
}

// ===== 断稿记忆恢复：切换章节后应用光标 / 滚动位置（若有恢复记录） =====
watch(() => editorStore.currentChapter, () => {
  const pos = editorStore.cursorPosition;
  const scroll = editorStore.scrollPosition;
  if (pos > 0 || scroll > 0) {
    // 等编辑器渲染就绪后再应用（applyCursorRestore 内部有 pending 兜底）
    setTimeout(() => {
      milkdownEditorRef.value?.applyCursorRestore?.(pos, scroll);
    }, 200);
  }
});

// 全局 Ctrl+S 保存
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    handleSave();
  }
}
document.addEventListener("keydown", handleKeydown);

// 章节标题同步提示（保存时若首行 # 标题被修改，自动重命名并同步左侧树）
function handleTitleSynced(e: Event) {
  const title = (e as CustomEvent<string>).detail;
  ElMessage.success(`章节标题已更新为「${title}」，左侧目录已同步`);
}
function handleTitleSyncError() {
  ElMessage.error("章节标题同步失败，请检查后手动重命名");
}
window.addEventListener("chapter-title-synced", handleTitleSynced);
window.addEventListener("chapter-title-sync-error", handleTitleSyncError);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
  document.removeEventListener("selectionchange", handleSelectionChange);
  window.removeEventListener("chapter-title-synced", handleTitleSynced);
  window.removeEventListener("chapter-title-sync-error", handleTitleSyncError);
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
});

function handleCursorUpdate(pos: number, scroll: number) {
  editorStore.updateCursor(pos);
  editorStore.updateScroll(scroll);
}

// ===== 顶部固定章节标题栏 =====
const titleDraft = ref("");
// 章号：从标题提取「第N章」；无则返回空（隐藏前缀）
const chapterNo = computed(() => {
  const m = editorStore.chapterTitle.match(/第(\d+)章/);
  return m ? m[1] : "";
});

// ===== AI 流式创作预览（中间编辑器实时展示打字机效果） =====
const aiStreaming = computed(
  () => aiStore.isGenerating && aiStore.streamingDraft.length > 0
);
const streamTargetLabel = computed(() => {
  if (editorStore.currentChapter) {
    return ` → ${editorStore.currentChapter.title}`;
  }
  if (projectStore.currentProject) {
    return ` → ${projectStore.currentProject.name}`;
  }
  return "";
});

// 标题栏输入框内容 = 章节标题去掉「第N章」前缀
watch(
  () => editorStore.chapterTitle,
  (t) => {
    titleDraft.value = (t || "").replace(/^第\d+章\s*/, "");
  },
  { immediate: true }
);
/** 提交标题：合成「第N章 标题」并写入内容首行（触发保存） */
function commitTitle() {
  const t = titleDraft.value.trim();
  const full = chapterNo.value ? `第${chapterNo.value}章 ${t}` : t;
  editorStore.updateChapterTitle(full);
}

// 获取编辑器当前选中文本（通过 Milkdown 暴露的 ProseMirror 选区能力）
// 点击菜单/工具栏按钮会导致编辑器失焦、实时选区读不到，因此回退到选区缓存
let lastSelectionText = "";
function getEditorSelection(): string {
  const live = milkdownEditorRef.value?.getSelectionText?.()?.trim() || "";
  return live || lastSelectionText;
}
// 用新文本替换编辑器当前选区（AI 结果局部应用，不覆盖整章）
function replaceEditorSelection(newText: string) {
  milkdownEditorRef.value?.replaceSelection?.(newText);
}

// 编辑器内选中文字时，显示 AI 快捷浮栏（润色/改写/扩写/缩写）
function handleSelectionChange() {
  const sel = window.getSelection();
  const editorEl = document.querySelector(".milkdown-editor");
  if (sel && sel.rangeCount > 0 && editorEl && editorEl.contains(sel.anchorNode)) {
    const t = sel.toString().trim();
    hasSelection.value = t.length > 0;
    if (t) lastSelectionText = t;
  } else {
    hasSelection.value = false;
  }
}
document.addEventListener("selectionchange", handleSelectionChange);

async function handleSave() {
  if (projectStore.currentProject) {
    await editorStore.saveChapter(projectStore.currentProject.id);
  }
}

// ===== 自动保存：停止输入 3 秒后自动写盘 =====
const AUTO_SAVE_DELAY = 3000;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

// 内容/修改状态变化时重置计时器（防抖：只要还在打字就不保存）
watch(
  [() => editorStore.isModified, () => editorStore.content],
  () => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
    }
    if (
      editorStore.isModified &&
      editorStore.currentChapter &&
      projectStore.currentProject
    ) {
      autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        autoSave();
      }, AUTO_SAVE_DELAY);
    }
  }
);

async function autoSave() {
  if (
    !projectStore.currentProject ||
    !editorStore.currentChapter ||
    !editorStore.isModified ||
    editorStore.isSaving
  ) {
    return;
  }
  try {
    await editorStore.saveChapter(projectStore.currentProject.id);
    // 静默保存：状态栏自动变为「已保存」，不打扰用户
  } catch (e) {
    console.error("自动保存失败:", e);
    // 失败后不重试，等下次输入变化再触发
  }
}

/** 计算全书下一个章节编号（全局递增，跨卷不重置） */
function nextChapterNumber(): number {
  let max = 0;
  for (const c of projectStore.chapters) {
    const m = c.title.match(/第(\d+)章/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

function handleNewChapter() {
  // 自动预填下一个全局章节编号（如已有第1章则预填「第2章 」）
  newChapterTitle.value = `第${nextChapterNumber()}章 `;
  newChapterGroup.value = "";
  showNewChapter.value = true;
}

async function handleCreateChapter() {
  const raw = newChapterTitle.value.trim();
  if (!raw || !projectStore.currentProject) return;
  let title = raw;
  let group = newChapterGroup.value.trim();
  // 兼容在章节名里直接写「分组/章节名」：自动拆分分组与标题
  const slash = raw.indexOf("/");
  if (slash > 0 && !group) {
    group = raw.slice(0, slash).trim();
    title = raw.slice(slash + 1).trim();
  }
  if (!title) {
    ElMessage.warning("请输入章节名称");
    return;
  }
  await editorStore.createChapter(projectStore.currentProject.id, title, group);
  showNewChapter.value = false;
  // 刷新项目结构，让左侧章节列表立即显示新章节
  try {
    await projectStore.openProject(projectStore.currentProject.id);
  } catch (e) {
    console.error("刷新项目结构失败:", e);
  }
}

async function handleAI(action: string) {
  const selectedText = getEditorSelection();
  if (!selectedText) {
    ElMessage.warning("请先在正文中选中要处理的文字");
    return;
  }

  const messages = buildEditPrompt(selectedText, action);
  try {
    const response = await aiStore.sendMessage(
      messages[messages.length - 1].content
    );
    // 用 AI 结果替换编辑器中的选中区域，不覆盖整章
    replaceEditorSelection(response);
    ElMessage.success("已应用 AI 修改");
  } catch (e) {
    console.error("AI 操作失败:", e);
  }
}

/** 文风采样：优先采样编辑器选中文本，未选中则采样当前章节全文 */
async function handleSampleStyle() {
  const selectedText = getEditorSelection();

  if (selectedText) {
    // 有选区：采样选中的文字
    if (selectedText.length < 50) {
      ElMessage.warning("请至少选中 50 字，或取消选中后采样全文");
      return;
    }
    writingStore.sampleStyle(selectedText);
    ElMessage.success(`已采样选中文本（${selectedText.length}字）的文风`);
    return;
  }

  // 没有选区：用全部内容
  if (editorStore.content.length < 100) {
    ElMessage.warning("请至少写 100 字再进行文风采样");
    return;
  }
  writingStore.sampleStyle(editorStore.content);
  ElMessage.success("已采样全文文风，后续 AI 将模仿此风格");
}

/** 排版规整 */
function handleFormatText() {
  const formatted = writingStore.formatText(editorStore.content);
  editorStore.setContent(formatted);
  ElMessage.success("排版已规整");
}

/** AI 校对（错别字/语病） */
async function handleProofread() {
  const content = editorStore.content;
  if (!content.trim()) {
    ElMessage.warning("没有内容可校对");
    return;
  }

  // 先做本地快速错别字检测
  const localResult = localSpellCheck(content);
  let msg = "";
  if (localResult.hasIssues) {
    msg = `本地检测到 ${localResult.fixes.length} 处常见错别字，已自动修正。`;
    editorStore.setContent(localResult.corrected);
  }

  // AI 深度校对
  ElMessage.info("AI 正在深度校对...");
  try {
    const messages = buildProofreadPrompt(localResult.corrected);
    const response = await aiStore.sendMessage(messages[messages.length - 1].content);

    // 尝试解析 JSON 结果
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        if (result.hasIssues && result.issues?.length > 0) {
          const issueList = result.issues
            .map((i: any) => `${i.type}: "${i.original}" → "${i.suggestion}"`)
            .join("\n");
          const action = await ElMessageBox.confirm(
            `AI 发现 ${result.issues.length} 处问题：\n\n${issueList}\n\n是否应用修改？`,
            "AI 校对结果",
            { confirmButtonText: "应用修改", cancelButtonText: "忽略", type: "info" }
          ).catch(() => "cancel");

          if (action === "confirm" && result.correctedText) {
            editorStore.setContent(result.correctedText);
            ElMessage.success("校对完成，已应用修改");
          }
        } else {
          ElMessage.success(msg || "校对完成，未发现问题 ✓");
        }
      }
    } catch {
      // JSON 解析失败，直接显示 AI 返回
      ElMessageBox.alert(response.slice(0, 500), "AI 校对结果");
    }
  } catch (e) {
    ElMessage.error("校对失败: " + e);
  }
}

/** 敏感词检查 */
async function handleCheckSensitive() {
  const results = writingStore.checkSensitiveWords(editorStore.content);
  if (results.length === 0) {
    ElMessage.success("未检测到敏感词 ✓");
    return;
  }

  const wordList = [...new Set(results.map((r) => r.word))];
  const action = await ElMessageBox.confirm(
    `检测到 ${results.length} 处敏感词：${wordList.join("、")}。是否一键替换为 ***？`,
    "敏感词提醒",
    { confirmButtonText: "替换", cancelButtonText: "忽略", type: "warning" }
  ).catch(() => "cancel");

  if (action === "confirm") {
    const replaced = writingStore.replaceSensitiveWords(editorStore.content);
    editorStore.setContent(replaced);
    ElMessage.success(`已替换 ${results.length} 处敏感词`);
  }
}

/** 大纲→细纲生成 */
async function handleOutlineDetail() {
  const content = editorStore.content;
  if (!content.trim()) {
    ElMessage.warning("当前章节为空，请先写一些内容");
    return;
  }
  try {
    const prompt = `请将以下章节内容拆解为详细写作提纲（细纲）。\n\n章节内容：\n${content.slice(0, 3000)}\n\n请输出：\n1. 场景划分（3-5个场景，标注地点和人物）\n2. 每个场景的剧情目标\n3. 关键对话要点\n4. 情绪曲线设计\n5. 字数分配建议`;
    const resp = await aiStore.sendMessage(prompt);
    ElMessageBox.alert(resp, "细纲生成结果");
  } catch (e) {
    ElMessage.error("生成失败: " + e);
  }
}

/** 细纲→正文一键生成（打开对话框） */
function handleOutlineToText() {
  if (!editorStore.currentChapter) {
    ElMessage.warning("请先选择或创建章节，再生成正文");
    return;
  }
  showOutlineToTextDialog.value = true;
}

/** 章节历史版本回溯（打开对话框） */
function handleVersionHistory() {
  if (!editorStore.currentChapter || !projectStore.currentProject) {
    ElMessage.warning("请先选择章节");
    return;
  }
  showVersionHistoryDialog.value = true;
}

/** 细纲→正文：插入到光标处（无选区则追加到末尾） */
function handleApplyAtCursor(text: string) {
  const editor = milkdownEditorRef.value;
  if (editor && editorStore.currentChapter) {
    const sel = editor.getSelectionText();
    if (sel) {
      editor.replaceSelection(text);
    } else {
      editorStore.insertContent("\n\n" + text);
    }
  } else {
    editorStore.insertContent("\n\n" + text);
  }
  ElMessage.success("已插入，请记得保存");
}

function createNewProject() {
  window.dispatchEvent(new CustomEvent("open-new-project"));
}
</script>

<style scoped>
.main-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--panel-bg);
}

/* ===== 欢迎页 ===== */
.welcome {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: radial-gradient(1200px 600px at 50% 0%, var(--welcome-glow) 0%, var(--app-bg) 60%);
}

.welcome-content {
  text-align: center;
  max-width: 460px;
  padding: 40px;
}

.welcome-icon {
  font-size: 56px;
  margin-bottom: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 28px;
  color: var(--accent);
  background: linear-gradient(135deg, var(--accent-soft), rgba(99, 102, 241, 0.04));
  border: 1px solid var(--accent-soft);
  box-shadow: var(--shadow-md);
}

.welcome-content h1 {
  font-size: 30px;
  color: var(--text-1);
  margin-bottom: 14px;
  letter-spacing: 0.5px;
}

.welcome-desc {
  font-size: 14px;
  color: var(--text-2);
  line-height: 2;
  margin-bottom: 32px;
}

/* ===== 编辑器工具栏 ===== */
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-bg-2);
  /* Windows/Linux 用：WebKit 专属拖拽（macOS 走 data-tauri-drag-region="deep"） */
  -webkit-app-region: drag;
}

/* 工具栏内可交互元素不被拖拽拦截 */
.editor-toolbar :deep(.el-button),
.editor-toolbar :deep(.el-input),
.editor-toolbar :deep(input),
.editor-toolbar [data-tauri-drag-region="false"] {
  -webkit-app-region: no-drag;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chapter-title-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 420px;
}

.chapter-title-label.hint {
  color: var(--text-3);
  font-weight: normal;
}

.form-tip {
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.5;
  margin-top: 4px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.word-count {
  font-size: 12px;
  color: var(--text-2);
}

.word-count.daily {
  color: var(--orange);
}

.goal-met {
  color: var(--green);
  font-weight: 600;
}

.goal-pending {
  color: var(--orange);
}

.save-status {
  font-size: 12px;
  color: var(--green);
}

.save-status.saving {
  color: var(--orange);
}

.editor-body {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

/* 编辑器内容区：标题栏固定，正文独立滚动 */
.milkdown-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 顶部固定章节标题栏 */
.chapter-title-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-bg-2);
  flex-shrink: 0;
  z-index: 6;
  /* Windows/Linux 用：WebKit 专属拖拽（macOS 走 data-tauri-drag-region="deep"） */
  -webkit-app-region: drag;
}
/* 章节标题输入框不被拖拽拦截 */
.chapter-title-bar :deep(.el-input),
.chapter-title-bar :deep(input) {
  -webkit-app-region: no-drag;
}
.ctb-no {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  white-space: nowrap;
}
.ctb-input {
  flex: 1;
}
.ctb-input :deep(.el-input__inner) {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
}
.milkdown-wrapper :deep(.milkdown-editor) {
  flex: 1;
  height: auto;
  min-height: 0;
}

.no-chapter-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--text-2);
  background: radial-gradient(900px 500px at 50% 30%, var(--panel-bg-2) 0%, var(--panel-bg) 70%);
}

.no-chapter-hint p {
  font-size: 14px;
  color: var(--text-2);
}

/* AI 流式创作预览 */
.ai-stream-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  background: var(--panel-bg);
}
.asp-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-bg-2);
  color: var(--text-2);
  font-size: 13px;
  flex-shrink: 0;
}
.asp-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  animation: asp-spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes asp-spin {
  to { transform: rotate(360deg); }
}
.asp-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
  line-height: 1.9;
  font-size: 15px;
  color: var(--text-1);
  word-break: break-word;
}
.asp-content h1, .asp-content h2, .asp-content h3,
.asp-content h4, .asp-content h5, .asp-content h6 {
  margin: 1.2em 0 0.5em;
  color: var(--text-1);
  font-weight: 600;
  line-height: 1.4;
}
.asp-content h1 { font-size: 22px; }
.asp-content h2 { font-size: 19px; }
.asp-content h3 { font-size: 17px; }
.asp-content p { margin: 0.5em 0; }
.asp-content blockquote {
  margin: 0.6em 0;
  padding: 4px 14px;
  border-left: 3px solid var(--accent);
  color: var(--text-2);
  background: var(--panel-bg-2);
}
.asp-content ul {
  margin: 0.4em 0;
  padding-left: 1.5em;
  list-style: disc;
}
.asp-content li { margin: 0.2em 0; }
.asp-content code {
  background: var(--panel-bg-2);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.9em;
  color: var(--accent);
}
.asp-content pre {
  background: var(--panel-bg-2);
  padding: 12px 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.6em 0;
}
.asp-content pre code {
  background: transparent;
  padding: 0;
  color: var(--text-1);
}
/* 打字机光标 */
.asp-content:last-child {
  caret-color: var(--accent);
}

.milkdown-editor {
  height: 100%;
  overflow-y: auto;
}

.editor-textarea {
  width: 100%;
  height: 100%;
  border: none;
  outline: none;
  resize: none;
  padding: 24px 40px;
  font-size: 16px;
  line-height: 1.8;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--text-1);
  background: transparent;
}

.editor-textarea::placeholder {
  color: var(--text-3);
}

.ai-float-bar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
}
</style>
