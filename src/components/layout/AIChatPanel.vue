<template>
  <div class="ai-chat-panel">
    <div class="panel-header" data-tauri-drag-region="deep">
      <span class="panel-title">AI 对话助手</span>
      <div class="panel-actions">
        <el-tooltip content="导入参考小说" placement="bottom">
          <el-button
            text
            size="small"
            :type="refStore.hasReference ? 'warning' : ''"
            @click="showImport = true"
          >
            <el-icon><Icon icon="lucide:upload" /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="清空对话" placement="bottom">
          <el-button text size="small" @click="handleClear">
            <el-icon><Icon icon="lucide:trash-2" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 参考小说状态栏 -->
    <div v-if="refStore.hasReference" class="ref-status">
      <div class="ref-info">
        <el-icon color="#e6a23c"><Icon icon="lucide:book-marked" /></el-icon>
        <span class="ref-title">{{ refStore.referenceNovel?.title }}</span>
        <span class="ref-count">{{ refStore.referenceNovel?.total_chapters }}章</span>
      </div>
      <div class="ref-actions">
        <el-tag
          v-if="refStore.writingMode"
          size="small"
          type="warning"
          effect="light"
          closable
          @close="refStore.setWritingMode(null)"
        >
          {{ refStore.currentMode?.emoji }} {{ refStore.currentMode?.label }}
        </el-tag>
        <el-button text size="small" type="danger" @click="refStore.clear()">
          <el-icon><Icon icon="lucide:x" /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 输出目标小说选择条 -->
    <div class="output-target">
      <el-icon class="ot-icon"><Icon icon="lucide:target" /></el-icon>
      <span class="ot-label">写入</span>
      <el-select
        v-model="outputProjectId"
        placeholder="选小说…"
        size="small"
        clearable
        filterable
        class="ot-select"
        @change="handleOutputProjectChange"
      >
        <el-option
          v-for="p in projectStore.projects"
          :key="p.id"
          :label="p.name"
          :value="p.id"
        />
      </el-select>
      <el-select
        v-model="outputChapterId"
        placeholder="选章节/新建…"
        size="small"
        clearable
        filterable
        class="ot-select ot-chapter"
        :disabled="!outputProjectId"
        :no-data-text="outputProjectId ? '暂无章节，选择「+ 新建章节」' : '请先选择小说'"
        @change="handleOutputChapterChange"
      >
        <el-option label="＋ 新建章节" value="__NEW__" class="ot-new-option">
          <el-icon><Icon icon="lucide:file-plus" /></el-icon> 新建章节
        </el-option>
        <el-option
          v-for="c in projectStore.chapters"
          :key="c.file_name"
          :label="c.title"
          :value="c.file_name"
        >
          <span class="ot-chapter-opt">
            <el-icon :size="12" style="vertical-align:-2px"><Icon icon="lucide:file-text" /></el-icon>
            {{ c.title }}
          </span>
        </el-option>
      </el-select>
      <!-- 目标字数（全局配置，设置一次后持久生效） -->
      <el-tooltip content="设置每次生成的目标字数（全局生效，AI 控制在附近），留空不限制" placement="bottom">
        <div class="ot-wordcount">
          <el-icon class="ot-wordcount-icon"><Icon icon="lucide:type" /></el-icon>
          <el-input-number
            v-model="aiStore.targetWordCount"
            :min="100"
            :max="20000"
            :step="500"
            :controls="false"
            size="small"
            placeholder="字数"
            class="ot-wordcount-input"
          />
          <span class="ot-wordcount-unit">字</span>
        </div>
      </el-tooltip>
      <el-tooltip content="新建小说作为输出目标" placement="bottom">
        <el-button
          size="small"
          text
          circle
          class="ot-new"
          @click="emitCreateProject"
        >
          <el-icon><Icon icon="lucide:folder-plus" /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tag
        v-if="outputProjectId && outputChapterId"
        size="small"
        type="success"
        effect="plain"
        class="ot-auto-tag"
      >
        {{ outputChapterId === '__NEW__' ? '将新建章节' : '追加到该章节' }}
      </el-tag>
    </div>

    <!-- 对话消息列表 -->
    <div class="chat-messages" ref="messagesRef">
      <div v-if="aiStore.messages.length === 0" class="chat-hint">
        <div class="hint-icon"><Icon icon="lucide:bot" :width="44" :height="44" /></div>
        <p>AI 创作助手</p>
        <p class="hint-sub">
          <template v-if="skillStore.activeSkills.length">
            <span class="hint-skill-title">当前技能：</span>
            <span
              v-for="s in skillStore.activeSkills"
              :key="s.id"
              class="hint-skill-item"
            >
              <Icon v-if="s.icon" :icon="s.icon" :width="13" :height="13" class="hint-skill-icon" />
              <span v-else class="hint-skill-icon">{{ s.emoji }}</span>
              <span class="hint-skill-name">{{ s.name }}</span>
            </span>
          </template>
          <template v-else>
            输入 @ 快速选择技能，或直接输入需求<br />
            写大纲 · 写人设 · 改剧情 · 填坑 · 纠错
          </template>
        </p>
        <div class="suggestions">
          <el-tag
            v-for="s in suggestions"
            :key="s"
            size="small"
            class="suggestion-tag"
            @click="sendSuggestion(s)"
          >
            {{ s }}
          </el-tag>
        </div>
      </div>

      <div
        v-for="(msg, index) in aiStore.messages"
        :key="index"
        class="message-item"
        :class="msg.role"
      >
        <div class="message-avatar">
          {{ msg.role === "user" ? "我" : "AI" }}
        </div>
        <div class="message-content">
          <div class="message-text">{{ msg.content }}</div>
        </div>
      </div>

      <!-- AI 正在生成 -->
      <div v-if="aiStore.isGenerating" class="message-item assistant">
        <div class="message-avatar">AI</div>
        <div class="message-content">
          <div class="thinking-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
          <!-- 分批续写实时进度 -->
          <div v-if="multiProgress.visible" class="multi-progress">
            <div class="mp-bar">
              <div class="mp-bar-inner" :style="{ width: multiProgress.percent + '%' }"></div>
            </div>
            <div class="mp-text">
              <span v-if="multiProgress.lastDoneText" class="mp-done">{{ multiProgress.lastDoneText }}</span>
              <span v-if="multiProgress.statusText" class="mp-current">{{ multiProgress.statusText }}</span>
              <span class="mp-count">{{ multiProgress.written }}/{{ multiProgress.total }} 章</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <!-- @提及技能浮层 -->
      <div
        v-if="mentionVisible"
        class="mention-popover"
        @mousedown.prevent
      >
        <div class="mention-title">
          <el-icon><Icon icon="lucide:sparkles" /></el-icon> 选择技能（@ 应用）
        </div>
        <div
          v-for="(skill, idx) in mentionSkills"
          :key="skill.id"
          class="mention-item"
          :class="{ active: idx === mentionIndex }"
          @mousedown="selectMention(skill)"
        >
          <span class="mention-icon">
            <Icon v-if="skill.icon" :icon="skill.icon" :width="16" :height="16" />
            <span v-else>{{ skill.emoji }}</span>
          </span>
          <span class="mention-name">{{ skill.name }}</span>
          <el-tag
            v-if="skill.source === 'builtin'"
            size="small"
            type="primary"
            effect="plain"
            class="mention-source"
          >官方</el-tag>
          <el-tag
            v-else
            size="small"
            type="warning"
            effect="plain"
            class="mention-source"
          >自定义</el-tag>
        </div>
        <div v-if="mentionSkills.length === 0" class="mention-empty">没有匹配的技能</div>
      </div>

      <!-- 技能状态条（多技能横排，图标文字一行） -->
      <div v-if="skillStore.activeSkills.length" class="skill-status">
        <span class="skill-status-label">技能</span>
        <el-tag
          v-for="skill in skillStore.activeSkills"
          :key="skill.id"
          size="small"
          type="success"
          effect="light"
          closable
          class="skill-status-tag"
          @close="skillStore.removeActiveSkill(skill.id)"
        >
          <span class="skill-status-inner">
            <Icon v-if="skill.icon" :icon="skill.icon" :width="13" :height="13" class="skill-status-icon" />
            <span v-else class="skill-status-icon">{{ skill.emoji }}</span>
            <span class="skill-status-name">{{ skill.name }}</span>
          </span>
        </el-tag>
      </div>
      <el-input
        v-model="inputText"
        type="textarea"
        :rows="3"
        :placeholder="inputPlaceholder"
        :disabled="aiStore.isGenerating"
        @keydown="handleKeydown"
        @input="handleInput"
      />
      <div class="input-actions">
        <div class="model-info">
          <el-tag size="small" type="info" effect="plain">
            {{ aiStore.modelProvider === "builtin" ? aiStore.currentPreset.label : aiStore.customModelName || '自定义' }}
          </el-tag>
        </div>
        <el-button
          type="primary"
          :disabled="!aiStore.isGenerating && !inputText.trim()"
          @click="aiStore.isGenerating ? aiStore.stopGeneration() : handleSend()"
        >
          <!-- 生成中显示自旋图标 + 「停止」；loading 属性会禁用点击，故用自定义图标 -->
          <el-icon v-if="aiStore.isGenerating" class="is-loading" style="margin-right: 4px;">
            <Icon icon="lucide:loader-2" />
          </el-icon>
          <span>{{ aiStore.isGenerating ? "停止" : "发送" }}</span>
        </el-button>
      </div>
    </div>

    <!-- 导入参考小说对话框 -->
    <NovelImportDialog v-model:visible="showImport" @confirm="handleImportConfirm" />

    <!-- 人设校验结果对话框 -->
    <el-dialog v-model="showOOCDialog" width="560px" :close-on-click-modal="false" class="ooc-dialog">
      <template #header>
        <span class="dlg-title"><el-icon><Icon icon="lucide:shield-alert" /></el-icon> 人设校验提醒</span>
      </template>
      <div class="ooc-content">
        <el-alert
          title="检测到可能的人设不一致"
          type="warning"
          :description="oocSummary"
          show-icon
          :closable="false"
        />
        <div class="ooc-detail">
          <div class="ooc-detail-head">
            <span class="ooc-detail-badge">
              <el-icon><Icon icon="lucide:shield-alert" /></el-icon>
            </span>
            <div class="ooc-detail-title">
              <span class="ooc-detail-title-text">校验详情</span>
              <span class="ooc-detail-sub">角色行为与设定一致性检查报告</span>
            </div>
          </div>
          <div class="ooc-rendered" v-html="renderMarkdown(showOOCResult)"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showOOCDialog = false">忽略</el-button>
        <el-button type="primary" @click="showOOCDialog = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { invoke } from "@tauri-apps/api/core";
