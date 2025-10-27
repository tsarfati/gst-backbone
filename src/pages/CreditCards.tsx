import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter,
  DollarSign,
  Calendar,
  AlertTriangle,
  Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";

export default function CreditCards() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string>("");
  const [uploadingCsv, setUploadingCsv] = useState(false);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchCreditCards();
    }
  }, [currentCompany?.id]);

  const fetchCreditCards = async () => {
    try {
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCreditCards(data || []);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
      toast({
        title: "Error loading credit cards",
        description: "There was an issue loading your credit cards",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCard) return;

    setUploadingCsv(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const transactions = results.data.map((row: any) => ({
            credit_card_id: selectedCard,
            company_id: currentCompany?.id,
            transaction_date: row.date || row.transaction_date || row['Transaction Date'],
            post_date: row.post_date || row['Post Date'],
            description: row.description || row.merchant || row['Description'],
            amount: parseFloat(row.amount || row['Amount']?.replace('$', '').replace(',', '') || 0),
            transaction_type: (row.type || row['Type'] || 'debit').toLowerCase(),
            merchant_name: row.merchant || row.merchant_name || row['Merchant Name'],
            category: row.category || row['Category'],
            reference_number: row.reference || row.reference_number || row['Reference Number'],
            imported_from_csv: true,
            created_by: userId
          }));

          const { error } = await supabase
            .from('credit_card_transactions')
            .insert(transactions);

          if (error) throw error;

          // Get current import count
          const { data: cardData } = await supabase
            .from('credit_cards')
            .select('csv_import_count')
            .eq('id', selectedCard)
            .single();

          // Update credit card import stats
          await supabase
            .from('credit_cards')
            .update({
              last_csv_import_date: new Date().toISOString(),
              last_csv_import_by: userId,
              csv_import_count: (cardData?.csv_import_count || 0) + 1
            })
            .eq('id', selectedCard);

          toast({
            title: "Import successful",
            description: `Imported ${transactions.length} transactions from CSV`
          });
          
          // Reset the form
          setSelectedCard("");
          event.target.value = ""; // Clear the file input
          setUploadDialogOpen(false);
        } catch (error) {
          console.error('Error importing transactions:', error);
          toast({
            title: "Import failed",
            description: "There was an error importing the transactions",
            variant: "destructive"
          });
        } finally {
          setUploadingCsv(false);
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        toast({
          title: "CSV parsing error",
          description: "Unable to parse the CSV file",
          variant: "destructive"
        });
        setUploadingCsv(false);
      }
    });
  };

  const filteredCards = creditCards.filter(card => {
    const matchesSearch = card?.card_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         card?.card_number_last_four?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || 
                         (statusFilter === "active" && card?.is_active) ||
                         (statusFilter === "inactive" && !card?.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const totalCreditLimit = creditCards.reduce((sum, card) => sum + (Number(card.credit_limit) || 0), 0);
  const totalBalance = creditCards.reduce((sum, card) => sum + (Number(card.current_balance) || 0), 0);
  const activeCards = creditCards.filter(card => card.is_active).length;

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credit Cards</h1>
          <p className="text-muted-foreground">
            Manage company credit cards and track expenses
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Credit Card Statement</DialogTitle>
                <DialogDescription>
                  Upload a CSV file containing credit card transactions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="card-select">Select Credit Card</Label>
                  <Select value={selectedCard} onValueChange={setSelectedCard}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a credit card" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {creditCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.card_name} (****{card.card_number_last_four})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="csv-upload">CSV File</Label>
                  <Input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={!selectedCard || uploadingCsv}
                  />
                  <p className="text-xs text-muted-foreground">
                    CSV should include columns: date, description, amount, type (debit/credit)
                  </p>
                  {uploadingCsv && (
                    <p className="text-xs text-muted-foreground">Importing transactions...</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button asChild>
            <Link to="/payables/credit-cards/add">
              <Plus className="h-4 w-4 mr-2" />
              Add Credit Card
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cards</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCards}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Limit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalCreditLimit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Available credit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credit</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(totalCreditLimit - totalBalance).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Remaining balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search credit cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Card Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCards.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No credit cards found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Add your first credit card to get started"
                }
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button asChild>
                  <Link to="/payables/credit-cards/add">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Credit Card
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card Name</TableHead>
                  <TableHead>Last Four</TableHead>
                  <TableHead>Issuer</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Current Balance</TableHead>
                  <TableHead>Available Credit</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((card) => {
                  const availableCredit = Number(card.credit_limit || 0) - Number(card.current_balance || 0);
                  return (
                    <TableRow 
                      key={card.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/payables/credit-cards/${card.id}`)}
                    >
                      <TableCell className="font-medium">{card.card_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <CreditCard className="h-3 w-3 mr-1 text-muted-foreground" />
                          ****{card.card_number_last_four}
                        </div>
                      </TableCell>
                      <TableCell>{card.issuer}</TableCell>
                      <TableCell>${Number(card.credit_limit || 0).toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">
                        <span className={card.current_balance > 0 ? "text-red-600" : "text-green-600"}>
                          ${Number(card.current_balance || 0).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-green-600">
                          ${availableCredit.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
                          {card.due_date ? new Date(card.due_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={card.is_active ? "default" : "secondary"}>
                          {card.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
