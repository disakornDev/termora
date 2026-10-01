use crate::storage::db::StorageState;
use crate::storage::models::{CommandGroup, CommandInput, LibraryPayload, SavedCommand};
use tauri::State;

#[tauri::command]
pub async fn storage_get_all(
    storage_state: State<'_, StorageState>,
) -> Result<LibraryPayload, String> {
    storage_state.get_all()
}

#[tauri::command]
pub async fn storage_create_group(
    storage_state: State<'_, StorageState>,
    name: String,
    parent_id: Option<String>,
    position: Option<i64>,
) -> Result<CommandGroup, String> {
    storage_state.create_group(name, parent_id, position)
}

#[tauri::command]
pub async fn storage_update_group(
    storage_state: State<'_, StorageState>,
    id: String,
    name: Option<String>,
    parent_id: Option<Option<String>>,
    position: Option<i64>,
) -> Result<CommandGroup, String> {
    storage_state.update_group(id, name, parent_id, position)
}

#[tauri::command]
pub async fn storage_delete_group(
    storage_state: State<'_, StorageState>,
    id: String,
    delete_children: bool,
) -> Result<(), String> {
    storage_state.delete_group(id, delete_children)
}

#[tauri::command]
pub async fn storage_save_command(
    storage_state: State<'_, StorageState>,
    command: CommandInput,
) -> Result<SavedCommand, String> {
    storage_state.save_command(command)
}

#[tauri::command]
pub async fn storage_delete_command(
    storage_state: State<'_, StorageState>,
    id: String,
) -> Result<(), String> {
    storage_state.delete_command(id)
}

#[tauri::command]
pub async fn storage_save_setting(
    storage_state: State<'_, StorageState>,
    key: String,
    value: String,
) -> Result<(), String> {
    storage_state.save_setting(key, value)
}
