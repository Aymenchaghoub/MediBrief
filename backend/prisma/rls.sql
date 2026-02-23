-- ============================================================
-- Row Level Security (RLS) for multi-tenant isolation
-- Enforces that queries can only access rows within the
-- authenticated user's clinic (tenant).
-- ============================================================

-- Enable RLS on tenant-scoped tables
ALTER TABLE "Patient"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Consultation"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VitalRecord"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LabResult"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AISummary"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User"          ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (the app DB user)
ALTER TABLE "Patient"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "Consultation"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "VitalRecord"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "LabResult"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "AISummary"     FORCE ROW LEVEL SECURITY;
ALTER TABLE "User"          FORCE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
--  RLS Policies
--  The app sets  current_setting('app.clinic_id')  on each
--  connection/transaction before running queries.
-- ──────────────────────────────────────────────────────────

-- Patient: direct clinicId column
DROP POLICY IF EXISTS tenant_patient ON "Patient";
CREATE POLICY tenant_patient ON "Patient"
  USING ("clinicId" = current_setting('app.clinic_id', true))
  WITH CHECK ("clinicId" = current_setting('app.clinic_id', true));

-- User: direct clinicId column
DROP POLICY IF EXISTS tenant_user ON "User";
CREATE POLICY tenant_user ON "User"
  USING ("clinicId" = current_setting('app.clinic_id', true))
  WITH CHECK ("clinicId" = current_setting('app.clinic_id', true));

-- Consultation: joined through Patient
DROP POLICY IF EXISTS tenant_consultation ON "Consultation";
CREATE POLICY tenant_consultation ON "Consultation"
  USING ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ))
  WITH CHECK ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ));

-- VitalRecord: joined through Patient
DROP POLICY IF EXISTS tenant_vital ON "VitalRecord";
CREATE POLICY tenant_vital ON "VitalRecord"
  USING ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ))
  WITH CHECK ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ));

-- LabResult: joined through Patient
DROP POLICY IF EXISTS tenant_lab ON "LabResult";
CREATE POLICY tenant_lab ON "LabResult"
  USING ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ))
  WITH CHECK ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ));

-- AISummary: joined through Patient
DROP POLICY IF EXISTS tenant_ai_summary ON "AISummary";
CREATE POLICY tenant_ai_summary ON "AISummary"
  USING ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ))
  WITH CHECK ("patientId" IN (
    SELECT id FROM "Patient" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ));

-- Clinic: each clinic sees only itself
DROP POLICY IF EXISTS tenant_clinic ON "Clinic";
ALTER TABLE "Clinic" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Clinic" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_clinic ON "Clinic"
  USING ("id" = current_setting('app.clinic_id', true));

-- AuditLog: scoped through User → clinicId
DROP POLICY IF EXISTS tenant_audit ON "AuditLog";
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_audit ON "AuditLog"
  USING ("userId" IN (
    SELECT id FROM "User" WHERE "clinicId" = current_setting('app.clinic_id', true)
  ));

-- ──────────────────────────────────────────────────────────
--  Bypass role for migrations / admin tasks
-- ──────────────────────────────────────────────────────────
-- The superuser 'postgres' bypasses RLS by default.
-- If using a limited app user, grant bypass only for migrations:
--   ALTER ROLE medibrief_migrator BYPASSRLS;
