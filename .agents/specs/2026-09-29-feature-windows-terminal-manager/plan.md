# Implementation Plan — Termora Core Architecture & Development

## Evidence and analysis

### 1. Framework Evaluation: Tauri v2 vs. Electron

การเลือกระหว่าง Electron และ Tauri ได้รับการประเมินอย่างละเอียดตามข้อกำหนดในโจทย์ โดยมุ่งเน้นที่ความเสถียรของ Terminal (PTY Reliability) เป็นสำคัญที่สุด:

| มิติการเปรียบเทียบ | Tauri v2 (Rust Backend + WebView2) | Electron (Node.js Main + Chromium) |
|---|---|---|
| **Windows ConPTY Integration** | **เหนือกว่า**: Crate `portable-pty` (พัฒนาโดยผู้สร้าง WezTerm) เรียกใช้ Windows ConPTY API (`CreatePseudoConsole`) โดยตรงจาก Rust Native ปราศจากปัญหา Node.js binding | มีปัญหาความเข้ากันได้บ่อย: พึ่งพา `node-pty` ซึ่งต้องคอมไพล์ผ่าน `node-gyp` และ Visual Studio C++ Build Tools ทุกครั้งที่อัปเกรด Electron version |
| **Terminal Reliability & ConPTY EOF** | **ผ่านการพิสูจน์แล้ว**: บน Windows ConPTY reader thread จะไม่เห็น EOF ตราบใดที่ master handle ยังเปิดอยู่ ใน Rust เราสามารถสร้าง waiter thread แยกเพื่อสังเกต child process exit และทำ I/O drain grace period (150ms) ก่อน drop handle ป้องกัน deadlock ได้อย่างสมบูรณ์ | ใน `node-pty` มักพบปัญหา orphan handle หรือ pipe read ค้างเมื่อ process ลูกปิดตัวกะทันหันบน Windows |
| **Stream Decoding (Unicode/Thai/CJK)** | **แม่นยำสูง**: Rust จัดการ UTF-8 byte boundary split ด้วย `Utf8StreamDecoder` ทำให้ตัวอักษรภาษาไทย, Box-drawing characters และ Emoji ไม่กลายเป็นอักขระเสีย (`\u{FFFD}`) | ใน Node.js การแปลง buffer เป็น string บน data event มักเกิดปัญหา multibyte split หาก chunk หลุดครึ่งตัวอักษร |
| **Process Lifecycle & Zombie Reaper** | **ปลอดภัยและสะอาด**: มี `ChildKiller` และรองรับ Win32 Job Objects; เมื่อแอปปิดตัวลง (App Exit Event) หรือปิดแท็บ Rust จะ terminate process chain ทั้งหมด (`powershell.exe`, `cmd.exe`, `conhost.exe`) ไม่ทิ้ง zombie process | Electron ต้องใช้ไลบรารีเสริม เช่น `tree-kill` ในการไล่เก็บ process ลูก ซึ่งบางครั้ง ConPTY helper (`openconsole.exe` หรือ `conhost.exe`) ตกค้าง |
| **IPC & Security Boundary** | **ปลอดภัยสูง**: แยก Renderer ออกจาก OS โดยสิ้นเชิง การเรียกใช้คำสั่งต้องผ่าน `#[tauri::command]` ที่มี Serde validation ชัดเจน ไร้ความเสี่ยง Context Isolation bypass | เสี่ยงสูงหากคอนฟิก preload script หรือ contextIsolation ไม่รัดกุม หรือเปิด `nodeIntegration` |
| **Resource & Startup Performance** | ใช้หน่วยความจำต่ำ (~35-50 MB RAM ขณะเปิด 3 แท็บ), สตาร์ตแอปทันที ไม่โหลด Chromium Engine ใหม่เพราะใช้ Evergreen WebView2 ของ Windows 11 | ใช้หน่วยความจำสูง (~150-250 MB RAM ขณะ idle), ตัวติดตั้งขนาดใหญ่ (80MB+) |
| **Database Integration** | ใช้ `rusqlite` (bundled SQLite) คอมไพล์รวมใน binary ตัวเดียว ไม่ต้องติดตั้ง C runtime เพิ่มเติม | ใช้ `better-sqlite3` ซึ่งเป็น C++ addon ที่ต้อง rebuild บ่อยครั้งเมื่อ Node/Electron เปลี่ยนเวอร์ชัน |

