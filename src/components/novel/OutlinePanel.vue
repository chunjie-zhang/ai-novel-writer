<template>
  <div class="outline-panel">
    <div class="op-header">
      <span class="op-title">📋 三级大纲</span>
      <div class="op-actions">
        <el-button size="small" @click="handleInitOutline" v-if="!outlineStore.hasOutline">
          初始化大纲
        </el-button>
        <el-button size="small" @click="outlineStore.addVolume()" v-if="outlineStore.hasOutline">
          + 分卷
        </el-button>
        <el-button size="small" @click="saveOutline" v-if="outlineStore.hasOutline">
          保存
        </el-button>
      </div>
    </div>

    <div v-if="!outlineStore.hasOutline" class="op-empty">
      <p>还没有创建大纲，点击上方按钮初始化</p>
    </div>

    <div v-else class="op-tree">
      <!-- 书名节点 -->
      <div class="tree-node book-node">
        <div class="node-content" @click="editingId = outlineStore.outline?.id || ''">
          <span class="node-icon">📖</span>
          <el-input
            v-if="editingId === outlineStore.outline?.id"
            v-model="outlineStore.outline.title"
            size="small"
            @blur="editingId = ''"
            @click.stop
          />
          <span v-else class="node-title">{{ outlineStore.outline?.title }}</span>
        </div>
      </div>

      <!-- 分卷和章节 -->
      <div v-for="vol in outlineStore.outline?.children" :key="vol.id" class="volume-group">
        <div class="tree-node volume-node">
          <div class="node-content" @click="outlineStore.toggleCollapse(vol.id)">
            <span class="node-collapse">{{ vol.collapsed ? '▶' : '▼' }}</span>
            <span class="node-icon">📂</span>
            <el-input
              v-if="editingId === vol.id"
              v-model="vol.title"
              size="small"
              @blur="editingId = ''"
              @click.stop
            />
            <span v-else class="node-title">{{ vol.title }}</span>
          </div>
          <div class="node-meta">
            <span class="node-words" v-if="vol.targetWords">目标 {{ vol.targetWords }}字</span>
            <el-button text size="small" @click.stop="outlineStore.addChapter(vol.id)">
              + 章节
            </el-button>
            <el-button text size="small" type="danger" @click.stop="outlineStore.removeNode(vol.id)">
              ✕
            </el-button>
          </div>
        </div>

        <div v-if="!vol.collapsed" class="chapter-list">
          <div v-for="ch in vol.children" :key="ch.id" class="tree-node chapter-node" :class="{ linked: ch.link }">
            <div class="node-content" @click="handleChapterClick(ch)" style="cursor:pointer">
              <span class="node-icon">📄</span>
              <el-input
                v-if="editingId === ch.id"
                v-model="ch.title"
                size="small"
                @blur="editingId = ''"
                @click.stop
              />
              <span v-else class="node-title">{{ ch.title }}</span>
              <span v-if="ch.link" class="node-link-badge">已关联</span>
            </div>
            <div class="node-meta">
              <span class="node-words" v-if="ch.targetWords">目标 {{ ch.targetWords }}字</span>
              <el-tooltip content="关联到编辑器章节" placement="top">
                <el-button text size="small" @click.stop="handleLinkChapter(ch)">🔗</el-button>
              </el-tooltip>
              <el-button text size="small" type="danger" @click.stop="outlineStore.removeNode(ch.id)">
                ✕
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useOutlineStore } from "@/stores/outline";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { invoke } from "@tauri-apps/api/core";

const outlineStore = useOutlineStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();
const editingId = ref("");

function handleInitOutline() {
  outlineStore.initOutline(projectStore.currentProject?.name || "新作品");
}

