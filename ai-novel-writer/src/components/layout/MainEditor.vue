<template>
  <div class="main-editor">
    <!-- 无项目时的欢迎页 -->
    <div v-if="!projectStore.hasProject" class="welcome">
      <div class="welcome-content">
        <div class="welcome-icon">✍️</div>
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
      <!-- 编辑器工具栏 -->
      <div class="editor-toolbar">
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
            </el-button>
          </el-tooltip>

          <!-- 更多工具（下拉折叠） -->
          <el-dropdown trigger="click" @command="handleToolCommand">
            <el-button size="small">
              <el-icon><Icon icon="lucide:ellipsis" /></el-icon>
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
        <!-- 无章节时的提示 -->
        <div v-if="!editorStore.currentChapter" class="no-chapter-hint">
          <el-icon :size="48" color="var(--text-3)"><Icon icon="lucide:pen-line" /></el-icon>
          <p>请在左侧选择一个章节，或新建一个章节开始写作</p>
          <el-button type="primary" @click="handleNewChapter">新建章节</el-button>
        </div>

        <!-- Milkdown 富文本编辑器 -->
        <div v-else class="milkdown-wrapper">
          <MilkdownEditor
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
    <el-dialog v-model="showNewChapter" title="新建章节" width="400px">
      <el-input v-model="newChapterTitle" placeholder="输入章节名称" />
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
import { ref, watch, nextTick, onBeforeUnmount } from "vue";
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

const projectStore = useProjectStore();
const editorStore = useEditorStore();
const aiStore = useAIStore();
const writingStore = useWritingStore();

const showNewChapter = ref(false);
const showBatchManager = ref(false);
const showDiffDialog = ref(false);
const showRhythmDialog = ref(false);
const showDedupDialog = ref(false);
const newChapterTitle = ref("");
const hasSelection = ref(false);
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
    case "multi-agent": handleMultiAgent(); break;
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

// ===== 断稿记忆恢复 =====
watch(() => editorStore.currentChapter, async () => { await nextTick(); }, { once: true });

// 全局 Ctrl+S 保存
function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    handleSave();
  }
}
document.addEventListener("keydown", handleKeydown);
onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown);
});

function handleCursorUpdate(pos: number, scroll: number) {
  editorStore.updateCursor(pos);
  editorStore.updateScroll(scroll);
}

async function handleSave() {
  if (projectStore.currentProject) {
    await editorStore.saveChapter(projectStore.currentProject.id);
  }
}

function handleNewChapter() {
  newChapterTitle.value = "";
  showNewChapter.value = true;
}

async function handleCreateChapter() {
  if (!newChapterTitle.value.trim() || !projectStore.currentProject) return;
  await editorStore.createChapter(
    projectStore.currentProject.id,
    newChapterTitle.value.trim()
  );
  showNewChapter.value = false;
}

async function handleAI(action: string) {
  const textarea = document.querySelector(".editor-textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = editorStore.content.substring(start, end);
  if (!selectedText) return;

  const messages = buildEditPrompt(selectedText, action);
  try {
    const response = await aiStore.sendMessage(
      messages[messages.length - 1].content
    );
    const newContent =
      editorStore.content.substring(0, start) + response + editorStore.content.substring(end);
    editorStore.setContent(newContent);
  } catch (e) {
    console.error("AI 操作失败:", e);
  }
}

/** 文风采样：将当前编辑器中选中的文本作为文风样本 */
async function handleSampleStyle() {
  const textarea = document.querySelector(".editor-textarea") as HTMLTextAreaElement;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (start === end) {
    // 没有选区，用全部内容
    if (editorStore.content.length < 100) {
      ElMessage.warning("请至少写 100 字再进行文风采样");
      return;
    }
    writingStore.sampleStyle(editorStore.content);
    ElMessage.success("已采样全文文风，后续 AI 将模仿此风格");
    return;
  }

  const selectedText = editorStore.content.substring(start, end);
  if (selectedText.length < 50) {
    ElMessage.warning("请至少选中 50 字");
    return;
  }

  writingStore.sampleStyle(selectedText);
  ElMessage.success(`已采样选中文本（${selectedText.length}字）的文风`);
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
    ElMessageBox.alert(resp, "📋 细纲生成结果");
  } catch (e) {
    ElMessage.error("生成失败: " + e);
  }
}

/** 多智能体分析 */
async function handleMultiAgent() {
  const content = editorStore.content;
  if (!content.trim()) {
    ElMessage.warning("当前章节为空");
    return;
  }
  try {
    ElMessage.info("多智能体分析中（剧情策划 + 人设校验 + 文笔润色 + 逻辑纠错）...");

    // 并行调用多个 Agent
    const [plotResult, characterResult, polishResult, logicResult] = await Promise.allSettled([
      aiStore.sendMessage(`你是一位【剧情策划师】。分析以下内容的剧情结构：\n\n${content.slice(0, 2000)}\n\n请评分(1-10)并给出改进建议。`),
      aiStore.sendMessage(`你是一位【人设校验官】。检查以下内容中角色行为是否OOC：\n\n${content.slice(0, 2000)}`),
      aiStore.sendMessage(`你是一位【文笔润色师】。评估以下内容的文笔质量：\n\n${content.slice(0, 2000)}\n\n请评分并给出具体改进建议。`),
      aiStore.sendMessage(`你是一位【逻辑纠错师】。检查以下内容的逻辑问题：\n\n${content.slice(0, 2000)}`),
    ]);

    const parts = [];
    if (plotResult.status === "fulfilled") parts.push(`【剧情策划】\n${plotResult.value.slice(0, 300)}`);
    if (characterResult.status === "fulfilled") parts.push(`【人设校验】\n${characterResult.value.slice(0, 300)}`);
    if (polishResult.status === "fulfilled") parts.push(`【文笔润色】\n${polishResult.value.slice(0, 300)}`);
    if (logicResult.status === "fulfilled") parts.push(`【逻辑纠错】\n${logicResult.value.slice(0, 300)}`);

    ElMessageBox.alert(parts.join("\n\n---\n\n"), "🤖 多智能体分析报告");
  } catch (e) {
    ElMessage.error("分析失败: " + e);
  }
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
  background: radial-gradient(1200px 600px at 50% 0%, #20263a 0%, var(--app-bg) 60%);
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
  background: linear-gradient(135deg, rgba(77, 141, 255, 0.22), rgba(77, 141, 255, 0.06));
  border: 1px solid rgba(77, 141, 255, 0.35);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
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
