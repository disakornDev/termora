use crate::pty::stream::Utf8StreamDecoder;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// On Windows a ConPTY reader does not observe EOF while the master handle is still open,
/// so the reader thread cannot detect that the shell exited on its own.
/// A dedicated waiter thread observes the child process instead, waits for exit, drains the
/// remaining output during a 150ms grace period, and drops the session afterwards to unblock the reader.
const EXIT_DRAIN_GRACE: Duration = Duration::from_millis(150);

const MIN_ROWS: u16 = 3;
const MIN_COLS: u16 = 10;
const DEFAULT_PTY_SIZE: PtySize = PtySize {
    rows: 24,
    cols: 80,
    pixel_width: 0,
    pixel_height: 0,
};

pub struct PtySession {
    pub id: String,
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub killer: Box<dyn ChildKiller + Send + Sync>,
    pub shell: String,
}

#[derive(Clone)]
pub struct PtyState {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutputPayload {
    pub session_id: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyExitPayload {
    pub session_id: String,
    pub exit_code: Option<u32>,
}

pub fn requested_pty_size(rows: Option<u16>, cols: Option<u16>) -> PtySize {
    match (rows, cols) {
        (Some(rows), Some(cols)) if rows >= MIN_ROWS && cols >= MIN_COLS => PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        },
        _ => DEFAULT_PTY_SIZE,
    }
}

pub fn resolve_shell_path(shell: &str) -> Result<PathBuf, String> {
    let system_root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".to_string());
    let path = match shell.to_lowercase().as_str() {
        "powershell" | "powershell.exe" => {
            PathBuf::from(&system_root).join(r"System32\WindowsPowerShell\v1.0\powershell.exe")
        }
        "cmd" | "cmd.exe" => PathBuf::from(&system_root).join(r"System32\cmd.exe"),
        other => PathBuf::from(other),
    };

    if path.exists() {
        Ok(path)
    } else {
        Err(format!("Shell executable not found at: {}", path.display()))
    }
}

impl PtyState {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn create_session(
        &self,
        app_handle: AppHandle,
        shell: String,
        cwd: Option<String>,
        rows: Option<u16>,
        cols: Option<u16>,
    ) -> Result<String, String> {
        let shell_path = resolve_shell_path(&shell)?;
        let pty_system = native_pty_system();
        let size = requested_pty_size(rows, cols);

        let pair = pty_system
            .openpty(size)
            .map_err(|e| format!("Failed to open PTY: {}", e))?;

        let mut cmd = CommandBuilder::new(shell_path);
        if let Some(dir) = cwd {
            if !dir.trim().is_empty() {
                cmd.cwd(dir);
            }
        }

        let mut child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell process: {}", e))?;

        let killer = child.clone_killer();

        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {}", e))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {}", e))?;

        let session_id = Uuid::new_v4().to_string();

        let session = PtySession {
            id: session_id.clone(),
            master: pair.master,
            writer: Arc::new(Mutex::new(writer)),
            killer,
            shell: shell.clone(),
        };

        {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "PTY state mutex poisoned".to_string())?;
            sessions.insert(session_id.clone(), session);
        }

        // Reader background thread: continuously read chunks and decode UTF-8
        let reader_session_id = session_id.clone();
        let reader_app = app_handle.clone();
        thread::Builder::new()
            .name(format!("termora-pty-reader-{}", reader_session_id))
            .spawn(move || {
                let mut buffer = [0u8; 8192];
                let mut decoder = Utf8StreamDecoder::new();

                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) => break, // EOF reached (master handle closed)
                        Ok(n) => {
                            let text = decoder.decode(&buffer[..n]);
                            if !text.is_empty() {
                                let _ = reader_app.emit(
                                    "pty:data",
                                    PtyOutputPayload {
                                        session_id: reader_session_id.clone(),
                                        data: text,
                                    },
                                );
                            }
                        }
                        Err(_) => break, // Pipe broken or closed
                    }
                }
            })
            .map_err(|e| format!("Failed to spawn reader thread: {}", e))?;

        // Waiter background thread: monitors child process exit and triggers clean shutdown
        let waiter_session_id = session_id.clone();
        let waiter_app = app_handle;
        let waiter_sessions = self.sessions.clone();
        thread::Builder::new()
            .name(format!("termora-pty-waiter-{}", waiter_session_id))
            .spawn(move || {
                let exit_status = child.wait().ok();
                let exit_code = exit_status.map(|s| s.exit_code());

                // Drain grace period for Windows ConPTY final output before master teardown
                thread::sleep(EXIT_DRAIN_GRACE);

                // Remove session from map to drop master handle and unblock reader thread
                if let Ok(mut map) = waiter_sessions.lock() {
                    map.remove(&waiter_session_id);
                }

                let _ = waiter_app.emit(
                    "pty:exit",
                    PtyExitPayload {
                        session_id: waiter_session_id,
                        exit_code,
                    },
                );
            })
            .map_err(|e| format!("Failed to spawn waiter thread: {}", e))?;

        Ok(session_id)
    }

    pub fn write_data(&self, session_id: &str, data: &str) -> Result<(), String> {
        let sessions = self
            .sessions
            .lock()
            .map_err(|_| "PTY state mutex poisoned".to_string())?;

        let session = sessions
            .get(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let mut writer = session
            .writer
            .lock()
            .map_err(|_| "PTY writer mutex poisoned".to_string())?;

        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;

        writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY writer: {}", e))?;

        Ok(())
    }

    pub fn resize_session(&self, session_id: &str, rows: u16, cols: u16) -> Result<(), String> {
        let mut sessions = self
            .sessions
            .lock()
            .map_err(|_| "PTY state mutex poisoned".to_string())?;

        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Session {} not found", session_id))?;

        let size = requested_pty_size(Some(rows), Some(cols));
        session
            .master
            .resize(size)
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;

        Ok(())
    }

    pub fn close_session(&self, session_id: &str) -> Result<(), String> {
        let mut session = {
            let mut sessions = self
                .sessions
                .lock()
                .map_err(|_| "PTY state mutex poisoned".to_string())?;

            sessions.remove(session_id)
        };

        if let Some(ref mut s) = session {
            let _ = s.killer.kill();
        }

        Ok(())
    }

    pub fn close_all(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            for (_, mut session) in sessions.drain() {
                let _ = session.killer.kill();
            }
        }
    }
}