import type { Character } from "@/types";
import { useAIStore } from "@/stores/ai";
import { useSkillStore } from "@/skills/store";
import { useReferenceStore } from "@/stores/reference";
import { useWritingStore } from "@/stores/writing";
import NovelImportDialog from "@/components/novel/NovelImportDialog.vue";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { useOutlineStore } from "@/stores/outline";
import { useTemplateStore } from "@/stores/templates";
import { buildSmartContext } from "@/utils/nlp";
import { extractJsonContent } from "@/utils/ai";
import { normalizeChapterTitle, chineseToArabic } from "@/utils/chapterTitle";
import { renderMarkdown } from "@/utils/markdown";

const aiStore = useAIStore();
const skillStore = useSkillStore();
const refStore = useReferenceStore();
const writingStore = useWritingStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();

const inputText = ref("");
const showImport = ref(false);
const showOOCDialog = ref(false);
const showOOCResult = ref("");
const oocSummary = ref("");
const messagesRef = ref<HTMLElement | null>(null);

// ===== 分批续写实时进度 =====
const multiProgress = ref({
  visible: false,
  total: 0,
  written: 0,
  percent: 0,
  /** 上一批完成提示，如「✅ 第 1-3 章续写完毕」 */
  lastDoneText: "",
  /** 当前状态，如「正在续写第 4-6 章…」 */
  statusText: "",
});

// ===== 输出目标小说 =====
/** AI 生成内容要写入的目标小说 ID */
const outputProjectId = ref<string>("");
/** AI 生成内容要写入的目标章节（file_name；'__NEW__'=新建章节） */
const outputChapterId = ref<string>("");
// 目标字数改为 aiStore.targetWordCount（全局配置，设置一次后持久生效）

// 默认跟随当前打开的小说；打开小说时同步
watch(
  () => projectStore.currentProject?.id,
  (id) => {
    if (id) outputProjectId.value = id;
  },
  { immediate: true }
);

/** 选择输出目标后，打开该小说（同步上下文） */
function handleOutputProjectChange(projectId: string | undefined) {
  if (projectId) {
    projectStore.openProject(projectId);
    outputChapterId.value = "";
    ElMessage.success(`AI 生成内容将保存到「${projectStore.projects.find((p) => p.id === projectId)?.name}」`);
  }
}

/** 选择写入章节 */
function handleOutputChapterChange(_chapterId: string | undefined) {
  if (!outputChapterId.value) return;
}

/** 触发「新建小说」对话框（App.vue 监听 open-new-project 事件） */
function emitCreateProject() {
  window.dispatchEvent(new CustomEvent("open-new-project"));
  // 新建成功后 outputProjectId 由 currentProject watch 自动同步
}

// ===== @提及技能 =====
const mentionVisible = ref(false);
const mentionIndex = ref(0);
const mentionKeyword = ref("");
const mentionCaret = ref(0);
const mentionAtIdx = ref(-1);
const mentionSkills = computed(() => {
  const kw = mentionKeyword.value.trim().toLowerCase();
  const list = skillStore.allSkills;
  if (!kw) return list;
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(kw) ||
      (s.description || "").toLowerCase().includes(kw)
  );
});

const suggestions = computed(() => {
  const base = ["帮我写一个大纲", "生成一个人物设定", "续写当前章节", "检查剧情漏洞"];
  if (refStore.hasReference) {
    return [
      `仿写"${refStore.referenceNovel?.title}"的风格`,
      `借鉴"${refStore.referenceNovel?.title}"的剧情结构`,
      "分析这部小说的写作特点",
      ...base.slice(0, 2),
    ];
  }
  return base;
});

const inputPlaceholder = computed(() => {
  if (refStore.writingMode) {
    return `输入你的${refStore.currentMode?.label}需求...`;
  }
  if (skillStore.activeSkill) {
    return `输入你的${skillStore.activeSkill.name}需求...`;
  }
  return "输入你的创作需求...";
});

// 切换小说时，加载该小说的历史会话（每本小说独立记忆）
watch(
  () => projectStore.currentProject?.id,
  (id) => {
    aiStore.loadChatHistory(id ?? null);
    // 历史加载完成后自动滚动到底部（最新一条）
    scrollToBottom();
  },
  { immediate: true }
);

// 消息数量变化时（加载历史 / AI 回复 / 清空）自动滚动到底部
watch(
  () => aiStore.messages.length,
  () => scrollToBottom()
);

