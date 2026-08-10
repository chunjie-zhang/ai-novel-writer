import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useVersionsStore } from "../versions";

describe("章节历史版本回溯", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("记录版本并可按章节隔离存储", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "第一章内容 v1");
    store.recordVersion("p1", "第2章.md", "第二章内容");
    store.recordVersion("p2", "第1章.md", "另一本书的内容");

    const list1 = store.listVersions("p1", "第1章.md");
    expect(list1).toHaveLength(1);
    expect(list1[0].content).toBe("第一章内容 v1");

    // 不同章节、不同项目互不干扰
    expect(store.listVersions("p1", "第2章.md")).toHaveLength(1);
    expect(store.listVersions("p2", "第1章.md")).toHaveLength(1);
  });

  it("内容相同去重，不重复记录", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "相同内容");
    store.recordVersion("p1", "第1章.md", "相同内容");
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(1);
  });

  it("空内容不记录版本", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "   ");
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(0);
  });

  it("每章节最多保留最近 10 个版本，且最新在前", () => {
    const store = useVersionsStore();
    for (let i = 1; i <= 12; i++) {
      store.recordVersion("p1", "第1章.md", `内容 v${i}`);
    }
    const list = store.listVersions("p1", "第1章.md");
    expect(list).toHaveLength(10);
    expect(list[0].content).toBe("内容 v12"); // 最新的在最前
    expect(list[9].content).toBe("内容 v3"); // 最旧保留的是 v3（v1/v2 被淘汰）
  });

  it("getVersion 可取得指定版本内容", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "v1");
    store.recordVersion("p1", "第1章.md", "v2");
    const ts = store.listVersions("p1", "第1章.md")[1].timestamp;
    expect(store.getVersion("p1", "第1章.md", ts)).toBe("v1");
    expect(store.getVersion("p1", "第1章.md", 999999)).toBeNull();
  });

  it("删除单个版本", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "v1");
    store.recordVersion("p1", "第1章.md", "v2");
    const list = store.listVersions("p1", "第1章.md");
    const toRemove = list[1].timestamp;
    store.removeVersion("p1", "第1章.md", toRemove);
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(1);
    expect(store.listVersions("p1", "第1章.md")[0].content).toBe("v2");
  });

  it("clearChapter 清空某章节全部版本", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "v1");
    store.recordVersion("p1", "第2章.md", "x1");
    store.clearChapter("p1", "第1章.md");
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(0);
    expect(store.listVersions("p1", "第2章.md")).toHaveLength(1);
  });

  it("clearProject 清空某项目全部章节版本", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "v1");
    store.recordVersion("p1", "第2章.md", "x1");
    store.recordVersion("p2", "第1章.md", "y1");
    store.clearProject("p1");
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(0);
    expect(store.listVersions("p1", "第2章.md")).toHaveLength(0);
    expect(store.listVersions("p2", "第1章.md")).toHaveLength(1);
  });

  it("章节重命名后历史版本迁移到新文件名", () => {
    const store = useVersionsStore();
    store.recordVersion("p1", "第1章.md", "v1");
    store.recordVersion("p1", "第1章.md", "v2");
    store.renameChapter("p1", "第1章.md", "第一章.md");
    expect(store.listVersions("p1", "第1章.md")).toHaveLength(0);
    const migrated = store.listVersions("p1", "第一章.md");
    expect(migrated).toHaveLength(2);
    expect(migrated[0].content).toBe("v2");
  });
});
