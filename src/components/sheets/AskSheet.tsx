"use client";
import { useSheet } from "../sheet-context";
import { Sheet } from "../ui";
import { Ask } from "../screens/Ask";

export function AskSheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Ask Kolo" onClose={close}>
      <Ask />
    </Sheet>
  );
}
