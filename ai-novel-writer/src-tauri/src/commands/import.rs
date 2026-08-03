use std::fs;
use serde::{Deserialize, Serialize};
use chrono::Local;

/// 导入的参考小说
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedNovel {
    pub id: String,
    pub file_name: String,
    pub title: String,
    pub total_words: usize,
    pub total_chapters: usize,
    pub imported_at: String,
    pub chapters: Vec<ImportedChapter>,
}

/// 导入的章节
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedChapter {
    pub index: usize,
    pub title: String,
    pub content: String,
    pub word_count: usize,
}

/// 判断一行是否是章节标题
fn is_chapter_header(line: &str) -> bool {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.len() > 60 {
        return false;
    }

    // 第X章 / 第X节 / 第X回 / 第X卷
    if trimmed.starts_with("第") && (trimmed.contains('章') || trimmed.contains('节')
        || trimmed.contains('回') || trimmed.contains('卷') || trimmed.contains('部'))
    {
        return true;
    }

    // Chapter X / CHAPTER X
    let upper = trimmed.to_uppercase();
    if upper.starts_with("CHAPTER ") || upper.starts_with("CHAP.") {
        return true;
    }

    // Vol.X / Part X
    if upper.starts_with("VOL.") || upper.starts_with("VOLUME ") || upper.starts_with("PART ") {
        return true;
    }

    // 【第一章】 等中文括号
    if trimmed.starts_with('【') && (trimmed.contains('章') || trimmed.contains('节') || trimmed.contains('回')) {
        return true;
    }

    // 数字序号标题：001、一、二等
    if trimmed.chars().all(|c| c.is_numeric() || c == '.' || c == ' ') && trimmed.len() <= 10 {
        return true;
    }

    false
}

/// 从文件路径读取并分章
#[tauri::command]
pub fn import_novel_file(file_path: String) -> Result<ImportedNovel, String> {
    let content = fs::read_to_string(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    let file_name = std::path::Path::new(&file_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "未知".to_string());

    let chapters = split_into_chapters(&content);

    let total_words = content.chars().count();
    let total_chapters = chapters.len();

    let id = uuid::Uuid::new_v4().to_string();
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let title = file_name
        .rsplit_once('.')
        .map(|(name, _)| name.to_string())
        .unwrap_or_else(|| file_name.clone());

    Ok(ImportedNovel {
        id,
        file_name,
        title,
        total_words,
        total_chapters,
        imported_at: now,
        chapters,
    })
}

/// 通用分章逻辑
fn split_into_chapters(content: &str) -> Vec<ImportedChapter> {
    let lines: Vec<&str> = content.lines().collect();
    let mut chapters: Vec<ImportedChapter> = vec![];
    let mut current_lines: Vec<String> = vec![];
    let mut current_title = "前言".to_string();
    let mut chapter_index = 0usize;

    for line in lines {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            current_lines.push(line.to_string());
            continue;
        }

        if is_chapter_header(trimmed) && !current_lines.is_empty() {
            let chapter_content = current_lines.join("\n");
            if !chapter_content.trim().is_empty() {
                let wc = chapter_content.chars().count();
                chapters.push(ImportedChapter {
                    index: chapter_index,
                    title: current_title.clone(),
                    content: chapter_content,
                    word_count: wc,
                });
                chapter_index += 1;
            }
            current_title = trimmed.to_string();
            current_lines.clear();
        }

        current_lines.push(line.to_string());
    }

    // 最后一章
    if !current_lines.is_empty() {
        let chapter_content = current_lines.join("\n");
        if !chapter_content.trim().is_empty() {
            let wc = chapter_content.chars().count();
            chapters.push(ImportedChapter {
                index: chapter_index,
                title: current_title,
                content: chapter_content,
                word_count: wc,
            });
        }
    }

    // 无分章时整本作为一章
    if chapters.is_empty() && !content.trim().is_empty() {
        chapters.push(ImportedChapter {
            index: 0,
            title: "全文".to_string(),
            content: content.to_string(),
            word_count: content.chars().count(),
        });
    }

    chapters
}
