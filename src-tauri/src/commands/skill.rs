// ===== 用户自定义技能（Skill 市场）管理 =====
//
// 技能存放在应用数据目录：{app_data_dir}/skills/
// 一个技能 = 一个子目录：
//   {app_data_dir}/skills/{skill-id}/
//       SKILL.md            ← 技能定义（YAML frontmatter + Markdown body）
//       script.js / …       ← 技能配套资源（zip 导入时完整保留）
//
// 前端负责解析 SKILL.md 的 frontmatter；Rust 负责文件读写/列表/删除。

use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

/// 技能根目录：{app_data_dir}/skills
fn get_skills_dir(app_handle: &AppHandle) -> PathBuf {
    app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("skills")
}

/// 技能条目：目录名 + SKILL.md 内容 + 资源文件列表
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomSkillEntry {
    /// 技能目录名（即技能 id 的目录形式）
    pub dir_name: String,
    /// SKILL.md 全文
    pub content: String,
    /// 目录下除 SKILL.md 外的资源文件相对路径列表（如 ["script.js"]）
    pub resources: Vec<String>,
}

/// 列出所有自定义技能（每个技能返回 SKILL.md 内容 + 资源文件列表）
#[tauri::command]
pub fn list_custom_skills(app_handle: AppHandle) -> Result<Vec<CustomSkillEntry>, String> {
    let dir = get_skills_dir(&app_handle);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut entries = vec![];
    let read = fs::read_dir(&dir).map_err(|e| format!("读取技能目录失败: {}", e))?;
    for entry in read {
        let entry = entry.map_err(|e| format!("读取技能条目失败: {}", e))?;
        let path = entry.path();
        // 技能 = 一个子目录，内含 SKILL.md
        if path.is_dir() {
            let skill_md = path.join("SKILL.md");
            if skill_md.is_file() {
                if let Ok(content) = fs::read_to_string(&skill_md) {
                    let dir_name = entry.file_name().to_string_lossy().to_string();
                    let resources = list_resource_files(&path);
                    entries.push(CustomSkillEntry {
                        dir_name,
                        content,
                        resources,
                    });
                }
            }
        }
    }
    Ok(entries)
}

/// 列出目录下除 SKILL.md 外的资源文件（相对路径）
fn list_resource_files(dir: &Path) -> Vec<String> {
    let mut resources = vec![];
    if let Ok(read) = fs::read_dir(dir) {
        for entry in read.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.to_lowercase() != "skill.md" {
                    resources.push(name);
                }
            }
        }
    }
    resources
}

/// 删除目录及其所有内容（递归）
fn remove_dir_recursive(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    if path.is_dir() {
        if let Ok(read) = fs::read_dir(path) {
            for entry in read.flatten() {
                remove_dir_recursive(&entry.path())?;
            }
        }
        fs::remove_dir(path).map_err(|e| format!("删除目录失败: {}", e))
    } else {
        fs::remove_file(path).map_err(|e| format!("删除文件失败: {}", e))
    }
}

/// 保存一个自定义技能：写入 {skills}/{dir_name}/SKILL.md
#[tauri::command]
pub fn save_custom_skill(app_handle: AppHandle, dir_name: String, content: String) -> Result<String, String> {
    let root = get_skills_dir(&app_handle);
    fs::create_dir_all(&root).map_err(|e| format!("创建技能目录失败: {}", e))?;

    let safe_dir = sanitize_component(&dir_name);
    let skill_dir = root.join(&safe_dir);
    fs::create_dir_all(&skill_dir).map_err(|e| format!("创建技能子目录失败: {}", e))?;

    let path = skill_dir.join("SKILL.md");
    fs::write(&path, content).map_err(|e| format!("保存技能失败: {}", e))?;
    Ok(skill_dir.to_string_lossy().to_string())
}

/// 删除一个自定义技能（删除整个技能目录）
#[tauri::command]
pub fn delete_custom_skill(app_handle: AppHandle, dir_name: String) -> Result<(), String> {
    let root = get_skills_dir(&app_handle);
    let safe_dir = sanitize_component(&dir_name);
    let path = root.join(&safe_dir);
    if !path.exists() {
        return Err(format!("技能不存在: {}", dir_name));
    }
    remove_dir_recursive(&path)
}

