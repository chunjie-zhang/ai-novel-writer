/**
 * 错别字/语病校对工具
 * 使用 AI 模型进行语义级纠错
 */
import type { ChatMessage } from "@/types";

/** 常见错别字库（本地快速检测） */
const COMMON_MISTAKES: [string, string][] = [
  ["不奈烦", "不耐烦"],
  ["按耐不住", "按捺不住"],
  ["变本加利", "变本加厉"],
  ["暗然失色", "黯然失色"],
  ["白壁微瑕", "白璧微瑕"],
  ["百尺杆头", "百尺竿头"],
  ["班驳陆离", "斑驳陆离"],
  ["笔划", "笔画"],
  ["不径而走", "不胫而走"],
  ["不可思异", "不可思议"],
  ["重峦叠障", "重峦叠嶂"],
  ["错手不及", "措手不及"],
  ["带替", "代替"],
  ["得垄望蜀", "得陇望蜀"],
  ["渡假", "度假"],
  ["风彩", "风采"],
  ["根深地固", "根深蒂固"],
  ["鬼计多端", "诡计多端"],
  ["喝采", "喝彩"],
  ["后补", "候补"],
  ["既使", "即使"],
  ["加奖", "嘉奖"],
  ["痉孪", "痉挛"],
  ["决对", "绝对"],
  ["克苦", "刻苦"],
  ["兰天", "蓝天"],
  ["冷寞", "冷漠"],
  ["罗嗦", "啰嗦"],
  ["麦杆", "麦秆"],
  ["偶而", "偶尔"],
  ["凭添", "平添"],
  ["精典", "经典"],
  ["年青", "年轻"],
  ["入坐", "入座"],
  ["杀戳", "杀戮"],
  ["善长", "擅长"],
  ["时毛", "时髦"],
  ["署假", "暑假"],
  ["松驰", "松弛"],
  ["挺而走险", "铤而走险"],
  ["万事具备", "万事俱备"],
  ["陷井", "陷阱"],
  ["消魂", "销魂"],
  ["渲泄", "宣泄"],
  ["眩耀", "炫耀"],
  ["亦或", "抑或"],
  ["引伸", "引申"],
  ["荧屏", "屏幕"],
  ["游戈", "游弋"],
  ["予备", "预备"],
  ["装祯", "装帧"],
  ["座落", "坐落"],
];

export interface CorrectionResult {
  original: string;
  corrected: string;
  fixes: { mistake: string; correction: string; position: number }[];
  hasIssues: boolean;
}

/** 本地快速错别字检测 */
export function localSpellCheck(text: string): CorrectionResult {
  const fixes: CorrectionResult["fixes"] = [];
  let corrected = text;

  for (const [wrong, right] of COMMON_MISTAKES) {
    let idx = corrected.indexOf(wrong);
    while (idx !== -1) {
      fixes.push({ mistake: wrong, correction: right, position: idx });
      corrected = corrected.replace(wrong, right);
      idx = corrected.indexOf(wrong, idx + right.length);
    }
  }

  return {
    original: text,
    corrected,
    fixes,
    hasIssues: fixes.length > 0,
  };
}

/** AI 语病校对 prompt */
export function buildProofreadPrompt(text: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `你是一位专业的小说文本校对编辑。请检查以下小说片段中的问题：

检查维度：
1. **错别字**：同音错字、形近错字
2. **语病**：搭配不当、成分残缺、句式杂糅、语序不当
3. **标点错误**：错用、漏用标点
4. **重复冗余**：重复用词、啰嗦表达
5. **逻辑问题**：语义不通、前后矛盾

输出格式（严格按以下 JSON 格式，不要加任何额外说明）：
{
  "hasIssues": true,
  "issues": [
    {"type": "错别字", "original": "...", "suggestion": "...", "position": 行号},
    {"type": "语病", "original": "...", "suggestion": "...", "position": 行号}
  ],
  "correctedText": "修改后的完整文本",
  "summary": "总体评价（一句话）"
}

如果没有问题，返回 {"hasIssues": false, "issues": [], "correctedText": "", "summary": "未发现问题"}`,
    },
    { role: "user", content: text },
  ];
}
