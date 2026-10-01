import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTerminalStore } from "../stores/useTerminalStore";
import * as tauriCore from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useTerminalStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      tabs: [],
      activeTabId: null,
      tabCounter: 0,
    });
  });

  it("creates a new terminal tab and sets it active", async () => {
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce("test-session-123");

    const tabId = await useTerminalStore.getState().createTab("powershell");

    expect(tabId).toBeTruthy();
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_create", {
      shell: "powershell",
      cwd: undefined,
      rows: 24,
      cols: 80,
    });

    const state = useTerminalStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].sessionId).toBe("test-session-123");
    expect(state.tabs[0].shell).toBe("powershell");
    expect(state.activeTabId).toBe(tabId);
  });

  it("closes a tab and switches active to the remaining tab", async () => {
    vi.mocked(tauriCore.invoke).mockResolvedValue("mock-session");

    const tab1 = await useTerminalStore.getState().createTab("powershell");
    const tab2 = await useTerminalStore.getState().createTab("cmd");

    expect(useTerminalStore.getState().tabs.length).toBe(2);
    expect(useTerminalStore.getState().activeTabId).toBe(tab2);

    // Close tab2
    await useTerminalStore.getState().closeTab(tab2!);

    const state = useTerminalStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.activeTabId).toBe(tab1);
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_close", {
      sessionId: "mock-session",
    });
  });

  it("differentiates insertCommand vs runCommand", async () => {
    vi.mocked(tauriCore.invoke).mockResolvedValue("test-session");
    await useTerminalStore.getState().createTab("powershell");

    // Insert command: text ONLY, no trailing \r
    await useTerminalStore.getState().insertCommand("git status");
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_write", {
      sessionId: "test-session",
      data: "git status",
    });

    // Run command: text WITH trailing \r
    await useTerminalStore.getState().runCommand("pnpm test");
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_write", {
      sessionId: "test-session",
      data: "pnpm test\r",
    });
  });
});
