mod commands;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // 迁移旧数据目录（macOS 下旧目录以 .app 结尾会被误判为应用包）
            commands::config::migrate_legacy_data_dir(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_project,
            commands::list_projects,
            commands::get_project_structure,
            commands::delete_project,
            commands::move_project,
            commands::rename_project,
            commands::update_project_info,
            commands::save_chapter,
            commands::read_chapter,
            commands::delete_chapter,
            commands::rename_chapter,
            commands::create_group,
            commands::delete_group,
            commands::call_ai,
            commands::call_ai_stream,
            commands::cancel_ai_stream,
            commands::save_memory,
            commands::list_memories,
            commands::import_novel_file,
            commands::export_book,
            commands::get_storage_path,
            commands::set_storage_path,
            commands::save_ai_config,
            commands::load_ai_config,
            commands::save_reference_state,
            commands::load_reference_states,
            commands::delete_reference_state,
            commands::get_data_dir_path,
            commands::open_data_dir,
            commands::migrate_projects,
            commands::backup_project,
            commands::list_backups,
            commands::restore_backup,
            commands::save_character,
            commands::delete_character,
            commands::save_world,
            commands::delete_backup,
            commands::list_custom_skills,
            commands::save_custom_skill,
            commands::delete_custom_skill,
            commands::get_skills_dir_path,
            commands::import_skill_zip,
            commands::export_skill_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
