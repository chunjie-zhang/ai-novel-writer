use std::fs;
use uuid::Uuid;
use chrono::Local;

use crate::models::*;
use crate::commands::config;

/// 将小说名转为安全的文件夹名（保留中文，过滤非法字符）
fn sanitize_folder_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| {
            !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0')
                && !c.is_control()
        })
        .map(|c| if c == ' ' { '_' } else { c })
        .collect();
    let trimmed = cleaned.trim_matches('.').trim().to_string();
    if trimmed.is_empty() {
        "untitled".to_string()
    } else {
        trimmed
    }
}

/// 创建新小说项目
/// 文件夹用小说名称命名（重名时自动加 _2、_3 序号）
/// target_dir 可选：指定项目存放目录（否则使用默认存储位置）
#[tauri::command]
pub fn create_project(
    app_handle: tauri::AppHandle,
    name: String,
    description: String,
    target_dir: Option<String>,
) -> Result<NovelProject, String> {
    let id = Uuid::new_v4().to_string();

    // 确定父目录（默认或自定义）
    let parent_dir = if let Some(dir) = target_dir {
        if dir.trim().is_empty() {
            config::get_projects_dir(&app_handle)
        } else {
            let custom = std::path::PathBuf::from(&dir);
            fs::create_dir_all(&custom)
                .map_err(|e| format!("创建自定义目录失败: {}", e))?;
            custom
        }
    } else {
        config::get_projects_dir(&app_handle)
    };

    // 用小说名生成文件夹名，重名则追加序号
    let base_name = sanitize_folder_name(&name);
    let mut folder_name = base_name.clone();
    let mut counter = 2;
    let mut project_dir = parent_dir.join(&folder_name);
    while project_dir.exists() {
        folder_name = format!("{}_{}", base_name, counter);
        project_dir = parent_dir.join(&folder_name);
        counter += 1;
    }

    // 始终记录到注册表（自定义路径 + 名称文件夹都需要）
    config::register_project(&app_handle, &id, &project_dir)?;

    // 创建目录结构
    fs::create_dir_all(project_dir.join("chapters"))
        .map_err(|e| format!("创建项目目录失败: {}", e))?;

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let project = NovelProject {
        id: id.clone(),
        name,
        path: project_dir.to_string_lossy().to_string(),
        created_at: now.clone(),
        updated_at: now.clone(),
        description,
        config: ProjectConfig::default(),
        author: String::new(),
        genre: String::new(),
        status: "ongoing".to_string(),
        tags: String::new(),
        cover: String::new(),
    };

    // 保存项目配置文件
    let config_path = project_dir.join("config.json");
    let config_json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("序列化项目配置失败: {}", e))?;
    fs::write(config_path, config_json)
        .map_err(|e| format!("保存项目配置失败: {}", e))?;

    // 初始化空的世界观文件
    let world = WorldSetting {
        content: String::new(),
        factions: vec![],
        rules: vec![],
        geography: String::new(),
    };
    let world_path = project_dir.join("world.json");
    let world_json = serde_json::to_string_pretty(&world)
        .map_err(|e| format!("序列化世界观失败: {}", e))?;
    fs::write(world_path, world_json)
        .map_err(|e| format!("保存世界观失败: {}", e))?;

    // 初始化空的角色文件
    let characters: Vec<Character> = vec![];
    let char_path = project_dir.join("characters.json");
    let char_json = serde_json::to_string_pretty(&characters)
        .map_err(|e| format!("序列化角色失败: {}", e))?;
    fs::write(char_path, char_json)
        .map_err(|e| format!("保存角色失败: {}", e))?;

    // 初始化空的记忆库
    let memories: Vec<MemorySummary> = vec![];
    let mem_path = project_dir.join("memories.json");
    let mem_json = serde_json::to_string_pretty(&memories)
        .map_err(|e| format!("序列化记忆库失败: {}", e))?;
    fs::write(mem_path, mem_json)
        .map_err(|e| format!("保存记忆库失败: {}", e))?;

    Ok(project)
}

