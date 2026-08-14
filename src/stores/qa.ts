import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useAIStore } from "./ai";
import { extractKeywords, cosineSimilarity, jaccardSimilarity } from "@/utils/nlp";
import type { AIResponse } from "@/types";

/** 检索块 */
interface QABlock {
  chapterFileName: string;
  chapterTitle: string;
  text: string;
  keywords: string[];
}

/** 问答结果（含溯源） */
export interface QAResult {
  answer: string;
  sources: { chapterFileName: string; chapterTitle: string; snippet: string }[];
}

/** 按句子切块，每块约 targetLen 字 */
function chunkText(text: string, targetLen = 400): string[] {
  const sentences = text.split(/(?<=[。！？!?；;])/).filter((s) => s.trim());
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur.length + s.length > targetLen && cur.length > 0) {
      chunks.push(cur.trim());
      cur = "";
    }
    cur += s;
    // 防止单个超长句撑爆块
    if (cur.length >= targetLen * 2) {
      chunks.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

export const useQAStore = defineStore("qa", () => {
  const isIndexing = ref(false);
  const isAsking = ref(false);
  const blocks = ref<QABlock[]>([]);
  const indexedProjectId = ref<string | null>(null);
  const blockCount = ref(0);
  const chapterCount = ref(0);

  /** 为项目构建全文检索索引（章节切块 + 关键词） */
  async function buildIndex(projectId: string) {
    if (indexedProjectId.value === projectId && blocks.value.length > 0) return;
    isIndexing.value = true;
    try {
      const structure = await invoke<any>("get_project_structure", { projectId });
      const newBlocks: QABlock[] = [];
      let chapters = 0;
      for (const ch of structure.chapters || []) {
        chapters++;
        const content = await invoke<string>("read_chapter", {
          projectId,
          fileName: ch.file_name,
        });
        for (const c of chunkText(content)) {
          newBlocks.push({
            chapterFileName: ch.file_name,
            chapterTitle: ch.title,
            text: c,
            keywords: extractKeywords(c, 10).map((k) => k.word),
          });
        }
      }
      blocks.value = newBlocks;
      chapterCount.value = chapters;
      blockCount.value = newBlocks.length;
      indexedProjectId.value = projectId;
    } finally {
      isIndexing.value = false;
    }
  }

  /** 无效索引（章节新增/删除后调用） */
  function invalidate() {
    indexedProjectId.value = null;
    blocks.value = [];
  }

  /**
   * 自然语言问答：语义召回相关章节片段 → 拼接上下文 → AI 回答（带溯源）
   */
  async function ask(projectId: string, question: string): Promise<QAResult> {
    await buildIndex(projectId);
    if (blocks.value.length === 0) {
      return { answer: "这本书还没有可检索的章节内容。", sources: [] };
    }
    if (!question.trim()) {
      return { answer: "请输入你要查询的问题。", sources: [] };
    }

    isAsking.value = true;
    try {
      // 1. 语义召回：问题与每个块算相似度
      const qKeywords = extractKeywords(question, 15).map((k) => k.word);
      const scored = blocks.value.map((b) => {
        const overlap = qKeywords.filter((w) => b.keywords.includes(w)).length;
        const jac = jaccardSimilarity(question, b.text);
        const cos = cosineSimilarity(question, b.text);
        return { block: b, score: overlap * 0.6 + jac * 0.25 + cos * 0.15 };
      });
      scored.sort((a, b) => b.score - a.score);
      const top = scored.filter((s) => s.score > 0.001).slice(0, 5);

      if (top.length === 0) {
        return { answer: "没有检索到与问题相关的章节内容，换个说法试试？", sources: [] };
      }

      // 2. 拼接上下文
      const context = top
        .map((s, i) => `【引用${i + 1}｜《${s.block.chapterTitle}》】\n${s.block.text}`)
        .join("\n\n---\n\n");

      const systemPrompt =
        "你是一位小说全文检索问答助手。根据下面提供的【引用】片段，回答用户的问题。" +
        "要求：\n1. 优先基于引用内容作答，引用不足时如实说明\n" +
        "2. 回答末尾用「参考资料」列出你依据的章节名\n" +
        "3. 不要编造引用中没有的信息";

      // 3. 调用 AI（独立会话，不污染主聊天）
      const aiStore = useAIStore();
      const response = await invoke<AIResponse>("call_ai", {
        baseUrl: aiStore.resolvedBaseUrl,
        apiKey: aiStore.resolvedApiKey,
        model: aiStore.resolvedModelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${context}\n\n问题：${question}` },
        ],
        temperature: 0.3,
        topP: aiStore.topP,
        maxTokens: 1500,
      });

      // 4. 溯源
      const sources = top.map((s) => ({
        chapterFileName: s.block.chapterFileName,
        chapterTitle: s.block.chapterTitle,
        snippet: s.block.text.slice(0, 120),
      }));

      return { answer: response.content, sources };
    } finally {
      isAsking.value = false;
    }
  }

  return {
    isIndexing,
    isAsking,
    blockCount,
    chapterCount,
    buildIndex,
    invalidate,
    ask,
  };
});
