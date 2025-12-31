import type { WorkSheet } from "xlsx";

/**
 * Auto-fit column widths for an Excel worksheet based on content
 * @param worksheet The XLSX worksheet to modify
 * @param data The data array used to create the worksheet
 * @param minWidth Minimum column width (default: 8)
 * @param maxWidth Maximum column width (default: 50)
 */
export function autoFitColumns(
  worksheet: WorkSheet,
  data: any[][],
  minWidth: number = 8,
  maxWidth: number = 50
): void {
  const colWidths: { wch: number }[] = [];
  
  data.forEach(row => {
    if (!Array.isArray(row)) return;
    
    row.forEach((cell, colIdx) => {
      const cellValue = cell != null ? String(cell) : "";
      const cellLength = cellValue.length;
      const currentWidth = colWidths[colIdx]?.wch || 0;
      
      if (cellLength > currentWidth) {
        colWidths[colIdx] = { 
          wch: Math.min(Math.max(cellLength + 2, minWidth), maxWidth) 
        };
      }
    });
  });
  
  worksheet["!cols"] = colWidths;
}

/**
 * Auto-fit column widths for an Excel worksheet based on JSON data
 * @param worksheet The XLSX worksheet to modify
 * @param jsonData Array of objects used to create the worksheet
 * @param headers Optional array of header names (column order)
 * @param minWidth Minimum column width (default: 8)
 * @param maxWidth Maximum column width (default: 50)
 */
export function autoFitColumnsFromJson(
  worksheet: WorkSheet,
  jsonData: Record<string, any>[],
  headers?: string[],
  minWidth: number = 8,
  maxWidth: number = 50
): void {
  if (!jsonData.length) return;
  
  const keys = headers || Object.keys(jsonData[0]);
  const colWidths: { wch: number }[] = [];
  
  // Check header widths
  keys.forEach((key, colIdx) => {
    const headerLength = key.length;
    colWidths[colIdx] = { 
      wch: Math.min(Math.max(headerLength + 2, minWidth), maxWidth) 
    };
  });
  
  // Check data widths
  jsonData.forEach(row => {
    keys.forEach((key, colIdx) => {
      const cellValue = row[key] != null ? String(row[key]) : "";
      const cellLength = cellValue.length;
      const currentWidth = colWidths[colIdx]?.wch || 0;
      
      if (cellLength + 2 > currentWidth) {
        colWidths[colIdx] = { 
          wch: Math.min(Math.max(cellLength + 2, minWidth), maxWidth) 
        };
      }
    });
  });
  
  worksheet["!cols"] = colWidths;
}
