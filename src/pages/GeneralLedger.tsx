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
import { CalendarIcon, ChevronDown, Loader2, Download } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";

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

  const loadReport = async () => {
    if (!currentCompany) return;
    setLoading(true);
    try {
      // Ensure at least one account
      const accountIds = selectedAccountIds.length ? selectedAccountIds : accounts.map((a) => a.id);

      const { data, error } = await supabase
        .from("journal_entry_lines")
        .select(
          `id, description, debit_amount, credit_amount, account_id,
           journal_entries!inner(entry_date, reference, status, company_id)`
        )
        .in("account_id", accountIds)
        .eq("journal_entries.company_id", currentCompany.id)
        .eq("journal_entries.status", "posted")
        .gte("journal_entries.entry_date", format(dateStart, "yyyy-MM-dd"))
        .lte("journal_entries.entry_date", format(dateEnd, "yyyy-MM-dd"))
        .order("journal_entries.entry_date", { ascending: true });

      if (error) throw error;
      const mapped: LedgerLine[] = (data as any[]).map((row) => ({
        id: row.id,
        description: row.description,
        debit_amount: row.debit_amount,
        credit_amount: row.credit_amount,
        account_id: row.account_id,
        entry_date: row.journal_entries.entry_date,
        reference: row.journal_entries.reference,
      }));
      setLines(mapped);
    } catch (e) {
      console.error("Failed to load ledger:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accounts.length) loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  const accountMap = useMemo(() => {
    const m = new Map<string, Account>();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);

  const formatCurrency = (n: number | null | undefined) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n || 0));

  const handleExport = () => {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm mb-1 block">Start date</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={format(dateStart, "yyyy-MM-dd")} onChange={(e) => setDateStart(new Date(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="text-sm mb-1 block">End date</label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={format(dateEnd, "yyyy-MM-dd")} onChange={(e) => setDateEnd(new Date(e.target.value))} />
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
                        <label htmlFor="all-accounts" className="text-sm">All accounts</label>
                      </div>
                    </div>
                    <CommandInput placeholder="Search accounts..." />
                    <CommandEmpty>No accounts found.</CommandEmpty>
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
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={loadReport} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load report
            </Button>
            <Button onClick={handleExport} variant="outline" disabled={lines.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
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
                  <TableRow key={line.id}>
                    <TableCell>{format(new Date(line.entry_date), "MM/dd/yyyy")}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {accountMap.get(line.account_id)?.account_number} — {accountMap.get(line.account_id)?.account_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{line.reference || ""}</TableCell>
                    <TableCell className="whitespace-nowrap">{line.description || ""}</TableCell>
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
