import Link from "next/link";

export default function Home() {
  return (
    <section className="landing">
      <div className="container">
        <div className="landing-card">
          <p className="brand-kicker">MediBrief</p>
          <h1 className="hero-title">AI-Powered Clinical Summary SaaS</h1>
          <p className="hero-subtitle">
            Multi-tenant medical tracking platform with patient monitoring, consultation timelines,
            audit logs, and AI-generated clinical summaries.
          </p>

          <div className="button-row">
            <Link href="/dashboard" className="btn btn-primary">
              Open Dashboard
            </Link>
            <Link href="/auth" className="btn btn-secondary">
              Auth Workspace
            </Link>
          </div>
        </div>

        <div className="panel panel-spaced">
          <p className="muted">Status: backend modules and API flows are wired and validated phase-by-phase.</p>
        </div>
      </div>
    </section>
  );
}
