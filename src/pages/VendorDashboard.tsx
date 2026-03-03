import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  FileCheck,
  Camera,
  Loader2,
  Building2,
  ClipboardList
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format, differenceInDays, isPast } from 'date-fns';
import { resolveStorageUrl } from '@/utils/storageUtils';

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

interface AssignedRFI {
  id: string;
  rfi_number: string | null;
  subject: string;
  status: string;
  ball_in_court: string | null;
  due_date: string | null;
  updated_at: string;
  job_id: string;
  jobs?: { id: string; name: string } | null;
}

interface AssignedSubmittal {
  id: string;
  submittal_number: string;
  title: string;
  status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "closed";
  due_date: string | null;
  updated_at: string;
  job_id: string;
  jobs?: { id: string; name: string } | null;
}

interface AssignedJobAlbum {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  job_id: string;
  job_name: string;
  photo_count: number;
  cover_photo_url: string | null;
}

export default function VendorDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [vendorInfo, setVendorInfo] = useState<any>(null);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignedRFIs, setAssignedRFIs] = useState<AssignedRFI[]>([]);
  const [assignedSubmittals, setAssignedSubmittals] = useState<AssignedSubmittal[]>([]);
  const [assignedJobAlbums, setAssignedJobAlbums] = useState<AssignedJobAlbum[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<Array<{ id: string; name: string; can_submit_bills: boolean }>>([]);
  const [activeTab, setActiveTab] = useState('documents');
  const [portalSettings, setPortalSettings] = useState({
    requireJobAssignmentForBills: true,
  });

  useEffect(() => {
    if (profile?.vendor_id) {
      fetchVendorData();
    } else {
      setLoading(false);
    }
  }, [profile?.vendor_id, currentCompany?.id]);

  useEffect(() => {
    if (location.pathname.includes('/vendor/compliance')) {
      setActiveTab('documents');
      return;
    }
    if (location.pathname.includes('/vendor/dashboard') || location.pathname.includes('/design-professional/dashboard')) {
      setActiveTab(String(vendorInfo?.vendor_type || '').toLowerCase() === 'design_professional' ? 'rfis' : 'invoices');
    }
  }, [location.pathname, vendorInfo?.vendor_type]);

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

      if (currentCompany?.id) {
        const { data: portalConfig } = await supabase
          .from('payables_settings')
          .select('vendor_portal_require_job_assignment_for_bills')
          .eq('company_id', currentCompany.id)
          .maybeSingle();

        const typedConfig = portalConfig as any;
        setPortalSettings({
          requireJobAssignmentForBills: typedConfig?.vendor_portal_require_job_assignment_for_bills ?? true,
        });
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

      const { data: vendorAssignmentsData } = await supabase
        .from('vendor_job_access' as any)
        .select(`
          job_id,
          can_submit_bills,
          jobs:job_id(id, name)
        `)
        .eq('vendor_id', profile.vendor_id);

      const [invoiceJobsData, subcontractJobsData, poJobsData] = await Promise.all([
        supabase
          .from('invoices')
          .select('job_id, jobs:job_id(id, name)')
          .eq('vendor_id', profile.vendor_id)
          .not('job_id', 'is', null),
        supabase
          .from('subcontracts')
          .select('job_id, jobs:job_id(id, name)')
          .eq('vendor_id', profile.vendor_id)
          .not('job_id', 'is', null),
        supabase
          .from('purchase_orders')
          .select('job_id, jobs:job_id(id, name)')
          .eq('vendor_id', profile.vendor_id)
          .not('job_id', 'is', null),
      ]);

      const assignedJobMap = new Map<string, { id: string; name: string }>();
      [invoiceJobsData.data, subcontractJobsData.data, poJobsData.data].forEach((rows: any[] | null) => {
        (rows || []).forEach((row: any) => {
          if (row?.jobs?.id && row?.jobs?.name) {
            assignedJobMap.set(row.jobs.id, { id: row.jobs.id, name: row.jobs.name });
          }
        });
      });
      const assignmentRows = (vendorAssignmentsData as any[]) || [];
      if (assignmentRows.length > 0) {
        setAssignedJobs(
          assignmentRows
            .filter((row) => row?.jobs?.id && row?.jobs?.name)
            .map((row) => ({
              id: row.jobs.id as string,
              name: row.jobs.name as string,
              can_submit_bills: !!row.can_submit_bills,
            }))
        );
      } else {
        setAssignedJobs(Array.from(assignedJobMap.values()).map((job) => ({ ...job, can_submit_bills: true })));
      }

      // Fetch messages for the user
      if (user?.id && currentCompany?.id) {
        const { data: jobAccessData } = await supabase
          .from('user_job_access')
          .select('job_id, jobs!inner(id, name, company_id)')
          .eq('user_id', user.id)
          .eq('jobs.company_id', currentCompany.id);

        const { data: rfiData } = await supabase
          .from('rfis')
          .select(`
            id,
            rfi_number,
            subject,
            status,
            ball_in_court,
            due_date,
            updated_at,
            job_id,
            jobs (id, name)
          `)
          .eq('company_id', currentCompany.id)
          .eq('assigned_to', user.id)
          .order('updated_at', { ascending: false })
          .limit(20);
        
        if (rfiData) {
          setAssignedRFIs(rfiData as unknown as AssignedRFI[]);
        }

        const { data: submittalData } = await supabase
          .from('submittals')
          .select(`
            id,
            submittal_number,
            title,
            status,
            due_date,
            updated_at,
            job_id,
            jobs (id, name)
          `)
          .eq('company_id', currentCompany.id)
          .eq('assigned_to', user.id)
          .order('updated_at', { ascending: false })
          .limit(20);

        if (submittalData) {
          setAssignedSubmittals(submittalData as unknown as AssignedSubmittal[]);
        }

        const assignedJobIds = new Set<string>();
        (jobAccessData || []).forEach((row: any) => {
          if (row?.job_id) assignedJobIds.add(row.job_id);
        });
        (rfiData || []).forEach((rfi: any) => {
          if (rfi?.job_id) assignedJobIds.add(rfi.job_id);
        });
        (submittalData || []).forEach((submittal: any) => {
          if (submittal?.job_id) assignedJobIds.add(submittal.job_id);
        });

        if (assignedJobIds.size > 0) {
          const { data: albumData } = await supabase
            .from('photo_albums')
            .select(`
              id,
              name,
              description,
              created_at,
              job_id,
              jobs (id, name)
            `)
            .in('job_id', Array.from(assignedJobIds))
            .order('created_at', { ascending: false })
            .limit(60);

          if (albumData) {
            const hydratedAlbums = await Promise.all(
              albumData.map(async (album: any) => {
                const [{ count }, { data: latestPhoto }] = await Promise.all([
                  supabase
                    .from('job_photos')
                    .select('id', { count: 'exact', head: true })
                    .eq('album_id', album.id),
                  supabase
                    .from('job_photos')
                    .select('photo_url, created_at')
                    .eq('album_id', album.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                ]);

                const coverUrl = latestPhoto?.photo_url
                  ? await resolveStorageUrl('punch-photos', latestPhoto.photo_url)
                  : null;

                return {
                  id: album.id,
                  name: album.name,
                  description: album.description || null,
                  created_at: album.created_at,
                  job_id: album.job_id,
                  job_name: album.jobs?.name || 'Unknown job',
                  photo_count: Number(count || 0),
                  cover_photo_url: coverUrl,
                } as AssignedJobAlbum;
              })
            );

            setAssignedJobAlbums(hydratedAlbums);
          } else {
            setAssignedJobAlbums([]);
          }
        } else {
          setAssignedJobAlbums([]);
        }

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
  const isDesignProfessionalVendor = String(vendorInfo?.vendor_type || '').toLowerCase() === 'design_professional';
  const canOpenInvoiceDetails = profile?.role !== 'vendor' && profile?.role !== 'design_professional';
  const actionRequiredRFIs = assignedRFIs.filter((rfi) => {
    const status = String(rfi.status || '').toLowerCase();
    return status !== 'closed' && status !== 'resolved';
  });
  const overdueRFIs = actionRequiredRFIs.filter((rfi) => {
    if (!rfi.due_date) return false;
    return isPast(new Date(rfi.due_date));
  });
  const actionRequiredSubmittals = assignedSubmittals.filter((submittal) => {
    const status = String(submittal.status || '').toLowerCase();
    return status !== 'approved' && status !== 'closed';
  });
  const overdueSubmittals = actionRequiredSubmittals.filter((submittal) => {
    if (!submittal.due_date) return false;
    return isPast(new Date(submittal.due_date));
  });
  const totalAssignedAlbumPhotos = assignedJobAlbums.reduce((sum, album) => sum + album.photo_count, 0);
  const canSubmitBills = !portalSettings.requireJobAssignmentForBills
    || assignedJobs.some((job) => job.can_submit_bills);

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

  const getRFIStatusBadge = (status: string, ballInCourt: string | null) => {
    const normalizedStatus = String(status || '').toLowerCase();
    if (normalizedStatus === 'closed') {
      return <Badge variant="secondary">Closed</Badge>;
    }
    if (normalizedStatus === 'submitted' && String(ballInCourt || '').toLowerCase() === 'design_professional') {
      return <Badge variant="destructive">Response Required</Badge>;
    }
    if (normalizedStatus === 'submitted') {
      return <Badge variant="outline">Submitted</Badge>;
    }
    if (normalizedStatus === 'draft') {
      return <Badge variant="secondary">Draft</Badge>;
    }
    return <Badge variant="outline">{status || 'Open'}</Badge>;
  };

  const getSubmittalStatusBadge = (status: AssignedSubmittal["status"]) => {
    const styles: Record<AssignedSubmittal["status"], string> = {
      draft: "bg-muted text-muted-foreground",
      submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      closed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };
    return <Badge className={styles[status]}>{status.replace("_", " ")}</Badge>;
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
          <h1 className="text-2xl font-bold text-foreground">
            {isDesignProfessionalVendor ? 'Design Professional Portal' : 'Vendor Portal'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vendorInfo?.name || 'Vendor'}{isDesignProfessionalVendor ? ' - RFI and document workflow' : ' - compliance and invoice workflow'}
          </p>
        </div>
        {isDesignProfessionalVendor ? (
          <Button variant="outline" onClick={() => navigate('/jobs')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Open Jobs
          </Button>
        ) : (
          <Button onClick={() => setActiveTab('documents')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Documents
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {isDesignProfessionalVendor && (
              <Button variant={activeTab === 'rfis' ? 'default' : 'outline'} onClick={() => setActiveTab('rfis')}>RFIs</Button>
            )}
            {isDesignProfessionalVendor && (
              <Button variant={activeTab === 'submittals' ? 'default' : 'outline'} onClick={() => setActiveTab('submittals')}>Submittals</Button>
            )}
            {isDesignProfessionalVendor && (
              <Button variant={activeTab === 'photos' ? 'default' : 'outline'} onClick={() => setActiveTab('photos')}>Photos</Button>
            )}
            <Button variant={activeTab === 'documents' ? 'default' : 'outline'} onClick={() => setActiveTab('documents')}>Compliance</Button>
            <Button variant={activeTab === 'invoices' ? 'default' : 'outline'} onClick={() => setActiveTab('invoices')}>Bills</Button>
            <Button variant={activeTab === 'messages' ? 'default' : 'outline'} onClick={() => setActiveTab('messages')}>Messages</Button>
            <Button variant="outline" onClick={() => navigate(`/vendors/${profile.vendor_id}`)}>Company Profile</Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {!isDesignProfessionalVendor && (
          <Card className={canSubmitBills ? 'border-primary/30' : 'border-destructive bg-destructive/5'}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bill Submission Access</CardTitle>
              <FileText className={`h-4 w-4 ${canSubmitBills ? 'text-primary' : 'text-destructive'}`} />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold">{assignedJobs.length}</div>
              <p className="text-xs text-muted-foreground">
                {canSubmitBills ? 'Assigned jobs available' : 'No assigned jobs yet'}
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={!canSubmitBills}
                onClick={() => {
                  if (!canSubmitBills) {
                    toast({
                      title: 'Job assignment required',
                      description: 'Ask your admin/controller to assign your vendor to at least one job before bill submission.',
                      variant: 'destructive',
                    });
                    return;
                  }
                  navigate('/invoices/add');
                }}
              >
                Submit Bill
              </Button>
            </CardContent>
          </Card>
        )}

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

        {/* Pending Invoices / Assigned RFIs */}
        <Card className={isDesignProfessionalVendor && actionRequiredRFIs.length > 0 ? "border-primary bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {isDesignProfessionalVendor ? 'Assigned RFIs' : 'Pending Invoices'}
            </CardTitle>
            {isDesignProfessionalVendor ? (
              <ClipboardList className={`h-4 w-4 ${actionRequiredRFIs.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isDesignProfessionalVendor ? actionRequiredRFIs.length : pendingInvoices.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {isDesignProfessionalVendor
                ? (overdueRFIs.length > 0 ? `${overdueRFIs.length} overdue` : 'Awaiting response/review')
                : `$${pendingInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0).toLocaleString()} total`}
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

        {isDesignProfessionalVendor && (
          <Card className={actionRequiredSubmittals.length > 0 ? "border-primary bg-primary/5" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Submittals</CardTitle>
              <FileCheck className={`h-4 w-4 ${actionRequiredSubmittals.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{actionRequiredSubmittals.length}</div>
              <p className="text-xs text-muted-foreground">
                {overdueSubmittals.length > 0 ? `${overdueSubmittals.length} overdue` : 'Awaiting action/review'}
              </p>
            </CardContent>
          </Card>
        )}

        {isDesignProfessionalVendor && (
          <Card className={assignedJobAlbums.length > 0 ? "border-primary/40" : ""}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Photo Albums</CardTitle>
              <Camera className={`h-4 w-4 ${assignedJobAlbums.length > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignedJobAlbums.length}</div>
              <p className="text-xs text-muted-foreground">
                {totalAssignedAlbumPhotos} photos across assigned jobs
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full ${isDesignProfessionalVendor ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {isDesignProfessionalVendor && (
            <TabsTrigger value="rfis" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              RFIs
              {actionRequiredRFIs.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {actionRequiredRFIs.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isDesignProfessionalVendor && (
            <TabsTrigger value="submittals" className="flex items-center gap-2">
              <FileCheck className="h-4 w-4" />
              Submittals
              {actionRequiredSubmittals.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                  {actionRequiredSubmittals.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {isDesignProfessionalVendor && (
            <TabsTrigger value="photos" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photos
              {assignedJobAlbums.length > 0 && (
                <Badge variant="outline" className="ml-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                  {assignedJobAlbums.length}
                </Badge>
              )}
            </TabsTrigger>
          )}
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

        {/* RFIs Tab */}
        {isDesignProfessionalVendor && (
          <TabsContent value="rfis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assigned RFIs</CardTitle>
                <CardDescription>
                  Questions requiring your review and response
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignedRFIs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No RFIs assigned
                  </p>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-3">
                      {assignedRFIs.map((rfi) => {
                        const isOverdue = !!rfi.due_date && isPast(new Date(rfi.due_date)) && String(rfi.status || '').toLowerCase() !== 'closed';
                        return (
                          <div
                            key={rfi.id}
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                              isOverdue ? 'border-destructive bg-destructive/5' : ''
                            }`}
                            onClick={() => navigate(`/jobs/${rfi.job_id}`)}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {rfi.rfi_number || `RFI-${rfi.id.slice(0, 8)}`}
                                </p>
                                {getRFIStatusBadge(rfi.status, rfi.ball_in_court)}
                              </div>
                              <p className="text-sm">{rfi.subject}</p>
                              <p className="text-sm text-muted-foreground">
                                {rfi.jobs?.name || 'Unknown job'}
                              </p>
                            </div>
                            <div className="text-right">
                              {rfi.due_date ? (
                                <p className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  Due {format(new Date(rfi.due_date), 'MMM d, yyyy')}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">No due date</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Updated {format(new Date(rfi.updated_at), 'MMM d')}
                              </p>
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
        )}

        {/* Submittals Tab */}
        {isDesignProfessionalVendor && (
          <TabsContent value="submittals" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Assigned Submittals</CardTitle>
                <CardDescription>
                  Submittal packages assigned to you for design review workflow
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignedSubmittals.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No submittals assigned
                  </p>
                ) : (
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-3">
                      {assignedSubmittals.map((submittal) => {
                        const isOverdue = !!submittal.due_date && isPast(new Date(submittal.due_date)) && !['approved', 'closed'].includes(String(submittal.status || '').toLowerCase());
                        return (
                          <div
                            key={submittal.id}
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                              isOverdue ? 'border-destructive bg-destructive/5' : ''
                            }`}
                            onClick={() => navigate(`/jobs/${submittal.job_id}`)}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">
                                  {submittal.submittal_number}
                                </p>
                                {getSubmittalStatusBadge(submittal.status)}
                              </div>
                              <p className="text-sm">{submittal.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {submittal.jobs?.name || 'Unknown job'}
                              </p>
                            </div>
                            <div className="text-right">
                              {submittal.due_date ? (
                                <p className={`text-sm ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  Due {format(new Date(submittal.due_date), 'MMM d, yyyy')}
                                </p>
                              ) : (
                                <p className="text-sm text-muted-foreground">No due date</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Updated {format(new Date(submittal.updated_at), 'MMM d')}
                              </p>
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
        )}

        {/* Photos Tab */}
        {isDesignProfessionalVendor && (
          <TabsContent value="photos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job Photo Albums</CardTitle>
                <CardDescription>
                  Albums from jobs you are assigned to
                </CardDescription>
              </CardHeader>
              <CardContent>
                {assignedJobAlbums.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No photo albums available for your assigned jobs yet
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {assignedJobAlbums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        className="text-left border rounded-lg overflow-hidden hover:border-primary hover:bg-muted/30 transition-colors"
                        onClick={() => navigate(`/jobs/${album.job_id}?tab=photo-album`)}
                      >
                        <div className="h-36 bg-muted">
                          {album.cover_photo_url ? (
                            <img
                              src={album.cover_photo_url}
                              alt={album.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                              No cover photo
                            </div>
                          )}
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium truncate">{album.name}</p>
                            <Badge variant="secondary" className="shrink-0">{album.photo_count}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{album.job_name}</p>
                          {album.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{album.description}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

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
              {!isDesignProfessionalVendor && (
                <div className="pt-2">
                  <Button
                    onClick={() => {
                      if (!canSubmitBills) {
                        toast({
                          title: 'Job assignment required',
                          description: 'Ask your admin/controller to assign your vendor to at least one job before bill submission.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      navigate('/invoices/add');
                    }}
                    disabled={!canSubmitBills}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Submit New Bill
                  </Button>
                </div>
              )}
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
                          className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                            canOpenInvoiceDetails ? 'cursor-pointer hover:bg-muted/50' : ''
                          } ${
                            isOverdue ? 'border-destructive bg-destructive/5' : ''
                          }`}
                          onClick={() => {
                            if (canOpenInvoiceDetails) navigate(`/invoices/${invoice.id}`);
                          }}
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
