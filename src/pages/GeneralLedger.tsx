import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronDown, Loader2, Download, FileDown, X, Mail } from "lucide-react";
import ReportEmailModal from "@/components/ReportEmailModal";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { generateReconciliationReportPdf } from "@/utils/reconciliationReportPdf";

interface Account {
  id: string;
  account_name: string;
  account_number: string;
}

interface LedgerLine {
  id: string;
  entry_date: string;
  reference: string | null;
  description: string | null;
  account_id: string;
  debit_amount: number | null;
  credit_amount: number | null;
  is_reversed?: boolean;
  job_id?: string | null;
  cost_code_id?: string | null;
}

interface InvoiceCostLine {
  id: string;
  invoice_id: string;
  issue_date: string;
  invoice_number: string | null;
  vendor_name: string | null;
  description: string | null;
  amount: number;
}

export default function GeneralLedger() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [openAccounts, setOpenAccounts] = useState(false);
  const [dateStart, setDateStart] = useState<Date>(() => new Date(new Date().getFullYear(), 0, 1));
  const [dateEnd, setDateEnd] = useState<Date>(() => new Date());
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [invoiceCostLines, setInvoiceCostLines] = useState<InvoiceCostLine[]>([]);
  const [periodFilter, setPeriodFilter] = useState("custom");
  const [showReversed, setShowReversed] = useState(true);
  const [needsAutoReload, setNeedsAutoReload] = useState(false);
  
  // URL-based filters for job/cost code drill-down
  const filterJobId = searchParams.get("jobId");
  const filterCostCodeId = searchParams.get("costCodeId");
  const filterJobName = searchParams.get("jobName");
  const filterCostCodeDescription = searchParams.get("costCodeDescription");

  // Auto-set date range to the job start date when drilling in from a job/cost code
  useEffect(() => {
    const maybeSetStartDate = async () => {
      if (!currentCompany?.id || !filterJobId) return;

      const { data: jobRow, error } = await supabase
        .from("jobs")
        .select("start_date")
        .eq("id", filterJobId)
        .eq("company_id", currentCompany.id)
        .maybeSingle();

      if (error || !jobRow?.start_date) return;

      const jobStart = new Date(jobRow.start_date);

      // Only auto-adjust if the current start date would hide job history (typical when coming from a prior-year job)
      if (dateStart.getTime() > jobStart.getTime()) {
        setDateStart(jobStart);
        setPeriodFilter("custom");
        setNeedsAutoReload(true);
      }
    };

    maybeSetStartDate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id, filterJobId]);

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (!currentCompany) return;
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, account_name, account_number")
        .eq("company_id", currentCompany.id)
        .eq("is_active", true)
        .order("account_number");
      if (!error && data) {
        setAccounts(data as any);
        setSelectedAccountIds(data.map((a: any) => a.id)); // default to all
      }
    };
    loadAccounts();
  }, [currentCompany]);

  const selectedAll = useMemo(() => selectedAccountIds.length === accounts.length, [selectedAccountIds, accounts]);

  const toggleAll = () => {
    if (selectedAll) setSelectedAccountIds([]);
    else setSelectedAccountIds(accounts.map((a) => a.id));
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePeriodChange = (value: string) => {
    setPeriodFilter(value);
    const now = new Date();
    
    switch (value) {
      case "this-month":
        setDateStart(startOfMonth(now));
        setDateEnd(endOfMonth(now));
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setDateStart(startOfMonth(lastMonth));
        setDateEnd(endOfMonth(lastMonth));
        break;
      case "this-year":
        setDateStart(startOfYear(now));
        setDateEnd(endOfYear(now));
        break;
      case "custom":
        // Keep existing dates
        break;
    }
  };

  const loadReport = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      // Ensure at least one account
      const accountIds = selectedAccountIds.length ? selectedAccountIds : accounts.map((a) => a.id);

      if (accountIds.length === 0) {
        setLines([]);
        toast({
          title: "No accounts selected",
          description: "Please select at least one account",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Build query with optional job/cost code filters
      let query = supabase
        .from("journal_entry_lines")
        .select(
          `id, description, debit_amount, credit_amount, account_id, job_id, cost_code_id,
           journal_entries!inner(entry_date, reference, status, company_id, is_reversed)`
        )
        .in("account_id", accountIds)
        .eq("journal_entries.company_id", currentCompany.id)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", format(dateStart, "yyyy-MM-dd"))
        .lte("journal_entries.entry_date", format(dateEnd, "yyyy-MM-dd"));
      
      // Apply job filter if provided via URL
      if (filterJobId) {
        query = query.eq("job_id", filterJobId);
      }
      
      // Apply cost code filter if provided via URL
      if (filterCostCodeId) {
        query = query.eq("cost_code_id", filterCostCodeId);
      }
      
      query = query.order("journal_entries(entry_date)", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      
      let mapped: LedgerLine[] = (data as any[]).map((row) => ({
        id: row.id,
        description: row.description,
        debit_amount: row.debit_amount,
        credit_amount: row.credit_amount,
        account_id: row.account_id,
        entry_date: row.journal_entries.entry_date,
        reference: row.journal_entries.reference,
        is_reversed: row.journal_entries.is_reversed || false,
        job_id: row.job_id,
        cost_code_id: row.cost_code_id,
      }));

      // Filter out reversed transactions if toggle is off
      if (!showReversed) {
        mapped = mapped.filter(line => !line.is_reversed);
      }

      // Sort by date ascending
      mapped.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      setLines(mapped);

      // In drill-down mode, also show paid invoices / invoice distributions that contribute to job-cost actuals
      if (filterJobId && filterCostCodeId) {
        try {
          const { data: dists, error: distError } = await supabase
            .from("invoice_cost_distributions")
            .select(
              `id, amount, invoice_id,
               invoices!inner(id, invoice_number, issue_date, description, vendor_id, status, job_id, subcontract_id, purchase_order_id)`
            )
            .eq("cost_code_id", filterCostCodeId)
            .eq("invoices.job_id", filterJobId)
            .eq("invoices.status", "paid")
            .is("invoices.subcontract_id", null)
            .is("invoices.purchase_order_id", null)
            .gte("invoices.issue_date", format(dateStart, "yyyy-MM-dd"))
            .lte("invoices.issue_date", format(dateEnd, "yyyy-MM-dd"));

          if (distError) throw distError;

          const rows = (dists || []) as any[];
          const vendorIds = Array.from(
            new Set(rows.map((r) => r?.invoices?.vendor_id).filter(Boolean) as string[])
          );

          const vendorNameById = new Map<string, string>();
          if (vendorIds.length) {
            const { data: vendors } = await supabase
              .from("vendors")
              .select("id, name, display_name")
              .in("id", vendorIds);

            (vendors || []).forEach((v: any) => {
              vendorNameById.set(v.id, v.display_name || v.name || "Vendor");
            });
          }

          const invLines: InvoiceCostLine[] = rows
            .map((r) => {
              const inv = r.invoices;
              return {
                id: r.id,
                invoice_id: r.invoice_id,
                issue_date: inv?.issue_date,
                invoice_number: inv?.invoice_number || null,
                vendor_name: inv?.vendor_id ? vendorNameById.get(inv.vendor_id) || null : null,
                description: inv?.description || null,
                amount: Number(r.amount || 0),
              } as InvoiceCostLine;
            })
            .filter((x) => Boolean(x.issue_date))
            .sort((a, b) => new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime());

          setInvoiceCostLines(invLines);

          if (mapped.length === 0 && invLines.length === 0) {
            toast({
              title: "No transactions found",
              description: "No journal entries or paid invoices match the selected criteria",
            });
          }
        } catch (invErr) {
          console.error("Failed to load invoice distributions:", invErr);
          setInvoiceCostLines([]);

          if (mapped.length === 0) {
            toast({
              title: "No transactions found",
              description: "No journal entries match the selected criteria",
            });
          }
        }
      } else {
        setInvoiceCostLines([]);

        if (mapped.length === 0) {
          toast({
            title: "No transactions found",
            description: "No journal entries match the selected criteria",
          });
        }
      }
    } catch (e) {
      console.error("Failed to load ledger:", e);
      toast({
        title: "Error loading report",
        description: "Failed to load general ledger data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accounts.length) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length, showReversed, filterJobId, filterCostCodeId]);

  useEffect(() => {
    if (!needsAutoReload) return;
    if (!accounts.length) return;
    loadReport();
    setNeedsAutoReload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsAutoReload, accounts.length]);

  const clearJobCostCodeFilter = () => {
    setSearchParams({});
  };

  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

const groupedByAccount = useMemo(() => {
  const groups: Array<{ accountId: string; lines: LedgerLine[]; debitTotal: number; creditTotal: number }>= [];
  if (!lines || lines.length === 0) return groups;
  const map = new Map<string, LedgerLine[]>();
  for (const l of lines) {
    const arr = map.get(l.account_id) || [];
    arr.push(l);
    map.set(l.account_id, arr);
  }
  // Sort groups by account number
  const sortedAccountIds = Array.from(map.keys()).sort((a, b) => {
    const aAcc = accountMap.get(a);
    const bAcc = accountMap.get(b);
    return (aAcc?.account_number || '').localeCompare(bAcc?.account_number || '');
  });
  for (const accId of sortedAccountIds) {
    const ls = (map.get(accId) || []).sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    const debitTotal = ls.reduce((s, x) => s + (x.debit_amount || 0), 0);
    const creditTotal = ls.reduce((s, x) => s + (x.credit_amount || 0), 0);
    groups.push({ accountId: accId, lines: ls, debitTotal, creditTotal });
  }
  return groups;
}, [lines, accountMap]);

const formatCurrency = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

  const handleExportExcel = () => {
    if (lines.length === 0) {
      toast({
        title: "No data to export",
        description: "Please load the report first",
        variant: "destructive",
      });
      return;
    }

    const exportData = lines.map(line => ({
      Date: format(new Date(line.entry_date), "MM/dd/yyyy"),
      Account: `${accountMap.get(line.account_id)?.account_number} - ${accountMap.get(line.account_id)?.account_name}`,
      Reference: line.reference || "",
      Description: line.description || "",
      Debit: line.debit_amount || 0,
      Credit: line.credit_amount || 0,
      Reversed: line.is_reversed ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "General Ledger");
    
    XLSX.writeFile(
      workbook, 
      `General_Ledger_${format(dateStart, "yyyy-MM-dd")}_to_${format(dateEnd, "yyyy-MM-dd")}.xlsx`
    );

    toast({
      title: "Export successful",
      description: "General Ledger has been exported to Excel",
    });
  };

  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const buildPdfDoc = async () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("General Ledger Report", 14, 20);
    doc.setFontSize(11);
    doc.text(`Company: ${currentCompany?.display_name || currentCompany?.name || ""}`, 14, 30);
    doc.text(`Period: ${format(dateStart, "MM/dd/yyyy")} - ${format(dateEnd, "MM/dd/yyyy")}`, 14, 36);
    doc.text(`Generated: ${format(new Date(), "MM/dd/yyyy HH:mm")}`, 14, 42);
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);
    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Account', 'Reference', 'Description', 'Debit', 'Credit']],
      body: lines.map(line => [
        format(new Date(line.entry_date), "MM/dd/yyyy"),
        `${accountMap.get(line.account_id)?.account_number} - ${accountMap.get(line.account_id)?.account_name}`,
        line.reference || "",
        (line.description || "") + (line.is_reversed ? " (REVERSED)" : ""),
        formatCurrency(line.debit_amount),
        formatCurrency(line.credit_amount),
      ]),
      foot: [['', '', '', 'Totals:', formatCurrency(totalDebit), formatCurrency(totalCredit)]],
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] },
      footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold' },
    });
    return doc;
  };

  const handleExportPDF = async () => {
    if (lines.length === 0) {
      toast({ title: "No data to export", description: "Please load the report first", variant: "destructive" });
      return;
    }
    try {
      const doc = await buildPdfDoc();
      doc.save(`General_Ledger_${format(dateStart, "yyyy-MM-dd")}_to_${format(dateEnd, "yyyy-MM-dd")}.pdf`);
      toast({ title: "Export successful", description: "General Ledger has been exported to PDF" });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({ title: "Export failed", description: "Failed to export PDF", variant: "destructive" });
    }
  };
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">General Ledger</h1>
        <p className="text-muted-foreground">Filter by date and accounts, then view detailed ledger lines.</p>
        
        {/* Show active job/cost code filter badge */}
        {(filterJobId || filterCostCodeId) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filterJobName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Job: {filterJobName}
              </Badge>
            )}
            {filterCostCodeDescription && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Cost Code: {filterCostCodeDescription}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearJobCostCodeFilter}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Clear Filter
            </Button>
          </div>
        )}
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm mb-1 block">Period</label>
              <Select value={periodFilter} onValueChange={handlePeriodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm mb-1 block">Start date</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={format(dateStart, "yyyy-MM-dd")} 
                  onChange={(e) => {
                    setDateStart(new Date(e.target.value));
                    setPeriodFilter("custom");
                  }} 
                />
              </div>
            </div>
            <div>
              <label className="text-sm mb-1 block">End date</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input 
                  type="date" 
                  value={format(dateEnd, "yyyy-MM-dd")} 
                  onChange={(e) => {
                    setDateEnd(new Date(e.target.value));
                    setPeriodFilter("custom");
                  }} 
                />
              </div>
            </div>
            <div>
              <label className="text-sm mb-1 block">Accounts</label>
              <Popover open={openAccounts} onOpenChange={setOpenAccounts}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {selectedAll ? "All accounts" : `${selectedAccountIds.length} selected`}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-80">
                  <Command>
                    <div className="p-2 border-b">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={selectedAll} onCheckedChange={toggleAll} id="all-accounts" />
                        <label htmlFor="all-accounts" className="text-sm font-medium cursor-pointer">All accounts</label>
                      </div>
                    </div>
                    <CommandInput placeholder="Search accounts..." />
                    <CommandEmpty>No accounts found.</CommandEmpty>
                    <ScrollArea className="h-[300px]">
                      <CommandGroup>
                        {accounts.map((acc) => {
                          const checked = selectedAccountIds.includes(acc.id);
                          return (
                            <CommandItem key={acc.id} onSelect={() => toggleAccount(acc.id)} className="flex items-center gap-2">
                              <Checkbox checked={checked} onCheckedChange={() => toggleAccount(acc.id)} />
                              <span className="truncate">{acc.account_number} — {acc.account_name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </ScrollArea>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-reversed"
                checked={showReversed}
                onCheckedChange={setShowReversed}
              />
              <Label htmlFor="show-reversed" className="cursor-pointer">Show reversed transactions</Label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={loadReport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load report
            </Button>
            <Button onClick={handleExportExcel} variant="outline" disabled={lines.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
            <Button onClick={handleExportPDF} variant="outline" disabled={lines.length === 0}>
              <FileDown className="mr-2 h-4 w-4" />
              Export to PDF
            </Button>
            <Button onClick={() => setEmailModalOpen(true)} variant="outline" disabled={lines.length === 0}>
              <Mail className="mr-2 h-4 w-4" />
              Email Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedByAccount.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No results</TableCell>
                  </TableRow>
                )}
                {groupedByAccount.map((group) => {
                  const acc = accountMap.get(group.accountId);
                  return (
                    <>
                      <TableRow key={`hdr-${group.accountId}`} className="bg-muted/40">
                        <TableCell colSpan={6} className="font-semibold">
                          {acc?.account_number} — {acc?.account_name}
                        </TableCell>
                      </TableRow>
                      {group.lines.map((line) => (
                        <TableRow key={line.id} className={line.is_reversed ? "opacity-60" : ""}>
                          <TableCell>{format(new Date(line.entry_date), "MM/dd/yyyy")}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {acc?.account_number} — {acc?.account_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{line.reference || ""}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {line.description || ""}
                            {line.is_reversed && <span className="ml-2 text-xs text-muted-foreground">(REVERSED)</span>}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(line.debit_amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.credit_amount)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow key={`tot-${group.accountId}`} className="bg-muted/30 font-semibold">
                        <TableCell colSpan={4} className="text-right">Totals:</TableCell>
                        <TableCell className="text-right">{formatCurrency(group.debitTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(group.creditTotal)}</TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {(filterJobId && filterCostCodeId) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Paid Invoices (Cost Code Activity)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              These invoice distributions contribute to job-cost actuals even when no posted journal entries exist for the cost code.
            </p>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoiceCostLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">No paid invoices in this date range</TableCell>
                    </TableRow>
                  ) : (
                    invoiceCostLines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(l.issue_date), "MM/dd/yyyy")}</TableCell>
                        <TableCell className="whitespace-nowrap">{l.vendor_name || ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{l.invoice_number || ""}</TableCell>
                        <TableCell className="whitespace-nowrap">{l.description || ""}</TableCell>
                        <TableCell className="text-right">{formatCurrency(l.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <ReportEmailModal
        open={emailModalOpen}
        onOpenChange={setEmailModalOpen}
        generatePdf={buildPdfDoc}
        reportName="General Ledger Report"
        fileName={`General_Ledger_${format(dateStart, "yyyy-MM-dd")}_to_${format(dateEnd, "yyyy-MM-dd")}.pdf`}
      />
    </div>
  );
}
