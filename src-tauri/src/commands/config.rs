use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use chrono::Local;

/// 应用数据根目录（统一存放 AI 配置 / 技能 / 参考小说 / 项目等所有本地数据）
///
/// macOS 坑：Tauri 默认 app_data_dir = ~/Library/Application Support/{identifier}，
/// 而 identifier = `com.ai-novel-writer.app` 以 `.app` 结尾，导致数据目录也被命名为
/// `com.ai-novel-writer.app`，macOS 会把它误判为应用程序包：
///   - `open <dir>` 报 "executable is missing"
///   - 双击/Gatekeeper 报 "已损坏或不完整"
/// 因此这里统一去掉目录名末尾的 `.app`，使用不以 `.app` 结尾的稳定路径。
pub fn app_data_root(app_handle: &tauri::AppHandle) -> PathBuf {
    let dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if let Some(name) = dir.file_name().and_then(|n| n.to_str()) {
        let lower = name.to_lowercase();
        if lower.ends_with(".app") {
            return dir.with_file_name(&name[..name.len() - 4]);
        }
    }
    dir
}

/// 一次性迁移：把旧数据目录（`xxx.app`，被 macOS 误判为应用包）的内容复制到新目录。
/// 只有所有项都复制成功才删除旧目录；任何一项失败则保留旧目录并打印警告，防止数据丢失。
pub fn migrate_legacy_data_dir(app_handle: &tauri::AppHandle) {
    let legacy = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let new_dir = app_data_root(app_handle);
    if legacy == new_dir || !legacy.exists() {
        return;
    }
    let mut all_ok = true;
    if let Ok(entries) = fs::read_dir(&legacy) {
        for entry in entries.flatten() {
            let target = new_dir.join(entry.file_name());
            if target.exists() {
                continue;
            }
            let src = entry.path();
            let res: Result<(), String> = if src.is_dir() {
                copy_dir_recursive(&src, &target)
            } else {
                fs::copy(&src, &target)
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            };
            if let Err(e) = res {
                all_ok = false;
                eprintln!(
                    "[migrate] 复制失败 {} -> {}: {}",
                    src.display(),
                    target.display(),
                    e
                );
            }
        }
    }
    if all_ok {
        let _ = fs::remove_dir_all(&legacy);
    } else {
        eprintln!(
            "[migrate] 数据迁移不完整，保留旧目录 {} 以防丢失",
            legacy.display()
        );
    }
}

/// 全局配置（存储在 app_data_dir 根目录）
#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub storage_path: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            storage_path: String::new(), // 空 = 使用默认 app_data_dir
        }
    }
}

fn get_config_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_data_root(app_handle)
        .join("app-config.json")
}

fn load_config(app_handle: &tauri::AppHandle) -> AppConfig {
    let path = get_config_path(app_handle);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

fn save_config(app_handle: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = get_config_path(app_handle);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("保存配置失败: {}", e))
}

/// 获取项目存储根目录
pub fn get_projects_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    let config = load_config(app_handle);
    if !config.storage_path.is_empty() {
        let custom = PathBuf::from(&config.storage_path);
        if custom.exists() || custom.parent().map_or(false, |p| p.exists()) {
            return custom;
        }
    }
    // 默认路径
    app_data_root(app_handle).join("projects")
}

// ===== 项目注册表（支持每个项目自定义存储位置） =====

/// 注册表文件路径（记录每个项目实际存放目录）
fn get_registry_path(app_handle: &tauri::AppHandle) -> PathBuf {
    app_data_root(app_handle)
        .join("project-registry.json")
}

type Registry = std::collections::HashMap<String, String>;

pub fn read_registry(app_handle: &tauri::AppHandle) -> Registry {
    let path = get_registry_path(app_handle);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(map) = serde_json::from_str::<Registry>(&content) {
                return map;
            }
        }
    }
    Registry::new()
}