async function handleSend() {
  if (!inputText.value.trim() || aiStore.isGenerating) return;
  // 每次发起会话重置停止标志（上一次停止不影响本次）
  aiStore.stopRequested = false;
  closeMention();
  const text = inputText.value;
  inputText.value = "";

  // 仿写/续写类技能：必须有输出目标小说+章节，否则无法落盘
  const needSaveSkill = skillStore.activeSkills.some(
    (s) => s.id === "imitate-and-continue" || s.id === "imitate-style" || s.id === "reference-plot"
  );
  if (needSaveSkill) {
    if (!outputProjectId.value) {
      inputText.value = text; // 还原输入，避免丢失
      ElMessage.warning("请先在 AI 助手顶部选择要写入的小说（或新建一本）");
      return;
    }
    if (!outputChapterId.value) {
      inputText.value = text;
      ElMessage.warning("请选择要写入的章节（或选「＋ 新建章节」）");
      return;
    }
  }

  // ===== 构建智能上下文（语义召回 + 动态拼接） =====
  let memoryContext = "";
  if (projectStore.currentStructure) {
    const { memories, characters, world_setting } = projectStore.currentStructure;
    const currentContent = editorStore.content || text;

    // 使用智能上下文拼接（只召回相关记忆）
    memoryContext = buildSmartContext(
      currentContent,
      memories.map((m) => ({
        chapter_id: m.chapter_id,
        chapter_title: m.chapter_title,
        summary: m.summary,
        key_events: m.key_events,
      })),
      characters.map((c) => ({
        name: c.name,
        personality: c.personality,
        background: c.background,
      })),
      world_setting?.content || "",
      aiStore.contextLimit
    );

    // 设置角色设定给人设校验用
    if (characters.length > 0) {
      writingStore.setCharacterProfiles(
        characters.map((c) => `${c.name}(${c.personality})`).join("; ")
      );
    }
  }

  // ===== 构建 system prompt =====
  let systemPrompt = "你是一位专业的小说创作助手。你擅长帮助作者进行小说创作，包括写大纲、设定角色、构建世界观、续写内容、改写润色等。请根据用户的需求提供专业的小说创作帮助。";

  if (writingStore.activeScene && writingStore.currentScene) {
    systemPrompt = writingStore.currentScene.systemPrompt;
  } else if (refStore.writingMode && refStore.hasAnalysis) {
    systemPrompt = refStore.getModeSystemPrompt();
  } else if (skillStore.activeSkills.length > 0) {
    // 多技能：合并每个技能的 systemPrompt，让 AI 同时遵循多个技能的指令
    const parts = skillStore.activeSkills.map((s, i) =>
      `【技能 ${i + 1}：${s.name}】\n${s.systemPrompt}`
    );
    systemPrompt = parts.join("\n\n");

    // 仿写/借鉴类技能：注入参考小说上下文（分析摘要），让 AI 能读到参考作品特征
    const needReference = skillStore.activeSkills.some(
      (s) => s.id === "imitate-and-continue" || s.id === "imitate-style" || s.id === "reference-plot"
    );
    if (needReference && refStore.hasReference) {
      systemPrompt = `${systemPrompt}\n\n${refStore.referenceContext}`;
      // 仿写类技能：正在创作一本全新的小说，章节一律从第 1 章开始连续编号，
      // 不要沿用参考小说的章节编号，也不要从中间章节开始写（否则会生成「第9章」这类编号）
      systemPrompt = `${systemPrompt}\n\n【章节编号要求】\n正在创作一本全新的小说，所有章节从第 1 章开始连续编号。仿写参考小说时，新书第 1 章对应参考小说开篇，不要沿用参考小说的章节编号，也不要从中间章节开始写。`;
    }
  }

  // 拼接文风采样
  if (writingStore.sampledStyle) {
    systemPrompt = `${writingStore.sampledStyle}\n\n${systemPrompt}`;
  }

  // 追加智能上下文
  if (memoryContext) {
    systemPrompt = `${systemPrompt}\n\n${memoryContext}`;
  }

  // 应用场景预设的温度参数
  if (writingStore.activeScene && writingStore.currentScene) {
    aiStore.temperature = writingStore.currentScene.temperature;
    aiStore.maxTokens = writingStore.currentScene.maxTokens;
  }

  // 情绪智能适配：根据当前章节内容的情绪（战斗/悬疑/细腻等）微调生成温度，
  // 让 AI 输出的文风氛围贴合当前剧情情绪
  if (editorStore.content) {
    aiStore.temperature = writingStore.suggestTemperature(editorStore.content.slice(-2000));
  }

  // 目标字数：让 AI 控制生成篇幅在设定值附近（±10~15% 浮动）
  // 记住生成前 maxTokens，生成后恢复，避免字数限制污染后续会话
  const savedMaxTokens = aiStore.maxTokens;
  // 多章节意图：用户要求"续写N章/写N章/接下来N章"（N≥2）时，按章输出，不再限制总字数（否则会被压成 1 章）
  // 允许"续写"与"章"之间有词语（如"续写接下来的20章"）；"一章/1章"仍视为单章
  // 数字支持 2-9 及 ≥10（如 10/12/20），避免 1 开头的两位数被漏判
  const wantsMultiChapter = /(?:[2-9]|[1-9]\d+|[二三四五六七八九十百千万两]+)\s*(章|章节)/.test(text);
  if (!wantsMultiChapter && aiStore.targetWordCount && aiStore.targetWordCount > 0) {
    const n = aiStore.targetWordCount;
    const low = Math.round(n * 0.85);
    const high = Math.round(n * 1.15);
    systemPrompt = `${systemPrompt}\n\n【输出字数要求（必须遵守）】\n本次输出正文汉字数必须控制在约 ${n} 字，合理范围 ${low}~${high} 字。\n要求：\n- 达到目标字数后立即自然收尾结束，不要继续展开新情节或啰嗦重复；\n- 若预测会超出上限，应压缩描写、加快节奏，确保在范围内完成；\n- 字数只统计正文汉字，不含标题、Markdown 符号、标点与空白。\n- 不要为了凑字数注水，也不要为了求短而残缺。`;
    // 物理限制输出长度：目标字数 × 1.8 作为 token 上限（中文约 1 字 ≈ 1.3~1.5 token），
    // 与既有上限取更小值，确保 AI 无法生成远超目标的内容
    aiStore.maxTokens = Math.min(aiStore.maxTokens, Math.ceil(n * 1.8));
  } else if (wantsMultiChapter) {
    // 多章节续写：提示 AI 按章节逐个输出，每章相对独立
    systemPrompt = `${systemPrompt}\n\n【多章节续写要求】\n本次请按用户要求的章节数量逐章输出，每个章节用 Markdown 一级标题「# 章节标题」开头，章节之间用空行分隔。\n标题格式必须统一：一律用「第N章 标题」且 N 用阿拉伯数字（如「第6章 归途」），不要用中文数字，不要用「第N卷」作为章节标题，不要重复卷标题。不要把所有章节挤成一大段，也不要只写一章就收尾。`;
  }

  aiStore.systemPrompt = systemPrompt;

  // ===== 大批量续写（N≥4 章）：分批自动续写 =====
  // 单次调用受 maxTokens 限制，写不完 N 章；分批生成 + 保存 + 衔接上下文，直到写满
  if (wantsMultiChapter) {
    const chapterCount = extractChapterCount(text);
    if (chapterCount >= 4) {
      // 右侧聊天显示用户需求（分批续写走静默调用，这里手动补一条 user 消息）
      aiStore.addMessage("user", text);
      await generateMultiChapter(text, chapterCount);
      aiStore.maxTokens = savedMaxTokens; // 恢复原上限
      scrollToBottom();
      return;
    }
  }

  // ===== 写章节场景（仿写/续写技能 + 已选输出小说）：右侧只显示"生成中"提示，正文只在中间展示 =====
  const isWritingChapter = needSaveSkill && !!outputProjectId.value;
  if (isWritingChapter) {
    // 右侧聊天放一个"生成中"占位，正文不写进聊天
    aiStore.addMessage("assistant", "✍️ 正在创作章节…");
  }
  const aiResult = await aiStore.sendMessage(text, { writeToChat: !isWritingChapter });
  aiStore.maxTokens = savedMaxTokens; // 恢复原上限

  // ===== 仿写/续写类技能：生成后自动保存为新章节 =====
  if (isWritingChapter) {
    await autoSaveToChapter(aiResult);
  }

  // ===== 人设校验（后台静默执行，不打断主流程、不污染聊天记录） =====
  if (writingStore.characterProfiles) {
    const lastAssistantMsg = [...aiStore.messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg) {
      try {
        const oocPrompt = writingStore.buildOOCPrompt(lastAssistantMsg.content.slice(0, 3000));
        // 用静默调用：不写聊天记录、不触发流式预览，避免【人设校验】消息刷屏和覆盖中间编辑器
        const oocResult = await aiStore.silentCall(
          [
            { role: "system", content: "你是一位严谨的人设一致性审查员，只输出客观检查结果。" },
            { role: "user", content: oocPrompt },
          ],
          { temperature: 0.2, maxTokens: 1024 }
        );
        if (oocResult && oocResult.length > 20) {
          showOOCResult.value = oocResult;
          oocSummary.value = oocResult.slice(0, 100) + "...";
          showOOCDialog.value = true;
        }
      } catch { /* 静默失败，不干扰主流程 */ }
    }
  }

  scrollToBottom();
}

/**
 * 将 AI 回复按章节标题拆分为多个章节块。
 * 识别「# 标题」与独立行的「第X章 / 第X节」作为章节边界；「第X卷」卷标题不作为章节。
 * 仅当有 ≥2 个带正文的章节块时才算多章节。
 */
function splitChapters(content: string): { title: string; body: string }[] {
  const lines = content.split("\n");
  const chapters: { title: string; body: string }[] = [];
  let cur: { title: string; body: string[] } | null = null;
  const headingOf = (line: string): string | null => {
    const t = line.trim();
    if (!t) return null;
    // Markdown 标题：# xxx
    const md = t.match(/^#{1,6}\s+(.+)$/);
    if (md) {
      const h = md[1].trim();
      // 卷标题（如「第1卷」「第一卷 星渊崛起」）不作为章节，跳过
      if (/^第\s*[\d一二三四五六七八九十百千零两]+\s*卷/.test(h)) return null;
      return h;
    }
    // 独立行的「第X章 / 第X节」（短标题）
    if (/^第[\d一二三四五六七八九十百千零]+[章节][^\n]{0,50}$/.test(t)) {
      return t;
    }
    return null;
  };
  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      if (cur) chapters.push({ title: cur.title, body: cur.body.join("\n") });
      cur = { title: heading, body: [] };
    } else if (cur) {
      cur.body.push(line);
    }
  }
  if (cur) chapters.push({ title: cur.title, body: cur.body.join("\n") });
  // 过滤掉没有正文的章节（如仅标题）
  return chapters
    .map((c) => ({ title: c.title, body: c.body.trim() }))
    .filter((c) => c.body.length > 0);
}

/** 从用户输入中提取要求的章节数量（如"续写20章""写十章"），提取不到返回 0 */
function extractChapterCount(text: string): number {
  const m = text.match(/([0-9]+|[一二三四五六七八九十百千万两]+)\s*(章|章节)/);
  if (!m) return 0;
  const raw = m[1];
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  return chineseToArabic(raw) || 0;
}

/** 计算章节列表中最大的「第N章」编号（标题非编号格式返回 0） */
function maxChapterNumOf(chapters: { title?: string }[]): number {
  let max = 0;
  for (const c of chapters) {
    const m = String(c.title || "").match(/第\s*([0-9一二三四五六七八九十百千零两]+)\s*[章节篇回]/);
    if (m) {
      const n = chineseToArabic(m[1].trim());
      if (!isNaN(n) && n > max) max = n;
    }
  }
  return max;
}

/**
 * 统一章节标题格式：
 * - 中文数字 → 阿拉伯数字（第二章 → 第2章，含"第 二 章"空格变体）
 * - 去除重复/多余的卷前缀（"第一卷 第一卷 星渊崛起" → "第一卷 星渊崛起"）
 * - 去除"第X章"后的多余空格
 */
