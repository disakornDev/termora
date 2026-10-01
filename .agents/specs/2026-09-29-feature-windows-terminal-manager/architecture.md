# Architecture — Termora Windows Interactive Terminal & Saved Command Manager

> Status: Approved
> Spec: ./spec.md

## Context and constraints

Termora ได้รับการออกแบบให้เป็นแอปพลิเคชัน Desktop บน Windows 11 ที่รวม 3 องค์ประกอบหลัก:
1. การเป็น **Interactive Windows Terminal** อย่างแท้จริง (ConPTY / PseudoConsole) ที่มี I/O แบบสตรีมมิ่งสด รับ stdin/stdout/stderr และคำถามตอบโต้ `(Y/N)`, `Read-Host`, ANSI escapes และ cursor movements
2. การเป็น **Command Manager & Hierarchical Library** จัดการคำสั่งและโฟลเดอร์ซ้อนกันได้ไม่จำกัดระดับอย่างมีเสถียรภาพ ป้องกัน Tree Cycle ไม่ให้เกิดการลูปในฐานข้อมูล
3. การเป็น **Execution Guard** ที่มีเกณฑ์ความปลอดภัยชัดเจนระหว่างคำสั่งทั่วไปและคำสั่งอันตราย (Dangerous Commands) และตรวจสอบความเข้ากันได้ของประเภท Shell (PowerShell vs CMD)

ข้อจำกัดสำคัญ:
- ห้ามใช้ `exec(command)` หรือ one-shot child process execution เพราะจะทำลาย interactive capabilities ทั้งหมด
- หลีกเลี่ยง C++ binding friction บน Windows (เช่น `node-pty` ใน Electron) โดยใช้ Rust Native `portable-pty` บน Tauri v2
- UI ยึดมั่นตาม `DESIGN.md` (MongoDB Dark Canvas Theme) โดยใช้โทนสี `#001e2b`, เส้นขอบ hairline `#1c2d38` และสีเน้น `#00ed64`

---

## Decisions

### ADR-1: การเลือก Tauri v2 + Rust Crate `portable-pty` เหนือ Electron + `node-pty`
- **Decision**: ใช้ **Tauri v2** ร่วมกับ crate `portable-pty` (v0.8) ในการควบคุม Windows ConPTY แทน Electron
- **Rationale**:
  - `portable-pty` เรียก Windows Win32 ConPTY APIs (`CreatePseudoConsole`, `ClosePseudoConsole`, `CreateProcessW`) โดยตรงแบบ Native ปราศจากปัญหา Node ABI mismatch หรือ Visual Studio C++ build tool errors
  - Rust จัดการ memory และ thread ได้อย่างมีประสิทธิภาพ: ConPTY บน Windows มีพฤติกรรมเฉพาะคือ reader thread จะไม่เห็น EOF จนกว่า master handle จะปิด ใน Rust เราสามารถแยก background waiter thread เพื่อตรวจจับ child process exit และทำ I/O drain grace period (150ms) ก่อนปิด handle ป้องกัน deadlock
  - บริโภคหน่วยความจำต่ำ (~35-50 MB RAM ขณะเปิดหลายแท็บ) เทียบกับ Electron (~150-250 MB RAM)
- **Alternatives rejected**:
  - *Electron + node-pty*: ถูกปฏิเสธเนื่องจากความเปราะบางในการคอมไพล์บน Windows, ปัญหา handle leak และขนาด binary/RAM ที่สูงเกินไป
  - *Tauri std::process::Command (Fake Terminal)*: ถูกปฏิเสธเนื่องจากไม่รองรับ interactive prompts, cursor navigation, ANSI escape sequences, หรือ long-running sessions
- **Consequences**: จำเป็นต้องเขียน PTY manager และ session state ด้วยภาษา Rust ในฝั่ง backend และส่ง data ผ่าน Tauri event system ไปยัง frontend
- **Evidence/assumptions**: อ้างอิงผลการรันจริงและ architecture ที่พิสูจน์แล้วในระบบต้นแบบ `runkitv2` บน Windows 11