fn write_registry(app_handle: &tauri::AppHandle, registry: &Registry) -> Result<(), String> {
    let path = get_registry_path(app_handle);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(registry)
        .map_err(|e| format!("序列化注册表失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("保存注册表失败: {}", e))
}

/// 注册项目到自定义路径
pub fn register_project(app_handle: &tauri::AppHandle, project_id: &str, dir: &PathBuf) -> Result<(), String> {
    let mut registry = read_registry(app_handle);
    registry.insert(project_id.to_string(), dir.to_string_lossy().to_string());
    write_registry(app_handle, &registry)
}

/// 注销项目（从注册表移除）
pub fn unregister_project(app_handle: &tauri::AppHandle, project_id: &str) -> Result<(), String> {
    let mut registry = read_registry(app_handle);
    registry.remove(project_id);
    write_registry(app_handle, &registry)
}

/// 获取项目实际目录：优先查注册表（自定义路径），否则回退默认目录
pub fn get_project_dir(app_handle: &tauri::AppHandle, project_id: &str) -> PathBuf {
    let registry = read_registry(app_handle);
    if let Some(dir) = registry.get(project_id) {
        let custom = PathBuf::from(dir);
        if custom.exists() {
            return custom;
        }
    }
    get_projects_dir(app_handle).join(project_id)
}

/// 保存 AI 配置到磁盘（app_data_dir/ai-config.json）
/// 相比 WebView localStorage 更可靠，不怕清缓存/换环境丢失
#[tauri::command]
pub fn save_ai_config(app_handle: tauri::AppHandle, config: serde_json::Value) -> Result<(), String> {
    let path = app_data_root(&app_handle)
        .join("ai-config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("保存配置失败: {}", e))?;
    Ok(())
}

/// 加载 AI 配置（从磁盘）
#[tauri::command]
pub fn load_ai_config(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = app_data_root(&app_handle)
        .join("ai-config.json");
    if !path.exists() {
        return Ok(serde_json::Value::Null);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析配置失败: {}", e))
}

// ===== 参考小说分析数据（本地文件存储，专门目录 app_data_dir/reference） =====

/// 参考小说数据存储目录（每个参考小说一个 JSON 文件）
fn get_reference_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_data_root(app_handle).join("reference")
}

// ===== 应用数据目录（统一入口：AI 配置 / 自定义技能 / 参考小说 / 项目都在此） =====

/// 应用数据根目录：{app_data_dir}/
/// 结构：
///   ai-config.json        DeepSeek API Key 等 AI 配置
///   app-config.json       全局配置（存储路径）
///   project-registry.json 项目注册表
///   projects/             小说项目（章节、角色、世界观）
///   skills/               自定义技能
///   reference/            参考小说分析数据
fn get_app_data_dir(app_handle: &tauri::AppHandle) -> PathBuf {
    app_data_root(app_handle)
}

/// 获取应用数据根目录路径（供前端展示"集中管理"位置）
#[tauri::command]
pub fn get_data_dir_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let dir = get_app_data_dir(&app_handle);
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
    Ok(dir.to_string_lossy().to_string())
}

/// 用系统文件管理器打开应用数据根目录（macOS Finder / Windows 资源管理器 / Linux 文件管理器）
///
/// 注意：macOS 下 app_data_dir 目录名以 `.app` 结尾（如 com.ai-novel-writer.app），
/// 直接 `open <dir>` 会被当成应用包启动而失败（"executable is missing"），
/// 必须显式用 `open -a Finder <dir>` 打开。
#[tauri::command]
pub fn open_data_dir(app_handle: tauri::AppHandle) -> Result<(), String> {
    let dir = get_app_data_dir(&app_handle);
    fs::create_dir_all(&dir).map_err(|e| format!("创建数据目录失败: {}", e))?;
    let dir_str = dir.to_string_lossy().to_string();
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open")
        .arg("-a")
        .arg("Finder")
        .arg(&dir_str)
        .status();
    #[cfg(target_os = "windows")]
    let status = std::process::Command::new("explorer").arg(&dir_str).status();
    #[cfg(all(unix, not(target_os = "macos")))]
    let status = std::process::Command::new("xdg-open").arg(&dir_str).status();
    #[cfg(not(any(unix, target_os = "windows")))]
    let status = Err(std::io::Error::new(std::io::ErrorKind::Other, "unsupported platform"));
    match status {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("打开数据目录失败 (退出码 {})", s.code().unwrap_or(-1))),
        Err(e) => Err(format!("打开数据目录失败: {}", e)),
    }
}

/// 参考小说 id → 安全文件名
fn reference_file_name(id: &str) -> String {
    format!("{}.json", id.replace(['/', '\\', ':'], "_"))
}

/// 保存参考小说分析数据到磁盘（reference/{id}.json，按小说 id 分文件）
#[tauri::command]
pub fn save_reference_state(
    app_handle: tauri::AppHandle,
    id: String,
    data: serde_json::Value,
) -> Result<(), String> {
    let dir = get_reference_dir(&app_handle);
    fs::create_dir_all(&dir).map_err(|e| format!("创建参考小说目录失败: {}", e))?;
    let path = dir.join(reference_file_name(&id));
    let json = serde_json::to_string_pretty(&data)
        .map_err(|e| format!("序列化参考小说失败: {}", e))?;
    fs::write(&path, json).map_err(|e| format!("保存参考小说失败: {}", e))?;
    Ok(())
}

/// 读取所有参考小说分析数据（按 savedAt 倒序，最近的在前）
#[tauri::command]
pub fn load_reference_states(app_handle: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let dir = get_reference_dir(&app_handle);
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut states: Vec<serde_json::Value> = vec![];
    for entry in fs::read_dir(&dir).map_err(|e| format!("读取参考小说目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        if entry.path().extension().map_or(false, |ext| ext == "json") {
            if let Ok(content) = fs::read_to_string(entry.path()) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    states.push(v);
                }
            }
        }
    }
    states.sort_by(|a, b| {
        let ta = a["savedAt"].as_i64().unwrap_or(0);
        let tb = b["savedAt"].as_i64().unwrap_or(0);
        tb.cmp(&ta)
    });
    Ok(states)
}

