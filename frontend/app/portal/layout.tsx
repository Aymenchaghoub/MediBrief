"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { portalFetch } from "@/lib/api";
import { clearPatientToken, isPatientAuthenticated } from "@/lib/auth";

const portalNav = [
  { href: "/portal", label: "Overview" },
  { href: "/portal/records", label: "My Records" },
  { href: "/portal/appointments", label: "My Appointments" },
  { href: "/portal/summaries", label: "My Summaries" },
  { href: "/portal/settings", label: "Settings" },
];

interface PatientProfile {
  id: string;
  firstName: string;
  lastName: string;
  clinic: { name: string };
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [patient, setPatient] = useState<PatientProfile | null>(null);

  useEffect(() => {
    if (!isPatientAuthenticated()) {
      router.replace("/patient-auth");
      return;
    }

    portalFetch<PatientProfile>("/portal/me")
      .then(setPatient)
      .catch(() => {
        clearPatientToken();
        router.replace("/patient-auth");
      });
  }, [router]);

  function handleLogout() {
    clearPatientToken();
    router.push("/patient-auth");
  }

  return (
    <div className="dashboard-shell">
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${menuOpen ? "sidebar-overlay-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      <aside className={`dashboard-sidebar portal-sidebar ${menuOpen ? "dashboard-sidebar-open" : ""}`}>
        <div className="brand-block">
          <p className="brand-kicker">MediBrief</p>
          <h1>Patient Portal</h1>
        </div>

        <nav className="dashboard-nav" id="portal-nav">
          {portalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`dashboard-nav-item ${pathname === item.href ? "dashboard-nav-item-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="topbar portal-topbar">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="portal-nav"
          >
            ☰
          </button>

          <div>
            <p className="topbar-kicker">Patient Portal</p>
            <h2>{patient ? `${patient.firstName} ${patient.lastName}` : "Loading…"} · {patient?.clinic.name ?? ""}</h2>
          </div>
          <div className="topbar-actions">
            <span className="status-chip">Portal Active</span>
            <button type="button" className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
