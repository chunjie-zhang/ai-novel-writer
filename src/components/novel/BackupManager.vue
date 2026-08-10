<template>
  <div class="backup-manager">
    <div class="bm-header">
      <h3><el-icon style="vertical-align:-2px"><Icon icon="lucide:hard-drive" /></el-icon> 备份管理</h3>
      <div class="bm-header-actions">
        <el-switch
          v-model="autoBackup"
          size="small"
          active-text="自动"
          inactive-text=""
          @change="handleAutoBackupChange"
        />
        <el-select v-model="autoInterval" size="small" style="width: 100px" :disabled="!autoBackup" @change="handleAutoBackupChange">
          <el-option label="5分钟" :value="5" />
          <el-option label="15分钟" :value="15" />
          <el-option label="30分钟" :value="30" />
          <el-option label="60分钟" :value="60" />
        </el-select>
        <el-button
          type="primary"
          size="small"
          :loading="isBackingUp"
          @click="handleBackup"
          :disabled="!projectId"
        >
          <el-icon><Icon icon="lucide:database-backup" /></el-icon>
          <span>创建备份</span>
        </el-button>
      </div>
    </div>

    <div v-if="backups.length === 0" class="bm-empty">
      <p>暂无备份</p>
      <p class="bm-hint">点击「创建备份」保存当前项目快照</p>
    </div>

    <div v-else class="bm-list">
      <div v-for="b in backups" :key="b" class="bm-item">
        <div class="bm-info">
          <span class="bm-name">{{ formatBackupName(b) }}</span>
          <span class="bm-time">{{ formatBackupTime(b) }}</span>
        </div>
        <div class="bm-actions">
          <el-button size="small" @click="handleRestore(b)">恢复</el-button>
          <el-button size="small" type="danger" @click="handleDeleteBackup(b)">删除</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { ElMessage, ElMessageBox } from "element-plus";

const props = defineProps<{
  projectId: string;
}>();

const backups = ref<string[]>([]);
const isBackingUp = ref(false);
const autoBackup = ref(false);
const autoInterval = ref(15);
let autoTimer: ReturnType<typeof setInterval> | null = null;

async function loadBackups() {
  try {
    backups.value = await invoke<string[]>("list_backups", {
      projectId: props.projectId,
    });
  } catch (e) { console.error("加载备份列表失败:", e); }
}

async function handleBackup() {
  if (!props.projectId) return;
  isBackingUp.value = true;
  try {
    const name = await invoke<string>("backup_project", {
      projectId: props.projectId,
    });
    ElMessage.success(`备份成功: ${formatBackupName(name)}`);
    await loadBackups();
  } catch (e) {
    ElMessage.error("备份失败: " + e);
  } finally {
    isBackingUp.value = false;
  }
}

async function handleRestore(name: string) {
  try {
    await ElMessageBox.confirm(
      `将恢复到备份「${formatBackupName(name)}」的版本？当前内容将被覆盖。`,
      "确认恢复",
      { confirmButtonText: "恢复", cancelButtonText: "取消", type: "warning" }
    );
  } catch { return; }

  try {
    await invoke("restore_backup", {
      backupName: name,
      projectId: props.projectId,
    });
    ElMessage.success("恢复完成，请重新打开项目");
  } catch (e) {
    ElMessage.error("恢复失败: " + e);
  }
}

async function handleDeleteBackup(name: string) {
  try {
    await ElMessageBox.confirm(`确定删除备份「${formatBackupName(name)}」？`, "确认删除", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch { return; }

  try {
    await invoke("delete_backup", {
      backupName: name,
      projectId: props.projectId,
    });
    ElMessage.success("备份已删除");
    await loadBackups();
  } catch (e) {
    ElMessage.error("删除失败: " + e);
  }
}

function formatBackupName(name: string): string {
  // backup name format: 小说名_20250730_120000_uuid
  const parts = name.split("_");
  if (parts.length >= 3) {
    return parts.slice(0, -2).join("_");
  }
  return name;
}

function formatBackupTime(name: string): string {
  const match = name.match(/_(\d{8})_(\d{6})/);
  if (match) {
    return `${match[1].slice(0,4)}-${match[1].slice(4,6)}-${match[1].slice(6,8)} ${match[2].slice(0,2)}:${match[2].slice(2,4)}:${match[2].slice(4,6)}`;
  }
  return "";
}

function handleAutoBackupChange() {
  if (autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (autoBackup.value) {
    localStorage.setItem("novel-auto-backup", JSON.stringify({ enabled: true, interval: autoInterval.value }));
    autoTimer = setInterval(() => {
      if (props.projectId) {
        invoke("backup_project", { projectId: props.projectId })
          .catch(() => {});
      }
    }, autoInterval.value * 60 * 1000);
    ElMessage.success(`已开启自动备份（每${autoInterval.value}分钟）`);
  } else {
    localStorage.setItem("novel-auto-backup", JSON.stringify({ enabled: false, interval: 15 }));
    ElMessage.info("已关闭自动备份");
  }
}

function initAutoBackup() {
  try {
    const saved = JSON.parse(localStorage.getItem("novel-auto-backup") || "{}");
    if (saved.enabled) {
      autoBackup.value = true;
      autoInterval.value = saved.interval || 15;
      handleAutoBackupChange();
    }
  } catch (e) { console.error("初始化自动备份失败:", e); }
}

watch(() => props.projectId, (newId) => {
  loadBackups();
  // 项目切换时重建自动备份定时器
  if (autoBackup.value && autoTimer) {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (newId) {
        invoke("backup_project", { projectId: newId })
          .catch(() => {});
      }
    }, autoInterval.value * 60 * 1000);
  }
});
onMounted(() => {
  loadBackups();
  initAutoBackup();
});
onUnmounted(() => {
  if (autoTimer) clearInterval(autoTimer);
});
</script>

<style scoped>
.backup-manager {
  padding: 12px;
}

.bm-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.bm-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.bm-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.bm-empty {
  text-align: center;
  padding: 30px 20px;
  color: var(--text-2);
}

.bm-hint {
  font-size: 12px;
  margin-top: 4px;
  color: var(--text-3);
}

.bm-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bm-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.bm-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bm-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-1);
}

.bm-time {
  font-size: 11px;
  color: var(--text-2);
}

.bm-actions {
  display: flex;
  gap: 4px;
}
</style>