**ข้อสรุปและการตัดสินใจ**: เลือก **Tauri v2** เป็นสถาปัตยกรรมหลักสำหรับ Termora เนื่องจากมอบความเสถียรของ ConPTY สูงสุด ปราศจากปัญหา native build friction ของ Node.js และจัดการ lifecycle ของ Windows process ได้อย่างเด็ดขาด

---

### 2. Design System Adaptation (MongoDB Dark Canvas)

จากเอกสาร `DESIGN.md` ที่สร้างขึ้นจาก `npx getdesign@latest add mongodb`:
- **โทนสีหลัก**:
  - Deep Teal Canvas (พื้นหลังหลัก): `#001e2b`
  - Panel / Card Surface (พื้นหลังการ์ด/กล่องข้อความ): `#002838` (ระดับ 1), `#003d4f` (ระดับ 2)
  - Hairline Border (เส้นขอบคมชัดแบบ Developer-focused): `#1c2d38` (1px solid)
  - Brand Accent (สีเน้นหลัก): `#00ed64` (MongoDB Electric Green) ใช้สำหรับปุ่ม Primary CTA, Active Tab Indicator, Focus Ring
  - Semantic Danger Accent: `#fa6e39` / `#ff4d4f` สำหรับป้ายกำกับคำสั่งอันตรายและกล่องยืนยัน
  - Text Colors: `#ffffff` (Heading/Active), `#e1e5e8` (Body/Commands), `#a8b3bc` (Muted/Placeholders)
- **การปรับใช้สำหรับ Desktop Terminal**:
  - เปลี่ยนจากการออกแบบหน้าเว็บการตลาดมาเป็น Desktop Workspace Layout: Sidebar ซ้ายยืดหดได้ (280-420px) สำหรับ Command Library + แท็บด้านบนสำหรับ Terminal Sessions + พื้นที่ Terminal กลางเต็มจอ
  - ตัวอักษรใช้ Segoe UI สำหรับส่วนติดต่อผู้ใช้ และ Consolas / Cascadia Code สำหรับ Terminal & Code Snippets

---

## Chosen approach

### 1. สถาปัตยกรรมระบบ (System Architecture & Boundaries)

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND (React 19 + TypeScript + Vite)              │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   Command Library     │  │          Terminal Dock Area           │  │
│  │  - Search & Filters   │  │  - Tabs Bar (PowerShell / CMD)        │  │
│  │  - Nested Tree View   │  │  - @xterm/xterm Canvas Instances      │  │
│  │  - Context Menus      │  │  - FitAddon / ResizeObserver          │  │
│  │  - Dnd-kit Container  │  │  - Input / Output synchronization     │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
│              │                                  ▲                      │
│              ▼                                  │                      │
│     Zustand Store (UI State, Tabs, Library, Settings, Modals)          │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Tauri IPC (Strongly Typed)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        TAURI DESKTOP BACKEND (Rust)                    │
│                                                                        │
│  ┌─────────────────────────┐         ┌──────────────────────────────┐  │
│  │    Storage Manager      │         │         PTY Manager          │  │
│  │  - SQLite (rusqlite)    │         │  - portable-pty (ConPTY)     │  │
│  │  - Schema & Migrations  │         │  - Threaded I/O & Waiter     │  │
│  │  - Tree Cycle Checks    │         │  - Utf8StreamDecoder         │  │
│  │  - Command CRUD         │         │  - Safe Child Killer         │  │
│  └─────────────────────────┘         └──────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Win32 API
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     OPERATING SYSTEM (Windows 11)                      │
│                                                                        │
│     ConPTY / PseudoConsole  ───►  powershell.exe / cmd.exe             │
│     Local SQLite Database   ───►  %APPDATA%/com.disakorn.termora/db    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. รายละเอียด PTY Lifecycle & Session Management

