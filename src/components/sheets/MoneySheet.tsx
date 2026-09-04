"use client";
import { useSheet } from "../sheet-context";
import { Sheet } from "../ui";
import { Money } from "../screens/Money";

export function MoneySheet() {
  const { close } = useSheet();
  return (
    <Sheet title="Spending & obligations" onClose={close}>
      <Money embedded />
    </Sheet>
  );
}
