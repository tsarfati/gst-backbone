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
import { CalendarIcon, Download, Loader2, ArrowLeft, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { exportCreditCardTransactionReport } from "@/utils/pdfExport";
import {
  createCreditCardTransactionsWorkbook,
  exportCreditCardTransactionsPackage,
  type CreditCardPackageTransaction,
} from "@/utils/creditCardTransactionPackageExport";
import { useWebsiteJobAccess } from "@/hooks/useWebsiteJobAccess";
import { canAccessJobIds } from "@/utils/jobAccess";

interface CreditCard {
  id: string;
  card_name: string;
  cardholder_name: string;
  card_number_last_four: string;
}

interface ReportCostCode {
  code: string | null;
  description: string | null;
  type: string | null;
}

interface ReportDistribution {
  transaction_id: string;
  job_id: string | null;
  cost_code_id: string | null;
  amount: number | null;
  percentage: number | null;
  jobs: { name: string } | null;
  cost_codes: ReportCostCode | null;
}

interface RawReportTransaction {
  id: string;
  job_id: string | null;
  transaction_date: string;
  amount: number;
  merchant_name: string | null;
  description: string;
  attachment_url: string | null;
  coding_status: string | null;
  journal_entry_id: string | null;
  vendors: { name: string } | null;
  jobs: { id: string; name: string } | null;
  cost_codes: ReportCostCode | null;
  chart_of_accounts: { account_name: string } | null;
  credit_cards: {
    card_name: string;
    cardholder_name: string;
    card_number_last_four: string;
  } | null;
}

type TransactionData = CreditCardPackageTransaction;

const ALL_CARDS_VALUE = "__all_credit_cards__";

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function CreditCardTransactionReport() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>(ALL_CARDS_VALUE);
  const [dateFrom, setDateFrom] = useState<Date>();
  const [dateTo, setDateTo] = useState<Date>();
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPackage, setExportingPackage] = useState(false);
  const [exportProgress, setExportProgress] = useState("");

  useEffect(() => {
    if (!currentCompany?.id || websiteJobAccessLoading) return;

    const companyId = currentCompany.id;
    const fetchCreditCards = async () => {
      const { data, error } = await supabase
        .from("credit_cards")
        .select("id, card_name, cardholder_name, card_number_last_four")
        .eq("company_id", companyId)
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

    void fetchCreditCards();
  }, [currentCompany?.id, websiteJobAccessLoading, toast]);

  const generateReport = async () => {
    if (!currentCompany?.id || !selectedCard || !dateFrom || !dateTo) {
      toast({
        title: "Missing Information",
        description: "Please select a credit card and date range",
        variant: "destructive",
      });
      return;
    }

    if (dateFrom > dateTo) {
      toast({
        title: "Invalid Date Range",
        description: "The From Date must be on or before the To Date",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const rawTransactions: RawReportTransaction[] = [];
      const pageSize = 1000;

      for (let start = 0; ; start += pageSize) {
        let transactionQuery = supabase
          .from("credit_card_transactions")
          .select(`
            id,
            job_id,
            transaction_date,
            amount,
            merchant_name,
            description,
            attachment_url,
            coding_status,
            journal_entry_id,
            vendors (name),
            jobs:job_id(id, name),
            cost_codes (code, description, type),
            chart_of_accounts (account_name),
            credit_cards:credit_card_id(card_name, cardholder_name, card_number_last_four)
          `)
          .eq("company_id", currentCompany.id)
          .gte("transaction_date", format(dateFrom, "yyyy-MM-dd"))
          .lte("transaction_date", format(dateTo, "yyyy-MM-dd"))
          .order("transaction_date", { ascending: false })
          .order("id", { ascending: true })
          .range(start, start + pageSize - 1);

        if (selectedCard !== ALL_CARDS_VALUE) {
          transactionQuery = transactionQuery.eq("credit_card_id", selectedCard);
        }

        const { data, error } = await transactionQuery;
        if (error) throw error;

        const page = (data || []) as unknown as RawReportTransaction[];
        rawTransactions.push(...page);
        if (page.length < pageSize) break;
      }

      const txIds = rawTransactions.map((txn) => txn.id);

      const distsByTransaction: Record<string, ReportDistribution[]> = {};

      if (txIds.length > 0) {
        const distributionBatchSize = 200;
        for (let start = 0; start < txIds.length; start += distributionBatchSize) {
          const idBatch = txIds.slice(start, start + distributionBatchSize);
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
            .in("transaction_id", idBatch);

          if (distError) throw distError;

          ((distRows || []) as unknown as ReportDistribution[]).forEach((row) => {
            if (!distsByTransaction[row.transaction_id]) {
              distsByTransaction[row.transaction_id] = [];
            }
            distsByTransaction[row.transaction_id].push(row);
          });
        }
      }

      const visibleTransactions = rawTransactions.filter((txn) => {
        const distGroup = distsByTransaction[txn.id] || [];
        const distJobIds = distGroup
          .map((row) => row.job_id)
          .filter((jobId): jobId is string => !!jobId);
        return canAccessJobIds([txn.job_id, ...distJobIds], isPrivileged, allowedJobIds);
      });

      const formattedData: TransactionData[] = visibleTransactions.map((txn) => {
        const distGroup = distsByTransaction[txn.id] || [];
        const uniqueValues = (values: Array<string | null | undefined>) =>
          Array.from(new Set(values.filter((value): value is string => Boolean(value))));
        const costCodeSources = distGroup.length > 0
          ? distGroup.map((row) => row.cost_codes).filter((code): code is ReportCostCode => Boolean(code))
          : (txn.cost_codes ? [txn.cost_codes] : []);
        const jobNames = uniqueValues(
          distGroup.length > 0
            ? distGroup.map((row) => row.jobs?.name)
            : [txn.jobs?.name],
        );
        const costCodeNumbers = uniqueValues(costCodeSources.map((code) => code.code));
        const costCodeDescriptions = uniqueValues(costCodeSources.map((code) => code.description));
        const costCodeTypes = uniqueValues(costCodeSources.map((code) => {
          const rawType = code.type;
          return rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : null;
        }));
        const costCodeDisplays = uniqueValues(costCodeSources.map((code) =>
          code.code ? `${code.code}${code.description ? ` - ${code.description}` : ""}` : null,
        ));
        const card = txn.credit_cards;

        return {
          id: txn.id,
          transaction_date: txn.transaction_date,
          amount: txn.amount,
          merchant_name: txn.merchant_name || "",
          description: txn.description,
          vendor_name: txn.vendors?.name || null,
          job_name: jobNames.join("; ") || null,
          cost_code: costCodeDisplays.join("; ") || null,
          cost_code_number: costCodeNumbers.join("; ") || null,
          cost_code_description: costCodeDescriptions.join("; ") || null,
          cost_code_type: costCodeTypes.join("; ") || null,
          chart_account_name: txn.chart_of_accounts?.account_name || null,
          credit_card_name: card?.card_name || "Credit Card",
          cardholder_name: card?.cardholder_name || "",
          card_number_last_four: card?.card_number_last_four || "",
          coding_status: txn.coding_status,
          journal_entry_id: txn.journal_entry_id,
          attachment_url: txn.attachment_url,
          allocation_summary: distGroup.length > 0
            ? distGroup.map((row) => {
                const job = row.jobs?.name || "No job";
                const code = row.cost_codes?.code || "No cost code";
                const amount = Number(row.amount || 0).toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                });
                return `${job} / ${code} / ${amount}`;
              }).join("; ")
            : null,
        };
      });

      setTransactions(formattedData);

      toast({
        title: "Success",
        description: `Found ${formattedData.length} transactions`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to generate report"),
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
      const pdfCardData = selectedCardData || {
        id: ALL_CARDS_VALUE,
        card_name: "All credit cards",
        cardholder_name: "All cardholders",
        card_number_last_four: "Multiple",
      };
      
      await exportCreditCardTransactionReport({
        transactions,
        creditCard: pdfCardData,
        dateFrom,
        dateTo,
        companyName: currentCompany?.name || "Company",
        companyId: currentCompany?.id || "",
      });

      toast({
        title: "Success",
        description: "Report exported to PDF",
      });
    } catch (error: unknown) {
      toast({
        title: "Export Failed",
        description: errorMessage(error, "Failed to export report"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const reportMetadata = () => {
    const selectedCardData = creditCards.find((card) => card.id === selectedCard);
    return {
      companyName: currentCompany?.name || "Company",
      cardLabel: selectedCardData
        ? `${selectedCardData.card_name} (*${selectedCardData.card_number_last_four})`
        : "All credit cards",
      dateFrom: dateFrom!,
      dateTo: dateTo!,
    };
  };

  const handleExportExcel = async () => {
    if (!selectedCard || !dateFrom || !dateTo || transactions.length === 0) {
      toast({
        title: "Cannot Export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    try {
      const workbookBlob = await createCreditCardTransactionsWorkbook(transactions, reportMetadata());
      const fileName = `credit-card-transactions-${format(dateFrom, "yyyy-MM-dd")}-to-${format(dateTo, "yyyy-MM-dd")}.xlsx`;
      downloadBlob(workbookBlob, fileName);

      toast({
        title: "Success",
        description: "Report exported to Excel",
      });
    } catch (error: unknown) {
      toast({
        title: "Export Failed",
        description: errorMessage(error, "Failed to export to Excel"),
        variant: "destructive",
      });
    }
  };

  const handleExportPackage = async () => {
    if (!selectedCard || !dateFrom || !dateTo || transactions.length === 0) {
      toast({
        title: "Cannot Export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    setExportingPackage(true);
    setExportProgress("Preparing export");

    try {
      const result = await exportCreditCardTransactionsPackage({
        transactions,
        metadata: reportMetadata(),
        onProgress: ({ message }) => setExportProgress(message),
      });
      downloadBlob(result.blob, result.fileName);

      toast({
        title: "Export Complete",
        description: result.failedAttachments > 0
          ? `Included ${result.includedAttachments} receipts. ${result.failedAttachments} could not be downloaded and are identified in the workbook.`
          : `Included ${result.includedAttachments} receipts and the Excel workbook.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Export Failed",
        description: errorMessage(error, "Failed to create the transaction package"),
        variant: "destructive",
      });
    } finally {
      setExportingPackage(false);
      setExportProgress("");
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
              <Label htmlFor="credit-card">Credit Card(s)</Label>
              <Select
                value={selectedCard}
                onValueChange={(value) => {
                  setSelectedCard(value);
                  setTransactions([]);
                }}
              >
                <SelectTrigger id="credit-card">
                  <SelectValue placeholder="Select credit card" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_CARDS_VALUE}>All credit cards</SelectItem>
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
                    onSelect={(value) => {
                      setDateFrom(value);
                      setTransactions([]);
                    }}
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
                    onSelect={(value) => {
                      setDateTo(value);
                      setTransactions([]);
                    }}
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
                <Button variant="outline" onClick={handleExportPackage} disabled={exportingPackage}>
                  {exportingPackage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="mr-2 h-4 w-4" />
                  )}
                  Export Excel + Receipts
                </Button>
              </>
            )}
          </div>
          {exportProgress && (
            <p className="text-sm text-muted-foreground" role="status">
              {exportProgress}
            </p>
          )}
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
                    <TableHead>Card</TableHead>
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
                      <TableCell>{format(new Date(`${txn.transaction_date.slice(0, 10)}T00:00:00`), "MM/dd/yyyy")}</TableCell>
                      <TableCell>
                        <div>{txn.credit_card_name}</div>
                        {txn.card_number_last_four && (
                          <div className="text-xs text-muted-foreground">*{txn.card_number_last_four}</div>
                        )}
                      </TableCell>
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