/// 获取所有项目列表（默认目录 + 注册表中的自定义路径）
#[tauri::command]
pub fn list_projects(app_handle: tauri::AppHandle) -> Result<Vec<NovelProject>, String> {
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut projects = vec![];

    // 1. 扫描默认目录
    let projects_dir = config::get_projects_dir(&app_handle);
    if projects_dir.exists() {
        if let Ok(entries) = fs::read_dir(&projects_dir) {
            for entry in entries.flatten() {
                let config_path = entry.path().join("config.json");
                if config_path.exists() {
                    if let Ok(content) = fs::read_to_string(&config_path) {
                        if let Ok(project) = serde_json::from_str::<NovelProject>(&content) {
                            seen.insert(project.id.clone());
                            projects.push(project);
                        }
                    }
                }
            }
        }
    }

    // 2. 扫描注册表中的自定义路径
    let registry = crate::commands::config::read_registry(&app_handle);
    for dir in registry.values() {
        let config_path = std::path::PathBuf::from(dir).join("config.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(project) = serde_json::from_str::<NovelProject>(&content) {
                    if !seen.contains(&project.id) {
                        seen.insert(project.id.clone());
                        projects.push(project);
                    }
                }
            }
        }
    }

    // 按更新时间排序
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

/// 递归收集章节目录下的所有 .md 章节（支持子文件夹分组）
/// group 为相对 chapters/ 的子目录路径，空表示根目录
fn collect_chapters(dir: &std::path::Path, group: &str, chapters: &mut Vec<ChapterInfo>) -> Result<(), String> {
    let mut entries: Vec<_> = fs::read_dir(dir)
        .map_err(|e| format!("读取章节目录失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取章节目录失败: {}", e))?;
    // 按文件名排序（"第1章.md" < "第2章.md" < ...），保证 order 与展示顺序稳定一致
    entries.sort_by(|a, b| {
        let na = a.file_name().to_string_lossy().to_string();
        let nb = b.file_name().to_string_lossy().to_string();
        na.cmp(&nb)
    });
    for entry in entries {
        let path = entry.path();
        if path.is_dir() {
            let sub = entry.file_name().to_string_lossy().to_string();
            let sub_group = if group.is_empty() {
                sub
            } else {
                format!("{}/{}", group, sub)
            };
            collect_chapters(&path, &sub_group, chapters)?;
        } else if path.extension().map_or(false, |ext| ext == "md") {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let rel = if group.is_empty() {
                file_name.clone()
            } else {
                format!("{}/{}", group, file_name)
            };
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("读取章节文件失败: {}", e))?;
            chapters.push(ChapterInfo {
                id: rel.replace(".md", ""),
                title: file_name.replace(".md", ""),
                file_name: rel,
                group: group.to_string(),
                order: chapters.len() as u32 + 1,
                // 字数按字符数统计（中文一字=一字符；content.len() 是 UTF-8 字节数，会偏大 3 倍）
                word_count: content.chars().count() as u32,
                created_at: "".to_string(),
                updated_at: "".to_string(),
            });
        }
    }
    Ok(())
}

/// 获取项目完整结构
#[tauri::command]
pub fn get_project_structure(app_handle: tauri::AppHandle, project_id: String) -> Result<ProjectStructure, String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    if !project_dir.exists() {
        return Err("项目不存在".to_string());
    }

    let config_path = project_dir.join("config.json");
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    let project: NovelProject = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;

    // 读取章节列表（递归扫描，支持子文件夹分组）
    let chapters_dir = project_dir.join("chapters");
    let mut chapters = vec![];
    let mut groups: Vec<String> = vec![];
    if chapters_dir.exists() {
        collect_chapters(&chapters_dir, "", &mut chapters)?;
        // 收集已创建的卷分组目录（含空目录，供左侧展示空卷）
        if let Ok(entries) = fs::read_dir(&chapters_dir) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    groups.push(entry.file_name().to_string_lossy().to_string());
                }
            }
        }
        groups.sort();
    }

    // 读取角色
    let char_path = project_dir.join("characters.json");
    let characters: Vec<Character> = if char_path.exists() {
        let char_content = fs::read_to_string(&char_path)
            .map_err(|e| format!("读取角色文件失败: {}", e))?;
        serde_json::from_str(&char_content)
            .map_err(|e| format!("解析角色文件失败: {}", e))?
    } else {
        vec![]
    };

    // 读取世界观
    let world_path = project_dir.join("world.json");
    let world_setting: WorldSetting = if world_path.exists() {
        let world_content = fs::read_to_string(&world_path)
            .map_err(|e| format!("读取世界观文件失败: {}", e))?;
        serde_json::from_str(&world_content)
            .map_err(|e| format!("解析世界观文件失败: {}", e))?
    } else {
        WorldSetting {
            content: String::new(),
            factions: vec![],
            rules: vec![],
            geography: String::new(),
        }
    };

    // 读取记忆库
    let mem_path = project_dir.join("memories.json");
    let memories: Vec<MemorySummary> = if mem_path.exists() {
        let mem_content = fs::read_to_string(&mem_path)
            .map_err(|e| format!("读取记忆库文件失败: {}", e))?;
        serde_json::from_str(&mem_content)
            .map_err(|e| format!("解析记忆库文件失败: {}", e))?
    } else {
        vec![]
    };

    Ok(ProjectStructure {
        project,
        chapters,
        groups,
        characters,
        world_setting,
        memories,
    })
}

