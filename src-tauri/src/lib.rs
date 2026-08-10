mod commands;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
            commands::save_memory,
            commands::list_memories,
            commands::import_novel_file,
            commands::export_book,
            commands::get_storage_path,
            commands::set_storage_path,
            commands::save_ai_config,
            commands::load_ai_config,
            commands::migrate_projects,
            commands::backup_project,
            commands::list_backups,
            commands::restore_backup,
            commands::save_character,
            commands::delete_character,
            commands::save_world,
            commands::delete_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
