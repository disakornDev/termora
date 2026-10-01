import React, { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
} from "lucide-react";
import { CommandGroup, SavedCommand } from "../../types";
import { CommandItem } from "./CommandItem";
import { useDroppable } from "@dnd-kit/core";

interface GroupNodeProps {
  group: CommandGroup;
  allGroups: CommandGroup[];
  allCommands: SavedCommand[];
  expandedGroupIds: string[];
  level?: number;
  onToggleExpand: (groupId: string) => void;
  onAddSubgroup: (parentGroupId: string) => void;
  onRenameGroup: (group: CommandGroup) => void;
  onDeleteGroup: (group: CommandGroup) => void;
  onRunCommand: (command: SavedCommand) => void;
  onInsertCommand: (command: SavedCommand) => void;
  onEditCommand: (command: SavedCommand) => void;
  onDuplicateCommand: (command: SavedCommand) => void;
  onDeleteCommand: (command: SavedCommand) => void;
}

export const GroupNode: React.FC<GroupNodeProps> = ({
  group,
  allGroups,
  allCommands,
  expandedGroupIds,
  level = 0,
  onToggleExpand,
  onAddSubgroup,
  onRenameGroup,
  onDeleteGroup,
  onRunCommand,
  onInsertCommand,
  onEditCommand,
  onDuplicateCommand,
  onDeleteCommand,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const isExpanded = expandedGroupIds.includes(group.id);

  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: {
      type: "group",
      groupId: group.id,
      group,
    },
  });

  // Subgroups
  const childGroups = allGroups.filter((g) => g.parentId === group.id);
  // Commands directly under this group
  const directCommands = allCommands.filter((c) => c.groupId === group.id);

  return (
    <div className="flex flex-col select-none">
      {/* Group Header Row */}
      <div
        ref={setNodeRef}
        className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
          isOver
            ? "border border-brand bg-brand/10 shadow-sm"
            : "hover:bg-surface/70 border border-transparent"
        }`}
        style={{ paddingLeft: `${Math.max(level * 14 + 8, 8)}px` }}
        onClick={() => onToggleExpand(group.id)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {/* Expand/Collapse Chevron */}
          <span className="text-ink-muted group-hover:text-ink">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </span>

          {/* Folder Icon */}
          <span className="text-brand flex-shrink-0">
            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5" />
            ) : (
              <Folder className="w-3.5 h-3.5" />
            )}
          </span>

          {/* Group Name */}
          <span className="font-semibold text-ink-strong truncate">{group.name}</span>

          {/* Total Command Count Badge */}
          <span className="text-[10px] px-1 py-0.2 bg-canvas-soft border border-hairline rounded text-ink-muted">
            {directCommands.length}
          </span>
        </div>

        {/* Group Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Add Subgroup button */}
          <button
            type="button"
            title="Create subgroup"
            onClick={(e) => {
              e.stopPropagation();
              onAddSubgroup(group.id);
            }}
            className="p-1 rounded text-ink-muted hover:text-brand hover:bg-surface-hover"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div className="absolute right-0 top-6 w-32 bg-surface border border-hairline rounded shadow-xl py-1 z-40 text-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onRenameGroup(group);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 text-ink hover:bg-surface-hover hover:text-brand"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDeleteGroup(group);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 text-danger hover:bg-danger/20"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Group Children (when expanded) */}
      {isExpanded && (
        <div className="flex flex-col gap-1 my-1">
          {/* Render Subgroups recursively */}
          {childGroups.map((sub) => (
            <GroupNode
              key={sub.id}
              group={sub}
              allGroups={allGroups}
              allCommands={allCommands}
              expandedGroupIds={expandedGroupIds}
              level={level + 1}
              onToggleExpand={onToggleExpand}
              onAddSubgroup={onAddSubgroup}
              onRenameGroup={onRenameGroup}
              onDeleteGroup={onDeleteGroup}
              onRunCommand={onRunCommand}
              onInsertCommand={onInsertCommand}
              onEditCommand={onEditCommand}
              onDuplicateCommand={onDuplicateCommand}
              onDeleteCommand={onDeleteCommand}
            />
          ))}

          {/* Render Direct Commands */}
          {directCommands.map((cmd) => (
            <div
              key={cmd.id}
              style={{ paddingLeft: `${(level + 1) * 14 + 12}px` }}
              className="pr-2"
            >
              <CommandItem
                command={cmd}
                onRun={onRunCommand}
                onInsert={onInsertCommand}
                onEdit={onEditCommand}
                onDuplicate={onDuplicateCommand}
                onDelete={onDeleteCommand}
              />
            </div>
          ))}

          {childGroups.length === 0 && directCommands.length === 0 && (
            <div
              style={{ paddingLeft: `${(level + 1) * 14 + 12}px` }}
              className="py-1 text-[11px] text-ink-muted/60 italic"
            >
              Folder is empty
            </div>
          )}
        </div>
      )}
    </div>
  );
};
