import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCommandStore } from "../stores/useCommandStore";
import { useTerminalStore } from "../stores/useTerminalStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import * as tauriCore from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("End-to-End Workflow Integration Test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandStore.setState({
      groups: [],
      commands: [],
      searchQuery: "",
      selectedGroupId: null,
      expandedGroupIds: [],
      isLoaded: true,
    });
    useTerminalStore.setState({
      tabs: [],
      activeTabId: null,
      tabCounter: 0,
    });
  });

  it("completes full user lifecycle: folders, commands, tabs, execution, and settings", async () => {
    // 1. Create Folder 'Server'
    const serverGroup = {
      id: "grp-server",
      name: "Server",
      parentId: null,
      position: 0,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(serverGroup);
    const createdServer = await useCommandStore.getState().createGroup("Server");
    expect(createdServer?.id).toBe("grp-server");

    // 2. Create Subfolder 'Nginx' under 'Server'
    const nginxGroup = {
      id: "grp-nginx",
      name: "Nginx",
      parentId: "grp-server",
      position: 1,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(nginxGroup);
    const createdNginx = await useCommandStore.getState().createGroup("Nginx", "grp-server");
    expect(createdNginx?.parentId).toBe("grp-server");

    // 3. Create Command 'Restart Nginx'
    const restartCmd = {
      id: "cmd-restart-nginx",
      groupId: "grp-nginx",
      name: "Restart Nginx",
      command: "nginx -s reload",
      notes: "Reloads nginx config",
      shellType: "powershell" as const,
      isDangerous: false,
      position: 0,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(restartCmd);
    const savedCmd = await useCommandStore.getState().saveCommand(restartCmd);
    expect(savedCmd?.command).toBe("nginx -s reload");

    // 4. Create Dangerous Command 'Drop Database'
    const dropCmd = {
      id: "cmd-drop-db",
      groupId: "grp-server",
      name: "Drop Database",
      command: "Remove-Item -Recurse ./db_data",
      notes: "Destructive",
      shellType: "powershell" as const,
      isDangerous: true,
      position: 1,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(dropCmd);
    const savedDangerous = await useCommandStore.getState().saveCommand(dropCmd);
    expect(savedDangerous?.isDangerous).toBe(true);

    // 5. Create Terminal Tab
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce("session-pty-1");
    const tabId = await useTerminalStore.getState().createTab("powershell");
    expect(tabId).toBeTruthy();
    expect(useTerminalStore.getState().activeTabId).toBe(tabId);

    // 6. Test 'Insert' action (no \r)
    await useTerminalStore.getState().insertCommand(restartCmd.command);
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_write", {
      sessionId: "session-pty-1",
      data: "nginx -s reload",
    });

    // 7. Test 'Run' action (with \r)
    await useTerminalStore.getState().runCommand(restartCmd.command);
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_write", {
      sessionId: "session-pty-1",
      data: "nginx -s reload\r",
    });

    // 8. Update and Persist Settings
    await useSettingsStore.getState().updateSetting("defaultShell", "cmd");
    expect(useSettingsStore.getState().settings.defaultShell).toBe("cmd");
    expect(tauriCore.invoke).toHaveBeenCalledWith("storage_save_setting", {
      key: "defaultShell",
      value: "cmd",
    });

    // 9. Close Tab safely
    await useTerminalStore.getState().closeTab(tabId!);
    expect(useTerminalStore.getState().tabs.length).toBe(0);
    expect(tauriCore.invoke).toHaveBeenCalledWith("pty_close", {
      sessionId: "session-pty-1",
    });
  });
});