/// 获取技能根目录路径（展示给用户）
#[tauri::command]
pub fn get_skills_dir_path(app_handle: AppHandle) -> Result<String, String> {
    let dir = get_skills_dir(&app_handle);
    fs::create_dir_all(&dir).map_err(|e| format!("创建技能目录失败: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

/// 从 zip 字节批量导入技能
/// 完整解压 zip 到 skills 根目录：zip 中每个含 SKILL.md 的子目录成为一个技能目录，
/// 配套资源（js 等）原样保留。返回导入的技能目录名列表。
#[tauri::command]
pub fn import_skill_zip(app_handle: AppHandle, zip_bytes: Vec<u8>) -> Result<Vec<String>, String> {
    use std::io::Read;

    let root = get_skills_dir(&app_handle);
    fs::create_dir_all(&root).map_err(|e| format!("创建技能目录失败: {}", e))?;

    let reader = std::io::Cursor::new(zip_bytes);
    let mut archive = zip::ZipArchive::new(reader)
        .map_err(|e| format!("解析 zip 失败: {}", e))?;

    let mut imported_dirs: Vec<String> = vec![];

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("读取 zip 条目失败: {}", e))?;
        let name = file.name().replace('\\', "/");

        if file.is_dir() || name.is_empty() {
            continue;
        }

        // 技能目录名 = zip 内路径第一段
        let parts: Vec<&str> = name.split('/').filter(|s| !s.is_empty()).collect();
        if parts.is_empty() {
            continue;
        }
        let top_dir = sanitize_component(parts[0]);
        let skill_dir = root.join(&top_dir);

        // 相对文件路径（技能目录内的部分）
        let rel: Vec<&str> = parts[1..].to_vec();

        // 读取内容（二进制，资源文件可能是 js 等）
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes).map_err(|e| format!("读取文件内容失败: {}", e))?;

        let dest = if rel.is_empty() {
            // zip 根目录下的文件（如 SKILL.md 直接在 zip 根）→ 放到技能目录
            skill_dir.join(sanitize_component(parts[parts.len() - 1]))
        } else {
            // 子路径：创建嵌套目录
            let mut cur = skill_dir.clone();
            for (idx, part) in rel.iter().enumerate() {
                cur = cur.join(sanitize_component(part));
                if idx < rel.len() - 1 {
                    fs::create_dir_all(&cur).map_err(|e| format!("创建子目录失败: {}", e))?;
                }
            }
            cur
        };

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
        fs::write(&dest, &bytes).map_err(|e| format!("写入文件失败: {}", e))?;
    }

    // 收集包含 SKILL.md 的技能目录
    if let Ok(read) = fs::read_dir(&root) {
        for entry in read.flatten() {
            let path = entry.path();
            if path.is_dir() && path.join("SKILL.md").is_file() {
                let dir_name = entry.file_name().to_string_lossy().to_string();
                if !imported_dirs.contains(&dir_name) {
                    imported_dirs.push(dir_name);
                }
            }
        }
    }

    if imported_dirs.is_empty() {
        return Err("zip 中没有找到包含 SKILL.md 的技能".to_string());
    }

    Ok(imported_dirs)
}

/// 目录名/文件名安全化：只保留安全字符，防止路径穿越
fn sanitize_component(s: &str) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches('.').to_string();
    if cleaned.is_empty() {
        "skill".to_string()
    } else {
        cleaned
    }
}

/// 导出技能为 zip 字节
/// 把 {skills}/{dir_name}/ 下所有文件（SKILL.md + 配套资源）打包成 zip，
/// 返回 zip 字节（前端写入用户选择的 .zip 文件）。zip 内以技能目录名为根目录。
#[tauri::command]
pub fn export_skill_zip(app_handle: AppHandle, dir_name: String) -> Result<Vec<u8>, String> {
    use std::io::Write;

    let root = get_skills_dir(&app_handle);
    let safe_dir = sanitize_component(&dir_name);
    let skill_dir = root.join(&safe_dir);

    if !skill_dir.is_dir() {
        return Err(format!("技能不存在: {}", dir_name));
    }

    // 用内存 buffer 打包 zip
    let mut buf = Vec::new();
    {
        let cursor = std::io::Cursor::new(&mut buf);
        let mut zip_writer = zip::ZipWriter::new(cursor);
        let options: zip::write::SimpleFileOptions =
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);

        // 递归收集技能目录下的文件，zip 内路径以技能目录名为前缀
        let mut files: Vec<(String, PathBuf)> = vec![];
        collect_files(&skill_dir, &safe_dir, &mut files);

        if files.is_empty() {
            return Err(format!("技能目录为空: {}", dir_name));
        }

        for (zip_path, fs_path) in &files {
            let data = fs::read(fs_path).map_err(|e| format!("读取文件失败: {}", e))?;
            zip_writer
                .start_file(zip_path, options)
                .map_err(|e| format!("创建 zip 条目失败: {}", e))?;
            zip_writer
                .write_all(&data)
                .map_err(|e| format!("写入 zip 失败: {}", e))?;
        }

        zip_writer
            .finish()
            .map_err(|e| format!("完成 zip 打包失败: {}", e))?;
    }

    Ok(buf)
}

/// 递归收集目录下所有文件，(zip 内相对路径, 磁盘路径)
fn collect_files(dir: &Path, zip_prefix: &str, out: &mut Vec<(String, PathBuf)>) {
    if let Ok(read) = fs::read_dir(dir) {
        for entry in read.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            if path.is_dir() {
                let sub = format!("{}/{}", zip_prefix, name);
                collect_files(&path, &sub, out);
            } else if path.is_file() {
                let zip_path = format!("{}/{}", zip_prefix, name);
                out.push((zip_path, path));
            }
        }
    }
}


