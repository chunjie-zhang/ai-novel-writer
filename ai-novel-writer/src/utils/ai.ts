import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, AIResponse } from "@/types";

/**
 * 调用 AI 模型
 */
export async function callAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  temperature: number = 0.8,
  maxTokens: number = 4096
): Promise<AIResponse> {
  return await invoke<AIResponse>("call_ai", {
    baseUrl,
    apiKey,
    model,
    messages,
    temperature,
    maxTokens,
  });
}

/**
 * 构建 AI 记忆上下文
 * 将世界观、角色、最近章节摘要拼接成 system prompt
 */
export function buildMemoryContext(
  worldSetting: string,
  characters: { name: string; personality: string; background: string }[],
  recentMemories: { summary: string; key_events: string[] }[]
): string {
  const parts: string[] = [];

  // 世界观
  if (worldSetting) {
    parts.push(`【世界观设定】\n${worldSetting}\n`);
  }

  // 角色档案
  if (characters.length > 0) {
    const charDesc = characters
      .map(
        (c) =>
          `- ${c.name}：性格=${c.personality}，背景=${c.background}`
      )
      .join("\n");
    parts.push(`【角色档案】\n${charDesc}\n`);
  }

  // 近期记忆
  if (recentMemories.length > 0) {
    const memDesc = recentMemories
      .map(
        (m, i) =>
          `【摘要${i + 1}】${m.summary}\n关键事件：${m.key_events.join("、")}`
      )
      .join("\n\n");
    parts.push(`【近期剧情记忆】\n${memDesc}\n`);
  }

  return parts.join("\n\n");
}

/**
 * 构建 AI 续写 prompt
 */
export function buildContinuePrompt(
  previousContent: string,
  memoryContext: string
): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是一位专业的小说创作助手。请根据已有的世界观设定、角色档案和剧情记忆，续写小说的下一段内容。

请遵循以下要求：
1. 保持人物性格一致性，不出现人设崩塌
2. 延续当前的剧情风格和叙事节奏
3. 保持语言风格与已有内容一致
4. 不要重复已有的内容
5. 直接输出续写内容，不要加任何说明

${memoryContext}`,
    },
    {
      role: "user",
      content: `请续写以下小说的后续内容：\n\n${previousContent}`,
    },
  ];
}

/**
 * 构建 AI 改写/润色 prompt
 */
export function buildEditPrompt(
  selectedText: string,
  actionType: string,
  instruction?: string
): ChatMessage[] {
  const prompts: Record<string, string> = {
    rewrite: "请改写以下内容，保持原意但用不同的表达方式：",
    expand: "请扩写以下内容，增加细节描写和情节展开：",
    abridge: "请缩写以下内容，保留核心信息：",
    polish: "请润色以下内容，提升文笔和流畅度：",
  };

  const basePrompt = prompts[actionType] || prompts.polish;

  return [
    {
      role: "system",
      content:
        "你是一位专业的小说编辑，擅长文字修改。直接输出修改后的内容，不要加任何说明。",
    },
    {
      role: "user",
      content: `${basePrompt}\n\n${selectedText}${
        instruction ? `\n\n额外要求：${instruction}` : ""
      }`,
    },
  ];
}