1. **PTY Session Creation (`pty_create`)**:
   - Frontend ขอเปิด session โดยส่ง `{ shell: "powershell" | "cmd", cwd?: string, rows: u16, cols: u16 }`
   - Rust PTY Manager ค้นหา path ของ shell ที่ปลอดภัยจาก `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe` หรือ `%SystemRoot%\System32\cmd.exe`
   - กำหนด `CommandBuilder` พร้อม working directory เริ่มต้น
   - เรียก `native_pty_system().openpty(PtySize)` และ `pty_pair.slave.spawn_command(cmd)`
   - สร้าง background reader thread สำหรับอ่าน stdout/stderr ผ่าน master PTY handle โดยส่งผ่าน `Utf8StreamDecoder` และ emit Tauri event `pty:data` (`{ sessionId, data }`)
   - สร้าง background waiter thread ที่เฝ้าดู child exit: เมื่อ process จบลง จะรอ drain grace period (150ms) เพื่อส่งข้อมูลตกค้างจนครบ จากนั้น drop session และ emit `pty:exit` (`{ sessionId, exitCode }`)
   - เก็บ session ไว้ใน `Arc<Mutex<HashMap<String, PtySession>>>`
2. **PTY Input & Execution (`pty_write`)**:
   - `Insert`: Frontend ส่ง `pty_write(sessionId, text)` โดยไม่มี newline (`\r`) อักขระจะปรากฏที่ cursor ปัจจุบันของ shell โดยไม่สั่งรัน
   - `Run`: Frontend ส่ง `pty_write(sessionId, format!("{}\r", text))` คำสั่งจะถูกส่งพร้อม Enter และรันทันที
3. **PTY Resizing (`pty_resize`)**:
   - เมื่อหน้าต่างหรือ panel ของ `@xterm/xterm` เปลี่ยนขนาด `FitAddon` คำนวณจำนวนแถวและคอลัมน์ (ควบคุมค่าขั้นต่ำ rows >= 3, cols >= 10)
   - ส่งคำสั่ง `pty_resize(sessionId, rows, cols)` เพื่อให้ ConPTY ปรับ screen buffer ขนานกันทันที
4. **PTY Destruction & App Exit (`pty_close`)**:
   - เมื่อผู้ใช้ปิดแท็บ: เรียก `pty_close(sessionId)` เพื่อ trigger `child.kill()` และ drop writer/master handles ทันที
   - เมื่อแอปพลิเคชันปิด (`tauri::RunEvent::ExitRequested`): วนลูป kill ทุก session ใน memory ป้องกันไม่ให้มี orphan process หลงเหลือใน Task Manager

### 3. โครงสร้างฐานข้อมูล SQLite และ Tree Hierarchy Integrity

ใช้ SQLite 3 ฝังตัวผ่าน crate `rusqlite` พร้อม Bundled feature:

```sql
-- กลุ่มคำสั่ง (Hierarchical Folders)
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- คำสั่งที่บันทึก
CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY,
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

-- การตั้งค่าระบบ
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_parent ON groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_commands_group ON commands(group_id);
CREATE INDEX IF NOT EXISTS idx_commands_search ON commands(name, command, notes);
```

**การป้องกัน Tree Cycle (Preventing Moving Parent into Own Descendant)**:
- ใน Rust backend มีฟังก์ชัน `validate_group_move(group_id: &str, target_parent_id: Option<&str>) -> Result<(), StorageError>`
- หาก `target_parent_id == Some(group_id)` ให้คืนข้อผิดพลาดทันที
- ใช้ Recursive SQL Query หรือ Parent Pointer Ancestor Traversal: ไล่ค้นหาบรรพบุรุษของ `target_parent_id` ย้อนขึ้นไปจนถึง root หากพบว่ามี node ใดตรงกับ `group_id` แสดงว่าเป็นการย้ายลงไปในกิ่งลูกของตนเอง จะไม่อนุญาตให้ทำรายการเด็ดขาด

