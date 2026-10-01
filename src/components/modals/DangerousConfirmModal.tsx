import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { SavedCommand } from "../../types";

interface DangerousConfirmModalProps {
  command: SavedCommand | null;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DangerousConfirmModal: React.FC<DangerousConfirmModalProps> = ({
  command,
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Focus Cancel button by default for safety
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen || !command) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-surface border-2 border-danger rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-danger/10 border-b border-hairline">
          <div className="flex items-center gap-2.5 text-danger font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>Potentially Dangerous Command</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-ink-muted">
            This command has been flagged as potentially destructive or modifying critical system resources:
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-strong">{command.name}</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-feature text-brand">
                {command.shellType}
              </span>
            </div>

            {/* Code Box */}
            <div className="p-3 bg-canvas-dark border border-hairline rounded font-mono text-xs text-ink-strong overflow-x-auto max-h-48 whitespace-pre-wrap select-text">
              <code>{command.command}</code>
            </div>

            {command.notes && (
              <p className="text-[11px] text-ink-steel italic">
                Notes: {command.notes}
              </p>
            )}
          </div>

          <p className="text-xs text-danger font-medium">
            Are you sure you want to run this command in your active terminal?
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 bg-canvas-dark border-t border-hairline">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-surface hover:bg-surface-hover border border-hairline text-xs font-medium text-ink rounded transition-colors"
          >
            Cancel (Safe)
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-danger hover:bg-danger-deep text-white text-xs font-semibold rounded shadow-sm transition-colors"
          >
            Run Dangerous Command
          </button>
        </div>
      </div>
    </div>
  );
};
