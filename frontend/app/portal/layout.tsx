"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  FileText,
  FolderHeart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { useMobileNavigation } from "@/components/ui/use-mobile-navigation";
import { portalFetch } from "@/lib/api";
import { clearPatientToken, isPatientAuthenticated } from "@/lib/auth";

const portalNav = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/records", label: "My Records", icon: FolderHeart },
  {
    href: "/portal/appointments",
    label: "My Appointments",
    icon: CalendarDays,
  },
  { href: "/portal/summaries", label: "My Summaries", icon: FileText },
  { href: "/portal/settings", label: "Settings", icon: Settings },
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
  const { menuOpen, setMenuOpen, isMobile, sidebarRef, toggleRef } =
    useMobileNavigation();
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
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {/* Mobile overlay */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close navigation"
        className={`sidebar-overlay ${menuOpen ? "sidebar-overlay-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar portal-sidebar ${menuOpen ? "dashboard-sidebar-open" : ""}`}
        inert={isMobile && !menuOpen}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile && menuOpen ? true : undefined}
        aria-label="Patient navigation"
      >
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        >
          <X size={18} strokeWidth={1.5} />
        </button>
        <div className="brand-block">
          <Brand />
          <h1>Patient Portal</h1>
        </div>

        <nav className="dashboard-nav" id="portal-nav" aria-label="Patient">
          {portalNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`dashboard-nav-item ${pathname === item.href ? "dashboard-nav-item-active" : ""}`}
            >
              <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="sidebar-caption">
          Your records, shared by your care team
        </p>
      </aside>

      <div className="dashboard-main" inert={isMobile && menuOpen}>
        <header className="topbar portal-topbar">
          <button
            type="button"
            className="menu-toggle"
            ref={toggleRef}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="portal-nav"
          >
            <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>

          <div className="topbar-context">
            <p className="topbar-kicker">Patient Portal</p>
            <h2>
              {patient
                ? `${patient.firstName} ${patient.lastName}`
                : "Loading…"}{" "}
              · {patient?.clinic.name ?? ""}
            </h2>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleLogout}
            >
              <LogOut size={18} strokeWidth={1.5} aria-hidden="true" /> Logout
            </button>
          </div>
        </header>

        <main className="dashboard-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