/// 保存角色
#[tauri::command]
pub fn save_character(app_handle: tauri::AppHandle, project_id: String, character: crate::models::Character) -> Result<(), String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    let char_path = project_dir.join("characters.json");

    let mut characters: Vec<crate::models::Character> = if char_path.exists() {
        let content = fs::read_to_string(&char_path)
            .map_err(|e| format!("读取角色文件失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析角色文件失败: {}", e))?
    } else {
        vec![]
    };

    // 更新或新增
    if let Some(existing) = characters.iter_mut().find(|c| c.id == character.id) {
        *existing = character;
    } else {
        characters.push(character);
    }

    let json = serde_json::to_string_pretty(&characters)
        .map_err(|e| format!("序列化角色失败: {}", e))?;
    fs::write(&char_path, json)
        .map_err(|e| format!("保存角色文件失败: {}", e))?;

    Ok(())
}

/// 删除角色
#[tauri::command]
pub fn delete_character(app_handle: tauri::AppHandle, project_id: String, character_id: String) -> Result<(), String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    let char_path = project_dir.join("characters.json");

    if !char_path.exists() {
        return Err("角色文件不存在".to_string());
    }

    let content = fs::read_to_string(&char_path)
        .map_err(|e| format!("读取角色文件失败: {}", e))?;
    let mut characters: Vec<crate::models::Character> = serde_json::from_str(&content)
        .map_err(|e| format!("解析角色文件失败: {}", e))?;

    characters.retain(|c| c.id != character_id);

    let json = serde_json::to_string_pretty(&characters)
        .map_err(|e| format!("序列化角色失败: {}", e))?;
    fs::write(&char_path, json)
        .map_err(|e| format!("保存角色文件失败: {}", e))?;

    Ok(())
}

/// 保存世界观
#[tauri::command]
pub fn save_world(app_handle: tauri::AppHandle, project_id: String, world_setting: crate::models::WorldSetting) -> Result<(), String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    let world_path = project_dir.join("world.json");

    let json = serde_json::to_string_pretty(&world_setting)
        .map_err(|e| format!("序列化世界观失败: {}", e))?;
    fs::write(&world_path, json)
        .map_err(|e| format!("保存世界观失败: {}", e))?;

    Ok(())
}

/// 迁移已创建项目到新位置
/// 将项目文件夹移动到 target_dir 下，并更新注册表
#[tauri::command]
pub fn move_project(app_handle: tauri::AppHandle, project_id: String, target_dir: String) -> Result<(), String> {
    if target_dir.trim().is_empty() {
        return Err("目标目录为空".to_string());
    }

    let target = std::path::PathBuf::from(&target_dir);
    // 创建目标目录
    fs::create_dir_all(&target)
        .map_err(|e| format!("创建目标目录失败: {}", e))?;

    let current_dir = config::get_project_dir(&app_handle, &project_id);
    if !current_dir.exists() {
        return Err("项目不存在".to_string());
    }

    let new_dir = target.join(&project_id);
    if new_dir.exists() {
        return Err("目标位置已存在同名项目".to_string());
    }

    // 优先使用 rename（同磁盘快速移动）
    let moved = fs::rename(&current_dir, &new_dir);
    if let Err(e) = moved {
        // 跨磁盘时 rename 会失败，回退到复制+删除
        config::copy_dir_recursive(&current_dir, &new_dir)?;
        fs::remove_dir_all(&current_dir)
            .map_err(|e| format!("清理原目录失败: {}", e))?;
        // 忽略原始错误（跨设备移动场景）
        let _ = e;
    }

    // 更新注册表
    config::register_project(&app_handle, &project_id, &new_dir)?;

    Ok(())
}

/// 读取项目（从注册表/默认目录定位）
fn load_project(app_handle: &tauri::AppHandle, project_id: &str) -> Result<(crate::models::NovelProject, std::path::PathBuf), String> {
    let project_dir = config::get_project_dir(app_handle, project_id);
    let config_path = project_dir.join("config.json");
    if !config_path.exists() {
        return Err("项目不存在".to_string());
    }
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("读取配置文件失败: {}", e))?;
    let project: crate::models::NovelProject = serde_json::from_str(&content)
        .map_err(|e| format!("解析配置文件失败: {}", e))?;
    Ok((project, project_dir))
}

