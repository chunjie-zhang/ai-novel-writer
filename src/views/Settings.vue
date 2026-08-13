<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <span>全局设置</span>
      </template>
      <ModelConfig />
    </el-card>

    <el-card style="margin-top: 16px">
      <template #header>
        <span>应用数据目录</span>
      </template>
      <DataDirSettings />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import ModelConfig from "@/components/ai/ModelConfig.vue";
import DataDirSettings from "@/components/ai/DataDirSettings.vue";
</script>

<style scoped>
.settings-page {
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
}
</style>
