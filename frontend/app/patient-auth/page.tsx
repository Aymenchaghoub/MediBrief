"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { savePatientToken } from "@/lib/auth";
import { useToast } from "@/components/ui/toast-provider";
import { Brand } from "@/components/ui/brand";

interface AuthResponse {
  token: string;
}

export default function PatientAuthPage() {
  return (
    <Suspense
      fallback={
        <p className="muted" style={{ padding: "32px" }}>
          Loading…
        </p>
      }
    >
      <PatientAuthInner />
    </Suspense>
  );
}

function PatientAuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();

  const tokenFromUrl = searchParams.get("token");

  const [mode, setMode] = useState<"login" | "setup">(
    tokenFromUrl ? "setup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(tokenFromUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* If token arrives via URL, switch to setup mode */
  useEffect(() => {
    if (tokenFromUrl) {
      setInviteToken(tokenFromUrl);
      setMode("setup");
    }
  }, [tokenFromUrl]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (mode === "login") {
        const res = await apiFetch<AuthResponse>("/auth/patient-login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        savePatientToken(res.token);
        pushToast("Signed in", "success");
      } else {
        const res = await apiFetch<AuthResponse>("/auth/patient-setup", {
          method: "POST",
          body: JSON.stringify({ inviteToken, email, password }),
        });
        savePatientToken(res.token);
        pushToast("Account activated", "success");
      }

      router.push("/portal");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      pushToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <Brand />
        <h1 className="section-title">
          {mode === "login" ? "Patient sign in" : "Activate your account"}
        </h1>
        <p className="muted section-description">
          {mode === "login"
            ? "Sign in to view your health records, appointments, and AI summaries."
            : tokenFromUrl
              ? "Your clinic sent you an invite. Choose an email and password to activate your portal."
              : "Paste the invite token your clinic gave you, then set your email and password."}
        </p>

        <div className="button-row auth-actions auth-mode-switch">
          <button
            type="button"
            className={`btn ${mode === "login" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("login")}
            aria-pressed={mode === "login"}
          >
            Login
          </button>
          <button
            type="button"
            className={`btn ${mode === "setup" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("setup")}
            aria-pressed={mode === "setup"}
          >
            Activate
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={busy}>
          {mode === "setup" && (
            <div className="field">
              <label htmlFor="invite-token">Invite Token</label>
              <input
                id="invite-token"
                placeholder="e.g. abc12345-…"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                required
                readOnly={!!tokenFromUrl}
              />
              {tokenFromUrl && (
                <p
                  className="muted"
                  style={{ fontSize: "0.8rem", marginTop: "4px" }}
                >
                  Auto-filled from your invite link.
                </p>
              )}
            </div>
          )}

          <div className="field">
            <label htmlFor="patient-email">Email</label>
            <input
              id="patient-email"
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="patient-password">Password</label>
            <input
              id="patient-password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="button-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Sign In"
                  : "Activate Account"}
            </button>
          </div>
        </form>

        <p className="muted auth-switch-note">
          Are you a clinic staff member?{" "}
          <a href="/auth" className="text-link">
            Staff login →
          </a>
        </p>
      </div>
    </section>
  );
}
