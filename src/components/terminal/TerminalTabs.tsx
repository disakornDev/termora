import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Terminal, ChevronDown } from "lucide-react";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { ShellType } from "../../types";

export const TerminalTabs: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, renameTab, createTab } =
    useTerminalStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleStartRename = (id: string, currentTitle: string) => {
    setEditingTabId(id);
    setEditingTitle(currentTitle);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      renameTab(id, editingTitle.trim());
    }
    setEditingTabId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleSaveRename(id);
    } else if (e.key === "Escape") {
      setEditingTabId(null);
    }
  };

  const handleCreate = (shell?: ShellType) => {
    createTab(shell);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex items-center bg-canvas-dark border-b border-hairline px-2 select-none h-10 overflow-x-auto no-scrollbar">
      {/* Tabs List */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onDoubleClick={() => handleStartRename(tab.id, tab.title)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-medium cursor-pointer border-t-2 transition-all min-w-[120px] max-w-[200px] h-8 ${
                isActive
                  ? "bg-canvas text-ink-strong border-brand shadow-sm"
                  : "bg-surface/50 text-ink-muted border-transparent hover:bg-surface hover:text-ink"
              }`}
            >
              {/* Shell Badge */}
              <span
                className={`px-1 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold ${
                  tab.shell === "powershell"
                    ? "bg-[#1e3a5f] text-[#6bb0ff]"
                    : "bg-[#2a3e4d] text-ink"
                }`}
              >
                {tab.shell === "powershell" ? "PS" : "CMD"}
              </span>

              {/* Title / Edit Input */}
              {isEditing ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveRename(tab.id)}
                  onKeyDown={(e) => handleKeyDown(e, tab.id)}
                  autoFocus
                  className="bg-canvas-soft border border-hairline-strong text-ink text-xs px-1 rounded outline-none w-full"
                />
              ) : (
                <span className="truncate flex-1" title={tab.title}>
                  {tab.title}
                </span>
              )}

              {/* Process Status Dot */}
              {!tab.isAlive && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-ink-steel flex-shrink-0"
                  title="Process completed"
                />
              )}

              {/* Close Tab Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-hairline rounded p-0.5 text-ink-muted hover:text-ink transition-opacity ml-1 flex-shrink-0"
                title="Close Tab (Ctrl+W)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* New Tab Button & Dropdown */}
      <div className="relative flex items-center ml-2" ref={dropdownRef}>
        <div className="flex items-center rounded bg-surface border border-hairline hover:border-hairline-strong">
          <button
            type="button"
            onClick={() => handleCreate()}
            className="p-1 text-ink-muted hover:text-brand hover:bg-surface-hover rounded-l transition-colors"
            title="New Terminal (Ctrl+T)"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="p-1 text-ink-muted hover:text-ink hover:bg-surface-hover rounded-r border-l border-hairline transition-colors"
            title="Choose Shell"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 top-8 w-48 bg-surface border border-hairline rounded-md shadow-2xl py-1 z-50">
            <button
              type="button"
              onClick={() => handleCreate("powershell")}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-ink hover:bg-surface-hover hover:text-brand transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-[#6bb0ff]" />
              <span>New PowerShell Tab</span>
            </button>
            <button
              type="button"
              onClick={() => handleCreate("cmd")}
              className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs text-ink hover:bg-surface-hover hover:text-brand transition-colors"
            >
              <Terminal className="w-3.5 h-3.5 text-ink-steel" />
              <span>New Command Prompt Tab</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
