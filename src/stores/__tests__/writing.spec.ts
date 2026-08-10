import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useWritingStore } from "../writing";

describe("敏感词检查", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("普通词（学习/习惯）不再被误报", () => {
    const store = useWritingStore();
    const text = "我每天都在认真学习，养成了良好的学习习惯。";
    expect(store.checkSensitiveWords(text)).toEqual([]);
  });

  it("真正的敏感词仍能检测到", () => {
    const store = useWritingStore();
    const results = store.checkSensitiveWords("他妈的，这里有人在赌博");
    const words = results.map((r) => r.word);
    expect(words).toContain("他妈");
    expect(words).toContain("赌博");
  });

  it("替换敏感词但不破坏正常词", () => {
    const store = useWritingStore();
    const out = store.replaceSensitiveWords("他妈的，我爱学习");
    // "他妈"被替换，其余正常词保留
    expect(out).toBe("***的，我爱学习");
    expect(out).toContain("学习");
  });
});

describe("字数统计（仅统计用户实际输入）", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("触发 editor-user-input 事件时累计字数", () => {
    const store = useWritingStore();
    window.dispatchEvent(new CustomEvent("editor-user-input", { detail: 100 }));
    expect(store.stats.writtenToday).toBe(100);
    expect(store.stats.totalWrittenAllTime).toBe(100);
  });

  it("detail 为 0 或负数时不累计", () => {
    const store = useWritingStore();
    window.dispatchEvent(new CustomEvent("editor-user-input", { detail: 0 }));
    window.dispatchEvent(new CustomEvent("editor-user-input", { detail: -5 }));
    expect(store.stats.writtenToday).toBe(0);
  });

  it("累计多次输入", () => {
    const store = useWritingStore();
    window.dispatchEvent(new CustomEvent("editor-user-input", { detail: 30 }));
    window.dispatchEvent(new CustomEvent("editor-user-input", { detail: 20 }));
    expect(store.stats.writtenToday).toBe(50);
    expect(store.stats.totalWrittenAllTime).toBe(50);
  });
});
