import { defineStore } from "pinia";
import { ref, computed } from "vue";
/** 三级大纲节点 */
export interface OutlineNode {
  id: string;
  type: "book" | "volume" | "chapter";
  title: string;
  description: string;
  /** 预期字数 */
  targetWords?: number;
  /** 关联的章节文件名（仅 chapter 类型） */
  chapterFileName?: string;
  /** 关联的文件名（向后兼容 template 中的 link） */
  link?: string;
  children: OutlineNode[];
  collapsed?: boolean;
}

export const useOutlineStore = defineStore("outline", () => {
  const outline = ref<OutlineNode | null>(null);
  const isLoading = ref(false);

  const hasOutline = computed(() => outline.value !== null);

  /** 获取扁平化的所有章节级节点 */
  const flatChapters = computed(() => {
    if (!outline.value) return [];
    const result: OutlineNode[] = [];
    function walk(node: OutlineNode) {
      if (node.type === "chapter") result.push(node);
      for (const child of node.children) walk(child);
    }
    walk(outline.value);
    return result;
  });

  /** 初始化大纲 */
  function initOutline(bookTitle: string) {
    outline.value = {
      id: "book-1",
      type: "book",
      title: bookTitle,
      description: "",
      children: [
        {
          id: "vol-1",
          type: "volume",
          title: "第一卷",
          description: "",
          targetWords: 100000,
          children: [],
          collapsed: false,
        },
      ],
      collapsed: false,
    };
  }

  /** 添加分卷 */
  function addVolume(title?: string) {
    if (!outline.value) return;
    const num = outline.value.children.length + 1;
    outline.value.children.push({
      id: `vol-${Date.now()}`,
      type: "volume",
      title: title || `第${toChineseNum(num)}卷`,
      description: "",
      targetWords: 100000,
      children: [],
      collapsed: false,
    });
  }

  /** 在指定分卷下添加章节 */
  function addChapter(volumeId: string, title?: string) {
    if (!outline.value) return;
    const vol = findNode(outline.value, volumeId);
    if (!vol || vol.type !== "volume") return;
    const num = vol.children.length + 1;
    vol.children.push({
      id: `chap-${Date.now()}`,
      type: "chapter",
      title: title || `第${toChineseNum(num)}章`,
      description: "",
      targetWords: 3000,
      children: [],
    });
  }

  /** 删除节点 */
  function removeNode(nodeId: string) {
    if (!outline.value) return;
    removeNodeRecursive(outline.value, nodeId);
  }

  function removeNodeRecursive(parent: OutlineNode, nodeId: string): boolean {
    const idx = parent.children.findIndex((c) => c.id === nodeId);
    if (idx >= 0) {
      parent.children.splice(idx, 1);
      return true;
    }
    for (const child of parent.children) {
      if (removeNodeRecursive(child, nodeId)) return true;
    }
    return false;
  }

  /** 更新节点 */
  function updateNode(nodeId: string, data: Partial<OutlineNode>) {
    if (!outline.value) return;
    const node = findNode(outline.value, nodeId);
    if (node) Object.assign(node, data);
  }

  /** 查找节点 */
  function findNode(root: OutlineNode, nodeId: string): OutlineNode | null {
    if (root.id === nodeId) return root;
    for (const child of root.children) {
      const found = findNode(child, nodeId);
      if (found) return found;
    }
    return null;
  }

  /** 切换折叠 */
  function toggleCollapse(nodeId: string) {
    const node = findNode(outline.value!, nodeId);
    if (node) node.collapsed = !node.collapsed;
  }

  /** 持久化保存大纲到 localStorage（按项目隔离） */
  function saveOutline(projectId: string) {
    if (!outline.value) return;
    localStorage.setItem(`novel-outline-${projectId}`, toJSON());
  }

  /** 加载指定项目的大纲（切换项目时调用，避免串数据） */
  function loadOutline(projectId: string) {
    const key = `novel-outline-${projectId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        outline.value = JSON.parse(saved);
      } catch (e) {
        console.error("加载大纲失败:", e);
        outline.value = null;
      }
    } else {
      outline.value = null;
    }
  }

  /** 清空当前大纲（切走项目时） */
  function clearOutline() {
    outline.value = null;
  }

  /** 序列化为可存储的 JSON */
  function toJSON(): string {
    return JSON.stringify(outline.value, null, 2);
  }

  /** 从 JSON 加载 */
  function fromJSON(json: string) {
    try {
      outline.value = JSON.parse(json);
    } catch (e) { console.error("加载大纲失败:", e); }
  }

  return {
    outline,
    isLoading,
    hasOutline,
    flatChapters,
    initOutline,
    addVolume,
    addChapter,
    removeNode,
    updateNode,
    toggleCollapse,
    findNode,
    toJSON,
    fromJSON,
    saveOutline,
    loadOutline,
    clearOutline,
  };
});

function toChineseNum(n: number): string {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return chars[n];
  if (n < 20) return `十${chars[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${chars[tens]}十${ones > 0 ? chars[ones] : ""}`;
}
