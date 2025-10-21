import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  ArrowLeft,
  Save,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function JournalEntryEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [isPosted, setIsPosted] = useState(false);
  const [lines, setLines] = useState<any[]>([]);

  useEffect(() => {
    const loadEntry = async () => {
      if (!currentCompany?.id || !id) return;
      
      setLoading(true);
      try {
        const { data: entryData, error: entryError } = await supabase
          .from('journal_entries')
          .select('*')
          .eq('id', id)
          .eq('company_id', currentCompany.id)
          .single();

        if (entryError) throw entryError;
        
        setEntry(entryData);
        setDescription(entryData.description || '');
        setReference(entryData.reference || '');
        setIsPosted(entryData.status === 'posted');

        // Load journal entry lines
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
        navigate('/banking/journal-entries');
      } finally {
        setLoading(false);
      }
    };

    loadEntry();
  }, [id, currentCompany?.id]);

  const handleLineDescriptionChange = (lineId: string, newDescription: string) => {
    setLines(prev => prev.map(line => 
      line.id === lineId ? { ...line, description: newDescription } : line
    ));
  };

  const handleSave = async () => {
    if (!id || !currentCompany?.id) return;

    try {
      // Update journal entry
      const { error: entryError } = await supabase
        .from('journal_entries')
        .update({
          description: description,
          reference: reference,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('company_id', currentCompany.id);

      if (entryError) throw entryError;

      // Update line descriptions
      for (const line of lines) {
        const { error: lineError } = await supabase
          .from('journal_entry_lines')
          .update({ description: line.description })
          .eq('id', line.id);
        
        if (lineError) throw lineError;
      }

      toast({
        title: "Success",
        description: "Journal entry updated successfully",
      });
      
      navigate(`/banking/journal-entries/${id}`);
    } catch (error) {
      console.error('Error updating journal entry:', error);
      toast({
        title: "Error",
        description: "Failed to update journal entry",
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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/banking/journal-entries/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Journal Entry</h1>
            <p className="text-muted-foreground">
              {entry.reference || 'No reference'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {isPosted && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This journal entry is posted. Only the description can be edited. All other fields are locked.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Journal Entry Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date" 
                  value={entry.entry_date}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input 
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Entry reference..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="pt-2">
                  <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'}>
                    {entry.status}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Journal entry description..." 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Debit</div>
                <div className="text-lg font-semibold">${entry.total_debit?.toFixed(2) || '0.00'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Total Credit</div>
                <div className="text-lg font-semibold">${entry.total_credit?.toFixed(2) || '0.00'}</div>
              </div>
            </div>

            {entry.reversal_date && (
              <Alert className="mt-4">
                <AlertDescription>
                  This entry was reversed on {entry.reversal_date}
                  {entry.reversed_by_entry_id && (
                    <Button 
                      variant="link" 
                      className="ml-2 p-0 h-auto"
                      onClick={() => navigate(`/banking/journal-entries/${entry.reversed_by_entry_id}`)}
                    >
                      View reversing entry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal Entry Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
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
                      <div className="font-medium">{line.account?.account_number}</div>
                      <div className="text-sm text-muted-foreground">{line.account?.account_name}</div>
                    </TableCell>
                    <TableCell>
                      {line.job?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {line.cost_code ? (
                        <div>
                          <div className="font-medium">{line.cost_code.code}</div>
                          <div className="text-sm text-muted-foreground">{line.cost_code.description}</div>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={line.description || ''}
                        onChange={(e) => handleLineDescriptionChange(line.id, e.target.value)}
                        placeholder="Line description..."
                        className="min-w-[200px]"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      ${line.debit_amount?.toFixed(2) || '0.00'}
                    </TableCell>
                    <TableCell className="text-right">
                      ${line.credit_amount?.toFixed(2) || '0.00'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
