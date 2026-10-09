import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  AUTHOR_STYLES,
  MAX_ACTIVE_AUTHORS,
  buildAuthorStylePrompt,
} from "@/data/authorStyles";

const STORAGE_KEY = "novel-author-styles-active";

/** 从 localStorage 读取已选名家（过滤掉已不存在的 id，避免版本变更后残留） */
function loadActiveIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (id) => typeof id === "string" && AUTHOR_STYLES.some((a) => a.id === id)
    );
  } catch {
    return [];
  }
}

export const useAuthorStyleStore = defineStore("authorStyle", () => {
  /** 已选中的名家笔法 id（可多选，最多 MAX_ACTIVE_AUTHORS 位） */
  const activeIds = ref<string[]>(loadActiveIds());

  function persist() {
    try {
      if (activeIds.value.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(activeIds.value));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("保存名家笔法选择失败:", e);
    }
  }

  const allAuthors = computed(() => AUTHOR_STYLES);
  const activeAuthors = computed(() =>
    AUTHOR_STYLES.filter((a) => activeIds.value.includes(a.id))
  );
  const hasActive = computed(() => activeAuthors.value.length > 0);
  /** 注入 AI 的笔法 prompt 片段（未选则为空字符串） */
  const stylePrompt = computed(() => buildAuthorStylePrompt(activeAuthors.value));
  /** 是否还能继续添加（用于 UI 提示） */
  const canAddMore = computed(() => activeIds.value.length < MAX_ACTIVE_AUTHORS);

  /**
   * 切换某位名家的选中状态。
   * @returns "added" 已添加 | "removed" 已移除 | "limit" 已达数量上限
   */
  function toggleAuthor(id: string): "added" | "removed" | "limit" {
    if (activeIds.value.includes(id)) {
      activeIds.value = activeIds.value.filter((x) => x !== id);
      persist();
      return "removed";
    }
    if (activeIds.value.length >= MAX_ACTIVE_AUTHORS) {
      return "limit";
    }
    activeIds.value = [...activeIds.value, id];
    persist();
    return "added";
  }

  /** 清空全部选择 */
  function clear() {
    activeIds.value = [];
    persist();
  }

  return {
    activeIds,
    allAuthors,
    activeAuthors,
    hasActive,
    stylePrompt,
    canAddMore,
    maxActive: MAX_ACTIVE_AUTHORS,
    toggleAuthor,
    clear,
  };
});