function normalizeChapterTitleNum(title: string): string {
  let t = (title || "").trim();
  t = t.replace(/第\s*([一二三四五六七八九十百千零两]+)\s*(章|章回|节)/g, (_m, num, suffix) => `第${chineseToArabic(num)}${suffix}`);
  // 去重复卷前缀：多个"第X卷"连写只留第一个
  t = t.replace(/^((?:第\s*[\d一二三四五六七八九十百千零两]+\s*卷\s*)+)(.*)$/, (m, vols, rest) => {
    const volsList = vols.trim().split(/\s+/).filter(Boolean);
    if (volsList.length > 1) {
      return `${volsList[0]} ${rest}`;
    }
    return m;
  });
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * 分批续写：当用户要求"续写 N 章"（N 较大，单次受 maxTokens 限制写不完）时，
 * 每批生成若干章并自动保存，把进度作为上下文继续下一批，直到写完 N 章。
 * 使用静默调用（不污染聊天、不覆盖中间预览），用进度提示反馈。
 */
async function generateMultiChapter(originalText: string, totalChapters: number) {
  const projectId = outputProjectId.value;
  if (!projectId) {
    ElMessage.warning("请先选择要写入的小说");
    return;
  }
  const ai = useAIStore();
  ai.isGenerating = true; // 让右侧按钮变「停止」，生成中可点击中断
  // 初始化实时进度
  multiProgress.value = {
    visible: true,
    total: totalChapters,
    written: 0,
    percent: 0,
    lastDoneText: "",
    statusText: `准备续写 ${totalChapters} 章…`,
  };
  try {
    // 每章目标字数（全局配置，0=不限制）。分批续写也须遵守每章字数，否则每章只写 1000 字左右
    const targetPerChapter = aiStore.targetWordCount || 0;
    const MAX_BATCH_TOKENS = 16000; // 单次输出安全上限
    // 逐章续写：每批只生成 1 章（用户要求一章一章生成，避免多章合批导致每章字数幅度超标、字数不可控）
    const BATCH = 1;
    // 输出目标小说的章节列表（起始章号 / 衔接上下文应基于「输出目标小说」，而非当前打开的项目——两者可能不是同一本）
    let targetChapters: { title: string; file_name: string }[] = [];
    try {
      const struct = await invoke<any>("get_project_structure", { projectId });
      targetChapters = Array.isArray(struct?.chapters) ? struct.chapters : [];
    } catch (e) {
      console.error("读取输出目标小说章节失败，回退到当前打开项目:", e);
      targetChapters = projectStore.chapters;
    }

    // 仿写类技能（imitate-and-continue/imitate-style/reference-plot）：把参考小说从头仿写一遍 → 起始章号从第 1 章开始，不衔接目标小说已有章节
    const isImitateSkill = skillStore.activeSkills.some(
      (s) => s.id === "imitate-and-continue" || s.id === "imitate-style" || s.id === "reference-plot"
    );
    // 起始章号：仿写从头（1）开始；普通续写从「输出目标小说」已有章节的最大编号 + 1 开始（避免从第 1 章重写）
    const startChapter = isImitateSkill
      ? 1
      : Math.max(maxChapterNumOf(targetChapters), targetChapters.length) + 1;
    // 已有章节标题（作为衔接上下文；仿写场景视为新书，不衔接目标小说已有章节）
    const existingTitles = isImitateSkill
      ? []
      : targetChapters.map((c) => c.title).filter(Boolean);
    const savedTitles: string[] = [...existingTitles];
    let written = 0;
    let guard = 0;
    const MAX_BATCHES = 100; // 最多 100 批（逐章时允许更多章），防止异常死循环

    // 读取已有章节最后一章结尾内容，作为续写衔接上下文（让暂停后再次续写能真正接上剧情；仿写场景从头仿写不读取）
    let existingTail = "";
    if (!isImitateSkill && existingTitles.length > 0) {
      try {
        const lastCh = targetChapters[targetChapters.length - 1];
        if (lastCh) {
          const c = await invoke<string>("read_chapter", {
            projectId,
            fileName: lastCh.file_name,
          });
          existingTail = c.slice(-800); // 取末尾 800 字作为衔接点
        }
      } catch { /* 读取失败则忽略衔接上下文 */ }
    }

    while (written < totalChapters && guard < MAX_BATCHES) {
      // 用户点击了停止：中断续写（当前批 silentCall 会先完成并保存，然后不再继续后续批次）
      if (aiStore.stopRequested) {
        break;
      }
      guard++;
      const remaining = totalChapters - written;
      const batch = Math.min(BATCH, remaining);
      const currentStart = startChapter + written; // 本批起始章号
      const currentEnd = currentStart + batch - 1; // 本批结束章号

      // 更新进度：当前正在续写的章节（逐章时显示单章号）
      multiProgress.value.statusText = batch > 1
        ? `正在续写第 ${currentStart}-${currentEnd} 章…`
        : `正在续写第 ${currentStart} 章…`;

      // 本批提示：从第 currentStart 章开始，衔接上一章结尾
      const batchDesc = batch > 1
        ? `续写接下来的 ${batch} 章`
        : `续写本章（第 ${currentStart} 章）`;
      let prompt = `【逐章续写任务】\n${originalText}\n\n请从第 ${currentStart} 章开始，${batchDesc}（章节编号从 ${currentStart} 顺延，不要重新从第 1 章开始）。`;
      if (written > 0) {
        const batchTitles = savedTitles.slice(existingTitles.length).join("、");
        prompt += `\n本批次已完成章节：${batchTitles}。请严格衔接上一章（第 ${currentStart - 1} 章【${savedTitles[savedTitles.length - 1]}】）的结尾剧情，保持人物、世界观、剧情连贯，章节编号顺延。`;
      } else if (existingTitles.length > 0) {
        // 已有章节：衔接最后一章（即第 startChapter-1 章）
        const lastExisting = existingTitles[existingTitles.length - 1];
        prompt += `\n该小说已有 ${existingTitles.length} 章（${existingTitles.join("、")}）。请严格衔接最后一章（第 ${startChapter - 1} 章【${lastExisting}】）的结尾剧情续写，保持人物、世界观、剧情连贯，章节编号顺延，不要重新开头。`;
        if (existingTail) {
          prompt += `\n【上一章结尾内容（严格据此衔接续写）】\n${existingTail}`;
        }
      }
      prompt += `\n本章用 Markdown 一级标题「# 章节标题」开头，标题统一用「第N章 标题」且 N 用阿拉伯数字（如「第${currentStart}章 …」），不要用中文数字，不要用「第N卷」作为章节标题。`;
      // 每章字数要求：单章生成时严格约束本章字数，避免幅度超标
      if (targetPerChapter > 0) {
        const low = Math.round(targetPerChapter * 0.85);
        const high = Math.round(targetPerChapter * 1.15);
        prompt += `\n【本章字数要求（必须遵守）】本章正文汉字数要控制在约 ${targetPerChapter} 字（合理范围 ${low}~${high} 字），不要只写 1000 字左右就收尾；内容要完整充实。`;
      }

      let content = "";
      try {
        // 动态 maxTokens：batch 章 × 每章 tokens，与安全上限取小
        const batchMaxTokens = targetPerChapter > 0
          ? Math.min(MAX_BATCH_TOKENS, Math.ceil(batch * targetPerChapter * 1.8))
          : 8000;
        content = await ai.silentCall(
          [
            { role: "system", content: ai.systemPrompt || "你是一位专业的小说创作助手。" },
            { role: "user", content: prompt },
          ],
          { temperature: 0.7, maxTokens: batchMaxTokens }
        );
      } catch (e) {
        console.error("分批续写第", written + 1, "批失败:", e);
        ElMessage.warning(`续写中断（第 ${written + 1} 章起），可稍后重试`);
        break;
      }

      const chunks = splitChapters(content);
      if (chunks.length === 0) {
        ElMessage.warning("本批未产出有效章节，续写已停止");
        break;
      }

      // 每批只保存，不做元信息回填/不替换聊天消息（避免重复、拖慢、误改历史）；全部完成后统一回填一次
      const savedTitlesBatch = await saveMultipleChapters(projectId, chunks, { skipAutoFill: true, skipReplaceAssistant: true });
      for (const t of savedTitlesBatch) savedTitles.push(t);
      written += savedTitlesBatch.length;
      // 更新进度：本批完成 + 提示下一批
      multiProgress.value.written = written;
      multiProgress.value.percent = Math.min(100, Math.round((written / totalChapters) * 100));
      multiProgress.value.lastDoneText = batch > 1
        ? `✅ 第 ${currentStart}-${currentEnd} 章续写完毕`
        : `✅ 第 ${currentStart} 章续写完毕`;
      if (written < totalChapters) {
        const nextStart = currentEnd + 1;
        const nextEnd = Math.min(startChapter + totalChapters - 1, nextStart + batch - 1);
        multiProgress.value.statusText = batch > 1
          ? `接下来续写第 ${nextStart}-${nextEnd} 章…`
          : `接下来续写第 ${nextStart} 章…`;
      } else {
        multiProgress.value.statusText = "全部续写完成";
      }
      ElMessage.success(`已续写 ${written}/${totalChapters} 章`);
    }

    if (written >= totalChapters) {
      // 全部完成后统一回填一次小说元信息（信息/大纲/世界观/角色/题材模板）
      await autoFillNovelMeta(projectId);
      const newTitles = savedTitles.slice(existingTitles.length);
      aiStore.addMessage(
        "assistant",
        `✅ 已续写完成 ${totalChapters} 章（第 ${startChapter}~${startChapter + totalChapters - 1} 章）：${newTitles.join("、")}`
      );
      ElMessage.success(`全部 ${totalChapters} 章续写完成！`);
    } else if (written > 0) {
      const newTitles = savedTitles.slice(existingTitles.length);
      aiStore.addMessage(
        "assistant",
        `⚠️ 已续写 ${written}/${totalChapters} 章（第 ${startChapter}~${startChapter + written - 1} 章）：${newTitles.join("、")}。剩余可再次发起续写`
      );
      ElMessage.warning(`已完成 ${written}/${totalChapters} 章（剩余可再次发起续写）`);
    } else {
      // 停止时未生成任何章节
      ElMessage.warning("已停止续写（未生成任何章节）");
    }
  } finally {
    ai.isGenerating = false;
    // 延迟隐藏进度区，让用户看到最终完成状态
    setTimeout(() => {
      multiProgress.value.visible = false;
    }, 1500);
  }
}

/**
 * 生成单章记忆摘要并写入本地记忆库（memories.json，按小说 id 存放于项目目录）。
 * 用于长篇创作的剧情连贯性：续写时通过 buildSmartContext 召回最近记忆注入上下文。
 * 删除小说时，项目目录被整体删除，该小说的记忆库会一并清理（无需单独处理）。
 * 后台任务：失败静默，不影响主流程。
 */
async function generateChapterMemory(
  projectId: string,
  chapterId: string,
  chapterTitle: string,
  chapterOrder: number,
  content: string
) {
  try {
    const body = (content || "").replace(/\s/g, "");
    if (body.length < 100) return; // 太短不生成，避免无效摘要
    const prompt = `请阅读下面的小说章节，生成该章节的「记忆摘要」，供长篇创作时保持剧情连贯（供 AI 续写时回忆）。

要求：输出 JSON，不要用 Markdown 代码块包裹，不要任何说明文字：
{
  "summary": "用 2-3 句话概括本章发生的关键剧情（含人物、地点、事件、结果）",
  "key_events": ["本章关键事件1", "事件2", "事件3", "事件4"]（3-6 个，每个一句话）
}

章节标题：${chapterTitle}

章节内容：
${content.slice(0, 4000)}`;
    const result = await aiStore.silentCall(
      [{ role: "user", content: prompt }],
      { temperature: 0.3, maxTokens: 800 }
    );
    const parsed = extractJsonContent(result);
    const summary = typeof parsed?.summary === "string" ? parsed.summary : "";
    const keyEvents = Array.isArray(parsed?.key_events)
      ? parsed.key_events.filter((k: unknown) => typeof k === "string").slice(0, 6)
      : [];
    if (!summary && keyEvents.length === 0) return; // 解析失败则跳过
    await aiStore.saveMemory(projectId, {
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      chapter_order: chapterOrder,
      summary: summary || keyEvents.join("；"),
      key_events: keyEvents,
    });
    // 记忆已写入本地 memories.json；刷新项目结构，让后续创作能立即引用新记忆
    await projectStore.openProject(projectId);
  } catch (e) {
    console.error("生成章节记忆失败:", e);
  }
}

/** 多章节批量保存：把拆分出的多个章节分别新建为独立章节 */
async function saveMultipleChapters(
  projectId: string,
  chapters: { title: string; body: string }[],
  opts: { skipAutoFill?: boolean; skipReplaceAssistant?: boolean } = {}
): Promise<string[]> {
  const existing = new Set(projectStore.chapters.map((c) => c.title));
  const savedTitles: string[] = [];
  const savedChapters: { title: string; body: string }[] = [];
  for (const ch of chapters) {
    // 统一标题格式：去掉 #/路径/.md + 统一编号（中文数字→阿拉伯、去重复卷前缀）
    let title = normalizeChapterTitleNum(normalizeChapterTitle(ch.title));
    if (!title) title = smartTitleFromContent(ch.body);
    if (!title) title = `AI生成_${Date.now()}`;
    let base = title;
    let n = 2;
    while (existing.has(title)) {
      title = `${base}_${n}`;
      n++;
    }
    existing.add(title);
    await invoke("save_chapter", {
      projectId,
      chapterTitle: title,
      group: "",
      content: ch.body,
    });
    savedTitles.push(title);
    savedChapters.push({ title, body: ch.body });
  }
  await projectStore.openProject(projectId);

  // ===== 生成各章记忆摘要（按小说 id 存本地 memories.json，后台不阻塞） =====
  for (const sc of savedChapters) {
    const ch = projectStore.chapters.find((c) => c.title === sc.title);
    if (ch) {
      generateChapterMemory(projectId, ch.file_name, ch.title, ch.order, sc.body);
    }
  }

  // 在中间编辑器打开最后一个章节
  const lastTitle = savedTitles[savedTitles.length - 1];
  const last = projectStore.chapters.find((c) => c.title === lastTitle);
  if (last) {
    const c = await invoke<string>("read_chapter", {
      projectId,
      fileName: last.file_name,
    });
    await editorStore.openChapterWithMemory(last, c, projectId);
  }
  // 右侧聊天不再展示完整章节，替换为简短提示
  if (!opts.skipReplaceAssistant) {
    aiStore.replaceLastAssistant(
      `📖 已拆分为 ${savedTitles.length} 个章节保存：${savedTitles.join("、")}`
    );
  }
  ElMessage.success(`已将内容拆分为 ${savedTitles.length} 个章节保存`);

  // 自动回填小说元信息（大纲/世界观/小说信息/角色/题材模板）
  if (!opts.skipAutoFill) {
    await autoFillNovelMeta(projectId);
  }
  return savedTitles; // 返回规范化后的章节标题列表
}

/** 仿写/续写生成后：把最后一条 AI 回复写入目标章节，并在中间编辑器展示 */
async function autoSaveToChapter(contentOverride?: string) {
  const projectId = outputProjectId.value;
  if (!projectId) return;
  // 优先用传入的内容（写章节场景正文不进聊天）；否则从最后一条 assistant 取
  let aiContent = (contentOverride || "").trim();
  if (!aiContent) {
    const lastAssistant = [...aiStore.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    aiContent = (lastAssistant?.content || "").trim();
  }
  if (!aiContent || aiContent.length < 50) return; // 过短不自动存，避免空/占位内容

  try {
    // ===== 多章节拆分：若 AI 回复含多个「# 标题 / 第X章」块，逐个新建保存 =====
    const multi = splitChapters(aiContent);
    if (multi.length >= 2) {
      await saveMultipleChapters(projectId, multi);
      return;
    }

    const target = outputChapterId.value;
    const isNew = target === "__NEW__" || !target;

    if (isNew) {
      // ===== 新建章节：提取标题，写入并展示 =====
      let title = normalizeChapterTitleNum(normalizeChapterTitle(extractChapterTitle(aiContent)));
      if (!title) {
        // 未识别到 # 标题 / 第X章：根据正文首句智能生成标题
        title = smartTitleFromContent(aiContent);
      }
      if (!title) {
        title = `${skillStore.activeSkills[0]?.name || "AI生成"}_${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/[/:]/g, "")}`;
      }
      const existing = new Set(projectStore.chapters.map((c) => c.title));
      let base = title;
      let n = 2;
      while (existing.has(title)) {
        title = `${base}_${n}`;
        n++;
      }

      await invoke("save_chapter", {
        projectId,
        chapterTitle: title,
        group: "",
        content: aiContent,
      });
      await projectStore.openProject(projectId);

      // 在中间编辑器打开刚保存的章节
      const chapter = projectStore.chapters.find((c) => c.title === title);
      if (chapter) {
        const c = await invoke<string>("read_chapter", {
          projectId,
          fileName: chapter.file_name,
        });
        await editorStore.openChapterWithMemory(chapter, c, projectId);
      }
      // 右侧聊天不再展示完整章节（太长），替换为简短提示
      aiStore.replaceLastAssistant(`📖 已保存为章节「${title}」，全文已在中间编辑器展示，此处不再重复`);
      ElMessage.success(`已保存为章节「${title}」并在编辑器中打开`);
      // 生成本章记忆摘要（按小说 id 存本地，后台执行）
      if (chapter) {
        generateChapterMemory(projectId, chapter.file_name, chapter.title, chapter.order, aiContent);
      }
    } else {
      // ===== 追加到已有章节：读原文 + 追加 AI 内容 + 保存 =====
      const chapter = projectStore.chapters.find((c) => c.file_name === target);
      if (!chapter) {
        ElMessage.warning("未找到目标章节，已改为新建");
        outputChapterId.value = "__NEW__";
        return autoSaveToChapter();
      }

      // 读取章节原文
      const raw = await invoke<string>("read_chapter", {
        projectId,
        fileName: chapter.file_name,
      });
      // 追加前去掉 AI 内容开头的标题行（已有章节有自己的标题，避免正文出现第二个标题）
      const bodyText = aiContent.replace(/^#{1,6}\s*[^\n]*\n+/m, "").trim();
      const newContent = `${raw.replace(/\s+$/, "")}\n\n${bodyText}`;
      await invoke("save_chapter", {
        projectId,
        chapterTitle: chapter.title,
        group: chapter.group || "",
        content: newContent,
      });
      await projectStore.openProject(projectId);

      // 在中间编辑器打开该章节，展示追加后的完整内容
      const refreshed = projectStore.chapters.find((c) => c.file_name === target) || chapter;
      const c = await invoke<string>("read_chapter", {
        projectId,
        fileName: refreshed.file_name,
      });
      await editorStore.openChapterWithMemory(refreshed, c, projectId);
      // 右侧聊天不再展示完整章节（太长），替换为简短提示
      aiStore.replaceLastAssistant(`📖 已追加到章节「${chapter.title}」，全文已在中间编辑器展示，此处不再重复`);
      ElMessage.success(`已追加到章节「${chapter.title}」并在编辑器中展示`);
      // 更新该章记忆摘要（按小说 id 存本地，后台执行）
      generateChapterMemory(projectId, refreshed.file_name, refreshed.title, refreshed.order, newContent);
    }

    // ===== 自动回填小说元信息（大纲/世界观/小说信息/题材）=====
    // 仅在目标小说尚无大纲时执行一次，避免覆盖用户已设置的内容
    await autoFillNovelMeta(projectId);
  } catch (e) {
    console.error("自动保存章节失败:", e);
    ElMessage.error("自动保存章节失败: " + e);
  }
}

/** 常见题材关键词 → 题材模板 id（精确命中优先） */
const GENRE_TO_TEMPLATE: Record<string, string> = {
  "玄幻": "xuanhuan",
  "仙侠": "xuanhuan",
  "修仙": "xuanhuan",
  "修真": "xuanhuan",
  "奇幻": "qihuan",
  "都市": "dushi",
  "都市异能": "dushi",
  "现代": "dushi",
  "言情": "yanqing",
  "恋爱": "yanqing",
  "甜宠": "yanqing",
  "科幻": "kehuan",
  "星际": "kehuan",
  "赛博": "kehuan",
  "悬疑": "xuanyi",
  "推理": "xuanyi",
  "冒险": "qihuan",
  "历史": "lishi",
  "穿越": "lishi",
  "恐怖": "kongbu",
  "灵异": "kongbu",
  "惊悚": "kongbu",
};

/**
 * 根据题材关键词匹配内置题材模板（templateStore.allTemplates），返回模板 id 或 null。
 * 优先精确题材映射；未命中再用模板名/标签/描述/风格倾向模糊匹配，得分最高者胜出。
 */
function matchGenreTemplate(genre: string, extraKeywords: string = ""): string | null {
  const tStore = useTemplateStore();
  const text = `${genre} ${extraKeywords}`.toLowerCase();
  if (!text.trim()) return null;
  // 1. 精确题材映射（优先）
  for (const [kw, id] of Object.entries(GENRE_TO_TEMPLATE)) {
    if (text.includes(kw)) return id;
  }
  // 2. 模板字段模糊匹配
  let best: string | null = null;
  let bestScore = 0;
  for (const t of tStore.allTemplates) {
    let score = 0;
    if (text.includes(t.name)) score += 12;
    for (const kw of [...t.tags, t.id, t.description, t.worldTendency]) {
      if (kw && text.includes(kw.toLowerCase())) score += 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return bestScore > 0 ? best : null;
}

/** 把 AI 提炼的角色列表批量写入角色管理（兼容中英文字段名） */
async function saveCharacters(projectId: string, chars: any[]) {
  if (!Array.isArray(chars) || chars.length === 0) return;
  for (const c of chars.slice(0, 15)) {
    if (!c || !c.name) continue;
    const char: Character = {
      id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: String(c.name || c.姓名 || "新角色"),
      gender: String(c.gender || c.性别 || "未知"),
      age: String(c.age || c.年龄 || ""),
      personality: String(c.personality || c.性格 || c.traits || ""),
      appearance: String(c.appearance || c.外貌 || ""),
      background: String(c.background || c.背景 || c.role || ""),
      relationships: String(c.relationships || c.关系 || ""),
      speech_pattern: String(c.speech_pattern || c.说话风格 || ""),
      notes: String(c.notes || c.备注 || ""),
    };
    try {
      await invoke("save_character", { projectId, character: char });
    } catch { /* 忽略单个角色保存失败 */ }
  }
}

/**
 * 根据刚生成的小说内容，自动生成并回填：小说信息（书名/题材/简介）、大纲、世界观、角色管理、题材模板。
 * 在仿写/续写生成保存章节后调用（基于生成章节内容回填，覆盖/完善小说管理）。
 */
async function autoFillNovelMeta(projectId: string) {
  // 汇总已有章节内容（取前几章作为 AI 生成元信息的依据）
  const chapterTexts: string[] = [];
  for (const ch of projectStore.chapters.slice(0, 3)) {
    try {
      const c = await invoke<string>("read_chapter", {
        projectId,
        fileName: ch.file_name,
      });
      chapterTexts.push(`【${ch.title}】\n${c.slice(0, 1500)}`);
    } catch { /* 忽略读取失败 */ }
  }
  const sample = chapterTexts.join("\n\n").slice(0, 6000);
  if (!sample) return;
  const projectMeta = projectStore.projects.find((p) => p.id === projectId);

  try {
    const aiStore = useAIStore();
    // 最多尝试 3 次：请求失败或 JSON 解析失败都会重试
    let result: any = null;
    let lastError: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await invoke<any>("call_ai", {
          baseUrl: aiStore.resolvedBaseUrl,
          apiKey: aiStore.resolvedApiKey,
          model: aiStore.resolvedModelName,
          messages: [
            {
              role: "system",
              content: `你是一位小说创作元信息专家。请根据用户提供的小说章节内容，提炼出这部小说的完整元信息，严格按以下 JSON 结构输出，不要加任何额外说明，不要使用 Markdown 代码块包裹，直接输出 JSON：

{
  "book_name": "书名",
  "genre": "题材（如：都市异能/玄幻/仙侠/科幻/悬疑/言情/历史）",
  "description": "一句话简介（40字以内）",
  "characters": [
    {"name":"角色名","gender":"性别","age":"年龄","personality":"性格特征","appearance":"外貌","background":"背景经历","relationships":"与其他角色关系","speech_pattern":"说话风格"}
  ],
  "world": {
    "content": "世界观核心设定描述（100-200字）",
    "factions": [{"name":"势力名","description":"描述","members":["成员"]}],
    "rules": ["规则1","规则2"],
    "geography": "主要地理环境描述"
  },
  "outline": {
    "title": "书名",
    "volumes": [
      {"title":"第一卷","description":"本卷概述","chapters":[{"title":"章节名","description":"该章剧情概述"}]}
    ]
  }
}

要求：
- 基于已有章节内容合理提炼，不要凭空编造太多细节
- genre 用常见网文题材分类
- characters 列出已在章节中登场的主要角色（至少 3 个，最多 10 个），不要漏掉主角
- outline.volumes 至少包含 1 卷，每卷下 chapters 列出已有的章节并补充分卷走向`,
            },
            { role: "user", content: sample },
          ],
          temperature: 0.4,
          topP: aiStore.topP,
          maxTokens: 8192,
        });
        result = extractJsonContent(response.content);
        break;
      } catch (e) {
        lastError = e;
        console.warn(`自动回填小说元信息第 ${attempt} 次失败:`, e);
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800 * attempt)); // 逐次加长等待
        }
      }
    }
    if (!result) throw lastError || new Error("生成小说元信息失败");

    // 1. 回填小说信息（书名/题材/简介）——书名优先保留用户已有标题，不被 AI 生成的书名覆盖
    const name = projectMeta?.name || result.book_name || "未命名小说";
    await projectStore.updateProjectInfo(projectId, {
      name,
      genre: result.genre || "",
      description: result.description || "",
    });

    // 2. 回填大纲（标题用现有书名，避免覆盖）
    const outline = result.outline;
    if (outline) {
      const oStore = useOutlineStore();
      oStore.initOutline(name);
      if (Array.isArray(outline.volumes) && outline.volumes.length > 0) {
        // 清空默认卷，改用 AI 生成的分卷
        oStore.outline!.children = [];
        for (const vol of outline.volumes) {
          oStore.addVolume(vol.title || `第${oStore.outline!.children.length + 1}卷`);
          const volNode = oStore.outline!.children[oStore.outline!.children.length - 1];
          volNode.description = vol.description || "";
          if (Array.isArray(vol.chapters)) {
            for (const ch of vol.chapters) {
              oStore.addChapter(volNode.id, ch.title || "未命名章节");
              const chNode = volNode.children[volNode.children.length - 1];
              chNode.description = ch.description || "";
            }
          }
        }
      }
      oStore.saveOutline(projectId);
    }

    // 3. 回填世界观
    if (result.world) {
      const world = {
        content: result.world.content || "",
        factions: Array.isArray(result.world.factions) ? result.world.factions : [],
        rules: Array.isArray(result.world.rules) ? result.world.rules : [],
        geography: result.world.geography || "",
      };
      await invoke("save_world", { projectId, worldSetting: world });
    }

    // 4. 回填角色管理
    await saveCharacters(projectId, result.characters);

    // 5. 自动匹配题材模板（根据题材 + 世界观关键词，选中合适的风格模板）
    const tStore = useTemplateStore();
    const tid = matchGenreTemplate(result.genre || "", result.world?.content || "");
    if (tid) tStore.setTemplate(tid);

    await projectStore.openProject(projectId);
    ElMessage.success(
      `已自动回填：小说信息/大纲/世界观/角色/题材模板（${result.genre || "题材未定"}）`
    );
  } catch (e) {
    console.error("自动回填小说元信息失败:", e);
    ElMessage.warning("自动回填小说管理失败（可稍后在 AI 面板重新生成触发）");
  }
}

