<template>
  <el-dialog v-model="visible" width="780px" top="6vh" class="author-style-dialog">
    <template #header>
      <span class="dlg-title">
        <el-icon><Icon icon="lucide:pen-tool" /></el-icon>
        名家笔法
      </span>
    </template>

    <div class="as-wrap">
      <p class="as-intro">
        参考网文大神的写作技法来创作——学<b>怎么写</b>，不搬<b>写了什么</b>。
        只借鉴叙事结构、语言节奏、氛围营造与爽点设计；<b>不会</b>使用其作品的人物名、地名、功法等专有名词，也不复制原文。
        建议选 1-2 位，最多 {{ authorStore.maxActive }} 位（过多会风格冲突）。
      </p>

      <div class="as-grid">
        <div
          v-for="a in authorStore.allAuthors"
          :key="a.id"
          class="as-card"
          :class="{ active: authorStore.activeIds.includes(a.id) }"
          @click="handleToggle(a.id)"
        >
          <div class="as-card-head">
            <span class="as-emoji">{{ a.emoji }}</span>
            <div class="as-name-wrap">
              <span class="as-name">{{ a.name }}</span>
              <span class="as-rep">{{ a.representative }}</span>
            </div>
            <Icon
              v-if="authorStore.activeIds.includes(a.id)"
              icon="lucide:check-circle-2"
              class="as-check"
            />
          </div>
          <span class="as-tagline">{{ a.tagline }}</span>
          <div class="as-tags">
            <el-tag v-for="t in a.tags" :key="t" size="small" effect="plain">{{ t }}</el-tag>
          </div>
        </div>
      </div>

      <div v-if="authorStore.hasActive" class="as-detail">
        <el-divider />
        <div class="as-detail-title">
          <Icon icon="lucide:sparkles" />
          已选 {{ authorStore.activeAuthors.length }} 位：
          {{ authorStore.activeAuthors.map((a) => a.name).join(" + ") }}
        </div>
        <div v-for="a in authorStore.activeAuthors" :key="a.id" class="as-detail-item">
          <div class="as-detail-head">
            <span>{{ a.emoji }} {{ a.name }}</span>
            <span class="as-detail-rep">{{ a.representative }}</span>
          </div>
          <div class="as-detail-row">
            <span class="as-label">叙事结构</span>
            <span class="as-val">{{ a.narrative }}</span>
          </div>
          <div class="as-detail-row">
            <span class="as-label">语言句式</span>
            <span class="as-val">{{ a.language }}</span>
          </div>
          <div class="as-detail-row">
            <span class="as-label">节奏爽点</span>
            <span class="as-val">{{ a.pacing }}</span>
          </div>
          <div class="as-detail-row">
            <span class="as-label">擅长维度</span>
            <span class="as-val">{{ a.strengths.join("、") }}</span>
          </div>
        </div>
      </div>

      <div class="as-footer">
        <el-button v-if="authorStore.hasActive" @click="authorStore.clear()">清除选择</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from "element-plus";
import { useAuthorStyleStore } from "@/stores/authorStyle";

const visible = defineModel<boolean>("visible");
const authorStore = useAuthorStyleStore();

function handleToggle(id: string) {
  const res = authorStore.toggleAuthor(id);
  if (res === "limit") {
    ElMessage.warning(`最多同时参考 ${authorStore.maxActive} 位名家，请先取消一位`);
  }
}
</script>

<style scoped>
.dlg-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.dlg-title .el-icon {
  color: var(--accent);
}

.as-intro {
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-2);
  background: var(--accent-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin: 0 0 14px;
}
.as-intro b {
  color: var(--text-1);
}

.as-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.as-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px 14px;
  border: 2px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.18s;
  background: var(--panel-bg-2);
  min-width: 0;
}
.as-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
}
.as-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.as-card-head {
  display: flex;
  align-items: center;
  gap: 9px;
}
.as-emoji {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}
.as-name-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.as-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.as-rep {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.as-check {
  color: var(--accent);
  font-size: 17px;
  flex-shrink: 0;
}
.as-tagline {
  font-size: 12.5px;
  color: var(--accent);
  font-weight: 500;
}
.as-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.as-detail {
  text-align: left;
}
.as-detail-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 12px;
}
.as-detail-title :deep(svg) {
  color: var(--accent);
}
.as-detail-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: var(--panel-bg-2);
}
.as-detail-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 8px;
}
.as-detail-rep {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.as-detail-row {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  line-height: 1.65;
  margin-bottom: 5px;
}
.as-detail-row:last-child {
  margin-bottom: 0;
}
.as-label {
  color: var(--text-3);
  flex-shrink: 0;
  width: 56px;
}
.as-val {
  color: var(--text-2);
  min-width: 0;
}

.as-footer {
  text-align: center;
  margin-top: 16px;
}
</style>