---

### 4. Dangerous Command Guard & Shell Compatibility Matrix

1. **Dangerous Command Workflow**:
   ```
   ผู้ใช้กด "Run" บนคำสั่ง
            │
            ▼
   ตรวจ flag is_dangerous == true?
            ├─► No  ──► ดำเนินการตรวจสอบ Shell Compatibility
            │
            └─► Yes ──► แสดง Modal "Dangerous Command Confirmation"
                            - แสดงคำสั่งฉบับเต็มอย่างชัดเจน
                            - อธิบายความเสี่ยง
                            - ปุ่ม Focus เริ่มต้น: [Cancel]
                            - ปุ่มยืนยัน: [Run Command]
                            - ป้องกันการกดผ่านแบบเผลอ (ต้องคลิกชัดเจนหรือแท็บไปที่ปุ่มยืนยัน)
   ```
2. **Shell Compatibility Check**:
   - เมื่อคำสั่งผ่านการยืนยัน dangerous (หรือเป็นคำสั่งปกติ) ระบบจะตรวจ `command.shell_type` เทียบกับ `active_tab.shell`:
     - หากตรงกัน: ส่งคำสั่งรันใน active PTY session ทันที
     - หากไม่ตรงกัน (เช่น คำสั่งเขียนเป็น PowerShell แต่แท็บปัจจุบันเป็น CMD):
       - แสดง Dialog เตือน: *"This command is configured for PowerShell, but your active terminal is Command Prompt."*
       - ตัวเลือก:
         1. **[Open in New PowerShell Tab & Run]** (แนะนำ) -> สร้างแท็บ PowerShell ใหม่และรันคำสั่งทันที
         2. **[Run in Current Tab Anyway]** -> ส่งคำสั่งเข้ารันใน CMD ตามที่ผู้ใช้ยืนยัน
         3. **[Cancel]** (Safe default) -> ยกเลิกการทำงาน

---

## Simpler alternatives

1. **การใช้ Local JSON File แทน SQLite**:
   - *ข้อดี*: เขียนง่าย ไม่ต้องมี dependency `rusqlite`
   - *ข้อจำกัด*: เมื่อมีคำสั่งหลายร้อย/พันคำสั่ง การค้นหาแบบ full-text search และการตรวจสอบความถูกต้องของ Foreign Key (เช่น parent-child group) ต้องเขียน logic ทั้งหมดเองในหน่วยความจำ และมีความเสี่ยงข้อมูลเสียหายหากไฟล์ถูกเขียนทับระหว่างเครื่องดับ
   - *เหตุผลที่ไม่เลือก*: SQLite แบบ bundled มีขนาดเพียง ~1MB แต่ให้ ACID transactions, Foreign Keys, และ Indexes ที่ทำให้การจัดลำดับและการค้นหาเสถียรและรวดเร็วกว่ามาก
2. **การรันคำสั่งผ่าน Fake Terminal / Process Execution (`std::process::Command::output`)**:
   - *เหตุผลที่ไม่เลือก*: คำสั่งที่เป็น Interactive (เช่น PowerShell `Read-Host`, `cmd /c "pause"`, หรือ prompts `(Y/N)`) จะค้างหรือไม่สามารถรับ input ได้เลย และไม่รองรับ ANSI color codes ที่สมบูรณ์ จึงจำเป็นต้องใช้ ConPTY เท่านั้น

---

## Impacted surfaces

1. **Rust Backend (`src-tauri/`)**:
   - `src-tauri/Cargo.toml`: dependencies (`tauri`, `portable-pty`, `rusqlite`, `tokio`, `serde`, `serde_json`, `uuid`, `chrono`)
   - `src-tauri/src/main.rs` & `lib.rs`: Tauri builder, State registration, command handler registration
   - `src-tauri/src/pty/`: PTY manager, child process lifecycle, stream decoder, event emitters
   - `src-tauri/src/storage/`: SQLite repository, migrations, group tree validation, command queries
   - `src-tauri/src/commands/`: Tauri commands exposed to frontend
