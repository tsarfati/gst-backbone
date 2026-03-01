import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CalendarIcon, Download, Loader2, ArrowLeft, Mail } from "lucide-react";
import ReportEmailModal from "@/components/ReportEmailModal";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { exportCreditCardTransactionReport } from "@/utils/pdfExport";
import * as XLSX from "xlsx";

interface CreditCard {
  id: string;
  card_name: string;
  cardholder_name: string;
  card_number_last_four: string;
}

interface TransactionData {
  id: string;
  transaction_date: string;
  amount: number;
  merchant_name: string;
  description: string;
  vendor_name: string | null;
  job_name: string | null;
  cost_code: string | null;
  cost_code_type: string | null;
  chart_account_name: string | null;
}

export default function CreditCardTransactionReport() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchCreditCards();
    }
  }, [currentCompany?.id]);

  const fetchCreditCards = async () => {
    if (!currentCompany?.id) return;

    const { data, error } = await supabase
      .from("credit_cards")
      .select("id, card_name, cardholder_name, card_number_last_four")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("card_name");

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load credit cards",
        variant: "destructive",
      });
      return;
    }

    setCreditCards(data || []);
  };

  const generateReport = async () => {
    if (!selectedCard || !dateFrom || !dateTo) {
      toast({
        title: "Missing Information",
        description: "Please select a credit card and date range",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("credit_card_transactions")
        .select(`
          id,
          transaction_date,
          amount,
          merchant_name,
          description,
          vendors (name),
          jobs (name),
          cost_codes (code, description, type),
          chart_of_accounts (account_name)
        `)
        .eq("credit_card_id", selectedCard)
        .gte("transaction_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("transaction_date", format(dateTo, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      const txIds = (data || []).map((txn: any) => txn.id);

      let distsByTransaction: Record<string, any[]> = {};

      if (txIds.length > 0) {
        const { data: distRows, error: distError } = await supabase
          .from("credit_card_transaction_distributions")
          .select(`
            transaction_id,
            job_id,
            cost_code_id,
            amount,
            percentage,
            jobs:job_id(name),
            cost_codes:cost_code_id(code, description, type)
          `)
          .in("transaction_id", txIds);

        if (distError) throw distError;

        (distRows || []).forEach((row: any) => {
          if (!distsByTransaction[row.transaction_id]) {
            distsByTransaction[row.transaction_id] = [];
          }
          distsByTransaction[row.transaction_id].push(row);
        });
      }

      const formattedData: TransactionData[] = (data || []).map((txn: any) => {
        const distGroup = distsByTransaction[txn.id] || [];
        const firstDist = distGroup[0];

        const jobName = firstDist?.jobs?.name || txn.jobs?.name || null;

        const costCodeSource = firstDist?.cost_codes || txn.cost_codes;

        const costCode = costCodeSource
          ? `${costCodeSource.code} - ${costCodeSource.description}`
          : null;

        const rawType = costCodeSource?.type || null;

        const costCodeType = rawType
          ? rawType.charAt(0).toUpperCase() + rawType.slice(1)
          : null;

        return {
          id: txn.id,
          transaction_date: txn.transaction_date,
          amount: txn.amount,
          merchant_name: txn.merchant_name,
          description: txn.description,
          vendor_name: txn.vendors?.name || null,
          job_name: jobName,
          cost_code: costCode,
          cost_code_type: costCodeType,
          chart_account_name: txn.chart_of_accounts?.account_name || null,
        };
      });

      setTransactions(formattedData);

      toast({
        title: "Success",
        description: `Found ${formattedData.length} transactions`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedCard || !dateFrom || !dateTo || transactions.length === 0) {
      toast({
        title: "Cannot Export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);

    try {
      const selectedCardData = creditCards.find(c => c.id === selectedCard);
      
      await exportCreditCardTransactionReport({
        transactions,
        creditCard: selectedCardData!,
        dateFrom,
        dateTo,
        companyName: currentCompany?.name || "Company",
        companyId: currentCompany?.id || "",
      });

      toast({
        title: "Success",
        description: "Report exported to PDF",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export report",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedCard || !dateFrom || !dateTo || transactions.length === 0) {
      toast({
        title: "Cannot Export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedCardData = creditCards.find(c => c.id === selectedCard);
      
      const worksheetData = [
        ["Credit Card Transaction Report"],
        [],
        ["Company:", currentCompany?.name || ""],
        ["Credit Card:", `${selectedCardData?.card_name} (*${selectedCardData?.card_number_last_four})`],
        ["Date Range:", `${format(dateFrom, "MM/dd/yyyy")} - ${format(dateTo, "MM/dd/yyyy")}`],
        ["Total Amount:", `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        [],
        ["Date", "Amount", "Vendor", "Description", "Account/Job", "Cost Code", "Class"],
        ...transactions.map(txn => [
          format(new Date(txn.transaction_date), "MM/dd/yyyy"),
          Number(txn.amount),
          txn.vendor_name || txn.merchant_name || "",
          txn.description || "",
          txn.chart_account_name || txn.job_name || "",
          txn.cost_code || "",
          txn.cost_code_type || ""
        ]),
        [],
        ["", "", "", "", "", "Total:", totalAmount]
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");

      const fileName = `credit-card-transactions-${format(dateFrom, "yyyy-MM-dd")}-to-${format(dateTo, "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Success",
        description: "Report exported to Excel",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export to Excel",
        variant: "destructive",
      });
    }
  };

  const totalAmount = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Credit Card Transaction Report</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="credit-card">Credit Card</Label>
              <Select value={selectedCard} onValueChange={setSelectedCard}>
                <SelectTrigger id="credit-card">
                  <SelectValue placeholder="Select credit card" />
                </SelectTrigger>
                <SelectContent>
                  {creditCards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.card_name} (*{card.card_number_last_four})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>From Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>To Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={generateReport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Report
            </Button>
            {transactions.length > 0 && (
              <>
                <Button variant="outline" onClick={handleExportPDF} disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export PDF
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <Download className="mr-2 h-4 w-4" />
                  Export Excel
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {transactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Transaction Results</span>
              <span className="text-lg font-normal text-muted-foreground">
                Total: ${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Account/Job</TableHead>
                    <TableHead>Cost Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{format(new Date(txn.transaction_date), "MM/dd/yyyy")}</TableCell>
                      <TableCell className="font-medium">
                        ${Number(txn.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{txn.vendor_name || txn.merchant_name || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{txn.description || "-"}</TableCell>
                      <TableCell>{txn.chart_account_name || txn.job_name || "-"}</TableCell>
                      <TableCell>
                        {txn.cost_code ? (
                          <div>
                            <div>{txn.cost_code}</div>
                            {txn.cost_code_type && (
                              <div className="text-xs text-muted-foreground">({txn.cost_code_type})</div>
                            )}
                          </div>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