/** 点击大纲章节 → 跳转到编辑器对应章节 */
async function handleChapterClick(ch: any) {
  if (editingId.value === ch.id) return;
  if (!projectStore.currentProject) {
    ElMessage.info("请先打开项目");
    return;
  }
  // 先尝试关联章节（如果有 link 则直接打开）
  if (ch.link) {
    try {
      const content = await invoke<string>("read_chapter", {
        projectId: projectStore.currentProject.id,
        fileName: ch.link,
      });
      const chapter = projectStore.chapters.find((c) => c.file_name === ch.link);
      if (chapter) {
        editorStore.openChapterWithMemory(chapter, content, projectStore.currentProject.id);
      }
    } catch {
      ElMessage.warning("关联章节文件不存在，请重新关联");
      ch.link = "";
    }
    return;
  }
  // 尝试按标题自动匹配
  const match = projectStore.chapters.find((c) => c.title === ch.title);
  if (match) {
    ch.link = match.file_name;
    try {
      const content = await invoke<string>("read_chapter", {
        projectId: projectStore.currentProject.id,
        fileName: match.file_name,
      });
      editorStore.openChapterWithMemory(match, content, projectStore.currentProject.id);
    } catch (e) { console.error("打开关联章节失败:", e); }
  }
}

/** 手动关联大纲章节到项目章节 */
async function handleLinkChapter(ch: any) {
  if (!projectStore.currentProject) {
    ElMessage.info("请先打开项目");
    return;
  }
  const chapters = projectStore.chapters;
  const items = chapters.map((c, i) => `${i + 1}. ${c.title}（${c.word_count}字）`).join("\n");
  try {
    const result = await ElMessageBox.prompt(
      `选择要关联的章节编号（1-${chapters.length}）：\n${items}`,
      "关联章节",
      { inputPattern: /^\d+$/, inputErrorMessage: "请输入数字" }
    );
    const idx = parseInt(result.value) - 1;
    if (idx >= 0 && idx < chapters.length) {
      ch.link = chapters[idx].file_name;
      saveOutline();
      ElMessage.success(`已关联到「${chapters[idx].title}」`);
    }
  } catch {}
}

/** 打开编辑器当前章节时，高亮大纲中对应的节点 */
function syncFromEditor() {
  const currentFile = editorStore.currentChapter?.file_name;
  if (!currentFile || !outlineStore.outline) return;
  for (const vol of outlineStore.outline.children) {
    for (const ch of vol.children) {
      if (ch.link === currentFile) {
        // 自动展开分卷
        vol.collapsed = false;
        return;
      }
    }
  }
}

// 暴露方法给外部调用
defineExpose({ syncFromEditor });

function saveOutline() {
  if (!projectStore.currentProject) return;
  outlineStore.saveOutline(projectStore.currentProject.id);
  ElMessage.success("大纲已保存");
}

// 加载当前项目已保存的大纲（按项目隔离，避免切换小说串数据）
if (projectStore.currentProject?.id) {
  outlineStore.loadOutline(projectStore.currentProject.id);
}
</script>

<style scoped>
.outline-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.op-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.op-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.op-actions {
  display: flex;
  gap: 4px;
}

.op-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-2);
  font-size: 13px;
}

.op-tree {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tree-node {
  padding: 6px 8px;
  border-radius: 8px;
  transition: background 0.15s;
}

.tree-node:hover {
  background: var(--panel-hover);
}

.node-content {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  min-width: 0;
  flex: 1;
}

.node-collapse {
  font-size: 10px;
  color: var(--text-3);
  width: 12px;
  text-align: center;
}

.node-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.node-title {
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-node .node-title {
  font-weight: 700;
  font-size: 15px;
}

.volume-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
}

.volume-node .node-title {
  font-weight: 600;
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.node-words {
  font-size: 11px;
  color: var(--text-3);
}

.chapter-list {
  margin-left: 24px;
  border-left: 2px solid var(--border-light);
  padding-left: 8px;
}

.chapter-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chapter-node .node-title {
  font-size: 12px;
}

.chapter-node.linked {
  background: var(--accent-soft);
  border-radius: 6px;
}

.node-link-badge {
  font-size: 10px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 0 6px;
  border-radius: 4px;
  margin-left: 6px;
  flex-shrink: 0;
}
</style>
