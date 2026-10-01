import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, ShellType } from "../types";

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  loadSettings: (initial?: Record<string, string>) => Promise<void>;
  updateSetting: (key: keyof AppSettings, value: string | number) => Promise<void>;
}

const defaultSettings: AppSettings = {
  defaultShell: "powershell",
  defaultCwd: null,
  terminalFontSize: 14,
  terminalFontFamily: "Consolas, 'Cascadia Code', monospace",
  powershellPath: "System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  cmdPath: "System32\\cmd.exe",
  theme: "dark",
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async (initial) => {
    if (initial) {
      set({
        settings: {
          defaultShell: (initial.defaultShell as ShellType) || "powershell",
          defaultCwd: initial.defaultCwd || null,
          terminalFontSize: parseInt(initial.terminalFontSize || "14", 10),
          terminalFontFamily: initial.terminalFontFamily || defaultSettings.terminalFontFamily,
          powershellPath: initial.powershellPath || defaultSettings.powershellPath,
          cmdPath: initial.cmdPath || defaultSettings.cmdPath,
          theme: "dark",
        },
        isLoaded: true,
      });
      return;
    }

    try {
      const res = await invoke<{ settings: Record<string, string> }>("storage_get_all");
      get().loadSettings(res.settings);
    } catch (err) {
      console.error("Failed to load settings:", err);
      set({ isLoaded: true });
    }
  },

  updateSetting: async (key, value) => {
    const valStr = String(value);
    set((state) => ({
      settings: {
        ...state.settings,
        [key]: key === "terminalFontSize" ? Number(value) : value,
      },
    }));

    try {
      await invoke("storage_save_setting", { key, value: valStr });
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err);
    }
  },
}));
