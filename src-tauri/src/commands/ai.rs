use crate::models::*;
use crate::commands::config;
use reqwest::Client;
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use futures_util::StreamExt;
use tauri::ipc::Channel;

/// 全局取消标志：call_ai_stream 运行时检查，前端调用 cancel_ai_stream 置为 true 以中断输出
static AI_CANCEL: AtomicBool = AtomicBool::new(false);

/// 取消当前流式生成（前端点击「停止」时调用）
#[tauri::command]
pub fn cancel_ai_stream() {
    AI_CANCEL.store(true, Ordering::SeqCst);
}

/// 流式输出块
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamChunk {
    pub delta: String,
    pub done: bool,
}

/// 调用 AI 模型（流式，SSE 逐块通过 Channel 推送到前端）
#[tauri::command]
pub async fn call_ai_stream(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
    on_event: Channel<StreamChunk>,
) -> Result<(), String> {
    // 重置取消标志
    AI_CANCEL.store(false, Ordering::SeqCst);

    let client = Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let request_body = json!({
        "model": model,
        "messages": messages.iter().map(|m| json!({
            "role": m.role,
            "content": m.content
        })).collect::<Vec<_>>(),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": true
    });

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求 AI 接口失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("AI 接口返回错误 ({}): {}", status, error_body));
    }

    // 逐行解析 SSE：data: {...}\n\n
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        // 被取消：立即中断输出（前端已自行 resolve，此处不再发 done）
        if AI_CANCEL.load(Ordering::SeqCst) {
            return Ok(());
        }
        let bytes = chunk.map_err(|e| format!("读取流失败: {}", e))?;
        buffer.push_str(&String::from_utf8_lossy(&bytes));

        // 按行处理缓冲
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].to_string();
            buffer = buffer[pos + 1..].to_string();
            let line = line.trim();
            if line.is_empty() || line.starts_with(':') {
                continue;
            }
            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" {
                    let _ = on_event.send(StreamChunk { delta: String::new(), done: true });
                    return Ok(());
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = v["choices"][0]["delta"]["content"].as_str() {
                        if !delta.is_empty() {
                            let _ = on_event.send(StreamChunk {
                                delta: delta.to_string(),
                                done: false,
                            });
                        }
                    }
                }
            }
        }
    }

    // 流结束（未收到 [DONE]）
    let _ = on_event.send(StreamChunk { delta: String::new(), done: true });
    Ok(())
}

/// 调用 AI 模型（非流式）
#[tauri::command]
pub async fn call_ai(
    base_url: String,
    api_key: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
    max_tokens: u32,
) -> Result<AIResponse, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // 构建请求体
    let request_body = json!({
        "model": model,
        "messages": messages.iter().map(|m| json!({
            "role": m.role,
            "content": m.content
        })).collect::<Vec<_>>(),
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": false
    });

    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求 AI 接口失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!("AI 接口返回错误 ({}): {}", status, error_body));
    }

    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析 AI 响应失败: {}", e))?;

    let content = result["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();
    let finish_reason = result["choices"][0]["finish_reason"]
        .as_str()
        .unwrap_or("stop")
        .to_string();

    Ok(AIResponse {
        content,
        finish_reason,
    })
}

/// 保存记忆摘要
#[tauri::command]
pub fn save_memory(
    app_handle: tauri::AppHandle,
    project_id: String,
    memory: MemorySummary,
) -> Result<(), String> {
    let mem_path = config::get_project_dir(&app_handle, &project_id)
        .join("memories.json");

    let mut memories: Vec<MemorySummary> = if mem_path.exists() {
        let content = std::fs::read_to_string(&mem_path)
            .map_err(|e| format!("读取记忆库失败: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("解析记忆库失败: {}", e))?
    } else {
        vec![]
    };

    // 如果同一章节已有记忆，则更新
    if let Some(pos) = memories.iter().position(|m| m.chapter_id == memory.chapter_id) {
        memories[pos] = memory;
    } else {
        memories.push(memory);
    }

    let json = serde_json::to_string_pretty(&memories)
        .map_err(|e| format!("序列化记忆库失败: {}", e))?;
    std::fs::write(&mem_path, json)
        .map_err(|e| format!("保存记忆库失败: {}", e))?;

    Ok(())
}

/// 获取项目记忆摘要列表
#[tauri::command]
pub fn list_memories(
    app_handle: tauri::AppHandle,
    project_id: String,
) -> Result<Vec<MemorySummary>, String> {
    let mem_path = config::get_project_dir(&app_handle, &project_id)
        .join("memories.json");

    if !mem_path.exists() {
        return Ok(vec![]);
    }

    let content = std::fs::read_to_string(&mem_path)
        .map_err(|e| format!("读取记忆库失败: {}", e))?;
    let memories: Vec<MemorySummary> = serde_json::from_str(&content)
        .map_err(|e| format!("解析记忆库失败: {}", e))?;

    Ok(memories)
}
