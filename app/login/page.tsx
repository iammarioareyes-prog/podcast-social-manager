"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError === "invalid_link" ? "Invalid or expired link. Please try again." : "");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "hsl(224 71% 4%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        background: "hsl(224 71% 6%)",
        border: "1px solid hsl(216 34% 17%)",
        borderRadius: 12,
        padding: "40px 36px",
        width: "100%",
        maxWidth: 400,
      }}>
        <div style={{ marginBottom: 28, textAlign: "center" }}>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>
            Ight So Bloom
          </h1>
          <p style={{ color: "hsl(215 20% 55%)", fontSize: 14, marginTop: 6 }}>
            Podcast Manager
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "hsl(213 31% 80%)", fontSize: 13, marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "hsl(216 34% 10%)",
                border: "1px solid hsl(216 34% 17%)",
                borderRadius: 6, color: "#fff",
                padding: "10px 12px", fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "hsl(213 31% 80%)", fontSize: 13, marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "hsl(216 34% 10%)",
                border: "1px solid hsl(216 34% 17%)",
                borderRadius: 6, color: "#fff",
                padding: "10px 12px", fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          {error && (
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 16, margin: "0 0 16px" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? "hsl(263 70% 35%)" : "hsl(263 70% 50%)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "11px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, color: "hsl(215 20% 55%)", fontSize: 13 }}>
          No account?{" "}
          <a href="/signup" style={{ color: "hsl(263 70% 70%)", textDecoration: "none" }}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
