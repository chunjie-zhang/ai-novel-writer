<template>
  <el-dialog
    :model-value="visible"
    width="760px"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    append-to-body
    class="welcome-guide"
  >
    <template #header>
      <div class="wg-header">
        <span class="wg-logo">✍️</span>
        <span>AI 小说创作工具 · 新手引导</span>
      </div>
    </template>

    <!-- 步骤条 -->
    <el-steps :active="step" finish-status="success" align-center class="wg-steps">
      <el-step v-for="(s, i) in steps" :key="i" :title="s.short" />
    </el-steps>

    <!-- 步骤内容 -->
    <div class="wg-body">
      <div class="wg-main">
        <el-icon class="wg-main-icon"><Icon :icon="steps[step].icon" /></el-icon>
        <h3 class="wg-title">{{ steps[step].title }}</h3>
        <p class="wg-desc">{{ steps[step].desc }}</p>
      </div>

      <!-- 功能点列表 -->
      <div v-if="steps[step].points.length" class="wg-points">
        <div v-for="(p, i) in steps[step].points" :key="i" class="wg-point">
          <el-icon class="wg-point-icon"><Icon :icon="p.icon" /></el-icon>
          <span class="wg-point-text">{{ p.text }}</span>
        </div>
      </div>

      <!-- 最后一步：创建示例项目 -->
      <div v-if="steps[step].action === 'demo'" class="wg-demo">
        <div class="wg-demo-box">
          <div class="wg-demo-title">
            <el-icon><Icon icon="lucide:rocket" /></el-icon>
            <span>示例项目「星辰之旅」将包含：</span>
          </div>
          <ul class="wg-demo-list">
            <li>📖 3 个示例章节（第一卷分组）</li>
            <li>👤 3 个示例角色（陆沉、苏念薇、老船长）</li>
            <li>🌍 完整的世界观设定（势力 / 规则 / 地理）</li>
          </ul>
          <el-button
            type="primary"
            size="large"
            :loading="demoStore.isCreating"
            class="wg-demo-btn"
            @click="handleCreateDemo"
          >
            <el-icon><Icon icon="lucide:play" /></el-icon>
            一键创建示例项目
          </el-button>
          <p class="wg-demo-hint">
            示例项目和你自己创建的项目完全一样，可以随意修改；不需要时，在左侧项目节点点 🗑 即可删除。
          </p>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="wg-footer">
        <el-button text @click.stop="handleSkip">跳过引导</el-button>
        <div class="wg-footer-right">
          <el-button v-if="step > 0" @click.stop="handlePrev">上一步</el-button>
          <el-button
            v-if="step < steps.length - 1"
            type="primary"
            @click.stop="handleNext"
          >
            下一步
          </el-button>
          <el-button v-else type="primary" @click.stop="handleFinish">
            开始创作
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage } from "element-plus";
import { Icon } from "@iconify/vue";
import { useDemoStore } from "@/stores/demo";
import { useProjectStore } from "@/stores/project";

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits<{
  "update:visible": [v: boolean];
  finish: [];
}>();

const demoStore = useDemoStore();
const projectStore = useProjectStore();

const step = ref(0);

// 每次打开引导都从「欢迎」步骤开始（避免停留在上次关闭的步骤，让用户困惑）
watch(
  () => props.visible,
  (v) => {
    if (v) step.value = 0;
  }
);

function handleNext() {
  if (step.value < steps.length - 1) step.value++;
}
function handlePrev() {
  if (step.value > 0) step.value--;
}

