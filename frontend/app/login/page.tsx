"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogIn, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, player, loading, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && player) {
      router.replace("/");
    }
  }, [loading, user, player, router]);

  const handleLogin = async () => {
    setBusy(true);
    setError("");
    try {
      console.log("[auth] login button clicked");
      await signInWithGoogle();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-140px)] place-items-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(190,242,100,0.16),rgba(56,189,248,0.10),rgba(15,23,42,0.96))] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.4)]"
      >
        <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-lime-200">
              <Sparkles size={14} />
              Google authenticated cricket
            </span>
            <h1 className="max-w-lg text-4xl font-black tracking-tight text-white sm:text-5xl">
              Sign in and take the crease.
            </h1>
            <p className="max-w-md text-sm leading-6 text-slate-300">
              Use Firebase Google Sign-In to create or fetch your linked player profile,
              then continue straight into the scorebook.
            </p>

            <button
              type="button"
              onClick={handleLogin}
              disabled={busy}
              className="inline-flex items-center gap-3 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-200 disabled:opacity-60"
            >
              <LogIn size={18} />
              {busy ? "Signing in..." : "Continue with Google"}
            </button>
            {error ? <p className="text-sm text-rose-200">{error}</p> : null}
          </div>

          <div className="grid content-center gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-5">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">What happens</p>
              <ul className="mt-3 space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <Shield size={15} className="text-lime-300" />
                  Firebase verifies the Google account.
                </li>
                <li className="flex items-center gap-2">
                  <Shield size={15} className="text-lime-300" />
                  The backend creates or fetches your User record.
                </li>
                <li className="flex items-center gap-2">
                  <Shield size={15} className="text-lime-300" />
                  Your linked Player profile is loaded automatically.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
