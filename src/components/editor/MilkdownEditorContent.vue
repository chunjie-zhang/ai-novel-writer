<template>
  <Milkdown v-if="ready" />
  <div v-else class="editor-loading">编辑器加载中...</div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { Milkdown, useEditor } from "@milkdown/vue";
import { TextSelection } from "prosemirror-state";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  parserCtx,
  editorViewCtx,
  serializerCtx,
} from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { nord } from "@milkdown/theme-nord";
import { listener, listenerCtx } from "@milkdown/plugin-listener";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "cursor-update": [pos: number, scroll: number];
  ready: [];
}>();

const ready = ref(false);
// 防止"外部→内部"同步与"内部→外部"监听形成死循环
let lock = false;

// 本组件必须被 <MilkdownProvider> 包裹（由父级 MilkdownEditor.vue 提供），
// useEditor 才能通过 inject 拿到 editorFactory 上下文。
const editorRef = useEditor((root) => {
  const editor = (Editor.make() as any)
    .config((ctx: any) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, props.modelValue);
      ctx.get(listenerCtx).markdownUpdated((_: any, markdown: string) => {
        if (!lock) {
          emit("update:modelValue", markdown);
        }
      });
    })
    .use(commonmark)
    .use(nord)
    .use(listener);
  return editor;
});

onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true;
    emit("ready");
    trackCursor();
    // 编辑器就绪后，若有待恢复的光标/滚动则应用（断稿记忆回溯）
    if (pendingPos !== null || pendingScroll !== null) {
      applyCursorRestore(pendingPos ?? 0, pendingScroll ?? 0);
      pendingPos = null;
      pendingScroll = null;
    }
  });
});

onBeforeUnmount(() => {
  cleanupCursorTracking?.();
});

// ---- 光标 / 滚动追踪（供断稿记忆「光标 / 滚动位置回溯」）----
let cleanupCursorTracking: (() => void) | null = null;
let pendingPos: number | null = null;
let pendingScroll: number | null = null;
/** 最近一次编辑器内选区范围（供点击 AI 按钮前使用；失焦后实时选区会失效，需用缓存的） */
let lastSelectionRange: { from: number; to: number } | null = null;

function getScrollTop(): number {
  const el = document.querySelector(".milkdown-editor");
  return el ? (el as HTMLElement).scrollTop : 0;
}

/** 监听 ProseMirror 选区变化 + 容器滚动，把光标位置 / 滚动位置上报给 MainEditor */
function trackCursor() {
  const editor = (editorRef as any)?.get?.();
  if (!editor) return;
  editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    const container = view.dom.closest(".milkdown-editor") as HTMLElement | null;

    const onSelection = () => {
      const sel = document.getSelection();
      if (sel && sel.rangeCount > 0 && view.dom.contains(sel.anchorNode)) {
        // 选区在编辑器内：缓存范围供「选中文本 AI 操作」使用（点击按钮失焦后实时选区失效）
        lastSelectionRange = {
          from: view.state.selection.from,
          to: view.state.selection.to,
        };
        emit("cursor-update", view.state.selection.from, getScrollTop());
      }
    };
    const onScroll = () => {
      emit("cursor-update", view.state.selection.from, getScrollTop());
    };

    document.addEventListener("selectionchange", onSelection);
    container?.addEventListener("scroll", onScroll);
    cleanupCursorTracking = () => {
      document.removeEventListener("selectionchange", onSelection);
      container?.removeEventListener("scroll", onScroll);
    };
  });
}

/** 恢复光标位置 + 滚动位置（断稿记忆回溯） */
function applyCursorRestore(pos: number, scroll: number) {
  const editor = (editorRef as any)?.get?.();
  if (!editor) {
    pendingPos = pos;
    pendingScroll = scroll;
    return;
  }
  editor.action((ctx: any) => {
    try {
      const view = ctx.get(editorViewCtx);
      const max = view.state.doc.content.size;
      const p = Math.min(Math.max(Math.round(pos || 0), 0), max);
      const tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(p)));
      view.dispatch(tr);
      view.focus();
    } catch (e) {
      console.error("恢复光标位置失败:", e);
    }
  });
  requestAnimationFrame(() => {
    const el = document.querySelector(".milkdown-editor");
    if (el) (el as HTMLElement).scrollTop = scroll || 0;
  });
}

// 外部内容变化（如切换章节、AI 回填）时，用解析后的文档替换编辑器内容。
// 注意：用户每次输入（含回车）也会触发 modelValue 变化，但那是编辑器自身的回显。
// 这里通过"编辑器当前序列化内容与外部值是否一致"来区分——一致说明是用户输入回显，跳过重建，
// 否则才是真正的外部变更（切换章节 / AI 回填 / 排版规整等），才同步到编辑器。
// 这样可避免每次回车/打字后重建整个文档导致光标丢失、换行失效。
watch(
  () => props.modelValue,
  (newVal) => {
    if (lock || newVal === undefined) return;
    const editor = (editorRef as any)?.get?.();
    if (!editor) return;

    lock = true;
    editor.action((ctx: any) => {
      try {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const serializer = ctx.get(serializerCtx);
        // 编辑器当前内容与外部值一致 → 用户输入回显，无需重建
        if (serializer(view.state.doc) === newVal) return;

        const doc = parser(newVal);
        const state = view.state;
        const tr = state.tr.replaceWith(0, state.doc.content.size, doc);
        view.dispatch(tr);
      } catch (e) {
        console.error("同步编辑器内容失败:", e);
      }
    });
    requestAnimationFrame(() => {
      lock = false;
    });
  }
);

// ---- 选区能力（供 MainEditor 的「文风采样 / 选中文本 AI 操作」调用）----

/** 获取当前编辑器选中文本（通过 ProseMirror 选区 API） */
function getSelectionText(): string {
  const editor = (editorRef as any)?.get?.();
  if (!editor) return "";
  let text = "";
  editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    text = view.state.doc.textBetween(from, to, "\n");
  });
  return text.trim();
}

/** 用新文本替换当前编辑器选区（可传入点击前缓存的选区，避免按钮点击失焦后选区丢失） */
function replaceSelection(newText: string, range?: { from: number; to: number }) {
  const editor = (editorRef as any)?.get?.();
  if (!editor) return;
  editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    let { from, to } = view.state.selection;
    // 优先使用调用前缓存的选区（按钮点击/await 期间编辑器失焦，实时选区可能已丢失）
    if (range && range.to > range.from) {
      const size = view.state.doc.content.size;
      from = Math.max(0, Math.min(range.from, size));
      to = Math.max(from, Math.min(range.to, size));
    }
    if (from === to) return; // 无选区不处理
    const tr = view.state.tr.insertText(newText, from, to);
    view.dispatch(tr);
  });
}

/** 获取当前编辑器选区范围（供点击 AI 按钮前缓存，避免失焦后选区丢失） */
function getSelectionRange(): { from: number; to: number } {
  const editor = (editorRef as any)?.get?.();
  if (!editor) return { from: 0, to: 0 };
  let range = { from: 0, to: 0 };
  editor.action((ctx: any) => {
    const view = ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    range = { from, to };
  });
  return range;
}

/** 返回最近一次编辑器内选中文字的范围（选中时缓存，不受按钮点击失焦影响） */
function getLastSelectionRange(): { from: number; to: number } | null {
  return lastSelectionRange && lastSelectionRange.to > lastSelectionRange.from
    ? lastSelectionRange
    : null;
}

defineExpose({ getSelectionText, replaceSelection, applyCursorRestore, getSelectionRange, getLastSelectionRange });
</script>

<style scoped>
.editor-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 14px;
}
</style>
