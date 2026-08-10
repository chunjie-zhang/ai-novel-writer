<template>
  <el-dialog v-model="visible" width="620px">
    <template #header>
      <span class="dlg-title"><el-icon><Icon icon="lucide:bar-chart-3" /></el-icon> 写作进度报表</span>
    </template>
    <div class="report">
      <!-- 总览卡片 -->
      <div class="overview-cards">
        <div class="stat-card">
          <span class="stat-value">{{ writingStore.stats.totalWrittenAllTime }}</span>
          <span class="stat-label">累计总字数</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ todayWords }}</span>
          <span class="stat-label">今日已写</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ weeklyWords }}</span>
          <span class="stat-label">本周累计</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ avgDaily }}</span>
          <span class="stat-label">日均</span>
        </div>
      </div>

      <!-- 日更进度条 -->
      <div class="goal-section" v-if="writingStore.stats.dailyGoal.enabled">
        <h4>日更目标进度</h4>
        <el-progress
          :percentage="writingStore.dailyProgressPercent"
          :status="writingStore.isGoalMet ? 'success' : ''"
          :stroke-width="20"
          :text-inside="true"
        >
          {{ writingStore.stats.writtenToday }}/{{ writingStore.stats.dailyGoal.targetWords }} 字
        </el-progress>
      </div>

      <!-- 本周写作日历 -->
      <div class="calendar-section">
        <h4>本周写作记录</h4>
        <div class="week-calendar">
          <div v-for="(day, i) in weekDays" :key="i" class="cal-day" :class="{ active: day.written > 0 }">
            <span class="cal-label">{{ day.label }}</span>
            <div class="cal-bar">
              <div class="cal-fill" :style="{ height: day.percent + '%' }"></div>
            </div>
            <span class="cal-value" v-if="day.written > 0">{{ day.written }}</span>
          </div>
        </div>
      </div>

      <!-- 章节统计 -->
      <div class="chapter-stats" v-if="projectStore.hasProject">
        <h4>章节统计</h4>
        <div class="stat-row">
          <span>总章节数</span>
          <span class="stat-num">{{ projectStore.chapters.length }}</span>
        </div>
        <div class="stat-row">
          <span>总字数</span>
          <span class="stat-num">{{ totalChapterWords }}</span>
        </div>
        <div class="stat-row">
          <span>平均每章</span>
          <span class="stat-num">{{ avgChapterWords }}</span>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useWritingStore } from "@/stores/writing";
import { useProjectStore } from "@/stores/project";

const visible = defineModel<boolean>("visible");
const writingStore = useWritingStore();
const projectStore = useProjectStore();

// 今日字数
const todayWords = computed(() => writingStore.stats.writtenToday);

// 本周累计
const weeklyWords = computed(() => {
  let total = 0;
  try {
    const history = JSON.parse(localStorage.getItem("novel-daily-stats") || "{}");
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (history[key]) total += history[key];
    }
  } catch {}
  return total || writingStore.stats.writtenToday;
});

// 日均
const avgDaily = computed(() => {
  const total = writingStore.stats.totalWrittenAllTime;
  let days = 1;
  try {
    const history = JSON.parse(localStorage.getItem("novel-daily-stats") || "{}");
    days = Math.max(1, Object.keys(history).length);
  } catch {}
  return Math.round(total / days);
});

// 本周日历
const weekDays = computed(() => {
  const days = [];
  const now = new Date();
  const history = (() => { try { return JSON.parse(localStorage.getItem("novel-daily-stats") || "{}"); } catch { return {}; } })();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    const key = d.toISOString().slice(0, 10);
    const written = history[key] || 0;
    days.push({ label, written, percent: Math.min(100, written / 100) });
  }
  return days;
});

// 章节统计
const totalChapterWords = computed(() =>
  projectStore.chapters.reduce((sum, c) => sum + (c.word_count || 0), 0)
);

const avgChapterWords = computed(() => {
  const n = projectStore.chapters.length;
  return n > 0 ? Math.round(totalChapterWords.value / n) : 0;
});
</script>

<style scoped>
.report { display: flex; flex-direction: column; gap: 20px; }

.overview-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; background: var(--panel-bg-2); border: 1px solid var(--border); border-radius: 12px; }
.stat-value { font-size: 22px; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 12px; color: var(--text-2); }

.goal-section h4, .calendar-section h4, .chapter-stats h4 { font-size: 14px; font-weight: 600; margin-bottom: 10px; color: var(--text-1); }

.week-calendar { display: flex; justify-content: space-between; gap: 8px; padding: 12px 0; }
.cal-day { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.cal-label { font-size: 12px; color: var(--text-2); }
.cal-bar { width: 16px; height: 80px; background: var(--panel-hover); border-radius: 8px; position: relative; overflow: hidden; }
.cal-fill { position: absolute; bottom: 0; left: 0; right: 0; background: var(--accent); border-radius: 8px 8px 0 0; transition: height 0.3s; }
.cal-day.active .cal-fill { background: var(--green); }
.cal-value { font-size: 10px; color: var(--text-2); }

.stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; color: var(--text-2); }
.stat-num { font-weight: 600; color: var(--text-1); }
</style>
