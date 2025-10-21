import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar,
  DollarSign,
  Settings2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showSystemEntries, setShowSystemEntries] = useState(false);
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  useEffect(() => {
    const loadEntries = async () => {
      if (!currentCompany?.id) { setJournalEntries([]); return; }
      let query = supabase
        .from('journal_entries')
        .select('id, entry_date, reference, description, total_debit, total_credit, status')
        .eq('company_id', currentCompany.id);
      
      // Filter out system entries if toggle is off
      if (!showSystemEntries) {
        query = query.not('reference', 'like', 'PAY-%');
      }
      
      const { data, error } = await query
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error loading journal entries:', error);
        toast({ title: 'Error', description: 'Failed to load journal entries', variant: 'destructive' });
        return;
      }
      
      // Check reconciliation status for each entry
      const entriesWithReconciliation = await Promise.all((data || []).map(async (entry) => {
        const { data: lines } = await supabase
          .from('journal_entry_lines')
          .select('is_reconciled')
          .eq('journal_entry_id', entry.id);
        
        const allReconciled = lines && lines.length > 0 && lines.every(line => line.is_reconciled);
        const someReconciled = lines && lines.some(line => line.is_reconciled);
        
        return {
          ...entry,
          reconciliation_status: allReconciled ? 'reconciled' : someReconciled ? 'partially_reconciled' : 'unreconciled'
        };
      }));
      
      setJournalEntries(entriesWithReconciliation);
    };
    loadEntries();
  }, [currentCompany?.id, showSystemEntries]);

  const filteredEntries = journalEntries.filter((entry) => {
    const q = searchTerm.toLowerCase();
    return (entry?.description || '').toLowerCase().includes(q) || (entry?.reference || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Journal Entries</h1>
          <p className="text-muted-foreground">
            Create and manage accounting journal entries
          </p>
        </div>
        <Button asChild>
          <Link to="/banking/journal-entries/new">
            <Plus className="h-4 w-4 mr-2" />
            New Journal Entry
          </Link>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search journal entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="show-system" className="text-sm whitespace-nowrap">Show System</Label>
              <Switch
                id="show-system"
                checked={showSystemEntries}
                onCheckedChange={setShowSystemEntries}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No journal entries found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Try adjusting your search"
                  : "Start by creating your first journal entry"
                }
              </p>
              <Button asChild>
                <Link to="/banking/journal-entries/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Journal Entry
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit</TableHead>
                  <TableHead>Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reconciliation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow 
                    key={entry.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/banking/journal-entries/${entry.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                         {entry.entry_date}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{entry.reference}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                         {entry.total_debit ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <DollarSign className="h-3 w-3 mr-1 text-muted-foreground" />
                         {entry.total_credit ?? "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${
                        entry.status === "posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {entry.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded ${
                        entry.reconciliation_status === "reconciled" 
                          ? "bg-blue-100 text-blue-800" 
                          : entry.reconciliation_status === "partially_reconciled"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {entry.reconciliation_status === "reconciled" 
                          ? "Reconciled" 
                          : entry.reconciliation_status === "partially_reconciled"
                          ? "Partially Reconciled"
                          : "Unreconciled"}
                      </span>
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