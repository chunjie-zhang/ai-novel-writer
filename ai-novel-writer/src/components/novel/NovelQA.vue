<template>
  <el-dialog v-model="visible" title="🔍 全书问答检索" width="660px" append-to-body>
    <!-- 提示 / 索引状态 -->
    <div v-if="!result" class="qa-tip">
      <p>基于全书语义检索的问答：输入问题，AI 会从所有章节中召回相关片段回答，并给出章节溯源。</p>
      <p v-if="qaStore.isIndexing" class="qa-index">
        <el-icon class="is-loading"><Icon icon="lucide:loader-2" /></el-icon>
        正在构建全文索引…
      </p>
      <p v-else-if="qaStore.blockCount" class="qa-index">
        ✅ 已索引 {{ qaStore.chapterCount }} 章 / {{ qaStore.blockCount }} 个片段，可以提问了
      </p>
      <p v-else class="qa-index warn">⚠️ 当前小说还没有可检索的章节</p>
    </div>

    <!-- 回答结果 -->
    <div v-if="result" class="qa-result">
      <div class="qa-answer">{{ result.answer }}</div>
      <div v-if="result.sources.length" class="qa-sources">
        <h4>📌 参考资料（点击打开对应章节）</h4>
        <div
          v-for="(s, i) in result.sources"
          :key="i"
          class="qa-source"
          @click="openSource(s)"
        >
          <el-icon><Icon icon="lucide:book-open" /></el-icon>
          <span class="qa-source-title">{{ s.chapterTitle }}</span>
          <span class="qa-source-snippet">{{ s.snippet }}</span>
        </div>
      </div>
    </div>

    <!-- 提问输入 -->
    <div class="qa-input">
      <el-input
        v-model="question"
        placeholder="如：主角在第几章获得了什么宝物？"
        :disabled="qaStore.isAsking"
        @keyup.enter="handleAsk"
      />
      <el-button
        type="primary"
        :loading="qaStore.isAsking"
        :disabled="!question.trim()"
        @click="handleAsk"
      >
        提问
      </el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useQAStore, type QAResult } from "@/stores/qa";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";

const props = defineProps<{
  visible: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
}>();

const visible = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const qaStore = useQAStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();

const question = ref("");
const result = ref<QAResult | null>(null);

watch(visible, (v) => {
  if (v && props.projectId) {
    qaStore.buildIndex(props.projectId);
    question.value = "";
    result.value = null;
  }
});

async function handleAsk() {
  if (!props.projectId || !question.value.trim() || qaStore.isAsking) return;
  result.value = await qaStore.ask(props.projectId, question.value.trim());
}

/** 点击溯源打开对应章节 */
async function openSource(s: QAResult["sources"][number]) {
  const projectId = props.projectId;
  if (!projectId) return;
  await projectStore.openProject(projectId);
  try {
    const content = await invoke<string>("read_chapter", {
      projectId,
      fileName: s.chapterFileName,
    });
    const chapter = projectStore.chapters.find(
      (c) => c.file_name === s.chapterFileName
    );
    if (chapter) {
      editorStore.openChapterWithMemory(chapter, content, projectId);
    }
  } catch (e) {
    console.error("打开章节失败:", e);
  }
}
</script>

<style scoped>
.qa-tip {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
.qa-index {
  font-size: 12px;
  color: #67c23a;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}
.qa-index.warn {
  color: #e6a23c;
}
.qa-result {
  margin-bottom: 12px;
}
.qa-answer {
  background: #f0f9eb;
  border-radius: 8px;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.qa-sources h4 {
  font-size: 13px;
  color: #606266;
  margin: 0 0 8px;
}
.qa-source {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #f5f7fa;
  cursor: pointer;
  transition: background 0.15s;
  margin-bottom: 6px;
}
.qa-source:hover {
  background: #ecf5ff;
}
.qa-source-title {
  font-size: 13px;
  color: #409eff;
  flex-shrink: 0;
}
.qa-source-snippet {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.qa-input {
  display: flex;
  gap: 8px;
}
</style>
