<template>
  <el-dialog
    v-model="visible"
    width="720px"
    top="5vh"
    append-to-body
    destroy-on-close
    class="ma-dialog"
  >
    <template #header>
      <div class="ma-dialog-title">
        <span class="ma-dialog-ico">
          <Icon icon="lucide:bot" :width="16" :height="16" />
        </span>
        <span>多智能体分析报告</span>
      </div>
    </template>
    <!-- 头部总览 -->
    <div class="ma-head">
      <div class="ma-head-title">AI 多智能体联合会诊</div>
      <div class="ma-head-sub">
        4 个智能体并行分析当前章节 · 结果以 Markdown 排版
      </div>
    </div>

    <!-- 分析中：每个智能体实时状态 -->
    <div v-if="running" class="ma-body ma-running">
      <div v-for="a in agents" :key="a.id" class="ma-agent" :class="a.status">
        <span class="ma-agent-ico" :style="{ background: a.color }">
          <Icon :icon="a.icon" :width="15" :height="15" />
        </span>
        <span class="ma-agent-name">{{ a.name }}</span>
        <span class="ma-agent-st">
          <span v-if="a.status === 'running'" class="ma-spin"></span>
          <Icon
            v-else-if="a.status === 'done'"
            icon="lucide:check-circle-2"
            color="#10b981"
            :width="18"
            :height="18"
          />
          <Icon
            v-else-if="a.status === 'error'"
            icon="lucide:alert-circle"
            color="#ef4444"
            :width="18"
            :height="18"
          />
          <span v-else class="ma-pending">等待中</span>
        </span>
      </div>
    </div>

    <!-- 完成后：渲染报告卡片 -->
    <div v-else class="ma-body">
      <div
        v-for="a in doneAgents"
        :key="a.id"
        class="ma-report"
        :class="{ error: a.status === 'error' }"
      >
        <div class="ma-report-head" :style="{ '--accent': a.color }">
          <span class="ma-report-ico"><Icon :icon="a.icon" :width="14" :height="14" /></span>
          <span class="ma-report-name">{{ a.name }}</span>
          <span v-if="a.status === 'error'" class="ma-report-err">分析失败</span>
        </div>
        <div
          v-if="a.status !== 'error'"
          class="ma-report-body"
          v-html="renderMarkdown(a.result)"
        ></div>
        <div v-else class="ma-report-body err">{{ a.result }}</div>
      </div>
      <el-empty
        v-if="!doneAgents.length"
        description="没有可展示的分析结果，请重新分析"
      />
    </div>

    <template #footer>
      <span class="ma-footer-hint">分析结果仅作参考，不会写入正文</span>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="running" @click="startAnalyze">
        重新分析
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import { useAIStore } from "@/stores/ai";
import { renderMarkdown } from "@/utils/markdown";

interface AgentDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  buildPrompt: (content: string) => string;
}

interface AgentState extends AgentDef {
  status: "pending" | "running" | "done" | "error";
  result: string;
}

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

const aiStore = useAIStore();

const agents = ref<AgentState[]>([
  {
    id: "plot",
    name: "剧情策划师",
    icon: "lucide:map",
    color: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    status: "pending",
    result: "",
    buildPrompt: (c) =>
      `你是一位专业的小说【剧情策划师】。请分析以下章节内容的剧情结构：\n\n${c}\n\n请用 Markdown 格式输出分析报告，包含：\n- **剧情评分**（1-10 分）\n- **剧情结构分析**（起承转合、冲突推进）\n- **节奏评价**（张弛、爽点密度）\n- **改进建议**（具体、可操作）`,
  },
  {
    id: "character",
    name: "人设校验官",
    icon: "lucide:users",
    color: "linear-gradient(135deg,#10b981,#059669)",
    status: "pending",
    result: "",
    buildPrompt: (c) =>
      `你是一位严格的【人设校验官】。请检查以下章节中角色行为是否符合其身份设定（是否 OOC）：\n\n${c}\n\n请用 Markdown 格式输出分析报告，包含：\n- **人设评分**（1-10 分）\n- **OOC 行为**（如有，列出具体行为与理由）\n- **角色一致性分析**\n- **改进建议**（具体、可操作）`,
  },
  {
    id: "polish",
    name: "文笔润色师",
    icon: "lucide:feather",
    color: "linear-gradient(135deg,#f59e0b,#ef4444)",
    status: "pending",
    result: "",
    buildPrompt: (c) =>
      `你是一位资深的【文笔润色师】。请评估以下章节的文笔质量：\n\n${c}\n\n请用 Markdown 格式输出分析报告，包含：\n- **文笔评分**（1-10 分）\n- **优点总结**\n- **待改进点**（用词、句式、画面感、对话等）\n- **改进建议**（给出具体的改写示例）`,
  },
  {
    id: "logic",
    name: "逻辑纠错师",
    icon: "lucide:shield-check",
    color: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    status: "pending",
    result: "",
    buildPrompt: (c) =>
      `你是一位严谨的【逻辑纠错师】。请检查以下章节中存在的逻辑问题：\n\n${c}\n\n请用 Markdown 格式输出分析报告，包含：\n- **逻辑评分**（1-10 分）\n- **逻辑漏洞**（时间线、设定冲突、因果矛盾等，如无则说明）\n- **设定一致性检查**\n- **改进建议**（具体、可操作）`,
  },
]);

