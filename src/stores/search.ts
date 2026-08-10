import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  line: number;
  content: string;
  matchText: string;
}

export const useSearchStore = defineStore("search", () => {
  const query = ref("");
  const results = ref<SearchResult[]>([]);
  const isSearching = ref(false);

  async function search(projectId: string, keyword: string) {
    query.value = keyword;
    if (!keyword.trim()) {
      results.value = [];
      return;
    }

    isSearching.value = true;
    const found: SearchResult[] = [];

    try {
      const structure = await invoke<any>("get_project_structure", { projectId });
      const chapters = structure.chapters || [];

      for (const ch of chapters) {
        const content = await invoke<string>("read_chapter", {
          projectId,
          fileName: ch.file_name,
        });

        const lines = content.split("\n");
        let idx = content.toLowerCase().indexOf(keyword.toLowerCase());

        while (idx >= 0) {
          // 计算行号
          const beforeText = content.slice(0, idx);
          const lineNum = beforeText.split("\n").length;
          const lineContent = lines[lineNum - 1] || "";

          // 提取上下文
          const contextStart = Math.max(0, idx - 20);
          const contextEnd = Math.min(content.length, idx + keyword.length + 30);
          const context = content.slice(contextStart, contextEnd).replace(/\n/g, " ");

          found.push({
            chapterId: ch.file_name,
            chapterTitle: ch.title,
            line: lineNum,
            content: lineContent,
            matchText: context,
          });

          // 查找下一个
          idx = content.toLowerCase().indexOf(keyword.toLowerCase(), idx + 1);
        }
      }
    } catch (e) {
      console.error("搜索失败:", e);
    }

    results.value = found;
    isSearching.value = false;
  }

  function clear() {
    query.value = "";
    results.value = [];
  }

  return { query, results, isSearching, search, clear };
});