fn write_project(app_handle: &tauri::AppHandle, project: &crate::models::NovelProject, project_dir: &std::path::PathBuf) -> Result<(), String> {
    let json = serde_json::to_string_pretty(project)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(project_dir.join("config.json"), json)
        .map_err(|e| format!("保存配置失败: {}", e))?;
    // 保持注册表路径一致
    config::register_project(app_handle, &project.id, project_dir)
}

/// 重命名小说项目
/// 同时更新 config.json 中的名称；若文件夹是名称命名，则同步重命名文件夹
#[tauri::command]
pub fn rename_project(app_handle: tauri::AppHandle, project_id: String, new_name: String) -> Result<(), String> {
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err("名称不能为空".to_string());
    }

    let (mut project, project_dir) = load_project(&app_handle, &project_id)?;
    if project.name == new_name {
        return Ok(());
    }

    // 尝试重命名文件夹（若文件夹名与旧名称相关）
    let old_folder = project_dir.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
    let old_sanitized = sanitize_folder_name(&project.name);
    let is_name_folder = old_folder == old_sanitized
        || old_folder.starts_with(&format!("{}_", old_sanitized));

    let mut final_dir = project_dir.clone();
    if is_name_folder {
        let parent = project_dir.parent().map(|p| p.to_path_buf()).unwrap_or_default();
        let base_name = sanitize_folder_name(&new_name);
        let mut folder_name = base_name.clone();
        let mut counter = 2;
        let mut new_dir = parent.join(&folder_name);
        while new_dir.exists() {
            folder_name = format!("{}_{}", base_name, counter);
            new_dir = parent.join(&folder_name);
            counter += 1;
        }
        fs::rename(&project_dir, &new_dir)
            .map_err(|e| format!("重命名文件夹失败: {}", e))?;
        final_dir = new_dir;
    }

    project.name = new_name;
    project.path = final_dir.to_string_lossy().to_string();
    project.updated_at = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    write_project(&app_handle, &project, &final_dir)?;

    Ok(())
}

/// 更新小说基本信息（名称、作者、题材、状态、简介、标签、封面）
/// 名称变更时会同步重命名文件夹
#[tauri::command]
pub fn update_project_info(
    app_handle: tauri::AppHandle,
    project_id: String,
    name: String,
    author: String,
    genre: String,
    status: String,
    description: String,
    tags: String,
    cover: String,
) -> Result<(), String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("名称不能为空".to_string());
    }

    let (mut project, project_dir) = load_project(&app_handle, &project_id)?;
    let name_changed = project.name != name;

    // 若名称变化，同步重命名文件夹
    let mut final_dir = project_dir.clone();
    if name_changed {
        let old_folder = project_dir.file_name().map(|f| f.to_string_lossy().to_string()).unwrap_or_default();
        let old_sanitized = sanitize_folder_name(&project.name);
        let is_name_folder = old_folder == old_sanitized
            || old_folder.starts_with(&format!("{}_", old_sanitized));
        if is_name_folder {
            let parent = project_dir.parent().map(|p| p.to_path_buf()).unwrap_or_default();
            let base_name = sanitize_folder_name(&name);
            let mut folder_name = base_name.clone();
            let mut counter = 2;
            let mut new_dir = parent.join(&folder_name);
            while new_dir.exists() {
                folder_name = format!("{}_{}", base_name, counter);
                new_dir = parent.join(&folder_name);
                counter += 1;
            }
            fs::rename(&project_dir, &new_dir)
                .map_err(|e| format!("重命名文件夹失败: {}", e))?;
            final_dir = new_dir;
        }
    }

    project.name = name;
    project.author = author;
    project.genre = genre;
    project.status = status;
    project.description = description;
    project.tags = tags;
    project.cover = cover;
    project.path = final_dir.to_string_lossy().to_string();
    project.updated_at = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    write_project(&app_handle, &project, &final_dir)?;

    Ok(())
}

/// 删除项目
#[tauri::command]
pub fn delete_project(app_handle: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let project_dir = config::get_project_dir(&app_handle, &project_id);
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir)
            .map_err(|e| format!("删除项目失败: {}", e))?;
        // 清理注册表
        let _ = config::unregister_project(&app_handle, &project_id);
    }
    Ok(())
}
