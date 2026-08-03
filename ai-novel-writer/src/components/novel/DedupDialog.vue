<template>
  <el-dialog v-model="visible" title="🔁 去重检测 / 水文优化" width="580px" append-to-body>
    <div v-if="analysis" class="dd-body">
      <div class="dd-summary">
        <p>
          重复句子 <b>{{ analysis.dupSentences.length }}</b> 处，高频重复短语
          <b>{{ analysis.repeatedPhrases.length }}</b> 处。
        </p>
        <p class="dd-hint">重复内容会显得"注水"，可一键精简（保留第一次出现）。</p>
      </div>

      <template v-if="analysis.dupSentences.length">
        <h4>重复句子</h4>
        <div class="dd-list">
          <div v-for="(it, i) in analysis.dupSentences" :key="i" class="dd-item">
            <span class="dd-count">×{{ it.count }}</span>
            <span class="dd-text">{{ it.text }}</span>
          </div>
        </div>
      </template>

      <template v-if="analysis.repeatedPhrases.length">
        <h4>高频重复短语</h4>
        <div class="dd-list">
          <div v-for="(it, i) in analysis.repeatedPhrases" :key="i" class="dd-item">
            <span class="dd-count">×{{ it.count }}</span>
            <span class="dd-text">{{ it.text }}</span>
          </div>
        </div>
      </template>

      <el-empty
        v-if="!analysis.dupSentences.length && !analysis.repeatedPhrases.length"
        description="未发现明显重复，文本质量不错 👍"
      />
    </div>
    <el-empty v-else description="当前没有章节内容可供分析" />

    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :disabled="!canTrim" @click="handleTrim">
        一键精简重复
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  detectDuplicateSentences,
  detectRepeatedPhrases,
  removeDuplicateSentences,
} from "@/utils/dedup";

const props = defineProps<{
  visible: boolean;
  content: string;
}>();

const emit = defineEmits<{
  "update:visible": [v: boolean];
  apply: [newContent: string];
}>();

const visible = computed({
  get: () => props.visible,
  set: (v) => emit("update:visible", v),
});

const analysis = computed(() => {
  if (!props.content) return null;
  return {
    dupSentences: detectDuplicateSentences(props.content),
    repeatedPhrases: detectRepeatedPhrases(props.content),
  };
});

const canTrim = computed(() => (analysis.value?.dupSentences.length ?? 0) > 0);

async function handleTrim() {
  if (!canTrim.value) return;
  try {
    await ElMessageBox.confirm(
      "将删除章节中重复出现的句子（保留第一次出现）。是否继续？",
      "精简确认",
      { confirmButtonText: "精简", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }
  const result = removeDuplicateSentences(props.content);
  if (result !== null) {
    emit("apply", result);
    ElMessage.success("已精简重复句子");
  } else {
    ElMessage.info("没有可精简的重复内容");
  }
}
</script>

<style scoped>
.dd-body {
  max-height: 380px;
  overflow-y: auto;
}
.dd-summary {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
}
.dd-summary p {
  font-size: 13px;
  color: #303133;
}
.dd-summary .dd-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
h4 {
  font-size: 13px;
  margin: 12px 0 8px;
  color: #606266;
}
.dd-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dd-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  background: #fdf6ec;
  border-radius: 6px;
  padding: 6px 10px;
}
.dd-count {
  flex-shrink: 0;
  font-size: 11px;
  background: #e6a23c;
  color: #fff;
  border-radius: 4px;
  padding: 0 6px;
  line-height: 18px;
}
.dd-text {
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  word-break: break-all;
}
</style>
