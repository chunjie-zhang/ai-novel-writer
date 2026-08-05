<template>
  <div class="milkdown-editor" v-loading="!ready">
    <MilkdownProvider>
      <Milkdown v-if="ready" />
      <div v-else class="editor-loading">编辑器加载中...</div>
    </MilkdownProvider>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { MilkdownProvider, Milkdown, useEditor } from "@milkdown/vue";
import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "cursor-update": [pos: number, scroll: number];
}>();

const ready = ref(false);
let contentUpdateLock = false;
let editorInstance: any = null;

// 使用 useEditor 创建编辑器实例
useEditor((root) => {
  editorInstance = (Editor.make() as any)
    .config((ctx: any) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.modelValue);
      ctx.get(listenerCtx).markdownUpdated((_: any, markdown: string) => {
        if (!contentUpdateLock) {
          emit("update:modelValue", markdown);
        }
      });
    })
    .use(commonmark)
    .use(nord)
    .use(listener);
  return editorInstance;
});

// 监听外部内容变化，同步到编辑器
watch(
  () => props.modelValue,
  (newVal) => {
    if (editorInstance && newVal !== undefined) {
      contentUpdateLock = true;
      editorInstance.action((ctx: any) => {
        ctx.set(defaultValueCtx, newVal);
      });
      // 下一帧释放锁，避免循环
      requestAnimationFrame(() => { contentUpdateLock = false; });
    }
  }
);

onMounted(() => {
  // 编辑器实例创建后标记就绪
  requestAnimationFrame(() => { ready.value = true; });
});

onBeforeUnmount(() => {
  editorInstance = null;
});
</script>

<style scoped>
.milkdown-editor {
  height: 100%;
  overflow-y: auto;
  padding: 28px 40px;
  background: var(--panel-bg);
}

.editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 14px;
}

/* Milkdown 编辑器样式覆盖（深色阅读） */
:deep(.milkdown) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.85;
  color: var(--text-1);
  max-width: 720px;
  margin: 0 auto;
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

/* 光标与选区在深色下可见 */
:deep(.milkdown .ProseMirror-selectednode) {
  outline: 1px solid var(--accent);
}

:deep(.milkdown ::selection) {
  background: var(--accent-soft);
}
</style>