### ADR-2: การจัดการ UTF-8 Multibyte Stream Decoding ข้าม Read Boundary
- **Decision**: นำ `Utf8StreamDecoder` มาใช้ใน Rust PTY reader thread ก่อนส่งข้อมูลผ่าน Tauri event
- **Rationale**: การอ่านไบต์จาก ConPTY pipe จะได้ก้อนข้อมูลตามขนาดที่ OS buffer ไว้ในขณะนั้น ตัวอักษร UTF-8 หลายไบต์ (เช่น ภาษาไทย 3 ไบต์, Box-drawing characters, Emoji 4 ไบต์) อาจถูกตัดแบ่งครึ่งที่ขอบของ chunk หากแปลงแต่ละ chunk ทันทีจะเกิดอักขระเสีย `\u{FFFD}` การใช้ buffer สะสมไบต์ตกค้าง (`carry buffer`) จะรับประกันว่าส่งเฉพาะ UTF-8 string ที่สมบูรณ์เท่านั้น
- **Alternatives rejected**: การส่ง raw byte array ไปให้ frontend ถอดรหัสใน JavaScript: ถูกปฏิเสธเนื่องจากทำให้เกิด overhead ในการ serialize binary array ผ่าน IPC บ่อยครั้ง
- **Consequences**: ความถูกต้องของข้อความภาษาไทยและสัญลักษณ์ CLI ถูกต้อง 100%

### ADR-3: โครงสร้างฐานข้อมูล Embedded SQLite (`rusqlite`) และการป้องกัน Tree Cycle
- **Decision**: ใช้ SQLite 3 แบบ Bundled ผ่าน crate `rusqlite` พร้อมเก็บโครงสร้าง Hierarchical Tree ด้วย `parent_id` และตรวจสอบ cycle ก่อนบันทึก
- **Rationale**:
  - SQLite ให้คุณสมบัติ ACID, Foreign Keys (`ON DELETE CASCADE` / `SET NULL`), Indexes, และ Full Text Query ที่รวดเร็ว
  - การป้องกัน Tree Cycle: สร้างฟังก์ชัน `validate_group_move(group_id, target_parent_id)` ใน Rust ที่ทำการไล่ค้นหาบรรพบุรุษ (Ancestor Traversal) ย้อนขึ้นไปจนถึง root หากพบว่า `target_parent_id` มี `group_id` อยู่ในสายบรรพบุรุษ จะปฏิเสธการย้ายทันที (`Err(StorageError::CycleDetected)`)
- **Alternatives rejected**:
  - *Plain JSON file*: ถูกปฏิเสธเนื่องจากไม่มี Foreign Key enforcement เสี่ยงข้อมูลไม่สอดคล้องเมื่อแก้ไขพร้อมกัน และจัดการ parent-child cascade ยาก
  - *Adjacency List in memory only*: เสี่ยงต่อการเกิด cycle ใน disk หาก frontend เกิดข้อผิดพลาด
- **Consequences**: โครงสร้างโฟลเดอร์มีความสมบูรณ์เชิงสัมพันธ์สูง ข้อมูลไม่สูญหายแม้เครื่องดับ

### ADR-4: การแยกพฤติกรรมอย่างเด็ดขาดระหว่าง `Copy`, `Insert`, และ `Run`
- **Decision**:
  - `Copy`: เขียนลง OS Clipboard
  - `Insert`: ส่งสตริงคำสั่งผ่าน `pty_write(sessionId, text)` **โดยไม่มี newline (`\r`)**
  - `Run`: ส่งสตริงคำสั่งผ่าน `pty_write(sessionId, format!("{}\r", text))` **พร้อม newline (`\r`)**
- **Rationale**: สถาปัตยกรรม PTY อนุญาตให้เขียนไบต์เสมือนผู้ใช้พิมพ์ลงคีย์บอร์ดจริง การแยกระหว่างมีหรือไม่มี `\r` เป็นแนวทางที่แม่นยำและเสถียรที่สุด โดยไม่ต้องพึ่งพา clipboard emulation ชั่วคราว
- **Consequences**: การ Insert คำสั่งจะปรากฏบน prompt ของ terminal ปัจจุบันทันทีโดยไม่สั่งรัน ผู้ใช้สามารถพิมพ์ต่อหรือตรวจทานก่อนกด Enter เองได้

