import ExcelJS from "exceljs";
import JSZip from "jszip";
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

    const fileName = uniqueAttachmentName(
      transaction,
      attachmentExtension(transaction.attachment_url!, blob),
      usedNames,
    );
    receiptsFolder.file(fileName, await blob.arrayBuffer());
    attachmentResults.set(transaction.id, { fileName, status: "Included" });
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

