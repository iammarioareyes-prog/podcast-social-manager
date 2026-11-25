"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appUrl}/api/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
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
          textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
          <h2 style={{ color: "#fff", fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
            Check your email
          </h2>
          <p style={{ color: "hsl(215 20% 55%)", fontSize: 14, lineHeight: 1.6 }}>
            We sent a confirmation link to <strong style={{ color: "#fff" }}>{email}</strong>.
            Click the link to activate your account.
          </p>
          <a href="/login" style={{ display: "block", marginTop: 24, color: "hsl(263 70% 70%)", fontSize: 14, textDecoration: "none" }}>
            ← Back to login
          </a>
        </div>
      </div>
    );
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
            Create your account
          </p>
        </div>

        <form onSubmit={handleSignup}>
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
              minLength={6}
              placeholder="At least 6 characters"
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
            <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 16px" }}>
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
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, color: "hsl(215 20% 55%)", fontSize: 13 }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: "hsl(263 70% 70%)", textDecoration: "none" }}>
            Sign in
          </a>
        </p>

        <p style={{ textAlign: "center", marginTop: 16, color: "hsl(215 20% 40%)", fontSize: 11, lineHeight: 1.5 }}>
          By signing up you agree to our{" "}
          <a href="/terms" style={{ color: "hsl(263 70% 60%)" }}>Terms</a>
          {" "}and{" "}
          <a href="/privacy" style={{ color: "hsl(263 70% 60%)" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
