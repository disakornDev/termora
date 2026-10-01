import React from "react";
import { Search, X } from "lucide-react";
import { useCommandStore } from "../../stores/useCommandStore";

export const SearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery } = useCommandStore();

  return (
    <div className="relative w-full px-3 py-2">
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commands, notes, groups... (Ctrl+K)"
          className="w-full pl-8 pr-7 py-1.5 bg-surface text-ink text-xs rounded border border-hairline focus:border-brand focus:outline-none placeholder:text-ink-muted/70 transition-colors"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 text-ink-muted hover:text-ink p-0.5 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="absolute right-2 text-[10px] bg-canvas-soft border border-hairline px-1 rounded text-ink-muted font-mono pointer-events-none">
            Ctrl+K
          </kbd>
        )}
      </div>
    </div>
  );
};
