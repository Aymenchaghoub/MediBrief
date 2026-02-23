const TOKEN_KEY = "medibrief_token";
const PATIENT_TOKEN_KEY = "medibrief_patient_token";

export function saveToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
  }
}

/* ── Patient portal token helpers ── */

export function savePatientToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PATIENT_TOKEN_KEY, token);
  }
}

export function getPatientToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(PATIENT_TOKEN_KEY);
}

export function isPatientAuthenticated() {
  return Boolean(getPatientToken());
}

export function clearPatientToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(PATIENT_TOKEN_KEY);
  }
}
