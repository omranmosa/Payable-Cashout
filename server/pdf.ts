import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type PdfData = {
  restaurantName: string;
  vendorName: string;
  assignments: Array<{
    invoiceNumber: string;
    assignedAmount: string;
    dueDate: string;
  }>;
  advanceAmount: string;
  feeAmount: string;
  totalRepayment: string;
  repaymentDate: string | null;
  bank: {
    bankName: string | null;
    bankAccountNumber: string | null;
    bankRoutingNumber: string | null;
    bankAccountName: string | null;
  };
};

export async function generateAssignmentNoticePdf(data: PdfData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 10;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const primary = rgb(0.1, 0.3, 0.6);

  let y = 740;
  const margin = 50;
  const pw = 512;

  page.drawText("ASSIGNMENT NOTICE", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: primary,
  });
  y -= 30;

  page.drawText(`From: ${data.restaurantName}`, {
    x: margin,
    y,
    size: fontSize,
    font: fontBold,
    color: black,
  });
  y -= 16;

  page.drawText(`To: ${data.vendorName}`, {
    x: margin,
    y,
    size: fontSize,
    font: fontBold,
    color: black,
  });
  y -= 16;

  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: margin,
    y,
    size: fontSize,
    font,
    color: gray,
  });
  y -= 30;

  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + pw, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 20;

  page.drawText("Assigned Invoices", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: black,
  });
  y -= 20;

  const colWidths = [200, 150, 162];
  const headers = ["Invoice #", "Assigned Amount", "Due Date"];
  let x = margin;
  headers.forEach((h, i) => {
    page.drawText(h, { x, y, size: 9, font: fontBold, color: gray });
    x += colWidths[i];
  });
  y -= 14;

  page.drawLine({
    start: { x: margin, y: y + 4 },
    end: { x: margin + pw, y: y + 4 },
    thickness: 0.3,
    color: gray,
  });

  for (const a of data.assignments) {
    x = margin;
    page.drawText(a.invoiceNumber, { x, y, size: fontSize, font, color: black });
    x += colWidths[0];
    page.drawText(`$${Number(a.assignedAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
      x,
      y,
      size: fontSize,
      font,
      color: black,
    });
    x += colWidths[1];
    page.drawText(new Date(a.dueDate).toLocaleDateString(), {
      x,
      y,
      size: fontSize,
      font,
      color: black,
    });
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + pw, y },
    thickness: 0.5,
    color: gray,
  });
  y -= 20;

  page.drawText("Financial Summary", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: black,
  });
  y -= 20;

  const fmt = (n: string) =>
    `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const summaryLines = [
    ["Advance Amount:", fmt(data.advanceAmount)],
    ["Fee:", fmt(data.feeAmount)],
    ["Total Repayment:", fmt(data.totalRepayment)],
  ];
  if (data.repaymentDate) {
    summaryLines.push([
      "Repayment Date:",
      new Date(data.repaymentDate).toLocaleDateString(),
    ]);
  }

  for (const [label, value] of summaryLines) {
    page.drawText(label, { x: margin, y, size: fontSize, font, color: gray });
    page.drawText(value, {
      x: margin + 150,
      y,
      size: fontSize,
      font: fontBold,
      color: black,
    });
    y -= 16;
  }

  y -= 20;
  page.drawText("Bank Details for Payment", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: black,
  });
  y -= 20;

  const bankLines = [
    ["Bank:", data.bank.bankName || "N/A"],
    ["Account:", data.bank.bankAccountNumber || "N/A"],
    ["Routing:", data.bank.bankRoutingNumber || "N/A"],
    ["Account Name:", data.bank.bankAccountName || "N/A"],
  ];

  for (const [label, value] of bankLines) {
    page.drawText(label, { x: margin, y, size: fontSize, font, color: gray });
    page.drawText(value, {
      x: margin + 100,
      y,
      size: fontSize,
      font,
      color: black,
    });
    y -= 16;
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
