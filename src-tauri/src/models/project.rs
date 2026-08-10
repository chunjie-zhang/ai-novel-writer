use serde::{Deserialize, Serialize};

/// 小说项目结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NovelProject {
    pub id: String,
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub updated_at: String,
    pub description: String,
    pub config: ProjectConfig,
    /// 作者笔名（可选，兼容旧数据）
    #[serde(default)]
    pub author: String,
    /// 题材（可选）
    #[serde(default)]
    pub genre: String,
    /// 连载状态（可选）
    #[serde(default)]
    pub status: String,
    /// 标签（逗号分隔，可选）
    #[serde(default)]
    pub tags: String,
    /// 封面路径（可选）
    #[serde(default)]
    pub cover: String,
}

/// 项目配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub model_provider: String,       // "builtin"(DeepSeek官方) | "custom"
    pub api_key: String,
    pub base_url: String,
    pub model_name: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub context_limit: u32,
}

impl Default for ProjectConfig {
    fn default() -> Self {
        Self {
            model_provider: "builtin".to_string(),
            api_key: String::new(),              // 用户需要自行填写
            base_url: "https://api.deepseek.com".to_string(),
            model_name: "deepseek-chat".to_string(),
            temperature: 0.8,
            max_tokens: 4096,
            context_limit: 10,
        }
    }
}

/// 章节信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterInfo {
    pub id: String,
    pub title: String,
    pub file_name: String,
    /// 章节分组（相对 chapters/ 的子目录名，空字符串表示根目录）
    #[serde(default)]
    pub group: String,
    pub order: u32,
    pub word_count: u32,
    pub created_at: String,
    pub updated_at: String,
}

/// 角色设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub gender: String,
    pub age: String,
    pub personality: String,
    pub appearance: String,
    pub background: String,
    pub relationships: String,
    pub speech_pattern: String,
    pub notes: String,
}

/// AI 记忆摘要
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemorySummary {
    pub chapter_id: String,
    pub chapter_title: String,
    pub chapter_order: u32,
    pub summary: String,
    pub key_events: Vec<String>,
    pub created_at: String,
}

/// 世界观设定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorldSetting {
    pub content: String,
    pub factions: Vec<Faction>,
    pub rules: Vec<String>,
    pub geography: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Faction {
    pub name: String,
    pub description: String,
    pub members: Vec<String>,
}

/// 项目目录结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectStructure {
    pub project: NovelProject,
    pub chapters: Vec<ChapterInfo>,
    /// 已创建的卷分组目录名（含空卷，用于左侧展示空卷）
    pub groups: Vec<String>,
    pub characters: Vec<Character>,
    pub world_setting: WorldSetting,
    pub memories: Vec<MemorySummary>,
}

/// AI 对话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,      // "system" | "user" | "assistant"
    pub content: String,
}

/// AI 请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AIRequest {
    pub messages: Vec<ChatMessage>,
    pub model: String,
    pub temperature: f32,
    pub max_tokens: u32,
    pub stream: bool,
}

/// AI 响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub content: String,
    pub finish_reason: String,
}
