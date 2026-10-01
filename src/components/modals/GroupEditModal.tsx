import React, { useState, useEffect } from "react";
import { X, Folder } from "lucide-react";
import { CommandGroup } from "../../types";

interface GroupEditModalProps {
  isOpen: boolean;
  groupToEdit: CommandGroup | null;
  groups: CommandGroup[];
  parentGroupId: string | null;
  onSave: (name: string, parentId: string | null) => Promise<void>;
  onClose: () => void;
}

export const GroupEditModal: React.FC<GroupEditModalProps> = ({
  isOpen,
  groupToEdit,
  groups,
  parentGroupId,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(parentGroupId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (groupToEdit) {
      setName(groupToEdit.name);
      setParentId(groupToEdit.parentId);
    } else {
      setName("");
      setParentId(parentGroupId);
    }
  }, [groupToEdit, parentGroupId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onSave(name.trim(), parentId);
      onClose();
    } catch (err) {
      console.error("Group save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out self and descendants to avoid showing invalid parents in dropdown
  const availableParents = groups.filter((g) => g.id !== groupToEdit?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-surface border border-hairline rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
      >
        <div className="flex items-center justify-between px-4 py-3 bg-canvas-dark border-b border-hairline">
          <div className="flex items-center gap-2 text-ink-strong font-semibold text-sm">
            <Folder className="w-4 h-4 text-brand" />
            <span>{groupToEdit ? "Rename Folder" : "New Folder"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Folder Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Node.js, Docker, Servers"
              className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1">
              Parent Folder
            </label>
            <select
              value={parentId || ""}
              onChange={(e) => setParentId(e.target.value ? e.target.value : null)}
              className="w-full px-3 py-2 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
            >
              <option value="">(Root Level)</option>
              {availableParents.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-hairline text-xs font-medium text-ink rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-3.5 py-1.5 bg-brand hover:bg-brand-deep text-canvas font-semibold text-xs rounded transition-colors disabled:opacity-50"
            >
              {isSaving ? "Saving..." : groupToEdit ? "Rename" : "Create Folder"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
