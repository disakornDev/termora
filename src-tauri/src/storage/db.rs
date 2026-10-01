use crate::storage::models::{CommandGroup, CommandInput, LibraryPayload, SavedCommand};
use crate::storage::tree::{validate_group_move, TreeError};
use chrono::Utc;
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use uuid::Uuid;

pub struct StorageState {
    pub conn: Arc<Mutex<Connection>>,
}

pub fn get_default_db_path() -> PathBuf {
    let base_dir = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    let app_dir = base_dir.join("com.disakorn.termora");
    let _ = fs::create_dir_all(&app_dir);
    app_dir.join("termora.db")
}

pub fn initialize_db(path: &Path) -> Result<Connection, rusqlite::Error> {
    let conn = Connection::open(path)?;

    // Enable foreign keys
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    // Create tables
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

        CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);
        CREATE INDEX IF NOT EXISTS idx_groups_position ON groups(position);
        CREATE INDEX IF NOT EXISTS idx_commands_group ON commands(group_id);
        CREATE INDEX IF NOT EXISTS idx_commands_position ON commands(position);
        CREATE INDEX IF NOT EXISTS idx_commands_search ON commands(name, command, notes);
        "#,
    )?;

    // Seed default settings if empty
    {
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM settings")?;
        let count: i64 = stmt.query_row([], |row| row.get(0))?;
        if count == 0 {
            conn.execute_batch(
                r#"
                INSERT OR IGNORE INTO settings (key, value) VALUES
                    ('defaultShell', 'powershell'),
                    ('terminalFontSize', '14'),
                    ('terminalFontFamily', 'Consolas, ''Cascadia Code'', monospace'),
                    ('powershellPath', 'System32\WindowsPowerShell\v1.0\powershell.exe'),
                    ('cmdPath', 'System32\cmd.exe'),
                    ('theme', 'dark');
                "#,
            )?;
        }
    }

    Ok(conn)
}

