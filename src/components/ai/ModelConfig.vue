<template>
  <div class="model-config">
    <el-form label-width="120px" label-position="top" size="small">
      <!-- 模型来源 -->
      <el-form-item label="模型来源">
        <el-radio-group v-model="aiStore.modelProvider">
          <el-radio value="builtin">
            <div class="radio-label">
              <span class="label-title">DeepSeek 官方</span>
              <span class="label-desc">默认配置 DeepSeek 接口地址，需自行填写 API Key</span>
            </div>
          </el-radio>
          <el-radio value="custom">
            <div class="radio-label">
              <span class="label-title">自定义模型</span>
              <span class="label-desc">任意 OpenAI 兼容接口</span>
            </div>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- DeepSeek 官方模式 -->
      <template v-if="aiStore.modelProvider === 'builtin'">
        <el-form-item label="API Key" required>
          <el-input
            v-model="aiStore.customApiKey"
            type="password"
            show-password
            placeholder="必填：输入你的 DeepSeek API Key"
          />
          <div class="form-hint">
            在 <el-link type="primary" href="https://platform.deepseek.com/api_keys" target="_blank">platform.deepseek.com</el-link> 注册获取 Key
          </div>
        </el-form-item>

        <el-form-item label="模型版本">
          <el-radio-group v-model="aiStore.builtinVariant">
            <el-radio value="deepseek-v4-flash">
              <div class="radio-label">
                <span class="label-title">DeepSeek V4 Flash ⚡</span>
                <span class="label-desc">快速创作 · 日常续写 · 性价比高</span>
              </div>
            </el-radio>
            <el-radio value="deepseek-v4-pro">
              <div class="radio-label">
                <span class="label-title">DeepSeek V4 Pro 🧠</span>
                <span class="label-desc">深度推理 · 复杂剧情 · 人设打磨</span>
              </div>
            </el-radio>
          </el-radio-group>
        </el-form-item>
      </template>

      <!-- 自定义模型配置 -->
      <template v-if="aiStore.modelProvider === 'custom'">
        <el-form-item label="API Key" required>
          <el-input
            v-model="aiStore.customApiKey"
            type="password"
            show-password
            placeholder="输入你的 API Key"
          />
        </el-form-item>

        <el-form-item label="Base URL" required>
          <el-input
            v-model="aiStore.customBaseUrl"
            placeholder="https://api.deepseek.com"
          />
        </el-form-item>

        <el-form-item label="模型名称" required>
          <el-input
            v-model="aiStore.customModelName"
            placeholder="deepseek-chat"
          />
        </el-form-item>
      </template>

      <!-- 公共参数 -->
      <!-- 写作场景预设 -->
      <el-divider content-position="left">写作场景预设</el-divider>

      <div class="scene-grid">
        <div
          v-for="(scene, key) in SCENE_PRESETS"
          :key="key"
          class="scene-card"
          :class="{ active: writingStore.activeScene === key }"
          @click="selectScene(key as WritingScene)"
        >
          <span class="scene-emoji">{{ scene.emoji }}</span>
          <div class="scene-info">
            <span class="scene-label">{{ scene.label }}</span>
            <span class="scene-desc">{{ scene.desc }}</span>
          </div>
        </div>
      </div>

      <div v-if="writingStore.activeScene" class="scene-active-info">
        <el-tag size="small" type="success" effect="light" closable @close="writingStore.setScene(null)">
          {{ writingStore.currentScene?.emoji }} {{ writingStore.currentScene?.label }}
        </el-tag>
        <span class="scene-params">
          Temperature {{ writingStore.currentScene?.temperature }} ·
          Max {{ writingStore.currentScene?.maxTokens }} tokens
        </span>
      </div>

      <el-divider content-position="left">生成参数</el-divider>

      <el-form-item label="创意度 (Temperature)">
        <div class="slider-with-value">
          <el-slider
            v-model="aiStore.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            style="flex: 1"
          />
          <span class="slider-value">{{ aiStore.temperature }}</span>
        </div>
        <div class="slider-hint">
          {{ writingStore.activeScene ? `当前场景推荐值：${writingStore.currentScene?.temperature}` : '较低值输出更确定，较高值输出更有创意' }}
        </div>
      </el-form-item>

      <el-form-item label="最大生成长度">
        <el-input-number
          v-model="aiStore.maxTokens"
          :min="256"
          :max="16384"
          :step="256"
          style="width: 160px"
        />
        <div class="form-hint" v-if="aiStore.modelProvider === 'builtin'">
          {{ aiStore.currentPreset.label }} 推荐值：{{ aiStore.currentPreset.max_tokens }}
        </div>
      </el-form-item>

      <el-divider content-position="left">记忆设置</el-divider>

      <el-form-item label="携带章节数">
        <el-input-number
          v-model="contextLimit"
          :min="1"
          :max="50"
          :step="1"
          style="width: 160px"
        />
        <div class="slider-hint">
          续写时携带最近 N 章的 AI 摘要作为上下文
        </div>
      </el-form-item>
    </el-form>

    <div class="config-footer">
      <div class="config-summary">
        <el-tag size="small" type="info" effect="plain">
          {{ aiStore.modelProvider === 'builtin' ? aiStore.currentPreset.label : aiStore.customModelName || '未设置' }}
        </el-tag>
        <el-tag v-if="!aiStore.customApiKey" size="small" type="danger" effect="light">
          未填写 API Key
        </el-tag>
        <el-tag v-else size="small" type="success" effect="light">
          API Key 已填写
        </el-tag>
      </div>
      <div class="config-btns">
        <el-button :loading="isTesting" @click="handleTest">测试连接</el-button>
        <el-button type="primary" @click="handleSave">保存配置</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAIStore } from "@/stores/ai";
