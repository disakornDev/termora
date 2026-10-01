import React, { useState, useEffect } from "react";
import { X, AlertTriangle, Terminal } from "lucide-react";
import { CommandGroup, SavedCommand, ShellType } from "../../types";

interface CommandEditModalProps {
  isOpen: boolean;
  commandToEdit: SavedCommand | null;
  groups: CommandGroup[];
  defaultGroupId: string | null;
  onSave: (commandData: {
    id?: string;
    groupId: string | null;
    name: string;
    command: string;
    notes?: string;
    shellType: ShellType;
    isDangerous: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export const CommandEditModal: React.FC<CommandEditModalProps> = ({
  isOpen,
  commandToEdit,
  groups,
  defaultGroupId,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string | null>(defaultGroupId);
  const [command, setCommand] = useState("");
  const [notes, setNotes] = useState("");
  const [shellType, setShellType] = useState<ShellType>("powershell");
  const [isDangerous, setIsDangerous] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (commandToEdit) {
      setName(commandToEdit.name);
      setGroupId(commandToEdit.groupId);
      setCommand(commandToEdit.command);
      setNotes(commandToEdit.notes || "");
      setShellType(commandToEdit.shellType);
      setIsDangerous(commandToEdit.isDangerous);
    } else {
      setName("");
      setGroupId(defaultGroupId);
      setCommand("");
      setNotes("");
      setShellType("powershell");
      setIsDangerous(false);
    }
  }, [commandToEdit, defaultGroupId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        id: commandToEdit?.id,
        groupId: groupId || null,
        name: name.trim(),
        command: command.trim(),
        notes: notes.trim(),
        shellType,
        isDangerous,
      });
      onClose();
    } catch (err) {
      console.error("Save command error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-surface border border-hairline rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
      >
        <div className="flex items-center justify-between px-5 py-3.5 bg-canvas-dark border-b border-hairline">
          <div className="flex items-center gap-2 text-ink-strong font-semibold text-sm">
            <Terminal className="w-4 h-4 text-brand" />
            <span>{commandToEdit ? "Edit Command" : "New Saved Command"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Command Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Restart PM2, Docker Prune"
              className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
            />
          </div>

          {/* Group & Shell Type Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Folder / Group
              </label>
              <select
                value={groupId || ""}
                onChange={(e) => setGroupId(e.target.value ? e.target.value : null)}
                className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
              >
                <option value="">(Root / Unfiled)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Shell Environment
              </label>
              <select
                value={shellType}
                onChange={(e) => setShellType(e.target.value as ShellType)}
                className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none font-mono"
              >
                <option value="powershell">PowerShell</option>
                <option value="cmd">Command Prompt</option>
              </select>
            </div>
          </div>

          {/* Command Code */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Command Script *
            </label>
            <textarea
              required
              rows={4}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="pnpm install&#10;docker system prune -af"
              className="w-full px-3 py-2 bg-canvas-dark text-ink font-mono text-xs rounded border border-hairline focus:border-brand focus:outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explanation or reminder for this command"
              className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
            />
          </div>

          {/* Dangerous Flag Toggle */}
          <div className="flex items-start gap-2.5 p-3 rounded border border-danger/30 bg-danger/5">
            <input
              type="checkbox"
              id="isDangerous"
              checked={isDangerous}
              onChange={(e) => setIsDangerous(e.target.checked)}
              className="mt-0.5 rounded border-hairline text-danger focus:ring-0"
            />
            <label htmlFor="isDangerous" className="cursor-pointer select-none">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Mark as Potentially Dangerous</span>
              </div>
              <p className="text-[11px] text-ink-steel mt-0.5">
                Always triggers a confirmation modal before running to prevent accidental execution of destructive commands.
              </p>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-surface hover:bg-surface-hover border border-hairline text-xs font-medium text-ink rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-brand hover:bg-brand-deep text-canvas font-semibold text-xs rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : commandToEdit ? "Update Command" : "Save Command"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
