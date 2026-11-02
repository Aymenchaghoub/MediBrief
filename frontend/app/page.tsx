import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { Brand } from "@/components/ui/brand";

export default function Home() {
  return (
    <div className="landing">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="container">
        <header className="landing-nav">
          <Brand />
          <nav className="landing-links" aria-label="Account access">
            <Link href="/auth">Clinic sign in</Link>
            <Link href="/patient-auth">
              Patient portal <span aria-hidden="true">↗</span>
            </Link>
          </nav>
        </header>
        <main id="main-content" tabIndex={-1}>
          <section className="landing-card" aria-labelledby="hero-title">
            <div>
              <p className="brand-kicker">
                Patient records. Clinical perspective.
              </p>
              <h1 id="hero-title" className="hero-title">
                The patient record, brought together
              </h1>
              <p className="hero-subtitle">
                Review measurements, lab results and consultation history in one
                place. Prepare a clinical summary from the information already
                in the record.
              </p>
              <div className="button-row">
                <Link href="/dashboard" className="btn btn-primary">
                  Open dashboard{" "}
                  <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </Link>
                <Link href="/auth" className="btn btn-secondary">
                  Clinic sign in
                </Link>
              </div>
            </div>
            <div
              className="folio-preview"
              aria-label="Clinical workflow overview"
            >
              <p className="folio-tab">The MediBrief record</p>
              <div className="folio-heading">
                <div>
                  <p className="brand-kicker">From record to summary</p>
                  <h2>A clinical perspective</h2>
                </div>
                <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
              </div>
              <div className="folio-sources">
                <div className="folio-source">
                  <span>01</span>
                  <div>
                    <h3>Vital signs</h3>
                    <p>Recorded measurements and changes over time</p>
                  </div>
                </div>
                <div className="folio-source">
                  <span>02</span>
                  <div>
                    <h3>Lab results</h3>
                    <p>Results, units and reference ranges</p>
                  </div>
                </div>
                <div className="folio-source">
                  <span>03</span>
                  <div>
                    <h3>Consultation history</h3>
                    <p>Symptoms, clinical notes and continuity of care</p>
                  </div>
                </div>
              </div>
              <div className="folio-summary">
                <h3>AI-assisted clinical summary</h3>
                <p>
                  A reading of the information in the patient record, ready for
                  the care team to review
                </p>
              </div>
              <p className="folio-note">
                Monitoring support only · Not a diagnosis
              </p>
            </div>
          </section>
          <section
            className="landing-footer"
            aria-label="Two views of the patient record"
          >
            <div>
              <h2>For care teams</h2>
              <p>
                Follow patient records, consultations, clinical measurements and
                summaries within your clinic workspace
              </p>
            </div>
            <div>
              <h2>For patients</h2>
              <p>
                Access your health records, appointments and summaries shared by
                your care team through your personal portal
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
