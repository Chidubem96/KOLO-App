"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "./supabase";
import { loadKolo, addTxns, recordContribution } from "./api";
import { pendingRecurring } from "./engine";
import type { KoloData } from "./types";
import { todayStr } from "./format";

interface Ctx {
  data: KoloData | null;
  loading: boolean;
  recurringPosted: number;
  clearRecurringNote: () => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}
const KoloCtx = createContext<Ctx | null>(null);

export function KoloProvider({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<KoloData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recurringPosted, setRecurringPosted] = useState(0);
  const busy = useRef(false);

  const applyRecurring = useCallback(async (d: KoloData) => {
    const pend = pendingRecurring(d);
    if (!pend.length) return 0;
    const txRows = pend
      .filter((p) => p.target === "transaction")
      .map((p) => ({
        date: p.date!,
        amount: p.amount!,
        category: p.category!,
        note: p.note!,
        person: !!p.person,
        source: "recurring",
        auto: true,
        period: p.period!,
      }));
    const contribs = pend.filter((p) => p.target === "contribution");
    if (txRows.length) await addTxns(d.userId, txRows as any);
    for (const c of contribs) {
      await recordContribution({
        circleId: c.circleId!,
        userId: d.userId,
        cycle: c.cycle!,
        amount: c.amount!,
        paidOn: c.date || todayStr(),
        auto: true,
      });
      // also log the spend for the contribution
      await addTxns(d.userId, [
        {
          date: c.date!,
          amount: c.amount!,
          category: "circle",
          note: c.note!,
          person: false,
          source: "recurring",
          auto: true,
          period: c.period!,
        },
      ] as any);
    }
    return pend.length;
  }, []);

  const reload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      let d = await loadKolo(userId);
      const posted = await applyRecurring(d);
      if (posted) {
        d = await loadKolo(userId);
        setRecurringPosted((n) => n + posted);
      }
      setData(d);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [userId, applyRecurring]);

  useEffect(() => {
    reload();
  }, [reload]);

  // realtime: changes to my circles -> reload
  const circleIds = (data?.circles ?? []).map((c) => c.id).sort().join(",");
  useEffect(() => {
    if (!circleIds) return;
    const sb = supabase();
    const list = circleIds.split(",");
    const filt = "circle_id=in.(" + list.join(",") + ")";
    const ch = sb
      .channel("kolo-circles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_members", filter: filt },
        () => reload()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circle_contributions",
          filter: filt,
        },
        () => reload()
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [circleIds, reload]);

  // catch up recurring when tab regains focus
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reload]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    location.reload();
  }, []);

  return (
    <KoloCtx.Provider
      value={{
        data,
        loading,
        recurringPosted,
        clearRecurringNote: () => setRecurringPosted(0),
        reload,
        signOut,
      }}
    >
      {children}
    </KoloCtx.Provider>
  );
}

export function useKolo() {
  const c = useContext(KoloCtx);
  if (!c) throw new Error("useKolo outside provider");
  return c;
}
