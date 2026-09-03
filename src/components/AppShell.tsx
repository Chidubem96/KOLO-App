"use client";
import React, { useState } from "react";
import { useKolo } from "@/lib/store";
import { SheetCtx } from "./sheet-context";
import { Icon } from "./ui";
import { Onboarding } from "./Onboarding";
import { Home } from "./screens/Home";
import { Money } from "./screens/Money";
import { Circles } from "./screens/Circles";
import { Goals } from "./screens/Goals";
import { Ask } from "./screens/Ask";
import { Settings } from "./screens/Settings";
import { TxnSheet } from "./sheets/TxnSheet";
import { CircleSheet } from "./sheets/CircleSheet";
import { GoalSheet } from "./sheets/GoalSheet";

type Tab = "home" | "money" | "circles" | "goals" | "ask";

export function AppShell() {
  const { data, loading, signOut } = useKolo();
  const [tab, setTab] = useState<Tab>("home");
  const [settings, setSettings] = useState(false);
  const [sheet, setSheet] = useState<React.ReactNode>(null);

  if (loading || !data)
    return (
      <div className="wrap">
        <div className="app" style={{ display: "grid", placeItems: "center" }}>
          <span className="dim">Loading your ledger…</span>
        </div>
      </div>
    );

  if (!data.profile.onboarded) return <Onboarding />;

  const titles: Record<string, string> = {
    home: "",
    money: "This month",
    circles: "Circles",
    goals: "Goals",
    ask: "Ask Kolo",
  };

  const screen = settings ? (
    <Settings />
  ) : tab === "home" ? (
    <Home goTo={setTab} />
  ) : tab === "money" ? (
    <Money />
  ) : tab === "circles" ? (
    <Circles />
  ) : tab === "goals" ? (
    <Goals />
  ) : (
    <Ask />
  );

  const fab =
    !settings && (tab === "money" || tab === "circles" || tab === "goals") ? (
      <button
        className="fab"
        aria-label="Add"
        onClick={() =>
          setSheet(
            tab === "money" ? (
              <TxnSheet mode="manual" />
            ) : tab === "circles" ? (
              <CircleSheet />
            ) : (
              <GoalSheet />
            )
          )
        }
      >
        {Icon.plus}
      </button>
    ) : null;

  return (
    <SheetCtx.Provider
      value={{ open: (n) => setSheet(n), close: () => setSheet(null) }}
    >
      <div className="wrap">
        <div className="app">
          <div className="topbar">
            {settings ? (
              <button className="backbtn" onClick={() => setSettings(false)}>
                {Icon.back} Done
              </button>
            ) : (
              <div className="brand">
                <span style={{ width: 17, height: 17, display: "inline-flex" }}>
                  {Icon.coin}
                </span>
                Kolo
              </div>
            )}
            <div className="topctx">{settings ? "Settings" : titles[tab]}</div>
            {settings ? (
              <div style={{ width: 34 }} />
            ) : (
              <button
                className="iconbtn"
                aria-label="Settings"
                onClick={() => setSettings(true)}
              >
                {Icon.gear}
              </button>
            )}
          </div>

          <div className="screen">
            <div className="fadein" key={settings ? "s" : tab}>
              {screen}
            </div>
          </div>

          {!settings && (
            <div className="tabs">
              {(
                [
                  ["home", "Home", Icon.home],
                  ["money", "Money", Icon.money],
                  ["circles", "Circles", Icon.circles],
                  ["goals", "Goals", Icon.goals],
                  ["ask", "Ask", Icon.ask],
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
          )}

          {fab}
          {sheet}
        </div>
      </div>
    </SheetCtx.Provider>
  );
}
