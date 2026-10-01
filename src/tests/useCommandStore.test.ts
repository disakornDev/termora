import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCommandStore } from "../stores/useCommandStore";
import * as tauriCore from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("useCommandStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCommandStore.setState({
      groups: [],
      commands: [],
      searchQuery: "",
      selectedGroupId: null,
      expandedGroupIds: [],
      isLoaded: false,
    });
  });

  it("loads library from backend storage", async () => {
    const mockLibrary = {
      groups: [
        {
          id: "g1",
          name: "Development",
          parentId: null,
          position: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      commands: [
        {
          id: "c1",
          groupId: "g1",
          name: "Start Dev Server",
          command: "pnpm dev",
          notes: "Starts Vite",
          shellType: "powershell" as const,
          isDangerous: false,
          position: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      settings: {},
    };

    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(mockLibrary);

    await useCommandStore.getState().loadLibrary();

    const state = useCommandStore.getState();
    expect(state.groups.length).toBe(1);
    expect(state.commands.length).toBe(1);
    expect(state.commands[0].name).toBe("Start Dev Server");
  });

  it("creates a group and expands parent", async () => {
    const mockNewGroup = {
      id: "g2",
      name: "Docker",
      parentId: "g1",
      position: 1,
      createdAt: "",
      updatedAt: "",
    };

    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(mockNewGroup);

    const group = await useCommandStore.getState().createGroup("Docker", "g1");

    expect(group).toEqual(mockNewGroup);
    expect(useCommandStore.getState().groups.length).toBe(1);
    expect(useCommandStore.getState().expandedGroupIds).toContain("g1");
  });

  it("moves a command into another group", async () => {
    const existingCmd = {
      id: "c1",
      groupId: null,
      name: "Prune",
      command: "docker system prune",
      notes: "",
      shellType: "powershell" as const,
      isDangerous: true,
      position: 0,
      createdAt: "",
      updatedAt: "",
    };

    useCommandStore.setState({ commands: [existingCmd] });

    const updatedCmd = { ...existingCmd, groupId: "g-docker" };
    vi.mocked(tauriCore.invoke).mockResolvedValueOnce(updatedCmd);

    const success = await useCommandStore.getState().moveCommand("c1", "g-docker");

    expect(success).toBe(true);
    expect(useCommandStore.getState().commands[0].groupId).toBe("g-docker");
  });
});