/** 从风格摘要关键词推断题材（AI 未返回 genre 时兜底） */
function inferGenreFromSummary(summary: string): string {
  if (!summary) return "";
  const pairs: [string, string[]][] = [
    ["玄幻", ["玄幻", "仙侠", "修仙", "修真", "斗气", "魔法", "大陆", "神明", "武者", "修炼", "异界", "剑"]],
    ["都市异能", ["都市异能", "异能", "超能力", "觉醒"]],
    ["都市", ["都市", "现代", "职场", "商业", "豪门", "总裁", "娱乐圈"]],
    ["科幻", ["科幻", "星际", "未来", "机甲", "赛博", "太空", "科技"]],
    ["悬疑", ["悬疑", "推理", "侦探", "惊悚", "破案", "犯罪"]],
    ["言情", ["言情", "爱情", "恋爱", "虐恋", "甜宠", "感情"]],
    ["历史", ["历史", "古代", "架空", "王朝", "穿越"]],
    ["军事", ["军事", "战争", "兵王", "特种"]],
    ["游戏", ["游戏", "电竞", "网游", "副本"]],
    ["灵异", ["灵异", "鬼怪", "恐怖", "僵尸"]],
  ];
  for (const [genre, kws] of pairs) {
    if (kws.some((k) => summary.includes(k))) return genre;
  }
  return "";
}

