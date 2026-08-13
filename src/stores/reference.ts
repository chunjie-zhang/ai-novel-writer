import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type {
  ReferenceNovel,
  ReferenceChapter,
  NovelAnalysis,
  WritingMode,
} from "@/types";
import { WRITING_MODES } from "@/types";
import { useAIStore } from "./ai";
import { extractJsonContent } from "@/utils/ai";

interface RawImportedNovel {
  id: string;
  file_name: string;
  title: string;
  total_words: number;
  total_chapters: number;
  imported_at: string;
  chapters: {
    index: number;
    title: string;
    content: string;
    word_count: number;
  }[];
}

export const useReferenceStore = defineStore("reference", () => {
  // ===== 状态（初始为空，initFromStorage 从本地文件异步恢复） =====
  const referenceNovel = ref<ReferenceNovel | null>(null);
  const chapters = ref<ReferenceChapter[]>([]);
  const analysis = ref<NovelAnalysis | null>(null);
  const writingMode = ref<WritingMode | null>(null);
  const selectedChapters = ref<number[]>([]);
  const isLoading = ref(false);
  const isAnalyzing = ref(false);

  // ===== 本地文件自动持久化（Rust 写 app_data_dir/reference/{id}.json；防抖避免频繁写入） =====
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  watch(
    [referenceNovel, chapters, analysis, writingMode, selectedChapters],
    () => {
      const novel = referenceNovel.value;
      if (!novel) return; // 无参考小说不保存
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        invoke("save_reference_state", {
          id: novel.id,
          data: {
            id: novel.id,
            title: novel.title,
            referenceNovel: novel,
            chapters: chapters.value,
            analysis: analysis.value,
            writingMode: writingMode.value,
            selectedChapters: selectedChapters.value,
            savedAt: Date.now(),
          },
        }).catch((e) => console.error("保存参考小说失败:", e));
      }, 400);
    },
    { deep: true }
  );

  /** 从本地文件恢复最近保存的参考小说（刷新/重启后调用） */
  async function initFromStorage() {
    try {
      const records = await invoke<any[]>("load_reference_states");
      if (!Array.isArray(records) || records.length === 0) return;
      const latest = records[0]; // 已按 savedAt 倒序
      referenceNovel.value = latest.referenceNovel || null;
      chapters.value = latest.chapters || [];
      analysis.value = latest.analysis || null;
      writingMode.value = latest.writingMode || null;
      selectedChapters.value = latest.selectedChapters || [];
    } catch (e) {
      console.error("恢复参考小说失败:", e);
    }
  }

  // ===== 计算属性 =====
  const hasReference = computed(() => referenceNovel.value !== null);
  const hasAnalysis = computed(() => analysis.value !== null);
  const currentMode = computed(() =>
    writingMode.value ? WRITING_MODES[writingMode.value] : null
  );

  /** 用于 system prompt 的小说上下文摘要（含原著大纲与剧情节选，供续写对齐） */
  const referenceContext = computed(() => {
    if (!referenceNovel.value) return "";
    let ctx = `【参考小说：${referenceNovel.value.title}】\n`;
    ctx += `总字数：${referenceNovel.value.total_words}字，共${referenceNovel.value.total_chapters}章\n`;

    // 原著章节大纲（标题序列 → 剧情走向，供大纲对齐）
    if (chapters.value.length > 0) {
      ctx += `\n原著章节大纲（按章节顺序，这是剧情的推进走向，续写/仿写必须与此对齐）：\n`;
      chapters.value.slice(0, 40).forEach((c, i) => {
        ctx += `${i + 1}. ${c.title}\n`;
      });
      if (chapters.value.length > 40) {
        ctx += `...（共${chapters.value.length}章，后续章节略）\n`;
      }
    }

    // 开头几章内容节选（文风 + 剧情参照）
    if (chapters.value.length > 0) {
      ctx += `\n原著开头节选（用于对齐文风、人物与剧情）：\n`;
      for (const c of chapters.value.slice(0, 2)) {
        ctx += `【${c.title}】\n${c.content.slice(0, 800)}\n`;
      }
    }

    // 结尾章节节选（续写衔接点：剧情进展到哪，就从哪续写）
    if (chapters.value.length > 2) {
      const last = chapters.value[chapters.value.length - 1];
      ctx += `\n原著结尾节选（当前剧情进展到此处，续写需从这里自然衔接）：\n`;
      ctx += `【${last.title}】\n${last.content.slice(0, 800)}\n`;
    }

    if (analysis.value) {
      ctx += `\n风格摘要：${analysis.value.style_summary}\n`;
      ctx += `写作特点：${analysis.value.writing_features.join("、")}\n`;
      ctx += `叙事视角：${analysis.value.narrative_perspective}\n`;

      if (analysis.value.main_characters.length > 0) {
        ctx += `\n主要角色：\n`;
        for (const c of analysis.value.main_characters) {
          ctx += `- ${c.name}（${c.role}）：${c.traits}\n`;
        }
      }
    }

    // 防抄袭约束：节选仅供理解剧情与风格，禁止沿用专有名词或复制原句
    ctx += `\n【重要约束】以上原著大纲与节选仅供理解剧情脉络、叙事节奏与文风参考。仿写续写时：\n`;
    ctx += `1. 原著中所有专有名词（人物名、地名、国家、势力、组织、境界、功法、法宝、称号等）一律换成全新名字，不得沿用任何一个；\n`;
    ctx += `2. 严禁复制或改写原著原文的任何句子、短语、描写，全部用全新语言表达，只保留情节脉络与叙事结构。`;

    return ctx;
  });

  // ===== 方法 =====

  /** 导入小说文件 */
  async function importFile(filePath: string) {
    isLoading.value = true;
    try {
      const result = await invoke<RawImportedNovel>("import_novel_file", {
        filePath,
      });

      referenceNovel.value = {
        id: result.id,
        file_name: result.file_name,
        title: result.title,
        total_words: result.total_words,
        total_chapters: result.total_chapters,
        imported_at: result.imported_at,
        source_path: filePath,
      };

      chapters.value = result.chapters.map((ch) => ({
        index: ch.index,
        title: ch.title,
        content: ch.content,
        word_count: ch.word_count,
      }));

      // 默认选择前 3 章作为分析样本
      selectedChapters.value = chapters.value.slice(0, 3).map((c) => c.index);
      analysis.value = null;
      writingMode.value = null;
    } finally {
      isLoading.value = false;
    }
  }

  /** AI 分析小说（失败自动重试，最多 3 次） */
  async function analyzeNovel() {
    if (!chapters.value.length) return;

    isAnalyzing.value = true;
    try {
      const sampleChapters = selectedChapters.value.length > 0
        ? chapters.value.filter((c) => selectedChapters.value.includes(c.index))
        : chapters.value.slice(0, 3);

      const sampleContent = sampleChapters
        .map((c) => `【${c.title}】\n${c.content.slice(0, 2000)}`)
        .join("\n\n");

      const aiStore = useAIStore();

      const systemMsg = {
        role: "system" as const,
        content: `你是一名专业的小说分析专家。请分析以下小说章节内容，输出 JSON 格式的分析结果。

严格按照以下 JSON 结构返回，不要加任何额外说明，不要使用 Markdown 代码块包裹，直接输出 JSON：
{
  "genre": "题材（如：都市异能/玄幻/仙侠/科幻/悬疑/都市/历史）",
  "style_summary": "整体风格描述，30-50字",
  "writing_features": ["特点1", "特点2", "特点3", "特点4"],
  "narrative_perspective": "叙事视角分析",
  "pace_description": "节奏特点描述",
  "dialogue_style": "对话风格描述",
  "main_characters": [
    {"name": "角色名", "role": "在故事中的角色", "traits": "性格特征"}
  ],
  "plot_structure": "情节结构分析",
  "imitable_aspects": ["适合仿写的维度1", "维度2", "维度3"]
}`,
      };

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
              systemMsg,
              { role: "user", content: sampleContent },
            ],
            temperature: 0.3,
            maxTokens: 8192,
          });
          // 健壮提取 JSON（兼容代码块包裹/前后说明文字）
          result = extractJsonContent(response.content);
          break;
        } catch (e) {
          lastError = e;
          console.warn(`分析第 ${attempt} 次失败:`, e);
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 800 * attempt)); // 逐次加长等待
          }
        }
      }
      if (!result) throw lastError || new Error("分析多次失败");

      analysis.value = {
        genre: result.genre || "",
        style_summary: result.style_summary || "",
        writing_features: result.writing_features || [],
        narrative_perspective: result.narrative_perspective || "",
        pace_description: result.pace_description || "",
        dialogue_style: result.dialogue_style || "",
        main_characters: result.main_characters || [],
        plot_structure: result.plot_structure || "",
        imitable_aspects: result.imitable_aspects || [],
      };
    } catch (e) {
      console.error("分析失败:", e);
      // 使用兜底分析
      analysis.value = {
        genre: "",
        style_summary: "分析失败，请重试",
        writing_features: [],
        narrative_perspective: "",
        pace_description: "",
        dialogue_style: "",
        main_characters: [],
        plot_structure: "",
        imitable_aspects: [],
      };
    } finally {
      isAnalyzing.value = false;
    }
  }

  /** 设置写作模式 */
  function setWritingMode(mode: WritingMode | null) {
    writingMode.value = mode;
  }

  /** 获取当前模式的 system prompt */
  function getModeSystemPrompt(): string {
    if (!writingMode.value || !analysis.value) {
      return "你是一位专业的小说创作助手。";
    }

    const mode = writingMode.value;
    const ctx = referenceContext.value;

    const modePrompts: Record<WritingMode, string> = {
      imitate: `你是一位擅长模仿文风的小说作家。请严格模仿参考小说的文风、叙事节奏和语言特点进行创作。

参考小说分析：
${ctx}

要求：
1. 严格模仿原文的句式长度、用词习惯和修辞手法
2. 保持与原文一致的叙事节奏（详略安排、段落长短）
3. 模仿原文的人物对话风格
4. 延续原文的氛围营造方式
5. 直接输出创作内容，不要加任何说明`,

      reference: `你是一位擅长借鉴优秀作品的小说作家。请参考小说的剧情结构和情节设计，创作出具有原创性的新内容。

参考小说分析：
${ctx}

要求：
1. 可以借鉴剧情结构（如起承转合的方式），但不能照搬具体情节
2. 可以借鉴人物关系的设定逻辑，但角色要全新
3. 可以借鉴悬念设置的手法，但故事走向要不同
4. 保持你自己的创作风格，不要完全照抄
5. 直接输出创作内容`,

      "continue-ref": `你是一位续写师。请严格延续参考小说的风格和内容进行续写。

参考小说分析：
${ctx}

要求：
1. 保持角色性格和关系的一致性
2. 延续原有的剧情逻辑和发展方向
3. 保持文风和叙事节奏不变
4. 注意与前文的情节衔接
5. 直接输出续写内容`,

      analyze: `你是一位专业的小说分析专家。请基于对参考小说的分析，回答用户的问题。

参考小说分析：
${ctx}

你可以分析：
- 小说的文风和写作技巧
- 人物塑造的方法
- 情节结构的安排
- 可以借鉴的创作手法
- 与其他作品的比较分析`,
    };

    return modePrompts[mode] || modePrompts.analyze;
  }

  /** 清除参考小说（同时删除本地文件中该小说的数据，避免残留） */
  function clear() {
    const id = referenceNovel.value?.id;
    referenceNovel.value = null;
    chapters.value = [];
    analysis.value = null;
    writingMode.value = null;
    selectedChapters.value = [];
    if (id) {
      invoke("delete_reference_state", { id }).catch((e) =>
        console.error("删除参考小说失败:", e)
      );
    }
  }

  return {
    referenceNovel,
    chapters,
    analysis,
    writingMode,
    selectedChapters,
    isLoading,
    isAnalyzing,
    hasReference,
    hasAnalysis,
    currentMode,
    referenceContext,
    importFile,
    analyzeNovel,
    initFromStorage,
    setWritingMode,
    getModeSystemPrompt,
    clear,
  };
});
