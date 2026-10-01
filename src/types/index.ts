export type ShellType = "powershell" | "cmd";

export interface SavedCommand {
  id: string;
  groupId: string | null;
  name: string;
  command: string;
  notes: string;
  shellType: ShellType;
  isDangerous: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommandGroup {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  defaultShell: ShellType;
  defaultCwd: string | null;
  terminalFontSize: number;
  terminalFontFamily: string;
  powershellPath: string;
  cmdPath: string;
  theme: "dark";
}

export interface TerminalTab {
  id: string;
  sessionId: string;
  title: string;
  shell: ShellType;
  cwd?: string;
  isAlive: boolean;
}

export interface PtyOutputPayload {
  sessionId: string;
  data: string;
}

export interface PtyExitPayload {
  sessionId: string;
  exitCode: number | null;
}

export interface LibraryPayload {
  groups: CommandGroup[];
  commands: SavedCommand[];
  settings: Record<string, string>;
}
