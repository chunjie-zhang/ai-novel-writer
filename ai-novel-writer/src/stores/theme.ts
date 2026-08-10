import { defineStore } from "pinia";
import { ref, computed } from "vue";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "app-theme-mode";

/**
 * 主题管理：支持「跟随系统 / 白天 / 黑夜」。
 * 通过给 <html> 添加 / 移除 theme-dark class 切换 style.css 中的变量组。
 */
export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>("system");
  const systemDark = ref(false);

  const isDark = computed(
    () => mode.value === "dark" || (mode.value === "system" && systemDark.value)
  );

  /** 把当前主题应用到 <html> */
  function apply() {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", isDark.value);
    root.classList.toggle("theme-light", !isDark.value);
  }

  /** 初始化：恢复偏好 + 监听系统主题变化 */
  function init() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      mode.value = saved;
    }

    try {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      systemDark.value = mq.matches;
      const onChange = (e: MediaQueryListEvent) => {
        systemDark.value = e.matches;
        apply();
      };
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
      } else {
        // 兼容旧浏览器
        (mq as any).addListener?.(onChange);
      }
    } catch {
      /* 环境不支持 matchMedia 时忽略 */
    }

    apply();
  }

  /** 切换主题模式并持久化 */
  function setMode(m: ThemeMode) {
    mode.value = m;
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
    apply();
  }

  return { mode, systemDark, isDark, init, setMode };
});