const steps = [
  {
    short: "欢迎",
    icon: "lucide:sparkles",
    title: "欢迎使用 AI 小说创作工具",
    desc: "一款纯本地的长篇网文创作工具。所有稿件、人设、世界观都保存在你自己的电脑上，隐私安全、离线可用。",
    points: [],
    action: "",
  },
  {
    short: "界面",
    icon: "lucide:layout-dashboard",
    title: "三栏工作区，各司其职",
    desc: "打开后你会看到三个主要区域：",
    points: [
      { icon: "lucide:folder-tree", text: "左侧 · 项目树：项目管理、章节列表，以及角色 / 世界观等小说功能" },
      { icon: "lucide:pen-line", text: "中间 · 编辑器：Markdown 写作区，支持保存、字数统计、专注模式" },
      { icon: "lucide:bot", text: "右侧 · AI 面板：AI 对话创作、续写、润色，可一键保存为章节 / 角色" },
    ],
    action: "",
  },
  {
    short: "编辑器",
    icon: "lucide:pen-line",
    title: "在中间编辑器写作",
    desc: "日常码字都在中间区域完成：",
    points: [
      { icon: "lucide:file-plus", text: "新建 / 切换章节：点击左侧章节，或用工具栏「章节」按钮" },
      { icon: "lucide:save", text: "保存：Ctrl+S / Cmd+S，或点工具栏「保存」" },
      { icon: "lucide:maximize-2", text: "专注模式：点 ⤢ 全屏码字，减少干扰" },
      { icon: "lucide:ellipsis", text: "更多工具：右上角 ⋯ 里有 AI 校对、节奏检测、去重、导出、Diff 改写等" },
    ],
    action: "",
  },
  {
    short: "AI 创作",
    icon: "lucide:bot",
    title: "用 AI 一起写故事",
    desc: "右侧面板是 AI 创作助手：",
    points: [
      { icon: "lucide:message-square", text: "直接输入需求：如“续写当前章节”“写一段打斗场景”" },
      { icon: "lucide:sparkles", text: "写作技能：点 ✨ 选择写大纲 / 人设 / 剧情等技能" },
      { icon: "lucide:upload", text: "导入参考小说：点 ⬆ 上传小说，让 AI 参考其文风" },
      { icon: "lucide:file-plus-2", text: "每条 AI 回复下方可一键「保存为章节」或「保存为角色」" },
    ],
    action: "",
  },
  {
    short: "小说功能",
    icon: "lucide:layers",
    title: "左侧「小说功能」管理设定",
    desc: "展开项目后，找到「小说功能」分组，这里管理小说的各种设定：",
    points: [
      { icon: "lucide:users", text: "角色管理：维护人设档案，AI 续写时会自动参考" },
      { icon: "lucide:globe", text: "世界观设定：地理、势力、规则" },
      { icon: "lucide:search", text: "全文搜索 / 全书问答：快速检索内容、向全书提问" },
      { icon: "lucide:database-backup", text: "大纲 / 备份 / 写作报表：规划剧情、防止稿件丢失" },
    ],
    action: "",
  },
  {
    short: "开始",
    icon: "lucide:rocket",
    title: "创建示例项目，立即上手",
    desc: "一键创建一个带示例数据的项目，边看边玩，最快熟悉所有功能。",
    points: [],
    action: "demo",
  },
];

/** 创建示例项目（完成后自动打开） */
async function handleCreateDemo() {
  try {
    const project = await demoStore.createDemoProject();
    if (project) {
      await projectStore.openProject(project.id);
      ElMessage.success("示例项目已创建，尽情体验吧！");
      handleFinish();
    }
  } catch {
    ElMessage.error("创建示例项目失败，请稍后重试");
  }
}

function handleSkip() {
  handleFinish();
}

function handleFinish() {
  emit("finish");
  emit("update:visible", false);
}
</script>

<style scoped>
.welcome-guide :deep(.el-dialog__header) {
  padding-bottom: 8px;
}
.wg-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-1);
}
.wg-logo {
  font-size: 18px;
}
.wg-steps {
  margin: 8px 0 20px;
}
.wg-body {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.wg-main {
  text-align: center;
}
.wg-main-icon {
  font-size: 40px;
  color: var(--accent);
}
.wg-title {
  margin: 10px 0 6px;
  color: var(--text-1);
  font-size: 18px;
}
.wg-desc {
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.7;
  margin: 0 auto;
  max-width: 560px;
}
.wg-points {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
  margin: 0 auto;
  width: 100%;
}
.wg-point {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
}
.wg-point-icon {
  font-size: 18px;
  color: var(--accent);
  margin-top: 2px;
  flex-shrink: 0;
}
.wg-point-text {
  font-size: 13px;
  color: var(--text-1);
  line-height: 1.6;
}
.wg-demo {
  display: flex;
  justify-content: center;
}
.wg-demo-box {
  width: 100%;
  max-width: 520px;
  padding: 18px 20px;
  border-radius: 10px;
  background: var(--panel-bg-2);
  border: 1px solid var(--accent);
  text-align: center;
}
.wg-demo-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 10px;
}
.wg-demo-list {
  text-align: left;
  color: var(--text-2);
  font-size: 13px;
  line-height: 2;
  margin: 0 0 16px;
  padding-left: 4px;
  list-style: none;
}
.wg-demo-btn {
  margin-bottom: 10px;
}
.wg-demo-hint {
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
.wg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wg-footer-right {
  display: flex;
  gap: 8px;
}
</style>
