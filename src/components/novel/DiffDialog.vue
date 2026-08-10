<template>
  <el-dialog v-model="visible" title="✏️ Diff 增量改写" width="720px">
    <div class="diff-dialog">
      <div class="diff-input">
        <el-input v-model="instruction" placeholder="输入改写要求（如：让对话更生动、增加环境描写、改成古风文风）" />
        <el-select v-model="diffType" style="width:120px;flex-shrink:0">
          <el-option label="改写" value="rewrite" />
          <el-option label="扩写" value="expand" />
          <el-option label="缩写" value="abridge" />
          <el-option label="润色" value="polish" />
        </el-select>
        <el-button type="primary" @click="handleGenerate" :loading="isGenerating">生成</el-button>
      </div>

      <!-- 原文选择 -->
      <div v-if="!currentDiff" class="diff-select">
        <p>请先在编辑器中选中要改写的文本，然后点击「生成」</p>
        <p class="diff-hint">如果没有选中文本，将使用当前章节全部内容</p>
      </div>

      <!-- Diff 对比 -->
      <div v-if="currentDiff" class="diff-compare">
        <div class="diff-header">
          <span class="diff-status" :class="currentDiff.status">
            {{ statusLabel }}
          </span>
          <div class="diff-actions">
            <el-button size="small" type="success" @click="handleAccept" :disabled="currentDiff.status !== 'pending'">
              ✅ 采纳
            </el-button>
            <el-button size="small" type="danger" @click="handleReject" :disabled="currentDiff.status !== 'pending'">
              ❌ 驳回
            </el-button>
            <el-button size="small" @click="handleAdjust" :disabled="currentDiff.status === 'rejected'">
              ✏️ 微调
            </el-button>
          </div>
        </div>

        <div class="diff-panels">
          <div class="diff-panel original">
            <h5>原文</h5>
            <pre>{{ currentDiff.original }}</pre>
          </div>
          <div class="diff-panel modified">
            <h5>修改后</h5>
            <pre>{{ currentDiff.modified }}</pre>
          </div>
        </div>

        <div v-if="currentDiff.adjustments.length > 0" class="diff-history">
          <h5>修改历史</h5>
          <div v-for="(adj, i) in currentDiff.adjustments" :key="i" class="history-item">
            <span class="history-index">第 {{ i + 1 }} 次微调</span>
            <pre>{{ adj }}</pre>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage } from "element-plus";
import { createDiffEdit, acceptDiff, rejectDiff, adjustDiff, applyDiffToContent, buildDiffPrompt } from "@/utils/diff";
import type { DiffEdit } from "@/utils/diff";
import { useEditorStore } from "@/stores/editor";
import { useAIStore } from "@/stores/ai";

const visible = defineModel<boolean>("visible");
const editorStore = useEditorStore();
const aiStore = useAIStore();

const instruction = ref("");
const diffType = ref<DiffEdit["type"]>("rewrite");
const currentDiff = ref<DiffEdit | null>(null);
const isGenerating = ref(false);

const statusLabel = ref("");

async function handleGenerate() {
  if (!editorStore.currentChapter) {
    ElMessage.warning("请先打开一个章节");
    return;
  }

  // 获取选中文本
  const textarea = document.querySelector(".editor-textarea") as HTMLTextAreaElement;
  let selectedText = "";
  if (textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      selectedText = editorStore.content.substring(start, end);
    }
  }

  const sourceText = selectedText || editorStore.content;
  if (!sourceText.trim()) {
    ElMessage.warning("没有内容可改写");
    return;
  }

  isGenerating.value = true;
  try {
    const prompt = buildDiffPrompt(sourceText, instruction.value, diffType.value);
    const response = await aiStore.sendMessage(prompt);

    currentDiff.value = createDiffEdit(sourceText, response, diffType.value);
    statusLabel.value = "待处理";
    ElMessage.success("Diff 改写完成，请审阅");
  } catch (e) {
    ElMessage.error("AI 改写失败: " + e);
  } finally {
    isGenerating.value = false;
  }
}

function handleAccept() {
  if (!currentDiff.value) return;
  const result = applyDiffToContent(
    editorStore.content,
    currentDiff.value.original,
    currentDiff.value.modified
  );
  editorStore.setContent(result);
  currentDiff.value = acceptDiff(currentDiff.value);
  statusLabel.value = "✅ 已采纳";
  ElMessage.success("已采纳修改");
}

function handleReject() {
  if (!currentDiff.value) return;
  currentDiff.value = rejectDiff(currentDiff.value);
  statusLabel.value = "❌ 已驳回";
  ElMessage.info("已驳回修改");
}

async function handleAdjust() {
  if (!currentDiff.value) return;
  // 简单微调：再次调用 AI 修改
  const prompt = `对以下改写结果做微调：\n\n原文：\n${currentDiff.value.original}\n\n当前改写：\n${currentDiff.value.modified}\n\n请做轻微调整，保持大意不变，优化表达。`;
  try {
    const response = await aiStore.sendMessage(prompt);
    currentDiff.value = adjustDiff(currentDiff.value, response);
    statusLabel.value = "✏️ 已微调";
    ElMessage.success("微调完成");
  } catch (e) {
    ElMessage.error("微调失败: " + e);
  }
}
</script>

<style scoped>
.diff-dialog { display: flex; flex-direction: column; gap: 16px; }
.diff-input { display: flex; gap: 8px; align-items: center; }
.diff-select { text-align: center; padding: 40px; color: var(--text-2); }
.diff-hint { font-size: 12px; color: var(--text-3); margin-top: 8px; }
.diff-compare { display: flex; flex-direction: column; gap: 12px; }
.diff-header { display: flex; align-items: center; justify-content: space-between; }
.diff-status { font-size: 12px; padding: 2px 8px; border-radius: 4px; }
.diff-status.pending { background: var(--orange-soft); color: var(--orange); }
.diff-status.accepted { background: var(--green-soft); color: var(--green); }
.diff-status.rejected { background: var(--red-soft); color: var(--red); }
.diff-status.adjusted { background: var(--accent-soft); color: var(--accent); }
.diff-actions { display: flex; gap: 4px; }
.diff-panels { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.diff-panel { border: 1px solid var(--border); border-radius: 8px; padding: 12px; max-height: 300px; overflow-y: auto; background: var(--panel-bg-2); }
.diff-panel h5 { margin: 0 0 8px; font-size: 12px; color: var(--text-2); }
.diff-panel pre { font-size: 12px; line-height: 1.6; white-space: pre-wrap; margin: 0; color: var(--text-1); }
.diff-panel.original pre { color: var(--text-2); }
.diff-history { border-top: 1px solid var(--border); padding-top: 12px; }
.diff-history h5 { font-size: 12px; color: var(--text-2); margin-bottom: 8px; }
.history-item { margin-bottom: 8px; }
.history-index { font-size: 11px; color: var(--accent); }
.history-item pre { font-size: 12px; background: var(--panel-bg-2); border: 1px solid var(--border); padding: 8px; border-radius: 6px; white-space: pre-wrap; margin: 4px 0 0; }
</style>
