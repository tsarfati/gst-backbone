import { useEffect, useMemo, useState } from "react";
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
import { CalendarIcon, ChevronDown, Loader2, Download, FileDown } from "lucide-react";
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
}

export default function GeneralLedger() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [openAccounts, setOpenAccounts] = useState(false);
  const [dateStart, setDateStart] = useState<Date>(() => new Date(new Date().getFullYear(), 0, 1));
  const [dateEnd, setDateEnd] = useState<Date>(() => new Date());
  const [lines, setLines] = useState<LedgerLine[]>([]);
  const [periodFilter, setPeriodFilter] = useState("custom");
  const [showReversed, setShowReversed] = useState(true);

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

      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select(
          `id, description, debit_amount, credit_amount, account_id,
           journal_entries!inner(entry_date, reference, status, company_id, is_reversed)`
        )
        .in("account_id", accountIds)
        .eq("journal_entries.company_id", currentCompany.id)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", format(dateStart, "yyyy-MM-dd"))
        .lte("journal_entries.entry_date", format(dateEnd, "yyyy-MM-dd"))
        .order("journal_entries(entry_date)", { ascending: true });

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
      }));

      // Filter out reversed transactions if toggle is off
      if (!showReversed) {
        mapped = mapped.filter(line => !line.is_reversed);
      }

      // Sort by date ascending
      mapped.sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

      setLines(mapped);
      
      if (mapped.length === 0) {
        toast({
          title: "No transactions found",
          description: "No journal entries match the selected criteria",
        });
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
  }, [accounts.length, showReversed]);

  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

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

  const handleExportPDF = async () => {
    if (lines.length === 0) {
      toast({
        title: "No data to export",
        description: "Please load the report first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Check for custom template
      const { data: templateData } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .eq('template_type', 'general_ledger')
        .maybeSingle();

      if (templateData?.template_file_url) {
        // Use custom template if available
        toast({
          title: "Custom template support",
          description: "Custom templates for General Ledger are coming soon. Using default PDF for now.",
        });
      }

      // Generate default PDF
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(18);
      doc.text("General Ledger Report", 14, 20);
      
      // Add company info
      doc.setFontSize(11);
      doc.text(`Company: ${currentCompany?.display_name || currentCompany?.name || ""}`, 14, 30);
      doc.text(`Period: ${format(dateStart, "MM/dd/yyyy")} - ${format(dateEnd, "MM/dd/yyyy")}`, 14, 36);
      doc.text(`Generated: ${format(new Date(), "MM/dd/yyyy HH:mm")}`, 14, 42);

      // Calculate totals
      const totalDebit = lines.reduce((sum, line) => sum + (line.debit_amount || 0), 0);
      const totalCredit = lines.reduce((sum, line) => sum + (line.credit_amount || 0), 0);

      // Add table
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

      doc.save(`General_Ledger_${format(dateStart, "yyyy-MM-dd")}_to_${format(dateEnd, "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Export successful",
        description: "General Ledger has been exported to PDF",
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast({
        title: "Export failed",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">General Ledger</h1>
        <p className="text-muted-foreground">Filter by date and accounts, then view detailed ledger lines.</p>
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
                {lines.map((line) => (
                  <TableRow key={line.id} className={line.is_reversed ? "opacity-60" : ""}>
                    <TableCell>{format(new Date(line.entry_date), "MM/dd/yyyy")}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {accountMap.get(line.account_id)?.account_number} — {accountMap.get(line.account_id)?.account_name}
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
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">No results</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
