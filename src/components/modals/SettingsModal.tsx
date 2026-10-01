import React, { useState } from "react";
import { X, Settings as SettingsIcon, Save } from "lucide-react";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { ShellType } from "../../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSetting } = useSettingsStore();

  const [defaultShell, setDefaultShell] = useState<ShellType>(settings.defaultShell);
  const [defaultCwd, setDefaultCwd] = useState(settings.defaultCwd || "");
  const [terminalFontSize, setTerminalFontSize] = useState(settings.terminalFontSize);
  const [terminalFontFamily, setTerminalFontFamily] = useState(settings.terminalFontFamily);
  const [powershellPath, setPowershellPath] = useState(settings.powershellPath);
  const [cmdPath, setCmdPath] = useState(settings.cmdPath);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSetting("defaultShell", defaultShell);
    await updateSetting("defaultCwd", defaultCwd.trim());
    await updateSetting("terminalFontSize", terminalFontSize);
    await updateSetting("terminalFontFamily", terminalFontFamily.trim());
    await updateSetting("powershellPath", powershellPath.trim());
    await updateSetting("cmdPath", cmdPath.trim());

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-surface border border-hairline rounded-lg shadow-2xl overflow-hidden"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-canvas-dark border-b border-hairline">
          <div className="flex items-center gap-2 text-ink-strong font-semibold text-sm">
            <SettingsIcon className="w-4 h-4 text-brand" />
            <span>Settings</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* General Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-brand uppercase tracking-wider">
              General
            </h4>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Default Shell for New Terminals
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                    defaultShell === "powershell"
                      ? "border-brand bg-brand/10 text-ink-strong"
                      : "border-hairline bg-canvas-soft text-ink-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultShell"
                    value="powershell"
                    checked={defaultShell === "powershell"}
                    onChange={() => setDefaultShell("powershell")}
                    className="hidden"
                  />
                  <span className="w-2 h-2 rounded-full border border-brand flex items-center justify-center">
                    {defaultShell === "powershell" && (
                      <span className="w-1 h-1 rounded-full bg-brand" />
                    )}
                  </span>
                  <span>PowerShell</span>
                </label>

                <label
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs ${
                    defaultShell === "cmd"
                      ? "border-brand bg-brand/10 text-ink-strong"
                      : "border-hairline bg-canvas-soft text-ink-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="defaultShell"
                    value="cmd"
                    checked={defaultShell === "cmd"}
                    onChange={() => setDefaultShell("cmd")}
                    className="hidden"
                  />
                  <span className="w-2 h-2 rounded-full border border-brand flex items-center justify-center">
                    {defaultShell === "cmd" && (
                      <span className="w-1 h-1 rounded-full bg-brand" />
                    )}
                  </span>
                  <span>Command Prompt</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Default Working Directory (Optional)
              </label>
              <input
                type="text"
                value={defaultCwd}
                onChange={(e) => setDefaultCwd(e.target.value)}
                placeholder="e.g. C:\Projects or leave empty for user home"
                className="w-full px-3 py-1.5 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Terminal Appearance */}
          <div className="space-y-3 pt-2 border-t border-hairline">
            <h4 className="text-xs font-semibold text-brand uppercase tracking-wider">
              Terminal Appearance
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Font Size (px)
                </label>
                <input
                  type="number"
                  min={10}
                  max={28}
                  value={terminalFontSize}
                  onChange={(e) => setTerminalFontSize(parseInt(e.target.value, 10) || 14)}
                  className="w-full px-3 py-1.5 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">
                  Font Family
                </label>
                <input
                  type="text"
                  value={terminalFontFamily}
                  onChange={(e) => setTerminalFontFamily(e.target.value)}
                  className="w-full px-3 py-1.5 bg-canvas-soft text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Shell Executable Paths */}
          <div className="space-y-3 pt-2 border-t border-hairline">
            <h4 className="text-xs font-semibold text-brand uppercase tracking-wider">
              Shell Executable Paths
            </h4>

            <div>
              <label className="block text-[11px] text-ink-steel mb-0.5">
                PowerShell Path
              </label>
              <input
                type="text"
                value={powershellPath}
                onChange={(e) => setPowershellPath(e.target.value)}
                className="w-full px-2.5 py-1 bg-canvas-soft text-ink text-xs font-mono rounded border border-hairline focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-ink-steel mb-0.5">
                Command Prompt Path
              </label>
              <input
                type="text"
                value={cmdPath}
                onChange={(e) => setCmdPath(e.target.value)}
                className="w-full px-2.5 py-1 bg-canvas-soft text-ink text-xs font-mono rounded border border-hairline focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          {/* Save Action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-surface hover:bg-surface-hover border border-hairline text-xs font-medium text-ink rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-1.5 bg-brand hover:bg-brand-deep text-canvas font-semibold text-xs rounded transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savedSuccess ? "Saved!" : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
