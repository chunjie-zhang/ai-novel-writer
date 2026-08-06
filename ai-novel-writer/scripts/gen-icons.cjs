// 从 1024x1024 PNG 源图生成 Tauri 全套应用图标。从任意目录运行均安全。
// 用法：
//   node scripts/gen-icons.cjs                     # 默认用项目根 icon-source.png
//   node scripts/gen-icons.cjs /path/to/icon.png   # 指定源图路径
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.resolve(__dirname, "..");
process.chdir(root);

const source = path.resolve(process.argv[2] || path.join(root, "icon-source.png"));

if (!fs.existsSync(source)) {
  console.error("❌ 未找到图标源图：" + source);
  console.error("   请把 1024x1024 的 PNG 命名为 icon-source.png 放到项目根，");
  console.error("   或直接传入图片路径：node scripts/gen-icons.cjs <图片路径>");
  process.exit(1);
}

const r = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "@tauri-apps", "cli", "tauri.js"),
    "icon",
    source,
  ],
  { stdio: "inherit" }
);

if (r.status === 0) {
  console.log("✅ 已从 " + source + " 生成全套图标（src-tauri/icons/）");
}
process.exit(r.status || 0);