const running = ref(false);

const doneAgents = computed(() =>
  agents.value.filter((a) => a.status === "done" || a.status === "error")
);

watch(
  () => props.visible,
  (v) => {
    if (v && props.content.trim()) {
      startAnalyze();
    }
  }
);

async function startAnalyze() {
  if (!props.content.trim()) {
    ElMessage.warning("当前章节为空，无法分析");
    visible.value = false;
    return;
  }
  running.value = true;
  agents.value.forEach((a) => {
    a.status = "pending";
    a.result = "";
  });

  const content = props.content.slice(0, 2000);
  await Promise.allSettled(
    agents.value.map(async (a) => {
      a.status = "running";
      try {
        const res = await aiStore.silentCall(
          [{ role: "user", content: a.buildPrompt(content) }],
          { temperature: 0.4, maxTokens: 1500 }
        );
        a.result = res || "（无返回内容）";
        a.status = "done";
      } catch (e) {
        a.status = "error";
        a.result = `分析失败：${e}`;
      }
    })
  );
  running.value = false;
}
</script>

<style scoped>
.ma-dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.ma-dialog-ico {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  flex-shrink: 0;
}

.ma-head {
  background: linear-gradient(135deg, var(--accent-soft), var(--accent-soft-2, var(--accent-soft)));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 14px;
}
.ma-head-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.ma-head-sub {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}

.ma-body {
  max-height: 60vh;
  min-height: 120px;
  overflow-y: auto;
  padding-right: 4px;
}

/* 分析中的状态行 */
.ma-agent {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-bottom: 8px;
  background: var(--panel-bg-2);
}
.ma-agent-ico {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}
.ma-agent-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
  flex: 1;
}
.ma-agent-st {
  display: inline-flex;
  align-items: center;
}
.ma-pending {
  font-size: 12px;
  color: var(--text-3);
}
.ma-spin {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ma-rotate 0.8s linear infinite;
}
@keyframes ma-rotate {
  to {
    transform: rotate(360deg);
  }
}

/* 报告卡片 */
.ma-report {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 14px;
  background: var(--panel-bg-2);
}
.ma-report.error {
  border-color: rgba(239, 68, 68, 0.4);
}
.ma-report-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, var(--accent-soft), transparent);
}
.ma-report-ico {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: var(--accent);
  flex-shrink: 0;
}
.ma-report-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.ma-report-err {
  margin-left: auto;
  font-size: 12px;
  color: #ef4444;
}
.ma-report-body {
  padding: 14px 16px;
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--text-2);
  word-break: break-word;
}
.ma-report-body.err {
  color: #ef4444;
}

/* 渲染后的 Markdown 排版 */
.ma-report-body :deep(h1),
.ma-report-body :deep(h2),
.ma-report-body :deep(h3),
.ma-report-body :deep(h4),
.ma-report-body :deep(h5),
.ma-report-body :deep(h6) {
  color: var(--text-1);
  margin: 14px 0 8px;
  line-height: 1.4;
  font-weight: 600;
}
.ma-report-body :deep(h1) {
  font-size: 17px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.ma-report-body :deep(h2) {
  font-size: 15px;
}
.ma-report-body :deep(h3) {
  font-size: 14px;
}
.ma-report-body :deep(p) {
  margin: 6px 0;
}
.ma-report-body :deep(ul),
.ma-report-body :deep(ol) {
  margin: 6px 0;
  padding-left: 22px;
}
.ma-report-body :deep(li) {
  margin: 3px 0;
}
.ma-report-body :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 8px 8px 0;
  color: var(--text-2);
}
.ma-report-body :deep(code) {
  background: var(--panel-bg-3, var(--border));
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 12.5px;
  font-family: "SF Mono", Consolas, Menlo, monospace;
}
.ma-report-body :deep(pre) {
  background: var(--panel-bg-3, var(--border));
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
}
.ma-report-body :deep(pre code) {
  background: none;
  padding: 0;
}
.ma-report-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}
.ma-report-body :deep(strong) {
  color: var(--text-1);
}

/* 表格 */
.ma-report-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 12.5px;
  line-height: 1.5;
}
.ma-report-body :deep(th),
.ma-report-body :deep(td) {
  border: 1px solid var(--border);
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
}
.ma-report-body :deep(th) {
  background: var(--accent-soft);
  color: var(--text-1);
  font-weight: 600;
  white-space: nowrap;
}
.ma-report-body :deep(tbody tr:nth-child(even)) {
  background: var(--panel-bg-3, var(--border));
}
.ma-report-body :deep(td strong) {
  color: var(--text-1);
}

.ma-footer-hint {
  float: left;
  font-size: 12px;
  color: var(--text-3);
  line-height: 32px;
}
</style>
