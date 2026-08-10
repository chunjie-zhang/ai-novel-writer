<template>
  <div class="appearance-settings">
    <el-form label-position="top" size="small">
      <el-form-item label="主题外观">
        <el-radio-group v-model="mode" @change="handleChange" class="theme-radio-group">
          <el-radio-button value="system">
            <span class="theme-option">🖥️ 跟随系统</span>
          </el-radio-button>
          <el-radio-button value="light">
            <span class="theme-option">☀️ 白天</span>
          </el-radio-button>
          <el-radio-button value="dark">
            <span class="theme-option">🌙 黑夜</span>
          </el-radio-button>
        </el-radio-group>
        <div class="form-hint">
          默认跟随系统外观（浅色 / 深色自动切换）；选择「白天」或「黑夜」可固定主题。
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useThemeStore, type ThemeMode } from "@/stores/theme";

const themeStore = useThemeStore();
const mode = ref<ThemeMode>(themeStore.mode);

function handleChange(m: ThemeMode) {
  themeStore.setMode(m);
}
</script>

<style scoped>
.theme-radio-group {
  display: flex;
}
.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.form-hint {
  margin-top: 8px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.6;
}
</style>
