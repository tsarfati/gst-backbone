import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft, 
  Edit, 
  Trash2,
  Calendar,
  User,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function JournalEntryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [entry, setEntry] = useState<any>(null);
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const loadEntry = async () => {
      if (!currentCompany?.id || !id) return;
      
      setLoading(true);
      try {
        // Load journal entry
        const { data: entryData, error: entryError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', id)
          .eq('company_id', currentCompany.id)
          .single();

        if (entryError) throw entryError;

        // Load creator profile
        let createdByProfile = null;
        if (entryData.created_by) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', entryData.created_by)
            .single();
          createdByProfile = profileData;
        }

        setEntry({
          ...entryData,
          created_by_profile: createdByProfile
        });

        // Load journal entry lines with account, job, and cost code info
        const { data: linesData, error: linesError } = await supabase
          .from('journal_entry_lines')
          .select(`
            *,
            account:chart_of_accounts(account_number, account_name),
            job:jobs(name),
            cost_code:cost_codes(code, description)
          `)
          .eq('journal_entry_id', id)
          .order('line_order');

        if (linesError) throw linesError;
        setLines(linesData || []);
      } catch (error) {
        console.error('Error loading journal entry:', error);
        toast({
          title: "Error",
          description: "Failed to load journal entry",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [id, currentCompany?.id]);

  const handleDelete = async () => {
    if (!id) return;

    try {
      // Delete lines first
      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .delete()
        .eq('journal_entry_id', id);

      if (linesError) throw linesError;

      // Delete entry
      const { error: entryError } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (entryError) throw entryError;

      toast({
        title: "Success",
        description: "Journal entry deleted successfully",
      });

      navigate('/banking/journal-entries');
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to delete journal entry",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Journal entry not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/banking/journal-entries')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Journal Entry Details</h1>
            <p className="text-muted-foreground">
              {entry.reference || 'No reference'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/banking/journal-entries/${id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Entry Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Entry Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Date</div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">{entry.entry_date}</span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                {entry.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Reference</div>
              <span className="font-medium">{entry.reference || '-'}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Description</div>
              <span className="font-medium">{entry.description || '-'}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Debit</div>
              <span className="font-medium">${entry.total_debit?.toFixed(2) || '0.00'}</span>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Total Credit</div>
              <span className="font-medium">${entry.total_credit?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Created By</div>
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {entry.created_by_profile?.full_name || 'Unknown'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Created Date</div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {entry.created_at ? format(new Date(entry.created_at), 'MMM d, yyyy h:mm a') : '-'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Last Updated</div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {format(new Date(entry.updated_at), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lines */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Cost Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.account ? `${line.account.account_number} - ${line.account.account_name}` : '-'}
                  </TableCell>
                  <TableCell>{line.job?.name || '-'}</TableCell>
                  <TableCell>
                    {line.cost_code ? `${line.cost_code.code} - ${line.cost_code.description}` : '-'}
                  </TableCell>
                  <TableCell>{line.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    {line.debit_amount > 0 ? `$${line.debit_amount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {line.credit_amount > 0 ? `$${line.credit_amount.toFixed(2)}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold bg-muted/50">
                <TableCell colSpan={4} className="text-right">Totals:</TableCell>
                <TableCell className="text-right">${entry.total_debit?.toFixed(2) || '0.00'}</TableCell>
                <TableCell className="text-right">${entry.total_credit?.toFixed(2) || '0.00'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Journal Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the journal entry
              and all associated lines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
