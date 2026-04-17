import { PDFDocument } from 'pdf-lib';

export interface DownloadableRfpPlanPage {
  plan_id: string;
  plan_name: string;
  plan_file_url: string | null;
  page_number: number;
  sheet_number: string | null;
  page_title: string | null;
}

export async function downloadRfpPlanPagesPdf(params: {
  fileName: string;
  pages: DownloadableRfpPlanPage[];
}) {
  const { fileName, pages } = params;
  const pagesWithFiles = pages.filter((page) => page.plan_file_url);
  if (pagesWithFiles.length === 0) {
    throw new Error('No plan file URLs are available for the selected pages.');
  }

  const mergedPdf = await PDFDocument.create();
  const pagesByPlan = new Map<string, DownloadableRfpPlanPage[]>();

  for (const page of pagesWithFiles) {
    const key = String(page.plan_file_url);
    const existing = pagesByPlan.get(key) || [];
    existing.push(page);
    pagesByPlan.set(key, existing);
  }

  for (const [planFileUrl, groupedPages] of pagesByPlan.entries()) {
    const response = await fetch(planFileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch plan PDF: ${response.status}`);
    }

    const bytes = await response.arrayBuffer();
    const sourcePdf = await PDFDocument.load(bytes);
    const totalPages = sourcePdf.getPageCount();

    const pageIndexes = groupedPages
      .map((page) => Math.max(0, page.page_number - 1))
      .filter((pageIndex) => pageIndex < totalPages);

    if (pageIndexes.length === 0) continue;

    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndexes);
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
