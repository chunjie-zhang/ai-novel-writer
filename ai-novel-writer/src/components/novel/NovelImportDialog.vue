<template>
  <el-dialog v-model="visible" title="导入参考小说" width="560px" :close-on-click-modal="false">
    <div class="import-container">
      <!-- 步骤1：选择文件 -->
      <div v-if="step === 'select'" class="import-step">
        <div class="upload-zone" @click="handleSelectFile">
          <el-icon :size="48" color="#409eff"><Icon icon="lucide:upload" /></el-icon>
          <p class="upload-text">点击选择小说文件</p>
          <p class="upload-hint">支持 TXT、MD 格式</p>
        </div>

        <div class="import-tips">
          <h4>导入说明：</h4>
          <ul>
            <li>支持 <code>.txt</code> 和 <code>.md</code> 格式的小说文件</li>
            <li>系统会自动识别章节标题并分章（如"第一章"、"Chapter 1"等）</li>
            <li>导入后可以选择章节作为 AI 分析样本</li>
            <li>分析完成后可选择"仿写风格"或"借鉴剧情"等写作模式</li>
          </ul>
        </div>
      </div>

      <!-- 步骤2：选择分析样本 -->
      <div v-if="step === 'preview'" class="import-step">
        <div class="import-success">
          <el-icon :size="32" color="#67c23a"><Icon icon="lucide:circle-check" /></el-icon>
          <div class="import-info">
            <h4>{{ refStore.referenceNovel?.title }}</h4>
            <p>
              {{ refStore.referenceNovel?.total_words }} 字 ·
              {{ refStore.referenceNovel?.total_chapters }} 章 ·
              {{ formatTime(refStore.referenceNovel?.imported_at) }}
            </p>
          </div>
        </div>

        <el-divider />

        <div class="sample-section">
          <h4>选择分析样本章节：</h4>
          <p class="sample-hint">选择 1-5 章作为 AI 分析样本（默认选择前 3 章）</p>

          <el-checkbox-group v-model="refStore.selectedChapters" class="chapter-checkboxes">
            <el-checkbox
              v-for="ch in refStore.chapters"
              :key="ch.index"
              :value="ch.index"
              :label="`${ch.title}（${ch.word_count}字）`"
            />
          </el-checkbox-group>
        </div>
      </div>

      <!-- 步骤3：分析结果 -->
      <div v-if="step === 'analysis'" class="import-step">
        <div v-if="refStore.isAnalyzing" class="analyzing">
          <el-icon :size="32" class="is-loading"><Icon icon="lucide:loader-circle" /></el-icon>
          <p>AI 正在分析小说...</p>
        </div>

        <div v-else-if="refStore.hasAnalysis" class="analysis-result">
          <div class="analysis-summary">
            <h4>风格摘要</h4>
            <p>{{ refStore.analysis?.style_summary }}</p>
          </div>

          <div class="analysis-grid">
            <div class="analysis-item">
              <span class="ai-label">写作特点</span>
              <div class="ai-tags">
                <el-tag v-for="f in refStore.analysis?.writing_features" :key="f" size="small">
                  {{ f }}
                </el-tag>
              </div>
            </div>
            <div class="analysis-item">
              <span class="ai-label">叙事视角</span>
              <span class="ai-value">{{ refStore.analysis?.narrative_perspective }}</span>
            </div>
            <div class="analysis-item">
              <span class="ai-label">节奏特点</span>
              <span class="ai-value">{{ refStore.analysis?.pace_description }}</span>
            </div>
            <div class="analysis-item">
              <span class="ai-label">对话风格</span>
              <span class="ai-value">{{ refStore.analysis?.dialogue_style }}</span>
            </div>
          </div>

          <div class="analysis-section">
            <h4>主要角色</h4>
            <div v-if="refStore.analysis?.main_characters.length" class="char-list">
              <div v-for="c in refStore.analysis?.main_characters" :key="c.name" class="char-item">
                <span class="char-name">{{ c.name }}</span>
                <span class="char-role">{{ c.role }}</span>
                <span class="char-traits">{{ c.traits }}</span>
              </div>
            </div>
          </div>

          <div class="analysis-section">
            <h4>适合仿写的维度</h4>
            <div class="imitable-list">
              <el-tag
                v-for="a in refStore.analysis?.imitable_aspects"
                :key="a"
                type="warning"
                effect="plain"
              >
                {{ a }}
              </el-tag>
            </div>
          </div>

          <!-- 选择写作模式 -->
          <el-divider />
          <div class="mode-section">
            <h4>选择写作模式</h4>
            <div class="mode-options">
              <div
                v-for="(info, key) in WRITING_MODES"
                :key="key"
                class="mode-card"
                :class="{ active: refStore.writingMode === key }"
                @click="refStore.setWritingMode(key as WritingMode)"
              >
                <span class="mode-emoji">{{ info.emoji }}</span>
                <span class="mode-label">{{ info.label }}</span>
                <span class="mode-desc">{{ info.desc }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div class="footer-left">
          <el-steps :active="stepIndex" simple size="small">
            <el-step title="选择文件" />
            <el-step title="选择章节" />
            <el-step title="分析与模式" />
          </el-steps>
        </div>
        <div class="footer-right">
          <el-button @click="handleCancel">
            {{ step === 'analysis' && refStore.writingMode ? '开始写作' : '取消' }}
          </el-button>
          <el-button
            v-if="step === 'preview'"
            type="primary"
            :loading="refStore.isAnalyzing"
            @click="handleAnalyze"
          >
            开始分析
          </el-button>
          <el-button
            v-if="step === 'analysis' && refStore.writingMode"
            type="primary"
            @click="handleConfirm"
          >
            确认使用 {{ refStore.currentMode?.label }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useReferenceStore } from "@/stores/reference";
import { WRITING_MODES } from "@/types";
import type { WritingMode } from "@/types";

const emit = defineEmits<{
  confirm: [];
  close: [];
}>();

const refStore = useReferenceStore();
const visible = defineModel<boolean>("visible");

const step = ref<"select" | "preview" | "analysis">("select");

const stepIndex = computed(() => {
  const map = { select: 0, preview: 1, analysis: 2 };
  return map[step.value];
});

// 重置步骤
watch(visible, (val) => {
  if (!val) {
    setTimeout(() => { step.value = "select"; }, 300);
  }
});

async function handleSelectFile() {
  try {
    // 使用 Tauri 原生文件选择对话框
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "小说文件",
          extensions: ["txt", "md"],
        },
      ],
    });

    if (selected) {
      await refStore.importFile(selected as string);
      step.value = "preview";
    }
  } catch (e) {
    // Fallback: 使用 input file
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) {
        // 对于非 Tauri 环境，在前端直接分章
        // 简化处理，将文件内容写到临时路径
        console.error("请在 Tauri 桌面端使用此功能");
      }
    };
    input.click();
  }
}