### ADR-5: Dangerous Command Guard & Shell Compatibility Gate
- **Decision**:
  - คำสั่งที่มี flag `is_dangerous = 1` จะต้องผ่าน `DangerousConfirmModal` เสมอเมื่อเรียกด้วย action `Run` โดยปุ่ม default focus ต้องเป็น `[Cancel]` และไม่สามารถข้ามการยืนยันได้
  - หาก Shell ของคำสั่ง (`command.shell_type`) ไม่ตรงกับ Shell ของ active tab (`activeTab.shell`) ระบบจะแสดง `ShellMismatchModal` เสนอตัวเลือก: 1. สร้างแท็บที่เข้ากันได้และรันทันที (แนะนำ), 2. ยืนยันรันในแท็บปัจจุบัน, 3. ยกเลิก
- **Rationale**: ความปลอดภัยของระบบปฏิบัติการเป็นสิ่งสำคัญสูงสุด การสั่งรันคำสั่งผิด Shell หรือคำสั่งทำลายข้อมูล (เช่น `Remove-Item -Recurse -Force`) ต้องมี safe barrier ป้องกันความผิดพลาดของผู้ใช้
- **Consequences**: ป้องกันความเสียหายของระบบและข้อผิดพลาด syntax mismatch ระหว่าง PowerShell cmdlets และ CMD batch commands

---

## Data and migration

### 1. Database Schema (SQLite 3 via `rusqlite`)

```sql
PRAGMA foreign_keys = ON;

-- 1. ตารางกลุ่มคำสั่ง (Hierarchical Folders)
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- 2. ตารางคำสั่ง (Saved Commands)
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

-- 3. ตารางการตั้งค่า (Settings KV)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

-- Indexes สำหรับการค้นหาและจัดเรียงที่รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_groups_position ON groups(position);
CREATE INDEX IF NOT EXISTS idx_commands_group ON commands(group_id);
CREATE INDEX IF NOT EXISTS idx_commands_position ON commands(position);
CREATE INDEX IF NOT EXISTS idx_commands_search ON commands(name, command, notes);
```

### 2. Migration & Disaster Recovery Strategy
- เก็บไฟล์ฐานข้อมูลไว้ที่: `%LOCALAPPDATA%\com.disakorn.termora\termora.db`
- เมื่อเริ่มแอป ทำการรัน `PRAGMA user_version` เพื่อตรวจสอบเวอร์ชันของ schema หากมี schema migration ใหม่ จะทำ atomic transaction ในการอัปเกรด
- มีระบบ auto-backup ไฟล์ `termora.db.bak` อัตโนมัติก่อนรัน migration ใหม่
- หากตรวจพบว่าไฟล์ SQLite เสียหาย (corrupted) แอปจะเปิดหน้าต่าง Recovery Mode ให้ผู้ใช้เลือก Restore จาก Backup หรือเริ่มฐานข้อมูลใหม่ โดยไม่เขียนทับไฟล์เดิมทิ้ง

---

## Contracts and boundaries

### 1. Tauri IPC Command Interface

