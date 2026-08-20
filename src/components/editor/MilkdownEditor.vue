<template>
  <div class="milkdown-editor" v-loading="!ready">
    <MilkdownProvider>
      <MilkdownEditorContent
        ref="contentRef"
        :model-value="modelValue"
        @update:model-value="handleUpdate"
        @cursor-update="handleCursorUpdate"
        @ready="ready = true"
      />
    </MilkdownProvider>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { MilkdownProvider } from "@milkdown/vue";
import MilkdownEditorContent from "./MilkdownEditorContent.vue";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "cursor-update": [pos: number, scroll: number];
}>();

const ready = ref(false);
const contentRef = ref<InstanceType<typeof MilkdownEditorContent> | null>(null);

function handleUpdate(value: string) {
  emit("update:modelValue", value);
}

function handleCursorUpdate(pos: number, scroll: number) {
  emit("cursor-update", pos, scroll);
}

// 透传选区能力给 MainEditor
function getSelectionText(): string {
  return contentRef.value?.getSelectionText?.() ?? "";
}
function replaceSelection(newText: string, range?: { from: number; to: number }) {
  contentRef.value?.replaceSelection?.(newText, range);
}
function getSelectionRange(): { from: number; to: number } {
  return contentRef.value?.getSelectionRange?.() ?? { from: 0, to: 0 };
}
function getLastSelectionRange(): { from: number; to: number } | null {
  return contentRef.value?.getLastSelectionRange?.() ?? null;
}
// 透传光标/滚动恢复能力（断稿记忆回溯）
function applyCursorRestore(pos: number, scroll: number) {
  contentRef.value?.applyCursorRestore?.(pos, scroll);
}

defineExpose({ getSelectionText, replaceSelection, applyCursorRestore, getSelectionRange, getLastSelectionRange });
</script>

<style scoped>
.milkdown-editor {
  height: 100%;
  overflow-y: auto;
  padding: 28px 40px;
  background: var(--editor-bg, var(--panel-bg));
}

/* Milkdown 编辑器样式覆盖（深色阅读） */
:deep(.milkdown) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  /* 行高收紧：光标（caret）高度 = 行框高度，行高越小光标/选区越紧凑精致 */
  line-height: 1.7;
  color: var(--text-1);
  max-width: 720px;
  margin: 0 auto;
}

/* ProseMirror 推荐：保持段落内换行与空格（消除控制台 white-space 警告） */
:deep(.milkdown .ProseMirror) {
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 60vh;
  outline: none;
}

:deep(.milkdown h1) {
  font-size: 1.8em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3em;
  color: var(--text-1);
}

:deep(.milkdown h2) {
  font-size: 1.4em;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  color: var(--text-1);
}

:deep(.milkdown h3) {
  font-size: 1.2em;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
  color: var(--text-1);
}

:deep(.milkdown p) {
  margin-bottom: 1em;
  text-indent: 2em;
}

:deep(.milkdown blockquote) {
  border-left: 3px solid var(--accent);
  padding-left: 1em;
  color: var(--text-2);
  font-style: italic;
}

:deep(.milkdown pre) {
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  color: var(--text-1);
}

:deep(.milkdown code) {
  background: var(--panel-bg-2);
  color: #e0b78a;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* 光标与选区：统一品牌色，聚焦更清晰美观（深浅主题均适用） */
:deep(.milkdown .ProseMirror) {
  caret-color: var(--accent);
}
:deep(.milkdown .ProseMirror-selectednode) {
  outline: 1.5px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
:deep(.milkdown ::selection) {
  background: var(--accent-soft);
  color: inherit;
}
/* 段落空隙处的块状光标（gapcursor）统一为品牌竖条，避免深浅不一的默认样式 */
:deep(.milkdown .ProseMirror-gapcursor) {
  border-left: 2px solid var(--accent);
}
:deep(.milkdown .ProseMirror-gapcursor span) {
  width: 2px;
  background: var(--accent);
}
</style>
