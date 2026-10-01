import React, { useState } from "react";
import {
  Play,
  CornerDownLeft,
  Copy,
  Check,
  AlertTriangle,
  MoreVertical,
  Edit2,
  CopyPlus,
  Trash2,
} from "lucide-react";
import { SavedCommand } from "../../types";
import { useDraggable } from "@dnd-kit/core";

interface CommandItemProps {
  command: SavedCommand;
  onRun: (command: SavedCommand) => void;
  onInsert: (command: SavedCommand) => void;
  onEdit: (command: SavedCommand) => void;
  onDuplicate: (command: SavedCommand) => void;
  onDelete: (command: SavedCommand) => void;
}

export const CommandItem: React.FC<CommandItemProps> = ({
  command,
  onRun,
  onInsert,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cmd-${command.id}`,
    data: {
      type: "command",
      commandId: command.id,
      command,
    },
  });

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(command.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy command:", err);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="group relative flex flex-col gap-1 p-2 rounded bg-surface/40 hover:bg-surface border border-hairline/60 hover:border-hairline transition-all"
    >
      {/* Top Row: Name, Badges & Actions */}
      <div className="flex items-center justify-between gap-1.5">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-grab active:cursor-grabbing"
        >
          {/* Shell Badge */}
          <span
            className={`px-1 py-0.5 rounded text-[9px] font-mono uppercase font-bold flex-shrink-0 ${
              command.shellType === "powershell"
                ? "bg-[#1e3a5f] text-[#6bb0ff]"
                : "bg-[#2a3e4d] text-ink"
            }`}
          >
            {command.shellType === "powershell" ? "PS" : "CMD"}
          </span>

          {/* Dangerous Alert Indicator */}
          {command.isDangerous && (
            <span
              className="text-danger flex-shrink-0"
              title="Potentially dangerous command (requires confirmation to run)"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          )}

          {/* Command Name */}
          <span className="text-xs font-semibold text-ink-strong truncate select-text">
            {command.name}
          </span>
        </div>

        {/* 3 Primary Action Buttons */}
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 flex-shrink-0">
          {/* 1. Copy */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy to clipboard"
            className="p-1 rounded bg-canvas-soft hover:bg-surface-hover text-ink-muted hover:text-ink transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-brand" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* 2. Insert (without Enter) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInsert(command);
            }}
            title="Insert into terminal (without executing)"
            className="p-1 rounded bg-canvas-soft hover:bg-surface-hover text-ink-muted hover:text-brand transition-colors"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>

          {/* 3. Run (with Enter) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRun(command);
            }}
            title="Run immediately in terminal"
            className={`p-1 rounded font-semibold transition-colors ${
              command.isDangerous
                ? "bg-danger/20 hover:bg-danger text-danger hover:text-white"
                : "bg-brand/20 hover:bg-brand text-brand hover:text-canvas"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* More Menu Trigger */}
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
                      onEdit(command);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 text-ink hover:bg-surface-hover hover:text-brand"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDuplicate(command);
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 text-ink hover:bg-surface-hover hover:text-brand"
                  >
                    <CopyPlus className="w-3 h-3" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete(command);
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

      {/* Command Code Snippet Preview */}
      <div className="px-2 py-1 bg-canvas-dark border border-hairline/50 rounded font-mono text-[11px] text-ink/80 truncate select-text">
        <code>{command.command}</code>
      </div>

      {/* Optional Note */}
      {command.notes && (
        <span className="text-[10px] text-ink-steel truncate select-text">
          {command.notes}
        </span>
      )}
    </div>
  );
};
