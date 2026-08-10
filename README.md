# AI 小说创作工具

对标 FeelFish 的桌面端 AI 小说创作工具，专为网文作者、长篇小说创作者设计。

## 技术栈

- **桌面框架**: Tauri 2.0
- **前端**: Vue 3 + TypeScript + Vite
- **UI 框架**: Element Plus + TailwindCSS
- **编辑器**: 原生 Markdown 编辑器
- **后端语言**: Rust
- **AI 协议**: OpenAI 兼容协议

## 核心功能

1. **小说项目系统** - 本地文件化项目管理
2. **AI 长篇记忆系统** - 解决剧情崩坏、人设崩塌
3. **Markdown 编辑器** - 实时编辑、自动保存
4. **角色 & 世界观管理** - 结构化角色/世界观设置
5. **AI 对话创作面板** - 聊天式创作助手
6. **导入导出系统** - MD/TXT 导出

## 模型支持

- **默认支持 DeepSeek**: 预设 DeepSeek 官方接口地址，需自行提供 API Key
- **自定义模型**: 支持任何 OpenAI 兼容接口

## 开发

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 项目结构

```
ai-novel-writer/
├── src/                    # Vue 前端源码
│   ├── components/         # 组件
│   │   ├── layout/         # 布局组件
│   │   ├── novel/          # 小说相关组件
│   │   └── ai/             # AI 相关组件
│   ├── stores/             # Pinia 状态管理
│   ├── types/              # TypeScript 类型
│   ├── utils/              # 工具函数
│   └── views/              # 页面
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── commands/       # Tauri 命令
│       └── models/         # 数据模型
└── package.json
```
