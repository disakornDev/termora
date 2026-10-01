import { AlertCircle, X, Plus } from "lucide-react";
import { SavedCommand, ShellType } from "../../types";

interface ShellMismatchModalProps {
  command: SavedCommand | null;
  activeShell: ShellType | null;
  isOpen: boolean;
  onOpenNewTabAndRun: () => void;
  onRunAnyway: () => void;
  onCancel: () => void;
}

export const ShellMismatchModal: React.FC<ShellMismatchModalProps> = ({
  command,
  activeShell,
  isOpen,
  onOpenNewTabAndRun,
  onRunAnyway,
  onCancel,
}) => {
  if (!isOpen || !command) return null;

  const targetShellName = command.shellType === "powershell" ? "PowerShell" : "Command Prompt";
  const activeShellName = activeShell === "powershell" ? "PowerShell" : "Command Prompt";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-surface border border-hairline-strong rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-canvas-dark border-b border-hairline">
          <div className="flex items-center gap-2 text-ink-strong font-semibold text-sm">
            <AlertCircle className="w-4 h-4 text-brand" />
            <span>Shell Compatibility Notice</span>
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
        <div className="p-5 space-y-3.5">
          <p className="text-xs text-ink">
            This saved command was configured for <strong className="text-brand">{targetShellName}</strong>,
            but your current active terminal is running <strong className="text-[#6bb0ff]">{activeShellName}</strong>.
          </p>

          <div className="p-2.5 bg-canvas-dark border border-hairline rounded font-mono text-xs text-ink-strong truncate select-text">
            <code>{command.command}</code>
          </div>

          <p className="text-xs text-ink-muted">
            Executing commands across incompatible shell environments may result in syntax errors or unexpected behavior.
          </p>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 p-5 pt-0">
          <button
            type="button"
            onClick={onOpenNewTabAndRun}
            className="flex items-center justify-center gap-2 w-full py-2 bg-brand text-canvas font-semibold text-xs rounded hover:bg-brand-deep transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open in New {targetShellName} Tab & Run</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-1.5 bg-surface hover:bg-surface-hover border border-hairline text-xs font-medium text-ink rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRunAnyway}
              className="flex-1 py-1.5 bg-surface hover:bg-danger/20 border border-hairline hover:border-danger/50 text-xs font-medium text-ink-muted hover:text-danger rounded transition-colors"
            >
              Run in {activeShellName} Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
