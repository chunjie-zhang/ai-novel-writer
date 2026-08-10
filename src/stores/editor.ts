import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { ChapterInfo } from "@/types";
import { useVersionsStore } from "@/stores/versions";
import { useProjectStore } from "@/stores/project";
import {
  extractChapterTitle,
  buildChapterFileName,
} from "@/utils/chapterTitle";

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

  /** 保存章节并同步标题（若首行 Markdown 标题被修改，自动重命名文件并刷新左侧树） */
  async function syncChapterTitleIfChanged(projectId: string) {
    const chapter = currentChapter.value;
    if (!chapter) return;

    const newTitle = extractChapterTitle(content.value);
    if (!newTitle || newTitle === chapter.title) return;

    const oldFileName = chapter.file_name;
    const newFileName = buildChapterFileName(newTitle, chapter.group || "");
    if (newFileName === oldFileName) return;

    try {
      await invoke("rename_chapter", {
        projectId,
        oldName: oldFileName,
        newName: newFileName,
      });

      // 迁移历史版本到新文件名
      useVersionsStore().renameChapter(projectId, oldFileName, newFileName);

      // 更新内存中的章节信息
      chapter.title = newTitle;
      chapter.file_name = newFileName;

      // 迁移断稿记忆中的文件名
      const mem = loadCursorMemory();
      if (mem && mem.chapterFileName === oldFileName) {
        mem.chapterFileName = newFileName;
        saveCursorMemory(mem);
      }

      // 刷新左侧项目树（标题/文件名随之更新）
      await useProjectStore().openProject(projectId);

      // 通知 UI 标题已同步
      window.dispatchEvent(
        new CustomEvent("chapter-title-synced", { detail: newTitle })
      );
    } catch (e) {
      console.error("同步章节标题失败:", e);
      // 改名失败不阻断保存结果，仅提示
      window.dispatchEvent(new CustomEvent("chapter-title-sync-error"));
    }
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

      // 保存时自动记录章节历史版本
      useVersionsStore().recordVersion(
        projectId,
        currentChapter.value.file_name,
        content.value
      );

      // 保存时同步章节标题（首行 # 标题变更 → 重命名文件 + 刷新左侧树）
      await syncChapterTitleIfChanged(projectId);

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
    const added = Math.max(
      0,
      newContent.replace(/\s/g, "").length - wordCount.value
    );
    content.value = newContent;
    // 仅当字数增加时上报「用户输入」增量；
    // 打开章节 / 切换章节 / 新建章节直接设置 content，不经过这里，因此不会误计入日更字数。
    if (added > 0) {
      window.dispatchEvent(new CustomEvent("editor-user-input", { detail: added }));
    }
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
