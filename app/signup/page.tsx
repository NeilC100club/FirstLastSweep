"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is on (default in Supabase), there's no session yet.
    setCheckEmail(true);
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5">
        <div className="w-full max-w-md bg-pitch border border-chalk/10 rounded-2xl p-8 text-center">
          <h1 className="font-display text-2xl mb-3">Check your email</h1>
          <p className="text-chalk/70 text-sm">
            We've sent a confirmation link to {email}. Click it, then come back and sign in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-md bg-pitch border border-chalk/10 rounded-2xl p-8">
        <div className="text-xs tracking-widest text-gold font-bold font-mono mb-2">
          NEWPORT COUNTY 100 CLUB FUNDRAISING SWEEP
        </div>
        <h1 className="font-display text-3xl mb-6">Claim your minute.</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono tracking-wide text-chalk/60 mb-1">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-chalk/5 border border-chalk/15 text-chalk"
            />
          </div>
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
              minLength={6}
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="text-sm text-chalk/60 mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-gold font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