/// 删除一个参考小说的数据文件（用户移除参考小说时调用）
#[tauri::command]
pub fn delete_reference_state(app_handle: tauri::AppHandle, id: String) -> Result<(), String> {
    let path = get_reference_dir(&app_handle).join(reference_file_name(&id));
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("删除参考小说失败: {}", e))?;
    }
    Ok(())
}

/// 获取当前存储路径
#[tauri::command]
pub fn get_storage_path(app_handle: tauri::AppHandle) -> Result<String, String> {
    let config = load_config(&app_handle);
    if config.storage_path.is_empty() {
        // 返回默认路径
        Ok(get_projects_dir(&app_handle).to_string_lossy().to_string())
    } else {
        Ok(config.storage_path)
    }
}

/// 设置存储路径
#[tauri::command]
pub fn set_storage_path(app_handle: tauri::AppHandle, new_path: String) -> Result<(), String> {
    let path = PathBuf::from(&new_path);
    // 确保目录存在
    fs::create_dir_all(&path).map_err(|e| format!("创建目录失败: {}", e))?;
    
    let mut config = load_config(&app_handle);
    config.storage_path = new_path;
    save_config(&app_handle, &config)
}

/// 迁移项目：从旧路径复制到新路径
#[tauri::command]
pub fn migrate_projects(app_handle: tauri::AppHandle, from_path: String, to_path: String) -> Result<(), String> {
    let from = PathBuf::from(&from_path);
    let to = PathBuf::from(&to_path);

    if !from.exists() {
        return Err("源路径不存在".to_string());
    }

    // 确保目标目录存在
    fs::create_dir_all(&to).map_err(|e| format!("创建目标目录失败: {}", e))?;

    // 递归复制所有项目
    let entries = fs::read_dir(&from)
        .map_err(|e| format!("读取源目录失败: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let file_name = entry.file_name();
        let src = entry.path();
        let dst = to.join(&file_name);

        if src.is_dir() {
            // 只复制项目目录（有 config.json 的才算）
            if src.join("config.json").exists() {
                copy_dir_recursive(&src, &dst)?;
                // 同步注册表：迁移后项目位置变了，重新注册
                if let Ok(content) = fs::read_to_string(&dst.join("config.json")) {
                    if let Ok(proj) = serde_json::from_str::<crate::models::NovelProject>(&content) {
                        let _ = register_project(&app_handle, &proj.id, &dst);
                    }
                }
            }
        }
    }

    // 更新配置为新路径
    let mut config = load_config(&app_handle);
    config.storage_path = to_path;
    save_config(&app_handle, &config)
}

/// 备份项目：将项目目录复制到备份目录（添加时间戳）
#[tauri::command]
pub fn backup_project(app_handle: tauri::AppHandle, project_id: String) -> Result<String, String> {
    let projects_dir = get_projects_dir(&app_handle);
    let project_dir = get_project_dir(&app_handle, &project_id);
    
    if !project_dir.exists() {
        return Err("项目不存在".to_string());
    }

    // 读取项目名
    let config_path = project_dir.join("config.json");
    let project_name = if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(proj) = serde_json::from_str::<crate::models::NovelProject>(&content) {
                proj.name
            } else { "unknown".to_string() }
        } else { "unknown".to_string() }
    } else { "unknown".to_string() };

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let safe_name = project_name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let backup_name = format!("{}_{}_{}", safe_name, timestamp, project_id);

    // 备份目录：在项目目录同级创建 backups 文件夹
    let backup_root = projects_dir.join("__backups__");
    let backup_dir = backup_root.join(&backup_name);

    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("创建备份目录失败: {}", e))?;

    copy_dir_recursive(&project_dir, &backup_dir)?;

    Ok(backup_name)
}

