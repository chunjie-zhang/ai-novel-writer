import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type {
  NovelProject,
  ProjectStructure,
} from "@/types";

export const useProjectStore = defineStore("project", () => {
  // 状态
  const projects = ref<NovelProject[]>([]);
  const currentProject = ref<NovelProject | null>(null);
  const currentStructure = ref<ProjectStructure | null>(null);
  const isLoading = ref(false);

  // 计算属性
  const chapters = computed(() => currentStructure.value?.chapters || []);
  /** 已创建的卷分组目录名（含空卷） */
  const groups = computed(() => currentStructure.value?.groups || []);
  const characters = computed(() => currentStructure.value?.characters || []);
  const worldSetting = computed(() => currentStructure.value?.world_setting || null);
  const memories = computed(() => currentStructure.value?.memories || []);
  const hasProject = computed(() => currentProject.value !== null);

  // 方法
  async function loadProjects() {
    isLoading.value = true;
    try {
      projects.value = await invoke<NovelProject[]>("list_projects");
    } finally {
      isLoading.value = false;
    }
  }

  async function createProject(name: string, description: string = "", targetDir?: string) {
    isLoading.value = true;
    try {
      const project = await invoke<NovelProject>("create_project", {
        name,
        description,
        targetDir: targetDir || null,
      });
      projects.value.unshift(project);
      await openProject(project.id);
      return project;
    } finally {
      isLoading.value = false;
    }
  }

  async function openProject(projectId: string) {
    isLoading.value = true;
    try {
      const structure = await invoke<ProjectStructure>("get_project_structure", {
        projectId,
      });
      currentStructure.value = structure;
      currentProject.value = structure.project;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteProject(projectId: string) {
    isLoading.value = true;
    try {
      await invoke("delete_project", { projectId });
      // 同步删除该小说的 AI 对话记录
      try {
        localStorage.removeItem(`novel-chat-${projectId}`);
      } catch (e) {
        console.error("删除对话记录失败:", e);
      }
      projects.value = projects.value.filter((p) => p.id !== projectId);
      if (currentProject.value?.id === projectId) {
        currentProject.value = null;
        currentStructure.value = null;
      }
    } finally {
      isLoading.value = false;
    }
  }

  /** 迁移已有项目到新存储位置 */
  async function moveProject(projectId: string, targetDir: string) {
    isLoading.value = true;
    try {
      await invoke("move_project", { projectId, targetDir });
      // 刷新项目列表
      await loadProjects();
      // 如果正在打开该项目，重新打开以更新路径
      if (currentProject.value?.id === projectId) {
        await openProject(projectId);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /** 重命名小说项目 */
  async function renameProject(projectId: string, newName: string) {
    isLoading.value = true;
    try {
      await invoke("rename_project", { projectId, newName });
      await loadProjects();
      if (currentProject.value?.id === projectId) {
        await openProject(projectId);
      }
    } finally {
      isLoading.value = false;
    }
  }

  /** 更新小说基本信息（名称/作者/题材/状态/简介/标签/封面） */
  async function updateProjectInfo(projectId: string, info: {
    name: string;
    author?: string;
    genre?: string;
    status?: string;
    description?: string;
    tags?: string;
    cover?: string;
  }) {
    isLoading.value = true;
    try {
      await invoke("update_project_info", {
        projectId,
        name: info.name,
        author: info.author || "",
        genre: info.genre || "",
        status: info.status || "ongoing",
        description: info.description || "",
        tags: info.tags || "",
        cover: info.cover || "",
      });
      await loadProjects();
      if (currentProject.value?.id === projectId) {
        await openProject(projectId);
      }
    } finally {
      isLoading.value = false;
    }
  }

  function closeProject() {
    currentProject.value = null;
    currentStructure.value = null;
  }

  return {
    projects,
    currentProject,
    currentStructure,
    isLoading,
    chapters,
    groups,
    characters,
    worldSetting,
    memories,
    hasProject,
    loadProjects,
    createProject,
    openProject,
    deleteProject,
    moveProject,
    renameProject,
    updateProjectInfo,
    closeProject,
  };
});
