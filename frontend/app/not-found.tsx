import Link from "next/link";
import { Brand } from "@/components/ui/brand";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="not-found-title">
        <Brand />
        <p className="brand-kicker" style={{ marginTop: 24 }}>
          Error 404
        </p>
        <h1
          className="section-title"
          id="not-found-title"
          style={{ marginTop: 8 }}
        >
          Page not found
        </h1>
        <p className="section-description">This page could not be found</p>
        <div className="button-row auth-actions">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link href="/auth" className="btn btn-secondary">
            Clinic sign in
          </Link>
        </div>
        <p className="muted auth-switch-note">
          <Link href="/patient-auth" className="text-link">
            Patient portal
          </Link>
        </p>
      </section>
    </main>
  );
}
