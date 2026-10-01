import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { CommandGroup, LibraryPayload, SavedCommand, ShellType } from "../types";

interface CommandInputPayload {
  id?: string;
  groupId: string | null;
  name: string;
  command: string;
  notes?: string;
  shellType: ShellType;
  isDangerous: boolean;
  position?: number;
}

interface CommandState {
  groups: CommandGroup[];
  commands: SavedCommand[];
  searchQuery: string;
  selectedGroupId: string | null;
  expandedGroupIds: string[];
  isLoaded: boolean;

  loadLibrary: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  selectGroup: (groupId: string | null) => void;
  toggleGroupExpand: (groupId: string) => void;

  createGroup: (name: string, parentId?: string | null) => Promise<CommandGroup | null>;
  updateGroup: (id: string, name?: string, parentId?: string | null) => Promise<boolean>;
  deleteGroup: (id: string, deleteChildren: boolean) => Promise<boolean>;

  saveCommand: (input: CommandInputPayload) => Promise<SavedCommand | null>;
  deleteCommand: (id: string) => Promise<boolean>;
  duplicateCommand: (cmd: SavedCommand) => Promise<SavedCommand | null>;
  moveCommand: (cmdId: string, targetGroupId: string | null) => Promise<boolean>;
}

export const useCommandStore = create<CommandState>((set, get) => ({
  groups: [],
  commands: [],
  searchQuery: "",
  selectedGroupId: null,
  expandedGroupIds: [],
  isLoaded: false,

  loadLibrary: async () => {
    try {
      const res = await invoke<LibraryPayload>("storage_get_all");
      set({
        groups: res.groups,
        commands: res.commands,
        isLoaded: true,
      });
    } catch (err) {
      console.error("Failed to load command library:", err);
      set({ isLoaded: true });
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  selectGroup: (groupId) => {
    set({ selectedGroupId: groupId });
  },

  toggleGroupExpand: (groupId) => {
    set((state) => {
      const exists = state.expandedGroupIds.includes(groupId);
      return {
        expandedGroupIds: exists
          ? state.expandedGroupIds.filter((id) => id !== groupId)
          : [...state.expandedGroupIds, groupId],
      };
    });
  },

  createGroup: async (name, parentId) => {
    try {
      const newGroup = await invoke<CommandGroup>("storage_create_group", {
        name,
        parentId: parentId || null,
      });

      set((state) => ({
        groups: [...state.groups, newGroup],
        expandedGroupIds: parentId
          ? Array.from(new Set([...state.expandedGroupIds, parentId]))
          : state.expandedGroupIds,
      }));

      return newGroup;
    } catch (err) {
      console.error("Failed to create group:", err);
      return null;
    }
  },

  updateGroup: async (id, name, parentId) => {
    try {
      const updated = await invoke<CommandGroup>("storage_update_group", {
        id,
        name: name || undefined,
        parentId: parentId !== undefined ? parentId : undefined,
      });

      set((state) => ({
        groups: state.groups.map((g) => (g.id === id ? updated : g)),
      }));

      return true;
    } catch (err) {
      console.error("Failed to update group:", err);
      alert(String(err));
      return false;
    }
  },

  deleteGroup: async (id, deleteChildren) => {
    try {
      await invoke("storage_delete_group", { id, deleteChildren });
      await get().loadLibrary();
      return true;
    } catch (err) {
      console.error("Failed to delete group:", err);
      return false;
    }
  },

  saveCommand: async (input) => {
    try {
      const saved = await invoke<SavedCommand>("storage_save_command", { command: input });
      set((state) => {
        const exists = state.commands.some((c) => c.id === saved.id);
        return {
          commands: exists
            ? state.commands.map((c) => (c.id === saved.id ? saved : c))
            : [...state.commands, saved],
        };
      });
      return saved;
    } catch (err) {
      console.error("Failed to save command:", err);
      return null;
    }
  },

  deleteCommand: async (id) => {
    try {
      await invoke("storage_delete_command", { id });
      set((state) => ({
        commands: state.commands.filter((c) => c.id !== id),
      }));
      return true;
    } catch (err) {
      console.error("Failed to delete command:", err);
      return false;
    }
  },

  duplicateCommand: async (cmd) => {
    const input: CommandInputPayload = {
      groupId: cmd.groupId,
      name: `${cmd.name} (Copy)`,
      command: cmd.command,
      notes: cmd.notes,
      shellType: cmd.shellType,
      isDangerous: cmd.isDangerous,
    };
    return get().saveCommand(input);
  },

  moveCommand: async (cmdId, targetGroupId) => {
    const cmd = get().commands.find((c) => c.id === cmdId);
    if (!cmd) return false;

    const input: CommandInputPayload = {
      id: cmd.id,
      groupId: targetGroupId,
      name: cmd.name,
      command: cmd.command,
      notes: cmd.notes,
      shellType: cmd.shellType,
      isDangerous: cmd.isDangerous,
      position: cmd.position,
    };

    const res = await get().saveCommand(input);
    return !!res;
  },
}));
