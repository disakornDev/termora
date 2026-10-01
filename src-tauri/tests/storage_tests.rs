use rusqlite::Connection;
use termora_lib::storage::db::StorageState;
use termora_lib::storage::models::CommandInput;

fn create_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("Failed to open in-memory db");
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
    initialize_db_in_memory(&conn).unwrap();
    conn
}

fn initialize_db_in_memory(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            parent_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
            position INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS commands (
            id TEXT PRIMARY KEY NOT NULL,
            group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            command TEXT NOT NULL,
            notes TEXT DEFAULT '',
            shell_type TEXT NOT NULL CHECK(shell_type IN ('powershell', 'cmd')),
            is_dangerous INTEGER NOT NULL DEFAULT 0 CHECK(is_dangerous IN (0, 1)),
            position INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL
        );
        "#,
    )?;
    Ok(())
}

#[test]
fn test_group_hierarchy_cycle_prevention() {
    let conn = create_test_db();
    let storage = StorageState::new(conn);

    // Create hierarchy: A -> B -> C
    let group_a = storage
        .create_group("A".to_string(), None, None)
        .expect("Create A");
    let group_b = storage
        .create_group("B".to_string(), Some(group_a.id.clone()), None)
        .expect("Create B");
    let group_c = storage
        .create_group("C".to_string(), Some(group_b.id.clone()), None)
        .expect("Create C");

    // 1. Moving A into itself must fail
    let err_self = storage.update_group(
        group_a.id.clone(),
        None,
        Some(Some(group_a.id.clone())),
        None,
    );
    assert!(err_self.is_err(), "Moving A into itself should fail");

    // 2. Moving A into descendant C must fail
    let err_descendant =
        storage.update_group(group_a.id.clone(), None, Some(Some(group_c.id.clone())), None);
    assert!(err_descendant.is_err(), "Moving A into descendant C should fail");
    assert!(err_descendant.unwrap_err().contains("Cycle detected"));

    // 3. Moving C to root (parent = None) must succeed
    let move_c_root = storage.update_group(group_c.id.clone(), None, Some(None), None);
    assert!(move_c_root.is_ok(), "Moving C to root should succeed");

    // 4. Moving B under C now is allowed since C is at root
    let move_b_under_c =
        storage.update_group(group_b.id.clone(), None, Some(Some(group_c.id.clone())), None);
    assert!(move_b_under_c.is_ok());
}

#[test]
fn test_command_crud_and_dangerous_flag() {
    let conn = create_test_db();
    let storage = StorageState::new(conn);

    let group = storage
        .create_group("Dev".to_string(), None, None)
        .expect("Create group");

    // Create dangerous command
    let cmd_input = CommandInput {
        id: None,
        group_id: Some(group.id.clone()),
        name: "Remove Temp".to_string(),
        command: "Remove-Item ./temp -Recurse -Force".to_string(),
        notes: Some("Deletes temp directory".to_string()),
        shell_type: "powershell".to_string(),
        is_dangerous: true,
        position: None,
    };

    let saved = storage.save_command(cmd_input).expect("Save command");
    assert_eq!(saved.name, "Remove Temp");
    assert!(saved.is_dangerous);
    assert_eq!(saved.shell_type, "powershell");

    // Read all
    let all = storage.get_all().expect("Get all");
    assert_eq!(all.commands.len(), 1);
    assert_eq!(all.groups.len(), 1);

    // Delete command
    storage.delete_command(saved.id.clone()).expect("Delete command");
    let after_delete = storage.get_all().expect("Get all");
    assert_eq!(after_delete.commands.len(), 0);
}

#[test]
fn test_settings_persistence() {
    let conn = create_test_db();
    let storage = StorageState::new(conn);

    storage
        .save_setting("defaultShell".to_string(), "cmd".to_string())
        .expect("Save setting");
    storage
        .save_setting("terminalFontSize".to_string(), "16".to_string())
        .expect("Save setting");

    let all = storage.get_all().expect("Get all");
    assert_eq!(all.settings.get("defaultShell").unwrap(), "cmd");
    assert_eq!(all.settings.get("terminalFontSize").unwrap(), "16");
}
