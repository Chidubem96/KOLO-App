"use client";
import React, { useState } from "react";
import { useKolo } from "@/lib/store";
import { SheetCtx } from "./sheet-context";
import { Icon } from "./ui";
import { Onboarding } from "./Onboarding";
import { Home } from "./screens/Home";
import { Circles } from "./screens/Circles";
import { Discover } from "./screens/Discover";
import { Grow } from "./screens/Grow";
import { You } from "./screens/You";
import { CircleSheet } from "./sheets/CircleSheet";

type Tab = "home" | "circles" | "discover" | "grow" | "you";

export function AppShell() {
  const { data, loading } = useKolo();
  const [tab, setTab] = useState<Tab>("home");
  const [stack, setStack] = useState<React.ReactNode[]>([]);
  const open = (n: React.ReactNode) => setStack((s) => [...s, n]);
  const close = () => setStack((s) => s.slice(0, -1));

  if (loading || !data)
    return (
      <div className="wrap">
        <div className="app" style={{ display: "grid", placeItems: "center" }}>
          <span className="dim">Loading…</span>
        </div>
      </div>
    );

  if (!data.profile.onboarded) return <Onboarding />;

  const titles: Record<string, string> = {
    home: "",
    circles: "Circles",
    discover: "Discover",
    grow: "Grow",
    you: "You",
  };

  const screen =
    tab === "home" ? (
      <Home goTo={setTab} />
    ) : tab === "circles" ? (
      <Circles />
    ) : tab === "discover" ? (
      <Discover />
    ) : tab === "grow" ? (
      <Grow />
    ) : (
      <You goTo={setTab} />
    );

  return (
    <SheetCtx.Provider value={{ open, close }}>
      <div className="wrap">
        <div className="app">
          <div className="topbar">
            <div className="brand">
              <span style={{ width: 16, height: 16, display: "inline-flex" }}>
                {Icon.coin}
              </span>
              Braid
            </div>
            <div className="topctx">{titles[tab]}</div>
            <div style={{ width: 34 }} />
          </div>

          <div className="screen">
            <div className="fadein" key={tab}>
              {screen}
            </div>
          </div>

          <div className="tabs">
            {(
              [
                ["home", "Home", Icon.home],
                ["circles", "Circles", Icon.circles],
              ] as [Tab, string, React.ReactNode][]
            ).map(([id, label, icon]) => (
              <button
                key={id}
                className={"tab" + (tab === id ? " on" : "")}
                onClick={() => setTab(id)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
            <button
              className="tab add"
              aria-label="Create circle"
              onClick={() => open(<CircleSheet />)}
            >
              <span className="plus">{Icon.plus}</span>
            </button>
            {(
              [
                ["grow", "Grow", Icon.grow],
                ["you", "You", Icon.you],
              ] as [Tab, string, React.ReactNode][]
            ).map(([id, label, icon]) => (
              <button
                key={id}
                className={"tab" + (tab === id ? " on" : "")}
                onClick={() => setTab(id)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>

          {stack.map((node, i) => (
            <div key={i} style={{ position: "relative", zIndex: 40 + i * 2 }}>
              {node}
            </div>
          ))}
        </div>
      </div>
    </SheetCtx.Provider>
  );
}
