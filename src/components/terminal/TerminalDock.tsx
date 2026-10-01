import React from "react";
import { Terminal as TerminalIcon, Plus } from "lucide-react";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { TerminalTabs } from "./TerminalTabs";
import { TerminalPane } from "./TerminalPane";

export const TerminalDock: React.FC = () => {
  const { tabs, activeTabId, createTab } = useTerminalStore();

  return (
    <div className="flex flex-col flex-1 h-full bg-canvas overflow-hidden">
      {/* Tab bar header */}
      <TerminalTabs />

      {/* Main Terminal Area */}
      <div className="relative flex-1 w-full h-full bg-canvas overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4 border border-hairline">
              <TerminalIcon className="w-8 h-8 text-brand" />
            </div>
            <h3 className="text-base font-semibold text-ink-strong mb-1">
              No Active Terminal
            </h3>
            <p className="text-xs text-ink-muted max-w-sm mb-4">
              Open a new interactive PowerShell or Command Prompt terminal tab to start typing commands or executing saved snippets.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => createTab("powershell")}
                className="flex items-center gap-2 px-3 py-2 bg-brand text-canvas font-semibold text-xs rounded hover:bg-brand-deep transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Open PowerShell</span>
              </button>
              <button
                type="button"
                onClick={() => createTab("cmd")}
                className="flex items-center gap-2 px-3 py-2 bg-surface border border-hairline text-ink text-xs rounded hover:bg-surface-hover hover:border-hairline-strong transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Open CMD</span>
              </button>
            </div>
          </div>
        ) : (
          tabs.map((tab) => (
            <TerminalPane
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
            />
          ))
        )}
      </div>
    </div>
  );
};
