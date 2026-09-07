// ==============================================================================
// Nittoo PDF Report Exporter
// Generates a human-readable personal consumption report formatted as a clean,
// publication-grade document adhering to Nittoo's visual identity.
// Strictly differentiates Observed vs Predicted vs Estimated data.
// ==============================================================================

import { jsPDF } from 'jspdf';
import type { NittooExportData } from './types';

export function generatePdfReport(data: NittooExportData): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // Helper to ensure page bounds
  function checkPageBreak(neededHeight: number) {
    if (y + neededHeight > pageHeight - 16) {
      doc.addPage();
      y = 18;
    }
  }

  // Brand Palette
  const PRIMARY_GREEN = [45, 106, 79]; // #2D6A4F
  const DARK_GREEN = [27, 67, 50]; // #1B4332
  const TEXT_MAIN = [17, 24, 39]; // #111827
  const TEXT_MUTED = [107, 114, 128]; // #6B7280
  const BORDER_COLOR = [232, 236, 233]; // #E8ECE9
  const BG_LIGHT = [248, 250, 249]; // #F8FAF9

  // ----------------------------------------------------------------------------
  // 1. Header Area
  // ----------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
  doc.text('NITTOO', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('Know What Lasts.', margin + 24, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(DARK_GREEN[0], DARK_GREEN[1], DARK_GREEN[2]);
  doc.text('YOUR CONSUMPTION REPORT', margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  const exportDate = data.exported_at.split('T')[0];
  doc.text(`Exported on ${exportDate} · Account: ${data.user.email}`, margin, y);

  y += 4;
  doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);

  y += 7;

  // ----------------------------------------------------------------------------
  // 2. Overview Metrics Cards
  // ----------------------------------------------------------------------------
  checkPageBreak(28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
  doc.text('PORTFOLIO OVERVIEW', margin, y);
  y += 4;

  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 18;
  const cards = [
    { label: 'ACTIVE ESSENTIALS', value: `${data.summary.active_essentials}`, sub: 'in daily use' },
    { label: 'UNOPENED INVENTORY', value: `${data.summary.unopened_purchases}`, sub: 'backup bottles' },
    { label: 'COMPLETED CYCLES', value: `${data.summary.completed_usage_cycles}`, sub: 'observed history' },
    {
      label: 'EST. MONTHLY RUN RATE',
      value:
        data.summary.estimated_monthly_consumption !== null
          ? `BDT ${data.summary.estimated_monthly_consumption}`
          : 'N/A',
      sub: 'per month',
    },
  ];

  for (let i = 0; i < cards.length; i++) {
    const cardX = margin + i * (cardWidth + 3);
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 2, 2, 'F');
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(cards[i].label, cardX + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
    doc.text(cards[i].value, cardX + 3, y + 10.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(cards[i].sub, cardX + 3, y + 15);
  }

  y += cardHeight + 8;

  // ----------------------------------------------------------------------------
  // 3. Category Consumption Breakdown
  // ----------------------------------------------------------------------------
  if (data.summary.category_breakdown.length > 0) {
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
    doc.text('ESTIMATED CONSUMPTION BY CATEGORY', margin, y);
    y += 4;

    // Table Header
    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('CATEGORY', margin + 3, y + 4.2);
    doc.text('ACTIVE COUNT', margin + 65, y + 4.2);
    doc.text('ESTIMATED RUN RATE', margin + 110, y + 4.2);
    doc.text('% OF TOTAL', margin + 155, y + 4.2);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const cat of data.summary.category_breakdown) {
      checkPageBreak(6);
      doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      doc.line(margin, y + 5.5, margin + contentWidth, y + 5.5);

      doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
      doc.text(cat.category, margin + 3, y + 4);
      doc.text(`${cat.activeCount} active`, margin + 65, y + 4);
      doc.text(cat.estimatedMonthlyCost > 0 ? `BDT ${cat.estimatedMonthlyCost} / month` : 'N/A', margin + 110, y + 4);
      doc.text(`${cat.percentage}%`, margin + 155, y + 4);
      y += 6;
    }
    y += 5;
  }

  // ----------------------------------------------------------------------------
  // 4. Product Overview (Observed Lifespan & Cost/Day)
  // ----------------------------------------------------------------------------
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
  doc.text('PRODUCT PERFORMANCE & OBSERVED METRICS', margin, y);
  y += 4;

  doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
  doc.text('PRODUCT', margin + 3, y + 4.2);
  doc.text('OBSERVED LIFESPAN', margin + 65, y + 4.2);
  doc.text('OBSERVED COST / DAY', margin + 110, y + 4.2);
  doc.text('EVIDENCE MATURITY', margin + 150, y + 4.2);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  for (const an of data.analytics) {
    checkPageBreak(6.5);
    doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
    doc.line(margin, y + 6, margin + contentWidth, y + 6);

    doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
    const truncatedName = an.product_name.length > 32 ? `${an.product_name.substring(0, 30)}...` : an.product_name;
    doc.text(truncatedName, margin + 3, y + 4.2);

    const lifespanText =
      an.observed_average_lifespan !== null
        ? `${an.observed_average_lifespan} days (${an.completed_cycles} cycles)`
        : 'Learning (0 cycles)';
    doc.text(lifespanText, margin + 65, y + 4.2);

    const costText = an.observed_cost_per_day !== null ? `BDT ${an.observed_cost_per_day} / day` : 'No data';
    doc.text(costText, margin + 110, y + 4.2);

    doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
    doc.text(an.confidence_label, margin + 150, y + 4.2);
    y += 6.5;
  }
  y += 5;

  // ----------------------------------------------------------------------------
  // 5. Nittoo Learned (Evidence-backed personal insights)
  // ----------------------------------------------------------------------------
  if (data.insights.length > 0) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
    doc.text('NITTOO LEARNED (EVIDENCE-BACKED INSIGHTS)', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);

    for (const insight of data.insights) {
      checkPageBreak(6);
      doc.text(`• ${insight}`, margin + 3, y + 3.5);
      y += 5.5;
    }
    y += 4;
  }

  // ----------------------------------------------------------------------------
  // 6. Upcoming Restocks / Restock Horizon
  // ----------------------------------------------------------------------------
  const activePredictions = data.analytics.filter(
    (an) => an.predicted_remaining_days !== null && an.predicted_finish_date
  );

  if (activePredictions.length > 0) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
    doc.text('UPCOMING RESTOCK HORIZON (PREDICTED)', margin, y);
    y += 4;

    doc.setFillColor(BG_LIGHT[0], BG_LIGHT[1], BG_LIGHT[2]);
    doc.rect(margin, y, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text('PRODUCT', margin + 3, y + 4.2);
    doc.text('PREDICTED RUN-OUT DATE', margin + 80, y + 4.2);
    doc.text('STATUS / HORIZON', margin + 140, y + 4.2);
    y += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    for (const item of activePredictions) {
      checkPageBreak(6.5);
      doc.setDrawColor(BORDER_COLOR[0], BORDER_COLOR[1], BORDER_COLOR[2]);
      doc.line(margin, y + 6, margin + contentWidth, y + 6);

      doc.setTextColor(TEXT_MAIN[0], TEXT_MAIN[1], TEXT_MAIN[2]);
      doc.text(item.product_name, margin + 3, y + 4.2);
      doc.text(item.predicted_finish_date || 'N/A', margin + 80, y + 4.2);

      const rem = item.predicted_remaining_days ?? 0;
      if (rem < 0) {
        doc.setTextColor(190, 18, 60); // Overdue
        doc.text(`Overdue by ${Math.abs(rem)} days`, margin + 140, y + 4.2);
      } else if (rem <= 14) {
        doc.setTextColor(180, 83, 9); // Running soon
        doc.text(`~${rem} days remaining`, margin + 140, y + 4.2);
      } else {
        doc.setTextColor(PRIMARY_GREEN[0], PRIMARY_GREEN[1], PRIMARY_GREEN[2]);
        doc.text(`~${rem} days remaining`, margin + 140, y + 4.2);
      }
      y += 6.5;
    }
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(TEXT_MUTED[0], TEXT_MUTED[1], TEXT_MUTED[2]);
    doc.text(`Nittoo Personal Consumption Report · Page ${p} of ${totalPages}`, margin, pageHeight - 8);
    doc.text('Confidential & Personal to Account Owner', margin + contentWidth - 55, pageHeight - 8);
  }

  const pdfArrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(pdfArrayBuffer);
}
