import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Building2,
  ClipboardList,
  HelpCircle,
  Settings2,
  Sparkles,
  Gavel
} from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { format, differenceInDays, isPast } from 'date-fns';
import { resolveStorageUrl } from '@/utils/storageUtils';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';

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
  company_name: string | null;
  photo_count: number;
  cover_photo_url: string | null;
}

interface VendorContract {
  id: string;
  name: string;
  contract_amount: number;
  status: string;
  contract_negotiation_status: string | null;
  signature_provider: string | null;
  signature_status: string | null;
  vendor_negotiation_notes: string | null;
  vendor_sov_proposal: any;
  executed_contract_file_url: string | null;
  jobs?: { id: string; name: string } | null;
}

interface VendorRFP {
  id: string;
  company_id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  job?: { id: string; name: string } | null;
  response_status: string | null;
  invited_at: string;
  attachments: Array<{
    id: string;
    file_name: string;
    file_url: string;
    file_type: string | null;
    file_size: number | null;
  }>;
  my_bid: {
    id: string;
    bid_amount: number;
    proposed_timeline: string | null;
    notes: string | null;
    status: string;
    submitted_at: string;
  } | null;
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
  const [rfps, setRfps] = useState<VendorRFP[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [assignedRFIs, setAssignedRFIs] = useState<AssignedRFI[]>([]);
  const [assignedSubmittals, setAssignedSubmittals] = useState<AssignedSubmittal[]>([]);
  const [assignedJobAlbums, setAssignedJobAlbums] = useState<AssignedJobAlbum[]>([]);
  const [assignedJobs, setAssignedJobs] = useState<Array<{
    id: string;
    name: string;
    company_id: string | null;
    company_name?: string | null;
    can_submit_bills: boolean;
    can_negotiate_contracts: boolean;
    can_submit_sov_proposals: boolean;
    can_upload_signed_contracts: boolean;
  }>>([]);
  const [contracts, setContracts] = useState<VendorContract[]>([]);
  const [activeTab, setActiveTab] = useState('documents');
  const [portalSettings, setPortalSettings] = useState({
    requireJobAssignmentForBills: true,
    requireProfileCompletion: true,
    requirePaymentMethod: true,
    requireW9: false,
    requireInsurance: false,
    requireCompanyLogo: false,
    requireUserAvatar: false,
    signatureProvider: 'manual',
    allowVendorContractNegotiation: true,
    allowVendorSovInput: true,
  });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [savingVendorPrefs, setSavingVendorPrefs] = useState(false);
  const [contractFeedbackDialogOpen, setContractFeedbackDialogOpen] = useState(false);
  const [signatureUploadDialogOpen, setSignatureUploadDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<VendorContract | null>(null);
  const [submittingContractAction, setSubmittingContractAction] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [sovProposalJson, setSovProposalJson] = useState('');
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureSignerName, setSignatureSignerName] = useState('');
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [invoiceFlowDialogOpen, setInvoiceFlowDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedRfpForBid, setSelectedRfpForBid] = useState<VendorRFP | null>(null);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [bidForm, setBidForm] = useState({
    bid_amount: '',
    proposed_timeline: '',
    notes: '',
  });
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    amount: '',
    issueDate: '',
    dueDate: '',
    description: '',
    jobId: '',
    paymentMethod: 'check',
    lineItems: [{ description: '', amount: '' }] as Array<{ description: string; amount: string }>,
  });
  const [vendorPreferences, setVendorPreferences] = useState({
    notificationEmail: true,
    notificationInApp: true,
    invoicePaid: true,
    jobAssignments: true,
    overdueInvoices: true,
    preferredPaymentType: 'check',
    checkDelivery: 'mail',
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

  useEffect(() => {
    if (!user?.id || loading) return;
    const key = `vendor-onboarding-seen:${user.id}`;
    const seen = localStorage.getItem(key);
    if (!seen) setShowOnboarding(true);
  }, [user?.id, loading]);

  const fetchVendorData = async () => {
    if (!profile?.vendor_id) return;
    
    try {
      setLoading(true);
      
      // Fetch vendor info
      const { data: vendor } = await supabase
        .from('vendors')
        .select('id, name, email, phone, address, city, state, zip_code, logo_url, vendor_type')
        .eq('id', profile.vendor_id)
        .single();
      
      if (vendor) {
        setVendorInfo(vendor);
      }

      if (currentCompany?.id) {
        const { data: portalConfig } = await supabase
          .from('payables_settings')
          .select(`
            vendor_portal_require_job_assignment_for_bills,
            vendor_portal_require_profile_completion,
            vendor_portal_require_payment_method,
            vendor_portal_require_w9,
            vendor_portal_require_insurance,
            vendor_portal_require_company_logo,
            vendor_portal_require_user_avatar,
            vendor_portal_signature_provider,
            vendor_portal_allow_vendor_contract_negotiation,
            vendor_portal_allow_vendor_sov_input
          `)
          .eq('company_id', currentCompany.id)
          .maybeSingle();

        const typedConfig = portalConfig as any;
        setPortalSettings({
          requireJobAssignmentForBills: typedConfig?.vendor_portal_require_job_assignment_for_bills ?? true,
          requireProfileCompletion: typedConfig?.vendor_portal_require_profile_completion ?? true,
          requirePaymentMethod: typedConfig?.vendor_portal_require_payment_method ?? true,
          requireW9: typedConfig?.vendor_portal_require_w9 ?? false,
          requireInsurance: typedConfig?.vendor_portal_require_insurance ?? false,
          requireCompanyLogo: typedConfig?.vendor_portal_require_company_logo ?? false,
          requireUserAvatar: typedConfig?.vendor_portal_require_user_avatar ?? false,
          signatureProvider: typedConfig?.vendor_portal_signature_provider ?? 'manual',
          allowVendorContractNegotiation: typedConfig?.vendor_portal_allow_vendor_contract_negotiation ?? true,
          allowVendorSovInput: typedConfig?.vendor_portal_allow_vendor_sov_input ?? true,
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

      const { data: invitedRfpsData, error: invitedRfpsError } = await supabase
        .from('rfp_invited_vendors')
        .select(`
          company_id,
          rfp_id,
          invited_at,
          response_status,
          rfp:rfps(
            id,
            rfp_number,
            title,
            description,
            scope_of_work,
            status,
            issue_date,
            due_date,
            job:jobs(id, name)
          )
        `)
        .eq('vendor_id', profile.vendor_id)
        .order('invited_at', { ascending: false });

      if (invitedRfpsError) {
        console.error('Error loading invited RFPs:', invitedRfpsError);
        setRfps([]);
      } else {
        const invitedRows = (invitedRfpsData || []) as any[];
        const rfpIds = Array.from(
          new Set(
            invitedRows
              .map((row) => row?.rfp?.id as string | undefined)
              .filter((value): value is string => Boolean(value))
          )
        );

        let attachmentsByRfp = new Map<string, any[]>();
        if (rfpIds.length > 0) {
          const { data: rfpAttachmentsData, error: rfpAttachmentsError } = await supabase
            .from('rfp_attachments')
            .select('id, rfp_id, file_name, file_url, file_type, file_size')
            .in('rfp_id', rfpIds);
          if (rfpAttachmentsError) {
            console.error('Error loading RFP attachments:', rfpAttachmentsError);
          } else {
            attachmentsByRfp = new Map<string, any[]>();
            (rfpAttachmentsData || []).forEach((attachment) => {
              const list = attachmentsByRfp.get(attachment.rfp_id) || [];
              list.push(attachment);
              attachmentsByRfp.set(attachment.rfp_id, list);
            });
          }
        }

        let bidByRfp = new Map<string, any>();
        if (rfpIds.length > 0) {
          const { data: myBidsData, error: myBidsError } = await supabase
            .from('bids')
            .select('id, rfp_id, bid_amount, proposed_timeline, notes, status, submitted_at')
            .eq('vendor_id', profile.vendor_id)
            .in('rfp_id', rfpIds);
          if (myBidsError) {
            console.error('Error loading vendor bids:', myBidsError);
          } else {
            bidByRfp = new Map((myBidsData || []).map((bid: any) => [bid.rfp_id, bid]));
          }
        }

        const mappedRfps: VendorRFP[] = invitedRows
          .map((row: any) => {
            const baseRfp = row.rfp;
            if (!baseRfp?.id) return null;
            return {
              id: baseRfp.id,
              company_id: String(row.company_id || ''),
              rfp_number: baseRfp.rfp_number,
              title: baseRfp.title,
              description: baseRfp.description,
              scope_of_work: baseRfp.scope_of_work,
              status: baseRfp.status,
              issue_date: baseRfp.issue_date,
              due_date: baseRfp.due_date,
              job: baseRfp.job || null,
              response_status: row.response_status || null,
              invited_at: row.invited_at,
              attachments: (attachmentsByRfp.get(baseRfp.id) || []).map((item: any) => ({
                id: item.id,
                file_name: item.file_name,
                file_url: item.file_url,
                file_type: item.file_type || null,
                file_size: item.file_size || null,
              })),
              my_bid: bidByRfp.get(baseRfp.id) || null,
            } as VendorRFP;
          })
          .filter((value): value is VendorRFP => value !== null);

        setRfps(mappedRfps);
      }

      const { data: contractData } = await supabase
        .from('subcontracts')
        .select(`
          id,
          name,
          contract_amount,
          status,
          contract_negotiation_status,
          signature_provider,
          signature_status,
          vendor_negotiation_notes,
          vendor_sov_proposal,
          executed_contract_file_url,
          jobs (id, name)
        `)
        .eq('vendor_id', profile.vendor_id)
        .order('created_at', { ascending: false })
        .limit(50);

      setContracts((contractData as unknown as VendorContract[]) || []);

      const { data: vendorAssignmentsData } = await supabase
        .from('vendor_job_access' as any)
        .select(`
          job_id,
          can_submit_bills,
          can_negotiate_contracts,
          can_submit_sov_proposals,
          can_upload_signed_contracts,
          jobs:job_id(id, name, company_id)
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

      const assignedJobMap = new Map<string, { id: string; name: string; company_id: string | null }>();
      [invoiceJobsData.data, subcontractJobsData.data, poJobsData.data].forEach((rows: any[] | null) => {
        (rows || []).forEach((row: any) => {
          if (row?.jobs?.id && row?.jobs?.name) {
            assignedJobMap.set(row.jobs.id, {
              id: row.jobs.id,
              name: row.jobs.name,
              company_id: row.jobs.company_id || null,
            });
          }
        });
      });
      const assignmentRows = (vendorAssignmentsData as any[]) || [];
      const rawAssignedJobs = assignmentRows.length > 0
        ? assignmentRows
            .filter((row) => row?.jobs?.id && row?.jobs?.name)
            .map((row) => ({
              id: row.jobs.id as string,
              name: row.jobs.name as string,
              company_id: (row.jobs.company_id as string) || null,
              can_submit_bills: !!row.can_submit_bills,
              can_negotiate_contracts: !!row.can_negotiate_contracts,
              can_submit_sov_proposals: !!row.can_submit_sov_proposals,
              can_upload_signed_contracts: !!row.can_upload_signed_contracts,
            }))
        : Array.from(assignedJobMap.values()).map((job) => ({
            ...job,
            can_submit_bills: true,
            can_negotiate_contracts: true,
            can_submit_sov_proposals: true,
            can_upload_signed_contracts: true,
          }));

      const companyIds = Array.from(
        new Set(
          rawAssignedJobs
            .map((job) => job.company_id)
            .filter((value): value is string => Boolean(value))
        )
      );

      const companyNameById = new Map<string, string>();
      if (companyIds.length > 0) {
        const { data: companiesData } = await supabase
          .from('companies')
          .select('id, display_name, name')
          .in('id', companyIds);

        (companiesData || []).forEach((company: any) => {
          companyNameById.set(company.id, company.display_name || company.name || 'Unknown company');
        });
      }

      setAssignedJobs(
        rawAssignedJobs.map((job) => ({
          ...job,
          company_name: job.company_id ? companyNameById.get(job.company_id) || null : null,
        }))
      );

      // Fetch messages for the user
      if (user?.id) {
        const [{ data: notifSettings }, { data: paymentMethod }] = await Promise.all([
          currentCompany?.id
            ? supabase
                .from('notification_settings')
                .select('email_enabled,in_app_enabled,invoices_paid,job_assignments,overdue_invoices')
                .eq('user_id', user.id)
                .eq('company_id', currentCompany.id)
                .maybeSingle()
            : Promise.resolve({ data: null } as any),
          supabase
            .from('vendor_payment_methods')
            .select('type,check_delivery')
            .eq('vendor_id', profile.vendor_id)
            .eq('is_primary', true)
            .maybeSingle(),
        ]);

        setVendorPreferences((prev) => ({
          ...prev,
          notificationEmail: notifSettings?.email_enabled ?? prev.notificationEmail,
          notificationInApp: notifSettings?.in_app_enabled ?? prev.notificationInApp,
          invoicePaid: notifSettings?.invoices_paid ?? prev.invoicePaid,
          jobAssignments: notifSettings?.job_assignments ?? prev.jobAssignments,
          overdueInvoices: notifSettings?.overdue_invoices ?? prev.overdueInvoices,
          preferredPaymentType: paymentMethod?.type || prev.preferredPaymentType,
          checkDelivery: paymentMethod?.check_delivery || prev.checkDelivery,
        }));

        const { data: jobAccessData } = await supabase
          .from('user_job_access')
          .select('job_id, jobs!inner(id, name, company_id)')
          .eq('user_id', user.id);

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
              jobs (id, name, company_id)
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
                  company_name: album.jobs?.company_id ? companyNameById.get(album.jobs.company_id) || null : null,
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
  const openRfps = rfps.filter((rfp) => {
    const status = String(rfp.status || '').toLowerCase();
    return status !== 'closed' && status !== 'awarded' && status !== 'cancelled';
  });
  const rfpWithoutBidCount = rfps.filter((rfp) => !rfp.my_bid).length;
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
  const hasPrimaryPaymentMethod = vendorPreferences.preferredPaymentType !== '';
  const hasW9Doc = complianceDocs.some((doc) => doc.is_uploaded && /w[\s_-]?9/i.test(doc.type));
  const hasInsuranceDoc = complianceDocs.some((doc) => doc.is_uploaded && /insurance/i.test(doc.type));
  const hasCompanyLogo = !!vendorInfo?.logo_url;
  const hasUserAvatar = !!profile?.avatar_url;
  const isProfileComplete = Boolean(
    profile?.first_name?.trim() &&
    profile?.last_name?.trim() &&
    (profile?.email || user?.email),
  );
  const onboardingChecklist = [
    { key: 'profile', label: 'Complete profile', required: portalSettings.requireProfileCompletion, done: isProfileComplete },
    { key: 'payment', label: 'Set default payment method', required: portalSettings.requirePaymentMethod, done: hasPrimaryPaymentMethod },
    { key: 'w9', label: 'Upload W-9', required: portalSettings.requireW9, done: hasW9Doc },
    { key: 'insurance', label: 'Upload insurance', required: portalSettings.requireInsurance, done: hasInsuranceDoc },
    { key: 'companyLogo', label: 'Upload company logo', required: portalSettings.requireCompanyLogo, done: hasCompanyLogo },
    { key: 'avatar', label: 'Set user avatar', required: portalSettings.requireUserAvatar, done: hasUserAvatar },
  ].filter((item) => item.required);
  const incompleteChecklist = onboardingChecklist.filter((item) => !item.done);
  const isOnboardingReady = incompleteChecklist.length === 0;
  const canSubmitFirstInvoice = canSubmitBills && isOnboardingReady;
  const hasCompanyInfo = Boolean(
    vendorInfo?.name?.trim() &&
    vendorInfo?.email?.trim() &&
    vendorInfo?.phone?.trim() &&
    vendorInfo?.address?.trim(),
  );
  const canUseCreateInvoiceFlow = canSubmitFirstInvoice && hasCompanyLogo && hasCompanyInfo && hasPrimaryPaymentMethod;
  const contractAccessByJobId = assignedJobs.reduce<Record<string, {
    can_negotiate_contracts: boolean;
    can_submit_sov_proposals: boolean;
    can_upload_signed_contracts: boolean;
  }>>((acc, job) => {
    acc[job.id] = {
      can_negotiate_contracts: job.can_negotiate_contracts,
      can_submit_sov_proposals: job.can_submit_sov_proposals,
      can_upload_signed_contracts: job.can_upload_signed_contracts,
    };
    return acc;
  }, {});
  const jobCompanyNameByJobId = assignedJobs.reduce<Record<string, string>>((acc, job) => {
    if (job.id && job.company_name) {
      acc[job.id] = job.company_name;
    }
    return acc;
  }, {});

  const getContractSignatureBadge = (status: string | null) => {
    const value = (status || 'not_started').toLowerCase();
    if (value === 'executed') return <Badge className="bg-green-600 text-white">Executed</Badge>;
    if (value === 'signed_uploaded') return <Badge variant="outline">Signed Uploaded</Badge>;
    if (value === 'awaiting_external_signature') return <Badge variant="destructive">Awaiting Signature</Badge>;
    if (value === 'pending_vendor_review') return <Badge variant="secondary">Pending Review</Badge>;
    return <Badge variant="secondary">Not Started</Badge>;
  };

  const openFeedbackDialog = (contract: VendorContract) => {
    const access = contract.jobs?.id ? contractAccessByJobId[contract.jobs.id] : null;
    if (access && !access.can_negotiate_contracts) {
      toast({
        title: 'Access restricted',
        description: 'Contract negotiation is disabled for this job assignment.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedContract(contract);
    setFeedbackNotes(contract.vendor_negotiation_notes || '');
    setSovProposalJson(
      contract.vendor_sov_proposal ? JSON.stringify(contract.vendor_sov_proposal, null, 2) : ''
    );
    setContractFeedbackDialogOpen(true);
  };

  const submitContractFeedback = async () => {
    if (!selectedContract?.id) return;
    try {
      setSubmittingContractAction(true);
      let parsedSov: any = null;
      if (sovProposalJson.trim()) {
        try {
          parsedSov = JSON.parse(sovProposalJson);
        } catch {
          toast({
            title: 'Invalid SOV JSON',
            description: 'SOV proposal must be valid JSON.',
            variant: 'destructive',
          });
          return;
        }
      }
      const { error } = await (supabase as any).rpc('vendor_submit_subcontract_feedback', {
        _subcontract_id: selectedContract.id,
        _negotiation_notes: feedbackNotes || null,
        _vendor_sov_proposal: parsedSov,
      });
      if (error) throw error;
      toast({
        title: 'Feedback submitted',
        description: 'Contract feedback was sent for internal review.',
      });
      setContractFeedbackDialogOpen(false);
      await fetchVendorData();
    } catch (error: any) {
      console.error('Failed to submit contract feedback:', error);
      toast({
        title: 'Submit failed',
        description: error?.message || 'Could not submit contract feedback.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingContractAction(false);
    }
  };

  const openSignatureDialog = (contract: VendorContract) => {
    const access = contract.jobs?.id ? contractAccessByJobId[contract.jobs.id] : null;
    if (access && !access.can_upload_signed_contracts) {
      toast({
        title: 'Access restricted',
        description: 'Signed contract upload is disabled for this job assignment.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedContract(contract);
    setSignatureFile(null);
    setSignatureConsent(false);
    setSignatureSignerName(
      `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.display_name || ''
    );
    setSignatureUploadDialogOpen(true);
  };

  const submitSignedContractUpload = async () => {
    if (!selectedContract?.id || !signatureFile || !signatureSignerName.trim()) {
      toast({
        title: 'Missing data',
        description: 'Signer name and signed contract file are required.',
        variant: 'destructive',
      });
      return;
    }
    if (!signatureConsent) {
      toast({
        title: 'Consent required',
        description: 'You must agree that your uploaded signature is binding.',
        variant: 'destructive',
      });
      return;
    }
    if (!currentCompany?.id) return;
    try {
      setSubmittingContractAction(true);
      const ext = signatureFile.name.split('.').pop() || 'pdf';
      const storagePath = `${currentCompany.id}/executed-contracts/${selectedContract.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('subcontract-files')
        .upload(storagePath, signatureFile, { upsert: false });
      if (uploadError) throw uploadError;

      const { error } = await (supabase as any).rpc('vendor_submit_subcontract_signature', {
        _subcontract_id: selectedContract.id,
        _executed_contract_file_url: storagePath,
        _signed_by_name: signatureSignerName.trim(),
        _signer_ip: null,
        _signer_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        _consent_text_version: 'v1',
      });
      if (error) throw error;

      toast({
        title: 'Signed contract submitted',
        description: 'Your signed contract was uploaded for company review.',
      });
      setSignatureUploadDialogOpen(false);
      await fetchVendorData();
    } catch (error: any) {
      console.error('Failed uploading signed contract:', error);
      toast({
        title: 'Upload failed',
        description: error?.message || 'Could not upload signed contract.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingContractAction(false);
    }
  };

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

  const openBidDialog = (rfp: VendorRFP) => {
    setSelectedRfpForBid(rfp);
    setBidForm({
      bid_amount: rfp.my_bid?.bid_amount ? String(rfp.my_bid.bid_amount) : '',
      proposed_timeline: rfp.my_bid?.proposed_timeline || '',
      notes: rfp.my_bid?.notes || '',
    });
    setBidDialogOpen(true);
  };

  const submitVendorBid = async () => {
    if (!selectedRfpForBid || !profile?.vendor_id) return;

    const amount = Number(bidForm.bid_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({
        title: 'Invalid bid amount',
        description: 'Enter a valid bid amount greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingBid(true);
      const payload = {
        rfp_id: selectedRfpForBid.id,
        company_id: selectedRfpForBid.company_id,
        vendor_id: profile.vendor_id,
        bid_amount: amount,
        proposed_timeline: bidForm.proposed_timeline?.trim() || null,
        notes: bidForm.notes?.trim() || null,
        status: 'submitted',
      };

      const { error } = await supabase
        .from('bids')
        .upsert(payload, { onConflict: 'rfp_id,vendor_id' });

      if (error) throw error;

      toast({
        title: selectedRfpForBid.my_bid ? 'Bid updated' : 'Bid submitted',
        description: 'Your bid has been saved.',
      });
      setBidDialogOpen(false);
      await fetchVendorData();
    } catch (error: any) {
      console.error('Error submitting vendor bid:', error);
      toast({
        title: 'Bid submission failed',
        description: error?.message || 'Unable to submit bid at this time.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingBid(false);
    }
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

  const saveVendorPreferences = async () => {
    if (!user?.id || !currentCompany?.id || !profile?.vendor_id) return;
    try {
      setSavingVendorPrefs(true);
      const [{ error: notifErr }, existingPaymentMethod] = await Promise.all([
        supabase
          .from('notification_settings')
          .upsert({
            user_id: user.id,
            company_id: currentCompany.id,
            email_enabled: vendorPreferences.notificationEmail,
            in_app_enabled: vendorPreferences.notificationInApp,
            invoices_paid: vendorPreferences.invoicePaid,
            job_assignments: vendorPreferences.jobAssignments,
            overdue_invoices: vendorPreferences.overdueInvoices,
          } as any),
        supabase
          .from('vendor_payment_methods')
          .select('id')
          .eq('vendor_id', profile.vendor_id)
          .eq('is_primary', true)
          .maybeSingle(),
      ]);

      if (notifErr) throw notifErr;
      const paymentPayload = {
        vendor_id: profile.vendor_id,
        is_primary: true,
        type: vendorPreferences.preferredPaymentType,
        check_delivery: vendorPreferences.checkDelivery,
      } as any;
      const paymentResult = existingPaymentMethod?.data?.id
        ? await supabase.from('vendor_payment_methods').update(paymentPayload).eq('id', existingPaymentMethod.data.id)
        : await supabase.from('vendor_payment_methods').insert(paymentPayload);
      if (paymentResult.error) throw paymentResult.error;

      toast({
        title: 'Settings saved',
        description: 'Vendor notification and payment preferences were updated.',
      });
    } catch (error: any) {
      console.error('Failed to save vendor preferences:', error);
      toast({
        title: 'Save failed',
        description: error?.message || 'Could not save vendor settings.',
        variant: 'destructive',
      });
    } finally {
      setSavingVendorPrefs(false);
    }
  };

  const createVendorInvoice = async () => {
    if (!profile?.vendor_id || !user?.id) return;
    const validLineItems = invoiceForm.lineItems
      .map((item) => ({ description: item.description.trim(), amount: Number(item.amount) }))
      .filter((item) => item.description && item.amount > 0);

    if (validLineItems.length === 0) {
      toast({ title: 'Missing line items', description: 'Add at least one valid line item.', variant: 'destructive' });
      return;
    }

    const parsedAmount = validLineItems.reduce((sum, item) => sum + item.amount, 0);

    if (!canSubmitFirstInvoice) {
      toast({ title: 'Requirements not complete', description: 'Complete all required checklist items first.', variant: 'destructive' });
      return;
    }
    if (!canUseCreateInvoiceFlow) {
      toast({
        title: 'Create invoice blocked',
        description: 'Set company info, logo, and payment method before using generated invoices.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const { error } = await supabase
        .from('invoices')
        .insert({
          vendor_id: profile.vendor_id,
          created_by: user.id,
          amount: parsedAmount,
          invoice_number: invoiceForm.invoiceNumber || null,
          description: invoiceForm.description || null,
          issue_date: invoiceForm.issueDate || null,
          due_date: invoiceForm.dueDate || null,
          job_id: invoiceForm.jobId || null,
          status: 'pending_approval',
          pending_coding: true,
          internal_notes: {
            generated_by_vendor_portal: true,
            payment_method: invoiceForm.paymentMethod,
            line_items: validLineItems,
            vendor_company_snapshot: {
              name: vendorInfo?.name || null,
              email: vendorInfo?.email || null,
              phone: vendorInfo?.phone || null,
              address: vendorInfo?.address || null,
              city: vendorInfo?.city || null,
              state: vendorInfo?.state || null,
              zip_code: vendorInfo?.zip_code || null,
              logo_url: vendorInfo?.logo_url || null,
            },
          },
        } as any);
      if (error) throw error;

      toast({
        title: 'Invoice created',
        description: 'Your invoice was created and sent for review.',
      });
      setInvoiceDialogOpen(false);
      setInvoiceForm({
        invoiceNumber: '',
        amount: '',
        issueDate: '',
        dueDate: '',
        description: '',
        jobId: '',
        paymentMethod: 'check',
        lineItems: [{ description: '', amount: '' }],
      });
      await fetchVendorData();
    } catch (error: any) {
      console.error('Failed creating vendor invoice:', error);
      toast({
        title: 'Create invoice failed',
        description: error?.message || 'Could not create invoice.',
        variant: 'destructive',
      });
    }
  };

  const addInvoiceLineItem = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', amount: '' }],
    }));
  };

  const removeInvoiceLineItem = (index: number) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const updateInvoiceLineItem = (index: number, key: 'description' | 'amount', value: string) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  };

  const launchUploadInvoiceFlow = () => {
    setInvoiceFlowDialogOpen(false);
    if (!canSubmitFirstInvoice) {
      toast({
        title: 'Checklist incomplete',
        description: !canSubmitBills
          ? 'Ask your admin/controller to assign your vendor to at least one job before bill submission.'
          : 'Complete your first-invoice checklist items to continue.',
        variant: 'destructive',
      });
      return;
    }
    navigate('/invoices/add');
  };

  const launchCreateInvoiceFlow = () => {
    setInvoiceFlowDialogOpen(false);
    if (!canUseCreateInvoiceFlow) {
      const missing: string[] = [];
      if (!canSubmitFirstInvoice) missing.push('onboarding checklist');
      if (!hasCompanyLogo) missing.push('company logo');
      if (!hasCompanyInfo) missing.push('company information');
      if (!hasPrimaryPaymentMethod) missing.push('payment method');
      toast({
        title: 'Create invoice requirements not met',
        description: `Complete: ${missing.join(', ')}.`,
        variant: 'destructive',
      });
      return;
    }
    setInvoiceDialogOpen(true);
  };

  if (loading) {
    return <PremiumLoadingScreen text="Loading vendor portal..." />;
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setActiveTab('help')}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Help
          </Button>
          <Button variant="outline" onClick={() => setActiveTab('settings')}>
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
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
      </div>

      {!isDesignProfessionalVendor && onboardingChecklist.length > 0 && (
        <Card className={isOnboardingReady ? 'border-green-500/40 bg-green-500/5' : 'border-yellow-500/40 bg-yellow-500/5'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              First Invoice Checklist
            </CardTitle>
            <CardDescription>
              Complete required items before submitting your first invoice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-2">
              {onboardingChecklist.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  {item.done ? (
                    <Badge variant="default">Done</Badge>
                  ) : (
                    <Badge variant="outline">Pending</Badge>
                  )}
                </div>
              ))}
            </div>
            {!isOnboardingReady && (
              <p className="text-xs text-muted-foreground mt-3">
                Missing items: {incompleteChecklist.map((i) => i.label).join(', ')}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

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
                  {canSubmitFirstInvoice ? 'Ready to submit invoices' : 'Complete requirements before submission'}
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!canSubmitFirstInvoice}
                  onClick={() => {
                    if (!canSubmitFirstInvoice) {
                      toast({
                        title: 'Checklist incomplete',
                        description: !canSubmitBills
                          ? 'Ask your admin/controller to assign your vendor to at least one job before bill submission.'
                          : 'Complete your first-invoice checklist items to continue.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    setInvoiceFlowDialogOpen(true);
                  }}
                >
                  Start Invoice
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

        <Card className={rfpWithoutBidCount > 0 ? "border-primary bg-primary/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">RFP Invitations</CardTitle>
            <Gavel className={`h-4 w-4 ${rfpWithoutBidCount > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openRfps.length}</div>
            <p className="text-xs text-muted-foreground">
              {rfpWithoutBidCount > 0 ? `${rfpWithoutBidCount} need bids` : 'All invited RFPs covered'}
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
        <TabsList className={`grid w-full ${isDesignProfessionalVendor ? 'grid-cols-10' : 'grid-cols-7'}`}>
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
          <TabsTrigger value="rfps" className="flex items-center gap-2">
            <Gavel className="h-4 w-4" />
            RFPs
            {rfpWithoutBidCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 text-xs flex items-center justify-center">
                {rfpWithoutBidCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Contracts
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
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Help
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
                                {jobCompanyNameByJobId[rfi.job_id] && (
                                  <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                                    {jobCompanyNameByJobId[rfi.job_id]}
                                  </Badge>
                                )}
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
                                {jobCompanyNameByJobId[submittal.job_id] && (
                                  <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                                    {jobCompanyNameByJobId[submittal.job_id]}
                                  </Badge>
                                )}
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
                          {album.company_name && (
                            <Badge variant="outline" className="text-[10px]">
                              {album.company_name}
                            </Badge>
                          )}
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
                <div className="pt-2 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setInvoiceFlowDialogOpen(true);
                    }}
                    disabled={!canSubmitFirstInvoice}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Start Invoice
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
                              {invoice.jobs?.id && jobCompanyNameByJobId[invoice.jobs.id] && (
                                <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                                  {jobCompanyNameByJobId[invoice.jobs.id]}
                                </Badge>
                              )}
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

        <TabsContent value="rfps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>RFP Invitations</CardTitle>
              <CardDescription>
                View invited RFP overview, download attachments, and submit your bid.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rfps.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No RFP invitations available
                </p>
              ) : (
                <ScrollArea className="h-[440px]">
                  <div className="space-y-3">
                    {rfps.map((rfp) => {
                      const dueDate = rfp.due_date ? new Date(rfp.due_date) : null;
                      const isDuePast = dueDate ? isPast(dueDate) : false;
                      return (
                        <div key={rfp.id} className="rounded-lg border p-3 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium truncate">{rfp.rfp_number} - {rfp.title}</p>
                                <Badge variant="outline">{rfp.status}</Badge>
                                {rfp.my_bid ? (
                                  <Badge className="bg-green-600 text-white">Bid Submitted</Badge>
                                ) : (
                                  <Badge variant="secondary">No Bid Yet</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Job: {rfp.job?.name || 'No job assigned'}
                                {rfp.job?.id && jobCompanyNameByJobId[rfp.job.id] && (
                                  <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                                    {jobCompanyNameByJobId[rfp.job.id]}
                                  </Badge>
                                )}
                              </p>
                              {rfp.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {rfp.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-xs text-muted-foreground">
                                Invited {format(new Date(rfp.invited_at), 'MMM d, yyyy')}
                              </p>
                              {dueDate && (
                                <p className={`text-xs ${isDuePast ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  Due {format(dueDate, 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-md border bg-muted/20 p-2">
                            <p className="text-xs font-medium mb-2">Attachments</p>
                            {rfp.attachments.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No attachments</p>
                            ) : (
                              <div className="space-y-1">
                                {rfp.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href="#"
                                    onClick={async (e) => { e.preventDefault(); const url = await resolveStorageUrl('rfp-attachments', attachment.file_url); window.open(url, '_blank'); }}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between rounded-sm px-2 py-1 text-xs hover:bg-background/70"
                                  >
                                    <span className="truncate pr-2">{attachment.file_name}</span>
                                    <span className="text-muted-foreground shrink-0">
                                      {attachment.file_size ? `${Math.max(1, Math.round(attachment.file_size / 1024))} KB` : ''}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {rfp.my_bid && (
                            <div className="rounded-md border bg-green-500/5 p-2 text-xs">
                              <p className="font-medium">
                                Current bid: ${Number(rfp.my_bid.bid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                              <p className="text-muted-foreground">
                                Submitted {format(new Date(rfp.my_bid.submitted_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => openBidDialog(rfp)}>
                              {rfp.my_bid ? 'Update Bid' : 'Submit Bid'}
                            </Button>
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

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contract Negotiation & Signature</CardTitle>
              <CardDescription>
                Review assigned contracts, submit feedback, and upload signed copies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No contracts assigned
                </p>
              ) : (
                <ScrollArea className="h-[420px]">
                  <div className="space-y-3">
                    {contracts.map((contract) => (
                      (() => {
                        const access = contract.jobs?.id ? contractAccessByJobId[contract.jobs.id] : null;
                        const canNegotiate = access ? access.can_negotiate_contracts : true;
                        const canUploadSigned = access ? access.can_upload_signed_contracts : true;
                        return (
                      <div
                        key={contract.id}
                        className="rounded-lg border p-3 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{contract.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {contract.jobs?.name || 'No job'} • ${Number(contract.contract_amount || 0).toLocaleString()}
                              {contract.jobs?.id && jobCompanyNameByJobId[contract.jobs.id] && (
                                <Badge variant="outline" className="ml-2 text-[10px] align-middle">
                                  {jobCompanyNameByJobId[contract.jobs.id]}
                                </Badge>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {getContractSignatureBadge(contract.signature_status)}
                            <Badge variant="outline">
                              {(contract.signature_provider || portalSettings.signatureProvider || 'manual').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/subcontracts/${contract.id}`)}>
                            View Contract
                          </Button>
                          {portalSettings.allowVendorContractNegotiation && (
                            <Button variant="outline" size="sm" onClick={() => openFeedbackDialog(contract)} disabled={!canNegotiate}>
                              Submit Feedback
                            </Button>
                          )}
                          {['awaiting_external_signature', 'pending_vendor_review'].includes(String(contract.signature_status || '').toLowerCase()) && (
                            <Button
                              size="sm"
                              onClick={() => openSignatureDialog(contract)}
                              disabled={(contract.signature_provider || portalSettings.signatureProvider || 'manual') !== 'manual' || !canUploadSigned}
                            >
                              Upload Signed Contract
                            </Button>
                          )}
                          {(contract.signature_provider || portalSettings.signatureProvider || 'manual') === 'docusign' && (
                            <Badge variant="secondary">DocuSign Coming Soon</Badge>
                          )}
                        </div>
                      </div>
                        );
                      })()
                    ))}
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

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Settings</CardTitle>
              <CardDescription>Manage your notifications and payment preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Notification Preferences</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Email notifications</Label>
                    <Button variant="outline" size="sm" onClick={() => setVendorPreferences((p) => ({ ...p, notificationEmail: !p.notificationEmail }))}>
                      {vendorPreferences.notificationEmail ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>In-app notifications</Label>
                    <Button variant="outline" size="sm" onClick={() => setVendorPreferences((p) => ({ ...p, notificationInApp: !p.notificationInApp }))}>
                      {vendorPreferences.notificationInApp ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Invoice paid alerts</Label>
                    <Button variant="outline" size="sm" onClick={() => setVendorPreferences((p) => ({ ...p, invoicePaid: !p.invoicePaid }))}>
                      {vendorPreferences.invoicePaid ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Job assignment alerts</Label>
                    <Button variant="outline" size="sm" onClick={() => setVendorPreferences((p) => ({ ...p, jobAssignments: !p.jobAssignments }))}>
                      {vendorPreferences.jobAssignments ? 'On' : 'Off'}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label>Overdue invoice alerts</Label>
                    <Button variant="outline" size="sm" onClick={() => setVendorPreferences((p) => ({ ...p, overdueInvoices: !p.overdueInvoices }))}>
                      {vendorPreferences.overdueInvoices ? 'On' : 'Off'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Default Payment Method</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Method</Label>
                    <Select
                      value={vendorPreferences.preferredPaymentType}
                      onValueChange={(value) => setVendorPreferences((p) => ({ ...p, preferredPaymentType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="ach">ACH</SelectItem>
                        <SelectItem value="wire">Wire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Check Delivery</Label>
                    <Select
                      value={vendorPreferences.checkDelivery}
                      onValueChange={(value) => setVendorPreferences((p) => ({ ...p, checkDelivery: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mail">Mail Check</SelectItem>
                        <SelectItem value="pickup">Pick Up Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveVendorPreferences} disabled={savingVendorPrefs}>
                  {savingVendorPrefs ? 'Saving...' : 'Save Vendor Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="help" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Help Center</CardTitle>
              <CardDescription>Quick guides for billing, communication, and setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">How to submit invoices</p>
                <p className="text-muted-foreground">Use Bills tab → Submit New Bill or Create Invoice Here. Ensure checklist items are complete first.</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">How to communicate</p>
                <p className="text-muted-foreground">Use Messages tab for company communication and response tracking.</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">How to complete compliance</p>
                <p className="text-muted-foreground">Use Compliance tab to upload required documents and monitor expiration dates.</p>
              </div>
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">W-9 Form</p>
                <a href="https://www.irs.gov/pub/irs-pdf/fw9.pdf" target="_blank" rel="noreferrer" className="text-primary underline">
                  Download official W-9 (IRS)
                </a>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={contractFeedbackDialogOpen} onOpenChange={setContractFeedbackDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit Contract Feedback</DialogTitle>
            <DialogDescription>
              Add negotiation comments and optional SOV proposal JSON for internal review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Negotiation Notes</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                placeholder="Describe requested changes or clarifications..."
              />
            </div>
            {portalSettings.allowVendorSovInput && (
              <div className="space-y-1">
                <Label>SOV Proposal (JSON, optional)</Label>
                <textarea
                  className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={sovProposalJson}
                  onChange={(e) => setSovProposalJson(e.target.value)}
                  placeholder='[{"cost_code":"03-100","description":"Concrete","amount":12500}]'
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitContractFeedback} disabled={submittingContractAction}>
              {submittingContractAction ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signatureUploadDialogOpen} onOpenChange={setSignatureUploadDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Signed Contract</DialogTitle>
            <DialogDescription>
              Upload the executed contract PDF and provide signer details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Signer Name</Label>
              <Input
                value={signatureSignerName}
                onChange={(e) => setSignatureSignerName(e.target.value)}
                placeholder="Full legal name"
              />
            </div>
            <div className="space-y-1">
              <Label>Signed Contract File</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setSignatureFile(e.target.files?.[0] || null)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={signatureConsent}
                onChange={(e) => setSignatureConsent(e.target.checked)}
              />
              <span>
                I confirm this electronic submission is a binding contractual signature and I consent to timestamp/user metadata logging.
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitSignedContractUpload} disabled={submittingContractAction}>
              {submittingContractAction ? 'Uploading...' : 'Submit Signed Contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRfpForBid?.my_bid ? 'Update Bid' : 'Submit Bid'}</DialogTitle>
            <DialogDescription>
              {selectedRfpForBid ? `${selectedRfpForBid.rfp_number} - ${selectedRfpForBid.title}` : 'Provide your bid details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Bid Amount *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={bidForm.bid_amount}
                onChange={(e) => setBidForm((prev) => ({ ...prev, bid_amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Proposed Timeline</Label>
              <Input
                value={bidForm.proposed_timeline}
                onChange={(e) => setBidForm((prev) => ({ ...prev, proposed_timeline: e.target.value }))}
                placeholder="e.g. 4 weeks"
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={bidForm.notes}
                onChange={(e) => setBidForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Include clarifications, inclusions, or assumptions."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBidDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitVendorBid} disabled={submittingBid}>
              {submittingBid ? 'Saving...' : selectedRfpForBid?.my_bid ? 'Update Bid' : 'Submit Bid'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showOnboarding}
        onOpenChange={(open) => {
          if (!open && user?.id) {
            localStorage.setItem(`vendor-onboarding-seen:${user.id}`, '1');
          }
          setShowOnboarding(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Welcome to the Vendor Portal</DialogTitle>
            <DialogDescription>
              Complete the checklist, then start billing and collaboration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {onboardingChecklist.length === 0 ? (
              <p className="text-muted-foreground">No onboarding requirements were configured by this company.</p>
            ) : onboardingChecklist.map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{item.label}</span>
                <Badge variant={item.done ? 'default' : 'outline'}>{item.done ? 'Done' : 'Pending'}</Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowOnboarding(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceFlowDialogOpen} onOpenChange={setInvoiceFlowDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit Invoice</DialogTitle>
            <DialogDescription>Choose how you want to submit this invoice.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={launchUploadInvoiceFlow}
              className="rounded-lg border p-4 text-left hover:bg-muted/40 transition-colors"
            >
              <p className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> I have my own invoice</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upload your invoice file and enter invoice details.
              </p>
            </button>
            <button
              type="button"
              onClick={launchCreateInvoiceFlow}
              className="rounded-lg border p-4 text-left hover:bg-muted/40 transition-colors"
            >
              <p className="font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> I want to create the invoice here</p>
              <p className="text-sm text-muted-foreground mt-1">
                Build a structured invoice with line items, descriptions, and payment method.
              </p>
              {!canUseCreateInvoiceFlow && (
                <p className="text-xs text-yellow-400 mt-2">
                  Requires company logo, company info, payment method, and completed onboarding checklist.
                </p>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Create an invoice directly without uploading your own invoice file.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Invoice #</Label>
              <Input value={invoiceForm.invoiceNumber} onChange={(e) => setInvoiceForm((p) => ({ ...p, invoiceNumber: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={invoiceForm.lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2)}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm((p) => ({ ...p, issueDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Job</Label>
              <Select value={invoiceForm.jobId} onValueChange={(value) => setInvoiceForm((p) => ({ ...p, jobId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select assigned job (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {assignedJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}{job.company_name ? ` - ${job.company_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Payment Method *</Label>
              <Select value={invoiceForm.paymentMethod} onValueChange={(value) => setInvoiceForm((p) => ({ ...p, paymentMethod: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="ach">ACH</SelectItem>
                  <SelectItem value="wire">Wire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Input value={invoiceForm.description} onChange={(e) => setInvoiceForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Line Items *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addInvoiceLineItem}>Add Line</Button>
              </div>
              <div className="space-y-2">
                {invoiceForm.lineItems.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <Input
                      className="col-span-8"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateInvoiceLineItem(idx, 'description', e.target.value)}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={line.amount}
                      onChange={(e) => updateInvoiceLineItem(idx, 'amount', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="col-span-1 px-0"
                      onClick={() => removeInvoiceLineItem(idx)}
                      disabled={invoiceForm.lineItems.length === 1}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
            <Button onClick={createVendorInvoice}>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
