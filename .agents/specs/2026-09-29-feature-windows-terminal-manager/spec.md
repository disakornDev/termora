# Termora — Modern Windows Interactive Terminal & Saved Command Manager

> Type: feature
> Risk: high-risk
> Artifact profile: full
> Status: Delivering
> Execution: continuous
> Architecture required: yes
> Date: 2026-09-29
> Branch: feat/termora-core
> Delivery mode: pr
> Delivery target: Default branch updated
> Documentation: true
> Documentation source: .agents/workflow.json
> Fresh review: required
> Fresh review reasons: security,data-integrity
> Fresh review stage: wf-review
> Fresh review status: passed
> Fresh reviewer context: subagent:fresh_reviewer
> Fresh reviewed change set: Rust Backend: src-tauri/src/, src-tauri/tests/, src-tauri/Cargo.toml, src-tauri/tauri.conf.json; Frontend: src/, package.json, vite.config.ts, tailwind.config.js; Documentation & Specs: README.md, DESIGN.md, .agents/specs/2026-09-29-feature-windows-terminal-manager/ (spec.md, plan.md, architecture.md, tasks.md, verification.md)
> Fresh review evidence: ./review.md

## บริบท

ปัจจุบันผู้พัฒนาและผู้ดูแลระบบบน Windows 11 ต้องสลับไปมาระหว่างการพิมพ์คำสั่งใน Terminal (PowerShell, Command Prompt) และการค้นหาคำสั่งที่บันทึกไว้ในสคริปต์ โน้ต หรือเอกสารภายนอก ซึ่งขาดความปลอดภัยในการรันคำสั่งอันตราย (destructive commands) และขาดความสะดวกในการจัดการคำสั่งแบบลำดับชั้น (hierarchical groups)

จากการสำรวจความต้องการและเทคโนโลยี:
1. การจำลอง Terminal ผ่านการรัน `exec()` แบบ one-shot ไม่ตอบโจทย์ CLI ที่เป็น interactive เช่น คำถามยืนยัน `(Y/N)`, `[y/N]`, การเลือกตัวเลือก, รหัสผ่าน หรือคำสั่งที่ทำงานต่อเนื่อง (long-running) จำเป็นต้องใช้ Windows ConPTY (Pseudo-Console) จริง
2. สถาปัตยกรรม Desktop เลือกระหว่าง Tauri (Rust) และ Electron:
   - Tauri v2 ร่วมกับ Rust crate `portable-pty` (v0.8) พิสูจน์แล้วว่าทำงานร่วมกับ Windows ConPTY ได้อย่างมีเสถียรภาพสูง มี thread สำหรับจัดการ UTF-8 stream decoding ข้าม boundary, จัดการ wait/drain ป้องกัน pipe ค้างตอน shell ปิด, จัดการ child process cleanup (ป้องกัน zombie `powershell.exe`/`conhost.exe`) และมีความปลอดภัยในการแยก IPC ชัดเจน
   - ใช้ทรัพยากรน้อยกว่า Electron อย่างมาก (~40MB idle RAM เทียบกับ ~150MB+) และปลอดภัยโดยค่าเริ่มต้น
3. ฝั่ง UI นำระบบดีไซน์จาก `DESIGN.md` (MongoDB Dark Canvas Theme) มาประยุกต์ใช้ โดยเน้น Dark Mode First (`#001e2b` deep teal-black canvas, `#00ed64` MongoDB electric green accent, `#1c2d38` hairline borders, `#fa6e39` danger badge)

## เป้าหมาย

สร้างแอปพลิเคชัน Windows Desktop สมัยใหม่ที่ผสาน 4 แกนหลักเข้าด้วยกัน:
1. **Interactive Terminal**: รองรับทั้ง PowerShell และ Command Prompt ผ่าน Windows ConPTY จริง รองรับ stdin/stdout/stderr, ANSI colors, arrow keys, Tab completion, Ctrl+C, UTF-8/Unicode และ interactive prompts
2. **Terminal Tabs**: รองรับการเปิดหลายแท็บพร้อมกัน โดยแต่ละแท็บมี session PTY, shell, buffer และ working directory แยกจากกันอย่างอิสระ สามารถสลับ ปิด เปลี่ยนชื่อ และจัดลำดับแท็บได้
3. **Saved Command Manager & Hierarchical Groups**: บันทึก แก้ไข ค้นหา ทำสำเนา และลบคำสั่ง พร้อมจัดหมวดหมู่ในโฟลเดอร์ซ้อนกันได้ไม่จำกัดระดับ (unlimited nested groups) รองรับ Drag-and-Drop พร้อมระบบป้องกัน Tree Cycle (ไม่สามารถย้ายโฟลเดอร์แม่ไปเป็นลูกของตนเองได้)
4. **Command Execution Guard & Actions**: แยกการทำงาน 3 โหมดชัดเจน: `Copy` (ลงคลิปบอร์ด), `Insert` (แทรกลง PTY active tab เสมือนผู้ใช้พิมพ์เองโดยไม่กด Enter), และ `Run` (แทรกและรันทันที) พร้อมระบบยืนยันคำสั่งอันตราย (Dangerous Command Confirmation) ที่ไม่สามารถข้ามได้ และระบบเตือนความเข้ากันได้ของ Shell (Shell Compatibility Warning)

