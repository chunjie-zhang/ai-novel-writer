import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { ChapterInfo } from "@/types";

const CURSOR_STORAGE_KEY = "novel-cursor-memory";

interface CursorMemory {
  projectId: string;
  chapterFileName: string;
  cursorPosition: number;
  scrollPosition: number;
  timestamp: number;
}

function loadCursorMemory(): CursorMemory | null {
  try {
    const raw = localStorage.getItem(CURSOR_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("loadCursorMemory 失败:", e); }
  return null;
}

function saveCursorMemory(memory: CursorMemory) {
  localStorage.setItem(CURSOR_STORAGE_KEY, JSON.stringify(memory));
}

export const useEditorStore = defineStore("editor", () => {
  // 状态
  const currentChapter = ref<ChapterInfo | null>(null);
  const content = ref("");
  const isSaving = ref(false);
  const lastSavedContent = ref("");

  // 断稿记忆状态
  const cursorPosition = ref(0);
  const scrollPosition = ref(0);
  const lastMemory = ref<CursorMemory | null>(loadCursorMemory());

  // 计算属性
  const isModified = computed(() => content.value !== lastSavedContent.value);
  const wordCount = computed(() => {
    return content.value.replace(/\s/g, "").length;
  });
  const hasMemory = computed(() => lastMemory.value !== null);

  // 自动保存断稿记忆（防抖：每次内容变化后 3 秒存一次）
  let memoryTimer: ReturnType<typeof setTimeout> | null = null;
  watch([content, cursorPosition, scrollPosition, currentChapter], () => {
    if (memoryTimer) clearTimeout(memoryTimer);
    memoryTimer = setTimeout(() => {
      if (currentChapter.value?.file_name) {
        saveCursorMemory({
          projectId: "",
          chapterFileName: currentChapter.value.file_name,
          cursorPosition: cursorPosition.value,
          scrollPosition: scrollPosition.value,
          timestamp: Date.now(),
        });
      }
    }, 3000);
  });

  // 方法
  async function openChapter(chapter: ChapterInfo, chapterContent: string) {
    currentChapter.value = chapter;
    content.value = chapterContent;
    lastSavedContent.value = chapterContent;
    cursorPosition.value = 0;
    scrollPosition.value = 0;
  }

  /** 打开章节并尝试恢复光标位置 */
  async function openChapterWithMemory(
    chapter: ChapterInfo,
    chapterContent: string,
    projectId: string
  ) {
    currentChapter.value = chapter;
    content.value = chapterContent;
    lastSavedContent.value = chapterContent;

    // 检查是否有断稿记忆
    const mem = loadCursorMemory();
    if (mem && mem.chapterFileName === chapter.file_name) {
      cursorPosition.value = mem.cursorPosition;
      scrollPosition.value = mem.scrollPosition;
      // 保存 projectId
      mem.projectId = projectId;
      saveCursorMemory(mem);
    } else {
      cursorPosition.value = 0;
      scrollPosition.value = 0;
    }
  }

  /** 清除断稿记忆 */
  function clearMemory() {
    localStorage.removeItem(CURSOR_STORAGE_KEY);
    lastMemory.value = null;
  }

  /** 更新光标位置 */
  function updateCursor(pos: number) {
    cursorPosition.value = pos;
  }

  /** 更新滚动位置 */
  function updateScroll(pos: number) {
    scrollPosition.value = pos;
  }

  async function saveChapter(projectId: string) {
    if (!currentChapter.value || !isModified.value) return;

    isSaving.value = true;
    try {
      await invoke("save_chapter", {
        projectId,
        chapterTitle: currentChapter.value.title,
        group: currentChapter.value.group || "",
        content: content.value,
      });
      lastSavedContent.value = content.value;

      // 保存时同时更新断稿记忆
      saveCursorMemory({
        projectId,
        chapterFileName: currentChapter.value.file_name,
        cursorPosition: cursorPosition.value,
        scrollPosition: scrollPosition.value,
        timestamp: Date.now(),
      });

      currentChapter.value.word_count = wordCount.value;
    } finally {
      isSaving.value = false;
    }
  }

  async function createChapter(projectId: string, title: string, group: string = "") {
    // 清理文件名中的特殊字符，与 Rust 后端 save_chapter 保持一致
    const safeTitle = title.replace(/[<>:"\\|?*/]/g, "_");
    const defaultContent = `# ${title}\n\n`;
    const filePath = await invoke<string>("save_chapter", {
      projectId,
      chapterTitle: safeTitle,
      group,
      content: defaultContent,
    });

    const newChapter: ChapterInfo = {
      id: title,
      title,
      file_name: filePath,
      group,
      order: 0,
      word_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    currentChapter.value = newChapter;
    content.value = defaultContent;
    lastSavedContent.value = defaultContent;
    cursorPosition.value = 0;
    scrollPosition.value = 0;
  }

  function setContent(newContent: string) {
    content.value = newContent;
  }

  function insertContent(text: string) {
    content.value += text;
  }

  function closeChapter() {
    currentChapter.value = null;
    content.value = "";
    lastSavedContent.value = "";
    cursorPosition.value = 0;
    scrollPosition.value = 0;
  }

  return {
    currentChapter,
    content,
    isSaving,
    lastSavedContent,
    isModified,
    wordCount,
    hasMemory,
    cursorPosition,
    scrollPosition,
    lastMemory,
    openChapter,
    openChapterWithMemory,
    clearMemory,
    updateCursor,
    updateScroll,
    saveChapter,
    createChapter,
    setContent,
    insertContent,
    closeChapter,
  };
});
