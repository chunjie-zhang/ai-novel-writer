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
        <el-tooltip content="写作技能" placement="bottom">
          <el-button
            text
            size="small"
            :type="showSkills ? 'primary' : ''"
            @click="showSkills = !showSkills"
          >
            <el-icon><Icon icon="lucide:sparkles" /></el-icon>
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

    <!-- 技能选择面板（折叠式） -->
    <div v-if="showSkills" class="skills-panel">
      <div class="skills-panel-header">
        <span class="skills-panel-title">
          {{ skillStore.activeSkill ? '当前技能' : '选择写作技能' }}
        </span>
        <el-button
          v-if="skillStore.activeSkill"
          text
          size="small"
          type="warning"
          @click="skillStore.selectSkill(null)"
        >
          取消
        </el-button>
      </div>

      <!-- 已选技能提示 -->
      <div v-if="skillStore.activeSkill" class="active-skill-banner">
        <span class="as-emoji">
          <Icon v-if="activeSkillIcon" :icon="activeSkillIcon" :width="20" :height="20" />
          <span v-else>{{ skillStore.activeSkill.emoji }}</span>
        </span>
        <div class="as-info">
          <span class="as-name">{{ skillStore.activeSkill.name }}</span>
          <span class="as-desc">{{ skillStore.activeSkill.description }}</span>
        </div>
        <el-tag size="small" type="success" effect="dark">已启用</el-tag>
      </div>

      <SkillSelector />
    </div>

    <!-- 对话消息列表 -->
    <div class="chat-messages" ref="messagesRef">
      <div v-if="aiStore.messages.length === 0" class="chat-hint">
        <div class="hint-icon"><Icon icon="lucide:bot" :width="44" :height="44" /></div>
        <p>AI 创作助手</p>
        <p class="hint-sub">
          <template v-if="skillStore.activeSkill">
            当前技能：<Icon v-if="activeSkillIcon" :icon="activeSkillIcon" :width="14" :height="14" style="vertical-align:-2px" /> {{ skillStore.activeSkill.name }}
          </template>
          <template v-else>
            选择技能或直接输入需求<br />
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
          <div v-if="msg.role === 'assistant'" class="message-actions">
            <el-button size="small" text type="primary" @click="saveAsChapter(msg)">
              <el-icon><Icon icon="lucide:file-plus-2" /></el-icon>
              保存为章节
            </el-button>
            <el-button size="small" text type="primary" @click="saveAsCharacter(msg)">
              <el-icon><Icon icon="lucide:user-plus" /></el-icon>
              保存为角色
            </el-button>
          </div>
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

      <!-- 技能状态条 -->
      <div v-if="skillStore.activeSkill" class="skill-status">
        <el-tag size="small" type="success" effect="light" closable @close="skillStore.selectSkill(null)">
          <Icon v-if="activeSkillIcon" :icon="activeSkillIcon" :width="14" :height="14" style="vertical-align:-2px" /> {{ skillStore.activeSkill.name }}
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
          :loading="aiStore.isGenerating"
          :disabled="!inputText.trim()"
          @click="handleSend"
        >
          发送
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
          <pre>{{ showOOCResult }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="showOOCDialog = false">忽略</el-button>
        <el-button type="primary" @click="showOOCDialog = false">知道了</el-button>
      </template>
    </el-dialog>

    <!-- 保存为章节对话框（支持分组） -->
    <el-dialog v-model="showChapterDialog" title="保存为章节" width="440px" :close-on-click-modal="false">
      <el-form label-width="60px" size="default">
        <el-form-item label="标题" required>
          <el-input v-model="chapterForm.title" placeholder="章节标题" />
        </el-form-item>
        <el-form-item label="分组">
          <el-select
            v-model="chapterForm.group"
            allow-create
            filterable
            clearable
            placeholder="选择或输入分组（如：第一卷），留空放根目录"
            style="width: 100%"
          >
            <el-option v-for="g in existingGroups" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChapterDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmSaveChapter">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, watch, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { invoke } from "@tauri-apps/api/core";
import type { Character } from "@/types";
import { useAIStore } from "@/stores/ai";
import { useSkillStore } from "@/skills/store";
import { useReferenceStore } from "@/stores/reference";
import { useWritingStore } from "@/stores/writing";
import SkillSelector from "@/components/ai/SkillSelector.vue";
import NovelImportDialog from "@/components/novel/NovelImportDialog.vue";
import { useProjectStore } from "@/stores/project";
import { useEditorStore } from "@/stores/editor";
import { buildSmartContext } from "@/utils/nlp";
import { normalizeChapterTitle } from "@/utils/chapterTitle";

const aiStore = useAIStore();
const skillStore = useSkillStore();
// 当前技能图标（lucide 图标，缺省回退 emoji）
const activeSkillIcon = computed(() => skillStore.activeSkill?.icon || null);
const refStore = useReferenceStore();
const writingStore = useWritingStore();
const projectStore = useProjectStore();
const editorStore = useEditorStore();

const inputText = ref("");
const showSkills = ref(false);
const showImport = ref(false);
const showOOCDialog = ref(false);
const showOOCResult = ref("");
const oocSummary = ref("");
const messagesRef = ref<HTMLElement | null>(null);

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

// 当选中技能时折叠面板
watch(() => skillStore.activeSkillId, () => {
  if (skillStore.activeSkill) {
    showSkills.value = false;
  }
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
  closeMention();
  const text = inputText.value;
  inputText.value = "";

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
      world_setting?.content || ""
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
  } else if (skillStore.activeSkill) {
    systemPrompt = skillStore.activeSkill.systemPrompt;
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

  aiStore.systemPrompt = systemPrompt;

  await aiStore.sendMessage(text);

  // ===== 人设校验（AI 生成后自动检测 OOC） =====
  if (writingStore.characterProfiles) {
    const lastAssistantMsg = [...aiStore.messages].reverse().find(m => m.role === "assistant");
    if (lastAssistantMsg) {
      try {
        const oocResult = await aiStore.sendMessage(
          writingStore.buildOOCPrompt(lastAssistantMsg.content.slice(0, 3000))
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

// ===== 保存为章节对话框（支持分组） =====
const showChapterDialog = ref(false);
const pendingChapterMsg = ref<any>(null);
const chapterForm = reactive({ title: "", group: "" });
// 当前项目已有的分组（供下拉选择）
const existingGroups = computed(() => {
  const set = new Set<string>();
  for (const c of projectStore.chapters) if (c.group) set.add(c.group);
  return Array.from(set);
});

/** 打开「保存为章节」对话框 */
async function saveAsChapter(msg: any) {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    ElMessage.warning("请先打开一本小说");
    return;
  }
  const content = (msg.content || "").trim();
  if (!content) {
    ElMessage.warning("回复内容为空，无法保存为章节");
    return;
  }
  pendingChapterMsg.value = msg;
  // 规范化标题：去掉 # / 分组路径 / .md，得到纯标题
  chapterForm.title = normalizeChapterTitle(extractChapterTitle(content));
  chapterForm.group = "";
  showChapterDialog.value = true;
}

/** 确认保存章节：写入磁盘 + 自动在编辑器打开刚保存的章节 */
async function confirmSaveChapter() {
  const projectId = projectStore.currentProject?.id;
  if (!projectId || !pendingChapterMsg.value) return;
  const raw = normalizeChapterTitle(chapterForm.title.trim());
  if (!raw) {
    ElMessage.warning("请输入章节标题");
    return;
  }
  const content = (pendingChapterMsg.value.content || "").trim();
  const group = chapterForm.group.trim();
  try {
    // 标题重名时自动加序号，避免覆盖已有章节
    const existing = new Set(projectStore.chapters.map((c) => c.title));
    let title = raw;
    let n = 2;
    while (existing.has(title)) {
      title = `${raw}_${n}`;
      n++;
    }

    // 写入磁盘，返回章节相对路径
    const filePath = await invoke<string>("save_chapter", {
      projectId,
      chapterTitle: title,
      group,
      content,
    });
    await projectStore.openProject(projectId);

    // 自动在中间编辑器打开刚保存的章节（立即看到文字）
    const chapter = projectStore.chapters.find((c) => c.file_name === filePath);
    if (chapter) {
      const c = await invoke<string>("read_chapter", {
        projectId,
        fileName: filePath,
      });
      editorStore.openChapterWithMemory(chapter, c, projectId);
    }

    showChapterDialog.value = false;
    pendingChapterMsg.value = null;
    ElMessage.success(`章节「${title}」已创建并写入${group ? `（${group}）` : ""}`);
  } catch (e) {
    ElMessage.error("保存章节失败: " + e);
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

/** 把 AI 回复保存为角色（写入角色管理） */
async function saveAsCharacter(msg: any) {
  const projectId = projectStore.currentProject?.id;
  if (!projectId) {
    ElMessage.warning("请先打开一本小说");
    return;
  }
  try {
    const char = parseCharacterFromText(msg.content || "");
    await invoke("save_character", { projectId, character: char });
    await projectStore.openProject(projectId);
    ElMessage.success(`角色「${char.name}」已保存到角色管理`);
  } catch (e) {
    ElMessage.error("保存角色失败: " + e);
  }
}

/** 从 AI 回复文本解析角色（优先 JSON，其次提取姓名，正文存备注） */
function parseCharacterFromText(text: string): Character {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const d = JSON.parse(jsonMatch[0]);
      const pick = (keys: string[], fallback = "") => {
        for (const k of keys) if (d[k]) return String(d[k]);
        return fallback;
      };
      return {
        id: `char_${Date.now()}`,
        name: pick(["name", "姓名"], "新角色"),
        gender: pick(["gender", "性别"], "未知"),
        age: pick(["age", "年龄"]),
        personality: pick(["personality", "性格"]),
        appearance: pick(["appearance", "外貌"]),
        background: pick(["background", "背景", "背景故事"]),
        relationships: pick(["relationships", "关系"]),
        speech_pattern: pick(["speech_pattern", "口头禅"]),
        notes: "",
      };
    } catch { /* 非 JSON，走下面兜底 */ }
  }
  // 非 JSON：尝试提取「姓名：XXX」/「角色名：XXX」或首行
  const nameMatch =
    text.match(/(?:姓名|角色名|角色)[：:]\s*([\u4e00-\u9fa5A-Za-z0-9·]{1,16})/) ||
    text.match(/^【?([\u4e00-\u9fa5A-Za-z0-9·]{1,16})】?[：:]/);
  const name = nameMatch ? nameMatch[1] : text.split("\n")[0].trim().slice(0, 16) || "新角色";
  return {
    id: `char_${Date.now()}`,
    name,
    gender: "未知",
    age: "",
    personality: "",
    appearance: "",
    background: "",
    relationships: "",
    speech_pattern: "",
    notes: text.slice(0, 1000),
  };
}

function handleClear() {
  aiStore.clearMessages();
  skillStore.reset();
}

function handleImportConfirm() {
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

// 选中某个技能：插入 @技能名 并替换当前激活技能
function selectMention(skill: any) {
  const text = inputText.value;
  const caret = mentionCaret.value;
  const atIdx = mentionAtIdx.value;
  const before = text.slice(0, caret);
  const after = text.slice(caret);
  // 用 @技能名 替换 @关键字
  const mention = `@${skill.name}`;
  const prefix = atIdx >= 0 ? before.slice(0, atIdx) : before;
  inputText.value = `${prefix}${mention}${after}`;
  closeMention();
  // 替换当前激活技能，让该技能生效
  skillStore.selectSkill(skill.id);
  ElMessage.success(`已应用技能「${skill.name}」`);
  // 聚焦回输入框并把光标放在 mention 之后
  nextTick(() => {
    const ta = document.querySelector(".chat-input-area textarea") as HTMLTextAreaElement | null;
    const pos = prefix.length + mention.length;
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
  background: var(--accent);
  color: #fff;
}

.message-item.assistant .message-avatar {
  background: var(--green);
  color: #fff;
}

.message-content {
  max-width: 80%;
}

.message-text {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-item.user .message-text {
  background: linear-gradient(135deg, var(--accent), #3a6fce);
  color: #fff;
  border-bottom-right-radius: 3px;
}

.message-item.assistant .message-text {
  background: var(--panel-bg-2);
  border: 1px solid var(--border);
  color: var(--text-1);
  border-bottom-left-radius: 3px;
}

.message-actions {
  margin-top: 4px;
  display: flex;
  gap: 8px;
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

.chat-input-area {
  position: relative;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--panel-bg-2);
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

/* ===== 技能面板样式 ===== */
.skills-panel {
  border-bottom: 1px solid var(--border);
  max-height: 480px;
  overflow-y: auto;
  padding: 8px 12px;
  background: var(--panel-bg-2);
}

.skills-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.skills-panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.active-skill-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--green-soft);
  border: 1px solid rgba(70, 208, 127, 0.3);
  border-radius: 8px;
  margin-bottom: 8px;
}

.as-emoji {
  font-size: 20px;
}

.as-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.as-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.as-desc {
  font-size: 11px;
  color: var(--text-2);
}

.skill-status {
  margin-bottom: 6px;
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

/* 详情正文 */
.ooc-dialog .ooc-detail pre {
  margin: 0;
  padding: 14px 16px;
  font-family: var(--font-mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace);
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  max-height: 320px;
  overflow-y: auto;
  flex: 1;
}

.ooc-dialog .ooc-detail pre::-webkit-scrollbar {
  width: 8px;
}
.ooc-dialog .ooc-detail pre::-webkit-scrollbar-thumb {
  background: var(--border-strong, rgba(128, 128, 128, 0.4));
  border-radius: 4px;
}
.ooc-dialog .ooc-detail pre::-webkit-scrollbar-track {
  background: transparent;
}
</style>
