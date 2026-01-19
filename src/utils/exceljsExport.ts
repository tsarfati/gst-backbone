import ExcelJS from "exceljs";

export type ExcelCell = string | number | boolean | Date | null | undefined;

function safeSheetName(name: string) {
  // Excel sheet names: max 31 chars, no : \\ / ? * [ ]
  const cleaned = name.replace(/[:\\/?*\[\]]/g, "-").trim();
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned;
}

function downloadArrayBuffer(buffer: ArrayBuffer, fileName: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a moment before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function autoFitWorksheetColumnsFromAoA(
  worksheet: ExcelJS.Worksheet,
  data: ExcelCell[][],
  minWidth = 8,
  maxWidth = 50
) {
  const maxCols = data.reduce((max, row) => Math.max(max, row?.length || 0), 0);

  for (let col = 1; col <= maxCols; col++) {
    let maxLen = 0;
    for (const row of data) {
      const val = row?.[col - 1];
      if (val == null) continue;
      const len = String(val).length;
      if (len > maxLen) maxLen = len;
    }
    worksheet.getColumn(col).width = Math.min(Math.max(maxLen + 2, minWidth), maxWidth);
  }
}

export async function exportAoAToXlsx(options: {
  data: ExcelCell[][];
  fileName: string;
  sheetName?: string;
  autoFit?: boolean;
}) {
  const { data, fileName, sheetName = "Sheet1", autoFit = true } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));

  // Add rows exactly as provided.
  for (const row of data) {
    worksheet.addRow(row as any);
  }

  if (autoFit) {
    autoFitWorksheetColumnsFromAoA(worksheet, data);
  }

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
  downloadArrayBuffer(buffer, fileName);
}

export async function exportJsonToXlsx(options: {
  rows: Record<string, ExcelCell>[];
  fileName: string;
  sheetName?: string;
  autoFit?: boolean;
}) {
  const { rows, fileName, sheetName = "Sheet1", autoFit = true } = options;

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const data: ExcelCell[][] = [headers, ...rows.map((r) => headers.map((h) => r[h]))];

  return exportAoAToXlsx({ data, fileName, sheetName, autoFit });
}
