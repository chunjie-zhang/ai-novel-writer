import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useOutlineStore } from "../outline";

describe("大纲按项目隔离存储", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("保存后写入项目维度 key", () => {
    const store = useOutlineStore();
    store.initOutline("星河纪元");
    store.saveOutline("p1");
    expect(localStorage.getItem("novel-outline-p1")).toBeTruthy();
    expect(localStorage.getItem("novel-outline-p2")).toBeNull();
  });

  it("不同项目的大纲互不串数据", () => {
    const store = useOutlineStore();
    store.initOutline("星河纪元");
    store.saveOutline("p1");

    // 切到另一个项目：无大纲
    store.loadOutline("p2");
    expect(store.outline).toBeNull();

    // 切回 p1：大纲还在
    store.loadOutline("p1");
    expect(store.outline?.title).toBe("星河纪元");
  });

  it("各自项目保存各自的大纲", () => {
    const store = useOutlineStore();
    store.initOutline("星河纪元");
    store.saveOutline("p1");

    store.initOutline("都市夜话");
    store.saveOutline("p2");

    store.loadOutline("p1");
    expect(store.outline?.title).toBe("星河纪元");
    store.loadOutline("p2");
    expect(store.outline?.title).toBe("都市夜话");
  });

  it("clearOutline 清空当前大纲", () => {
    const store = useOutlineStore();
    store.initOutline("星河纪元");
    store.clearOutline();
    expect(store.outline).toBeNull();
  });
});