impl StorageState {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Arc::new(Mutex::new(conn)),
        }
    }

    pub fn get_all(&self) -> Result<LibraryPayload, String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;

        // 1. Fetch groups ordered by position
        let mut group_stmt = conn
            .prepare("SELECT id, name, parent_id, position, created_at, updated_at FROM groups ORDER BY position ASC, name ASC")
            .map_err(|e| e.to_string())?;

        let group_rows = group_stmt
            .query_map([], |row| {
                Ok(CommandGroup {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    parent_id: row.get(2)?,
                    position: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut groups = Vec::new();
        for g in group_rows {
            groups.push(g.map_err(|e| e.to_string())?);
        }

        // 2. Fetch commands ordered by position
        let mut cmd_stmt = conn
            .prepare("SELECT id, group_id, name, command, notes, shell_type, is_dangerous, position, created_at, updated_at FROM commands ORDER BY position ASC, name ASC")
            .map_err(|e| e.to_string())?;

        let cmd_rows = cmd_stmt
            .query_map([], |row| {
                let is_dangerous_int: i64 = row.get(6)?;
                Ok(SavedCommand {
                    id: row.get(0)?,
                    group_id: row.get(1)?,
                    name: row.get(2)?,
                    command: row.get(3)?,
                    notes: row.get(4)?,
                    shell_type: row.get(5)?,
                    is_dangerous: is_dangerous_int == 1,
                    position: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut commands = Vec::new();
        for c in cmd_rows {
            commands.push(c.map_err(|e| e.to_string())?);
        }

        // 3. Fetch settings
        let mut set_stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| e.to_string())?;

        let set_rows = set_stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;

        let mut settings = HashMap::new();
        for s in set_rows {
            let (k, v) = s.map_err(|e| e.to_string())?;
            settings.insert(k, v);
        }

        Ok(LibraryPayload {
            groups,
            commands,
            settings,
        })
    }

    pub fn create_group(
        &self,
        name: String,
        parent_id: Option<String>,
        position: Option<i64>,
    ) -> Result<CommandGroup, String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        let pos = match position {
            Some(p) => p,
            None => {
                let mut stmt = conn
                    .prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM groups WHERE parent_id IS ?1")
                    .map_err(|e| e.to_string())?;
                stmt.query_row([&parent_id], |row| row.get(0))
                    .map_err(|e| e.to_string())?
            }
        };

        conn.execute(
            "INSERT INTO groups (id, name, parent_id, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![&id, &name, &parent_id, pos, &now, &now],
        )
        .map_err(|e| e.to_string())?;

        Ok(CommandGroup {
            id,
            name,
            parent_id,
            position: pos,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn update_group(
        &self,
        id: String,
        name: Option<String>,
        parent_id: Option<Option<String>>,
        position: Option<i64>,
    ) -> Result<CommandGroup, String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;

        // If parent_id is being updated, validate against cycle!
        if let Some(new_parent) = &parent_id {
            validate_group_move(&conn, &id, new_parent.as_deref()).map_err(|e| match e {
                TreeError::CycleDetected => {
                    "Cycle detected: Cannot move a folder into itself or its own subfolder".to_string()
                }
                TreeError::DbError(err) => err.to_string(),
            })?;
        }

        let now = Utc::now().to_rfc3339();

        if let Some(n) = name {
            conn.execute(
                "UPDATE groups SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![&n, &now, &id],
            )
            .map_err(|e| e.to_string())?;
        }

        if let Some(p) = parent_id {
            conn.execute(
                "UPDATE groups SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![&p, &now, &id],
            )
            .map_err(|e| e.to_string())?;
        }

        if let Some(pos) = position {
            conn.execute(
                "UPDATE groups SET position = ?1, updated_at = ?2 WHERE id = ?3",
                params![pos, &now, &id],
            )
            .map_err(|e| e.to_string())?;
        }

        let mut stmt = conn
            .prepare("SELECT id, name, parent_id, position, created_at, updated_at FROM groups WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        stmt.query_row([&id], |row| {
            Ok(CommandGroup {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                position: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    pub fn delete_group(&self, id: String, delete_children: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;

        if !delete_children {
            // Move child commands to the parent of this group or NULL (root)
            let mut stmt = conn
                .prepare("SELECT parent_id FROM groups WHERE id = ?1")
                .map_err(|e| e.to_string())?;
            let parent_id: Option<String> = stmt
                .query_row([&id], |row| row.get(0))
                .map_err(|e| e.to_string())?;

            conn.execute(
                "UPDATE commands SET group_id = ?1 WHERE group_id = ?2",
                params![&parent_id, &id],
            )
            .map_err(|e| e.to_string())?;

            // Move child groups to parent
            conn.execute(
                "UPDATE groups SET parent_id = ?1 WHERE parent_id = ?2",
                params![&parent_id, &id],
            )
            .map_err(|e| e.to_string())?;
        }

        conn.execute("DELETE FROM groups WHERE id = ?1", params![&id])
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn save_command(&self, input: CommandInput) -> Result<SavedCommand, String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;
        let now = Utc::now().to_rfc3339();
        let notes = input.notes.unwrap_or_default();
        let dangerous_int = if input.is_dangerous { 1 } else { 0 };

        let id = match input.id {
            Some(existing_id) if !existing_id.trim().is_empty() => {
                conn.execute(
                    r#"
                    UPDATE commands
                    SET group_id = ?1, name = ?2, command = ?3, notes = ?4,
                        shell_type = ?5, is_dangerous = ?6,
                        position = COALESCE(?7, position), updated_at = ?8
                    WHERE id = ?9
                    "#,
                    params![
                        &input.group_id,
                        &input.name,
                        &input.command,
                        &notes,
                        &input.shell_type,
                        dangerous_int,
                        input.position,
                        &now,
                        &existing_id
                    ],
                )
                .map_err(|e| e.to_string())?;

                existing_id
            }
            _ => {
                let new_id = Uuid::new_v4().to_string();
                let pos = match input.position {
                    Some(p) => p,
                    None => {
                        let mut stmt = conn
                            .prepare("SELECT COALESCE(MAX(position), -1) + 1 FROM commands WHERE group_id IS ?1")
                            .map_err(|e| e.to_string())?;
                        stmt.query_row([&input.group_id], |row| row.get(0))
                            .map_err(|e| e.to_string())?
                    }
                };

                conn.execute(
                    r#"
                    INSERT INTO commands (id, group_id, name, command, notes, shell_type, is_dangerous, position, created_at, updated_at)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    "#,
                    params![
                        &new_id,
                        &input.group_id,
                        &input.name,
                        &input.command,
                        &notes,
                        &input.shell_type,
                        dangerous_int,
                        pos,
                        &now,
                        &now
                    ],
                )
                .map_err(|e| e.to_string())?;

                new_id
            }
        };

        let mut stmt = conn
            .prepare("SELECT id, group_id, name, command, notes, shell_type, is_dangerous, position, created_at, updated_at FROM commands WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        stmt.query_row([&id], |row| {
            let is_dang: i64 = row.get(6)?;
            Ok(SavedCommand {
                id: row.get(0)?,
                group_id: row.get(1)?,
                name: row.get(2)?,
                command: row.get(3)?,
                notes: row.get(4)?,
                shell_type: row.get(5)?,
                is_dangerous: is_dang == 1,
                position: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    pub fn delete_command(&self, id: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;
        conn.execute("DELETE FROM commands WHERE id = ?1", params![&id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_setting(&self, key: String, value: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|_| "Database mutex poisoned")?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
            params![&key, &value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
