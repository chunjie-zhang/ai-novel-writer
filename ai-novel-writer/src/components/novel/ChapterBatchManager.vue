<template>
  <el-dialog v-model="visible" title="章节批量管理" width="600px">
    <div class="batch-manager">
      <div class="bm-toolbar">
        <el-button size="small" @click="selectAll">全选</el-button>
        <el-button size="small" @click="deselectAll">取消全选</el-button>
        <el-button
          size="small"
          type="danger"
          :disabled="selectedIds.length === 0"
          @click="handleBatchDelete"
        >
          删除选中 ({{ selectedIds.length }})
        </el-button>
        <el-button
          size="small"
          :disabled="selectedIds.length === 0"
          @click="handleBatchExport"
        >
          导出选中
        </el-button>
      </div>

      <div class="bm-list">
        <div
          v-for="ch in chapters"
          :key="ch.file_name"
          class="bm-item"
          :class="{ selected: selectedIds.includes(ch.file_name) }"
          @click="toggleSelect(ch.file_name)"
        >
          <el-checkbox
            :model-value="selectedIds.includes(ch.file_name)"
            @click.stop
            @change="() => toggleSelect(ch.file_name)"
          />
          <span class="bm-order">{{ ch.order }}</span>
          <el-input
            v-model="ch.title"
            size="small"
            class="bm-title-input"
            @blur="handleRename(ch)"
            @click.stop
          />
          <span class="bm-words">{{ ch.word_count }}字</span>
          <el-button
            text
            size="small"
            type="primary"
            @click.stop="moveUp(ch)"
            :disabled="ch.order <= 1"
          >
            ↑
          </el-button>
          <el-button
            text
            size="small"
            type="primary"
            @click.stop="moveDown(ch)"
            :disabled="ch.order >= chapters.length"
          >
            ↓
          </el-button>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { invoke } from "@tauri-apps/api/core";
import type { ChapterInfo } from "@/types";

const visible = defineModel<boolean>("visible");

const props = defineProps<{
  chapters: ChapterInfo[];
  projectId: string;
}>();

const emit = defineEmits<{
  refresh: [];
}>();

const selectedIds = ref<string[]>([]);

function toggleSelect(id: string) {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
}

function selectAll() {
  selectedIds.value = props.chapters.map((c) => c.file_name);
}

function deselectAll() {
  selectedIds.value = [];
}

async function handleRename(ch: ChapterInfo) {
  const newName = ch.title.trim();
  if (!newName) return;
  const newFileName = `${newName}.md`;
  if (newFileName === ch.file_name) return;

  try {
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: ch.file_name,
      newName: newFileName,
    });
    ch.file_name = newFileName;
    ElMessage.success(`已重命名为 ${newName}`);
    emit("refresh");
  } catch (e) {
    ElMessage.error("重命名失败");
  }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedIds.value.length} 个章节？此操作不可恢复。`,
      "确认删除",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }

  for (const id of selectedIds.value) {
    try {
      await invoke("delete_chapter", {
        projectId: props.projectId,
        fileName: id,
      });
    } catch (e) { console.error("删除章节失败:", e); }
  }
  selectedIds.value = [];
  ElMessage.success("删除完成");
  emit("refresh");
}

async function handleBatchExport() {
  const selected = props.chapters.filter((c) => selectedIds.value.includes(c.file_name));
  let content = "";
  for (const ch of selected) {
    try {
      const text = await invoke<string>("read_chapter", {
        projectId: props.projectId,
        fileName: ch.file_name,
      });
      content += `## ${ch.title}\n\n${text}\n\n`;
    } catch (e) { console.error("读取章节导出失败:", e); }
  }

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "selected-chapters.md";
  a.click();
  URL.revokeObjectURL(url);
  ElMessage.success(`已导出 ${selected.length} 个章节`);
}

async function moveUp(ch: ChapterInfo) {
  if (ch.order <= 1) return;
  const idx = props.chapters.indexOf(ch);
  if (idx <= 0) return;
  const prev = props.chapters[idx - 1];
  // 交换文件名实现排序
  try {
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: ch.file_name,
      newName: `__tmp_${ch.file_name}`,
    });
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: prev.file_name,
      newName: ch.file_name,
    });
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: `__tmp_${ch.file_name}`,
      newName: prev.file_name,
    });
    [ch.file_name, prev.file_name] = [prev.file_name, ch.file_name];
    [ch.order, prev.order] = [prev.order, ch.order];
    emit("refresh");
    ElMessage.success("上移成功");
  } catch (e) {
    ElMessage.error("排序失败: " + e);
  }
}

async function moveDown(ch: ChapterInfo) {
  if (ch.order >= props.chapters.length) return;
  const idx = props.chapters.indexOf(ch);
  if (idx < 0 || idx >= props.chapters.length - 1) return;
  const next = props.chapters[idx + 1];
  try {
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: ch.file_name,
      newName: `__tmp_${ch.file_name}`,
    });
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: next.file_name,
      newName: ch.file_name,
    });
    await invoke("rename_chapter", {
      projectId: props.projectId,
      oldName: `__tmp_${ch.file_name}`,
      newName: next.file_name,
    });
    [ch.file_name, next.file_name] = [next.file_name, ch.file_name];
    [ch.order, next.order] = [next.order, ch.order];
    emit("refresh");
    ElMessage.success("下移成功");
  } catch (e) {
    ElMessage.error("排序失败: " + e);
  }
}
</script>

<style scoped>
.batch-manager {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bm-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.bm-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.bm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.bm-item:hover {
  background: #f5f7fa;
}

.bm-item.selected {
  background: #ecf5ff;
  border-color: #d9ecff;
}

.bm-order {
  font-size: 12px;
  color: #909399;
  min-width: 24px;
  text-align: center;
}

.bm-title-input {
  flex: 1;
  min-width: 0;
}

.bm-title-input :deep(.el-input__inner) {
  font-size: 13px;
  border: none;
  background: transparent;
  padding: 0 4px;
}

.bm-title-input :deep(.el-input__inner):focus {
  border: 1px solid #409eff;
  background: #fff;
}

.bm-words {
  font-size: 11px;
  color: #c0c4cc;
  white-space: nowrap;
  min-width: 40px;
  text-align: right;
}
</style>
