import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, FileSpreadsheet } from "lucide-react";
import { formatNumber } from "@/utils/formatNumber";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "bill" | "credit_card";
  reference_number?: string;
}

export default function ProjectCostTransactionHistory() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const jobId = searchParams.get("jobId");
  const costCodeId = searchParams.get("costCodeId");
  const jobName = searchParams.get("jobName");
  const costCodeDescription = searchParams.get("costCodeDescription");
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    if (jobId && costCodeId) {
      loadTransactions();
    }
  }, [jobId, costCodeId]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      
      // Load bills (invoices)
      const { data: bills, error: billsError } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, amount, description")
        .eq("job_id", jobId!)
        .eq("cost_code_id", costCodeId!);

      if (billsError) throw billsError;

      // Load credit card transactions via distributions (ensures job & cost code match)
      const { data: ccDistributions, error: ccError } = await supabase
        .from("credit_card_transaction_distributions")
        .select(`
          id,
          amount,
          transaction_id,
          credit_card_transactions!inner(
            id,
            transaction_date,
            amount,
            description,
            reference_number,
            coding_status
          )
        `)
        .eq("job_id", jobId!)
        .eq("cost_code_id", costCodeId!)
        .eq("credit_card_transactions.coding_status", "coded");

      if (ccError) throw ccError;

      const allTransactions: Transaction[] = [
        ...(bills || []).map((bill: any) => ({
          id: bill.id,
          date: bill.issue_date || "",
          description: bill.description || "Bill",
          amount: bill.amount,
          type: "bill" as const,
          reference_number: bill.invoice_number || undefined,
        })),
        ...(ccDistributions || []).map((dist: any) => ({
          id: dist.credit_card_transactions?.id || dist.transaction_id,
          date: dist.credit_card_transactions?.transaction_date || "",
          description: dist.credit_card_transactions?.description || "Credit Card Transaction",
          amount: dist.amount,
          type: "credit_card" as const,
          reference_number: dist.credit_card_transactions?.reference_number || undefined,
        })),
      ];

      allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const total = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      
      setTransactions(allTransactions);
      setTotalAmount(total);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionClick = (transaction: Transaction) => {
    if (transaction.type === "bill") {
      navigate(`/bills/${transaction.id}`);
    } else {
      navigate(`/credit-cards/transactions?highlight=${transaction.id}`);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Project Cost Transaction History", 14, 15);
    
    doc.setFontSize(10);
    doc.text(`Job: ${jobName || ""}`, 14, 25);
    doc.text(`Cost Code: ${costCodeDescription || ""}`, 14, 30);
    doc.text(`Total Amount: $${formatNumber(totalAmount)}`, 14, 35);
    
    const tableData = transactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.type === "bill" ? "Bill" : "Credit Card",
      t.reference_number || "-",
      t.description,
      `$${formatNumber(t.amount)}`,
    ]);
    
    autoTable(doc, {
      startY: 40,
      head: [["Date", "Type", "Reference", "Description", "Amount"]],
      body: tableData,
      foot: [["", "", "", "Total:", `$${formatNumber(totalAmount)}`]],
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105] },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
    });
    
    doc.save(`project-cost-transactions-${new Date().toISOString().split("T")[0]}.pdf`);
    
    toast({
      title: "Success",
      description: "PDF exported successfully",
    });
  };

  const exportToExcel = () => {
    const worksheetData = [
      ["Project Cost Transaction History"],
      [],
      ["Job:", jobName || ""],
      ["Cost Code:", costCodeDescription || ""],
      ["Total Amount:", `$${formatNumber(totalAmount)}`],
      [],
      ["Date", "Type", "Reference", "Description", "Amount"],
      ...transactions.map(t => [
        new Date(t.date).toLocaleDateString(),
        t.type === "bill" ? "Bill" : "Credit Card",
        t.reference_number || "-",
        t.description,
        t.amount,
      ]),
      [],
      ["", "", "", "Total:", totalAmount],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    
    XLSX.writeFile(workbook, `project-cost-transactions-${new Date().toISOString().split("T")[0]}.xlsx`);
    
    toast({
      title: "Success",
      description: "Excel file exported successfully",
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Project Cost Transaction History</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {jobName} - {costCodeDescription}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            disabled={loading || transactions.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={loading || transactions.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transactions</span>
            <span className="text-lg font-semibold">
              Total: ${formatNumber(totalAmount)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found for this cost code
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow
                    key={`${transaction.type}-${transaction.id}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTransactionClick(transaction)}
                  >
                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {transaction.type === "bill" ? "Bill" : "Credit Card"}
                    </TableCell>
                    <TableCell>{transaction.reference_number || "-"}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${formatNumber(transaction.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
