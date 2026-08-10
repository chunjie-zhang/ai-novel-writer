// 打包 Tauri 桌面应用（从任意目录运行均安全，内部自动切到项目根）
// 用法：node scripts/build-tauri.cjs
const { spawn } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const cli = path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const child = spawn(process.execPath, [cli, "build"], { stdio: "inherit" });

child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (err) => {
  console.error("打包失败：", err.message);
  process.exit(1);
});
