<template>
  <div class="storage-settings">
    <el-form label-position="top" size="small">
      <el-form-item label="小说项目存储位置">
        <el-input v-model="currentPath" :disabled="true" placeholder="加载中...">
          <template #append>
            <el-button @click="handleSelectPath">更改</el-button>
          </template>
        </el-input>
        <div class="form-hint">
          所有小说项目的文件存储目录（章节、角色、世界观等）
        </div>
      </el-form-item>

      <el-form-item label="迁移项目">
        <div class="migrate-section">
          <p class="migrate-desc">
            将当前存储位置的所有项目迁移到新目录。迁移完成后会自动更新存储路径。
          </p>
          <el-button
            type="warning"
            :disabled="!currentPath || isMigrating"
            :loading="isMigrating"
            @click="handleMigrate"
          >
            <el-icon><Icon icon="lucide:refresh-cw" /></el-icon>
            <span>迁移到新位置</span>
          </el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { ElMessage, ElMessageBox } from "element-plus";

const currentPath = ref("");
const newPath = ref("");
const isMigrating = ref(false);

onMounted(async () => {
  try {
    currentPath.value = await invoke<string>("get_storage_path");
  } catch {
    currentPath.value = "无法获取";
  }
});

async function handleSelectPath() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择小说项目存储目录",
    });
    if (selected) {
      newPath.value = selected as string;
      // 先保存新路径
      await invoke("set_storage_path", { newPath: newPath.value });
      currentPath.value = newPath.value;
      ElMessage.success("存储路径已更新");
    }
  } catch (e) {
    // 非 Tauri 环境：手动输入
    ElMessage.info("请在 Tauri 桌面端选择目录");
  }
}

async function handleMigrate() {
  if (!currentPath.value) return;

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择迁移目标目录",
    });
    if (!selected) return;

    const targetPath = selected as string;

    try {
      await ElMessageBox.confirm(
        `将从「${currentPath.value}」迁移到「${targetPath}」？\n\n迁移后原位置文件不会被删除，建议确认备份后再手动清理。`,
        "确认迁移",
        { confirmButtonText: "开始迁移", cancelButtonText: "取消", type: "warning" }
      );
    } catch {
      return;
    }

    isMigrating.value = true;
    await invoke("migrate_projects", {
      fromPath: currentPath.value,
      toPath: targetPath,
    });
    currentPath.value = targetPath;
    ElMessage.success("迁移完成！存储路径已更新");
  } catch (e) {
    ElMessage.error("迁移失败: " + e);
  } finally {
    isMigrating.value = false;
  }
}
</script>

<style scoped>
.storage-settings {
  padding: 8px 0;
}

.form-hint {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 4px;
}

.migrate-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.migrate-desc {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
</style>
