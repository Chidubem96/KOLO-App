"use client";
import { useSheet } from "../sheet-context";
import { Sheet } from "../ui";
import { Settings } from "../screens/Settings";

export function SettingsSheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Settings" onClose={close}>
      <Settings embedded />
    </Sheet>
  );
}
