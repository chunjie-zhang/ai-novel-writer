<template>
  <el-dialog v-model="visible" title="📚 题材风格模板" width="700px">
    <div class="template-selector">
      <div class="template-grid">
        <div
          v-for="t in templateStore.allTemplates"
          :key="t.id"
          class="template-card"
          :class="{ active: templateStore.activeTemplateId === t.id }"
          @click="templateStore.setTemplate(t.id)"
        >
          <span class="template-emoji">{{ t.emoji }}</span>
          <span class="template-name">{{ t.name }}</span>
          <span class="template-desc">{{ t.description }}</span>
          <div class="template-tags">
            <el-tag v-for="tag in t.tags" :key="tag" size="small">{{ tag }}</el-tag>
          </div>
        </div>
      </div>

      <div v-if="templateStore.activeTemplate" class="template-detail">
        <el-divider />
        <h4>已选：{{ templateStore.activeTemplate.emoji }} {{ templateStore.activeTemplate.name }}</h4>
        <div class="detail-section">
          <div class="detail-item">
            <span class="detail-label">文风指引</span>
            <p class="detail-value">{{ templateStore.activeTemplate.stylePrompt }}</p>
          </div>
          <div class="detail-item">
            <span class="detail-label">命名风格</span>
            <p class="detail-value">{{ templateStore.activeTemplate.namingStyle }}</p>
          </div>
          <div class="detail-item">
            <span class="detail-label">节奏建议</span>
            <p class="detail-value">{{ templateStore.activeTemplate.paceAdvice }}</p>
          </div>
          <div class="detail-item">
            <span class="detail-label">推荐温度</span>
            <p class="detail-value">{{ templateStore.activeTemplate.temperature }}</p>
          </div>
        </div>
      </div>

      <div style="text-align:center;margin-top:16px">
        <el-button v-if="templateStore.activeTemplateId" @click="templateStore.setTemplate(null)">
          清除模板选择
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { useTemplateStore } from "@/stores/templates";

const visible = defineModel<boolean>("visible");
const templateStore = useTemplateStore();
</script>

<style scoped>
.template-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }

.template-card {
  display: flex; flex-direction: column; gap: 6px;
  padding: 16px; border: 2px solid #e4e7ed; border-radius: 10px;
  cursor: pointer; transition: all 0.2s;
}

.template-card:hover { border-color: #409eff; background: #f0f7ff; }
.template-card.active { border-color: #409eff; background: #ecf5ff; }

.template-emoji { font-size: 28px; }
.template-name { font-size: 15px; font-weight: 600; }
.template-desc { font-size: 12px; color: #909399; }
.template-tags { display: flex; gap: 4px; flex-wrap: wrap; }

.template-detail { text-align: left; }
.template-detail h4 { margin-bottom: 12px; }
.detail-section { display: flex; flex-direction: column; gap: 10px; }
.detail-item { }
.detail-label { font-size: 12px; color: #909399; font-weight: 600; }
.detail-value { font-size: 13px; color: #303133; margin: 4px 0 0; line-height: 1.6; }
</style>
