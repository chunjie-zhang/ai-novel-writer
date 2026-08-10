<template>
  <div class="settings-page">
    <el-card>
      <template #header>
        <span>全局设置</span>
      </template>
      <ModelConfig />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import ModelConfig from "@/components/ai/ModelConfig.vue";
</script>

<style scoped>
.settings-page {
  padding: 24px;
  max-width: 720px;
  margin: 0 auto;
}
</style>
