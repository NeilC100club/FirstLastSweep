import { boardSections, type Minute, type Sweep } from "@/lib/types";

// The handful of drawing calls the board needs. Both jsPDF (used in the browser for
// "Download PDF") and our own SimplePdf (used on the server for emails) provide them.
export interface PdfDoc {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  setFont(family: string, style?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g: number, b: number): unknown;
  text(text: string, x: number, y: number, options?: { maxWidth?: number }): unknown;
  getTextWidth(text: string): number;
  addPage(): unknown;
}

// Draws the board onto a blank A4 document (points, portrait). Shared by the
// "Download PDF" button (in the browser) and the kick-off and results emails (on
// the server), so they always match.
export function buildBoardPdf(
  doc: PdfDoc,
  {
    sweep,
    minutes,
    fundraiserName,
    organizerName,
  }: {
    sweep: Pick<
      Sweep,
      "name" | "event_date" | "kickoff_time" | "price_per_minute" | "status" | "goal_minute_first" | "goal_minute_last"
    >;
    minutes: Pick<Minute, "minute" | "owner_name">[];
    fundraiserName: string;
    organizerName?: string | null;
  }
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const bottomLimit = pageHeight - margin;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(sweep.name, margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const meta = [
    sweep.event_date,
    sweep.kickoff_time ? `${sweep.kickoff_time.slice(0, 5)} kickoff` : null,
    organizerName ? `Organised by ${organizerName}` : null,
    `£${(sweep.price_per_minute / 100).toFixed(2)} per minute`,
  ]
    .filter(Boolean)
    .join("   ·   ");
  doc.text(meta, margin, y);
  y += 24;

  const claimedCount = minutes.filter((m) => m.owner_name).length;
  const totalCollected = claimedCount * sweep.price_per_minute;
  const half = totalCollected / 2;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Prize pool", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total collected: £${(totalCollected / 100).toFixed(2)}`, margin, y);
  y += 14;
  doc.text(`Prize pot (50%): £${(half / 100).toFixed(2)}`, margin, y);
  y += 14;
  doc.text(`${fundraiserName} fundraising pot (50%): £${(half / 100).toFixed(2)}`, margin, y);
  y += 22;

  if (sweep.status === "finished") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Result", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const describeGoal = (label: string, minute: number | null) => {
      if (!minute) return;
      const w = minutes.find((m) => m.minute === minute);
      const outcome = w?.owner_name ? `${w.owner_name} wins` : `Unclaimed — goes to the ${fundraiserName}`;
      doc.text(`${label} — minute ${minute}: ${outcome}`, margin, y);
      y += 14;
    };
    describeGoal("First goal", sweep.goal_minute_first);
    describeGoal("Last goal", sweep.goal_minute_last);
    if (!sweep.goal_minute_first && !sweep.goal_minute_last) {
      doc.text(`No goals — everything goes to the ${fundraiserName}`, margin, y);
      y += 14;
    }
    y += 10;
  }

  // One block per half, each a plain-text list flowing down 3 columns — always
  // crisp and readable, and runs onto a new page if it doesn't fit.
  const columns = 3;
  const colGap = 18;
  const colWidth = (pageWidth - margin * 2 - colGap * (columns - 1)) / columns;
  const rowHeight = 18;

  const sorted = minutes.slice().sort((a, b) => a.minute - b.minute);
  for (const section of boardSections(sorted)) {
    // 45 minutes over 3 columns is 15 rows — a half always fits on one page, so
    // if this one won't fit in the space left, start it on a fresh page.
    const rowsPerCol = Math.ceil(section.items.length / columns);
    const blockHeight = 22 + rowsPerCol * rowHeight;
    if (y + blockHeight > bottomLimit) {
      doc.addPage();
      y = margin;
    }

    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(section.label, margin, y);
    const labelWidth = doc.getTextWidth(section.label);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(section.range, margin + labelWidth + 10, y);
    y += 22;

    let maxY = y;
    section.items.forEach((m, i) => {
      const col = Math.floor(i / rowsPerCol);
      const rowY = y + (i % rowsPerCol) * rowHeight;
      const colX = margin + col * (colWidth + colGap);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(20, 20, 20);
      doc.text(`${m.minute}.`, colX, rowY);
      doc.setFont("helvetica", "normal");
      const shade = m.owner_name ? 20 : 150;
      doc.setTextColor(shade, shade, shade);
      doc.text(m.owner_name || "Open", colX + 26, rowY, { maxWidth: colWidth - 26 });
      maxY = Math.max(maxY, rowY);
    });
    y = maxY + 30;
  }

}

export function boardPdfFileName(sweepName: string): string {
  const safe = sweepName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${safe || "sweep"}-board.pdf`;
}
