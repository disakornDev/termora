import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { PtyExitPayload, PtyOutputPayload, TerminalTab } from "../../types";
import { useTerminalStore } from "../../stores/useTerminalStore";
import { useSettingsStore } from "../../stores/useSettingsStore";

interface TerminalPaneProps {
  tab: TerminalTab;
  isActive: boolean;
}

export const TerminalPane: React.FC<TerminalPaneProps> = ({ tab, isActive }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const fontSize = useSettingsStore((s) => s.settings.terminalFontSize);
  const fontFamily = useSettingsStore((s) => s.settings.terminalFontFamily);
  const handlePtyExit = useTerminalStore((s) => s.handlePtyExit);

  useEffect(() => {
    if (!containerRef.current) return;

    // MongoDB Dark Canvas Theme for xterm
    const term = new Terminal({
      theme: {
        background: "#001e2b",
        foreground: "#f4f7f6",
        cursor: "#00ed64",
        cursorAccent: "#001e2b",
        selectionBackground: "rgba(0, 237, 100, 0.25)",
        black: "#00141d",
        red: "#fa6e39",
        green: "#00ed64",
        yellow: "#f5a623",
        blue: "#4a90e2",
        magenta: "#b15dff",
        cyan: "#29c7cc",
        white: "#f4f7f6",
        brightBlack: "#5c6c7a",
        brightRed: "#ff7d4d",
        brightGreen: "#2fd6a1",
        brightYellow: "#ffd043",
        brightBlue: "#6bb0ff",
        brightMagenta: "#c680ff",
        brightCyan: "#4de2e7",
        brightWhite: "#ffffff",
      },
      fontSize,
      fontFamily,
      cursorBlink: true,
      cursorStyle: "bar",
      convertEol: true,
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    try {
      fitAddon.fit();
    } catch {
      // Ignored if container has not yet settled
    }

    // Send keystrokes directly to PTY backend
    const onDataDisposable = term.onData((data) => {
      invoke("pty_write", {
        sessionId: tab.sessionId,
        data,
      }).catch((err) => console.error("Error writing data to PTY:", err));
    });

    // Listen for PTY output events
    let unlistenData: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    listen<PtyOutputPayload>("pty:data", (event) => {
      if (event.payload.sessionId === tab.sessionId) {
        term.write(event.payload.data);
      }
    }).then((unlisten) => {
      unlistenData = unlisten;
    });

    listen<PtyExitPayload>("pty:exit", (event) => {
      if (event.payload.sessionId === tab.sessionId) {
        handlePtyExit(tab.sessionId, event.payload.exitCode);
        term.write("\r\n\x1b[90m[Process completed]\x1b[0m\r\n");
      }
    }).then((unlisten) => {
      unlistenExit = unlisten;
    });

    // Resize observer to sync xterm and ConPTY dimensions
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !fitAddonRef.current || !termRef.current) return;
      try {
        fitAddonRef.current.fit();
        const rows = termRef.current.rows;
        const cols = termRef.current.cols;
        if (rows >= 3 && cols >= 10) {
          invoke("pty_resize", {
            sessionId: tab.sessionId,
            rows,
            cols,
          }).catch((err) => console.error("PTY resize error:", err));
        }
      } catch {
        // Ignored
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      term.dispose();
    };
  }, [tab.sessionId]);

  // Adjust font size dynamically when settings change
  useEffect(() => {
    if (termRef.current && fitAddonRef.current) {
      termRef.current.options.fontSize = fontSize;
      termRef.current.options.fontFamily = fontFamily;
      try {
        fitAddonRef.current.fit();
      } catch {
        // Ignored
      }
    }
  }, [fontSize, fontFamily]);

  // Refit and focus when tab becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current && termRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
        } catch {
          // Ignored
        }
      }, 50);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-2 bg-canvas overflow-hidden"
      style={{ display: isActive ? "block" : "none" }}
    />
  );
};
