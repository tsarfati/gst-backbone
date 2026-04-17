type ExtractedTextBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PlanSheetMetadata = {
  sheet_number: string | null;
  sheet_title: string | null;
  discipline: string | null;
  confidence: number;
};

const SHEET_NUMBER_PATTERN = /\b([A-Z]{1,4}\s*[-.]?\s*\d{1,4}(?:\.\d{1,3})?)\b/i;
const TITLE_BLOCK_STOP_WORDS = new Set([
  "SCALE",
  "DATE",
  "DRAWN",
  "CHECKED",
  "APPROVED",
  "PROJECT",
  "SHEET",
  "SHEET NO",
  "SHEET NUMBER",
  "DRAWING",
  "DRAWING NO",
  "REV",
  "REVISION",
  "ISSUE",
  "SEAL",
  "STAMP",
  "CLIENT",
  "DETAIL",
  "TYPICAL",
]);

const cleanSheetNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const match = String(value).match(SHEET_NUMBER_PATTERN);
  if (!match?.[1]) return null;
  return match[1].toUpperCase().replace(/\s+/g, "").replace(/([A-Z])-(\d)/g, "$1$2");
};

const inferDiscipline = (sheetNumber?: string | null, title?: string | null) => {
  const sheet = String(sheetNumber || "").trim().toUpperCase();
  const label = String(title || "").trim().toUpperCase();

  if (sheet.startsWith("A")) return "Architecture";
  if (sheet.startsWith("S")) return "Structural";
  if (sheet.startsWith("M")) return "Mechanical";
  if (sheet.startsWith("E")) return "Electrical";
  if (sheet.startsWith("P")) return "Plumbing";
  if (sheet.startsWith("C")) return "Civil";
  if (sheet.startsWith("FP")) return "Fire Protection";
  if (sheet.startsWith("D")) return "Demolition";

  if (label.includes("ARCH")) return "Architecture";
  if (label.includes("STRUCT")) return "Structural";
  if (label.includes("MECHAN")) return "Mechanical";
  if (label.includes("ELECT")) return "Electrical";
  if (label.includes("PLUMB")) return "Plumbing";
  if (label.includes("CIVIL")) return "Civil";
  if (label.includes("FIRE")) return "Fire Protection";
  if (label.includes("DEMO")) return "Demolition";

  return null;
};

const buildTextBoxes = (params: { textItems: any[]; viewportWidth: number; viewportHeight: number }) => {
  const { textItems, viewportWidth, viewportHeight } = params;
  const boxes: ExtractedTextBox[] = [];

  for (const item of textItems || []) {
    const text = String(item?.str || "").trim();
    if (!text) continue;
    const transform = Array.isArray(item?.transform) ? item.transform : null;
    if (!transform || transform.length < 6) continue;

    const x = Number(transform[4]) || 0;
    const yBase = Number(transform[5]) || 0;
    const rawW = Math.abs(Number(item?.width) || Number(transform[0]) || 0);
    const rawH = Math.abs(Number(item?.height) || Number(transform[3]) || 10);
    if (!rawW || !rawH || !viewportWidth || !viewportHeight) continue;

    const boxX = Math.max(0, x);
    const boxY = Math.max(0, viewportHeight - yBase - rawH);
    const boxW = Math.min(rawW, viewportWidth - boxX);
    const boxH = Math.min(rawH, viewportHeight - boxY);
    if (boxW <= 0 || boxH <= 0) continue;

    boxes.push({ text, x: boxX, y: boxY, w: boxW, h: boxH });
  }

  return boxes;
};

const scoreSheetNumberCandidate = (box: ExtractedTextBox, viewportWidth: number, viewportHeight: number) => {
  const text = String(box.text || "").trim();
  const cleaned = cleanSheetNumber(text);
  if (!cleaned) return -1;

  const rightBias = box.x / Math.max(1, viewportWidth);
  const bottomBias = (box.y + box.h) / Math.max(1, viewportHeight);
  const sizeBias = Math.min(1, box.h / 22);
  const compactBias = text.length <= 8 ? 0.25 : 0;

  return rightBias * 0.45 + bottomBias * 0.3 + sizeBias * 0.2 + compactBias;
};

