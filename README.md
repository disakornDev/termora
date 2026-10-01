# Termora — Modern Windows Interactive Terminal & Saved Command Manager

A modern, developer-focused Windows desktop application built with **Tauri v2**, **Rust**, **React 19**, **TypeScript**, and **Tailwind CSS**, styled using the **MongoDB Dark Canvas Design System** (`#001e2b` deep teal-black canvas, `#00ed64` electric green accent, and `#1c2d38` hairline borders).

---

## ⚡ Features

1. **Interactive Windows ConPTY Terminal**:
   - Genuine Windows Pseudo-Terminal powered by Rust (`portable-pty`) directly communicating with `@xterm/xterm`.
   - Supports stdin, stdout, stderr, ANSI colors, arrow keys, Tab completion, and interactive CLI prompts (e.g. `(Y/N)`, `[y/N]`, `Read-Host`, password inputs).
   - Dedicated `Utf8StreamDecoder` in Rust reassembles multibyte byte boundaries, ensuring Thai characters, CJK scripts, emojis, and box-drawing symbols never corrupt into `\u{FFFD}`.
   - Dedicated waiter thread with 150ms drain grace period prevents pipe hangs on Windows ConPTY upon shell exit.
   - Clean child process reaper (`ChildKiller`) on tab close and application exit hook (`RunEvent::ExitRequested`), guaranteeing zero orphan `powershell.exe` or `conhost.exe` zombies.

2. **Multiple Terminal Tabs**:
   - Independent PTY session, shell, buffer, working directory, and environment per tab.
   - Support for both **PowerShell (`powershell.exe`)** and **Command Prompt (`cmd.exe`)**.
   - Create tabs via default button or shell dropdown, switch tabs, rename tabs, and reorder tabs.
   - Tabs remain live in background with preserved scrollback when switching between them.

3. **Hierarchical Command Library**:
   - Organize saved commands into unlimited nested folders/groups.
   - Built-in SQLite database (`rusqlite` bundled) with recursive ancestor traversal preventing tree cycles (cannot move a folder into itself or its own descendants).
   - Fast instant search across command names, code snippets, notes, and group names.
   - Drag and drop reorganization powered by `@dnd-kit` with clear visual drop target cues.

4. **Three Primary Command Actions**:
   - **Copy**: Copies command text to the OS clipboard with checkmark feedback.
   - **Insert**: Injects command text into the active terminal's PTY session without a trailing newline (`\r`), allowing editing or review before execution.
   - **Run**: Injects command text with a trailing newline (`\r`) to execute immediately.

5. **Dangerous Command Safety Guard**:
   - User-marked dangerous commands (e.g. `Remove-Item -Recurse -Force`, `drop database`) are strictly guarded.
   - Whenever `Run` is triggered, a mandatory confirmation modal appears with syntax highlighting and default focus on `[Cancel]`.
   - Confirmation is strictly non-bypassable.

6. **Shell Compatibility Gate**:
   - If a saved command targets PowerShell but the active terminal is Command Prompt (or vice versa), Termora warns the user and provides 3 choices:
     1. **Open in New Compatible Tab & Run** (Recommended)
     2. **Run in Current Tab Anyway**
     3. **Cancel** (Safe default)

7. **Local-First & Offline**:
   - Embedded SQLite database located at `%LOCALAPPDATA%\com.disakorn.termora\termora.db`.
   - Foreign key constraints, indexes, and ACID transactions.
   - Zero cloud dependency, telemetry, or external network requests required.

---

## 🛠️ Tech Stack & Prerequisites

- **Desktop Framework**: [Tauri v2](https://v2.tauri.app/)
- **Backend**: Rust 2021 with `portable-pty`, `rusqlite` (bundled SQLite 3), `tokio`, `serde`, `uuid`, `chrono`
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, `@xterm/xterm`, `@dnd-kit/core`
- **Package Manager**: `pnpm` (v10+)
- **System**: Windows 11 (or Windows 10 1809+ for ConPTY support) with Node.js 20+ and Rust/Cargo

---

## 🚀 Getting Started

### 1. Install Dependencies
```powershell
pnpm install
```

### 2. Run in Development Mode
To run the full Tauri desktop application:
```powershell
pnpm tauri dev
```

To run only the frontend in the browser:
```powershell
pnpm dev
```

### 3. Run Automated Tests

**Frontend Tests (Vitest)**:
```powershell
pnpm test
```

**Rust Backend Tests (ConPTY & SQLite)**:
```powershell
cd src-tauri
cargo test
```

### 4. Build Standalone Desktop Binary / Installer
```powershell
pnpm tauri build
```
Generates NSIS installer (`.exe`) and portable executable in `src-tauri/target/release/bundle/`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + T` | Open new terminal tab (default shell) |
| `Ctrl + W` | Close active terminal tab |
| `Ctrl + K` | Focus search bar in command library |
| `Ctrl + Shift + N` | Create new saved command |
| `Ctrl + ,` | Open Settings |
| `Double click tab` | Rename terminal tab |
| `Escape` | Close modals |
