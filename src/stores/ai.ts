import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke, Channel } from "@tauri-apps/api/core";
import type { ChatMessage, AIResponse, MemorySummary, DeepSeekVariant } from "@/types";
import { DEEPSEEK_PRESETS } from "@/types";
import { useTemplateStore } from "@/stores/templates";

const CONFIG_KEY = "novel-ai-config";

/** 流式输出块（与 Rust 端 StreamChunk 对应） */
interface StreamChunk {
  delta: string;
  done: boolean;
}

interface PersistedAIConfig {
  modelProvider: "builtin" | "custom";
  builtinVariant: DeepSeekVariant;
  customApiKey: string;
  customBaseUrl: string;
  customModelName: string;
  temperature: number;
  maxTokens: number;
}

function loadConfig(): PersistedAIConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error("loadAiConfig 失败:", e); }
  return null;
}

function saveConfig(config: PersistedAIConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export const useAIStore = defineStore("ai", () => {
  // 从 localStorage 恢复配置（磁盘配置在 initFromDisk 中加载，优先级更高）
  const saved = loadConfig();

  // 状态
  const messages = ref<ChatMessage[]>([]);
  const isGenerating = ref(false);
  // 当前会话属于哪个项目（用于按小说保存/恢复聊天历史）
  const chatProjectId = ref<string | null>(null);

  // ===== 会话历史持久化（按项目隔离，重启后恢复） =====
  function chatStorageKey(projectId: string | null): string {
    return `novel-chat-${projectId || "global"}`;
  }

  function persistChat() {
    try {
      localStorage.setItem(chatStorageKey(chatProjectId.value), JSON.stringify(messages.value));
    } catch (e) {
      console.error("保存聊天记录失败:", e);
    }
  }

  /** 加载指定小说的历史会话 */
  function loadChatHistory(projectId: string | null) {
    chatProjectId.value = projectId;
    try {
      const raw = localStorage.getItem(chatStorageKey(projectId));
      const parsed = raw ? JSON.parse(raw) : [];
      messages.value = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("加载聊天记录失败:", e);
      messages.value = [];
    }
  }

  // ===== 模型配置（从持久化恢复） =====
  const modelProvider = ref<"builtin" | "custom">(saved?.modelProvider ?? "builtin");
  const builtinVariant = ref<DeepSeekVariant>(saved?.builtinVariant ?? "deepseek-v4-flash");
  const customApiKey = ref(saved?.customApiKey ?? "");
  const customBaseUrl = ref(saved?.customBaseUrl ?? "");
  const customModelName = ref(saved?.customModelName ?? "");
  const temperature = ref(saved?.temperature ?? 0.8);
  const maxTokens = ref(saved?.maxTokens ?? 4096);

  // ===== 计算属性：根据当前模式解析实际模型参数 =====
  const resolvedApiKey = computed(() => {
    // 去除两端空格，避免粘贴时带入空白导致认证失败
    return customApiKey.value.trim();
  });

  const resolvedBaseUrl = computed(() => {
    if (modelProvider.value === "builtin") {
      return DEEPSEEK_PRESETS[builtinVariant.value].base_url;
    }
    return customBaseUrl.value || "https://api.deepseek.com";
  });

  const resolvedModelName = computed(() => {
    if (modelProvider.value === "builtin") {
      return DEEPSEEK_PRESETS[builtinVariant.value].model;
    }
    return customModelName.value || "deepseek-chat";
  });

  const resolvedMaxTokens = computed(() => {
    if (modelProvider.value === "builtin") {
      return DEEPSEEK_PRESETS[builtinVariant.value].max_tokens;
    }
    return maxTokens.value;
  });

  // 当前 DeepSeek 官方模型的预设信息
  const currentPreset = computed(() => DEEPSEEK_PRESETS[builtinVariant.value]);

  // 切换模型变体时，同步更新 maxTokens
  watch(builtinVariant, (variant) => {
    if (modelProvider.value === "builtin") {
      maxTokens.value = DEEPSEEK_PRESETS[variant].max_tokens;
    }
  });

  // ===== 自动持久化：配置变化时自动保存 =====
  // 本地 localStorage 立即保存；磁盘防抖保存（避免频繁 IO）
  let diskSaveTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    [modelProvider, builtinVariant, customApiKey, customBaseUrl, customModelName, temperature, maxTokens],
    () => {
      persistConfigLocal();
      scheduleDiskSave();
    },
    { deep: true }
  );

  // 系统提示词
  const systemPrompt = ref(
    "你是一位专业的小说创作助手。你擅长帮助作者进行小说创作，包括写大纲、设定角色、构建世界观、续写内容、改写润色等。请根据用户的需求提供专业的小说创作帮助。"
  );

  // 方法
  function buildConfig(): PersistedAIConfig {
    return {
      modelProvider: modelProvider.value,
      builtinVariant: builtinVariant.value,
      customApiKey: customApiKey.value,
      customBaseUrl: customBaseUrl.value,
      customModelName: customModelName.value,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
    };
  }

  /** 保存到 localStorage（同步） */
  function persistConfigLocal() {
    saveConfig(buildConfig());
  }

  /** 保存到磁盘（防抖，通过 Rust 命令） */
  function scheduleDiskSave() {
    if (diskSaveTimer) clearTimeout(diskSaveTimer);
    diskSaveTimer = setTimeout(() => {
      invoke("save_ai_config", { config: buildConfig() }).catch((e) => {
        console.error("保存 AI 配置到磁盘失败:", e);
      });
    }, 800);
  }

  /** 保存配置：localStorage + 立即写磁盘 */
  function persistConfig() {
    persistConfigLocal();
    invoke("save_ai_config", { config: buildConfig() }).catch((e) => {
      console.error("保存 AI 配置到磁盘失败:", e);
    });
  }

  /** 应用配置到各 ref */
  function applyConfig(config: PersistedAIConfig | null) {
    if (!config) return;
    if (config.modelProvider) modelProvider.value = config.modelProvider;
    if (config.builtinVariant) builtinVariant.value = config.builtinVariant;
    if (config.customApiKey !== undefined) customApiKey.value = config.customApiKey;
    if (config.customBaseUrl !== undefined) customBaseUrl.value = config.customBaseUrl;
    if (config.customModelName !== undefined) customModelName.value = config.customModelName;
    if (config.temperature !== undefined) temperature.value = config.temperature;
    if (config.maxTokens !== undefined) maxTokens.value = config.maxTokens;
    // 应用后同步到 localStorage，避免下次又读到旧的
    persistConfigLocal();
  }

  /** 应用启动时从磁盘加载配置（兜底）
   * localStorage 每次改动都会立即写入，是最新的；只有 localStorage 为空（如换了环境被清空）才用磁盘兜底，
   * 避免磁盘残留的旧配置覆盖用户最新设置 */
  async function initFromDisk() {
    try {
      const local = localStorage.getItem(CONFIG_KEY);
      if (local) return; // localStorage 有配置 = 用最新的，不再用磁盘覆盖
      const diskConfig = await invoke<PersistedAIConfig | null>("load_ai_config");
      if (diskConfig && typeof diskConfig === "object") {
        applyConfig(diskConfig);
      }
    } catch (e) {
      console.error("加载磁盘 AI 配置失败:", e);
    }
  }

  function setModelConfig(config: {
    provider?: "builtin" | "custom";
    builtinVariant?: DeepSeekVariant;
    apiKey?: string;
    baseUrl?: string;
    modelName?: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    if (config.provider !== undefined) modelProvider.value = config.provider;
    if (config.builtinVariant !== undefined) builtinVariant.value = config.builtinVariant;
    if (config.apiKey !== undefined) customApiKey.value = config.apiKey;
    if (config.baseUrl !== undefined) customBaseUrl.value = config.baseUrl;
    if (config.modelName !== undefined) customModelName.value = config.modelName;
    if (config.temperature !== undefined) temperature.value = config.temperature;
    if (config.maxTokens !== undefined) maxTokens.value = config.maxTokens;
  }

  function addMessage(role: "user" | "assistant", content: string) {
    messages.value.push({ role, content });
    // 每次新增消息立即持久化
    persistChat();
  }

  function clearMessages() {
    messages.value = [];
    persistChat();
  }

  async function sendMessage(content: string): Promise<string> {
    addMessage("user", content);

    isGenerating.value = true;
    try {
      // 注入题材风格模板（若已选择），让 AI 输出贴合所选题材的文风
      let finalSystemPrompt = systemPrompt.value;
      let finalTemperature = temperature.value;
      const templateStore = useTemplateStore();
      if (templateStore.activeTemplate) {
        const t = templateStore.activeTemplate;
        finalSystemPrompt = `${finalSystemPrompt}\n\n【题材风格指引：${t.emoji} ${t.name}】\n${t.stylePrompt}\n- 角色命名：${t.namingStyle}\n- 节奏建议：${t.paceAdvice}\n请严格遵循以上题材风格进行创作。`;
        // 未指定场景时，使用模板推荐温度
        finalTemperature = t.temperature;
      }

      // 构建完整消息列表
      const allMessages: ChatMessage[] = [
        { role: "system", content: finalSystemPrompt },
        ...messages.value.slice(0, -1), // 除当前消息外的所有历史
        { role: "user", content },
      ];

      // ===== 流式输出：预置空 assistant 消息，逐块填充 =====
      messages.value.push({ role: "assistant", content: "" });
      const assistantIdx = messages.value.length - 1;

      const channel = new Channel<StreamChunk>();
      let full = "";
      let resolveDone!: (v: string) => void;
      const completion = new Promise<string>((res) => {
        resolveDone = res;
      });

      channel.onmessage = (msg) => {
        if (msg.done) {
          resolveDone(full);
        } else {
          full += msg.delta;
          if (messages.value[assistantIdx]) {
            messages.value[assistantIdx].content = full;
          }
        }
      };

      await invoke("call_ai_stream", {
        baseUrl: resolvedBaseUrl.value,
        apiKey: resolvedApiKey.value,
        model: resolvedModelName.value,
        messages: allMessages,
        temperature: finalTemperature,
        maxTokens: resolvedMaxTokens.value,
        onEvent: channel,
      });

      const result = await completion;
      persistChat(); // 流式结束后持久化一次
      return result;
    } finally {
      isGenerating.value = false;
    }
  }

  async function saveMemory(
    projectId: string,
    memory: Omit<MemorySummary, "created_at">
  ) {
    const fullMemory: MemorySummary = {
      ...memory,
      created_at: new Date().toISOString(),
    };
    await invoke("save_memory", { projectId, memory: fullMemory });
  }

  async function listMemories(projectId: string): Promise<MemorySummary[]> {
    return await invoke<MemorySummary[]>("list_memories", { projectId });
  }

  /** 测试当前模型连接：发送一条极短消息验证 API Key / Base URL 是否可用 */
  async function testConnection(): Promise<string> {
    const result = await invoke<AIResponse>("call_ai", {
      baseUrl: resolvedBaseUrl.value,
      apiKey: resolvedApiKey.value,
      model: resolvedModelName.value,
      messages: [{ role: "user", content: "你好，请只回复四个字：连接成功" }],
      temperature: 0.3,
      maxTokens: 50,
    });
    return result.content;
  }

  return {
    messages,
    isGenerating,
    chatProjectId,
    modelProvider,
    builtinVariant,
    customApiKey,
    customBaseUrl,
    customModelName,
    temperature,
    maxTokens,
    // 解析后的只读参数（用于实际调用）
    resolvedApiKey,
    resolvedBaseUrl,
    resolvedModelName,
    resolvedMaxTokens,
    currentPreset,
    systemPrompt,
    persistConfig,
    initFromDisk,
    setModelConfig,
    addMessage,
    clearMessages,
    loadChatHistory,
    sendMessage,
    saveMemory,
    listMemories,
    testConnection,
  };
});
