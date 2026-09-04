"use client";
import { useSheet } from "../sheet-context";
import { Sheet } from "../ui";
import { Goals } from "../screens/Goals";

export function GoalsSheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Goals" onClose={close}>
      <Goals embedded />
    </Sheet>
  );
}
