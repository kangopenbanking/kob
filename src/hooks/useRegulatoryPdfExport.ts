import { useCallback } from "react";
import jsPDF from "jspdf";

interface ExportOptions {
  title: string;
  documentCode: string;
  subtitle?: string;
  sections: {
    heading: string;
    content: string[];
    table?: { headers: string[]; rows: string[][] };
  }[];
}

export function useRegulatoryPdfExport() {
  const exportToPdf = useCallback((options: ExportOptions) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > 270) {
        doc.addPage();
        y = 20;
      }
    };

    // Header
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("CONFIDENTIAL — REGULATORY FILING DOCUMENT", margin, y);
    doc.text(options.documentCode, pageWidth - margin, y, { align: "right" });
    y += 6;
    doc.setDrawColor(0, 100, 180);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 12;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(options.title, margin, y);
    y += 8;

    if (options.subtitle) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const subtitleLines = doc.splitTextToSize(options.subtitle, contentWidth);
      doc.text(subtitleLines, margin, y);
      y += subtitleLines.length * 5 + 4;
    }

    // Company line
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Kang Open Banking S.A. — Douala, Cameroon", margin, y);
    y += 4;
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, margin, y);
    y += 10;

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Sections
    options.sections.forEach((section, idx) => {
      checkPage(20);

      // Section heading
      doc.setFontSize(13);
      doc.setTextColor(0, 60, 120);
      doc.text(section.heading, margin, y);
      y += 7;

      // Content paragraphs
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      section.content.forEach((para) => {
        checkPage(12);
        const lines = doc.splitTextToSize(para, contentWidth);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 3;
      });

      // Table
      if (section.table) {
        checkPage(20);
        const colCount = section.table.headers.length;
        const colWidth = contentWidth / colCount;

        // Header row
        doc.setFillColor(240, 240, 245);
        doc.rect(margin, y - 1, contentWidth, 7, "F");
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        section.table.headers.forEach((h, i) => {
          doc.text(h, margin + i * colWidth + 2, y + 3);
        });
        y += 8;

        // Data rows
        doc.setTextColor(30, 30, 30);
        section.table.rows.forEach((row) => {
          checkPage(8);
          row.forEach((cell, i) => {
            const cellLines = doc.splitTextToSize(cell, colWidth - 4);
            doc.text(cellLines, margin + i * colWidth + 2, y + 3);
          });
          y += 6;
          doc.setDrawColor(230, 230, 230);
          doc.line(margin, y, pageWidth - margin, y);
          y += 2;
        });
        y += 4;
      }

      y += 4;
    });

    // Footer on every page
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${options.documentCode} — Page ${i} of ${totalPages} — Kang Open Banking S.A.`,
        pageWidth / 2,
        290,
        { align: "center" }
      );
    }

    doc.save(`${options.documentCode}-${options.title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}.pdf`);
  }, []);

  return { exportToPdf };
}