/**
 * 基于参考小说分析结果，把风格/世界观/大纲/小说信息回填到目标小说管理。
 * 在参考小说分析确认后调用（不需要再次调 AI，直接用 analysis 结果）。
 */
async function fillMetaFromReference(projectId: string) {
  const analysis = refStore.analysis;
  const refTitle = refStore.referenceNovel?.title || "";
  if (!analysis || !projectId) return;

  try {
    const projectMeta = projectStore.projects.find((p) => p.id === projectId);
    const baseName = projectMeta?.name || refTitle || "未命名小说";
    // 题材：优先分析结果，其次从风格摘要推断
    const genre = analysis.genre || inferGenreFromSummary(analysis.style_summary || "");

    // 1. 回填小说信息（题材 + 风格摘要 → 简介）
    await projectStore.updateProjectInfo(projectId, {
      name: baseName,
      genre,
      description: analysis.style_summary || "",
    });

    // 2. 回填世界观（内容 = 风格摘要 + 叙事视角 + 节奏 + 对话风格）
    const worldContent = [
      `风格：${analysis.style_summary}`,
      `叙事视角：${analysis.narrative_perspective}`,
      `节奏：${analysis.pace_description}`,
      `对话风格：${analysis.dialogue_style}`,
      `写作特点：${analysis.writing_features.join("、")}`,
    ].filter(Boolean).join("\n");
    await invoke("save_world", {
      projectId,
      worldSetting: {
        content: worldContent,
        factions: [],
        rules: [],
        geography: "",
      },
    });

    // 3. 回填大纲（卷 = 情节结构概述；章节 = 已有章节）
    const oStore = useOutlineStore();
    oStore.loadOutline(projectId);
    oStore.initOutline(baseName);
    // 清空默认卷，填一个「第一卷」承载情节结构
    oStore.outline!.children = [];
    oStore.addVolume("第一卷");
    const vol = oStore.outline!.children[0];
    vol.description = analysis.plot_structure || "（由参考小说分析生成）";
    // 把已有章节挂到第一卷
    for (const ch of projectStore.chapters) {
      oStore.addChapter(vol.id, ch.title);
      const chNode = vol.children[vol.children.length - 1];
      chNode.description = "";
    }
    // 若没有章节，补一个占位章节展示结构
    if (vol.children.length === 0) {
      oStore.addChapter(vol.id, "第一章（待创作）");
    }
    oStore.saveOutline(projectId);

    // 4. 回填角色管理（分析出的主要角色 → 角色管理）
    await saveCharacters(projectId, analysis.main_characters);

    // 5. 自动匹配题材模板（根据题材 + 风格摘要关键词，选中合适的风格模板）
    const tStore = useTemplateStore();
    const tid = matchGenreTemplate(genre, analysis.style_summary || "");
    if (tid) tStore.setTemplate(tid);

    await projectStore.openProject(projectId);
    ElMessage.success(`已将参考小说分析回填到「${baseName}」小说管理（信息/世界观/大纲/角色/题材模板）`);
  } catch (e) {
    console.error("基于参考分析回填失败:", e);
    ElMessage.error("回填小说管理失败: " + e);
  }
}

