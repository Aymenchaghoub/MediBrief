"use client";

import { useEffect, useState } from "react";
import { portalFetch } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";

interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string | null;
  email: string | null;
  clinic: { name: string };
}

export default function SettingsPage() {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<"profile" | "security">("profile");
  const [loading, setLoading] = useState(true);

  /* ── Profile state ── */
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  /* ── Security state ── */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingSecurity, setSavingSecurity] = useState(false);

  useEffect(() => {
    portalFetch<Profile>("/portal/me")
      .then((p) => {
        setProfile(p);
        setPhone(p.phone ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Profile submit ── */
  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await portalFetch("/portal/me", {
        method: "PUT",
        body: JSON.stringify({ phone }),
      });
      pushToast("Phone number updated.", "success");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSavingProfile(false);
    }
  }

  /* ── Password submit ── */
  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      pushToast("New passwords do not match.", "error");
      return;
    }
    setSavingSecurity(true);
    try {
      await portalFetch("/portal/security", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      pushToast("Password changed successfully.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Password change failed", "error");
    } finally {
      setSavingSecurity(false);
    }
  }

  if (loading) {
    return <p className="muted" style={{ padding: "2rem" }}>Loading settings…</p>;
  }

  return (
    <>
      <div className="section-header">
        <h2 className="section-title">Settings</h2>
        <p className="muted section-description">Manage your personal information and account security.</p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        <button
          type="button"
          className="tab-btn"
          aria-selected={tab === "profile"}
          onClick={() => setTab("profile")}
        >
          Personal Information
        </button>
        <button
          type="button"
          className="tab-btn"
          aria-selected={tab === "security"}
          onClick={() => setTab("security")}
        >
          Security
        </button>
      </div>

      {/* ── Personal Information ── */}
      {tab === "profile" && (
        <div className="panel">
          <h3 className="section-title">Personal Information</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
            Some fields are managed by your clinic and cannot be changed here.
          </p>

          {/* Read-only fields */}
          <div className="detail-grid" style={{ marginBottom: "1rem" }}>
            <div className="detail-kv">
              <span className="detail-label">Name</span>
              <span className="detail-value">{profile?.firstName} {profile?.lastName}</span>
            </div>
            <div className="detail-kv">
              <span className="detail-label">Date of Birth</span>
              <span className="detail-value">{profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : "–"}</span>
            </div>
            <div className="detail-kv">
              <span className="detail-label">Gender</span>
              <span className="detail-value">{profile?.gender ?? "–"}</span>
            </div>
            <div className="detail-kv">
              <span className="detail-label">Email</span>
              <span className="detail-value">{profile?.email ?? "Not set"}</span>
            </div>
            <div className="detail-kv">
              <span className="detail-label">Clinic</span>
              <span className="detail-value">{profile?.clinic.name}</span>
            </div>
          </div>

          {/* Editable phone */}
          <form onSubmit={handleProfileSave}>
            <div className="field">
              <label htmlFor="settings-phone">Phone Number</label>
              <input
                id="settings-phone"
                type="tel"
                placeholder="+1 234 567 890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="button-row" style={{ marginTop: "1rem" }}>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Security ── */}
      {tab === "security" && (
        <div className="panel">
          <h3 className="section-title">Change Password</h3>
          <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>
            Enter your current password and choose a new one (minimum 8 characters).
          </p>

          <form onSubmit={handlePasswordChange}>
            <div className="field">
              <label htmlFor="current-pw">Current Password</label>
              <input
                id="current-pw"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="new-pw">New Password</label>
              <input
                id="new-pw"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm-pw">Confirm New Password</label>
              <input
                id="confirm-pw"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="form-error" role="alert">Passwords do not match.</p>
            )}

            <div className="button-row" style={{ marginTop: "1rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSecurity || (newPassword !== confirmPassword)}
              >
                {savingSecurity ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
