"use client";
import { createContext, useContext } from "react";

export const SheetCtx = createContext<{
  open: (node: React.ReactNode) => void;
  close: () => void;
}>({ open: () => {}, close: () => {} });

export const useSheet = () => useContext(SheetCtx);
