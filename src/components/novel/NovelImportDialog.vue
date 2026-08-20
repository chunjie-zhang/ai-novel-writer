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
          <div class="sample-head">
            <h4>选择分析样本章节：</h4>
            <div class="sample-actions">
              <el-button size="small" text type="primary" @click="selectAllChapters">全选</el-button>
              <el-button size="small" text @click="refStore.selectedChapters = []">取消全选</el-button>
            </div>
          </div>
          <p class="sample-hint">选择 1-5 章作为 AI 分析样本（默认前 3 章，可一键全选；章节过多时自动取前 30 章保证分析质量）</p>

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

          <!-- 选择写作技能 -->
          <el-divider />
          <div class="mode-section">
            <h4>选择写作技能</h4>
            <p class="mode-subtitle">从技能库中选择要使用的写作技能（可多选，选中后生成时生效）</p>

            <!-- 搜索 + 分类筛选 -->
            <div class="mode-filter">
              <el-input
                v-model="skillStore.searchQuery"
                placeholder="搜索技能..."
                size="small"
                clearable
                prefix-icon="Search"
                class="mode-search"
              />
              <div class="mode-cats">
                <el-tag
                  :type="skillStore.activeCategory === null ? 'primary' : 'info'"
                  size="small"
                  effect="plain"
                  class="mode-cat-tag"
                  @click="skillStore.setCategory(null)"
                >全部</el-tag>
                <el-tag
                  v-for="cat in skillStore.activeCategories"
                  :key="cat.key"
                  :type="skillStore.activeCategory === cat.key ? 'primary' : 'info'"
                  size="small"
                  effect="plain"
                  class="mode-cat-tag"
                  @click="skillStore.setCategory(cat.key)"
                >
                  <el-icon :size="13" style="vertical-align:-2px"><Icon :icon="cat.icon" /></el-icon>
                  {{ cat.label }}
                </el-tag>
              </div>
            </div>

            <!-- 技能库（可多选） -->
            <div class="mode-skills">
              <div
                v-for="skill in skillStore.filteredSkills"
                :key="skill.id"
                class="mode-card mode-skill"
                :class="{ active: skillStore.activeSkillIds.includes(skill.id) }"
                @click="toggleSkillSelect(skill)"
              >
                <span class="mode-emoji">
                  <Icon v-if="skill.icon" :icon="skill.icon" :width="18" :height="18" />
                  <span v-else>{{ skill.emoji }}</span>
                </span>
                <div class="mode-info">
                  <span class="mode-label">{{ skill.name }}</span>
                  <span class="mode-desc">{{ skill.description }}</span>
                </div>
                <span class="mode-check" v-if="skillStore.activeSkillIds.includes(skill.id)">
                  <Icon icon="lucide:check" :width="14" :height="14" />
                </span>
              </div>
              <div v-if="skillStore.filteredSkills.length === 0" class="mode-empty">
                <el-empty description="没有匹配的技能" :image-size="50" />
              </div>
            </div>

            <!-- 已选技能汇总 -->
            <div v-if="skillStore.activeSkills.length" class="mode-selected">
              <span class="mode-selected-label">已选：</span>
              <el-tag
                v-for="s in skillStore.activeSkills"
                :key="s.id"
                size="small"
                type="success"
                effect="light"
                closable
                class="mode-selected-tag"
                @close="skillStore.removeActiveSkill(s.id)"
              >
                {{ s.name }}
              </el-tag>
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
            <el-step title="分析与技能" />
          </el-steps>
        </div>
        <div class="footer-right">
          <el-button @click="handleCancel">
            {{ step === 'analysis' && hasSelection ? '开始写作' : '取消' }}
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
            v-if="step === 'analysis' && hasSelection"
            type="primary"
            @click="handleConfirm"
          >
            确认使用 {{ confirmLabel }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Icon } from "@iconify/vue";
import { useReferenceStore } from "@/stores/reference";
import { useSkillStore } from "@/skills/store";

