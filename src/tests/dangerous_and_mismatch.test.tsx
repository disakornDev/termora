import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DangerousConfirmModal } from "../components/modals/DangerousConfirmModal";
import { ShellMismatchModal } from "../components/modals/ShellMismatchModal";
import { SavedCommand } from "../types";

const mockDangerousCommand: SavedCommand = {
  id: "cmd-danger",
  groupId: null,
  name: "Delete Prod DB",
  command: "drop database production;",
  notes: "Destructive operation",
  shellType: "powershell",
  isDangerous: true,
  position: 0,
  createdAt: "",
  updatedAt: "",
};

describe("DangerousConfirmModal (AC8)", () => {
  it("renders command and requires explicit confirmation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DangerousConfirmModal
        isOpen={true}
        command={mockDangerousCommand}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Verify modal is visible
    expect(screen.getByText("Potentially Dangerous Command")).toBeDefined();
    expect(screen.getByText("Delete Prod DB")).toBeDefined();
    expect(screen.getByText("drop database production;")).toBeDefined();

    // Verify Cancel button
    const cancelBtn = screen.getByText("Cancel (Safe)");
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    // Verify Confirm button
    const confirmBtn = screen.getByText("Run Dangerous Command");
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("ShellMismatchModal (AC9)", () => {
  it("warns about shell mismatch and provides options", () => {
    const onOpenNew = vi.fn();
    const onRunAnyway = vi.fn();
    const onCancel = vi.fn();

    render(
      <ShellMismatchModal
        isOpen={true}
        command={mockDangerousCommand}
        activeShell="cmd"
        onOpenNewTabAndRun={onOpenNew}
        onRunAnyway={onRunAnyway}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText("Shell Compatibility Notice")).toBeDefined();

    const openNewBtn = screen.getByText("Open in New PowerShell Tab & Run");
    fireEvent.click(openNewBtn);
    expect(onOpenNew).toHaveBeenCalledTimes(1);

    const runAnywayBtn = screen.getByText("Run in Command Prompt Anyway");
    fireEvent.click(runAnywayBtn);
    expect(onRunAnyway).toHaveBeenCalledTimes(1);
  });
});
