// 启动 Tauri 桌面应用开发模式（从任意目录运行均安全）
// 用法：node scripts/start-tauri.cjs
// 说明：终端工具会简化 `cd ... &&` 前缀，导致在错误目录执行，
//       因此这里显式 chdir 到项目根，再调用 Tauri CLI。
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const cli = path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const child = spawn(process.execPath, [cli, "dev"], { stdio: "inherit" });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("启动失败：", err.message);
  process.exit(1);
});