const emit = defineEmits<{
  confirm: [];
  close: [];
}>();

const refStore = useReferenceStore();
const skillStore = useSkillStore();
const visible = defineModel<boolean>("visible");

/** 是否有已选技能 */
const hasSelection = computed(() => skillStore.activeSkills.length > 0);

/** 确认按钮文案：已选技能名 */
const confirmLabel = computed(() =>
  skillStore.activeSkills.map((s) => s.name).join("、")
);

/** 切换技能选中状态（追加/取消） */
function toggleSkillSelect(skill: any) {
  skillStore.selectSkill(skill.id);
}

/** 全选所有章节作为分析样本（上传小说可能上千章，避免逐章勾选） */
function selectAllChapters() {
  refStore.selectedChapters = refStore.chapters.map((c) => c.index);
}

const step = ref<"select" | "preview" | "analysis">("select");

const stepIndex = computed(() => {
  const map = { select: 0, preview: 1, analysis: 2 };
  return map[step.value];
});

// 重置步骤
watch(visible, (val) => {
  if (!val) {
    setTimeout(() => { step.value = "select"; }, 300);
  } else {
    // 打开时重置搜索与分类筛选
    skillStore.setSearch("");
    skillStore.setCategory(null);
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
  if (step.value === "analysis" && hasSelection.value) {
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
  border: 2px dashed var(--border-light);
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--panel-bg-2);
}

.upload-zone:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
}

.upload-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-3);
}

.import-tips {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.import-tips h4 {
  font-size: 13px;
  margin-bottom: 8px;
  color: var(--text-1);
}

.import-tips ul {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.8;
  padding-left: 16px;
}

.import-tips code {
  background: var(--panel-hover);
  color: #e0b78a;
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 11px;
}

.import-success {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--green-soft);
  border: 1px solid rgba(70, 208, 127, 0.25);
  border-radius: 10px;
}

.import-info h4 {
  font-size: 14px;
  margin-bottom: 2px;
  color: var(--text-1);
}

.import-info p {
  font-size: 12px;
  color: var(--text-2);
}

.sample-section {
  margin-top: 8px;
}

.sample-section h4 {
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--text-1);
}

.sample-hint {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 12px;
}

.sample-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.sample-head h4 {
  margin: 0;
}
.sample-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
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
  color: var(--text-2);
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
  color: var(--text-2);
}

.analysis-summary p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-1);
  padding: 8px 12px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
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
  color: var(--text-2);
  font-weight: 500;
}

.ai-value {
  font-size: 13px;
  color: var(--text-1);
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
  color: var(--text-2);
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
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
}

.char-name {
  font-weight: 600;
  color: var(--accent);
  min-width: 60px;
}

.char-role {
  color: var(--text-2);
  min-width: 80px;
}

.char-traits {
  color: var(--text-2);
}

.imitable-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mode-section h4 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-1);
}

.mode-subtitle {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}

/* 搜索 + 分类 */
.mode-filter {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.mode-search {
  width: 100%;
}

.mode-cats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mode-cat-tag {
  cursor: pointer;
}

/* 技能库网格（可滚动，两列强制等宽，避免长描述撑破列宽） */
.mode-skills {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  padding: 2px;
}

.mode-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--panel-bg-2);
  min-width: 0;
}

.mode-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
}

.mode-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* 图标：圆形渐变底 */
.mode-skill .mode-emoji {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  flex-shrink: 0;
}

.mode-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
  padding-right: 14px; /* 给右上角勾选图标留空间 */
}

.mode-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode-desc {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
}

.mode-check {
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--accent);
  display: inline-flex;
}

.mode-empty {
  grid-column: 1 / -1;
  padding: 12px 0;
}

/* 已选技能汇总条 */
.mode-selected {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 10px;
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.mode-selected-label {
  font-size: 12px;
  color: var(--text-2);
  flex-shrink: 0;
}

.mode-selected-tag {
  max-width: 100%;
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
