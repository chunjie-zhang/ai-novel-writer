import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import { Icon } from "@iconify/vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";
import "./utils/icons"; // 内置离线 lucide 图标集（不依赖远程 API）

const app = createApp(App);

// 注册所有 Element Plus 图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

// 全局注册 Iconify 图标组件
app.component("Icon", Icon);

app.use(createPinia());
app.use(router);
app.use(ElementPlus, { locale: undefined });

app.mount("#app");
