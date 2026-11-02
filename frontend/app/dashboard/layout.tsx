"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { useMobileNavigation } from "@/components/ui/use-mobile-navigation";
import { apiFetch } from "@/lib/api";
import { clearToken, isAuthenticated } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/patients", label: "Patients", icon: Activity },
  {
    href: "/dashboard/consultations",
    label: "Consultations",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: ChartNoAxesCombined,
  },
  { href: "/dashboard/ai-summary", label: "AI Summary", icon: FileText },
];

const adminNavItems = [
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { menuOpen, setMenuOpen, isMobile, sidebarRef, toggleRef } =
    useMobileNavigation();
  const [userName, setUserName] = useState<string>("Loading…");
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

  function handleLogout() {
    clearToken();
    router.push("/auth");
  }

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <button
        type="button"
        className={`sidebar-overlay ${menuOpen ? "sidebar-overlay-visible" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-label="Close navigation"
        tabIndex={-1}
      />
      <aside
        ref={sidebarRef}
        className={`dashboard-sidebar ${menuOpen ? "dashboard-sidebar-open" : ""}`}
        inert={isMobile && !menuOpen}
        role={isMobile ? "dialog" : undefined}
        aria-modal={isMobile && menuOpen ? true : undefined}
        aria-label="Clinic navigation"
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
          <h1>Clinical Console</h1>
        </div>

        <nav className="dashboard-nav" id="dashboard-nav" aria-label="Clinic">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  pathname.startsWith(item.href + "/"))
                  ? "page"
                  : undefined
              }
              className={`dashboard-nav-item ${pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ? "dashboard-nav-item-active" : ""}`}
            >
              <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          {userRole === "ADMIN" &&
            adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href + "/"))
                    ? "page"
                    : undefined
                }
                className={`dashboard-nav-item ${pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) ? "dashboard-nav-item-active" : ""}`}
              >
                <item.icon size={18} strokeWidth={1.5} aria-hidden="true" />
                {item.label}
              </Link>
            ))}
        </nav>
        <p className="sidebar-caption">Patient records & clinical monitoring</p>
      </aside>

      <div className="dashboard-main" inert={isMobile && menuOpen}>
        <header className="topbar">
          <button
            type="button"
            className="menu-toggle"
            ref={toggleRef}
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            aria-controls="dashboard-nav"
          >
            <Menu size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>

          <div className="topbar-context">
            <p className="topbar-kicker">Clinic Workspace</p>
            <h2>{userName}</h2>
          </div>
          <div className="topbar-actions">
            <span className="workspace-role">{userRole.toLowerCase()}</span>
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
