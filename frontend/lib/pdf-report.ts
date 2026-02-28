/**
 * Generates a formatted MediBrief Health Report PDF using jsPDF.
 *
 * Dynamically imports jspdf to keep the bundle tree-shakeable.
 */

interface PatientInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string | null;
  email: string | null;
  clinic: { name: string };
}

interface VitalRow {
  type: string;
  value: string;
  unit: string;
  recordedAt: string;
}

interface LabRow {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string | null;
  flag: string;
  recordedAt: string;
}

interface HealthReportData {
  profile: PatientInfo;
  vitals: VitalRow[];
  labs: LabRow[];
  latestSummary: string | null;
}

const MARGIN = 48;
const LINE = 14;

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export async function generateHealthReportPdf(data: HealthReportData) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  /* ── helpers ── */
  function checkPage(needed: number) {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  }

  function heading(text: string) {
    checkPage(30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(text, MARGIN, y);
    y += 6;
    doc.setDrawColor(180);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += LINE;
  }

  function row(label: string, value: string) {
    checkPage(LINE);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.text(label, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 110, y);
    y += LINE;
  }

  /* ── title ── */
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  doc.text("MediBrief Health Report", MARGIN, y);
  y += 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(`Generated on ${new Date().toLocaleDateString()} — for informational purposes only`, MARGIN, y);
  y += 22;
  doc.setTextColor(0);

  /* ── patient info ── */
  heading("Patient Information");
  const p = data.profile;
  row("Name", `${p.firstName} ${p.lastName}`);
  row("Date of Birth", fmtDate(p.dateOfBirth));
  row("Gender", p.gender);
  row("Phone", p.phone ?? "Not provided");
  row("Email", p.email ?? "Not set");
  row("Clinic", p.clinic.name);
  y += 8;

  /* ── vitals table ── */
  heading("Latest Vitals");
  if (data.vitals.length === 0) {
    doc.setFontSize(9.5);
    doc.text("No vital records available.", MARGIN, y);
    y += LINE;
  } else {
    // header
    const cols = [MARGIN, MARGIN + 80, MARGIN + 180, MARGIN + 280, MARGIN + 360];
    const headers = ["Date", "Type", "Value", "Unit"];
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    headers.forEach((h, i) => doc.text(h, cols[i], y));
    y += 4;
    doc.setDrawColor(210);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += LINE - 2;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const vitalsSlice = data.vitals.slice(0, 30); // cap at 30 rows
    for (const v of vitalsSlice) {
      checkPage(LINE);
      doc.setFontSize(8.5);
      doc.text(fmtDate(v.recordedAt), cols[0], y);
      doc.text(v.type, cols[1], y);
      doc.text(v.value, cols[2], y);
      doc.text(v.unit || "–", cols[3], y);
      y += LINE;
    }
    if (data.vitals.length > 30) {
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(`… and ${data.vitals.length - 30} more records`, MARGIN, y);
      doc.setTextColor(0);
      y += LINE;
    }
  }
  y += 8;

  /* ── flagged labs table ── */
  heading("Lab Results");
  const flaggedLabs = data.labs.filter((l) => l.flag !== "NORMAL");
  const labsToShow = flaggedLabs.length > 0 ? flaggedLabs : data.labs;
  const labLabel = flaggedLabs.length > 0 ? "(showing flagged only)" : "(all results)";

  if (labsToShow.length === 0) {
    doc.setFontSize(9.5);
    doc.text("No lab results available.", MARGIN, y);
    y += LINE;
  } else {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(labLabel, MARGIN, y);
    doc.setTextColor(0);
    y += LINE;

    const lCols = [MARGIN, MARGIN + 70, MARGIN + 175, MARGIN + 245, MARGIN + 325, MARGIN + 415];
    const lHeaders = ["Date", "Test", "Value", "Unit", "Reference", "Flag"];
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100);
    lHeaders.forEach((h, i) => doc.text(h, lCols[i], y));
    y += 4;
    doc.setDrawColor(210);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += LINE - 2;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    const labsSlice = labsToShow.slice(0, 25);
    for (const l of labsSlice) {
      checkPage(LINE);
      doc.setFontSize(8.5);
      doc.text(fmtDate(l.recordedAt), lCols[0], y);
      doc.text(l.testName, lCols[1], y);
      doc.text(l.value, lCols[2], y);
      doc.text(l.unit || "–", lCols[3], y);
      doc.text(l.referenceRange ?? "–", lCols[4], y);
      // colour-code flag
      if (l.flag === "HIGH" || l.flag === "LOW") {
        doc.setTextColor(200, 50, 50);
      } else {
        doc.setTextColor(60, 140, 60);
      }
      doc.text(l.flag, lCols[5], y);
      doc.setTextColor(0);
      y += LINE;
    }
  }
  y += 8;

  /* ── AI summary ── */
  heading("Latest AI Summary");
  if (!data.latestSummary) {
    doc.setFontSize(9.5);
    doc.text("No AI summary generated yet.", MARGIN, y);
  } else {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(data.latestSummary, maxWidth);
    for (const line of summaryLines) {
      checkPage(LINE);
      doc.text(line, MARGIN, y);
      y += LINE;
    }
  }

  /* ── footer on every page ── */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160);
    doc.text(
      `MediBrief Health Report — Page ${i} of ${totalPages} — Confidential`,
      MARGIN,
      pageHeight - 24,
    );
  }

  const fileName = `MediBrief-Report-${p.firstName}-${p.lastName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return fileName;
}
