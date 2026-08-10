<template>
  <el-dialog v-model="visible" title="📈 剧情节奏检测" width="560px" append-to-body>
    <template v-if="report">
      <!-- 评分 -->
      <div class="rc-score">
        <el-progress
          type="dashboard"
          :percentage="report.score"
          :width="110"
          :color="scoreColor"
        />
        <div class="rc-score-right">
          <div class="rc-score-num">
            健康度 <b :style="{ color: scoreColor }">{{ report.score }}</b> / 100
          </div>
          <div class="rc-summary">{{ report.summary }}</div>
        </div>
      </div>

      <!-- 统计 -->
      <div class="rc-stats">
        <div class="rc-stat"><span>字数</span><b>{{ report.stats.chars }}</b></div>
        <div class="rc-stat"><span>段落</span><b>{{ report.stats.paragraphs }}</b></div>
        <div class="rc-stat"><span>平均段长</span><b>{{ report.stats.avgLen }}字</b></div>
        <div class="rc-stat">
          <span>对话占比</span><b>{{ Math.round(report.stats.dialogueRatio * 100) }}%</b>
        </div>
        <div class="rc-stat"><span>短段</span><b>{{ report.stats.shortParas }}</b></div>
        <div class="rc-stat"><span>长段</span><b>{{ report.stats.longParas }}</b></div>
      </div>

      <!-- 问题列表 -->
      <div class="rc-issues">
        <div
          v-for="(iss, i) in report.issues"
          :key="i"
          class="rc-issue"
          :class="iss.level"
        >
          <span class="rc-tag" :class="iss.level">{{ levelLabel(iss.level) }}</span>
          <div class="rc-issue-body">
            <div class="rc-title">{{ iss.title }}</div>
            <div class="rc-desc">{{ iss.desc }}</div>
          </div>
        </div>
      </div>
    </template>
    <el-empty v-else description="当前没有章节内容可供分析" />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { analyzeRhythm } from "@/utils/rhythm";

const props = defineProps<{
  visible: boolean;
  content: string;
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
}>();

const visible = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const report = computed(() =>
  props.content ? analyzeRhythm(props.content) : null
);

const scoreColor = computed(() => {
  const s = report.value?.score ?? 0;
  return s >= 80 ? "#67c23a" : s >= 60 ? "#e6a23c" : "#f56c6c";
});

function levelLabel(level: string): string {
  return { info: "提示", warn: "建议", danger: "警告" }[level] || level;
}
</script>

<style scoped>
.rc-score {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
}
.rc-score-right {
  flex: 1;
}
.rc-score-num {
  font-size: 14px;
  margin-bottom: 6px;
  color: var(--text-1);
}
.rc-score-num b {
  font-size: 20px;
}
.rc-summary {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
.rc-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}
.rc-stat {
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 4px;
  text-align: center;
}
.rc-stat span {
  display: block;
  font-size: 11px;
  color: var(--text-2);
  margin-bottom: 2px;
}
.rc-stat b {
  font-size: 14px;
  color: var(--text-1);
}
.rc-issues {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}
.rc-issue {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-left: 3px solid var(--text-3);
}
.rc-issue.warn {
  border-left-color: var(--orange);
  background: var(--orange-soft);
}
.rc-issue.danger {
  border-left-color: var(--red);
  background: var(--red-soft);
}
.rc-issue.info {
  border-left-color: var(--green);
  background: var(--green-soft);
}
.rc-tag {
  flex-shrink: 0;
  height: 20px;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 11px;
  background: var(--text-3);
  color: #fff;
}
.rc-tag.warn {
  background: var(--orange);
}
.rc-tag.danger {
  background: var(--red);
}
.rc-tag.info {
  background: var(--green);
}
.rc-issue-body {
  flex: 1;
  min-width: 0;
}
.rc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 2px;
}
.rc-desc {
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
}
</style>
