import React, { useEffect, useState, useCallback } from "react";
import { Sidebar } from "./components/library/Sidebar";
import { TerminalDock } from "./components/terminal/TerminalDock";
import { CommandEditModal } from "./components/modals/CommandEditModal";
import { GroupEditModal } from "./components/modals/GroupEditModal";
import { SettingsModal } from "./components/modals/SettingsModal";
import { DangerousConfirmModal } from "./components/modals/DangerousConfirmModal";
import { ShellMismatchModal } from "./components/modals/ShellMismatchModal";
import { useCommandStore } from "./stores/useCommandStore";
import { useTerminalStore } from "./stores/useTerminalStore";
import { useSettingsStore } from "./stores/useSettingsStore";
import { CommandGroup, SavedCommand } from "./types";

export const App: React.FC = () => {
  const { groups, loadLibrary, saveCommand, createGroup, updateGroup, deleteGroup } =
    useCommandStore();

  const { tabs, activeTabId, createTab, closeTab, runCommand, insertCommand } =
    useTerminalStore();

  const { loadSettings } = useSettingsStore();

  // Modals state
  const [isCommandModalOpen, setIsCommandModalOpen] = useState(false);
  const [commandToEdit, setCommandToEdit] = useState<SavedCommand | null>(null);
  const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<CommandGroup | null>(null);
  const [parentGroupIdForNew, setParentGroupIdForNew] = useState<string | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [dangerousCommand, setDangerousCommand] = useState<SavedCommand | null>(null);
  const [mismatchCommand, setMismatchCommand] = useState<SavedCommand | null>(null);

  // Initialize data on mount
  useEffect(() => {
    loadSettings();
    loadLibrary();
  }, []);

  // Create initial tab once settings are loaded if no tabs exist
  useEffect(() => {
    if (tabs.length === 0) {
      createTab();
    }
  }, []);

  // Execution pipeline: verifies dangerous flag and shell compatibility
  const executeVerified = useCallback(
    async (cmd: SavedCommand) => {
      let currentActiveId = activeTabId;
      let activeTab = tabs.find((t) => t.id === currentActiveId);

      // If no tab is active, open a new tab matching the command's shell
      if (!activeTab) {
        currentActiveId = await createTab(cmd.shellType);
        activeTab = tabs.find((t) => t.id === currentActiveId);
      }

      if (activeTab && activeTab.shell !== cmd.shellType) {
        setMismatchCommand(cmd);
        return;
      }

      await runCommand(cmd.command);
    },
    [activeTabId, tabs, createTab, runCommand]
  );

  const handleRunCommand = useCallback(
    (cmd: SavedCommand) => {
      if (cmd.isDangerous) {
        setDangerousCommand(cmd);
      } else {
        executeVerified(cmd);
      }
    },
    [executeVerified]
  );

  const handleInsertCommand = useCallback(
    async (cmd: SavedCommand) => {
      let activeTab = tabs.find((t) => t.id === activeTabId);
      if (!activeTab) {
        await createTab(cmd.shellType);
      }
      await insertCommand(cmd.command);
    },
    [activeTabId, tabs, createTab, insertCommand]
  );

  // Dangerous confirmation callback
  const handleConfirmDangerous = useCallback(() => {
    if (dangerousCommand) {
      const cmd = dangerousCommand;
      setDangerousCommand(null);
      executeVerified(cmd);
    }
  }, [dangerousCommand, executeVerified]);

  // Shell mismatch callbacks
  const handleMismatchOpenNewTabAndRun = useCallback(async () => {
    if (mismatchCommand) {
      const cmd = mismatchCommand;
      setMismatchCommand(null);
      await createTab(cmd.shellType);
      // Wait slight moment for new tab PTY to connect
      setTimeout(async () => {
        await runCommand(cmd.command);
      }, 150);
    }
  }, [mismatchCommand, createTab, runCommand]);

  const handleMismatchRunAnyway = useCallback(async () => {
    if (mismatchCommand) {
      const cmd = mismatchCommand;
      setMismatchCommand(null);
      await runCommand(cmd.command);
    }
  }, [mismatchCommand, runCommand]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+T: New Terminal
      if (e.ctrlKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        createTab();
      }
      // Ctrl+W: Close Terminal Tab (only when modal is not open)
      else if (
        e.ctrlKey &&
        e.key.toLowerCase() === "w" &&
        !isCommandModalOpen &&
        !isGroupModalOpen &&
        !isSettingsModalOpen
      ) {
        e.preventDefault();
        if (activeTabId) {
          closeTab(activeTabId);
        }
      }
      // Ctrl+K: Focus Search Input
      else if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
      // Ctrl+Shift+N: New Command
      else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setCommandToEdit(null);
        setDefaultGroupId(null);
        setIsCommandModalOpen(true);
      }
      // Ctrl+, : Settings
      else if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setIsSettingsModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTabId, isCommandModalOpen, isGroupModalOpen, isSettingsModalOpen, createTab, closeTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
      {/* Resizable Left Sidebar */}
      <Sidebar
        onNewCommand={(grpId) => {
          setCommandToEdit(null);
          setDefaultGroupId(grpId || null);
          setIsCommandModalOpen(true);
        }}
        onNewGroup={(parentGrpId) => {
          setGroupToEdit(null);
          setParentGroupIdForNew(parentGrpId || null);
          setIsGroupModalOpen(true);
        }}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onEditCommand={(cmd) => {
          setCommandToEdit(cmd);
          setIsCommandModalOpen(true);
        }}
        onRenameGroup={(grp) => {
          setGroupToEdit(grp);
          setIsGroupModalOpen(true);
        }}
        onDeleteGroup={async (grp) => {
          const deleteChildren = confirm(
            `Delete folder "${grp.name}"?\n\nClick OK to delete this folder and all its contents, or Cancel to keep the commands at root level.`
          );
          await deleteGroup(grp.id, deleteChildren);
        }}
        onRunCommand={handleRunCommand}
        onInsertCommand={handleInsertCommand}
      />

      {/* Main Terminal Dock */}
      <TerminalDock />

      {/* Modals */}
      <CommandEditModal
        isOpen={isCommandModalOpen}
        commandToEdit={commandToEdit}
        groups={groups}
        defaultGroupId={defaultGroupId}
        onSave={async (cmdData) => {
          await saveCommand(cmdData);
        }}
        onClose={() => setIsCommandModalOpen(false)}
      />

      <GroupEditModal
        isOpen={isGroupModalOpen}
        groupToEdit={groupToEdit}
        groups={groups}
        parentGroupId={parentGroupIdForNew}
        onSave={async (name, parentId) => {
          if (groupToEdit) {
            await updateGroup(groupToEdit.id, name, parentId);
          } else {
            await createGroup(name, parentId);
          }
        }}
        onClose={() => setIsGroupModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      <DangerousConfirmModal
        isOpen={dangerousCommand !== null}
        command={dangerousCommand}
        onConfirm={handleConfirmDangerous}
        onCancel={() => setDangerousCommand(null)}
      />

      <ShellMismatchModal
        isOpen={mismatchCommand !== null}
        command={mismatchCommand}
        activeShell={activeTab?.shell || null}
        onOpenNewTabAndRun={handleMismatchOpenNewTabAndRun}
        onRunAnyway={handleMismatchRunAnyway}
        onCancel={() => setMismatchCommand(null)}
      />
    </div>
  );
};
