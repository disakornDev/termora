import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { ShellType, TerminalTab } from "../types";
import { useSettingsStore } from "./useSettingsStore";

interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;
  tabCounter: number;

  createTab: (shell?: ShellType, cwd?: string) => Promise<string | null>;
  closeTab: (tabId: string) => Promise<void>;
  setActiveTab: (tabId: string) => void;
  renameTab: (tabId: string, newTitle: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  writeToActiveTab: (data: string) => Promise<void>;
  insertCommand: (commandText: string) => Promise<void>;
  runCommand: (commandText: string) => Promise<void>;
  handlePtyExit: (sessionId: string, exitCode: number | null) => void;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  tabCounter: 0,

  createTab: async (preferredShell, cwd) => {
    const defaultShell = useSettingsStore.getState().settings.defaultShell;
    const shell = preferredShell || defaultShell;
    const defaultCwd = useSettingsStore.getState().settings.defaultCwd;
    const targetCwd = cwd || defaultCwd || undefined;

    const counter = get().tabCounter + 1;
    const shellName = shell === "powershell" ? "PowerShell" : "Command Prompt";
    const title = `${shellName} ${counter}`;

    try {
      const sessionId = await invoke<string>("pty_create", {
        shell,
        cwd: targetCwd,
        rows: 24,
        cols: 80,
      });

      const newTab: TerminalTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        sessionId,
        title,
        shell,
        cwd: targetCwd,
        isAlive: true,
      };

      set((state) => ({
        tabs: [...state.tabs, newTab],
        activeTabId: newTab.id,
        tabCounter: counter,
      }));

      return newTab.id;
    } catch (err) {
      console.error("Failed to create PTY tab:", err);
      return null;
    }
  },

  closeTab: async (tabId) => {
    const { tabs, activeTabId } = get();
    const tabToClose = tabs.find((t) => t.id === tabId);
    if (!tabToClose) return;

    try {
      await invoke("pty_close", { sessionId: tabToClose.sessionId });
    } catch (err) {
      console.error("Error closing PTY session:", err);
    }

    const remainingTabs = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;

    if (activeTabId === tabId) {
      if (remainingTabs.length > 0) {
        const closedIndex = tabs.findIndex((t) => t.id === tabId);
        const newIndex = Math.min(closedIndex, remainingTabs.length - 1);
        nextActiveId = remainingTabs[newIndex].id;
      } else {
        nextActiveId = null;
      }
    }

    set({
      tabs: remainingTabs,
      activeTabId: nextActiveId,
    });
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  renameTab: (tabId, newTitle) => {
    if (!newTitle.trim()) return;
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, title: newTitle.trim() } : t)),
    }));
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const updated = [...state.tabs];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { tabs: updated };
    });
  },

  writeToActiveTab: async (data) => {
    const { tabs, activeTabId } = get();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab || !activeTab.isAlive) return;

    try {
      await invoke("pty_write", {
        sessionId: activeTab.sessionId,
        data,
      });
    } catch (err) {
      console.error("Failed to write to active terminal:", err);
    }
  },

  // Insert command: sends text WITHOUT \r
  insertCommand: async (commandText) => {
    await get().writeToActiveTab(commandText);
  },

  // Run command: sends text WITH \r
  runCommand: async (commandText) => {
    await get().writeToActiveTab(`${commandText}\r`);
  },

  handlePtyExit: (sessionId, _exitCode) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.sessionId === sessionId ? { ...t, isAlive: false } : t
      ),
    }));
  },
}));