const isUsefulTitleText = (value: string, selectedSheetNumber: string | null) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return false;
  if (trimmed.length < 3 || trimmed.length > 80) return false;

  const normalized = trimmed.toUpperCase().replace(/\s+/g, " ").trim();
  if (selectedSheetNumber && normalized === selectedSheetNumber) return false;
  if (TITLE_BLOCK_STOP_WORDS.has(normalized)) return false;
  if (cleanSheetNumber(normalized) === normalized) return false;
  if (/^\d+$/.test(normalized)) return false;

  return /[A-Z]/i.test(normalized);
};

export function extractPlanSheetMetadataFromPdfText(params: {
  textItems: any[];
  viewportWidth: number;
  viewportHeight: number;
}): PlanSheetMetadata {
  const { textItems, viewportWidth, viewportHeight } = params;
  const boxes = buildTextBoxes({ textItems, viewportWidth, viewportHeight });
  if (boxes.length === 0) {
    return { sheet_number: null, sheet_title: null, discipline: null, confidence: 0 };
  }

  const titleBlockBoxes = boxes.filter(
    (box) =>
      (box.x >= viewportWidth * 0.45 && box.y >= viewportHeight * 0.5) ||
      box.y >= viewportHeight * 0.72,
  );

  const candidatePool = titleBlockBoxes.length > 0 ? titleBlockBoxes : boxes;
  const sortedCandidates = [...candidatePool]
    .map((box) => ({ box, score: scoreSheetNumberCandidate(box, viewportWidth, viewportHeight) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);

  const bestSheetCandidate = sortedCandidates[0]?.box || null;
  const sheetNumber = cleanSheetNumber(bestSheetCandidate?.text);

  let sheetTitle: string | null = null;
  if (bestSheetCandidate) {
    const nearbyTitleBoxes = candidatePool
      .filter((box) => {
        if (box === bestSheetCandidate) return false;
        if (!isUsefulTitleText(box.text, sheetNumber)) return false;
        const verticalDistance = Math.abs(box.y - bestSheetCandidate.y);
        const horizontalDistance = Math.abs(box.x - bestSheetCandidate.x);
        return verticalDistance <= 120 && horizontalDistance <= viewportWidth * 0.35;
      })
      .sort((a, b) => {
        if (Math.abs(a.y - b.y) > 6) return a.y - b.y;
        return a.x - b.x;
      });

    const titleLines: string[] = [];
    for (const box of nearbyTitleBoxes) {
      const cleaned = String(box.text || "").trim().replace(/\s+/g, " ");
      if (!cleaned || titleLines.includes(cleaned)) continue;
      titleLines.push(cleaned);
      if (titleLines.length >= 2) break;
    }

    if (titleLines.length > 0) {
      sheetTitle = titleLines.join(" / ");
    }
  }

  const discipline = inferDiscipline(sheetNumber, sheetTitle);
  const confidence = sheetNumber ? (sheetTitle ? 0.82 : 0.72) : 0;

  return {
    sheet_number: sheetNumber,
    sheet_title: sheetTitle,
    discipline,
    confidence,
  };
}

export function buildPlanPageRecord(params: {
  planId: string;
  pageNumber: number;
  ocrResult?: Partial<PlanSheetMetadata> | null;
  pdfTextResult?: Partial<PlanSheetMetadata> | null;
}) {
  const { planId, pageNumber, ocrResult, pdfTextResult } = params;

  const sheetNumber =
    cleanSheetNumber(ocrResult?.sheet_number) ||
    cleanSheetNumber(pdfTextResult?.sheet_number) ||
    null;

  const sheetTitle =
    String(ocrResult?.sheet_title || "").trim() ||
    String(pdfTextResult?.sheet_title || "").trim() ||
    null;

  const discipline =
    String(ocrResult?.discipline || "").trim() ||
    String(pdfTextResult?.discipline || "").trim() ||
    inferDiscipline(sheetNumber, sheetTitle) ||
    "General";

  return {
    plan_id: planId,
    page_number: pageNumber,
    sheet_number: sheetNumber,
    page_title: sheetNumber && sheetTitle
      ? `${sheetNumber} - ${sheetTitle}`
      : (sheetTitle || (sheetNumber ? `Sheet ${sheetNumber}` : `Sheet ${pageNumber}`)),
    discipline,
    page_description: sheetTitle
      ? `${discipline} - ${sheetTitle}`
      : (sheetNumber ? `${discipline} - ${sheetNumber}` : `Page ${pageNumber}`),
  };
}

export function isPlaceholderPlanLabel(value: string | null | undefined, pageNumber: number) {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized === `page ${pageNumber}` || normalized === `sheet ${pageNumber}`;
}
