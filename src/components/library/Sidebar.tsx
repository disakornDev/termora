import React, { useState, useRef, useEffect } from "react";
import {
  Terminal as TerminalIcon,
  Plus,
  FolderPlus,
  Settings as SettingsIcon,
  Layers,
} from "lucide-react";
import { useCommandStore } from "../../stores/useCommandStore";
import { CommandGroup, SavedCommand } from "../../types";
import { SearchBar } from "./SearchBar";
import { GroupNode } from "./GroupNode";
import { CommandItem } from "./CommandItem";
import { DndTreeContainer } from "./DndTreeContainer";

interface SidebarProps {
  onNewCommand: (defaultGroupId?: string | null) => void;
  onNewGroup: (parentGroupId?: string | null) => void;
  onOpenSettings: () => void;
  onEditCommand: (cmd: SavedCommand) => void;
  onRenameGroup: (group: CommandGroup) => void;
  onDeleteGroup: (group: CommandGroup) => void;
  onRunCommand: (cmd: SavedCommand) => void;
  onInsertCommand: (cmd: SavedCommand) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNewCommand,
  onNewGroup,
  onOpenSettings,
  onEditCommand,
  onRenameGroup,
  onDeleteGroup,
  onRunCommand,
  onInsertCommand,
}) => {
  const {
    groups,
    commands,
    searchQuery,
    expandedGroupIds,
    toggleGroupExpand,
    duplicateCommand,
    deleteCommand,
  } = useCommandStore();

  const [width, setWidth] = useState(320);
  const isResizingRef = useRef(false);

  // Resize handler for left sidebar
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = Math.max(260, Math.min(e.clientX, 500));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = "default";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleStartResize = () => {
    isResizingRef.current = true;
    document.body.style.cursor = "col-resize";
  };

  // Search filtering logic
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? commands.filter((c) => {
        const groupName = groups.find((g) => g.id === c.groupId)?.name.toLowerCase() || "";
        return (
          c.name.toLowerCase().includes(normalizedQuery) ||
          c.command.toLowerCase().includes(normalizedQuery) ||
          (c.notes && c.notes.toLowerCase().includes(normalizedQuery)) ||
          groupName.includes(normalizedQuery)
        );
      })
    : null;

  // Root level groups and commands
  const rootGroups = groups.filter((g) => !g.parentId);
  const rootCommands = commands.filter((c) => !c.groupId);

  return (
    <div
      style={{ width }}
      className="relative flex flex-col h-full bg-canvas-dark border-r border-hairline flex-shrink-0 select-none overflow-hidden"
    >
      {/* App Header / Brand */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-hairline bg-canvas">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-brand/10 border border-brand/40 flex items-center justify-center">
            <TerminalIcon className="w-3.5 h-3.5 text-brand" />
          </div>
          <span className="font-bold text-xs tracking-wider text-ink-strong uppercase">
            Termora
          </span>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onNewCommand(null)}
            title="New Command (Ctrl+Shift+N)"
            className="flex items-center gap-1 px-2 py-1 rounded bg-brand text-canvas text-xs font-semibold hover:bg-brand-deep transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Cmd</span>
          </button>

          <button
            type="button"
            onClick={() => onNewGroup(null)}
            title="New Folder"
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings (Ctrl+,)"
            className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {searchResults !== null ? (
          /* Search Results Mode */
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between px-2 text-[10px] text-ink-steel font-mono uppercase">
              <span>Found {searchResults.length} matching commands</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-ink-muted/70">
                No commands found matching "{searchQuery}"
              </div>
            ) : (
              searchResults.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  command={cmd}
                  onRun={onRunCommand}
                  onInsert={onInsertCommand}
                  onEdit={onEditCommand}
                  onDuplicate={(c) => duplicateCommand(c)}
                  onDelete={(c) => deleteCommand(c.id)}
                />
              ))
            )}
          </div>
        ) : (
          /* Normal Hierarchical Tree View with Drag & Drop */
          <DndTreeContainer>
            <div className="space-y-1">
              {rootGroups.map((group) => (
                <GroupNode
                  key={group.id}
                  group={group}
                  allGroups={groups}
                  allCommands={commands}
                  expandedGroupIds={expandedGroupIds}
                  onToggleExpand={toggleGroupExpand}
                  onAddSubgroup={(parent) => onNewGroup(parent)}
                  onRenameGroup={onRenameGroup}
                  onDeleteGroup={onDeleteGroup}
                  onRunCommand={onRunCommand}
                  onInsertCommand={onInsertCommand}
                  onEditCommand={onEditCommand}
                  onDuplicateCommand={(c) => duplicateCommand(c)}
                  onDeleteCommand={(c) => deleteCommand(c.id)}
                />
              ))}

              {/* Root / Unfiled Commands */}
              {rootCommands.length > 0 && (
                <div className="pt-2 border-t border-hairline/40 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-ink-steel uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3 h-3" />
                    <span>Unfiled Commands</span>
                  </div>
                  {rootCommands.map((cmd) => (
                    <CommandItem
                      key={cmd.id}
                      command={cmd}
                      onRun={onRunCommand}
                      onInsert={onInsertCommand}
                      onEdit={onEditCommand}
                      onDuplicate={(c) => duplicateCommand(c)}
                      onDelete={(c) => deleteCommand(c.id)}
                    />
                  ))}
                </div>
              )}

              {groups.length === 0 && commands.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <p className="text-xs text-ink-muted mb-3">
                    Your command library is currently empty.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNewCommand(null)}
                    className="px-3 py-1.5 bg-brand text-canvas font-semibold text-xs rounded hover:bg-brand-deep transition-colors"
                  >
                    Create First Command
                  </button>
                </div>
              )}
            </div>
          </DndTreeContainer>
        )}
      </div>

      {/* Resize Handle on Right Edge */}
      <div
        onMouseDown={handleStartResize}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand/60 transition-colors z-20"
      />
    </div>
  );
};