import { useWritingStore } from "@/stores/writing";
import { SCENE_PRESETS } from "@/stores/writing";
import type { WritingScene } from "@/stores/writing";
import { ElMessage } from "element-plus";

const aiStore = useAIStore();
const writingStore = useWritingStore();
const contextLimit = ref(10);
const isTesting = ref(false);

function selectScene(scene: WritingScene) {
  writingStore.setScene(scene);
  const preset = SCENE_PRESETS[scene];
  aiStore.temperature = preset.temperature;
  aiStore.maxTokens = preset.maxTokens;
}

const emit = defineEmits<{ saved: [] }>();

function handleSave() {
  aiStore.persistConfig();
  ElMessage.success("模型配置已保存");
  emit("saved");
}

async function handleTest() {
  if (!aiStore.resolvedApiKey) {
    ElMessage.warning("请先填写 API Key");
    return;
  }
  isTesting.value = true;
  try {
    const reply = await aiStore.testConnection();
    ElMessage.success(`✅ 连接成功！模型回复：${reply.slice(0, 30)}`);
  } catch (e: any) {
    const msg = String(e);
    if (msg.includes("401")) {
      ElMessage.error("❌ 连接失败：API Key 无效或已过期（401）。请到 DeepSeek 平台核对 Key。");
    } else if (msg.includes("404") || msg.includes("model")) {
      ElMessage.error("❌ 连接失败：模型名或 Base URL 不正确，请检查配置。");
    } else {
      ElMessage.error("❌ 连接失败：" + msg.slice(0, 120));
    }
  } finally {
    isTesting.value = false;
  }
}
</script>

<style scoped>
.model-config {
  padding: 8px 0;
}

.radio-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}

.label-desc {
  font-size: 12px;
  color: var(--text-2);
}

.slider-with-value {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
}

.slider-value {
  min-width: 32px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
}

.slider-hint {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.config-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  margin-top: 16px;
}

.config-btns {
  display: flex;
  gap: 8px;
}

/* ===== 写作场景预设 ===== */
.scene-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.scene-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--panel-bg-2);
}

.scene-card:hover {
  border-color: var(--accent);
  background: var(--panel-hover);
}

.scene-card.active {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.scene-emoji {
  font-size: 20px;
  flex-shrink: 0;
}

.scene-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.scene-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-1);
}

.scene-desc {
  font-size: 11px;
  color: var(--text-2);
  line-height: 1.3;
}

.scene-active-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--green-soft);
  border: 1px solid rgba(70, 208, 127, 0.25);
  border-radius: 8px;
}

.scene-params {
  font-size: 11px;
  color: var(--text-2);
}
</style>
