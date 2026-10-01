import React from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { useCommandStore } from "../../stores/useCommandStore";

interface DndTreeContainerProps {
  children: React.ReactNode;
}

export const DndTreeContainer: React.FC<DndTreeContainerProps> = ({ children }) => {
  const moveCommand = useCommandStore((s) => s.moveCommand);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag begins to prevent accidental drags
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Check if dragging a command into a group or root
    if (activeData?.type === "command" && overData?.type === "group") {
      const commandId = activeData.commandId as string;
      const targetGroupId = overData.groupId as string | null;

      if (commandId) {
        moveCommand(commandId, targetGroupId);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {children}
    </DndContext>
  );
};
