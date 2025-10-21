import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface ReconciliationReportData {
  companyName: string;
  bankName: string;
  accountName: string;
  accountNumber?: string;
  beginningDate: string;
  endingDate: string;
  beginningBalance: number;
  endingBalance: number;
  clearedBalance: number;
  clearedDeposits: Transaction[];
  clearedPayments: Transaction[];
  unclearedDeposits: Transaction[];
  unclearedPayments: Transaction[];
  bankStatementUrl?: string;
}

export const generateReconciliationReportPdf = async (data: ReconciliationReportData) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Helper function for formatting currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(14);
  doc.text('Reconciliation Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(data.bankName, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  const accountInfo = `Account Name: ${data.accountName}${data.accountNumber ? ` ***${data.accountNumber.slice(-4)}` : ''}`;
  doc.text(accountInfo, pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;

  doc.text(`Ending Statement Date: ${format(new Date(data.endingDate), 'MM/dd/yyyy')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Summary section
  const clearedDepositsTotal = data.clearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const clearedPaymentsTotal = data.clearedPayments.reduce((sum, p) => sum + p.amount, 0);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [`Bank Statement Starting Balance on ${format(new Date(data.beginningDate), 'MM/dd/yyyy')}`, formatCurrency(data.beginningBalance)],
      ['Cleared Deposits and other Increases', formatCurrency(clearedDepositsTotal)],
      ['Cleared Checks and other Decreases', formatCurrency(clearedPaymentsTotal)],
      ['Cleared ACH Batches and Reversals', '$0.00'],
      ['Cleared Balance', formatCurrency(data.clearedBalance)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: 'right', cellWidth: 50 }
    },
    didParseCell: (data) => {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
      }
    }
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Cleared Transactions
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Cleared Transactions', 14, yPos);
  yPos += 8;

  // Cleared Deposits
  doc.setFontSize(11);
  doc.text(`Cleared Deposits and other Increases (${data.clearedDeposits.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.clearedDeposits.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.clearedDeposits.map(d => [
          d.description,
          format(new Date(d.date), 'MM/dd/yyyy'),
          formatCurrency(d.amount)
        ]),
        ['Total', '', formatCurrency(clearedDepositsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No cleared deposits', 14, yPos);
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Cleared Payments
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cleared Checks and other Decreases (${data.clearedPayments.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.clearedPayments.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.clearedPayments.map(p => [
          p.description,
          format(new Date(p.date), 'MM/dd/yyyy'),
          formatCurrency(p.amount)
        ]),
        ['Total', '', formatCurrency(clearedPaymentsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No cleared checks', 14, yPos);
    yPos += 10;
  }

  // Check if we need a new page
  if (yPos > 230) {
    doc.addPage();
    yPos = 20;
  }

  // Unreconciled Transactions
  const unclearedDepositsTotal = data.unclearedDeposits.reduce((sum, d) => sum + d.amount, 0);
  const unclearedPaymentsTotal = data.unclearedPayments.reduce((sum, p) => sum + p.amount, 0);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Unreconciled Transactions', 14, yPos);
  yPos += 8;

  // Unreconciled Deposits
  doc.setFontSize(11);
  doc.text(`Unreconciled Deposits and other Increases (${data.unclearedDeposits.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.unclearedDeposits.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.unclearedDeposits.map(d => [
          d.description,
          format(new Date(d.date), 'MM/dd/yyyy'),
          formatCurrency(d.amount)
        ]),
        ['Total', '', formatCurrency(unclearedDepositsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No unreconciled deposits', 14, yPos);
    yPos += 8;
  }

  // Check if we need a new page
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Unreconciled Payments
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Unreconciled Checks and other Decreases (${data.unclearedPayments.length} Items)`, 14, yPos);
  yPos += 5;

  if (data.unclearedPayments.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Description', 'Date', 'Amount']],
      body: [
        ...data.unclearedPayments.map(p => [
          p.description,
          format(new Date(p.date), 'MM/dd/yyyy'),
          formatCurrency(p.amount)
        ]),
        ['Total', '', formatCurrency(unclearedPaymentsTotal)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [66, 139, 202], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { cellWidth: 40 },
        2: { halign: 'right', cellWidth: 40 }
      },
      didParseCell: (data) => {
        if (data.row.index === data.table.body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('No unreconciled checks', 14, yPos);
  }

  // If there's a bank statement URL, fetch and append it
  if (data.bankStatementUrl) {
    try {
      // Get the PDF bytes from jsPDF
      const reportPdfBytes = doc.output('arraybuffer');
      const reportPdf = await PDFDocument.load(reportPdfBytes);

      // Fetch the bank statement PDF
      const response = await fetch(data.bankStatementUrl);
      const bankStatementBytes = await response.arrayBuffer();
      const bankStatementPdf = await PDFDocument.load(bankStatementBytes);

      // Copy all pages from bank statement to report
      const bankStatementPages = await reportPdf.copyPages(bankStatementPdf, bankStatementPdf.getPageIndices());
      bankStatementPages.forEach(page => reportPdf.addPage(page));

      // Save the merged PDF
      const mergedPdfBytes = await reportPdf.save();
      const blob = new Blob([new Uint8Array(mergedPdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error merging bank statement:', error);
      // If merging fails, just download the report without the bank statement
      doc.save(`Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`);
    }
  } else {
    // No bank statement, just download the report
    doc.save(`Reconciliation_Report_${format(new Date(data.endingDate), 'yyyy-MM-dd')}.pdf`);
  }
};
