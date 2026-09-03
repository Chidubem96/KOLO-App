"use client";
import { useEffect, useState } from "react";
import { configured, supabase } from "@/lib/supabase";
import { KoloProvider } from "@/lib/store";
import { Auth } from "@/components/Auth";
import { AppShell } from "@/components/AppShell";

export default function Page() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!configured)
    return (
      <div className="authwrap">
        <div className="authcard">
          <div className="brand" style={{ fontSize: 24, marginBottom: 10 }}>
            {/* icon omitted */}Kolo
          </div>
          <p className="abouttext">
            The app isn&apos;t configured yet. Copy{" "}
            <code>.env.local.example</code> to <code>.env.local</code> and set
            your Supabase and Anthropic keys, then restart. See{" "}
            <code>README.md</code>.
          </p>
        </div>
      </div>
    );

  if (!ready)
    return (
      <div className="authwrap">
        <div className="authcard" style={{ textAlign: "center" }}>
          Loading…
        </div>
      </div>
    );

  if (!userId) return <Auth />;

  return (
    <KoloProvider userId={userId}>
      <AppShell />
    </KoloProvider>
  );
}
