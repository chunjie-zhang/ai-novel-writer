<template>
  <el-dialog v-model="visible" title="🔍 全文搜索" width="600px">
    <div class="search-dialog">
      <div class="search-bar">
        <el-input
          v-model="searchQuery"
          placeholder="搜索关键词..."
          size="large"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Icon icon="lucide:search" /></el-icon>
          </template>
          <template #append>
            <el-button @click="handleSearch" :loading="searchStore.isSearching">搜索</el-button>
          </template>
        </el-input>
      </div>

      <div v-if="searchStore.isSearching" class="search-loading">
        <el-icon class="is-loading"><Icon icon="lucide:loader-circle" /></el-icon>
        搜索中...
      </div>

      <div v-else-if="searchStore.results.length === 0 && searchStore.query" class="search-empty">
        未找到匹配内容
      </div>

      <div v-else class="search-results">
        <div
          v-for="(r, i) in searchStore.results"
          :key="i"
          class="result-item"
          @click="handleOpenChapter(r)"
        >
          <div class="result-header">
            <span class="result-chapter">{{ r.chapterTitle }}</span>
            <span class="result-line">第 {{ r.line }} 行</span>
          </div>
          <div class="result-preview" v-html="highlightText(r.matchText)"></div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { useSearchStore } from "@/stores/search";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { invoke } from "@tauri-apps/api/core";

const visible = defineModel<boolean>("visible");
const searchStore = useSearchStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const currentProject = computed(() => projectStore.currentProject);
const searchQuery = ref("");

watch(visible, (val) => {
  if (!val) searchStore.clear();
});

async function handleSearch() {
  if (!currentProject.value) {
    ElMessage.warning("请先打开一个项目");
    return;
  }
  if (!searchQuery.value.trim()) return;
  searchStore.query = searchQuery.value;
  await searchStore.search(currentProject.value.id, searchQuery.value.trim());
}

async function handleOpenChapter(result: any) {
  if (!currentProject.value) return;
  try {
    const content = await invoke<string>("read_chapter", {
      projectId: currentProject.value.id,
      fileName: result.chapterId,
    });
    const chapter = projectStore.chapters.find((c) => c.file_name === result.chapterId);
    if (chapter) {
      editorStore.openChapterWithMemory(chapter, content, currentProject.value!.id);
      visible.value = false;
    }
  } catch (e) { console.error("打开搜索结果失败:", e); }
}

function highlightText(text: string): string {
  if (!searchStore.query) return text;
  const q = searchStore.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${q})`, "gi"), '<mark style="background:#e6a23c;color:#fff;padding:0 2px;border-radius:2px">$1</mark>');
}
</script>

<style scoped>
.search-dialog { display: flex; flex-direction: column; gap: 12px; }
.search-bar { flex-shrink: 0; }
.search-loading { text-align: center; padding: 30px; color: var(--text-2); display: flex; align-items: center; justify-content: center; gap: 8px; }
.search-empty { text-align: center; padding: 30px; color: var(--text-2); }
.search-results { max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.result-item { padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: background 0.2s; }
.result-item:hover { background: var(--panel-hover); }
.result-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
.result-chapter { font-size: 13px; font-weight: 600; color: var(--text-1); }
.result-line { font-size: 11px; color: var(--text-2); }
.result-preview { font-size: 12px; color: var(--text-2); line-height: 1.6; }
</style>
