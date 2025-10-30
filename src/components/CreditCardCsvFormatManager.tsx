import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Download, Plus, FileSpreadsheet, Trash2, Edit, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface CsvFormat {
  id: string;
  format_name: string;
  columns: string[];
  delimiter: string;
  has_header: boolean;
  date_format: string;
  amount_format: string;
  is_default?: boolean;
}

interface CreditCardCsvFormatManagerProps {
  creditCardId: string;
  selectedFormatId?: string;
  onFormatChange?: (formatId: string) => void;
}

const defaultFormats: CsvFormat[] = [
  {
    id: 'amex',
    format_name: 'American Express',
    columns: ['Date', 'Description', 'Card Member', 'Account #', 'Amount', 'Vendor'],
    delimiter: ',',
    has_header: true,
    date_format: 'M/D/YY',
    amount_format: '$#,###.##',
    is_default: true
  },
  {
    id: 'visa_chase',
    format_name: 'Visa/Chase',
    columns: ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount'],
    delimiter: ',',
    has_header: true,
    date_format: 'MM/DD/YYYY',
    amount_format: '#,###.##'
  },
  {
    id: 'mastercard',
    format_name: 'Mastercard',
    columns: ['Date', 'Description', 'Amount', 'Category'],
    delimiter: ',',
    has_header: true,
    date_format: 'YYYY-MM-DD',
    amount_format: '#.##'
  }
];

