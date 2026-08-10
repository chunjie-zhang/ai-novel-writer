import { describe, it, expect } from "vitest";
import { diffLines, summarizeDiff } from "../diffLines";

describe("行级 diff（章节版本对比）", () => {
  it("完全相同时全部标记 same", () => {
    const diffs = diffLines("第一行\n第二行", "第一行\n第二行");
    expect(diffs).toEqual([
      { type: "same", text: "第一行" },
      { type: "same", text: "第二行" },
    ]);
  });

  it("新增一行被标记为 add", () => {
    const diffs = diffLines("第一行\n第三行", "第一行\n第二行\n第三行");
    expect(diffs.find((d) => d.type === "add")?.text).toBe("第二行");
  });

  it("删除一行被标记为 del", () => {
    const diffs = diffLines("第一行\n第二行\n第三行", "第一行\n第三行");
    expect(diffs.find((d) => d.type === "del")?.text).toBe("第二行");
  });

  it("修改一行表现为 删除+新增 相邻", () => {
    const diffs = diffLines("旧句子", "新句子");
    expect(diffs).toEqual([
      { type: "del", text: "旧句子" },
      { type: "add", text: "新句子" },
    ]);
  });

  it("空文本对比", () => {
    expect(diffLines("", "新增内容")).toEqual([{ type: "add", text: "新增内容" }]);
    expect(diffLines("原有内容", "")).toEqual([{ type: "del", text: "原有内容" }]);
    expect(diffLines("", "")).toEqual([]);
  });

  it("首行标题变化也能识别", () => {
    const diffs = diffLines("# 第1章 旧名\n\n正文", "# 第1章 新名\n\n正文");
    expect(diffs.some((d) => d.type === "del" && d.text.includes("旧名"))).toBe(true);
    expect(diffs.some((d) => d.type === "add" && d.text.includes("新名"))).toBe(true);
  });

  it("summarizeDiff 统计增删改数量", () => {
    const diffs = diffLines("a\nb\nc\nd", "a\nx\nc\ny");
    const s = summarizeDiff(diffs);
    expect(s.add).toBe(2);
    expect(s.del).toBe(2);
    expect(s.same).toBe(2);
  });
});
