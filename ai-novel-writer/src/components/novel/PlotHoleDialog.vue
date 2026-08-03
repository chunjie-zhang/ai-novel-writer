<template>
  <el-dialog v-model="visible" title="🕳️ 伏笔 & 坑位管理" width="560px">
    <div class="plot-hole">
      <!-- 新增 -->
      <div class="ph-add">
        <el-select v-model="newType" size="small" style="width: 120px">
          <el-option label="伏笔" value="foreshadow" />
          <el-option label="剧情坑" value="plot-hole" />
          <el-option label="悬念" value="cliffhanger" />
          <el-option label="未收线" value="loose-end" />
        </el-select>
        <el-input v-model="newTitle" size="small" placeholder="简要描述" style="flex:1" />
        <el-button size="small" type="primary" @click="handleAdd">添加</el-button>
      </div>

      <!-- 统计 -->
      <div class="ph-summary">
        <span>共 {{ plotStore.holes.length }} 个 ·
          未填 <strong style="color:#e6a23c">{{ plotStore.unresolvedCount }}</strong> 个
        </span>
        <el-button v-if="plotStore.unresolvedCount > 0" size="small" @click="handleAIScan">
          AI 扫描未填坑
        </el-button>
      </div>

      <!-- 列表 -->
      <div class="ph-list">
        <div v-for="hole in sortedHoles" :key="hole.id" class="ph-item" :class="{ resolved: hole.resolved }">
          <div class="ph-left">
            <el-tag size="small" :type="tagType(hole.type)">{{ typeLabel(hole.type) }}</el-tag>
            <div class="ph-info">
              <span class="ph-title">{{ hole.title }}</span>
              <span class="ph-chapter">@ {{ hole.chapter }}</span>
            </div>
          </div>
          <div class="ph-actions">
            <el-tooltip v-if="!hole.resolved" content="标记已填" placement="top">
              <el-button text size="small" type="success" @click="plotStore.resolveHole(hole.id, '')">✓</el-button>
            </el-tooltip>
            <el-button text size="small" type="danger" @click="plotStore.removeHole(hole.id)">✕</el-button>
          </div>
        </div>
        <div v-if="plotStore.holes.length === 0" class="ph-empty">还没有伏笔和坑位</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { usePlotStore } from "@/stores/plot";
import { useProjectStore } from "@/stores/project";
import { useAIStore } from "@/stores/ai";

const visible = defineModel<boolean>("visible");
const plotStore = usePlotStore();
const projectStore = useProjectStore();
const aiStore = useAIStore();

const newType = ref<"foreshadow" | "plot-hole" | "cliffhanger" | "loose-end">("foreshadow");
const newTitle = ref("");

const sortedHoles = computed(() =>
  [...plotStore.holes].sort((a, b) => (a.resolved === b.resolved ? 0 : a.resolved ? 1 : -1))
);

function handleAdd() {
  if (!newTitle.value.trim()) return;
  plotStore.addHole({
    type: newType.value,
    title: newTitle.value.trim(),
    description: "",
    chapter: projectStore.currentProject?.name || "未知",
    resolved: false,
  });
  newTitle.value = "";
  ElMessage.success("已添加");
}

async function handleAIScan() {
  ElMessage.info("正在扫描...");
  try {
    const resp = await aiStore.sendMessage(
      `以下是我已标记的未填坑位：\n${plotStore.unresolvedHoles.map((h) => `- ${h.title}`).join("\n")}\n\n请分析是否有遗漏的伏笔或坑位需要补充。`
    );
    ElMessageBox.alert(resp.slice(0, 500), "AI 扫描结果");
  } catch (e) { console.error("AI 扫描失败:", e); }
}

function typeLabel(t: string) {
  const map: Record<string, string> = { foreshadow: "伏笔", "plot-hole": "坑位", cliffhanger: "悬念", "loose-end": "未收线" };
  return map[t] || t;
}

function tagType(t: string) {
  const map: Record<string, string> = { foreshadow: "primary", "plot-hole": "warning", cliffhanger: "danger", "loose-end": "info" };
  return map[t] || "info";
}
</script>

<style scoped>
.plot-hole { display: flex; flex-direction: column; gap: 12px; }
.ph-add { display: flex; gap: 8px; }
.ph-summary { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #606266; }
.ph-list { display: flex; flex-direction: column; gap: 4px; max-height: 360px; overflow-y: auto; }
.ph-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid #e4e7ed; border-radius: 6px; }
.ph-item.resolved { opacity: 0.5; background: #f5f7fa; }
.ph-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.ph-info { display: flex; flex-direction: column; min-width: 0; }
.ph-title { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ph-chapter { font-size: 11px; color: #c0c4cc; }
.ph-actions { display: flex; gap: 4px; flex-shrink: 0; }
.ph-empty { text-align: center; padding: 30px; color: #c0c4cc; font-size: 13px; }
</style>