| Command Name | Arguments | Return Type | Description |
|---|---|---|---|
| `pty_create` | `{ shell: "powershell" \| "cmd", cwd?: string, rows: number, cols: number }` | `Result<String, String>` | สปอว์น ConPTY session ใหม่ คืนค่า sessionId |
| `pty_write` | `{ sessionId: string, data: string }` | `Result<(), String>` | เขียนสตริงข้อมูลเข้า stdin ของ ConPTY |
| `pty_resize` | `{ sessionId: string, rows: number, cols: number }` | `Result<(), String>` | ปรับขนาดแถว/คอลัมน์ของ ConPTY |
| `pty_close` | `{ sessionId: string }` | `Result<(), String>` | ยุติ ConPTY session และกำจัด child process |
| `storage_get_all` | `{}` | `Result<LibraryPayload, String>` | ดึงข้อมูล groups, commands, settings ทั้งหมด |
| `storage_create_group` | `{ name: string, parentId?: string, position?: number }` | `Result<Group, String>` | สร้างกลุ่มใหม่ |
| `storage_update_group` | `{ id: string, name?: string, parentId?: string, position?: number }` | `Result<Group, String>` | แก้ไขกลุ่ม (พร้อมตรวจ cycle) |
| `storage_delete_group` | `{ id: string, deleteChildren: boolean }` | `Result<(), String>` | ลบกลุ่ม (เลือกย้ายคำสั่งหรือลบทั้งหมด) |
| `storage_save_command` | `{ command: CommandInput }` | `Result<Command, String>` | สร้างหรืออัปเดตคำสั่ง |
| `storage_delete_command`| `{ id: string }` | `Result<(), String>` | ลบคำสั่ง |
| `storage_save_setting` | `{ key: string, value: string }` | `Result<(), String>` | บันทึกการตั้งค่า |

### 2. Tauri Event Channel Interface

- `pty:data` Payload: `{ sessionId: string, data: string }` (ส่ง raw ANSI string จาก reader thread ไปยัง xterm)
- `pty:exit` Payload: `{ sessionId: string, exitCode: number | null }` (ส่งเมื่อ child process ปิดตัวลง)

---

## File/module impact

```
d:/Programming/DesktopApplication/Tauri/termora/
├── .agents/
│   ├── workflow.json
│   └── specs/2026-09-29-feature-windows-terminal-manager/
│       ├── spec.md
│       ├── plan.md
│       ├── tasks.md
│       └── architecture.md (ไฟล์นี้)
├── DESIGN.md (MongoDB Dark Canvas Theme)
├── src-tauri/
│   ├── Cargo.toml (tauri v2, portable-pty, rusqlite, tokio, serde, uuid, chrono)
│   ├── tauri.conf.json (App permissions, window configuration, bundle settings)
│   └── src/
│       ├── main.rs (Entry point)
│       ├── lib.rs (Tauri app builder, State setup, Command registration, Exit hook)
│       ├── pty/
│       │   ├── mod.rs (Module export)
│       │   ├── session.rs (PtySession, PtyState, portable-pty integration)
│       │   ├── stream.rs (Utf8StreamDecoder for multibyte safe decoding)
│       │   └── commands.rs (pty_create, pty_write, pty_resize, pty_close)
│       └── storage/
│           ├── mod.rs (Module export)
│           ├── db.rs (SQLite connection, migrations, user_version)
│           ├── models.rs (Group, Command, Settings structs with Serde)
│           ├── tree.rs (Cycle detection, ancestor traversal, reordering)
│           └── commands.rs (CRUD IPC handlers)
└── src/
    ├── main.tsx & App.tsx (Root UI shell)
    ├── index.css (Tailwind CSS with MongoDB Dark tokens)
    ├── stores/
    │   ├── useTerminalStore.ts (Active tab, tabs list, PTY lifecycle sync)
    │   ├── useCommandStore.ts (Groups tree, commands, search filter, selection)
    │   └── useSettingsStore.ts (User preferences, default shell, font size)
    ├── components/
    │   ├── terminal/
    │   │   ├── TerminalTabs.tsx (Tabs bar, new tab dropdown, tab close/rename)
    │   │   ├── TerminalDock.tsx (Active tab view, xterm canvas container)
    │   │   └── TerminalPane.tsx (@xterm/xterm mounting, FitAddon, pty stream)
    │   ├── library/
    │   │   ├── Sidebar.tsx (Resizable left container)
    │   │   ├── SearchBar.tsx (Instant search input)
    │   │   ├── GroupTree.tsx (Recursive folder tree, expand/collapse)
    │   │   ├── GroupNode.tsx (Folder row with action menu)
    │   │   ├── CommandItem.tsx (Command row with Run/Insert/Copy buttons)
    │   │   └── DndTreeContainer.tsx (@dnd-kit drag-and-drop context)
    │   └── modals/
    │       ├── CommandEditModal.tsx (Create/Edit command form)
    │       ├── GroupEditModal.tsx (Create/Rename folder form)
    │       ├── DangerousConfirmModal.tsx (Mandatory confirmation dialog)
    │       ├── ShellMismatchModal.tsx (Shell compatibility choice dialog)
    │       └── SettingsModal.tsx (Application configuration)
    └── types/
        └── index.ts (TypeScript interface definitions mirroring Rust Serde models)
```

