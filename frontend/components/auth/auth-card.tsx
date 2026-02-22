"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { useToast } from "@/components/ui/toast-provider";

interface AuthResponse {
  token: string;
}

export function AuthCard() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clinicName, setClinicName] = useState("MediBrief Demo Clinic");
  const [clinicEmail, setClinicEmail] = useState("clinic@medibrief.dev");
  const [adminName, setAdminName] = useState("Dr. Demo");
  const [subscriptionPlan, setSubscriptionPlan] = useState("portfolio");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const result = await apiFetch<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        saveToken(result.token);
        pushToast("Signed in successfully.", "success");
      } else {
        const result = await apiFetch<AuthResponse>("/auth/register-clinic", {
          method: "POST",
          body: JSON.stringify({
            clinicName,
            clinicEmail,
            subscriptionPlan,
            adminName,
            adminEmail: email,
            password,
          }),
        });
        saveToken(result.token);
        pushToast("Clinic created successfully.", "success");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Authentication failed";
      setError(message);
      pushToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-shell">
      <div className="auth-card">
        <p className="brand-kicker">MediBrief Access</p>
        <h1 className="section-title">{mode === "login" ? "Clinic Sign In" : "Register Clinic"}</h1>
        <p className="muted section-description">
          Use your clinic account to access patients, analytics, and AI summaries.
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
            className={`btn ${mode === "register" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setMode("register")}
            aria-pressed={mode === "register"}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "register" ? (
            <>
              <div className="field">
                <label htmlFor="clinic-name">Clinic name</label>
                <input
                  id="clinic-name"
                  value={clinicName}
                  onChange={(event) => setClinicName(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="clinic-email">Clinic email</label>
                <input
                  id="clinic-email"
                  type="email"
                  value={clinicEmail}
                  onChange={(event) => setClinicEmail(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="admin-name">Admin name</label>
                <input
                  id="admin-name"
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="plan">Subscription plan</label>
                <input
                  id="plan"
                  value={subscriptionPlan}
                  onChange={(event) => setSubscriptionPlan(event.target.value)}
                  required
                />
              </div>
            </>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="doctor@clinic.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="button-row auth-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Clinic"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
