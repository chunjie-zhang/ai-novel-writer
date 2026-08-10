import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface PlotHole {
  id: string;
  type: "foreshadow" | "plot-hole" | "cliffhanger" | "loose-end";
  title: string;
  description: string;
  chapter: string;
  /** 是否已填 */
  resolved: boolean;
  /** 填坑的章节 */
  resolvedChapter?: string;
  created_at: string;
  resolved_at?: string;
}

const STORAGE_PREFIX = "novel-plot-holes";

function loadHoles(projectId: string): PlotHole[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}-${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHoles(projectId: string, holes: PlotHole[]) {
  localStorage.setItem(`${STORAGE_PREFIX}-${projectId}`, JSON.stringify(holes));
}

export const usePlotStore = defineStore("plot", () => {
  const holes = ref<PlotHole[]>([]);
  let currentProjectId = "";

  /** 加载指定项目的伏笔（切换项目时调用，避免串数据） */
  function loadForProject(projectId: string) {
    currentProjectId = projectId;
    holes.value = loadHoles(projectId);
  }

  function persist() {
    if (currentProjectId) saveHoles(currentProjectId, holes.value);
  }

  const unresolvedHoles = computed(() => holes.value.filter((h) => !h.resolved));
  const unresolvedCount = computed(() => unresolvedHoles.value.length);

  function addHole(hole: Omit<PlotHole, "id" | "created_at">) {
    holes.value.push({
      ...hole,
      id: `hole-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    persist();
  }

  function resolveHole(id: string, chapter?: string) {
    const hole = holes.value.find((h) => h.id === id);
    if (hole) {
      hole.resolved = true;
      hole.resolvedChapter = chapter;
      hole.resolved_at = new Date().toISOString();
      persist();
    }
  }

  function removeHole(id: string) {
    holes.value = holes.value.filter((h) => h.id !== id);
    persist();
  }

  function updateHole(id: string, data: Partial<PlotHole>) {
    const hole = holes.value.find((h) => h.id === id);
    if (hole) Object.assign(hole, data);
    persist();
  }

  return { holes, unresolvedHoles, unresolvedCount, loadForProject, addHole, resolveHole, removeHole, updateHole };
});
