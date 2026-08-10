use std::fs;
use chrono::Local;

use crate::commands::config;

/// 安全化章节分组名：只保留安全字符，并过滤目录穿越（.. / . / 空段）
fn sanitize_group(group: &str) -> String {
    let cleaned: String = group
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_' | '/'))
        .collect();
    cleaned
        .split('/')
        .filter(|seg| !seg.is_empty() && *seg != "." && *seg != "..")
        .collect::<Vec<_>>()
        .join("/")
}

/// 递归收集目录下所有 .md 文件（支持子文件夹分组）
fn collect_md_files(dir: &std::path::Path, out: &mut Vec<std::path::PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("读取章节目录失败: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();
        if path.is_dir() {
            collect_md_files(&path, out)?;
        } else if path.extension().map_or(false, |ext| ext == "md") {
            out.push(path);
        }
    }
    Ok(())
}

/// 批量获取所有章节内容（用于导出整书）
#[tauri::command]
pub fn export_book(app_handle: tauri::AppHandle, project_id: String, format: String) -> Result<String, String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    let chapters_dir = project_dir.join("chapters");
    
    if !chapters_dir.exists() {
        return Err("章节目录不存在".to_string());
    }

    // 读取项目配置获取名称
    let config_path = project_dir.join("config.json");
    let project_name = if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(proj) = serde_json::from_str::<crate::models::NovelProject>(&content) {
                proj.name
            } else { "未命名作品".to_string() }
        } else { "未命名作品".to_string() }
    } else { "未命名作品".to_string() };

    let mut entries: Vec<std::path::PathBuf> = vec![];
    collect_md_files(&chapters_dir, &mut entries)?;
    entries.sort();

    let mut output = String::new();
    
    if format == "md" {
        output.push_str(&format!("# {}\n\n", project_name));
    } else {
        output.push_str(&format!("{}\n\n", project_name));
        output.push_str(&format!("{}\n\n", "=".repeat(project_name.chars().count())));
    }

    for (_i, entry) in entries.iter().enumerate() {
        let rel = entry.strip_prefix(&chapters_dir)
            .unwrap_or(entry)
            .to_string_lossy()
            .to_string();
        let title = rel.replace(".md", "");
        let content = fs::read_to_string(entry)
            .map_err(|e| format!("读取章节 {} 失败: {}", title, e))?;

        if format == "md" {
            output.push_str(&format!("## {}\n\n", title));
        } else {
            output.push_str(&format!("{}\n", title));
            output.push_str(&format!("{}\n", "-".repeat(title.chars().count())));
            output.push('\n');
        }
        
        output.push_str(&content);
        output.push('\n');
        output.push('\n');
    }

    Ok(output)
}

/// 保存章节内容
/// group 可选：章节所在分组（相对 chapters/ 的子目录名，空则保存到根目录）
/// 返回写入的章节相对路径（如 "第1章.md" 或 "第一卷/第1章.md"）
#[tauri::command]
pub fn save_chapter(app_handle: tauri::AppHandle, project_id: String, chapter_title: String, content: String, group: String) -> Result<String, String> {
    let chapters_base = config::get_project_dir(&app_handle, &project_id).join("chapters");
    let safe_group = sanitize_group(&group);
    let chapter_dir = if safe_group.is_empty() {
        chapters_base.clone()
    } else {
        chapters_base.join(&safe_group)
    };

    // 确保目录存在
    fs::create_dir_all(&chapter_dir)
        .map_err(|e| format!("创建章节目录失败: {}", e))?;

    // 文件名：标题.md (清理非法字符)
    let safe_name = chapter_title
        .replace(|c: char| !c.is_alphanumeric() && c != ' ' && c != '-' && c != '_', "")
        .trim()
        .to_string();
    let file_name = if safe_name.is_empty() {
        format!("chapter_{}.md", chrono::Utc::now().timestamp())
    } else {
        format!("{}.md", safe_name)
    };
    let file_path = chapter_dir.join(&file_name);

    fs::write(&file_path, &content)
        .map_err(|e| format!("保存章节失败: {}", e))?;

    // 返回相对路径（用于前端精确定位该章节）
    let rel = if safe_group.is_empty() {
        file_name.clone()
    } else {
        format!("{}/{}", safe_group, file_name)
    };

    // 更新项目 config.json 的 updated_at
    let config_path = config::get_project_dir(&app_handle, &project_id).join("config.json");
    if config_path.exists() {
        if let Ok(config_content) = fs::read_to_string(&config_path) {
            if let Ok(mut project) = serde_json::from_str::<crate::models::NovelProject>(&config_content) {
                project.updated_at = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                if let Ok(json) = serde_json::to_string_pretty(&project) {
                    let _ = fs::write(&config_path, json);
                }
            }
        }
    }

    Ok(rel)
}

/// 读取章节内容
#[tauri::command]
pub fn read_chapter(app_handle: tauri::AppHandle, project_id: String, file_name: String) -> Result<String, String> {
    let file_path = config::get_project_dir(&app_handle, &project_id)
        .join("chapters")
        .join(&file_name);

    fs::read_to_string(&file_path)
        .map_err(|e| format!("读取章节失败: {}", e))
}

/// 删除章节
#[tauri::command]
pub fn delete_chapter(app_handle: tauri::AppHandle, project_id: String, file_name: String) -> Result<(), String> {
    let file_path = config::get_project_dir(&app_handle, &project_id)
        .join("chapters")
        .join(&file_name);

    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("删除章节失败: {}", e))?;
    }
    Ok(())
}

/// 重命名章节
#[tauri::command]
pub fn rename_chapter(app_handle: tauri::AppHandle, project_id: String, old_name: String, new_name: String) -> Result<(), String> {
    let base = config::get_project_dir(&app_handle, &project_id).join("chapters");
    let old_path = base.join(&old_name);
    let new_path = base.join(&new_name);

    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("重命名章节失败: {}", e))
}