## Non-goals

1. การรองรับ WSL (Windows Subsystem for Linux), Git Bash หรือ SSH ในระยะ MVP (กำหนดเป็น Phase ถัดไป)
2. การทำ Cloud Sync, Remote Backup หรือการเชื่อมต่อเซิร์ฟเวอร์ภายนอก (เน้น Local-First สมบูรณ์แบบ)
3. การรันแอปพลิเคชันแบบ Elevated Administrator โดยปริยาย (เน้น Normal user permissions; elevated terminals เลื่อนไป Phase ถัดไป)
4. การสร้าง AI-assisted command generation หรือ Command Parameter Templates `{{var}}` ใน MVP

## Acceptance criteria

- [x] **AC1 (ConPTY Interactive Terminal)**: ผู้ใช้สามารถพิมพ์คำสั่งใน terminal ทั้ง PowerShell และ CMD โดยคำสั่ง interactive เช่น `Read-Host`, `cmd /c "set /p var=test: "`, หรือสคริปต์ที่ถาม `(Y/N)` สามารถรับ input จากผู้ใช้และทำงานได้ถูกต้อง ANSI colors และ cursor positioning แสดงผลถูกต้อง
- [x] **AC2 (Terminal Tabs)**: ผู้ใช้สามารถสร้างแท็บใหม่ได้ (ทั้งปุ่ม `+` แบบ default และ dropdown เลือก PowerShell / CMD), สลับแท็บ, ปิดแท็บ, และเปลี่ยนชื่อแท็บได้ โดยแต่ละแท็บมี PTY session แยกกันเด็ดขาด
- [x] **AC3 (Clean Process Termination)**: เมื่อผู้ใช้ปิดแท็บหรือปิดแอปพลิเคชัน กระบวนการลูก (child processes เช่น `powershell.exe`, `cmd.exe`, `conhost.exe`) จะถูก terminate อย่างสมบูรณ์ ไม่เหลือ zombie process ในระบบ
- [x] **AC4 (Command CRUD & Metadata)**: ผู้ใช้สามารถสร้าง แก้ไข ลบ และทำสำเนาคำสั่ง โดยเก็บข้อมูลครบถ้วน: Name, Group, Command (multi-line), Notes, Shell Type (PowerShell / Command Prompt), และ Dangerous Flag
- [x] **AC5 (Hierarchical Group Management)**: ผู้ใช้สามารถสร้างกลุ่มย่อย (subgroups) ซ้อนกันได้ไม่จำกัดระดับ เปลี่ยนชื่อกลุ่ม ย้ายกลุ่ม และลบกลุ่ม โดยระบบจะป้องกัน Tree Cycle (ห้ามย้ายกลุ่มแม่เข้าไปในกลุ่มลูกของตนเอง) และถามวิธีย้ายคำสั่งเมื่อลบกลุ่มที่มีข้อมูล
- [x] **AC6 (Search & Instant Actions)**: ค้นหาคำสั่งแบบเรียลไทม์ ครอบคลุม Name, Command content, Notes, และ Group name โดยผู้ใช้สามารถกด Copy, Insert, หรือ Run จากผลการค้นหาได้ทันที
- [x] **AC7 (Command Actions: Copy, Insert, Run)**:
  - `Copy`: คัดลอกข้อความคำสั่งลง OS clipboard
  - `Insert`: ส่งข้อความคำสั่งไปยัง PTY session ของแท็บปัจจุบันโดยตรงเสมือนผู้ใช้พิมพ์เอง โดยไม่มีการส่งอักขระ Enter (`\r`)
  - `Run`: ส่งข้อความคำสั่งพร้อมอักขระ Enter (`\r`) เพื่อรันคำสั่งทันที
