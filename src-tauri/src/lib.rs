pub mod pty;
pub mod storage;

use pty::{pty_close, pty_create, pty_resize, pty_write, PtyState};
use storage::{
    get_default_db_path, initialize_db, storage_create_group, storage_delete_command,
    storage_delete_group, storage_get_all, storage_save_command, storage_save_setting,
    storage_update_group, StorageState,
};

pub fn run() {
    let pty_state = PtyState::new();

    let db_path = get_default_db_path();
    let conn = initialize_db(&db_path).expect("Failed to initialize SQLite database");
    let storage_state = StorageState::new(conn);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(pty_state.clone())
        .manage(storage_state)
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.center();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pty_create,
            pty_write,
            pty_resize,
            pty_close,
            storage_get_all,
            storage_create_group,
            storage_update_group,
            storage_delete_group,
            storage_save_command,
            storage_delete_command,
            storage_save_setting,
        ])
        .build(tauri::generate_context!())
        .expect("Error while building Tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { .. } = event {
            // Clean up any remaining PTY sessions and processes to prevent orphan conhost/powershell
            pty_state.close_all();
        }
    });
}