---

## UI impact

- ปฏิบัติตาม **`DESIGN.md`** (MongoDB Dark Canvas Theme) อย่างเคร่งครัด:
  - Surface Background: `#001e2b` (Deep Teal-Black)
  - Card/Item Background: `#002838` (ปกติ), `#003d4f` (เมื่อ hover/active)
  - Hairline Borders: `#1c2d38` 1px solid
  - Primary Green: `#00ed64` สำหรับ Active Tab Indicator, Focus Outlines, และ Primary Buttons
  - Dangerous Alert: `#fa6e39` สำหรับ Dangerous Command Badge และ Confirmation Modal Border
  - Shell Badges: สีฟ้าสำหรับ PowerShell (`#3d4f9f` / `#4a90e2`), สีเทาสำหรับ CMD (`#5c6c7a`)
- Terminal Canvas:
  - xterm theme แมปตาม canvas (`background: #001e2b`, `foreground: #e1e5e8`, `cursor: #00ed64`)

---

## Rollout and observability

- **Rollout**: แจกจ่ายในรูปแบบ NSIS Installer (`.exe`) และ Standalone Portable `.zip` ผ่าน Tauri Bundler
- **Logging**: Rust backend บันทึก log ด้วย crate `tracing` (ระดับ INFO/WARN/ERROR) ไปยัง `%LOCALAPPDATA%\com.disakorn.termora\logs\termora.log`
- **Crash Safety**: มี panic hook ดักจับเพื่อส่ง child kill signal ก่อนแอปพลิเคชันยุติการทำงาน

---

## Fresh-review implications

- **Selected Stage**: `wf-review`
- **Trigger Reasons**: `security`, `data-integrity`
- **ขอบเขตการตรวจสอบอิสระ (Independent Evaluation)**:
  1. *Security Boundary*: ตรวจสอบว่า PTY commands ไม่เปิดช่องโหว่ arbitrary code execution นอกเหนือจาก session ที่ระบุ และตรวจสอบว่า `DangerousConfirmModal` ไม่สามารถถูก bypass ด้วย keyboard shortcut หรือ programmatic call
  2. *Data Integrity*: ตรวจสอบว่า `validate_group_move` ป้องกัน cycle ได้ในทุกกรณี และ Foreign Keys บน SQLite บังคับใช้อย่างสมบูรณ์
  3. *Process Reaper*: ตรวจสอบว่าไม่มี child process รั่วไหลเมื่อปิดแท็บหรือปิดแอปพลิเคชัน

---

## Risks and open questions

1. **PSReadLine Buffer Wrap บน Windows ConPTY**:
   - ConPTY อาจตัดบรรทัดตามขนาดหน้าต่างแรกสุดที่สร้าง หากขนาดเริ่มต้นไม่ตรงกับ xterm pane
   - *Mitigation*: ส่งขนาดแถวและคอลัมน์จริงจาก `FitAddon` ไปยัง `pty_create` ตั้งแต่จังหวะแรกสุด (ไม่ใช่รอจนกระทั่ง resize event ครั้งแรก)
2. **การลบโฟลเดอร์ที่มีคำสั่งอยู่ภายใน**:
   - *Resolution*: ออกแบบ modal ให้ผู้ใช้เลือกว่า: 1. ลบทั้งโฟลเดอร์และคำสั่งทั้งหมด (`DELETE CASCADE`), หรือ 2. ลบเฉพาะโฟลเดอร์และย้ายคำสั่งไปไว้ที่ Root (`SET NULL`)