2. **Frontend UI (`src/`)**:
   - `src/components/terminal/`: `@xterm/xterm` wrapper, TerminalTabs bar, TabItem, TerminalDock
   - `src/components/library/`: CommandList, GroupTree, CommandItem, CommandCard, SearchInput, DragDropContext
   - `src/components/modals/`: CommandEditModal, DangerousConfirmModal, ShellMismatchModal, SettingsModal, GroupEditModal
   - `src/stores/`: `useTerminalStore.ts`, `useCommandStore.ts`, `useSettingsStore.ts`
   - `src/styles/`: Tailwind CSS config with MongoDB dark tokens
3. **Tests**:
   - Rust Unit & Integration Tests: PTY lifecycle, ConPTY spawn/exit, tree cycle validation, SQLite transactions
   - Frontend Vitest: Store actions, command filtering, tree rendering, drag-and-drop validation

---

## Verification strategy

### 1. Test Seams & Behavior Matrix

| Behavior / Acceptance Criteria | Interface / Test Scenario | Expected Result Source | Real Path / Mock Boundary |
|---|---|---|---|
| **ConPTY Spawning & Echo** (AC1) | Rust Integration Test: Spawn `powershell.exe` & `cmd.exe` | ConPTY emit bytes through master PTY | Real Windows ConPTY API |
| **Interactive Prompt Handling** (AC1) | Rust Test: Run `powershell -Command "Read-Host 'Enter text'"` -> write "hello\r" | Stream returns "hello" in output | Real process stdin/stdout |
| **Clean Process Termination** (AC3) | Rust Test: Spawn shell, invoke `pty_close`, check PID alive | Win32 `OpenProcess` returns false / process exits | Real Win32 Process Check |
| **Group Hierarchy Cycle Prevention** (AC5) | Rust Unit Test: `validate_group_move` with A -> B -> C -> try moving A to C | Returns `Err(StorageError::CycleDetected)` | Real SQLite In-Memory Database |
| **Insert vs Run Action** (AC7) | Frontend Component Test: Click Insert vs Run | Insert writes text only; Run writes `text + "\r"` | Mocked Tauri IPC `invoke` |
| **Dangerous Command Gate** (AC8) | Frontend E2E / Component Test: Click Run on dangerous command | Confirmation modal opens; Cancel leaves PTY untouched; Confirm executes | Real Zustand Store + Mocked IPC |
| **Shell Mismatch Prompt** (AC9) | Frontend Component Test: Run PS command on CMD tab | Warning dialog opens with 3 options | Real Zustand Store |
| **Drag & Drop Tree Reorder** (AC10) | Frontend Component Test: Drag command between groups | Updates `group_id` and `position` in store & DB | Real Store + Mocked DB |
| **Settings Persistence** (AC11) | Integration Test: Update default shell -> restart store | Reads updated shell from SQLite | Real SQLite |

### 2. Regression Scope & Edge Case Verification

- **Large Output Burst**: รันสคริปต์ที่พิมพ์ข้อความ 50,000 บรรทัดต่อเนื่อง (`1..50000 | ForEach-Object { "Line $_" }`) เพื่อทดสอบว่า UI ไม่ค้างและ reader thread ไม่เกิด memory leak
- **Multi-line Commands**: รันคำสั่งที่มีหลายบรรทัดและมี quotes/pipes ซับซ้อน เพื่อทดสอบว่า Insert และ Run ส่งข้อความครบถ้วน
- **Unicode & Thai Characters**: รันคำสั่งแสดงข้อความภาษาไทยและสัญลักษณ์พิเศษ เพื่อยืนยันว่า `Utf8StreamDecoder` ถอดรหัสได้สมบูรณ์โดยไม่แสดงอักขระเสีย
- **Sudden App Close**: เปิด 4 แท็บที่กำลังรันคำสั่งวนลูป จากนั้นกดปิดแอปทันที ตรวจสอบใน Windows Task Manager ว่าไม่มี `powershell.exe` หรือ `conhost.exe` หลงเหลืออยู่

---

