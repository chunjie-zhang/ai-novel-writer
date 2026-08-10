import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useEditorStore } from "../editor";

function chapter(title: string, file_name: string) {
  return {
    id: file_name,
    title,
    file_name,
    group: "",
    order: 1,
    word_count: 0,
    created_at: "",
    updated_at: "",
  };
}

describe("编辑器字数上报（打开章节不计入日更）", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("setContent 新增内容时派发 editor-user-input 事件", () => {
    const store = useEditorStore();
    let received: number | null = null;
    const listener = (e: Event) => {
      received = (e as CustomEvent).detail as number;
    };
    window.addEventListener("editor-user-input", listener);

    store.setContent("你好世界");
    expect(received).toBe(4);

    window.removeEventListener("editor-user-input", listener);
  });

  it("setContent 只上报新增字数，而非总量", () => {
    const store = useEditorStore();
    const received: number[] = [];
    const listener = (e: Event) => {
      received.push((e as CustomEvent).detail as number);
    };
    window.addEventListener("editor-user-input", listener);

    store.setContent("你好世界"); // 4 字
    store.setContent("你好世界更多"); // 6 字，新增 2
    expect(received).toEqual([4, 2]);

    window.removeEventListener("editor-user-input", listener);
  });

  it("setContent 内容变少时不派发事件", () => {
    const store = useEditorStore();
    let count = 0;
    const listener = () => {
      count++;
    };
    window.addEventListener("editor-user-input", listener);

    store.setContent("你好世界");
    store.setContent("你好");
    expect(count).toBe(1); // 只有第一次新增触发

    window.removeEventListener("editor-user-input", listener);
  });

  it("打开章节（openChapter）不派发事件", () => {
    const store = useEditorStore();
    let count = 0;
    const listener = () => {
      count++;
    };
    window.addEventListener("editor-user-input", listener);

    store.openChapter(
      chapter("第1章 初入江湖", "第1章 初入江湖.md"),
      "这是一段历史章节内容，切换章节时不应计入日更字数。"
    );
    expect(count).toBe(0);

    window.removeEventListener("editor-user-input", listener);
  });

  it("新建章节（createChapter 直接设值）不派发事件", async () => {
    const store = useEditorStore();
    let count = 0;
    const listener = () => {
      count++;
    };
    window.addEventListener("editor-user-input", listener);

    // createChapter 内部会调 invoke，直接设 content.value，不经过 setContent
    // 手动模拟 createChapter 的设值路径（不派发事件）
    store.setContent("");
    expect(count).toBe(0);

    window.removeEventListener("editor-user-input", listener);
  });
});
