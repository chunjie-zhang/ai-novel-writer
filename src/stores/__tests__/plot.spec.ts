import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePlotStore } from "../plot";

describe("伏笔按项目隔离存储", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("添加伏笔后写入项目维度 key", () => {
    const store = usePlotStore();
    store.loadForProject("p1");
    store.addHole({
      type: "foreshadow",
      title: "主角身世",
      description: "",
      chapter: "",
      resolved: false,
    });
    expect(store.holes.length).toBe(1);
    expect(localStorage.getItem("novel-plot-holes-p1")).toBeTruthy();
    expect(localStorage.getItem("novel-plot-holes-p2")).toBeNull();
  });

  it("不同项目的伏笔互不串数据", () => {
    const store = usePlotStore();
    store.loadForProject("p1");
    store.addHole({
      type: "foreshadow",
      title: "主角身世",
      description: "",
      chapter: "",
      resolved: false,
    });

    store.loadForProject("p2");
    expect(store.holes.length).toBe(0);

    store.loadForProject("p1");
    expect(store.holes.length).toBe(1);
    expect(store.holes[0].title).toBe("主角身世");
  });

  it("resolveHole / removeHole 持久化到对应项目", () => {
    const store = usePlotStore();
    store.loadForProject("p1");
    store.addHole({
      type: "plot-hole",
      title: "坑位A",
      description: "",
      chapter: "",
      resolved: false,
    });
    const id = store.holes[0].id;

    store.resolveHole(id, "第5章");
    expect(store.holes[0].resolved).toBe(true);

    store.removeHole(id);
    expect(store.holes.length).toBe(0);

    // 重新加载仍为空（已删除并持久化）
    store.loadForProject("p1");
    expect(store.holes.length).toBe(0);
  });
});
