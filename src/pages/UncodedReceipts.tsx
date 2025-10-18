import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useReceipts } from "@/contexts/ReceiptContext";
import { Calendar, DollarSign, Building, Code, Receipt, User, Clock, FileImage, FileText, UserCheck, MessageSquare, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import UserAssignmentPanel from "@/components/UserAssignmentPanel";
import ReceiptMessagingPanel from "@/components/ReceiptMessagingPanel";
import FullPagePdfViewer from "@/components/FullPagePdfViewer";
import ViewSelector, { ViewType } from "@/components/ViewSelector";
import { useViewPreference } from "@/hooks/useViewPreference";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import ReceiptCostDistribution from "@/components/ReceiptCostDistribution";

interface JobOption { id: string; name: string }
interface CostCodeOption { id: string; code: string; description: string; type: string }
interface VendorOption { id: string; name: string }

interface CostDistribution {
  id: string;
  job_id: string;
  cost_code_id: string;
  amount: number;
  percentage: number;
  job_name?: string;
  cost_code_display?: string;
}

export default function UncodedReceipts() {
  const { uncodedReceipts, codeReceipt, assignReceipt, unassignReceipt, addMessage, messages, deleteReceipt } = useReceipts();
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [uncodedBills, setUncodedBills] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedAmount, setSelectedAmount] = useState("");
  const [costDistribution, setCostDistribution] = useState<CostDistribution[]>([]);
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  // View preference management
  const { 
    currentView, 
    defaultView, 
    isDefault, 
    setCurrentView, 
    setDefaultView 
  } = useViewPreference('uncoded-receipts-view', 'grid');

  useEffect(() => {
    if (selectedReceipt) {
      const numeric = String(selectedReceipt.amount || "0").replace(/[^0-9.\-]/g, "");
      setSelectedAmount(numeric);
    } else {
      setSelectedAmount("");
    }
  }, [selectedReceipt]);

  const [vendors, setVendors] = useState<VendorOption[]>([]);


  useEffect(() => {
    const loadVendors = async () => {
      if (!user || !currentCompany) return;
      try {
        // Check if current company has shared vendor database enabled
        const { data: companyData } = await supabase
          .from('companies')
          .select('enable_shared_vendor_database')
          .eq('id', currentCompany.id)
          .single();

        let query = supabase
          .from('vendors')
          .select('id, name')
          .eq('is_active', true);

        if (companyData?.enable_shared_vendor_database) {
          // If shared database is enabled, get vendors from companies that also have it enabled
          const { data: sharedCompanies } = await supabase
            .from('companies')
            .select('id')
            .eq('enable_shared_vendor_database', true);
          
          const companyIds = sharedCompanies?.map(c => c.id) || [currentCompany.id];
          query = query.in('company_id', companyIds);
        } else {
          // Only show vendors from current company
          query = query.eq('company_id', currentCompany.id);
        }

        const { data, error } = await query.order('name');
        if (error) throw error;
        setVendors((data || []) as VendorOption[]);
      } catch (err) {
        console.error('Error loading vendors:', err);
      }
    };

    const loadUncodedBills = async () => {
      if (!user || !currentCompany) return;
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select(`
            *,
            vendors (id, name),
            jobs (id, name),
            cost_codes (id, code, description)
          `)
          .eq('vendors.company_id', currentCompany.id)
          .or('job_id.is.null,cost_code_id.is.null')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setUncodedBills(data || []);
      } catch (err) {
        console.error('Error loading uncoded bills:', err);
      }
    };

    loadVendors();
    loadUncodedBills();
  }, [user, currentCompany]);

  const loadUncodedBills = async () => {
    if (!user || !currentCompany) return;
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors (id, name),
          jobs (id, name),
          cost_codes (id, code, description)
        `)
        .eq('vendors.company_id', currentCompany.id)
        .or('job_id.is.null,cost_code_id.is.null')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUncodedBills(data || []);
    } catch (err) {
      console.error('Error loading uncoded bills:', err);
    }
  };
  const handleCodeReceipt = async () => {
    if (!selectedReceipt) {
      toast({
        title: "No receipt selected",
        description: "Please select a receipt",
        variant: "destructive",
      });
      return;
    }

    // Validate cost distribution
    if (costDistribution.length === 0 || !costDistribution.every(d => d.job_id && d.cost_code_id)) {
      toast({
        title: "Missing information",
        description: "Please complete all cost distribution items",
        variant: "destructive",
      });
      return;
    }

    const totalAmount = parseFloat(selectedAmount) || 0;
    const distributedTotal = costDistribution.reduce((sum, d) => sum + d.amount, 0);
    
    if (Math.abs(totalAmount - distributedTotal) > 0.01) {
      toast({
        title: "Distribution mismatch",
        description: "Total distributed amount must equal receipt amount",
        variant: "destructive",
      });
      return;
    }

    if (selectedReceipt.type === 'bill') {
      // Handle bill coding - use first distribution item for now
      try {
        const firstDist = costDistribution[0];
        
        const { error } = await supabase
          .from('invoices')
          .update({
            job_id: firstDist.job_id,
            cost_code_id: firstDist.cost_code_id
          })
          .eq('id', selectedReceipt.billData.id);

        if (error) throw error;

        await loadUncodedBills();
        setSelectedReceipt(null);
        
        toast({
          title: "Bill coded successfully",
          description: "Bill has been assigned",
        });
      } catch (error) {
        console.error('Error coding bill:', error);
        toast({
          title: "Error",
          description: "Failed to code bill",
          variant: "destructive",
        });
      }
    } else {
      // Handle receipt coding with cost distribution
      try {
        // Update receipt basic info
        const { error: updateError } = await supabase
          .from('receipts')
          .update({
            amount: totalAmount,
            vendor_name: selectedVendor || null,
            status: 'coded'
          })
          .eq('id', selectedReceipt.id);

        if (updateError) throw updateError;

        // Insert cost distributions
        const { error: distError } = await supabase
          .from('receipt_cost_distributions')
          .insert(
            costDistribution.map(dist => ({
              receipt_id: selectedReceipt.id,
              job_id: dist.job_id,
              cost_code_id: dist.cost_code_id,
              amount: dist.amount,
              percentage: dist.percentage,
              created_by: user!.id
            }))
          );

        if (distError) throw distError;

        // Close the receipt view and reset
        setSelectedReceipt(null);
        setCostDistribution([]);
        setSelectedVendor("");
        setSelectedAmount("");
        
        toast({
          title: "Receipt coded successfully",
          description: "Receipt has been assigned to jobs and cost codes",
        });
      } catch (error) {
        console.error('Error coding receipt:', error);
        toast({
          title: "Error",
          description: "Failed to code receipt",
          variant: "destructive",
        });
      }
    }
  };

  const handleAssignUser = (userId: string, userName: string, userRole: string) => {
    if (selectedReceipt) {
      assignReceipt(selectedReceipt.id, userId, userName, userRole);
      toast({
        title: "Receipt Assigned",
        description: `Receipt assigned to ${userName} for review.`,
      });
    }
  };

  const handleUnassignUser = () => {
    if (selectedReceipt) {
      unassignReceipt(selectedReceipt.id);
      toast({
        title: "Receipt Unassigned",
        description: "Receipt has been unassigned.",
      });
    }
  };

  const handleSendMessage = (message: string) => {
    if (selectedReceipt) {
      addMessage(selectedReceipt.id, message, "current-user", "Current User");
      toast({
        title: "Message Sent",
        description: "Your message has been added to the discussion.",
      });
    }
  };

  const handleDeleteReceipt = (receiptId: string) => {
    deleteReceipt(receiptId);
    toast({
      title: "Receipt Deleted",
      description: "The receipt has been permanently deleted.",
      variant: "destructive",
    });
  };

  const handleSetDefaultView = () => {
    setDefaultView();
    toast({
      title: 'Default View Set',
      description: `${currentView.charAt(0).toUpperCase() + currentView.slice(1)} view is now your default.`,
    });
  };

  return (
    <div className="h-full">
      {!selectedReceipt ? (
        /* Receipt List View */
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold text-foreground">Uncoded Receipts</h1>
              <ViewSelector
                currentView={currentView}
                onViewChange={setCurrentView}
                onSetDefault={handleSetDefaultView}
                isDefault={isDefault}
              />
            </div>
            <p className="text-muted-foreground">
              Select a receipt or bill to code it to a job and cost code
            </p>
          </div>

          {uncodedReceipts.length === 0 && uncodedBills.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">All receipts and bills have been coded!</h3>
              <p className="text-muted-foreground">Upload new receipts or create bills to get started.</p>
            </div>
          ) : (
            <div className={
              currentView === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : currentView === 'list'
                ? "space-y-4"
                : "space-y-2"
            }>
              {[...uncodedReceipts, ...uncodedBills.map(bill => ({
                id: bill.id,
                filename: bill.invoice_number || `Bill ${bill.id.slice(0, 8)}`,
                amount: `$${bill.amount?.toFixed(2) || '0.00'}`,
                date: bill.issue_date || bill.created_at?.split('T')[0] || 'Unknown',
                vendor: bill.vendors?.name || 'Unknown Vendor',
                type: 'bill',
                billData: bill,
                assignedUser: null,
                previewUrl: null
              }))].map((receipt) => (
                currentView === 'grid' ? (
                  // Tile View
                  <Card
                    key={receipt.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:scale-[1.02]"
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {receipt.type === 'bill' ? (
                          <FileText className="h-5 w-5 text-green-500" />
                        ) : receipt.type === 'pdf' ? (
                          <FileText className="h-5 w-5 text-red-500" />
                        ) : (
                          <FileImage className="h-5 w-5 text-blue-500" />
                        )}
                        <span className="font-medium text-sm truncate max-w-[150px]" title={receipt.filename}>
                          {receipt.filename}
                        </span>
                        {receipt.type === 'bill' && (
                          <Badge variant="outline" className="text-xs">Bill</Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {receipt.assignedUser && (
                          <Badge variant="secondary" className="text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assigned
                          </Badge>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{receipt.filename}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteReceipt(receipt.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center text-muted-foreground">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {receipt.amount}
                        </div>
                        <div className="flex items-center text-muted-foreground">
                          <Calendar className="h-3 w-3 mr-1" />
                          {receipt.date}
                        </div>
                      </div>
                      
                      {receipt.vendor && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Building className="h-3 w-3 mr-1" />
                          <span className="truncate">{receipt.vendor}</span>
                        </div>
                      )}
                      
                      {receipt.assignedUser && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <User className="h-3 w-3 mr-1" />
                          <span className="truncate">Assigned to {receipt.assignedUser.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Preview thumbnail */}
                    <div className="mt-3 bg-accent rounded-lg overflow-hidden">
                      {receipt.type === 'pdf' ? (
                        <div className="h-32 flex items-center justify-center">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                        </div>
                      ) : receipt.previewUrl ? (
                        <img
                          src={receipt.previewUrl}
                          alt={`Receipt ${receipt.filename}`}
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="h-32 flex items-center justify-center">
                          <FileImage className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                ) : currentView === 'list' ? (
                  // List View
                  <Card
                    key={receipt.id}
                    className="cursor-pointer transition-all hover:shadow-md"
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          {receipt.type === 'pdf' ? (
                            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
                              <FileText className="h-8 w-8 text-red-500" />
                            </div>
                          ) : receipt.previewUrl ? (
                            <img
                              src={receipt.previewUrl}
                              alt={`Receipt ${receipt.filename}`}
                              className="w-16 h-16 object-cover rounded-lg"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                              <FileImage className="h-8 w-8 text-blue-500" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-medium text-foreground truncate">{receipt.filename}</h3>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                <div className="flex items-center">
                                  <DollarSign className="h-4 w-4 mr-1" />
                                  {receipt.amount}
                                </div>
                                <div className="flex items-center">
                                  <Calendar className="h-4 w-4 mr-1" />
                                  {receipt.date}
                                </div>
                                {receipt.vendor && (
                                  <div className="flex items-center">
                                    <Building className="h-4 w-4 mr-1" />
                                    {receipt.vendor}
                                  </div>
                                )}
                              </div>
                              {receipt.assignedUser && (
                                <div className="flex items-center mt-2 text-xs text-muted-foreground">
                                  <User className="h-3 w-3 mr-1" />
                                  Assigned to {receipt.assignedUser.name}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 ml-4">
                              {receipt.assignedUser && (
                                <Badge variant="secondary" className="text-xs">
                                  <UserCheck className="h-3 w-3 mr-1" />
                                  Assigned
                                </Badge>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{receipt.filename}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteReceipt(receipt.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  // Compact View
                  <div
                    key={receipt.id}
                    className="flex items-center p-3 border rounded-lg cursor-pointer transition-all hover:bg-accent"
                    onClick={() => setSelectedReceipt(receipt)}
                  >
                    <div className="flex-shrink-0 mr-3">
                      {receipt.type === 'pdf' ? (
                        <FileText className="h-5 w-5 text-red-500" />
                      ) : (
                        <FileImage className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate mr-2">{receipt.filename}</span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{receipt.amount}</span>
                          <span>•</span>
                          <span>{receipt.date}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {receipt.assignedUser && (
                        <Badge variant="secondary" className="text-xs">Assigned</Badge>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Receipt</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{receipt.filename}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDeleteReceipt(receipt.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Split Screen View - 75% Preview, 25% Controls */
        <div className="flex h-full">
          {/* Preview Area - 75% */}
          <div className="flex-1 bg-background" style={{ width: '75%' }}>
            <div className="h-full flex flex-col">
              {/* Preview Header */}
              <div className="p-4 border-b border-border bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReceipt(null)}
                      className="mb-2"
                    >
                      ← Back to List
                    </Button>
                    <h1 className="text-xl font-bold">Receipt Preview</h1>
                    <p className="text-sm text-muted-foreground">
                      {selectedReceipt.filename} • {selectedReceipt.amount}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedReceipt.previewUrl && (
                      <>
                        <Button 
                          variant="secondary" 
                          size="sm"
                          onClick={() => window.open(selectedReceipt.previewUrl, '_blank')}
                        >
                          View
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(selectedReceipt.previewUrl);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = selectedReceipt.filename;
                              document.body.appendChild(a);
                              a.click();
                              window.URL.revokeObjectURL(url);
                              document.body.removeChild(a);
                            } catch (error) {
                              console.error('Download failed:', error);
                              toast({
                                title: "Download Failed",
                                description: "Unable to download the receipt",
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          Download
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    {selectedReceipt.date}
                  </div>
                  {selectedReceipt.vendor && (
                    <div className="flex items-center">
                      <Building className="h-4 w-4 mr-2" />
                      {selectedReceipt.vendor}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto bg-accent/20">
                {selectedReceipt.type === 'pdf' ? (
                  selectedReceipt.previewUrl ? (
                    <FullPagePdfViewer 
                      file={{ 
                        name: selectedReceipt.filename,
                        url: selectedReceipt.previewUrl 
                      } as any}
                      onBack={() => {}}
                      hideBackButton={true}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">PDF Receipt</p>
                        <p className="text-sm text-muted-foreground">{selectedReceipt.filename}</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="bg-white rounded-lg shadow-lg overflow-auto h-full flex items-center justify-center p-6 m-6">
                    {selectedReceipt.previewUrl ? (
                      <img
                        src={selectedReceipt.previewUrl}
                        alt={`Receipt ${selectedReceipt.filename}`}
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Crect width='200' height='200' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%236b7280'%3EImage not available%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    ) : (
                      <div className="text-center">
                        <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium">Image Receipt</p>
                        <p className="text-sm text-muted-foreground">Preview not available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls Sidebar - 25% */}
          <div className="border-l border-border bg-card" style={{ width: '25%' }}>
            <div className="h-full flex flex-col">
              {/* User Assignment Section */}
              <div className="p-4 border-b border-border">
                <UserAssignmentPanel
                  receiptId={selectedReceipt.id}
                  assignedUser={selectedReceipt.assignedUser}
                  onAssignUser={handleAssignUser}
                  onUnassignUser={handleUnassignUser}
                />
              </div>

              {/* Coding Section */}
              <div className="p-4 border-b border-border overflow-y-auto">
                <h3 className="font-medium mb-3 flex items-center">
                  <Code className="h-4 w-4 mr-2" />
                  Code Receipt
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="vendor-select" className="text-xs">Vendor (Optional)</Label>
                    <Select value={selectedVendor} onValueChange={setSelectedVendor}>
                      <SelectTrigger id="vendor-select" className="h-8">
                        <SelectValue placeholder="Select vendor (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border border-border shadow-md z-50">
                        {vendors.map((vendor) => (
                          <SelectItem key={vendor.id} value={vendor.id} className="cursor-pointer">
                            {vendor.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="amount-input" className="text-xs">Receipt Amount ($)</Label>
                    <Input
                      id="amount-input"
                      type="number"
                      step="0.01"
                      value={selectedAmount}
                      onChange={(e) => setSelectedAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="h-8"
                    />
                  </div>

                  <div className="mt-4">
                    <ReceiptCostDistribution
                      totalAmount={parseFloat(selectedAmount) || 0}
                      companyId={currentCompany?.id || ''}
                      initialDistribution={costDistribution}
                      onChange={setCostDistribution}
                      disabled={!selectedAmount || parseFloat(selectedAmount) <= 0}
                    />
                  </div>

                  <Button 
                    onClick={() => {
                      handleCodeReceipt();
                    }} 
                    className="w-full h-8 mt-4"
                    disabled={!selectedAmount || costDistribution.length === 0 || !costDistribution.every(d => d.job_id && d.cost_code_id)}
                  >
                    Code Receipt
                  </Button>
                </div>
              </div>

              {/* Messaging Section */}
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium flex items-center">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Discussion
                  </h3>
                  {messages.filter(m => m.receiptId === selectedReceipt.id).length > 0 && (
                    <Badge variant="secondary">
                      {messages.filter(m => m.receiptId === selectedReceipt.id).length}
                    </Badge>
                  )}
                </div>
                <ReceiptMessagingPanel
                  receiptId={selectedReceipt.id}
                  messages={messages.filter(m => m.receiptId === selectedReceipt.id)}
                  onSendMessage={handleSendMessage}
                  currentUserId="current-user"
                  currentUserName="Current User"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}