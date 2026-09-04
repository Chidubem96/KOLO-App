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
import { loadKolo, addTxns, recordContribution, syncDirectory } from "./api";
import {
  pendingRecurring,
  myReliability,
  cyclesCompletedByUser,
} from "./engine";
import type { KoloData } from "./types";
import { todayStr } from "./format";

interface Ctx {
  data: KoloData | null;
  loading: boolean;
  recurringPosted: number;
  clearRecurringNote: () => void;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
  toast: (msg: string) => void;
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
  const [toastMsg, setToastMsg] = useState("");
  const busy = useRef(false);
  const toastT = useRef<any>(null);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(""), 2800);
  }, []);

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

  const lastDir = useRef("");
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
      // keep my public directory card in sync (name, reliability, verification)
      try {
        const rel = myReliability(d.circles, d.userId);
        const score = d.profile.reliabilityScore
          ? Math.round((d.profile.reliabilityScore + rel.score) / 2)
          : rel.score;
        const sig = JSON.stringify([
          d.profile.name,
          score,
          d.profile.bvnVerified,
          d.profile.ninVerified,
          d.profile.phoneVerified,
        ]);
        if (sig !== lastDir.current) {
          lastDir.current = sig;
          await syncDirectory(userId, {
            name: d.profile.name || "Member",
            reliabilityScore: score,
            cyclesCompleted: cyclesCompletedByUser(d.circles, d.userId),
            bvnVerified: d.profile.bvnVerified,
            ninVerified: d.profile.ninVerified,
            phoneVerified: d.profile.phoneVerified,
          });
        }
      } catch {}
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_disputes", filter: filt },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_join_requests", filter: filt },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_float_votes", filter: filt },
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
        toast,
      }}
    >
      {children}
      <div className={"toast" + (toastMsg ? " show" : "")}>{toastMsg}</div>
    </KoloCtx.Provider>
  );
}

export function useKolo() {
  const c = useContext(KoloCtx);
  if (!c) throw new Error("useKolo outside provider");
  return c;
}