async function handleAnalyze() {
  step.value = "analysis";
  await refStore.analyzeNovel();
}

function handleConfirm() {
  emit("confirm");
  visible.value = false;
}

function handleCancel() {
  if (step.value === "analysis" && refStore.writingMode) {
    // 直接确认
    handleConfirm();
  } else {
    refStore.clear();
    visible.value = false;
  }
}

function formatTime(t?: string) {
  if (!t) return "";
  return t.slice(0, 10);
}
</script>

<style scoped>
.import-container {
  min-height: 300px;
}

.import-step {
  padding: 8px 0;
}

.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  border: 2px dashed #dcdfe6;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-zone:hover {
  border-color: #409eff;
  background: #f5f7fa;
}

.upload-text {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.upload-hint {
  font-size: 12px;
  color: #c0c4cc;
}

.import-tips {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.import-tips h4 {
  font-size: 13px;
  margin-bottom: 8px;
}

.import-tips ul {
  font-size: 12px;
  color: #606266;
  line-height: 1.8;
  padding-left: 16px;
}

.import-tips code {
  background: #e8eaed;
  padding: 1px 4px;
  border-radius: 2px;
  font-size: 11px;
}

.import-success {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f0f9eb;
  border-radius: 8px;
}

.import-info h4 {
  font-size: 14px;
  margin-bottom: 2px;
}

.import-info p {
  font-size: 12px;
  color: #909399;
}

.sample-section {
  margin-top: 8px;
}

.sample-section h4 {
  font-size: 13px;
  margin-bottom: 4px;
}

.sample-hint {
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.chapter-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.analyzing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  color: #909399;
}

.is-loading {
  animation: rotating 1.5s linear infinite;
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.analysis-summary {
  margin-bottom: 16px;
}

.analysis-summary h4 {
  font-size: 13px;
  margin-bottom: 6px;
  color: #606266;
}

.analysis-summary p {
  font-size: 14px;
  line-height: 1.6;
  color: #303133;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.analysis-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-label {
  font-size: 12px;
  color: #909399;
  font-weight: 500;
}

.ai-value {
  font-size: 13px;
  color: #303133;
}

.ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.analysis-section {
  margin-bottom: 16px;
}

.analysis-section h4 {
  font-size: 13px;
  margin-bottom: 8px;
  color: #606266;
}

.char-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.char-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
}

.char-name {
  font-weight: 600;
  color: #409eff;
  min-width: 60px;
}

.char-role {
  color: #909399;
  min-width: 80px;
}

.char-traits {
  color: #606266;
}

.imitable-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-section h4 {
  font-size: 13px;
  margin-bottom: 12px;
  color: #606266;
}

.mode-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.mode-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-card:hover {
  border-color: #409eff;
  background: #f5f7fa;
}

.mode-card.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.mode-emoji {
  font-size: 20px;
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.mode-desc {
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-left {
  flex: 1;
  margin-right: 16px;
}

.footer-left :deep(.el-steps) {
  background: transparent;
}
</style>
