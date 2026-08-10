<template>
  <el-dialog
    :model-value="visible"
    title="📝 细纲 → 正文一键生成"
    width="720px"
    @update:model-value="$emit('update:visible', $event)"
    destroy-on-close
  >
    <div class="outline-text-dialog">
      <!-- 细纲输入 -->
      <div class="section">
        <div class="section-title">
          <span>① 输入章节细纲</span>
          <el-button link type="primary" size="small" @click="fillFromChapter">
            从当前章节内容导入
          </el-button>
        </div>
        <el-input
          v-model="outlineText"
          type="textarea"
          :rows="6"
          placeholder="粘贴或编写本章细纲，例如：场景1 客栈初遇（地点：天启古城·醉仙楼）——主角林风打探消息，遇到神秘少女苏念薇，二人结伴同行；场景2 夜探古庙——……"
        />
      </div>

      <!-- 生成参数 -->
      <div class="section params-row">
        <div class="param-item">
          <span class="param-label">目标字数</span>
          <el-input-number v-model="targetWords" :min="500" :max="10000" :step="500" style="width: 130px" />
        </div>
        <div class="param-item grow">
          <span class="param-label">风格 / 额外要求</span>
          <el-input v-model="extraReq" placeholder="如：古风、轻松诙谐、多对话少描写…" />
        </div>
        <el-button type="primary" :loading="isGenerating" @click="handleGenerate">
          <el-icon v-if="!isGenerating"><Icon icon="lucide:sparkles" /></el-icon>
          生成正文
        </el-button>
      </div>

      <!-- 生成结果 -->
      <template v-if="result">
        <div class="section result-section">
          <div class="section-title">
            <span>② 生成结果（{{ resultWordCount }} 字）</span>
            <el-button link type="primary" size="small" @click="handleRegenerate">换一版</el-button>
          </div>
          <div class="result-box">
            <pre>{{ result }}</pre>
          </div>
          <div class="result-actions">
            <span class="result-tip">选择如何应用生成的内容：</span>
            <el-button type="primary" size="small" @click="handleReplace">
              替换章节内容
            </el-button>
            <el-button size="small" @click="handleAppend">追加到章节末尾</el-button>
            <el-button size="small" @click="handleInsertAtCursor">插入到光标处</el-button>
          </div>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Icon } from "@iconify/vue";
import { useAIStore } from "@/stores/ai";
import { useEditorStore } from "@/stores/editor";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", val: boolean): void;
  (e: "apply-at-cursor", text: string): void;
}>();

const aiStore = useAIStore();
const editorStore = useEditorStore();

const outlineText = ref("");
const targetWords = ref(2000);
const extraReq = ref("");
const isGenerating = ref(false);
const result = ref("");
const resultWordCount = ref(0);

watch(
  () => props.visible,
  (val) => {
    if (val) {
      // 打开时若章节为空，自动导入当前内容作为细纲来源
      if (!outlineText.value) fillFromChapter();
      result.value = "";
    }
  }
);

function fillFromChapter() {
  const content = editorStore.content;
  if (!content.trim()) {
    ElMessage.warning("当前章节内容为空，请先在编辑器中编写细纲，或直接粘贴细纲到输入框");
    return;
  }
  outlineText.value = content.slice(0, 2000);
  ElMessage.success("已导入当前章节内容（前 2000 字）作为细纲，可继续编辑");
}

async function handleGenerate() {
  const outline = outlineText.value.trim();
  if (!outline) {
    ElMessage.warning("请先输入章节细纲");
    return;
  }
  isGenerating.value = true;
  try {
    const prompt = `你是一位资深网文作者，擅长将细纲扩写为流畅的章节正文。

请根据以下【细纲】生成章节正文。

【细纲】
${outline.slice(0, 4000)}

【写作要求】
- 目标字数：约 ${targetWords.value} 字
- ${extraReq.value ? "风格/要求：" + extraReq.value : "风格：生动流畅的网文风格，情节连贯，人物形象鲜明，对话自然"}
- 正文要完整展开细纲中的每个场景，有环境、动作、对话和情绪描写
- 结尾适当留钩子（如果后续还有章节）

请直接输出正文内容，不要输出任何解释、标题或"正文"之类的字样。`;
    const resp = await aiStore.sendMessage(prompt);
    result.value = resp;
    resultWordCount.value = resp.replace(/\s/g, "").length;
  } catch (e) {
    ElMessage.error("生成失败: " + e);
  } finally {
    isGenerating.value = false;
  }
}

function handleRegenerate() {
  handleGenerate();
}

function applyResult() {
  if (!result.value.trim()) return;
  return result.value.trim();
}

async function handleReplace() {
  const text = applyResult();
  if (!text) return;
  try {
    await ElMessageBox.confirm(
      "将用生成的正文替换当前章节全部内容。替换前会自动把当前内容保存为历史版本，可随时恢复。确定继续吗？",
      "替换确认",
      { type: "warning", confirmButtonText: "替换", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }
  editorStore.setContent(text);
  ElMessage.success("已替换章节内容，请记得保存");
  emit("update:visible", false);
}

function handleAppend() {
  const text = applyResult();
  if (!text) return;
  editorStore.insertContent("\n\n" + text);
  ElMessage.success("已追加到章节末尾，请记得保存");
  emit("update:visible", false);
}

function handleInsertAtCursor() {
  const text = applyResult();
  if (!text) return;
  emit("apply-at-cursor", text);
  emit("update:visible", false);
}
</script>

<style scoped>
.outline-text-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-1);
}
.params-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.param-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.param-item.grow {
  flex: 1;
}
.param-label {
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.result-box {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-2);
}
.result-box pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  margin: 0;
  color: var(--text-1);
}
.result-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.result-tip {
  font-size: 13px;
  color: var(--text-3);
  margin-right: 6px;
}
</style>
