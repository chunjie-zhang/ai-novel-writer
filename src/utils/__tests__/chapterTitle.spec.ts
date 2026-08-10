import { describe, it, expect } from "vitest";
import {
  extractChapterTitle,
  normalizeChapterTitle,
  sanitizeChapterName,
  buildChapterFileName,
  fixDirtyTitle,
} from "../chapterTitle";

describe("章节标题提取与文件名构建", () => {
  it("首行为 # 标题时提取标题", () => {
    expect(extractChapterTitle("# 第1章 初入江湖\n\n正文内容")).toBe("第1章 初入江湖");
  });

  it("首行带前导空格也能提取", () => {
    expect(extractChapterTitle("  #  第2章 客栈风波  \n正文")).toBe("第2章 客栈风波");
  });

  it("首行不是标题（如直接正文）返回 null", () => {
    expect(extractChapterTitle("林风背着包袱走进了古城\n正文继续")).toBeNull();
  });

  it("空内容返回 null", () => {
    expect(extractChapterTitle("")).toBeNull();
    expect(extractChapterTitle("\n\n  \n")).toBeNull();
  });

  it("首行为二级标题（##）不当作章节标题", () => {
    expect(extractChapterTitle("## 场景一\n正文")).toBeNull();
  });

  it("sanitize 保留中英文数字与空格，剔除非法字符", () => {
    // 全角冒号、感叹号等会被剔除（与 Rust save_chapter 的 is_alphanumeric 行为一致）
    expect(sanitizeChapterName("第1章：初入江湖！？")).toBe("第1章初入江湖");
    expect(sanitizeChapterName('a/b\\c*')).toBe("abc");
  });

  it("根目录章节文件名（保留分组）", () => {
    expect(buildChapterFileName("第1章 初入江湖", "")).toBe("第1章 初入江湖.md");
  });

  it("带分组章节文件名", () => {
    expect(buildChapterFileName("第1章 初入江湖", "第一卷")).toBe("第一卷/第1章 初入江湖.md");
  });

  it("标题被清空后使用兜底名", () => {
    expect(buildChapterFileName("///", "")).toMatch(/^chapter_\d+\.md$/);
  });

  it("normalize 去掉 Markdown 标记", () => {
    expect(normalizeChapterTitle("# 第1章 初入江湖")).toBe("第1章 初入江湖");
  });

  it("normalize 去掉路径前缀（分组标题取最后一段）", () => {
    expect(normalizeChapterTitle("第一卷/第1章 天启城")).toBe("第1章 天启城");
    expect(normalizeChapterTitle("第一卷/第二卷/第3章 再见")).toBe("第3章 再见");
  });

  it("normalize 去掉扩展名", () => {
    expect(normalizeChapterTitle("第1章 天启城.md")).toBe("第1章 天启城");
    expect(normalizeChapterTitle("第一卷/第1章 天.md")).toBe("第1章 天");
  });

  it("normalize 空值返回空", () => {
    expect(normalizeChapterTitle("")).toBe("");
    expect(normalizeChapterTitle("###")).toBe("");
  });

  it("fixDirtyTitle 修复带路径/.md 的脏标题", () => {
    expect(fixDirtyTitle("# 第一卷/第1章 天启城.md\n\n正文")).toBe("# 第1章 天启城\n\n正文");
    expect(fixDirtyTitle("# 第3章 天启城.md\n正文")).toBe("# 第3章 天启城\n正文");
  });

  it("fixDirtyTitle 干净标题/无标题不改动", () => {
    const clean = "# 第1章 天启城\n\n正文";
    expect(fixDirtyTitle(clean)).toBe(clean);
    expect(fixDirtyTitle("正文直接开始\n第二行")).toBe("正文直接开始\n第二行");
  });
});
