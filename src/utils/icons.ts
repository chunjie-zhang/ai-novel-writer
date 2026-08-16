/**
 * 离线图标注册：
 * 将完整 lucide 图标集内置打包（addCollection），
 * 使所有 `lucide:*` 图标本地可用，不再依赖远程 Iconify API
 * （避免弱网/离线环境下图标加载失败显示空白）。
 */
import { addCollection } from "@iconify/vue";
import { icons as lucideIcons } from "@iconify-json/lucide";

// @iconify-json/lucide 的 icons 为标准 IconifyJSON 结构
addCollection(lucideIcons);
