<template>
  <div class="data-dir-settings">
    <div class="data-dir-intro">
      所有本地数据都集中存放在<b>应用数据目录</b>下，方便统一备份与管理。
    </div>

    <el-table :data="dataItems" size="small" style="margin: 12px 0">
      <el-table-column label="内容" prop="name" width="130" />
      <el-table-column label="位置" prop="path" show-overflow-tooltip />
    </el-table>

    <div class="data-dir-path">
      <span class="path-label">数据目录：</span>
      <el-input v-model="dataDirPath" :disabled="true" placeholder="加载中...">
        <template #append>
          <el-button :disabled="!dataDirPath" @click="handleOpenDataDir">
            <el-icon><Icon icon="lucide:folder-open" /></el-icon>
            <span>在文件夹中打开</span>
          </el-button>
        </template>
      </el-input>
    </div>

    <div class="form-hint">
      提示：技能、参考小说分析、小说项目等不会受浏览器缓存清理影响，删除应用数据目录前请先备份。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { ElMessage } from "element-plus";

const dataDirPath = ref("");
const dataItems = ref<{ name: string; path: string }[]>([]);

onMounted(async () => {
  try {
    dataDirPath.value = await invoke<string>("get_data_dir_path");
    dataItems.value = [
      { name: "AI 模型配置", path: `${dataDirPath.value}/ai-config.json` },
      { name: "自定义技能", path: `${dataDirPath.value}/skills/` },
      { name: "参考小说分析", path: `${dataDirPath.value}/reference/` },
      { name: "小说项目", path: `${dataDirPath.value}/projects/` },
    ];
  } catch (e) {
    dataDirPath.value = "";
    ElMessage.info("请在 Tauri 桌面端查看数据目录");
  }
});

async function handleOpenDataDir() {
  if (!dataDirPath.value) return;
  try {
    await invoke("open_data_dir");
  } catch (e) {
    ElMessage.error("打开数据目录失败");
  }
}
</script>

<style scoped>
.data-dir-intro {
  color: var(--el-text-color-regular);
  font-size: 13px;
}
.data-dir-path {
  display: flex;
  align-items: center;
  gap: 8px;
}
.path-label {
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