## Rollout, observability and rollback

- **Rollout**: แจกจ่ายในรูปแบบ Standalone Windows Installer (`.msi` / `.exe` setup) ผ่าน Tauri Bundler และ Portable `.zip` executable
- **Observability**:
  - Rust Backend: บันทึก log ด้วย crate `tracing` / `tracing-subscriber` ไปยัง `%LOCALAPPDATA%/Termora/logs/termora.log`
  - ไม่ดักจับหรือเก็บ keystroke ของผู้ใช้เพื่อความปลอดภัยและความเป็นส่วนตัวสูงสุด
- **Rollback**:
  - โครงสร้างฐานข้อมูล SQLite รองรับการ backup อัตโนมัติ (`termora.db.bak`) ก่อนทำ migration ใหม่
  - หากฐานข้อมูลเสียหาย มีหน้าต่าง Recovery Screen ให้ผู้ใช้เลือก Restore จาก Backup หรือเริ่มฐานข้อมูลใหม่

---

## Safety and authorization

- **Safety Classification**: `Controlled System Execution`
- **Security Guardrails**:
  - แอปพลิเคชันทำงานด้วยสิทธิ์ผู้ใช้ปกติ (Standard User) ห้ามขอ UAC Elevation โดยไม่จำเป็น
  - ป้องกัน Command Injection ในระดับแอปพลิเคชัน: คำสั่งที่แทรกหรือรันจะถูกส่งเข้า PTY stream โดยตรงเหมือนผู้ใช้พิมพ์เอง ไม่มีการประกอบสตริงผ่าน shell expansion ภายนอก
  - Renderer Isolation: ไม่มี Node.js runtime ใน frontend; Frontend สื่อสารกับ Backend ผ่าน Tauri IPC commands ที่มี Type Definition ครบถ้วนเท่านั้น
  - Dangerous Command Gate: คำสั่งที่ระบุเป็น Dangerous บังคับยืนยันผ่าน Modal เสมอโดยไม่มีตัวเลือก "Don't show again"

---

## Risks and mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **ConPTY pipe deadlock on shell exit** | สูง (แอปค้างหรือแท็บไม่ตอบสนอง) | ปานกลาง | ใช้ waiter thread แยกในการรอ child process exit พร้อมกำหนด drain grace period (150ms) ก่อน drop master handle |
| **Multibyte Unicode character split** | ปานกลาง (ข้อความภาษาไทย/Emoji แสดงเป็น `\u{FFFD}`) | สูง | ใช้ `Utf8StreamDecoder` เก็บเศษ byte ตกค้างไว้รอรวมกับ chunk ถัดไปก่อนแปลงเป็น UTF-8 |
| **Tree cycle causing infinite recursion in UI** | สูง (UI ค้าง / Stack Overflow) | ต่ำ | ตรวจสอบ cycle ในระดับ Rust SQLite backend อย่างเข้มงวดด้วยการไล่บรรพบุรุษก่อนยอมรับการย้ายกลุ่ม |
| **Orphan processes upon application termination** | สูง (เปลือง CPU/RAM ในระบบ) | ปานกลาง | ผูก lifecycle hook กับ `RunEvent::ExitRequested` เพื่อ kill child processes ทั้งหมดอย่างชัดเจน |

---

## Fresh review handoff

- **Selected Stage**: `wf-review`
- **Risk Reasons**: `security`, `data-integrity`
- **Review Scope**:
  - ตรวจสอบความปลอดภัยของ PTY Manager และการกำจัด process ลูก (Process Reaper)
  - ตรวจสอบความถูกต้องของการจัดการฐานข้อมูล SQLite (Foreign Keys, Cycle Detection, Position Reordering)
  - ตรวจสอบ Dangerous Command confirmation gate ว่าไม่สามารถข้ามได้ในทุกกรณี
  - ตรวจสอบ Renderer Isolation และ Tauri IPC parameter sanitization

---

## Tasks

รายละเอียดการแบ่งงานแบบ Vertical Slices ระบุอยู่ใน [tasks.md](tasks.md)