export default function CreditCardCsvFormatManager({ 
  creditCardId, 
  selectedFormatId, 
  onFormatChange 
}: CreditCardCsvFormatManagerProps) {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const [formats, setFormats] = useState<CsvFormat[]>(defaultFormats);
  const [customFormats, setCustomFormats] = useState<CsvFormat[]>([]);
  const [selectedFormat, setSelectedFormat] = useState<string>(selectedFormatId || 'amex');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFormat, setEditingFormat] = useState<CsvFormat | null>(null);
  
  const [newFormat, setNewFormat] = useState({
    format_name: '',
    columns: '',
    delimiter: ',',
    has_header: true,
    date_format: 'MM/DD/YYYY',
    amount_format: '#,###.##'
  });

  useEffect(() => {
    fetchCustomFormats();
    fetchCreditCardFormat();
  }, [creditCardId, currentCompany]);

  const fetchCustomFormats = async () => {
    if (!currentCompany) return;

    const { data, error } = await supabase
      .from('credit_card_csv_formats')
      .select('*')
      .eq('company_id', currentCompany.id)
      .order('format_name');

    if (data) {
      setCustomFormats(data.map(f => ({
        id: f.id,
        format_name: f.format_name,
        columns: Array.isArray(f.columns) ? f.columns as string[] : (typeof f.columns === 'string' ? JSON.parse(f.columns as string) : []),
        delimiter: f.delimiter,
        has_header: f.has_header,
        date_format: f.date_format,
        amount_format: f.amount_format
      })));
    }
  };

  const fetchCreditCardFormat = async () => {
    const { data } = await supabase
      .from('credit_cards')
      .select('csv_format_id')
      .eq('id', creditCardId)
      .single();

    if (data?.csv_format_id) {
      setSelectedFormat(data.csv_format_id);
      onFormatChange?.(data.csv_format_id);
    }
  };

  const handleFormatChange = async (formatId: string) => {
    setSelectedFormat(formatId);
    
    // Update credit card with selected format
    const { error } = await supabase
      .from('credit_cards')
      .update({ csv_format_id: formatId })
      .eq('id', creditCardId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update CSV format',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'CSV format updated successfully'
      });
      onFormatChange?.(formatId);
    }
  };

  const handleDownloadSample = (format: CsvFormat) => {
    // Create sample CSV content
    const headers = format.columns.join(format.delimiter);
    const sampleRows = [
      format.columns.map((col, idx) => {
        if (col.toLowerCase().includes('date')) return '01/15/2025';
        if (col.toLowerCase().includes('amount')) return '$123.45';
        if (col.toLowerCase().includes('description')) return 'Sample Transaction';
        return `Sample ${idx + 1}`;
      }).join(format.delimiter),
      format.columns.map((col, idx) => {
        if (col.toLowerCase().includes('date')) return '01/16/2025';
        if (col.toLowerCase().includes('amount')) return '$67.89';
        if (col.toLowerCase().includes('description')) return 'Another Transaction';
        return `Sample ${idx + 1}`;
      }).join(format.delimiter)
    ];

    const csvContent = format.has_header 
      ? [headers, ...sampleRows].join('\n')
      : sampleRows.join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${format.format_name.replace(/\s+/g, '_')}_sample.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: `Sample CSV for ${format.format_name} downloaded`
    });
  };

  const handleAddFormat = async () => {
    if (!currentCompany || !newFormat.format_name || !newFormat.columns) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    const columns = newFormat.columns.split(',').map(c => c.trim());

    const { data, error } = await supabase
      .from('credit_card_csv_formats')
      .insert({
        company_id: currentCompany.id,
        format_name: newFormat.format_name,
        columns: columns,
        delimiter: newFormat.delimiter,
        has_header: newFormat.has_header,
        date_format: newFormat.date_format,
        amount_format: newFormat.amount_format
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add CSV format',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'CSV format added successfully'
      });
      fetchCustomFormats();
      setIsAddDialogOpen(false);
      setNewFormat({
        format_name: '',
        columns: '',
        delimiter: ',',
        has_header: true,
        date_format: 'MM/DD/YYYY',
        amount_format: '#,###.##'
      });
    }
  };

  const handleDeleteFormat = async (formatId: string) => {
    const { error } = await supabase
      .from('credit_card_csv_formats')
      .delete()
      .eq('id', formatId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete CSV format',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'CSV format deleted successfully'
      });
      fetchCustomFormats();
    }
  };

  const allFormats = [...formats, ...customFormats];
  const currentFormat = allFormats.find(f => f.id === selectedFormat);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          CSV Import Format
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select CSV Format Type</Label>
          <div className="flex gap-2">
            <Select value={selectedFormat} onValueChange={handleFormatChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Standard Formats
                </div>
                {formats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    <div className="flex items-center gap-2">
                      {format.format_name}
                      {format.is_default && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
                {customFormats.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                      Custom Formats
                    </div>
                    {customFormats.map((format) => (
                      <SelectItem key={format.id} value={format.id}>
                        {format.format_name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
            
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add Custom CSV Format</DialogTitle>
                  <DialogDescription>
                    Define a custom CSV format for importing transactions
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="format_name">Format Name *</Label>
                    <Input
                      id="format_name"
                      placeholder="e.g., My Bank Format"
                      value={newFormat.format_name}
                      onChange={(e) => setNewFormat({ ...newFormat, format_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="columns">Column Names (comma-separated) *</Label>
                    <Input
                      id="columns"
                      placeholder="e.g., Date, Description, Amount, Vendor"
                      value={newFormat.columns}
                      onChange={(e) => setNewFormat({ ...newFormat, columns: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter column names exactly as they appear in your CSV header
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delimiter">Delimiter</Label>
                      <Select 
                        value={newFormat.delimiter} 
                        onValueChange={(value) => setNewFormat({ ...newFormat, delimiter: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value=",">Comma (,)</SelectItem>
                          <SelectItem value=";">Semicolon (;)</SelectItem>
                          <SelectItem value="\t">Tab</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_format">Date Format</Label>
                      <Input
                        id="date_format"
                        placeholder="MM/DD/YYYY"
                        value={newFormat.date_format}
                        onChange={(e) => setNewFormat({ ...newFormat, date_format: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount_format">Amount Format</Label>
                    <Input
                      id="amount_format"
                      placeholder="$#,###.##"
                      value={newFormat.amount_format}
                      onChange={(e) => setNewFormat({ ...newFormat, amount_format: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFormat}>
                    <Check className="h-4 w-4 mr-2" />
                    Add Format
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {currentFormat && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Current Format: {currentFormat.format_name}</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadSample(currentFormat)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Sample
                </Button>
                {!currentFormat.is_default && customFormats.find(f => f.id === currentFormat.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFormat(currentFormat.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Columns:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {currentFormat.columns.map((col, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Delimiter:</span>
                <Badge variant="outline" className="ml-2">
                  {currentFormat.delimiter === ',' ? 'Comma' : 
                   currentFormat.delimiter === ';' ? 'Semicolon' : 'Tab'}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Date Format:</span>
                <Badge variant="outline" className="ml-2">{currentFormat.date_format}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Amount Format:</span>
                <Badge variant="outline" className="ml-2">{currentFormat.amount_format}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>The CSV format determines how transaction files will be imported for this credit card.</p>
          <p className="mt-1">Download a sample to see the expected format before importing your statements.</p>
        </div>
      </CardContent>
    </Card>
  );
}
