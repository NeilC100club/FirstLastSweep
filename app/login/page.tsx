"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-pitch border border-chalk/10 rounded-2xl p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="First and Last" className="h-20 w-auto mx-auto mb-4" />
        <div className="font-mono text-xs tracking-widest text-gold font-bold mb-2 text-center">
          NEWPORT COUNTY 100 CLUB FUNDRAISING SWEEP
        </div>
        <h1 className="font-display text-3xl mb-6 text-center">Welcome back.</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
            />
          </div>
          <div>
            <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
            />
          </div>

          {error && <p className="text-red text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gold text-[#241C00] font-bold disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-chalk/60 mt-6">
          New here?{" "}
          <Link href="/signup" className="text-gold font-semibold">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
