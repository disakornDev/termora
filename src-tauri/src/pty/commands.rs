use crate::pty::session::PtyState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn pty_create(
    app_handle: AppHandle,
    pty_state: State<'_, PtyState>,
    shell: String,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<String, String> {
    pty_state.create_session(app_handle, shell, cwd, rows, cols)
}

#[tauri::command]
pub async fn pty_write(
    pty_state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    pty_state.write_data(&session_id, &data)
}

#[tauri::command]
pub async fn pty_resize(
    pty_state: State<'_, PtyState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    pty_state.resize_session(&session_id, rows, cols)
}

#[tauri::command]
pub async fn pty_close(
    pty_state: State<'_, PtyState>,
    session_id: String,
) -> Result<(), String> {
    pty_state.close_session(&session_id)
}
