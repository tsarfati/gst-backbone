import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { resolveStorageUrl } from "@/utils/storageUtils";

export interface CreditCardPackageTransaction {
  id: string;
  transaction_date: string;
  amount: number;
  merchant_name: string;
  description: string;
  vendor_name: string | null;
  job_name: string | null;
  job_number: string | null;
  cost_code: string | null;
  cost_code_number: string | null;
  cost_code_description: string | null;
  cost_code_type: string | null;
  chart_account_name: string | null;
  credit_card_name: string;
  cardholder_name: string;
  card_number_last_four: string;
  coding_status: string | null;
  journal_entry_id: string | null;
  attachment_url: string | null;
  allocation_summary: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by_name: string | null;
  audit_trail: CreditCardTransactionAuditEntry[];
}

export interface CreditCardTransactionAuditEntry {
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  created_at: string;
  changed_by_name: string | null;
}

interface CreditCardReportMetadata {
  companyName: string;
  cardLabel: string;
  dateFrom: Date;
  dateTo: Date;
}

export interface CreditCardPackageProgress {
  current: number;
  total: number;
  message: string;
}

export interface CreditCardPackageResult {
  blob: Blob;
  fileName: string;
  includedAttachments: number;
  failedAttachments: number;
}

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

function sanitizeFileNamePart(value: string | null | undefined, fallback: string, maxLength = 48) {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();

  return (cleaned || fallback).slice(0, maxLength);
}

function attachmentExtension(source: string, blob: Blob) {
  try {
    const path = decodeURIComponent(source.split("?")[0]);
    const match = path.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (match?.[1]) return match[1].toLowerCase();
  } catch {
    // Fall back to the downloaded file's MIME type.
  }

  return MIME_EXTENSIONS[blob.type.toLowerCase()] || "bin";
}

function storagePath(urlOrPath: string) {
  if (!urlOrPath.startsWith("http")) {
    return urlOrPath.startsWith("credit-card-attachments/")
      ? urlOrPath.slice("credit-card-attachments/".length)
      : urlOrPath;
  }

  const match = urlOrPath.match(/storage\/v1\/object\/(?:sign|public)\/credit-card-attachments\/(.+?)(?:\?|$)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function downloadAttachment(urlOrPath: string) {
  const resolvedUrl = await resolveStorageUrl("credit-card-attachments", urlOrPath);
  if (resolvedUrl) {
    try {
      const response = await fetch(resolvedUrl);
      if (response.ok) return await response.blob();
    } catch {
      // Try the storage client below for stored paths and legacy URLs.
    }
  }

  const path = storagePath(urlOrPath);
  if (!path) return null;

  const { data, error } = await supabase.storage.from("credit-card-attachments").download(path);
  return error ? null : data;
}

function baseAttachmentName(transaction: CreditCardPackageTransaction) {
  const date = transaction.transaction_date || "No-Date";
  const amount = `USD_${Number(transaction.amount || 0).toFixed(2)}`;
  const job = sanitizeFileNamePart(transaction.job_name || transaction.chart_account_name, "No-Job", 36);
  const code = sanitizeFileNamePart(transaction.cost_code_number, "No-Cost-Code", 28);
  const description = sanitizeFileNamePart(
    transaction.vendor_name || transaction.merchant_name || transaction.description,
    "Transaction",
    42,
  );
  return `${date}_${amount}_${job}_${code}_${description}`;
}

function uniqueAttachmentName(
  transaction: CreditCardPackageTransaction,
  extension: string,
  usedNames: Set<string>,
) {
  const base = baseAttachmentName(transaction);
  let candidate = `${base}.${extension}`;
  let counter = 2;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base}_${counter}.${extension}`;
    counter += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function transactionDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00`);
}

function pdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\xFF]/g, "?");
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? pdfText(value) : date.toLocaleString();
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = pdfText(text);
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe;
  let shortened = safe;
  while (shortened.length > 1 && font.widthOfTextAtSize(`${shortened}...`, size) > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}...`;
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      return;
    }
    lines.push(line);
    line = word;
  });
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawProvenanceBox(
  page: PDFPage,
  transaction: CreditCardPackageTransaction,
  font: PDFFont,
  boldFont: PDFFont,
) {
  const { width, height } = page.getSize();
  const margin = 12;
  const boxWidth = Math.min(245, width - margin * 2);
  const boxHeight = 46;
  const x = margin;
  const y = height - margin - boxHeight;

  page.drawRectangle({
    x,
    y,
    width: boxWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    opacity: 0.9,
    borderColor: rgb(0.15, 0.39, 0.72),
    borderWidth: 0.8,
  });
  page.drawText("BuilderLYNK Receipt Record", {
    x: x + 7,
    y: y + 33,
    size: 8,
    font: boldFont,
    color: rgb(0.09, 0.23, 0.38),
  });
  const jobDisplay = [transaction.job_number, transaction.job_name].filter(Boolean).join(" - ")
    || transaction.chart_account_name
    || "Not assigned";
  page.drawText(truncateToWidth(`Job: ${jobDisplay}`, font, 7, boxWidth - 14), {
    x: x + 7,
    y: y + 21,
    size: 7,
    font,
    color: rgb(0.12, 0.16, 0.22),
  });
  page.drawText(truncateToWidth(`Code: ${transaction.cost_code || "Not assigned"}`, font, 7, boxWidth - 14), {
    x: x + 7,
    y: y + 11,
    size: 7,
    font,
    color: rgb(0.12, 0.16, 0.22),
  });
  page.drawText(truncateToWidth(`Entered by: ${transaction.created_by_name || "Unknown"}`, font, 6.5, boxWidth - 14), {
    x: x + 7,
    y: y + 2.5,
    size: 6.5,
    font,
    color: rgb(0.28, 0.33, 0.4),
  });
}

function appendReceiptRecordPages(
  document: PDFDocument,
  transaction: CreditCardPackageTransaction,
  metadata: CreditCardReportMetadata,
  font: PDFFont,
  boldFont: PDFFont,
) {
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const contentWidth = pageSize[0] - margin * 2;
  let page = document.addPage(pageSize);
  const recordPages: PDFPage[] = [page];
  let y = 0;

  const startPage = (continuation = false) => {
    if (continuation) {
      page = document.addPage(pageSize);
      recordPages.push(page);
    }
    page.drawRectangle({ x: 0, y: 0, width: pageSize[0], height: pageSize[1], color: rgb(1, 1, 1) });
    page.drawRectangle({ x: 0, y: pageSize[1] - 86, width: pageSize[0], height: 86, color: rgb(0.09, 0.23, 0.38) });
    page.drawText(continuation ? "BuilderLYNK Receipt Record - Continued" : "BuilderLYNK Receipt Record", {
      x: margin,
      y: pageSize[1] - 52,
      size: continuation ? 17 : 21,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    if (!continuation) {
      page.drawText("Exported provenance and audit metadata", {
        x: margin,
        y: pageSize[1] - 70,
        size: 9,
        font,
        color: rgb(0.82, 0.89, 0.97),
      });
    }
    y = pageSize[1] - 112;
  };

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded >= 52) return;
    startPage(true);
  };

  const section = (title: string) => {
    ensureSpace(30);
    page.drawText(pdfText(title), { x: margin, y, size: 11, font: boldFont, color: rgb(0.15, 0.39, 0.72) });
    y -= 18;
  };

  const field = (label: string, value: unknown) => {
    const labelWidth = 132;
    const lines = wrapPdfText(String(value ?? "Not recorded"), font, 9, contentWidth - labelWidth);
    ensureSpace(Math.max(17, lines.length * 12 + 4));
    page.drawText(pdfText(label), { x: margin, y, size: 9, font: boldFont, color: rgb(0.24, 0.29, 0.36) });
    lines.forEach((line, index) => {
      page.drawText(line, { x: margin + labelWidth, y: y - index * 12, size: 9, font, color: rgb(0.12, 0.16, 0.22) });
    });
    y -= Math.max(17, lines.length * 12 + 4);
  };

  startPage();
  section("Transaction identity");
  field("Company", metadata.companyName);
  field("Transaction ID", transaction.id);
  field("Transaction date", transaction.transaction_date);
  field("Amount", Number(transaction.amount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" }));
  field("Merchant / vendor", transaction.vendor_name || transaction.merchant_name || "Not recorded");
  field("Description", transaction.description || "Not recorded");
  field("Reference", transaction.reference_number || "Not recorded");

  section("BuilderLYNK coding");
  field("Job / account", [transaction.job_number, transaction.job_name].filter(Boolean).join(" - ") || transaction.chart_account_name || "Not assigned");
  field("Cost code", transaction.cost_code || "Not assigned");
  field("Class", transaction.cost_code_type || "Not assigned");
  field("Allocation", transaction.allocation_summary || "Not split");
  field("Coding status", transaction.journal_entry_id ? "Posted" : (transaction.coding_status || "Uncoded"));
  field("Notes", transaction.notes || "None");

  section("Card and entry information");
  field("Credit card", `${transaction.credit_card_name} (*${transaction.card_number_last_four || "----"})`);
  field("Cardholder", transaction.cardholder_name || "Not recorded");
  field("Entered by", transaction.created_by_name || "Unknown user");
  field("Entered at", displayDateTime(transaction.created_at));
  field("Last updated", displayDateTime(transaction.updated_at));
  field("Exported at", new Date().toLocaleString());

  section(`Audit trail (${transaction.audit_trail.length})`);
  if (transaction.audit_trail.length === 0) {
    field("History", "No historical audit entries were available for this transaction. The current record metadata above remains authoritative.");
  } else {
    transaction.audit_trail.forEach((entry, index) => {
      const summary = [
        `${index + 1}. ${displayDateTime(entry.created_at)} - ${entry.changed_by_name || "Unknown user"} - ${entry.action}`,
        entry.field_name ? `Field: ${entry.field_name}` : null,
        entry.old_value !== null || entry.new_value !== null
          ? `Change: ${entry.old_value || "(empty)"} -> ${entry.new_value || "(empty)"}`
          : null,
        entry.reason ? `Reason: ${entry.reason}` : null,
      ].filter(Boolean).join(" | ");
      const lines = wrapPdfText(summary, font, 8.5, contentWidth);
      ensureSpace(lines.length * 11 + 11);
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: margin,
          y: y - lineIndex * 11,
          size: 8.5,
          font: lineIndex === 0 ? boldFont : font,
          color: rgb(0.12, 0.16, 0.22),
        });
      });
      y -= lines.length * 11 + 11;
    });
  }

  const totalPages = document.getPageCount();
  recordPages.forEach((recordPage, recordIndex) => {
    recordPage.drawRectangle({ x: 0, y: pageSize[1] - 86, width: pageSize[0], height: 86, color: rgb(0.09, 0.23, 0.38) });
    recordPage.drawText(recordIndex === 0 ? "BuilderLYNK Receipt Record" : "BuilderLYNK Receipt Record - Continued", {
      x: margin,
      y: pageSize[1] - 52,
      size: recordIndex === 0 ? 21 : 17,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    if (recordIndex === 0) {
      recordPage.drawText("Exported provenance and audit metadata", {
        x: margin,
        y: pageSize[1] - 70,
        size: 9,
        font,
        color: rgb(0.82, 0.89, 0.97),
      });
    }
    const pageNumber = document.getPages().indexOf(recordPage) + 1;
    recordPage.drawText(`BuilderLYNK transaction ${transaction.id} | Page ${pageNumber} of ${totalPages}`, {
      x: margin,
      y: 28,
      size: 7,
      font,
      color: rgb(0.45, 0.49, 0.55),
    });
  });
}

export async function addPdfProvenance(
  blob: Blob,
  transaction: CreditCardPackageTransaction,
  metadata: CreditCardReportMetadata,
) {
  const document = await PDFDocument.load(await blob.arrayBuffer());
  const font = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const originalPages = [...document.getPages()];
  originalPages.forEach((page) => drawProvenanceBox(page, transaction, font, boldFont));
  appendReceiptRecordPages(document, transaction, metadata, font, boldFont);
  const bytes = await document.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export async function createCreditCardTransactionsWorkbook(
  transactions: CreditCardPackageTransaction[],
  metadata: CreditCardReportMetadata,
  attachmentResults: Map<string, { fileName: string; status: string }> = new Map(),
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = metadata.companyName;
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Transactions", {
    views: [{ state: "frozen", ySplit: 8 }],
  });

  const headers = [
    "Date",
    "Credit Card",
    "Last 4",
    "Cardholder",
    "Merchant",
    "Vendor",
    "Description",
    "Amount",
    "Job / Account",
    "Cost Code",
    "Cost Code Description",
    "Class",
    "Allocation Detail",
    "Coding Status",
    "Posted",
    "Attachment File",
    "Attachment Export Status",
  ];

  worksheet.mergeCells(1, 1, 1, headers.length);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = "Credit Card Transaction Report";
  titleCell.font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 28;

  worksheet.getCell("A3").value = "Company";
  worksheet.getCell("B3").value = metadata.companyName;
  worksheet.getCell("A4").value = "Credit card";
  worksheet.getCell("B4").value = metadata.cardLabel;
  worksheet.getCell("A5").value = "Date range";
  worksheet.getCell("B5").value = `${format(metadata.dateFrom, "MM/dd/yyyy")} - ${format(metadata.dateTo, "MM/dd/yyyy")}`;
  worksheet.getCell("A6").value = "Transactions";
  worksheet.getCell("B6").value = transactions.length;
  worksheet.getCell("D6").value = "Total amount";
  worksheet.getCell("E6").value = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  worksheet.getCell("E6").numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';

  ["A3", "A4", "A5", "A6", "D6"].forEach((address) => {
    worksheet.getCell(address).font = { bold: true, color: { argb: "FF334155" } };
  });

  const headerRowNumber = 8;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF1D4ED8" } } };
  });

  transactions.forEach((item, index) => {
    const attachment = attachmentResults.get(item.id);
    const row = worksheet.addRow([
      transactionDate(item.transaction_date),
      item.credit_card_name,
      item.card_number_last_four,
      item.cardholder_name,
      item.merchant_name || "",
      item.vendor_name || "",
      item.description || "",
      Number(item.amount || 0),
      item.chart_account_name || item.job_name || "",
      item.cost_code_number || "",
      item.cost_code_description || "",
      item.cost_code_type || "",
      item.allocation_summary || "",
      item.journal_entry_id ? "Posted" : (item.coding_status || "Uncoded"),
      item.journal_entry_id ? "Yes" : "No",
      attachment?.fileName || "",
      attachment?.status || (item.attachment_url ? "Attachment available" : "No attachment"),
    ]);

    row.getCell(1).numFmt = "mm/dd/yyyy";
    row.getCell(8).numFmt = '"$"#,##0.00;[Red]-"$"#,##0.00';
    row.alignment = { vertical: "top" };
    [7, 11, 13, 16, 17].forEach((column) => {
      row.getCell(column).alignment = { vertical: "top", wrapText: true };
    });

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
    }
  });

  const lastDataRow = Math.max(headerRowNumber + transactions.length, headerRowNumber);
  worksheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: lastDataRow, column: headers.length } };
  worksheet.columns = [
    { width: 12 }, { width: 24 }, { width: 10 }, { width: 22 }, { width: 24 }, { width: 24 },
    { width: 38 }, { width: 14 }, { width: 28 }, { width: 15 }, { width: 30 }, { width: 14 },
    { width: 45 }, { width: 15 }, { width: 10 }, { width: 55 }, { width: 22 },
  ];

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function exportCreditCardTransactionsPackage(options: {
  transactions: CreditCardPackageTransaction[];
  metadata: CreditCardReportMetadata;
  onProgress?: (progress: CreditCardPackageProgress) => void;
}): Promise<CreditCardPackageResult> {
  const { transactions, metadata, onProgress } = options;
  const zip = new JSZip();
  const receiptsFolder = zip.folder("Receipts")!;
  const attachments = transactions.filter((item) => Boolean(item.attachment_url));
  const usedNames = new Set<string>();
  const attachmentResults = new Map<string, { fileName: string; status: string }>();
  let includedAttachments = 0;
  let failedAttachments = 0;

  for (let index = 0; index < attachments.length; index += 1) {
    const transaction = attachments[index];
    onProgress?.({
      current: index + 1,
      total: attachments.length,
      message: `Downloading receipt ${index + 1} of ${attachments.length}`,
    });

    const blob = await downloadAttachment(transaction.attachment_url!);
    if (!blob) {
      failedAttachments += 1;
      attachmentResults.set(transaction.id, { fileName: "", status: "Download failed" });
      continue;
    }

    const extension = attachmentExtension(transaction.attachment_url!, blob);
    const fileName = uniqueAttachmentName(
      transaction,
      extension,
      usedNames,
    );
    let exportBlob = blob;
    let status = "Included";
    if (extension === "pdf" || blob.type.toLowerCase() === "application/pdf") {
      try {
        exportBlob = await addPdfProvenance(blob, transaction, metadata);
        status = "Included with BuilderLYNK metadata";
      } catch (error) {
        console.warn("Unable to add BuilderLYNK metadata to receipt PDF", transaction.id, error);
        status = "Included without PDF metadata (processing failed)";
      }
    } else {
      status = "Included in original format";
    }
    receiptsFolder.file(fileName, await exportBlob.arrayBuffer());
    attachmentResults.set(transaction.id, { fileName, status });
    includedAttachments += 1;
  }

  onProgress?.({ current: attachments.length, total: attachments.length, message: "Creating Excel workbook" });
  const workbookBlob = await createCreditCardTransactionsWorkbook(transactions, metadata, attachmentResults);
  zip.file("Credit Card Transactions.xlsx", await workbookBlob.arrayBuffer());

  onProgress?.({ current: attachments.length, total: attachments.length, message: "Creating ZIP file" });
  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `credit-card-export-${format(metadata.dateFrom, "yyyy-MM-dd")}-to-${format(metadata.dateTo, "yyyy-MM-dd")}.zip`;

  return { blob, fileName, includedAttachments, failedAttachments };
}

