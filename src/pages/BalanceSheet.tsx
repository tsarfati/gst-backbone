import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

interface AccountRow {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  account_category: string | null;
  current_balance: number | null;
  normal_balance: string | null;
}

type SectionKey = "assets" | "liabilities" | "equity";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);

const normalize = (value: string | null | undefined) => (value || "").toLowerCase();

function classifySection(account: AccountRow): SectionKey | null {
  const type = normalize(account.account_type);
  const category = normalize(account.account_category);

  if (
    type.includes("asset") ||
    type.includes("cash") ||
    type.includes("receivable") ||
    category.includes("asset") ||
    category.includes("cash")
  ) {
    return "assets";
  }

  if (
    type.includes("liability") ||
    type.includes("payable") ||
    type.includes("loan") ||
    type.includes("credit") ||
    category.includes("liabil")
  ) {
    return "liabilities";
  }

  if (type.includes("equity") || category.includes("equity")) {
    return "equity";
  }

  return null;
}

function normalizedAmount(account: AccountRow, section: SectionKey): number {
  const raw = Number(account.current_balance || 0);
  const normal = normalize(account.normal_balance);

  if (section === "assets") {
    return normal === "credit" ? -raw : raw;
  }

  // liabilities/equity are credit-normalized
  return normal === "debit" ? -raw : raw;
}

export default function BalanceSheet() {
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!currentCompany?.id) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("chart_of_accounts")
          .select("id, account_number, account_name, account_type, account_category, current_balance, normal_balance")
          .eq("company_id", currentCompany.id)
          .eq("is_active", true)
          .order("account_number", { ascending: true });

        if (error) throw error;
        setAccounts((data || []) as AccountRow[]);
      } catch (error) {
        console.error("Error loading balance sheet", error);
        toast({
          title: "Error",
          description: "Failed to load balance sheet accounts",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentCompany?.id, toast]);

  const sections = useMemo(() => {
    const assets: Array<AccountRow & { amount: number }> = [];
    const liabilities: Array<AccountRow & { amount: number }> = [];
    const equity: Array<AccountRow & { amount: number }> = [];
    let currentPeriodRevenue = 0;
    let currentPeriodExpense = 0;

    accounts.forEach((account) => {
      const section = classifySection(account);
      if (section) {
        const amount = normalizedAmount(account, section);
        if (section === "assets") assets.push({ ...account, amount });
        if (section === "liabilities") liabilities.push({ ...account, amount });
        if (section === "equity") equity.push({ ...account, amount });
      }

      const type = normalize(account.account_type);
      const normal = normalize(account.normal_balance);
      const raw = Number(account.current_balance || 0);
      if (type.includes("revenue") || type.includes("income")) {
        currentPeriodRevenue += normal === "debit" ? -raw : raw;
      }
      if (type.includes("expense") || type.includes("cost_of_goods_sold") || type.includes("cogs")) {
        currentPeriodExpense += normal === "credit" ? -raw : raw;
      }
    });

    const currentPeriodEarnings = currentPeriodRevenue - currentPeriodExpense;
    if (Math.abs(currentPeriodEarnings) > 0.0001) {
      equity.push({
        id: "current-period-earnings",
        account_number: "",
        account_name: "Current Period Earnings",
        account_type: "equity",
        account_category: "equity",
        current_balance: currentPeriodEarnings,
        normal_balance: "credit",
        amount: currentPeriodEarnings,
      });
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.amount, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.amount, 0);

    return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
  }, [accounts]);

  const renderSection = (
    title: string,
    rows: Array<AccountRow & { amount: number }>,
    total: number,
    tone: "default" | "secondary" = "default"
  ) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Badge variant={tone}>{rows.length} accounts</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Account #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.account_number || "-"}</TableCell>
                <TableCell>{row.account_name}</TableCell>
                <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-semibold">
              <TableCell colSpan={2}>Total {title}</TableCell>
              <TableCell className="text-right">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="p-6">Loading balance sheet...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Balance Sheet</h1>
        <p className="text-sm text-muted-foreground mt-1">As of today</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderSection("Assets", sections.assets, sections.totalAssets, "default")}
        <div className="space-y-6">
          {renderSection("Liabilities", sections.liabilities, sections.totalLiabilities, "secondary")}
          {renderSection("Equity", sections.equity, sections.totalEquity, "secondary")}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Total Assets</span>
            <span className="font-semibold">{formatCurrency(sections.totalAssets)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total Liabilities + Equity</span>
            <span className="font-semibold">{formatCurrency(sections.totalLiabilities + sections.totalEquity)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <span>Difference</span>
            <span className={`font-semibold ${Math.abs(sections.totalAssets - (sections.totalLiabilities + sections.totalEquity)) < 0.01 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(sections.totalAssets - (sections.totalLiabilities + sections.totalEquity))}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