/** 从 AI 回复提取章节标题候选 */
function extractChapterTitle(content: string): string {
  const m =
    content.match(/^#{1,6}\s*(.+)$/m) || // Markdown 一级标题
    content.match(/^(第[\d一二三四五六七八九十百千]+章[^\n]{0,30})$/m) || // 第X章 xxx
    content.match(/^(第[\d一二三四五六七八九十百千]+节[^\n]{0,30})$/m); // 第X节 xxx
  return m ? m[1].trim() : "";
}

/**
 * 未识别到章节标题时，根据正文首句智能生成标题：
 * - 提取首句关键内容（去掉引号/对话/冗长修饰）
 * - 取前 12~18 字，保证完整、有吸引力
 */
function smartTitleFromContent(content: string): string {
  const text = content
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/[#*`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // 去掉引号对话
  const firstLine = text.split(/[。！？!?]/)[0]?.trim() || text;
  // 去掉开头的人名冒号（对话体）
  const cleaned = firstLine.replace(/^[「『“"“]/, "").trim();
  if (!cleaned) return "";

  // 取 12-18 字
  const limit = cleaned.length <= 12 ? cleaned.length : Math.min(18, cleaned.length);
  let title = cleaned.slice(0, limit);
  // 若截断了，尝试在最后补"…"或保持完整词
  if (title.length < cleaned.length && title.length >= 12) {
    title = `${title}…`;
  }
  return title;
}

function handleClear() {
  aiStore.clearMessages();
  skillStore.reset();
}

function handleImportConfirm() {
  // 导入确认后：把参考小说分析结果回填到目标小说管理
  if (refStore.hasAnalysis && outputProjectId.value) {
    fillMetaFromReference(outputProjectId.value);
  }
  // 导入确认后自动进行对话
  if (refStore.hasAnalysis) {
    const novelTitle = refStore.referenceNovel?.title || "参考小说";
    inputText.value = `我已导入参考小说「${novelTitle}」，AI 分析已完成。请根据分析结果协助我创作。`;
    handleSend();
  }
}

async function sendSuggestion(text: string) {
  inputText.value = text;
  await handleSend();
}

// ===== @提及技能 =====
// 输入内容变化时检测 @ 触发浮层
function handleInput(evt: Event) {
  // 取光标前的文本，找到最后一个 @ 作为触发点
  const el = evt.target as HTMLTextAreaElement | null;
  const text = inputText.value;
  const caret = el?.selectionStart ?? text.length;
  const before = text.slice(0, caret);
  const atIdx = before.lastIndexOf("@");
  // 要求 @ 前面是开头或非字母数字（避免邮箱 / 连续 @@ 误触发，中文、标点、空白均可触发）
  if (atIdx >= 0 && (atIdx === 0 || !/[a-zA-Z0-9]/.test(before[atIdx - 1]))) {
    const kw = before.slice(atIdx + 1);
    // @ 后面紧跟非空内容（没有空格/换行）才视为关键字
    if (!/[\s\n]/.test(kw)) {
      mentionKeyword.value = kw;
      mentionIndex.value = 0;
      // 缓存光标位置，浮层打开后 textarea 可能失焦，selectionStart 会失效
      mentionCaret.value = caret;
      mentionAtIdx.value = atIdx;
      mentionVisible.value = true;
      return;
    }
  }
  mentionVisible.value = false;
}

// 选中某个技能：清掉 @ 及关键字（技能名已显示在输入框上方状态条），并加入当前激活技能（可多选，再次选择取消）
function selectMention(skill: any) {
  const text = inputText.value;
  const caret = mentionCaret.value;
  const atIdx = mentionAtIdx.value;
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  // 只移除 @ 及关键字，不把技能名写进输入框
  const prefix = atIdx >= 0 ? before.slice(0, atIdx) : before;
  inputText.value = `${prefix}${after}`;
  closeMention();
  // 加入当前激活技能列表（追加/切换）
  skillStore.selectSkill(skill.id);
  const isActive = skillStore.activeSkillIds.includes(skill.id);
  ElMessage.success(isActive ? `已启用技能「${skill.name}」` : `已取消技能「${skill.name}」`);
  // 聚焦回输入框并把光标放在原来 @ 的位置
  nextTick(() => {
    const ta = document.querySelector(".chat-input-area textarea") as HTMLTextAreaElement | null;
    const pos = prefix.length;
    ta?.focus();
    ta?.setSelectionRange(pos, pos);
  });
}

// 关闭 @提及浮层
function closeMention() {
  mentionVisible.value = false;
  mentionKeyword.value = "";
}

function handleKeydown(event: KeyboardEvent) {
  // @提及浮层打开时：方向键选择 + Enter 确认 + Esc 关闭
  if (mentionVisible.value) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      mentionIndex.value =
        (mentionIndex.value - 1 + mentionSkills.value.length) %
        Math.max(mentionSkills.value.length, 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      mentionIndex.value = (mentionIndex.value + 1) % Math.max(mentionSkills.value.length, 1);
      return;
    }
    if (event.key === "Enter" && !event.isComposing) {
      const skill = mentionSkills.value[mentionIndex.value];
      if (skill) {
        event.preventDefault();
        selectMention(skill);
        return;
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMention();
      return;
    }
  }
  // Ctrl+Enter / Cmd+Enter 发送
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    handleSend();
  }
}

async function scrollToBottom() {
  await nextTick();
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight;
  }
}

// 点击输入区外部关闭 @提及浮层
function onDocClick(e: MouseEvent) {
  if (!mentionVisible.value) return;
  const target = e.target as HTMLElement | null;
  if (target?.closest(".chat-input-area")) return;
  closeMention();
}
onMounted(() => document.addEventListener("mousedown", onDocClick));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocClick));

// 挂载时从本地文件（app_data_dir/reference）恢复最近的分析数据（刷新/重启后保留参考小说与 skill）
onMounted(() => {
  refStore.initFromStorage();
});
</script>

<style scoped>
.ai-chat-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  /* Windows/Linux 用：WebKit 专属拖拽（macOS 走 data-tauri-drag-region="deep"） */
  -webkit-app-region: drag;
}

/* 头部按钮不被拖拽拦截 */
.panel-header .el-button {
  -webkit-app-region: no-drag;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}

.panel-actions {
  display: flex;
  gap: 4px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-hint {
  text-align: center;
  padding: 48px 20px;
  color: var(--text-2);
}

.hint-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 24px;
  background: var(--accent-soft);
  color: var(--accent);
}

.chat-hint p {
  font-size: 14px;
  margin-bottom: 4px;
  color: var(--text-1);
}

.hint-sub {
  font-size: 12px !important;
  color: var(--text-3);
  line-height: 1.6;
  margin-top: 8px !important;
}

