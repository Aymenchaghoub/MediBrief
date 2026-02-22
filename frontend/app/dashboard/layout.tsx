"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { clearToken, isAuthenticated } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/patients", label: "Patients" },
  { href: "/dashboard/consultations", label: "Consultations" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/ai-summary", label: "AI Summary" },
];

const adminNavItems = [
  { href: "/dashboard/security", label: "Security" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("Doctor");
  const [userRole, setUserRole] = useState<string>("DOCTOR");

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/auth");
      return;
    }

    apiFetch<{ name: string; role: string }>("/users/me", { auth: true })
      .then((user) => {
        setUserName(user.name);
        setUserRole(user.role);
      })
      .catch(() => {
        clearToken();
        router.replace("/auth");
      });
  }, [router]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleLogout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <div className="dashboard-shell">
      <aside className={`dashboard-sidebar ${menuOpen ? "dashboard-sidebar-open" : ""}`}>
        <div className="brand-block">
          <p className="brand-kicker">MediBrief</p>
          <h1>Clinical Console</h1>
        </div>

        <nav className="dashboard-nav" id="dashboard-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              className={`dashboard-nav-item ${pathname === item.href ? "dashboard-nav-item-active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
          {userRole === "ADMIN" &&
            adminNavItems.map((item) => (
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
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="dashboard-nav"
          >
            ☰
          </button>

          <div>
            <p className="topbar-kicker">Clinic Workspace</p>
            <h2>{userName} · {userRole} · MediBrief Console</h2>
          </div>
          <div className="topbar-actions">
            <span className="status-chip">System Healthy</span>
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
