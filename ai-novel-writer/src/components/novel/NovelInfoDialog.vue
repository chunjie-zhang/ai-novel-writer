<template>
  <el-dialog v-model="visible" title="📖 小说信息" width="500px">
    <el-form label-position="top" size="small">
      <el-form-item label="小说名称">
        <el-input v-model="info.name" placeholder="输入小说名称" />
      </el-form-item>
      <el-form-item label="作者笔名">
        <el-input v-model="info.author" placeholder="输入作者笔名" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="题材">
            <el-select v-model="info.genre" placeholder="选择题材" style="width:100%">
              <el-option label="玄幻仙侠" value="xuanhuan" />
              <el-option label="都市生活" value="dushi" />
              <el-option label="言情恋爱" value="yanqing" />
              <el-option label="科幻未来" value="kehuan" />
              <el-option label="悬疑推理" value="xuanyi" />
              <el-option label="奇幻冒险" value="qihuan" />
              <el-option label="历史穿越" value="lishi" />
              <el-option label="恐怖灵异" value="kongbu" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态">
            <el-select v-model="info.status" placeholder="状态" style="width:100%">
              <el-option label="连载中" value="ongoing" />
              <el-option label="已完结" value="finished" />
              <el-option label="暂停" value="paused" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="小说简介">
        <el-input v-model="info.description" type="textarea" :rows="4" placeholder="输入小说简介..." />
      </el-form-item>
      <el-form-item label="标签（逗号分隔）">
        <el-input v-model="info.tags" placeholder="如：穿越、重生、系统" />
      </el-form-item>
      <el-form-item label="封面">
        <div class="cover-upload">
          <div v-if="info.cover" class="cover-preview">
            <img :src="info.cover" alt="封面" />
            <el-button size="small" type="danger" @click="info.cover = ''">删除</el-button>
          </div>
          <div v-else class="cover-placeholder" @click="handleUploadCover">
            <el-icon :size="32"><Icon icon="lucide:image-plus" /></el-icon>
            <span>点击选择封面图片</span>
          </div>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { ElMessage } from "element-plus";
import { useProjectStore } from "@/stores/project";

const visible = defineModel<boolean>("visible");
const projectStore = useProjectStore();

interface NovelInfo {
  name: string;
  author: string;
  genre: string;
  status: string;
  description: string;
  tags: string;
  cover: string;
}

const info = reactive<NovelInfo>({
  name: "",
  author: "",
  genre: "",
  status: "ongoing",
  description: "",
  tags: "",
  cover: "",
});

watch(visible, (val) => {
  if (val) {
    // 从当前项目 config 加载基本信息（每个小说独立存储，不串数据）
    const p = projectStore.currentProject;
    if (p) {
      info.name = p.name || "";
      info.author = p.author || "";
      info.genre = p.genre || "";
      info.status = p.status || "ongoing";
      info.description = p.description || "";
      info.tags = p.tags || "";
      info.cover = p.cover || "";
    }
  }
});

async function handleUploadCover() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
    });
    if (selected) {
      info.cover = selected;
    }
  } catch (e) {
    // 非 Tauri 环境（浏览器开发）时提示
    ElMessage.info("封面上传需要 Tauri 桌面环境");
  }
}

async function handleSave() {
  const p = projectStore.currentProject;
  if (!p) {
    ElMessage.warning("请先打开一个小说项目");
    return;
  }
  try {
    await projectStore.updateProjectInfo(p.id, {
      name: info.name,
      author: info.author,
      genre: info.genre,
      status: info.status,
      description: info.description,
      tags: info.tags,
      cover: info.cover,
    });
    ElMessage.success("小说信息已保存");
    visible.value = false;
  } catch (e) {
    ElMessage.error("保存失败: " + e);
  }
}
</script>

<style scoped>
.cover-upload {
  display: flex;
  justify-content: center;
}

.cover-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.cover-preview img {
  max-width: 200px;
  max-height: 280px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.cover-placeholder {
  width: 200px;
  height: 280px;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s;
}

.cover-placeholder:hover {
  border-color: #409eff;
  color: #409eff;
}
</style>