/* 默认助手界面「当前技能」：品牌紫小胶囊 + 图标文字一行垂直居中 */
.hint-skill-title {
  color: var(--text-3);
  margin-right: 4px;
}
.hint-skill-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px 2px 8px;
  margin: 2px 4px 2px 0;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  line-height: 1.4;
}
.hint-skill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.hint-skill-name {
  white-space: nowrap;
  font-weight: 500;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-top: 16px;
}

.suggestion-tag {
  cursor: pointer;
}

.message-item {
  display: flex;
  gap: 8px;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.message-item.user .message-avatar {
  background: var(--grad-brand);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.35);
  color: #fff;
}

.message-item.assistant .message-avatar {
  background: linear-gradient(135deg, #34d399, #10b981);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  color: #fff;
}

.message-content {
  max-width: 80%;
}

.message-text {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  box-shadow: var(--shadow-sm);
}

.message-item.user .message-text {
  background: var(--grad-brand);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.message-item.assistant .message-text {
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  color: var(--text-1);
  border-bottom-left-radius: 4px;
  box-shadow: none;
}

.message-actions {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}
/* 对话操作按钮 hover：实色品牌紫底 + 白字，避免浅紫底紫字对比度不足、文字与背景融合 */
.message-actions :deep(.el-button:hover),
.message-actions :deep(.el-button:focus) {
  background: var(--accent) !important;
  color: #fff !important;
}
.message-actions :deep(.el-button:hover .el-icon),
.message-actions :deep(.el-button:focus .el-icon) {
  color: #fff !important;
}

.thinking-dots {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  border-bottom-left-radius: 3px;
}

.dot {
  width: 8px;
  height: 8px;
  background: var(--text-3);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
}

.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }
.dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* 分批续写实时进度 */
.multi-progress {
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  min-width: 220px;
}
.mp-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.mp-bar-inner {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.mp-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
}
.mp-done {
  color: var(--success, #67c23a);
}
.mp-current {
  color: var(--text-2);
}
.mp-count {
  color: var(--accent);
  font-weight: 600;
  margin-top: 2px;
}

.chat-input-area {
  position: relative;
  margin: 10px 12px 12px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
}

/* ===== @提及技能浮层 ===== */
.mention-popover {
  position: absolute;
  bottom: calc(100% - 8px);
  left: 16px;
  right: 16px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--panel-bg, #fff);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 30;
  padding: 4px;
}
.mention-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary, #909399);
  padding: 6px 8px 4px;
}
.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary, #303133);
}
.mention-item:hover {
  background: var(--hover-bg, #f5f7fa);
}
.mention-item.active {
  background: var(--primary-color, #409eff);
  color: #fff;
}
.mention-icon {
  display: inline-flex;
  width: 20px;
  justify-content: center;
  flex-shrink: 0;
}
.mention-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mention-source {
  flex-shrink: 0;
}
.mention-empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-secondary, #909399);
}

.chat-input-area :deep(.el-textarea__inner) {
  font-size: 13px;
}

.input-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.model-info {
  font-size: 12px;
}

.skill-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.skill-status-label {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}

.skill-status-tag {
  max-width: 100%;
}

.skill-status-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  vertical-align: middle;
}

.skill-status-icon {
  flex-shrink: 0;
  display: inline-flex;
}

.skill-status-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 输出目标小说选择条 ===== */
.output-target {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--accent-soft);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.ot-icon {
  color: var(--accent);
  flex-shrink: 0;
}

.ot-label {
  color: var(--text-2);
  flex-shrink: 0;
}

.ot-select {
  flex: 1;
  min-width: 0;
}

.ot-select :deep(.el-select__wrapper) {
  min-height: 24px;
  padding: 0 8px;
}

.ot-chapter {
  flex: 1.4;
}

.ot-new-option .el-icon {
  margin-right: 4px;
  vertical-align: -1px;
}

.ot-chapter-opt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ot-chapter-opt .el-icon {
  color: var(--text-3);
}

/* ===== 目标字数 ===== */
.ot-wordcount {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ot-wordcount-icon {
  color: var(--text-3);
  font-size: 13px;
}

.ot-wordcount-input {
  width: 72px;
}

.ot-wordcount-input :deep(.el-input__inner) {
  min-height: 24px;
  height: 24px;
  font-size: 12px;
  text-align: center;
  padding: 0 4px;
}

.ot-wordcount-input :deep(.el-input__wrapper) {
  min-height: 24px;
  box-shadow: 0 0 0 1px var(--border) inset;
}

.ot-wordcount-unit {
  font-size: 11px;
  color: var(--text-3);
}

.ot-new {
  flex-shrink: 0;
}

.ot-auto-tag {
  flex-shrink: 0;
}

/* ===== 参考小说状态栏 ===== */
.ref-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: var(--orange-soft);
  border-bottom: 1px solid rgba(232, 162, 58, 0.25);
  font-size: 12px;
}

.ref-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.ref-title {
  font-weight: 500;
  color: var(--orange);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ref-count {
  color: var(--text-3);
  font-size: 11px;
}

.ref-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
</style>

<!-- 人设校验（OOC）弹窗：独立非 scoped 样式，穿透 teleport 渲染的 el-dialog -->
<style>
.ooc-dialog .el-dialog {
  border-radius: 14px;
  overflow: hidden;
}
.ooc-dialog .el-dialog__header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--orange-soft) 0%, transparent 100%);
  margin-right: 0;
}
.ooc-dialog .el-dialog__title {
  font-size: 16px;
}
.ooc-dialog .dlg-title .el-icon {
  color: var(--orange);
}

.ooc-dialog .ooc-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 4px;
}

/* 摘要 Alert 圆角 + 柔和阴影 */
.ooc-dialog .el-alert {
  border-radius: 10px;
  border: 1px solid rgba(217, 137, 15, 0.25);
  padding: 12px 14px;
}
.ooc-dialog .el-alert--warning {
  background: var(--orange-soft);
}
.ooc-dialog .el-alert__title {
  font-weight: 600;
  color: var(--orange);
  font-size: 14px;
}
.ooc-dialog .el-alert__description {
  margin-top: 6px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
}
.ooc-dialog .el-alert__icon {
  color: var(--orange);
  font-size: 20px;
}

/* 详情卡片 */
.ooc-dialog .ooc-detail {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg-2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

/* 卡片头部：徽章 + 标题 */
.ooc-dialog .ooc-detail-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--panel-bg) 0%, var(--panel-bg-2) 100%);
  flex-shrink: 0;
}

.ooc-dialog .ooc-detail-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--orange-soft);
  color: var(--orange);
  flex-shrink: 0;
}
.ooc-dialog .ooc-detail-badge .el-icon {
  font-size: 17px;
}

.ooc-dialog .ooc-detail-title {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ooc-dialog .ooc-detail-title-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.ooc-dialog .ooc-detail-sub {
  font-size: 11px;
  color: var(--text-3);
}

/* 详情正文（Markdown 渲染） */
.ooc-dialog .ooc-rendered {
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-2);
  word-break: break-word;
  overflow-wrap: break-word;
  max-height: 320px;
  overflow-y: auto;
  flex: 1;
}
.ooc-dialog .ooc-rendered h1,
.ooc-dialog .ooc-rendered h2,
.ooc-dialog .ooc-rendered h3,
.ooc-dialog .ooc-rendered h4,
.ooc-dialog .ooc-rendered h5,
.ooc-dialog .ooc-rendered h6 {
  color: var(--text-1);
  margin: 12px 0 6px;
  line-height: 1.4;
  font-weight: 600;
}
.ooc-dialog .ooc-rendered h1 {
  font-size: 15px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--border);
}
.ooc-dialog .ooc-rendered h2 {
  font-size: 14px;
}
.ooc-dialog .ooc-rendered h3 {
  font-size: 13px;
}
.ooc-dialog .ooc-rendered p {
  margin: 6px 0;
}
.ooc-dialog .ooc-rendered ul,
.ooc-dialog .ooc-rendered ol {
  margin: 6px 0;
  padding-left: 22px;
}
.ooc-dialog .ooc-rendered li {
  margin: 3px 0;
}
.ooc-dialog .ooc-rendered blockquote {
  margin: 8px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--orange);
  background: var(--orange-soft);
  border-radius: 4px;
}
.ooc-dialog .ooc-rendered strong {
  color: var(--orange);
  font-weight: 600;
}
.ooc-dialog .ooc-rendered code {
  background: var(--accent-soft);
  padding: 1px 5px;
  border-radius: 4px;
  font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
  font-size: 12px;
}
.ooc-dialog .ooc-rendered pre {
  background: var(--panel-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  margin: 8px 0;
}
.ooc-dialog .ooc-rendered pre code {
  background: transparent;
  padding: 0;
}
.ooc-dialog .ooc-rendered hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}
.ooc-dialog .ooc-rendered table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}
.ooc-dialog .ooc-rendered th,
.ooc-dialog .ooc-rendered td {
  border: 1px solid var(--border);
  padding: 5px 8px;
  text-align: left;
  font-size: 12.5px;
}
.ooc-dialog .ooc-rendered th {
  background: var(--panel-bg);
  font-weight: 600;
}
.ooc-dialog .ooc-rendered::-webkit-scrollbar {
  width: 8px;
}
.ooc-dialog .ooc-rendered::-webkit-scrollbar-thumb {
  background: var(--border-strong, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
}
.ooc-dialog .ooc-rendered::-webkit-scrollbar-track {
  background: transparent;
}
</style>
