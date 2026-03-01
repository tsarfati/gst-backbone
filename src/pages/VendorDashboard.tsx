import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  DollarSign, 
  MessageSquare,
  Upload,
  Calendar,
  FileWarning,
  Loader2,
  Building2,
  Bell
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format, differenceInDays, isPast } from 'date-fns';

interface ComplianceDocument {
  id: string;
  type: string;
  is_required: boolean;
  is_uploaded: boolean;
  file_name: string | null;
  expiration_date: string | null;
  uploaded_at: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string | null;
  amount: number;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
  jobs?: { id: string; name: string } | null;
}

interface Message {
  id: string;
  subject: string;
  content: string;
  read: boolean;
  created_at: string;
  from_profile?: {
    display_name: string;
  };
}

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (profile?.vendor_id) {
      fetchVendorData();
    } else {
      setLoading(false);
    }
  }, [profile?.vendor_id, currentCompany?.id]);

  const fetchVendorData = async () => {
    if (!profile?.vendor_id) return;
    
    try {
      setLoading(true);
      
      // Fetch vendor info
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, name, email, phone, vendor_type')
        .eq('id', profile.vendor_id)
        .single();
      
      if (vendor) {
        setVendorInfo(vendor);
      }

      // Fetch compliance documents
      const { data: docs } = await supabase
        .from('vendor_compliance_documents')
        .select('*')
        .eq('vendor_id', profile.vendor_id)
        .order('type');
      
      if (docs) {
        setComplianceDocs(docs);
      }

      // Fetch invoices/bills for this vendor
      const { data: invoiceData } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          status,
          issue_date,
          due_date,
          created_at,
          jobs (id, name)
        `)
        .eq('vendor_id', profile.vendor_id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (invoiceData) {
        setInvoices(invoiceData);
      }

      // Fetch messages for the user
      if (user?.id && currentCompany?.id) {
        const { data: messageData } = await supabase
          .from('messages')
          .select(`
            id,
            subject,
            content,
            read,
            created_at
          `)
          .eq('to_user_id', user.id)
          .eq('company_id', currentCompany.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (messageData) {
          // Map to our Message interface
          setMessages(messageData.map((m: any) => ({
            id: m.id,
            subject: m.subject || '',
            content: m.content || '',
            read: m.read || false,
            created_at: m.created_at,
            from_profile: undefined
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching vendor data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate document alerts
  const missingDocs = complianceDocs.filter(doc => doc.is_required && !doc.is_uploaded);
  const expiringDocs = complianceDocs.filter(doc => {
    if (!doc.expiration_date || !doc.is_uploaded) return false;
    const daysUntilExpiry = differenceInDays(new Date(doc.expiration_date), new Date());
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  });
  const expiredDocs = complianceDocs.filter(doc => {
    if (!doc.expiration_date || !doc.is_uploaded) return false;
    return isPast(new Date(doc.expiration_date));
  });

  // Calculate invoice stats
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'pending_approval');
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  const overdueInvoices = invoices.filter(inv => {
    if (!inv.due_date || inv.status === 'paid') return false;
    return isPast(new Date(inv.due_date));
  });

  const unreadMessages = messages.filter(m => !m.read).length;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      pending: { variant: "outline", label: "Pending" },
      pending_approval: { variant: "outline", label: "Pending Approval" },
      pending_coding: { variant: "outline", label: "Pending Coding" },
      approved: { variant: "default", label: "Approved" },
      paid: { variant: "default", label: "Paid" },
      rejected: { variant: "destructive", label: "Rejected" },
      overdue: { variant: "destructive", label: "Overdue" }
    };
    const config = statusConfig[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.vendor_id) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Vendor Account Linked</h2>
            <p className="text-muted-foreground text-center max-w-md">
              Your user account is not linked to a vendor profile. Please contact your administrator to set up your vendor access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendor Dashboard</h1>
        </div>
        <Button onClick={() => navigate('/vendor/compliance')}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Documents
        </Button>
      </div>

      {/* Alert Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Missing Documents Alert */}
        <Card className={missingDocs.length > 0 ? "border-destructive bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Missing Documents</CardTitle>
            <FileWarning className={`h-4 w-4 ${missingDocs.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{missingDocs.length}</div>
            <p className="text-xs text-muted-foreground">
              {missingDocs.length > 0 ? 'Action required' : 'All documents uploaded'}
            </p>
          </CardContent>
        </Card>

        {/* Expiring Documents */}
        <Card className={expiringDocs.length > 0 || expiredDocs.length > 0 ? "border-yellow-500 bg-yellow-500/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Calendar className={`h-4 w-4 ${expiringDocs.length > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringDocs.length + expiredDocs.length}</div>
            <p className="text-xs text-muted-foreground">
              {expiredDocs.length > 0 ? `${expiredDocs.length} expired` : 'Within 30 days'}
            </p>
          </CardContent>
        </Card>

        {/* Pending Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Invoices</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvoices.length}</div>
            <p className="text-xs text-muted-foreground">
              ${pendingInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0).toLocaleString()} total
            </p>
          </CardContent>
        </Card>

        {/* Unread Messages */}
        <Card className={unreadMessages > 0 ? "border-primary bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
            <MessageSquare className={`h-4 w-4 ${unreadMessages > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unreadMessages}</div>
            <p className="text-xs text-muted-foreground">
              {unreadMessages > 0 ? 'New messages' : 'All caught up'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
            {(missingDocs.length > 0 || expiredDocs.length > 0) && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {missingDocs.length + expiredDocs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
            {unreadMessages > 0 && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                {unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Documents</CardTitle>
              <CardDescription>
                Keep your documents up to date to maintain compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              {complianceDocs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No compliance documents configured
                </p>
              ) : (
                <div className="space-y-3">
                  {complianceDocs.map((doc) => {
                    const isExpired = doc.expiration_date && isPast(new Date(doc.expiration_date));
                    const isExpiringSoon = doc.expiration_date && !isExpired && 
                      differenceInDays(new Date(doc.expiration_date), new Date()) <= 30;
                    
                    return (
                      <div 
                        key={doc.id} 
                        className={`flex items-center justify-between p-4 border rounded-lg ${
                          !doc.is_uploaded && doc.is_required ? 'border-destructive bg-destructive/5' :
                          isExpired ? 'border-destructive bg-destructive/5' :
                          isExpiringSoon ? 'border-yellow-500 bg-yellow-500/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {doc.is_uploaded ? (
                            isExpired ? (
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                            ) : isExpiringSoon ? (
                              <Clock className="h-5 w-5 text-yellow-500" />
                            ) : (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            )
                          ) : (
                            <FileWarning className="h-5 w-5 text-destructive" />
                          )}
                          <div>
                            <p className="font-medium capitalize">{doc.type.replace(/_/g, ' ')}</p>
                            <p className="text-sm text-muted-foreground">
                              {doc.is_uploaded ? (
                                doc.expiration_date ? (
                                  isExpired ? (
                                    <span className="text-destructive">Expired {format(new Date(doc.expiration_date), 'MMM d, yyyy')}</span>
                                  ) : (
                                    `Expires ${format(new Date(doc.expiration_date), 'MMM d, yyyy')}`
                                  )
                                ) : 'No expiration'
                              ) : (
                                <span className="text-destructive">Not uploaded</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.is_required && (
                            <Badge variant="outline">Required</Badge>
                          )}
                          <Button 
                            variant={doc.is_uploaded ? "outline" : "default"} 
                            size="sm"
                            onClick={() => navigate('/vendor/compliance')}
                          >
                            {doc.is_uploaded ? 'Update' : 'Upload'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Invoice Status</CardTitle>
              <CardDescription>
                Track the status of your submitted invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No invoices found
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {invoices.map((invoice) => {
                      const isOverdue = invoice.due_date && invoice.status !== 'paid' && isPast(new Date(invoice.due_date));
                      
                      return (
                        <div 
                          key={invoice.id} 
                          className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                            isOverdue ? 'border-destructive bg-destructive/5' : ''
                          }`}
                          onClick={() => navigate(`/invoices/${invoice.id}`)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                              </p>
                              {getStatusBadge(isOverdue ? 'overdue' : invoice.status)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {invoice.jobs?.name || 'No job assigned'}
                              {invoice.issue_date && ` • ${format(new Date(invoice.issue_date), 'MMM d, yyyy')}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${Number(invoice.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            {invoice.due_date && (
                              <p className={`text-sm ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                                Due {format(new Date(invoice.due_date), 'MMM d')}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <CardDescription>
                Communications from your contacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No messages
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div 
                        key={message.id} 
                        className={`p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                          !message.read ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => navigate('/messages')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{message.subject || 'No subject'}</p>
                              {!message.read && (
                                <Badge variant="default" className="text-xs">New</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              From: {message.from_profile?.display_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {message.content}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(message.created_at), 'MMM d')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}