- [x] **AC8 (Dangerous Command Confirmation)**: เมื่อคำสั่งที่ระบุเป็น Dangerous ถูกเรียกด้วย action `Run` ระบบจะต้องแสดง Dialog ยืนยันเสมอ พร้อมแสดงคำสั่งแบบเต็ม โดยปุ่มเริ่มต้น (default focus) ต้องเป็น `[Cancel]` และไม่สามารถข้ามการยืนยันนี้ได้
- [x] **AC9 (Shell Compatibility Warning)**: หากคำสั่งถูกกำหนดสำหรับ PowerShell แต่ active tab เป็น CMD (หรือกลับกัน) ระบบจะแจ้งเตือนและเสนอทางเลือก: [Open in New Compatible Tab & Run], [Run in Active Terminal Anyway], [Cancel]
- [x] **AC10 (Drag and Drop Organization)**: ผู้ใช้สามารถลากคำสั่งไปใส่กลุ่มอื่นได้ ลากเปลี่ยนลำดับคำสั่งได้ และลากย้ายกลุ่มได้ พร้อม visual drop indicator และบันทึกลำดับใหม่ลงฐานข้อมูล
- [x] **AC11 (Settings Persistence)**: ผู้ใช้สามารถตั้งค่า Default Shell (PowerShell / CMD), Default Working Directory, Terminal Font Size, และ Custom Shell Paths โดยค่าจะถูกบันทึกและนำมาใช้เมื่อเปิดแอปใหม่
- [x] **AC12 (Local-First Persistence & Integrity)**: ข้อมูลทั้งหมดถูกบันทึกลง SQLite ภายในเครื่องอย่างปลอดภัย มี Foreign Key constraints, Indexes, และ ACID transactions พร้อมการกู้คืนหากไฟล์ผิดพลาด
- [x] **AC13 (Design System & Dark Theme)**: UI ใช้องค์ประกอบตาม `DESIGN.md` (MongoDB Dark Canvas): พื้นหลัง `#001e2b`, เส้นขอบ `#1c2d38`, สีหลัก `#00ed64`, typography ชัดเจน รองรับการปรับขนาด Terminal window และ Split pane
- [x] **AC14 (Keyboard Shortcuts)**: รองรับชอร์ตคัตมาตรฐาน: `Ctrl+T` (New Tab), `Ctrl+W` (Close Tab), `Ctrl+K` (Search/Command Palette), `Ctrl+Shift+N` (New Command), `Ctrl+,` (Settings) โดยไม่ขัดแย้งกับคีย์ใน Terminal (เช่น `Ctrl+C`, `Ctrl+V`, `Ctrl+L`)

## Constraints

- **Platform**: Windows 11 (64-bit), Windows 10 (version 1809+ สำหรับ ConPTY API)
- **Runtime**: Tauri v2, Rust 1.77+, WebView2 Evergreen runtime
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, `@xterm/xterm` (v5+), Zustand, `@dnd-kit/core`
- **Database**: Embedded SQLite ผ่าน `rusqlite` (bundled) เพื่อความเสถียร ไม่พึ่งพา binary ภายนอก
- **Terminal Reliability**: ความถูกต้องของ ConPTY และการทำความสะอาด process มีความสำคัญสูงสุดเหนือขนาด bundle
- **Security Boundary**: Renderer isolation โดยเด็ดขาด ห้าม expose raw Node APIs หรือ generic command execution; IPC ทุกตัวต้องมี parameter validation และ sanitize input

## UI/UX direction

- **Primary Advisor**: อ้างอิง `ui-ux-pro-max` และ `DESIGN.md` (MongoDB Dark Canvas Design System)
- **Palette**:
  - Dark Canvas: `#001e2b` (Deep Teal-Black)
  - Card/Panel Surface: `#002838` / `#003d4f`
  - Borders: `#1c2d38` (Hairline Dark, 1px solid)
  - Brand Accent: `#00ed64` (Vibrant MongoDB Green)
  - Text: `#ffffff` (Headings/Active), `#e1e5e8` (Body/Commands), `#a8b3bc` (Muted/Captions)
  - Dangerous/Warning: `#fa6e39` (Orange/Red badge & dialog border)
- **Typography**:
  - UI Text: Segoe UI / Inter (14px regular for body, 13px medium for sidebar items, 16px semibold for headers)
  - Terminal & Code: Consolas / Source Code Pro / Cascadia Code (13px/14px monospace)
- **Layout**:
  - Master-Detail Split Screen:
    - Left Sidebar (Resizable, 280px-420px): Command Library Tree, Search input, Group folders, Command items with inline action buttons (Run, Insert, Copy) and context menu
    - Right Main Area: Terminal Tabs bar at top, followed by active `@xterm/xterm` canvas dock filling the remaining viewport
  - Modals: Centered, backdrop blur, hairline border, keyboard navigable (`Escape` to close, `Enter` to confirm safe actions)

## คำถามที่ต้องยืนยัน

1. โครงสร้างฐานข้อมูล SQLite: ใช้ SQLite via `rusqlite` bundled ใน Rust backend เพื่อให้การค้นหาคำสั่งและการจัดการลำดับชั้นเป็น ACID compliant โดยตรง
2. การปิดแท็บที่มี process กำลังทำงาน: ให้ส่ง SIGINT/terminate ไปยัง child process และปิด PTY ทันที หรือแสดง modal เตือนว่ายังมี process ทำงานอยู่? (เลือกให้เตือนหาก process ยังไม่ส่ง exit event)

## Documentation evidence

- Mode: scoped
- Result: Updated
- Change set: feat/termora-core
- Check ID: DOC-TERMORA-01
- Inputs: README.md, architecture.md, spec.md, tasks.md
- Documents: README.md
- Checks: Relative links, installation steps, ConPTY features, shortcuts table verified
- Limitations: None
