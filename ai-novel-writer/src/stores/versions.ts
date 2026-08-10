import { defineStore } from "pinia";

/** 章节历史版本 */
export interface ChapterVersion {
  /** 保存时间戳 */
  timestamp: number;
  /** 版本内容 */
  content: string;
  /** 正文字数 */
  wordCount: number;
}

/** 每章节最多保留的历史版本数 */
const MAX_VERSIONS_PER_CHAPTER = 10;
const VERSIONS_PREFIX = "novel-chapter-versions";

function key(projectId: string, chapterFileName: string) {
  return `${VERSIONS_PREFIX}:${projectId}:${chapterFileName}`;
}

function load(projectId: string, chapterFileName: string): ChapterVersion[] {
  try {
    const raw = localStorage.getItem(key(projectId, chapterFileName));
    return raw ? (JSON.parse(raw) as ChapterVersion[]) : [];
  } catch {
    return [];
  }
}

function persist(projectId: string, chapterFileName: string, versions: ChapterVersion[]) {
  try {
    localStorage.setItem(key(projectId, chapterFileName), JSON.stringify(versions));
  } catch (e) {
    console.warn("保存章节历史版本失败:", e);
  }
}

export const useVersionsStore = defineStore("versions", () => {
  /**
   * 保存当前内容为历史版本（在章节保存成功时自动调用）。
   * 与最近一个版本内容相同则跳过（去重）。
   */
  function recordVersion(
    projectId: string,
    chapterFileName: string,
    content: string
  ) {
    if (!content.trim()) return;
    const versions = load(projectId, chapterFileName);
    const last = versions[versions.length - 1];
    if (last && last.content === content) return;
    // 保证时间戳单调递增且唯一（避免同一毫秒内多次保存导致删除/恢复错乱）
    const now = Date.now();
    const ts =
      last && last.timestamp >= now ? last.timestamp + 1 : now;
    versions.push({
      timestamp: ts,
      content,
      wordCount: content.replace(/\s/g, "").length,
    });
    // 只保留最近 N 个版本，避免占用过多空间
    if (versions.length > MAX_VERSIONS_PER_CHAPTER) {
      versions.splice(0, versions.length - MAX_VERSIONS_PER_CHAPTER);
    }
    persist(projectId, chapterFileName, versions);
  }

  /** 列出章节历史版本（新的在前） */
  function listVersions(
    projectId: string,
    chapterFileName: string
  ): ChapterVersion[] {
    return load(projectId, chapterFileName).slice().reverse();
  }

  /** 获取指定版本内容 */
  function getVersion(
    projectId: string,
    chapterFileName: string,
    timestamp: number
  ): string | null {
    const versions = load(projectId, chapterFileName);
    const v = versions.find((it) => it.timestamp === timestamp);
    return v ? v.content : null;
  }

  /** 删除某个版本 */
  function removeVersion(
    projectId: string,
    chapterFileName: string,
    timestamp: number
  ) {
    const versions = load(projectId, chapterFileName);
    persist(
      projectId,
      chapterFileName,
      versions.filter((it) => it.timestamp !== timestamp)
    );
  }

  /** 删除某章节的所有版本（章节被删除时调用） */
  function clearChapter(projectId: string, chapterFileName: string) {
    localStorage.removeItem(key(projectId, chapterFileName));
  }

  /** 章节重命名时迁移其历史版本到新文件名 */
  function renameChapter(
    projectId: string,
    oldFileName: string,
    newFileName: string
  ) {
    const versions = load(projectId, oldFileName);
    if (versions.length > 0) {
      persist(projectId, newFileName, versions);
    }
    localStorage.removeItem(key(projectId, oldFileName));
  }

  /** 删除某项目的所有章节版本（项目被删除时调用） */
  function clearProject(projectId: string) {
    const prefix = `${VERSIONS_PREFIX}:${projectId}:`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }

  return {
    recordVersion,
    listVersions,
    getVersion,
    removeVersion,
    clearChapter,
    renameChapter,
    clearProject,
  };
});
