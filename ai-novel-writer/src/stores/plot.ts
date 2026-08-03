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

const STORAGE_KEY = "novel-plot-holes";

function loadHoles(): PlotHole[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHoles(holes: PlotHole[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(holes));
}

export const usePlotStore = defineStore("plot", () => {
  const holes = ref<PlotHole[]>(loadHoles());

  const unresolvedHoles = computed(() => holes.value.filter((h) => !h.resolved));
  const unresolvedCount = computed(() => unresolvedHoles.value.length);

  function addHole(hole: Omit<PlotHole, "id" | "created_at">) {
    holes.value.push({
      ...hole,
      id: `hole-${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    saveHoles(holes.value);
  }

  function resolveHole(id: string, chapter?: string) {
    const hole = holes.value.find((h) => h.id === id);
    if (hole) {
      hole.resolved = true;
      hole.resolvedChapter = chapter;
      hole.resolved_at = new Date().toISOString();
      saveHoles(holes.value);
    }
  }

  function removeHole(id: string) {
    holes.value = holes.value.filter((h) => h.id !== id);
    saveHoles(holes.value);
  }

  function updateHole(id: string, data: Partial<PlotHole>) {
    const hole = holes.value.find((h) => h.id === id);
    if (hole) Object.assign(hole, data);
    saveHoles(holes.value);
  }

  return { holes, unresolvedHoles, unresolvedCount, addHole, resolveHole, removeHole, updateHole };
});
