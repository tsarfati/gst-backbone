import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ArrowLeft, Edit, FileText, Download, Trash2, Calendar, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import DocumentPreviewModal from "@/components/DocumentPreviewModal";

interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
  routing_number?: string;
  description?: string;
  created_at: string;
  chart_account_id?: string;
  gl_balance?: number;
}

interface BankStatement {
  id: string;
  statement_date: string;
  statement_month: number;
  statement_year: number;
  file_name: string;
  display_name?: string;
  file_url: string;
  file_size?: number;
  uploaded_at: string;
  notes?: string;
}

interface ReconcileReport {
  id: string;
  reconcile_date: string;
  reconcile_month: number;
  reconcile_year: number;
  statement_balance: number;
  book_balance: number;
  difference: number;
  is_balanced: boolean;
  file_name?: string;
  file_url?: string;
  reconciled_at: string;
  notes?: string;
}

export default function BankAccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [reconcileReports, setReconcileReports] = useState<ReconcileReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStatement, setEditingStatement] = useState<BankStatement | null>(null);
  const [statementName, setStatementName] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().getMonth() + 1);
  const [statementYear, setStatementYear] = useState(new Date().getFullYear());
  const [previewDocument, setPreviewDocument] = useState<{ fileName: string; url: string; type: string } | null>(null);

  useEffect(() => {
    loadBankAccount();
    loadStatements();
    loadReconcileReports();
  }, [id, currentCompany]);

  const loadBankAccount = async () => {
    if (!currentCompany || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', id)
        .eq('company_id', currentCompany.id)
        .single();

      if (error) throw error;
      
      // Fetch the general ledger balance from chart of accounts
      let glBalance = data.current_balance;
      if (data.chart_account_id) {
        const { data: chartData, error: chartError } = await supabase
          .from('chart_of_accounts')
          .select('current_balance')
          .eq('id', data.chart_account_id)
          .single();
        
        if (!chartError && chartData) {
          glBalance = chartData.current_balance;
        }
      }
      
      setAccount({ ...data, gl_balance: glBalance });
    } catch (error) {
      console.error('Error loading bank account:', error);
      toast({
        title: "Error",
        description: "Failed to load bank account details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatements = async () => {
    if (!currentCompany || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .eq('bank_account_id', id)
        .eq('company_id', currentCompany.id)
        .order('statement_year', { ascending: false })
        .order('statement_month', { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (error) {
      console.error('Error loading statements:', error);
    }
  };

  const loadReconcileReports = async () => {
    if (!currentCompany || !id) return;
    
    try {
      const { data, error } = await supabase
        .from('bank_reconciliations')
        .select('*')
        .eq('bank_account_id', id)
        .eq('company_id', currentCompany.id)
        .eq('status', 'completed')
        .order('ending_date', { ascending: false });

      if (error) throw error;
      
      const recs = (data || []) as any[];

      // Dedupe by ending_date (keep the most recently reconciled one)
      const grouped = new Map<string, any[]>();
      for (const r of recs) {
        const key = r.ending_date;
        const arr = grouped.get(key) || [];
        arr.push(r);
        grouped.set(key, arr);
      }
      const duplicatesToDelete: string[] = [];
      const uniqueRecs: any[] = [];
      grouped.forEach((arr) => {
        arr.sort((a, b) => new Date(b.reconciled_at || b.created_at).getTime() - new Date(a.reconciled_at || a.created_at).getTime());
        const [keep, ...dups] = arr;
        uniqueRecs.push(keep);
        duplicatesToDelete.push(...dups.map(d => d.id));
      });

      if (duplicatesToDelete.length > 0) {
        // Best-effort cleanup; ignore errors due to RLS
        await supabase.from('bank_reconciliations').delete().in('id', duplicatesToDelete);
      }

      // Transform to match ReconcileReport interface
      const reports = uniqueRecs
        .sort((a, b) => new Date(b.ending_date).getTime() - new Date(a.ending_date).getTime())
        .map(rec => ({
          id: rec.id,
          reconcile_date: rec.ending_date,
          reconcile_month: new Date(rec.ending_date).getMonth() + 1,
          reconcile_year: new Date(rec.ending_date).getFullYear(),
          statement_balance: rec.ending_balance,
          book_balance: rec.cleared_balance,
          difference: rec.ending_balance - rec.cleared_balance,
          is_balanced: Math.abs(rec.ending_balance - rec.cleared_balance) < 0.01,
          reconciled_at: rec.reconciled_at || rec.created_at,
          notes: rec.notes
        }));
      
      setReconcileReports(reports);
    } catch (error) {
      console.error('Error loading reconcile reports:', error);
    }
  };

  const handleEditStatement = (statement: BankStatement) => {
    setEditingStatement(statement);
    setStatementName(statement.display_name || statement.file_name.replace(/\.[^/.]+$/, ""));
    setStatementMonth(statement.statement_month);
    setStatementYear(statement.statement_year);
    setEditDialogOpen(true);
  };

  const handleUpdateStatement = async () => {
    if (!editingStatement || !statementName.trim()) return;

    setUpdating(true);
    try {
      const statementDate = `${statementYear}-${String(statementMonth).padStart(2, '0')}-01`;
      
      const { error } = await supabase
        .from('bank_statements')
        .update({
          display_name: statementName.trim(),
          statement_month: statementMonth,
          statement_year: statementYear,
          statement_date: statementDate,
        })
        .eq('id', editingStatement.id);

      if (error) throw error;

      // Update local state immediately
      setStatements(prev => prev.map(s => 
        s.id === editingStatement.id 
          ? { ...s, display_name: statementName.trim(), statement_month: statementMonth, statement_year: statementYear, statement_date: statementDate }
          : s
      ));

      toast({ title: "Success", description: "Bank statement updated successfully" });
      setEditDialogOpen(false);
      setEditingStatement(null);
      setStatementName("");
      setStatementMonth(new Date().getMonth() + 1);
      setStatementYear(new Date().getFullYear());
      
      // Reload to ensure consistency
      setTimeout(() => loadStatements(), 100);
    } catch (error) {
      console.error('Error updating statement:', error);
      toast({ title: "Error", description: "Failed to update bank statement", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading bank account...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bank account not found</p>
          <Button onClick={() => navigate('/banking/accounts')} className="mt-4">
            Back to Bank Accounts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/banking/accounts')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bank Accounts
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{account.account_name}</h1>
            <p className="text-muted-foreground">{account.bank_name}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => navigate(`/banking/reconcile?account=${account.id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Reconcile
            </Button>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Account Name</p>
                <p className="font-medium">{account.account_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{account.bank_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium">
                  {account.account_number ? `****${account.account_number.slice(-4)}` : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Routing Number</p>
                <p className="font-medium">{account.routing_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Type</p>
                <Badge variant="outline" className="capitalize">
                  {account.account_type.replace('-', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={account.is_active ? "default" : "secondary"}>
                  {account.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
            {account.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{account.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Balance (General Ledger)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(account.gl_balance ?? account.current_balance)}</div>
            <p className="text-sm text-muted-foreground mt-1">
              As of {new Date().toLocaleDateString()}
            </p>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={["statements", "reconcile"]} className="bg-card rounded-md border">
          <AccordionItem value="statements">
            <AccordionTrigger>
              <span className="text-base font-semibold">Bank Statements</span>
            </AccordionTrigger>
            <AccordionContent>
              {statements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No bank statements uploaded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statements.map((statement) => (
                      <TableRow 
                        key={statement.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setPreviewDocument({
                          fileName: statement.file_name,
                          url: statement.file_url,
                          type: statement.file_name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image'
                        })}
                      >
                        <TableCell>
                          {new Date(statement.statement_year, statement.statement_month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </TableCell>
                        <TableCell>{statement.display_name || statement.file_name}</TableCell>
                        <TableCell>{new Date(statement.uploaded_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reconcile">
            <AccordionTrigger>
              <span className="text-base font-semibold">Reconcile Reports</span>
            </AccordionTrigger>
            <AccordionContent>
              {reconcileReports.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No reconcile reports</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Statement Balance</TableHead>
                      <TableHead>Book Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reconciled</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconcileReports.map((report) => (
                      <TableRow 
                        key={report.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/banking/reconciliation/${report.id}?account=${id}`)}
                      >
                        <TableCell>{report.reconcile_month}/{report.reconcile_year}</TableCell>
                        <TableCell>{formatCurrency(report.statement_balance)}</TableCell>
                        <TableCell>{formatCurrency(report.book_balance)}</TableCell>
                        <TableCell>
                          <Badge variant={report.is_balanced ? "default" : "destructive"}>
                            {report.is_balanced ? "Balanced" : "Unbalanced"}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(report.reconciled_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bank Statement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-statement-name">Statement Name *</Label>
              <Input
                id="edit-statement-name"
                value={statementName}
                onChange={(e) => setStatementName(e.target.value)}
                placeholder="e.g., January 2025 Statement"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-statement-month">Month *</Label>
                <select
                  id="edit-statement-month"
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(parseInt(e.target.value))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {new Date(2000, month - 1).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-statement-year">Year *</Label>
                <Input
                  id="edit-statement-year"
                  type="number"
                  value={statementYear}
                  onChange={(e) => setStatementYear(parseInt(e.target.value))}
                  min="2000"
                  max="2100"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setEditDialogOpen(false);
                setEditingStatement(null);
                setStatementName("");
                setStatementMonth(new Date().getMonth() + 1);
                setStatementYear(new Date().getFullYear());
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStatement} disabled={updating || !statementName.trim()}>
                {updating ? "Updating..." : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
        document={previewDocument}
      />
    </div>
  );
}
