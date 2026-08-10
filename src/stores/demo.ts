import { defineStore } from "pinia";
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { NovelProject } from "@/types";

/**
 * 示例数据：一键创建带示例章节 / 角色 / 世界观的示例项目，
 * 帮助新用户快速上手体验，可随时通过项目节点的 🗑 按钮删除。
 */
export const useDemoStore = defineStore("demo", () => {
  const isCreating = ref(false);

  async function createDemoProject(): Promise<NovelProject | null> {
    if (isCreating.value) return null;
    isCreating.value = true;
    try {
      // 1. 创建示例项目
      const project = await invoke<NovelProject>("create_project", {
        name: "示例小说·星辰之旅",
        description:
          "这是一个示例项目，包含示例章节、角色和世界观，帮助你快速了解软件功能。你可以自由修改，或整个删除它。",
        targetDir: null,
      });
      const pid = project.id;

      // 2. 示例章节（第一卷 + 未分组）
      const chapters: { title: string; group: string; content: string }[] = [
        {
          title: "第1章 陨星之夜",
          group: "第一卷",
          content:
            "# 第1章 陨星之夜\n\n陨石划破天际的刹那，整个清河镇都被点亮了。\n\n陆沉站在屋顶，仰头望着那道拖着长尾的火光，心里莫名涌起一阵悸动。那颗陨石，仿佛在呼唤他。\n\n“小沉，下来！要下雨了！”母亲在院子里喊。\n\n他没有动。因为他在那火光里，看到了一张脸——父亲的脸。\n\n三年前，父亲就是在这样一个夜晚失踪的。",
        },
        {
          title: "第2章 星辰觉醒",
          group: "第一卷",
          content:
            "# 第2章 星辰觉醒\n\n第二天清晨，陆沉在后山找到了那颗陨石。\n\n它不大，通体漆黑，表面却布满了会发光的纹路，像是某种古老文字。\n\n陆沉伸手触碰的瞬间，一股灼热顺着指尖涌入四肢百骸。他的瞳孔骤然亮起，点点星光在眼底浮现。\n\n“觉……觉醒了？”他听见一个苍老的声音在脑海中响起。",
        },
        {
          title: "第3章 启程",
          group: "",
          content:
            "# 第3章 启程\n\n三个月后，陆沉站在星港的登船口，回头望了一眼故乡的方向。\n\n“到了联邦科学院，记得给我写信。”母亲红着眼眶说。\n\n他点点头，握紧胸口那颗温热的陨石。父亲留下的线索，指向星图深处一个叫“归墟”的地方。\n\n星际列车轰鸣着启动，少年踏上了属于他的征途。",
        },
      ];
      for (const c of chapters) {
        await invoke("save_chapter", {
          projectId: pid,
          chapterTitle: c.title,
          group: c.group,
          content: c.content,
        });
      }

      // 3. 示例角色
      const characters = [
        {
          id: "demo-char-lu-chen",
          name: "陆沉",
          gender: "男",
          age: "19",
          personality: "坚韧热血，重情重义",
          appearance: "黑发少年，目光坚定，胸口总挂着一颗黑色陨石",
          background: "清河镇少年，父亲三年前失踪，觉醒星辰之力后踏上寻父之旅",
          relationships: "母亲：相依为命；苏念薇：同行伙伴",
          speech_pattern: "话不多，但句句认真",
          notes: "陨石中寄宿着上古星辰意志",
        },
        {
          id: "demo-char-su-nianwei",
          name: "苏念薇",
          gender: "女",
          age: "18",
          personality: "冷静聪慧，外冷内热",
          appearance: "银发少女，常穿联邦科学院的白袍",
          background: "联邦科学院天才少女，研究上古星文",
          relationships: "陆沉：同行伙伴；老船长：恩师",
          speech_pattern: "条理清晰，偶尔毒舌",
          notes: "能解读陨石上的古文字",
        },
        {
          id: "demo-char-captain",
          name: "老船长",
          gender: "男",
          age: "58",
          personality: "豪爽仗义，阅历丰富",
          appearance: "络腮胡，左眼戴单片镜",
          background: "星际流浪者，曾穿越“归墟”边界却活了下来",
          relationships: "陆沉：忘年交",
          speech_pattern: "满口星际黑话，爱说“当年”",
          notes: "掌握通往归墟的秘密航线",
        },
      ];
      for (const ch of characters) {
        await invoke("save_character", { projectId: pid, character: ch });
      }

      // 4. 示例世界观
      await invoke("save_world", {
        projectId: pid,
        worldSetting: {
          content:
            "这是一个星辰之力与星际文明并存的世界。少数人类能觉醒星辰之力，掌控星光、遨游星海；各大文明在银河中争夺霸权，而失落的“归墟”隐藏着上古星辰时代的秘密。",
          factions: [
            {
              name: "星辰联邦",
              description:
                "银河系第三旋臂最大的人类政权，掌管联邦科学院与星港网络。",
              members: ["苏念薇"],
            },
            {
              name: "归墟",
              description: "传说中的失落文明遗址，隐藏着星辰之力的源头。",
              members: [],
            },
          ],
          rules: [
            "星辰之力分七阶：觉醒、凝星、聚芒、星辉、星域、恒星、超新星",
            "只有拥有星核的人才能觉醒星辰之力",
            "归墟禁地禁止擅自进入",
          ],
          geography:
            "人类主要分布在银河系第三旋臂，以星港连接各行星文明；“归墟”位于银心深处。",
        },
      });

      return project;
    } catch (e) {
      console.error("创建示例项目失败:", e);
      throw e;
    } finally {
      isCreating.value = false;
    }
  }

  return { isCreating, createDemoProject };
});
