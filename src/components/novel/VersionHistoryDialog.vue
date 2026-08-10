<template>
  <el-dialog
    :model-value="visible"
    width="940px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template #header>
      <span class="dlg-title"><el-icon><Icon icon="lucide:history" /></el-icon> 章节历史版本</span>
    </template>
    <div class="version-dialog">
      <p class="version-tip">
        每次保存章节时，系统会自动留存一份历史快照（每章保留最近 10 个版本）。点击左侧版本，右侧会显示它与当前内容的差异对比。
      </p>

      <!-- 空状态 -->
      <div v-if="!loading && versions.length === 0" class="version-empty">
        <el-icon :size="40" color="var(--text-3)"><Icon icon="lucide:history" /></el-icon>
        <p>暂无历史版本</p>
        <p class="version-empty-sub">保存当前章节后，这里就会生成版本快照</p>
      </div>

      <!-- 左右分栏：左=版本列表，右=差异对比 -->
      <div v-else class="version-layout">
        <!-- 左侧版本列表 -->
        <div class="version-sidebar">
          <div
            v-for="(v, i) in versions"
            :key="v.timestamp"
            class="version-item"
            :class="{ active: selected === v.timestamp }"
            @click="selectVersion(v)"
          >
            <div class="version-meta">
              <span class="version-index">#{{ versions.length - i }}</span>
              <span class="version-time">{{ formatTime(v.timestamp) }}</span>
              <span class="version-words">{{ v.wordCount }} 字</span>
              <span v-if="i === 0" class="version-current">最近</span>
            </div>
          </div>
        </div>

        <!-- 右侧差异对比 -->
        <div v-if="selectedVersion" class="version-detail">
          <div class="detail-header">
            <div class="detail-title">
              对比预览：#{{ versionNoOf(selectedVersion) }} · {{ formatTime(selectedVersion.timestamp) }}
            </div>
            <div class="detail-actions">
              <el-button size="small" type="primary" @click="handleRestore(selectedVersion)">
                恢复此版本
              </el-button>
              <el-button size="small" type="danger" plain @click="handleRemove(selectedVersion)">
                删除
              </el-button>
            </div>
          </div>

          <div class="compare-legend">
            <span class="lg lg-add">＋ 该版本新增（恢复后会出现）</span>
            <span class="lg lg-del">－ 该版本已删除（恢复后会被移除）</span>
            <span class="lg lg-same">＝ 与当前相同</span>
          </div>
          <div class="compare-stats">
            相对当前：新增 {{ versionDiffOf(selectedVersion).add }} 行 · 删除 {{ versionDiffOf(selectedVersion).del }} 行 · 相同 {{ versionDiffOf(selectedVersion).same }} 行
          </div>
          <!-- 左右并排对比：左=历史版本，右=当前内容，差异行对齐高亮 -->
          <div class="compare-panels">
            <div class="panel-head">
              <span class="panel-title panel-left"><Icon icon="lucide:file-text" :width="14" :height="14" style="vertical-align:-2px" /> 历史版本 · #{{ versionNoOf(selectedVersion) }} · {{ formatTime(selectedVersion.timestamp) }}</span>
              <span class="panel-title panel-right"><Icon icon="lucide:pen-line" :width="14" :height="14" style="vertical-align:-2px" /> 当前内容</span>
            </div>
            <div class="panel-body">
              <div
                v-for="(line, idx) in versionDiffOf(selectedVersion).lines"
                :key="idx"
                class="grid-row"
                :class="line.type"
              >
                <div
                  class="grid-cell cell-left"
                  :class="{ 'is-del': line.type === 'del', 'is-empty': line.type === 'add' }"
                >{{ line.type === 'add' ? ' ' : line.text }}</div>
                <div
                  class="grid-cell cell-right"
                  :class="{ 'is-add': line.type === 'add', 'is-empty': line.type === 'del' }"
                >{{ line.type === 'del' ? ' ' : line.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Icon } from "@iconify/vue";
import { useVersionsStore, type ChapterVersion } from "@/stores/versions";
import { useEditorStore } from "@/stores/editor";
import { diffLines, summarizeDiff, type LineDiff } from "@/utils/diffLines";

const props = defineProps<{
  visible: boolean;
  projectId: string;
  chapterFileName: string;
}>();

const emit = defineEmits<{
  (e: "update:visible", val: boolean): void;
}>();

const versionsStore = useVersionsStore();
const editorStore = useEditorStore();

const versions = ref<ChapterVersion[]>([]);
const loading = ref(false);
const selected = ref<number | null>(null);

const selectedVersion = computed(() =>
  selected.value === null
    ? null
    : versions.value.find((v) => v.timestamp === selected.value) || null
);

async function refresh() {
  if (!props.projectId || !props.chapterFileName) {
    versions.value = [];
    selected.value = null;
    return;
  }
  loading.value = true;
  versions.value = versionsStore.listVersions(props.projectId, props.chapterFileName);
  // 默认选中最近一个版本
  if (versions.value.length > 0 && selected.value === null) {
    selected.value = versions.value[0].timestamp;
  }
  loading.value = false;
}

watch(
  () => props.visible,
  (val) => {
    if (val) {
      selected.value = null;
      refresh();
    }
  }
);

function selectVersion(v: ChapterVersion) {
  selected.value = v.timestamp;
}

function versionNoOf(v: ChapterVersion) {
  const idx = versions.value.findIndex((it) => it.timestamp === v.timestamp);
  return versions.value.length - idx;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 计算「历史版本 vs 当前内容」的行级差异（旧=当前，新=版本）
function versionDiffOf(v: ChapterVersion) {
  const lines: LineDiff[] = diffLines(editorStore.content, v.content);
  const sum = summarizeDiff(lines);
  return { lines, add: sum.add, del: sum.del, same: sum.same };
}

async function handleRestore(v: ChapterVersion) {
  const current = editorStore.content;
  const willLose = current.trim() && current !== v.content;
  try {
    if (willLose) {
      await ElMessageBox.confirm(
        "恢复后当前未保存的修改会被覆盖（恢复动作本身会先保存当前版本快照，可随时回退）。确定恢复该版本吗？",
        "恢复确认",
        { type: "warning", confirmButtonText: "恢复", cancelButtonText: "取消" }
      );
    }
    // 恢复前先把当前内容存为一个版本，保证可回退
    if (current.trim() && current !== v.content) {
      versionsStore.recordVersion(props.projectId, props.chapterFileName, current);
    }
    editorStore.setContent(v.content);
    ElMessage.success("已恢复到该版本，请记得保存");
    emit("update:visible", false);
  } catch {
    // 用户取消
  }
}

async function handleRemove(v: ChapterVersion) {
  try {
    await ElMessageBox.confirm("确定删除该版本吗？此操作不可恢复。", "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
    versionsStore.removeVersion(props.projectId, props.chapterFileName, v.timestamp);
    versions.value = versionsStore.listVersions(props.projectId, props.chapterFileName);
    // 若当前选中的版本被删除，自动回退到最近一个版本
    if (
      selected.value !== null &&
      !versions.value.some((it) => it.timestamp === selected.value)
    ) {
      selected.value = versions.value.length > 0 ? versions.value[0].timestamp : null;
    }
    ElMessage.success("已删除该版本");
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.version-dialog {
  min-height: 260px;
}
.version-tip {
  color: var(--text-3);
  font-size: 13px;
  margin-bottom: 12px;
}
.version-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--text-3);
}
.version-empty p {
  margin: 8px 0 0;
}
.version-empty-sub {
  font-size: 13px;
  opacity: 0.8;
}
.version-layout {
  display: flex;
  gap: 14px;
  align-items: stretch;
  min-height: 380px;
}
.version-sidebar {
  width: 250px;
  flex-shrink: 0;
  max-height: 460px;
  overflow-y: auto;
  padding-right: 4px;
}
.version-item {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--bg-2);
  transition: border-color 0.15s, background 0.15s;
}
.version-item:hover {
  border-color: var(--accent);
}
.version-item.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.version-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.version-index {
  font-weight: 600;
  color: var(--accent);
  font-size: 13px;
}
.version-time {
  color: var(--text-2);
}
.version-words {
  color: var(--text-2);
}
.version-current {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
  align-self: flex-start;
}
.version-detail {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-1);
  overflow: hidden;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-2);
}
.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.compare-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 8px 12px;
  font-size: 12px;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lg-add {
  color: var(--green);
}
.lg-del {
  color: var(--red);
}
.lg-same {
  color: var(--text-3);
}
.compare-stats {
  padding: 0 12px 8px;
  font-size: 12px;
  color: var(--text-3);
}
/* 左右并排对比面板 */
.compare-panels {
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.panel-head {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-2);
  font-size: 12px;
  font-weight: 600;
}
.panel-title {
  flex: 1;
  padding: 6px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.panel-left {
  border-right: 1px solid var(--border-color);
  color: var(--text-1);
}
.panel-right {
  color: var(--text-2);
}
.panel-body {
  flex: 1;
  max-height: 360px;
  overflow: auto;
  padding-bottom: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.7;
}
.grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.grid-cell {
  padding: 0 10px;
  white-space: pre-wrap;
  word-break: break-word;
  min-height: 1.7em;
}
.cell-left {
  border-right: 1px solid var(--border-color);
}
.grid-row.same .grid-cell {
  color: var(--text-2);
}
.cell-left.is-del {
  background: var(--red-soft);
  color: var(--text-1);
  text-decoration: line-through;
}
.cell-right.is-add {
  background: var(--green-soft);
  color: var(--text-1);
}
.grid-cell.is-empty {
  background: transparent;
}
</style>
