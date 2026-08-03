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
  padding: 24px 40px;
}

.editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #c0c4cc;
  font-size: 14px;
}

/* Milkdown 编辑器样式覆盖 */
:deep(.milkdown) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 16px;
  line-height: 1.8;
  color: #303133;
  max-width: 720px;
  margin: 0 auto;
}

:deep(.milkdown h1) {
  font-size: 1.8em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
}

:deep(.milkdown h2) {
  font-size: 1.4em;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

:deep(.milkdown h3) {
  font-size: 1.2em;
  margin-top: 1.2em;
  margin-bottom: 0.4em;
}

:deep(.milkdown p) {
  margin-bottom: 1em;
  text-indent: 2em;
}

:deep(.milkdown blockquote) {
  border-left: 3px solid #409eff;
  padding-left: 1em;
  color: #606266;
  font-style: italic;
}

:deep(.milkdown pre) {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 12px 16px;
  overflow-x: auto;
}

:deep(.milkdown code) {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}
</style>