/// 列出某项目的所有备份（按 project_id 过滤，避免跨小说共享备份）
#[tauri::command]
pub fn list_backups(app_handle: tauri::AppHandle, project_id: String) -> Result<Vec<String>, String> {
    let backup_root = get_projects_dir(&app_handle).join("__backups__");
    if !backup_root.exists() {
        return Ok(vec![]);
    }

    // 备份命名格式：{safe_name}_{timestamp}_{project_id}，按后缀过滤
    let suffix = format!("_{}", project_id);
    let mut backups: Vec<String> = fs::read_dir(&backup_root)
        .map_err(|e| format!("读取备份目录失败: {}", e))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|name| name.ends_with(&suffix))
        .collect();

    backups.sort_by(|a, b| b.cmp(a)); // 最新在前
    Ok(backups)
}

/// 从备份恢复
#[tauri::command]
pub fn restore_backup(app_handle: tauri::AppHandle, backup_name: String, project_id: String) -> Result<(), String> {
    // 校验备份属于当前项目，防止误恢复其他小说
    if !backup_name.ends_with(&format!("_{}", project_id)) {
        return Err("该备份不属于当前项目，无法恢复".to_string());
    }

    let backup_root = get_projects_dir(&app_handle).join("__backups__");
    let backup_dir = backup_root.join(&backup_name);
    
    if !backup_dir.exists() {
        return Err("备份不存在".to_string());
    }

    let project_dir = get_project_dir(&app_handle, &project_id);

    // 先删除当前项目
    if project_dir.exists() {
        fs::remove_dir_all(&project_dir)
            .map_err(|e| format!("删除当前项目失败: {}", e))?;
    }

    // 从备份复制回来
    copy_dir_recursive(&backup_dir, &project_dir)?;

    Ok(())
}

/// 删除备份（校验归属）
#[tauri::command]
pub fn delete_backup(app_handle: tauri::AppHandle, backup_name: String, project_id: String) -> Result<(), String> {
    if !backup_name.ends_with(&format!("_{}", project_id)) {
        return Err("该备份不属于当前项目，无法删除".to_string());
    }
    let backup_dir = get_projects_dir(&app_handle).join("__backups__").join(&backup_name);
    if !backup_dir.exists() {
        return Err("备份不存在".to_string());
    }
    fs::remove_dir_all(&backup_dir)
        .map_err(|e| format!("删除备份失败: {}", e))?;
    Ok(())
}

pub fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;

    let entries = fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let file_type = entry.file_type().map_err(|e| format!("读取文件类型失败: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败: {}", e))?;
        }
    }
    Ok(())
}
