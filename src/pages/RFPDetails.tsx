import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, FileText, Users, BarChart3, Plus, Building2, Calendar, Send, Trash2, Mail, Search, Link2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessJobIds } from '@/utils/jobAccess';
import { getPublicAuthOrigin } from '@/utils/publicAuthOrigin';
import { getStoragePathForDb, resolveStorageUrl } from '@/utils/storageUtils';
import ZoomableDocumentPreview from '@/components/ZoomableDocumentPreview';
import { downloadRfpPlanPagesPdf } from '@/utils/rfpPlanPagesPdf';
import RfpPlanPageNoteViewer, { type RfpPlanPageNoteViewerNote } from '@/components/RfpPlanPageNoteViewer';

interface RfpPlanPage {
  id: string;
  plan_id: string;
  plan_page_id: string;
  sort_order: number;
  is_primary: boolean;
  note: string | null;
  plan_name: string;
  plan_number: string | null;
  plan_file_url: string | null;
  page_number: number;
  sheet_number: string | null;
  page_title: string | null;
  discipline: string | null;
  thumbnail_url: string | null;
  callouts: RfpPlanPageNoteViewerNote[];
}

interface RfpIssuePackage {
  id: string;
  name: string;
  description: string | null;
  plans: Array<{
    plan_id: string;
    plan_name: string;
    plan_number: string | null;
    file_url: string | null;
  }>;
}
interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  logistics_details: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  job_id: string | null;
  created_at: string;
  job?: {
    name: string;
  };
}
interface RfpAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

interface RfpAttachmentTarget {
  id: string;
  rfp_number: string;
  title: string;
  job_id: string | null;
  status: string;
}

interface RfpAttachmentReference {
  rfp_id: string;
  rfp_number: string;
  title: string;
  status: string;
  job_id: string | null;
  job_name?: string | null;
}

interface OwnerProfile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface Bid {
  id: string;
  bid_amount: number;
  proposed_timeline: string | null;
  notes: string | null;
  status: string;
  submitted_at: string;
  version_number?: number | null;
  bid_contact_name?: string | null;
  bid_contact_email?: string | null;
  bid_contact_phone?: string | null;
  shipping_included?: boolean | null;
  shipping_amount?: number | null;
  taxes_included?: boolean | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  comparison_notes?: string | null;
  vendor: {
    id: string;
    name: string;
    logo_url?: string | null;
    logo_display_url?: string | null;
  };
  total_score?: number;
  scores?: Record<string, number>;
  weighted_total?: number;
}

interface ScoringCriterion {
  id: string;
  criterion_name: string;
  description: string | null;
  weight: number;
  max_score: number;
  criterion_type?: 'numeric' | 'yes_no' | 'picklist' | null;
  criterion_options?: Array<{ label: string; score: number }> | null;
  sort_order: number;
}

const isPriceCriterion = (criterionName: string) => {
  const value = String(criterionName || '').toLowerCase();
  return value.includes('price') || value.includes('cost');
};

const normalizeCriterionType = (value: unknown): 'numeric' | 'yes_no' | 'picklist' => {
  if (value === 'yes_no' || value === 'picklist' || value === 'numeric') return value;
  return 'numeric';
};

const toNumber = (value: string | number | null | undefined) => Number(value || 0);

const computeBidFinalTotal = (bid: {
  bid_amount: number;
  shipping_included?: boolean | null;
  shipping_amount?: number | null;
  taxes_included?: boolean | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
}) => {
  const base = toNumber(bid.bid_amount);
  const discount = toNumber(bid.discount_amount);
  const taxableBase = Math.max(0, base - discount);
  const shipping = bid.shipping_included ? 0 : toNumber(bid.shipping_amount);
  const taxRatePercent = bid.taxes_included ? 0 : toNumber(bid.tax_amount);
  const tax = taxableBase * (Math.max(0, taxRatePercent) / 100);
  return Math.max(0, taxableBase + shipping + tax);
};

const buildPriceRankByBidId = (bids: Bid[]) => {
  const sorted = [...bids].sort((a, b) => computeBidFinalTotal(a) - computeBidFinalTotal(b));
  const rankByBidId: Record<string, number> = {};
  let currentRank = 1;
  sorted.forEach((bid, index) => {
    if (index > 0 && computeBidFinalTotal(bid) > computeBidFinalTotal(sorted[index - 1])) {
      currentRank = index + 1;
    }
    rankByBidId[bid.id] = currentRank;
  });
  return rankByBidId;
};

const formatOrdinal = (value: number) => {
  const abs = Math.abs(value);
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = abs % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
};

const buildAutoPriceScores = (bids: Bid[], criteria: ScoringCriterion[]) => {
  const priceCriteria = criteria.filter((criterion) => isPriceCriterion(criterion.criterion_name));
  if (priceCriteria.length === 0 || bids.length === 0) return {} as Record<string, Record<string, number>>;

  const rankByBidId = buildPriceRankByBidId(bids);

  const scores: Record<string, Record<string, number>> = {};
  bids.forEach((bid) => {
    const rank = rankByBidId[bid.id] || bids.length;
    const autoScore = Math.max(1, bids.length - rank + 1);
    if (!scores[bid.id]) scores[bid.id] = {};
    priceCriteria.forEach((criterion) => {
      scores[bid.id][criterion.id] = autoScore;
    });
  });

  return scores;
};

const mergeScoresWithAutoPrice = (
  manualScores: Record<string, Record<string, number>>,
  autoPriceScores: Record<string, Record<string, number>>,
) => {
  const merged: Record<string, Record<string, number>> = {};
  Object.entries(manualScores).forEach(([bidId, bidScores]) => {
    merged[bidId] = { ...(bidScores || {}) };
  });
  Object.entries(autoPriceScores).forEach(([bidId, bidScores]) => {
    merged[bidId] = { ...(merged[bidId] || {}), ...(bidScores || {}) };
  });
  return merged;
};

const calculateWeightedTotal = (
  bidId: string,
  criteria: ScoringCriterion[],
  scoreMap: Record<string, Record<string, number>>,
) => {
  const bidScores = scoreMap[bidId] || {};
  return criteria.reduce((total, criterion) => {
    const score = bidScores[criterion.id] || 0;
    return total + score * Number(criterion.weight || 0);
  }, 0);
};

const getRfpStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (String(status || '').toLowerCase()) {
    case 'issued':
    case 'awarded':
      return 'default';
    case 'cancelled':
      return 'destructive';
    case 'closed':
      return 'outline';
    default:
      return 'secondary';
  }
};

interface Vendor {
  id: string;
  name: string;
  email: string | null;
  vendor_type?: string | null;
}

interface InvitedVendor {
  id: string;
  vendor_id: string;
  invited_at: string;
  email_status?: string | null;
  email_sent_at?: string | null;
  email_delivered_at?: string | null;
  email_opened_at?: string | null;
  email_bounced_at?: string | null;
  last_viewed_at?: string | null;
  response_status: string | null;
  vendor: Vendor;
  portal_invite_pending?: boolean;
  portal_invite_sent_at?: string | null;
  portal_account_created?: boolean;
}

const BIDDER_VENDOR_ACCESS_DEFAULTS = {
  can_view_job_details: true,
  can_submit_bills: false,
  can_view_plans: true,
  can_view_rfis: false,
  can_submit_rfis: false,
  can_view_submittals: false,
  can_submit_submittals: false,
  can_view_team_directory: true,
  can_upload_compliance_docs: true,
  can_view_photos: false,
  can_view_rfps: true,
  can_submit_bids: true,
  can_view_subcontracts: false,
  can_access_messages: true,
  can_access_filing_cabinet: true,
  filing_cabinet_access_level: 'view_only',
  can_download_filing_cabinet_files: true,
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const isMissingRfpPlanPageNotesTableError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return (
    code === '42p01' ||
    message.includes('rfp_plan_page_notes') ||
    details.includes('rfp_plan_page_notes') ||
    message.includes('schema cache')
  );
};

export default function RFPDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [attachments, setAttachments] = useState<RfpAttachment[]>([]);
  const [planPages, setPlanPages] = useState<RfpPlanPage[]>([]);
  const [issuePackage, setIssuePackage] = useState<RfpIssuePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDrawings, setUploadingDrawings] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [editingAttachmentName, setEditingAttachmentName] = useState('');
  const [savingAttachmentNameId, setSavingAttachmentNameId] = useState<string | null>(null);
  const [attachmentComments, setAttachmentComments] = useState<Record<string, string>>({});
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [previewPlanPage, setPreviewPlanPage] = useState<RfpPlanPage | null>(null);
  const [rfpAttachDialogOpen, setRfpAttachDialogOpen] = useState(false);
  const [rfpTargets, setRfpTargets] = useState<RfpAttachmentTarget[]>([]);
  const [selectedTargetRfpId, setSelectedTargetRfpId] = useState('');
  const [attachmentToCopy, setAttachmentToCopy] = useState<RfpAttachment | null>(null);
  const [copyingAttachmentToRfp, setCopyingAttachmentToRfp] = useState(false);
  const [ownerProfilesById, setOwnerProfilesById] = useState<Record<string, OwnerProfile>>({});
  const [rfpAttachmentRefsByUrl, setRfpAttachmentRefsByUrl] = useState<Record<string, RfpAttachmentReference[]>>({});
  const [rfpLinksDialogOpen, setRfpLinksDialogOpen] = useState(false);
  const [rfpLinksDialogTitle, setRfpLinksDialogTitle] = useState('');
  const [rfpLinksDialogRefs, setRfpLinksDialogRefs] = useState<RfpAttachmentReference[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invitedVendors, setInvitedVendors] = useState<InvitedVendor[]>([]);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);
  const [vendorSearch, setVendorSearch] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [quickInviteForm, setQuickInviteForm] = useState({ name: '', email: '' });
  const [creatingQuickInvite, setCreatingQuickInvite] = useState(false);
  const [quickInviteVendorType, setQuickInviteVendorType] = useState<string>('Contractor');
  const drawingsInputRef = useRef<HTMLInputElement | null>(null);
  const [isDrawingsDragOver, setIsDrawingsDragOver] = useState(false);
  const [bidSortBy, setBidSortBy] = useState<'vendor' | 'bid_amount' | 'submitted_at'>('submitted_at');
  const [bidSortDirection, setBidSortDirection] = useState<'asc' | 'desc'>('desc');
  const [bidScoreMap, setBidScoreMap] = useState<Record<string, Record<string, number>>>({});
  const [autoSavingScores, setAutoSavingScores] = useState(false);
  const [scoringBidId, setScoringBidId] = useState<string | null>(null);
  const [editingCriterion, setEditingCriterion] = useState<ScoringCriterion | null>(null);
  const [criterionForm, setCriterionForm] = useState({
    criterion_name: '',
    description: '',
    weight: '1',
    max_score: '10',
    criterion_type: 'numeric' as 'numeric' | 'yes_no' | 'picklist',
    options_text: '',
  });
  const [savingCriterion, setSavingCriterion] = useState(false);
  const activeTab = (() => {
    const tab = searchParams.get('tab');
    return tab === 'invited' || tab === 'bids' ? tab : 'overview';
  })();

  const commentStorageKey = `rfp-attachment-comments:${currentCompany?.id || 'default'}:${id || 'unknown'}:${user?.id || 'anon'}`;

  const sortedBids = useMemo(() => {
    const rows = [...bids];
    rows.sort((a, b) => {
      if (bidSortBy === 'vendor') {
        const left = String(a.vendor?.name || '').toLowerCase();
        const right = String(b.vendor?.name || '').toLowerCase();
        return left.localeCompare(right);
      }
      if (bidSortBy === 'bid_amount') {
        return computeBidFinalTotal(a) - computeBidFinalTotal(b);
      }
      return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
    });
    if (bidSortDirection === 'desc') rows.reverse();
    return rows;
  }, [bids, bidSortBy, bidSortDirection]);

  const effectiveCriteria = useMemo<ScoringCriterion[]>(() => {
    if (bids.length === 0) return criteria;
    const hasExplicitPriceCriterion = criteria.some((criterion) => isPriceCriterion(criterion.criterion_name));
    if (hasExplicitPriceCriterion) return criteria;
    return [
      ...criteria,
      {
        id: '__default_price_rank__',
        criterion_name: 'Price Rank (Auto)',
        description: 'Auto-scored by lowest final total',
        weight: 1,
        max_score: bids.length,
        criterion_type: 'numeric',
        criterion_options: null,
        sort_order: 9999,
      },
    ];
  }, [criteria, bids.length]);

  const persistableCriterionIds = useMemo(() => new Set(criteria.map((entry) => entry.id)), [criteria]);

  const analyzedBids = useMemo(
    () =>
      bids.map((bid) => ({
        ...bid,
        scores: bidScoreMap[bid.id] || {},
        weighted_total: calculateWeightedTotal(bid.id, effectiveCriteria, bidScoreMap),
      })),
    [bids, effectiveCriteria, bidScoreMap],
  );
  const analyzedSortedBids = useMemo(
    () =>
      sortedBids.map((bid) => ({
        ...bid,
        scores: bidScoreMap[bid.id] || {},
        weighted_total: calculateWeightedTotal(bid.id, effectiveCriteria, bidScoreMap),
      })),
    [sortedBids, effectiveCriteria, bidScoreMap],
  );
  const lowestBidId = useMemo(() => {
    if (!analyzedBids.length) return null;
    return analyzedBids.reduce((min, row) => (
      computeBidFinalTotal(row) < computeBidFinalTotal(min) ? row : min
    )).id;
  }, [analyzedBids]);
  const scoringBid = useMemo(
    () => analyzedBids.find((row) => row.id === scoringBidId) || null,
    [analyzedBids, scoringBidId],
  );
  const priceRankByBidId = useMemo(() => buildPriceRankByBidId(bids), [bids]);

  useEffect(() => {
    if (id && currentCompany?.id && !websiteJobAccessLoading) {
      loadRFP();
    }
  }, [id, currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(',')]);

  useEffect(() => {
    const stored = window.localStorage.getItem(commentStorageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, string>;
      setAttachmentComments(parsed || {});
    } catch {
      // ignore malformed local storage
    }
  }, [commentStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(commentStorageKey, JSON.stringify(attachmentComments));
  }, [attachmentComments, commentStorageKey]);

  useEffect(() => {
    if (!id || bids.length === 0) {
      setBidScoreMap({});
      return;
    }

    const bidIds = bids.map((bid) => bid.id);
    let cancelled = false;

    (async () => {
      try {
        const manualScores: Record<string, Record<string, number>> = {};
        if (criteria.length > 0) {
          const { data: scoresData, error } = await supabase
            .from('bid_scores')
            .select('bid_id, criterion_id, score')
            .in('bid_id', bidIds);

          if (error) throw error;
          if (cancelled) return;

          (scoresData || []).forEach((row: any) => {
            if (!manualScores[row.bid_id]) manualScores[row.bid_id] = {};
            manualScores[row.bid_id][row.criterion_id] = Number(row.score || 0);
          });
        }

        const autoPrice = buildAutoPriceScores(bids, effectiveCriteria);
        setBidScoreMap(mergeScoresWithAutoPrice(manualScores, autoPrice));
      } catch (error) {
        console.error('Error loading bid scores:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    bids
      .map(
        (bid) =>
          `${bid.id}:${bid.bid_amount}:${bid.shipping_included ? 1 : 0}:${bid.shipping_amount || 0}:${bid.taxes_included ? 1 : 0}:${bid.tax_amount || 0}:${bid.discount_amount || 0}`,
      )
      .join('|'),
    effectiveCriteria.map((criterion) => `${criterion.id}:${criterion.criterion_name}:${criterion.weight}:${criterion.max_score}:${criterion.criterion_type || ''}`).join('|'),
    criteria.length,
  ]);

  useEffect(() => {
    const ownerIds = Array.from(new Set(attachments.map((a) => a.uploaded_by).filter(Boolean)));
    if (ownerIds.length === 0) {
      setOwnerProfilesById({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, display_name, avatar_url')
        .in('user_id', ownerIds);
      if (cancelled) return;
      if (error) {
        console.error('Error loading drawing owner profiles:', error);
        return;
      }
      const mapped: Record<string, OwnerProfile> = {};
      (data || []).forEach((row: any) => {
        mapped[row.user_id] = row as OwnerProfile;
      });
      setOwnerProfilesById(mapped);
    })();
    return () => {
      cancelled = true;
    };
  }, [attachments]);

  useEffect(() => {
    if (!currentCompany?.id) {
      setRfpAttachmentRefsByUrl({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('rfp_attachments')
        .select('file_url, rfp_id, rfps!inner(id, rfp_number, title, status, job_id, jobs(name))')
        .eq('company_id', currentCompany.id);
      if (cancelled) return;
      if (error) {
        console.error('Error loading attachment link refs:', error);
        return;
      }
      const next: Record<string, RfpAttachmentReference[]> = {};
      (data || []).forEach((row: any) => {
        const key = String(row.file_url || '');
        if (!key) return;
        const ref: RfpAttachmentReference = {
          rfp_id: String(row.rfp_id || ''),
          rfp_number: String(row.rfps?.rfp_number || ''),
          title: String(row.rfps?.title || ''),
          status: String(row.rfps?.status || ''),
          job_id: row.rfps?.job_id || null,
          job_name: row.rfps?.jobs?.name || null,
        };
        const current = next[key] || [];
        if (current.some((entry) => entry.rfp_id === ref.rfp_id)) return;
        next[key] = [...current, ref].sort((a, b) => `${a.rfp_number} ${a.title}`.localeCompare(`${b.rfp_number} ${b.title}`));
      });
      setRfpAttachmentRefsByUrl(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id]);

  const loadRFP = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select(`
          *,
          job:jobs(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      if (!canAccessJobIds([data.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this job.',
          variant: 'destructive'
        });
        navigate('/construction/rfps');
        return;
      }
      setRfp(data as any);
      await Promise.all([loadBids(), loadCriteria(), loadVendors(), loadInvitedVendors(), loadAttachments(), loadPlanPages(), loadIssuePackage()]);
      await loadRfpTargets();
    } catch (error) {
      console.error('Error loading RFP:', error);
      toast({
        title: 'Error',
        description: 'Failed to load RFP details',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRfpTargets = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select('id, rfp_number, title, job_id, status')
        .eq('company_id', currentCompany!.id)
        .neq('id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRfpTargets((data || []) as RfpAttachmentTarget[]);
    } catch (error) {
      console.error('Error loading RFP targets:', error);
      setRfpTargets([]);
    }
  };

  const loadBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          vendor:vendors(id, name, logo_url)
        `)
        .eq('rfp_id', id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      const rows = (data || []) as Bid[];
      const rowsWithVendorLogo = await Promise.all(
        rows.map(async (row) => {
          const logoPath = row.vendor?.logo_url || null;
          if (!logoPath) return row;
          const logoDisplayUrl = await resolveStorageUrl('receipts', logoPath);
          return {
            ...row,
            vendor: {
              ...row.vendor,
              logo_display_url: logoDisplayUrl,
            },
          };
        }),
      );
      setBids(rowsWithVendorLogo);
    } catch (error) {
      console.error('Error loading bids:', error);
    }
  };

  const toggleBidSort = (column: 'vendor' | 'bid_amount' | 'submitted_at') => {
    if (bidSortBy === column) {
      setBidSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setBidSortBy(column);
    setBidSortDirection(column === 'vendor' ? 'asc' : 'desc');
  };

  const getSortIndicator = (column: 'vendor' | 'bid_amount' | 'submitted_at') => {
    if (bidSortBy !== column) return '';
    return bidSortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const updateBidScore = (bidId: string, criterionId: string, value: number) => {
    const criterion = effectiveCriteria.find((entry) => entry.id === criterionId);
    if (criterion && isPriceCriterion(criterion.criterion_name)) return;

    const clampedValue = Math.max(0, Math.min(value, Number(criterion?.max_score || value)));
    setBidScoreMap((prev) => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [criterionId]: clampedValue,
      },
    }));
    void persistBidScore(bidId, criterionId, clampedValue);
  };

  const persistBidScore = async (bidId: string, criterionId: string, score: number) => {
    if (!currentCompany?.id || !user?.id) return;
    if (!persistableCriterionIds.has(criterionId)) return;
    try {
      setAutoSavingScores(true);
      const { error } = await supabase.from('bid_scores').upsert(
        {
          bid_id: bidId,
          criterion_id: criterionId,
          company_id: currentCompany.id,
          score,
          scored_by: user.id,
          scored_at: new Date().toISOString(),
        } as any,
        { onConflict: 'bid_id,criterion_id' },
      );
      if (error) throw error;
    } catch (error: any) {
      console.error('Error auto-saving bid score:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to auto-save bid score',
        variant: 'destructive',
      });
    } finally {
      setAutoSavingScores(false);
    }
  };

  const loadCriteria = async () => {
    try {
      const { data, error } = await supabase
        .from('bid_scoring_criteria')
        .select('*')
        .eq('rfp_id', id)
        .order('sort_order');

      if (error) throw error;
      setCriteria((data || []) as any);
    } catch (error) {
      console.error('Error loading criteria:', error);
    }
  };

  const openEditCriterionModal = (criterion: ScoringCriterion) => {
    const optionsText = (criterion.criterion_options || [])
      .map((option) => `${option.label} | ${option.score}`)
      .join('\n');

    setCriterionForm({
      criterion_name: criterion.criterion_name || '',
      description: criterion.description || '',
      weight: String(criterion.weight ?? 1),
      max_score: String(criterion.max_score ?? 10),
      criterion_type: criterion.criterion_type || 'numeric',
      options_text: optionsText,
    });
    setEditingCriterion(criterion);
  };

  const parseCriterionOptions = (raw: string) => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelPart, scorePart] = line.split('|').map((part) => part?.trim() ?? '');
        const score = Number(scorePart);
        return {
          label: labelPart,
          score: Number.isFinite(score) ? score : 0,
        };
      })
      .filter((option) => option.label.length > 0);
  };

  const saveCriterionEdit = async () => {
    if (!editingCriterion?.id) return;
    const name = criterionForm.criterion_name.trim();
    if (!name) {
      toast({ title: 'Validation', description: 'Criterion name is required', variant: 'destructive' });
      return;
    }

    const parsedWeight = Number(criterionForm.weight);
    const parsedMax = Number(criterionForm.max_score);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      toast({ title: 'Validation', description: 'Weight must be greater than 0', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(parsedMax) || parsedMax < 0) {
      toast({ title: 'Validation', description: 'Max score must be 0 or higher', variant: 'destructive' });
      return;
    }

    const options = criterionForm.criterion_type === 'picklist' ? parseCriterionOptions(criterionForm.options_text) : [];
    if (criterionForm.criterion_type === 'picklist' && options.length === 0) {
      toast({
        title: 'Validation',
        description: 'Picklist criteria require at least one option',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSavingCriterion(true);
      const payload: any = {
        criterion_name: name,
        description: criterionForm.description.trim() || null,
        weight: parsedWeight,
        max_score: criterionForm.criterion_type === 'yes_no' ? 1 : parsedMax,
        criterion_type: criterionForm.criterion_type,
        criterion_options: criterionForm.criterion_type === 'picklist' ? options : null,
      };

      const { error } = await supabase
        .from('bid_scoring_criteria')
        .update(payload)
        .eq('id', editingCriterion.id)
        .eq('rfp_id', id);

      if (error) throw error;
      setEditingCriterion(null);
      await loadCriteria();
      toast({ title: 'Saved', description: 'Scoring criterion updated' });
    } catch (error: any) {
      console.error('Error updating criterion:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update criterion',
        variant: 'destructive',
      });
    } finally {
      setSavingCriterion(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email, vendor_type')
        .eq('company_id', currentCompany!.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadInvitedVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_invited_vendors')
        .select(`
          id,
          vendor_id,
          invited_at,
          email_status,
          email_sent_at,
          email_delivered_at,
          email_opened_at,
          email_bounced_at,
          last_viewed_at,
          response_status,
          vendor:vendors(id, name, email, vendor_type)
        `)
        .eq('rfp_id', id);

      if (error) throw error;
      const invitedRows = (data || []) as any[];
      const vendorIds = Array.from(new Set(invitedRows.map((row) => String(row.vendor_id)).filter(Boolean)));

      let pendingInvitesByVendorId = new Map<string, { invited_at: string | null }>();
      let linkedVendorIds = new Set<string>();

      if (vendorIds.length > 0) {
        const [portalInvitesResult, linkedProfilesResult] = await Promise.all([
          supabase
            .from('vendor_invitations')
            .select('vendor_id, invited_at, status, expires_at')
            .in('vendor_id', vendorIds)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .order('invited_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('vendor_id')
            .in('vendor_id', vendorIds)
            .not('vendor_id', 'is', null),
        ]);

        if (portalInvitesResult.error) throw portalInvitesResult.error;
        if (linkedProfilesResult.error) throw linkedProfilesResult.error;

        ((portalInvitesResult.data || []) as any[]).forEach((row) => {
          const key = String(row.vendor_id);
          if (!pendingInvitesByVendorId.has(key)) {
            pendingInvitesByVendorId.set(key, {
              invited_at: row.invited_at || null,
            });
          }
        });

        linkedVendorIds = new Set(
          ((linkedProfilesResult.data || []) as any[])
            .map((row) => String(row.vendor_id || ''))
            .filter(Boolean),
        );
      }

      setInvitedVendors(
        invitedRows.map((row) => {
          const vendorId = String(row.vendor_id);
          const pendingPortalInvite = pendingInvitesByVendorId.get(vendorId);
          const portalAccountCreated = linkedVendorIds.has(vendorId);
          return {
            ...row,
            portal_invite_pending: !!pendingPortalInvite && !portalAccountCreated,
            portal_invite_sent_at: pendingPortalInvite?.invited_at || null,
            portal_account_created: portalAccountCreated,
          };
        }),
      );
    } catch (error) {
      console.error('Error loading invited vendors:', error);
    }
  };

  const loadAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_attachments')
        .select('id, file_name, file_url, file_size, file_type, uploaded_at, uploaded_by')
        .eq('rfp_id', id)
        .order('uploaded_at', { ascending: false });
      if (error) throw error;
      setAttachments((data || []) as any);
    } catch (error) {
      console.error('Error loading RFP attachments:', error);
    }
  };

  const loadPlanPages = async () => {
    try {
      const { data, error } = await supabase
        .from('rfp_plan_pages' as any)
        .select(`
          id,
          plan_id,
          plan_page_id,
          sort_order,
          is_primary,
          note,
          plan_page:plan_pages(id, page_number, sheet_number, page_title, discipline, thumbnail_url),
          plan:job_plans(id, plan_name, plan_number, file_url)
        `)
        .eq('rfp_id', id)
        .eq('company_id', currentCompany!.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      const selectedRows = ((data || []) as any[]).map((row) => ({
        id: String(row.id),
        plan_id: String(row.plan_id),
        plan_page_id: String(row.plan_page_id),
        sort_order: Number(row.sort_order || 0),
        is_primary: !!row.is_primary,
        note: row.note || null,
        plan_name: String(row.plan?.plan_name || 'Plan Set'),
        plan_number: row.plan?.plan_number || null,
        plan_file_url: row.plan?.file_url || null,
        page_number: Number(row.plan_page?.page_number || 0),
        sheet_number: row.plan_page?.sheet_number || null,
        page_title: row.plan_page?.page_title || null,
        discipline: row.plan_page?.discipline || null,
        thumbnail_url: row.plan_page?.thumbnail_url || null,
      }));

      let calloutsByPageId = new Map<string, RfpPlanPageNoteViewerNote[]>();
      if (selectedRows.length > 0) {
        const { data: noteRows, error: noteError } = await supabase
          .from('rfp_plan_page_notes' as any)
          .select('id, rfp_plan_page_id, shape_type, x, y, width, height, note_text, sort_order')
          .in('rfp_plan_page_id', selectedRows.map((row) => row.id))
          .eq('company_id', currentCompany!.id)
          .order('sort_order', { ascending: true });

        if (noteError && !isMissingRfpPlanPageNotesTableError(noteError)) throw noteError;

        if (!noteError) {
          calloutsByPageId = new Map<string, RfpPlanPageNoteViewerNote[]>();
          ((noteRows || []) as any[]).forEach((row) => {
            const key = String(row.rfp_plan_page_id);
            const list = calloutsByPageId.get(key) || [];
            list.push({
              id: String(row.id),
              shape_type: row.shape_type === 'ellipse' ? 'ellipse' : 'rect',
              x: Number(row.x || 0),
              y: Number(row.y || 0),
              width: Number(row.width || 0),
              height: Number(row.height || 0),
              note_text: row.note_text || '',
            });
            calloutsByPageId.set(key, list);
          });
        }
      }

      setPlanPages(
        selectedRows.map((row) => ({
          ...row,
          callouts: calloutsByPageId.get(row.id) || [],
        })),
      );
    } catch (error) {
      console.error('Error loading RFP plan pages:', error);
      setPlanPages([]);
    }
  };

  const loadIssuePackage = async () => {
    try {
      const { data: packageRow, error: packageError } = await supabase
        .from('rfp_issue_packages' as any)
        .select('id, name, description')
        .eq('rfp_id', id)
        .eq('company_id', currentCompany!.id)
        .maybeSingle();

      if (packageError) throw packageError;
      if (!packageRow?.id) {
        setIssuePackage(null);
        return;
      }

      const { data: itemRows, error: itemError } = await supabase
        .from('rfp_issue_package_items' as any)
        .select('plan_id, sort_order, plan:job_plans(id, plan_name, plan_number, file_url)')
        .eq('package_id', packageRow.id)
        .eq('company_id', currentCompany!.id)
        .order('sort_order', { ascending: true });

      if (itemError) throw itemError;
      setIssuePackage({
        id: String(packageRow.id),
        name: String(packageRow.name || 'Issued Package'),
        description: packageRow.description || null,
        plans: ((itemRows || []) as any[]).map((row) => ({
          plan_id: String(row.plan_id),
          plan_name: String(row.plan?.plan_name || 'Plan Set'),
          plan_number: row.plan?.plan_number || null,
          file_url: row.plan?.file_url || null,
        })),
      });
    } catch (error) {
      console.error('Error loading RFP issue package:', error);
      setIssuePackage(null);
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStoragePathFromUrl = (url: string): string | null => {
    if (!url) return null;
    if (!url.startsWith('http')) return url;
    const marker = '/storage/v1/object/public/company-files/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.substring(idx + marker.length));
  };

  const handleDownloadAttachedPlanPagesPdf = async () => {
    if (!planPages.length) return;
    try {
      await downloadRfpPlanPagesPdf({
        fileName: `${rfp?.rfp_number || 'RFP'}_attached_plan_pages.pdf`,
        pages: planPages.map((page) => ({
          plan_id: page.plan_id,
          plan_name: page.plan_name,
          plan_file_url: page.plan_file_url,
          page_number: page.page_number,
          sheet_number: page.sheet_number,
          page_title: page.page_title,
        })),
      });
    } catch (error: any) {
      console.error('Error downloading attached plan pages PDF:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to download attached plan pages PDF',
        variant: 'destructive',
      });
    }
  };

  const handleUploadDrawingFiles = async (files: File[] | FileList) => {
    const uploadFiles = Array.from(files || []);
    if (!uploadFiles.length || !currentCompany?.id || !user?.id || !id) return;

    try {
      setUploadingDrawings(true);
      const rows = [];
      for (const file of uploadFiles) {
        const storagePath = `rfp-drawings/${currentCompany.id}/${id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('company-files')
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        rows.push({
          rfp_id: id,
          company_id: currentCompany.id,
          file_name: file.name,
          file_url: getStoragePathForDb('company-files', storagePath),
          file_size: file.size,
          file_type: file.type || null,
          uploaded_by: user.id,
        });
      }

      const { error: insertError } = await supabase.from('rfp_attachments').insert(rows);
      if (insertError) throw insertError;

      toast({
        title: 'Drawings uploaded',
        description: `${uploadFiles.length} drawing file(s) uploaded`,
      });
      await loadAttachments();
    } catch (error: any) {
      console.error('Error uploading drawings:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload drawings',
        variant: 'destructive'
      });
    } finally {
      setUploadingDrawings(false);
    }
  };

  const handleUploadDrawings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !currentCompany?.id || !user?.id || !id) return;

    try {
      await handleUploadDrawingFiles(files);
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAttachment = async (attachment: RfpAttachment) => {
    try {
      setDeletingAttachmentId(attachment.id);
      const { error: deleteError } = await supabase
        .from('rfp_attachments')
        .delete()
        .eq('id', attachment.id)
        .eq('rfp_id', id);
      if (deleteError) throw deleteError;

      const storagePath = getStoragePathFromUrl(attachment.file_url);
      if (storagePath) {
        await supabase.storage.from('company-files').remove([storagePath]);
      }

      toast({
        title: 'Deleted',
        description: 'Drawing removed'
      });
      await loadAttachments();
    } catch (error: any) {
      console.error('Error deleting drawing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove drawing',
        variant: 'destructive'
      });
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const sortedRfpTargets = [...rfpTargets].sort((a, b) => {
    const aMatch = a.job_id && a.job_id === rfp?.job_id;
    const bMatch = b.job_id && b.job_id === rfp?.job_id;
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    return `${a.rfp_number} ${a.title}`.localeCompare(`${b.rfp_number} ${b.title}`);
  });

  const copyAttachmentToRfp = async () => {
    if (!attachmentToCopy || !selectedTargetRfpId || !currentCompany?.id || !user?.id) return;
    try {
      setCopyingAttachmentToRfp(true);
      const { data: existingRows, error: existingError } = await supabase
        .from('rfp_attachments')
        .select('id')
        .eq('rfp_id', selectedTargetRfpId)
        .eq('file_url', attachmentToCopy.file_url)
        .limit(1);
      if (existingError) throw existingError;
      if ((existingRows || []).length > 0) {
        toast({ title: 'Already attached', description: 'This file is already attached to the selected RFP.' });
        setRfpAttachDialogOpen(false);
        setSelectedTargetRfpId('');
        setAttachmentToCopy(null);
        return;
      }

      const { error } = await supabase.from('rfp_attachments').insert({
        rfp_id: selectedTargetRfpId,
        company_id: currentCompany.id,
        file_name: attachmentToCopy.file_name,
        file_url: attachmentToCopy.file_url,
        file_size: attachmentToCopy.file_size ?? null,
        file_type: attachmentToCopy.file_type ?? null,
        uploaded_by: user.id,
      });
      if (error) throw error;
      const target = rfpTargets.find((rfp) => rfp.id === selectedTargetRfpId);
      if (target) {
        setRfpAttachmentRefsByUrl((prev) => {
          const current = prev[attachmentToCopy.file_url] || [];
          if (current.some((entry) => entry.rfp_id === target.id)) return prev;
          return {
            ...prev,
            [attachmentToCopy.file_url]: [
              ...current,
              {
                rfp_id: target.id,
                rfp_number: target.rfp_number,
                title: target.title,
                status: target.status,
                job_id: target.job_id,
                job_name: null,
              },
            ].sort((a, b) => `${a.rfp_number} ${a.title}`.localeCompare(`${b.rfp_number} ${b.title}`)),
          };
        });
      }
      toast({ title: 'Attached to RFP', description: 'Attachment copied to the selected RFP.' });
      setRfpAttachDialogOpen(false);
      setSelectedTargetRfpId('');
      setAttachmentToCopy(null);
    } catch (error: any) {
      console.error('Error copying attachment to RFP:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to attach file to RFP', variant: 'destructive' });
    } finally {
      setCopyingAttachmentToRfp(false);
    }
  };

  const getAttachmentOwnerName = (attachment: RfpAttachment): string => {
    const owner = ownerProfilesById[attachment.uploaded_by];
    return (
      owner?.display_name ||
      [owner?.first_name, owner?.last_name].filter(Boolean).join(' ') ||
      'Unknown user'
    );
  };

  const getRfpAttachmentRefsForUrl = (fileUrl: string) => rfpAttachmentRefsByUrl[fileUrl] || [];
  const getRfpAttachmentCountForUrl = (fileUrl: string) => getRfpAttachmentRefsForUrl(fileUrl).length;

  const openRfpLinksDialog = (title: string, refs: RfpAttachmentReference[]) => {
    if (refs.length === 0) return;
    setRfpLinksDialogTitle(title);
    setRfpLinksDialogRefs(refs);
    setRfpLinksDialogOpen(true);
  };

  const saveAttachmentName = async (attachmentId: string) => {
    const nextName = editingAttachmentName.trim();
    if (!nextName) {
      setEditingAttachmentId(null);
      return;
    }
    try {
      setSavingAttachmentNameId(attachmentId);
      const { error } = await supabase
        .from('rfp_attachments')
        .update({ file_name: nextName } as any)
        .eq('id', attachmentId)
        .eq('rfp_id', id);
      if (error) throw error;
      setAttachments((prev) => prev.map((row) => (row.id === attachmentId ? { ...row, file_name: nextName } : row)));
    } catch (error: any) {
      console.error('Error renaming drawing attachment:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to rename drawing',
        variant: 'destructive',
      });
    } finally {
      setSavingAttachmentNameId(null);
      setEditingAttachmentId(null);
    }
  };

  const openAttachmentPreview = async (attachment: RfpAttachment) => {
    const resolved = await resolveStorageUrl('company-files', attachment.file_url);
    if (!resolved) {
      toast({
        title: 'Error',
        description: 'Failed to open drawing preview',
        variant: 'destructive',
      });
      return;
    }
    setPreviewAttachmentId(attachment.id);
    setPreviewAttachmentUrl(resolved);
  };

  const handleInviteVendors = async () => {
    if (selectedVendors.length === 0) {
      toast({
        title: 'No vendors selected',
        description: 'Please select at least one vendor to invite',
        variant: 'destructive'
      });
      return;
    }

    try {
      setInviting(true);

      const invitations = selectedVendors.map(vendorId => ({
        rfp_id: id,
        vendor_id: vendorId,
        company_id: currentCompany!.id,
        response_status: 'pending'
      }));

      const { error } = await supabase
        .from('rfp_invited_vendors')
        .insert(invitations);

      if (error) throw error;

      if (rfp?.job_id) {
        const { error: accessError } = await supabase
          .from('vendor_job_access' as any)
          .upsert(
            selectedVendors.map((vendorId) => ({
              vendor_id: vendorId,
              job_id: rfp.job_id,
              created_by: user?.id || null,
              ...BIDDER_VENDOR_ACCESS_DEFAULTS,
            })),
            {
              onConflict: 'vendor_id,job_id',
              ignoreDuplicates: false,
            }
          );

        if (accessError) throw accessError;
      }

      // Send email invitations to each vendor
      const emailPromises = selectedVendors.map(async (vendorId) => {
        const vendor = vendors.find(v => v.id === vendorId);
        if (!vendor?.email) return null;

        try {
          try {
            const { data: portalInviteData, error: portalInviteError } = await supabase.functions.invoke('send-vendor-invite', {
              body: {
                vendorId: vendor.id,
                vendorName: vendor.name,
                vendorEmail: vendor.email,
                companyId: currentCompany!.id,
                companyName: currentCompany!.name,
                invitedBy: user?.id,
                baseUrl: getPublicAuthOrigin(),
              }
            });

            if (portalInviteError) {
              console.error(`Failed to send vendor portal invite to ${vendor.email}:`, portalInviteError);
            } else if (portalInviteData?.error && !String(portalInviteData.error).toLowerCase().includes('active invitation already exists')) {
              console.error(`Vendor portal invite returned an error for ${vendor.email}:`, portalInviteData.error);
            }
          } catch (portalInviteErr) {
            console.error(`Failed to ensure vendor portal invite for ${vendor.email}:`, portalInviteErr);
          }

          const { error: emailError } = await supabase.functions.invoke('send-rfp-invite', {
            body: {
              rfpId: id,
              rfpTitle: rfp?.title || '',
              rfpNumber: rfp?.rfp_number || '',
              dueDate: rfp?.due_date,
              vendorId: vendor.id,
              vendorName: vendor.name,
              vendorEmail: vendor.email,
              companyId: currentCompany!.id,
              companyName: currentCompany!.name,
              scopeOfWork: rfp?.scope_of_work,
              baseUrl: getPublicAuthOrigin(),
            }
          });
          
          if (emailError) {
            console.error(`Failed to send email to ${vendor.email}:`, emailError);
          }
          return { vendorId, success: !emailError };
        } catch (err) {
          console.error(`Failed to send email to ${vendor.email}:`, err);
          return { vendorId, success: false };
        }
      });

      await Promise.all(emailPromises);

      toast({
        title: 'Success',
        description: `${selectedVendors.length} vendor(s) invited to bid`
      });

      setInviteDialogOpen(false);
      setSelectedVendors([]);
      setQuickInviteForm({ name: '', email: '' });
      setQuickInviteVendorType('Contractor');
      loadInvitedVendors();
    } catch (error: any) {
      console.error('Error inviting vendors:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to invite vendors',
        variant: 'destructive'
      });
    } finally {
      setInviting(false);
    }
  };

  const handleQuickInviteVendor = async () => {
    if (!currentCompany?.id || !id) return;

    const vendorName = quickInviteForm.name.trim();
    const vendorEmail = quickInviteForm.email.trim().toLowerCase();

    if (!vendorName) {
      toast({
        title: 'Vendor name required',
        description: 'Enter the vendor or subcontractor company name.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidEmail(vendorEmail)) {
      toast({
        title: 'Valid email required',
        description: 'Enter a valid email address to send the invite.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCreatingQuickInvite(true);

      let vendorRecord: Vendor | null = null;

      const { data: existingVendor, error: existingVendorError } = await supabase
        .from('vendors')
        .select('id, name, email')
        .eq('company_id', currentCompany.id)
        .ilike('email', vendorEmail)
        .limit(1)
        .maybeSingle();

      if (existingVendorError) throw existingVendorError;

      if (existingVendor) {
        vendorRecord = {
          id: existingVendor.id,
          name: existingVendor.name,
          email: existingVendor.email,
        };
      } else {
        const { data: insertedVendor, error: insertVendorError } = await supabase
          .from('vendors')
          .insert({
            company_id: currentCompany.id,
            name: vendorName,
            email: vendorEmail,
            contact_person: vendorName,
            is_active: true,
            vendor_type: quickInviteVendorType,
          })
          .select('id, name, email')
          .single();

        if (insertVendorError) throw insertVendorError;

        vendorRecord = {
          id: insertedVendor.id,
          name: insertedVendor.name,
          email: insertedVendor.email,
        };
      }

      const { data: existingInviteRow, error: existingInviteRowError } = await supabase
        .from('rfp_invited_vendors')
        .select('id')
        .eq('rfp_id', id)
        .eq('vendor_id', vendorRecord.id)
        .limit(1)
        .maybeSingle();

      if (existingInviteRowError) throw existingInviteRowError;

      if (!existingInviteRow) {
        const { error: inviteInsertError } = await supabase
          .from('rfp_invited_vendors')
          .insert({
            rfp_id: id,
            vendor_id: vendorRecord.id,
            company_id: currentCompany.id,
            response_status: 'pending',
          });

        if (inviteInsertError) throw inviteInsertError;
      }

      if (rfp?.job_id) {
        const { error: accessError } = await supabase
          .from('vendor_job_access' as any)
          .upsert(
            {
              vendor_id: vendorRecord.id,
              job_id: rfp.job_id,
              created_by: user?.id || null,
              ...BIDDER_VENDOR_ACCESS_DEFAULTS,
            },
            {
              onConflict: 'vendor_id,job_id',
              ignoreDuplicates: false,
            }
          );

        if (accessError) throw accessError;
      }

      let portalInviteNotice: string | null = null;
      try {
        const { data: portalInviteData, error: portalInviteError } = await supabase.functions.invoke('send-vendor-invite', {
          body: {
            vendorId: vendorRecord.id,
            vendorName: vendorRecord.name,
            vendorEmail,
            companyId: currentCompany.id,
            companyName: currentCompany.name,
            invitedBy: user?.id,
            baseUrl: window.location.origin,
          }
        });

        if (portalInviteError) {
          console.error('Error sending vendor portal invite:', portalInviteError);
          portalInviteNotice = 'The bid invite was sent, but the vendor portal invitation could not be emailed yet.';
        } else if (portalInviteData?.error) {
          portalInviteNotice = portalInviteData.error;
        }
      } catch (portalInviteError) {
        console.error('Error sending vendor portal invite:', portalInviteError);
        portalInviteNotice = 'The bid invite was sent, but the vendor portal invitation could not be emailed yet.';
      }

      try {
        const { error: rfpInviteError } = await supabase.functions.invoke('send-rfp-invite', {
          body: {
            rfpId: id,
            rfpTitle: rfp?.title || '',
            rfpNumber: rfp?.rfp_number || '',
            dueDate: rfp?.due_date,
            vendorId: vendorRecord.id,
            vendorName: vendorRecord.name,
            vendorEmail,
            companyId: currentCompany.id,
            companyName: currentCompany.name,
            scopeOfWork: rfp?.scope_of_work,
            baseUrl: getPublicAuthOrigin(),
          }
        });

        if (rfpInviteError) throw rfpInviteError;
      } catch (rfpInviteError: any) {
        console.error('Error sending RFP invite email:', rfpInviteError);
        toast({
          title: 'Vendor added',
          description: 'The vendor was added and linked to this RFP, but the bid email failed to send.',
          variant: 'destructive',
        });
        await Promise.all([loadVendors(), loadInvitedVendors()]);
        return;
      }

      toast({
        title: existingVendor ? 'Vendor invited' : 'Vendor added and invited',
        description: portalInviteNotice || `${vendorRecord.name} can now sign up and access this job's bidding workflow.`,
      });

      setQuickInviteForm({ name: '', email: '' });
      setQuickInviteVendorType('Contractor');
      setVendorSearch('');
      setActiveLetter(null);
      await Promise.all([loadVendors(), loadInvitedVendors()]);
    } catch (error: any) {
      console.error('Error quick inviting vendor:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to add and invite vendor',
        variant: 'destructive',
      });
    } finally {
      setCreatingQuickInvite(false);
    }
  };

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => 
      prev.includes(vendorId) 
        ? prev.filter(id => id !== vendorId)
        : [...prev, vendorId]
    );
  };

  const getAvailableVendors = () => {
    const invitedIds = invitedVendors.map(iv => iv.vendor_id);
    return vendors.filter(v => !invitedIds.includes(v.id));
  };

  const getFilteredVendors = () => {
    let filtered = getAvailableVendors();
    
    // Apply search filter
    if (vendorSearch.trim()) {
      const searchLower = vendorSearch.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(searchLower) ||
        (v.email && v.email.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply alphabet filter
    if (activeLetter) {
      filtered = filtered.filter(v => 
        v.name.toUpperCase().startsWith(activeLetter)
      );
    }
    
    return filtered;
  };

  const handleResendInvite = async (inv: InvitedVendor) => {
    if (!inv.vendor?.email || !rfp) return;

    try {
      setResendingInvite(inv.id);

      const { error: emailError } = await supabase.functions.invoke('send-rfp-invite', {
        body: {
          rfpId: id,
          rfpTitle: rfp.title,
          rfpNumber: rfp.rfp_number,
          dueDate: rfp.due_date,
          vendorId: inv.vendor.id,
          vendorName: inv.vendor.name,
          vendorEmail: inv.vendor.email,
          companyId: currentCompany!.id,
          companyName: currentCompany!.name,
          scopeOfWork: rfp.scope_of_work,
          baseUrl: getPublicAuthOrigin(),
        }
      });

      if (emailError) throw emailError;

      toast({
        title: 'Invitation Resent',
        description: `Bid invitation resent to ${inv.vendor.name}`
      });
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend invitation',
        variant: 'destructive'
      });
    } finally {
      setResendingInvite(null);
    }
  };

  const renderBidInviteEmailStatusBadge = (inv: InvitedVendor) => {
    if (inv.email_bounced_at) {
      return <Badge variant="destructive">Bounced</Badge>;
    }
    if (inv.email_opened_at) {
      return <Badge variant="info">Opened</Badge>;
    }
    if (inv.email_delivered_at || inv.email_status === 'delivered') {
      return <Badge variant="info">Received</Badge>;
    }
    if (inv.email_sent_at || inv.email_status === 'sent') {
      return <Badge variant="outline">Sent</Badge>;
    }
    return null;
  };

  const getAvailableLetters = () => {
    const available = getAvailableVendors();
    const letters = new Set<string>();
    available.forEach(v => {
      const firstLetter = v.name.charAt(0).toUpperCase();
      if (/[A-Z]/.test(firstLetter)) {
        letters.add(firstLetter);
      }
    });
    return Array.from(letters).sort();
  };

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const updateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('rfps')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      setRfp(prev => prev ? { ...prev, status: newStatus } : null);
      toast({
        title: 'Success',
        description: `RFP status updated to ${newStatus}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      issued: { variant: 'default', label: 'Issued' },
      closed: { variant: 'outline', label: 'Closed' },
      awarded: { variant: 'default', label: 'Awarded' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getBidStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      submitted: { variant: 'secondary', label: 'Submitted' },
      verbal_quote: { variant: 'outline', label: 'Verbal Quote' },
      questions_pending: { variant: 'outline', label: 'Questions Pending' },
      waiting_for_revisions: { variant: 'outline', label: 'Waiting for Revisions' },
      subcontract_review: { variant: 'outline', label: 'Reviewing Subcontract' },
      shortlisted: { variant: 'default', label: 'Shortlisted' },
      accepted: { variant: 'default', label: 'Accepted' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      retracted: { variant: 'destructive', label: 'Retracted' },
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const priceCriteriaIds = new Set(
    effectiveCriteria.filter((criterion) => isPriceCriterion(criterion.criterion_name)).map((criterion) => criterion.id),
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="loading-dots">Loading</span></div>;
  }

  if (!rfp) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">RFP Not Found</h2>
        <Button className="mt-4" onClick={() => navigate('/construction/rfps')}>
          Back to RFPs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 md:px-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/construction/rfps')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{rfp.rfp_number}</h1>
              {getStatusBadge(rfp.status)}
            </div>
            <p className="text-lg text-muted-foreground">{rfp.title}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={rfp.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="awarded">Awarded</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate(`/construction/rfps/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setInviteDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invite Vendors
          </Button>
          <Button variant="outline" onClick={() => navigate(`/construction/rfps/${id}/compare`)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Detailed Analysis
          </Button>
        </div>
      </div>

      {/* Invite Vendors Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open);
        if (!open) {
          setVendorSearch('');
          setActiveLetter(null);
          setSelectedVendors([]);
          setQuickInviteForm({ name: '', email: '' });
          setQuickInviteVendorType('Contractor');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite Vendors to Bid</DialogTitle>
            <DialogDescription>
              Select vendors to invite to submit bids for this RFP
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {getAvailableVendors().length === 0 ? (
              <div className="py-4 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">
                  {vendors.length === 0
                    ? "No saved vendors yet. Use quick add below to invite one now."
                    : "All saved vendors have already been invited. Use quick add below for someone new."}
                </p>
              </div>
            ) : (
              <>
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={vendorSearch}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setActiveLetter(null); // Clear letter filter when searching
                  }}
                  className="pl-9"
                />
              </div>

              {/* Alphabet Filter */}
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={activeLetter === null ? "default" : "ghost"}
                  size="sm"
                  className="h-7 w-7 p-0 text-xs"
                  onClick={() => {
                    setActiveLetter(null);
                    setVendorSearch('');
                  }}
                >
                  All
                </Button>
                {alphabet.map(letter => {
                  const availableLetters = getAvailableLetters();
                  const hasVendors = availableLetters.includes(letter);
                  return (
                    <Button
                      key={letter}
                      variant={activeLetter === letter ? "default" : "ghost"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      disabled={!hasVendors}
                      onClick={() => {
                        setActiveLetter(letter);
                        setVendorSearch('');
                      }}
                    >
                      {letter}
                    </Button>
                  );
                })}
              </div>

              {/* Vendor List */}
              <ScrollArea className="max-h-[250px] pr-4">
                <div className="space-y-2">
                  {getFilteredVendors().length === 0 ? (
                    <div className="py-4 text-center text-muted-foreground">
                      No vendors found matching your filters
                    </div>
                  ) : (
                    getFilteredVendors().map(vendor => (
                      <div 
                        key={vendor.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleVendorSelection(vendor.id)}
                      >
                        <Checkbox 
                          checked={selectedVendors.includes(vendor.id)}
                          onCheckedChange={() => toggleVendorSelection(vendor.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{vendor.name}</p>
                          {vendor.email && (
                            <p className="text-sm text-muted-foreground truncate">{vendor.email}</p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              </>
            )}

            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">Quick Add Vendor</h3>
                <p className="text-xs text-muted-foreground">
                  Invite a subcontractor even if they are not in your address book yet. They can create their own account from the invite.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quick-vendor-name">Vendor Name</Label>
                  <Input
                    id="quick-vendor-name"
                    placeholder="Vendor or subcontractor"
                    value={quickInviteForm.name}
                    onChange={(e) => setQuickInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-vendor-email">Email</Label>
                  <Input
                    id="quick-vendor-email"
                    type="email"
                    placeholder="name@company.com"
                    value={quickInviteForm.email}
                    onChange={(e) => setQuickInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-vendor-type">Vendor Type</Label>
                <Select value={quickInviteVendorType} onValueChange={setQuickInviteVendorType}>
                  <SelectTrigger id="quick-vendor-type">
                    <SelectValue placeholder="Select vendor type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contractor">Contractor</SelectItem>
                    <SelectItem value="Supplier">Supplier</SelectItem>
                    <SelectItem value="Design Professional">Design Professional</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleQuickInviteVendor}
                  disabled={creatingQuickInvite}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {creatingQuickInvite ? 'Adding & Inviting...' : 'Quick Add & Invite'}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteVendors} 
              disabled={selectedVendors.length === 0 || inviting}
            >
              <Send className="h-4 w-4 mr-2" />
              {inviting ? 'Inviting...' : `Invite ${selectedVendors.length > 0 ? `(${selectedVendors.length})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {rfp.job && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-sm text-muted-foreground">Job</p>
                  <p className="font-medium">{rfp.job.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Issue Date</p>
                <p className="font-medium">
                  {rfp.issue_date ? format(new Date(rfp.issue_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="font-medium">
                  {rfp.due_date ? format(new Date(rfp.due_date), 'MMM d, yyyy') : 'Not set'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Bids Received</p>
                <p className="font-medium">{bids.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          const next = new URLSearchParams(searchParams);
          if (value === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', value);
          }
          setSearchParams(next, { replace: true });
        }}
        className="space-y-3"
      >
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invited">Invited ({invitedVendors.length})</TabsTrigger>
          <TabsTrigger value="bids">Bids ({bids.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.description ? (
                <p className="whitespace-pre-wrap">{rfp.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Scope of Work</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.scope_of_work ? (
                <p className="whitespace-pre-wrap">{rfp.scope_of_work}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No scope of work provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logistics Details</CardTitle>
            </CardHeader>
            <CardContent>
              {rfp.logistics_details ? (
                <p className="whitespace-pre-wrap">{rfp.logistics_details}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No logistics details provided yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plans</CardTitle>
              <CardDescription>
                Key plan sheets and plan-set pages attached to this RFP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planPages.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No plan pages attached to this RFP yet.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleDownloadAttachedPlanPagesPdf}>
                      Download Attached Pages PDF
                    </Button>
                  </div>
                  {planPages.map((page) => (
                    <div key={page.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                      {page.thumbnail_url ? (
                        <img
                          src={page.thumbnail_url}
                          alt={page.page_title || page.sheet_number || `Page ${page.page_number}`}
                          className="h-20 w-14 rounded border object-cover shrink-0 bg-background"
                        />
                      ) : (
                        <div className="h-20 w-14 rounded border shrink-0 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
                          P{page.page_number}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">
                            {page.sheet_number || `Page ${page.page_number}`}
                          </p>
                          <Badge variant="outline">{page.plan_name}</Badge>
                          {page.plan_number ? <Badge variant="outline">#{page.plan_number}</Badge> : null}
                          {page.discipline ? <Badge variant="secondary">{page.discipline}</Badge> : null}
                          {page.is_primary ? <Badge>Primary</Badge> : null}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {page.page_title || 'Untitled sheet'}
                        </p>
                        {page.note ? (
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{page.note}</p>
                        ) : null}
                        {page.callouts.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {page.callouts.map((callout, index) => (
                              <Button
                                key={callout.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => setPreviewPlanPage(page)}
                              >
                                See Note {index + 1}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {page.callouts.length > 0 ? (
                          <Button variant="outline" size="sm" onClick={() => setPreviewPlanPage(page)}>
                            Preview Notes
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/construction/plans/${page.plan_id}?page=${page.page_number}`)}
                        >
                          Open Page
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Issued Package</CardTitle>
              <CardDescription>
                Official plan set package attached to this RFP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!issuePackage ? (
                <p className="text-sm text-muted-foreground">
                  No issued package is attached to this RFP yet.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold">{issuePackage.name}</p>
                    {issuePackage.description ? (
                      <p className="text-sm text-muted-foreground">{issuePackage.description}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {issuePackage.plans.map((plan) => (
                      <div key={plan.plan_id} className="flex items-center justify-between rounded-md border p-3">
                        <div className="min-w-0">
                          <p className="font-medium">{plan.plan_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {plan.plan_number ? `Plan Set #${plan.plan_number}` : 'No plan set number'}
                          </p>
                        </div>
                        {plan.file_url ? (
                          <Button variant="outline" size="sm" onClick={() => window.open(plan.file_url || '', '_blank', 'noopener,noreferrer')}>
                            Open Set
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Drawings</CardTitle>
                <CardDescription>Upload and manage plan sheets and drawing files for this RFP</CardDescription>
              </div>
              <input
                ref={drawingsInputRef}
                type="file"
                multiple
                accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp"
                onChange={handleUploadDrawings}
                disabled={uploadingDrawings}
                className="hidden"
              />
            </CardHeader>
            <CardContent>
              <div
                className={`relative rounded-md border px-3 py-3 pb-12 transition-colors ${
                  isDrawingsDragOver ? 'border-primary bg-primary/5 ring-1 ring-primary/50' : 'border-border'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDrawingsDragOver(false);
                  if (uploadingDrawings) return;
                  const droppedFiles = Array.from(e.dataTransfer.files || []);
                  if (droppedFiles.length > 0) {
                    void handleUploadDrawingFiles(droppedFiles);
                  }
                }}
                onClick={() => !uploadingDrawings && drawingsInputRef.current?.click()}
              >
                {attachments.length === 0 ? (
                  <p className="py-8 text-sm text-muted-foreground text-center">
                    No drawings uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-[minmax(220px,2fr)_170px_140px_110px_minmax(180px,1.4fr)_72px] gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <span>Name</span>
                      <span>Owner</span>
                      <span>Created</span>
                      <span className="text-right">Size</span>
                      <span>Comments</span>
                      <span className="text-right">Actions</span>
                    </div>
                    {attachments.map((attachment) => {
                      const owner = ownerProfilesById[attachment.uploaded_by];
                      const ownerName = getAttachmentOwnerName(attachment);
                      const ownerInitials =
                        `${owner?.first_name?.[0] || ''}${owner?.last_name?.[0] || ''}`.trim() ||
                        ownerName.charAt(0).toUpperCase();
                      return (
                        <div
                          key={attachment.id}
                          className="grid grid-cols-[minmax(220px,2fr)_170px_140px_110px_minmax(180px,1.4fr)_72px] items-center gap-2 rounded-md border px-2 py-1.5 hover:bg-muted/40 cursor-pointer"
                          onClick={() => void openAttachmentPreview(attachment)}
                        >
                          <div className="min-w-0">
                            {editingAttachmentId === attachment.id ? (
                              <Input
                                autoFocus
                                value={editingAttachmentName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setEditingAttachmentName(e.target.value)}
                                onBlur={() => void saveAttachmentName(attachment.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void saveAttachmentName(attachment.id);
                                  if (e.key === 'Escape') setEditingAttachmentId(null);
                                }}
                                disabled={savingAttachmentNameId === attachment.id}
                                className="h-7 text-sm"
                              />
                            ) : (
                              <button
                                type="button"
                                className="max-w-full truncate text-left text-sm font-medium hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAttachmentId(attachment.id);
                                  setEditingAttachmentName(attachment.file_name);
                                }}
                              >
                                {attachment.file_name}
                              </button>
                            )}
                            {getRfpAttachmentCountForUrl(attachment.file_url) > 0 ? (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRfpLinksDialog(`${attachment.file_name} linked RFPs`, getRfpAttachmentRefsForUrl(attachment.file_url));
                                  }}
                                >
                                  <Badge variant="secondary" className="text-[10px]">
                                    {getRfpAttachmentCountForUrl(attachment.file_url)} RFP link{getRfpAttachmentCountForUrl(attachment.file_url) === 1 ? '' : 's'}
                                  </Badge>
                                </button>
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-6 w-6 shrink-0">
                              <AvatarImage src={owner?.avatar_url || undefined} />
                              <AvatarFallback>{ownerInitials}</AvatarFallback>
                            </Avatar>
                            <span className="truncate text-sm">{ownerName}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{format(new Date(attachment.uploaded_at), 'MMM d, yyyy')}</span>
                          <span className="text-sm text-muted-foreground text-right tabular-nums">{formatFileSize(attachment.file_size) || '0 MB'}</span>
                          <Input
                            value={attachmentComments[attachment.id] || ''}
                            placeholder="Add comment..."
                            className="h-7 text-sm"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setAttachmentComments((prev) => ({ ...prev, [attachment.id]: e.target.value }))
                            }
                          />
                          <div className="flex justify-end">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAttachmentToCopy(attachment);
                                  setSelectedTargetRfpId('');
                                  setRfpAttachDialogOpen(true);
                                }}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={deletingAttachmentId === attachment.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteAttachment(attachment);
                                }}
                              >
                                {deletingAttachmentId === attachment.id ? (
                                  <span className="loading-dots text-xs">Loading</span>
                                ) : (
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="absolute bottom-3 left-0 right-0 text-center text-sm text-muted-foreground">
                  {uploadingDrawings ? (
                    <span className="loading-dots">Loading</span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <span>Drag and drop drawings/specs here, or</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          drawingsInputRef.current?.click();
                        }}
                      >
                        choose files to upload
                      </Button>
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invited" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Invited Vendors</h3>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite More
            </Button>
          </div>
          
          {invitedVendors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Vendors Invited</h3>
                <p className="text-muted-foreground mb-4">Invite vendors to submit bids for this RFP</p>
                <Button onClick={() => setInviteDialogOpen(true)}>
                  <Send className="h-4 w-4 mr-2" />
                  Invite Vendors
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-2">Vendor</TableHead>
                    <TableHead className="py-2">Email</TableHead>
                    <TableHead className="py-2">Invited</TableHead>
                    <TableHead className="py-2">Status</TableHead>
                    <TableHead className="py-2 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitedVendors.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="py-2">
                        <div className="space-y-1">
                          <div className="font-medium">{inv.vendor?.name}</div>
                          {inv.vendor?.vendor_type ? (
                            <div className="text-xs text-muted-foreground">{inv.vendor.vendor_type}</div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="py-2">{inv.vendor?.email || '-'}</TableCell>
                      <TableCell className="py-2">{format(new Date(inv.invited_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="py-2">
                        <div className="flex flex-wrap gap-2">
                          {renderBidInviteEmailStatusBadge(inv)}
                          {inv.portal_account_created ? (
                            <Badge variant="success">Account Created</Badge>
                          ) : inv.portal_invite_pending ? (
                            <Badge variant="warning">Portal Invite Pending</Badge>
                          ) : (
                            <Badge variant="outline">Portal Setup Needed</Badge>
                          )}
                          {inv.last_viewed_at ? (
                            <Badge variant="info">Viewed RFP</Badge>
                          ) : null}
                          <Badge variant={inv.response_status === 'bid_submitted' ? 'success' : 'warning'}>
                            {inv.response_status === 'pending' || !inv.response_status ? 'Bid Pending' : inv.response_status === 'bid_submitted' ? 'Bid Submitted' : inv.response_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        {inv.vendor?.email && inv.response_status !== 'bid_submitted' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvite(inv)}
                            disabled={resendingInvite === inv.id}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {resendingInvite === inv.id ? 'Sending...' : 'Resend'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bids" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Bids</CardTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bid
                </Button>
                <Button variant="outline" onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Criteria
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {bids.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Bids Yet</h3>
                  <p className="text-muted-foreground mb-4">No vendors have submitted bids for this RFP</p>
                  <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Bid
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="space-y-2">
                      {analyzedSortedBids
                        .map((bid) => ({ ...bid, finalTotal: computeBidFinalTotal(bid), weighted: Number(bid.weighted_total || 0) }))
                        .sort((a, b) => a.finalTotal - b.finalTotal)
                        .map((bid, index, rows) => {
                          const maxFinal = Math.max(...rows.map((row) => row.finalTotal), 1);
                          const minFinal = Math.min(...rows.map((row) => row.finalTotal));
                          const maxWeighted = Math.max(...rows.map((row) => row.weighted), 1);
                          const amountWidth =
                            maxFinal === minFinal
                              ? 100
                              : Math.max(((maxFinal - bid.finalTotal) / (maxFinal - minFinal)) * 100, 6);
                          const weightedWidth = Math.max((bid.weighted / maxWeighted) * 100, bid.weighted > 0 ? 6 : 0);
                          return (
                            <div key={`bar-${bid.id}`} className="grid grid-cols-[minmax(140px,180px)_1fr_220px] items-center gap-3">
                              <div className="w-40 truncate text-sm">{bid.vendor.name}</div>
                              <div className="space-y-1">
                                <div className="h-4 w-full rounded bg-muted overflow-hidden">
                                  <div className="h-full bg-primary/70 px-2 text-[10px] font-medium text-primary-foreground flex items-center justify-end truncate" style={{ width: `${amountWidth}%` }}>
                                    ${bid.finalTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                  </div>
                                </div>
                                <div className="h-4 w-full rounded bg-muted overflow-hidden">
                                  <div className="h-full bg-emerald-600/80 px-2 text-[10px] font-medium text-white flex items-center justify-end truncate" style={{ width: `${weightedWidth}%` }}>
                                    {bid.weighted.toFixed(1)}
                                  </div>
                                </div>
                              </div>
                              <div className="w-[220px] text-left">
                                <div className="text-sm tabular-nums inline-flex items-center gap-2">
                                  ${bid.finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {index === 0 && <Badge className="bg-emerald-600 hover:bg-emerald-600">Lowest</Badge>}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                  Score {bid.weighted.toFixed(1)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded bg-primary/70" />
                        Price Position (lower amount = higher bar)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 rounded bg-emerald-600/80" />
                        Weighted Score
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 px-3 font-semibold"
                              onClick={() => toggleBidSort('vendor')}
                            >
                              Vendor{getSortIndicator('vendor')}
                            </Button>
                          </TableHead>
                          <TableHead className="py-2">Version</TableHead>
                          <TableHead className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 px-3 font-semibold"
                              onClick={() => toggleBidSort('bid_amount')}
                            >
                              Final Total{getSortIndicator('bid_amount')}
                            </Button>
                          </TableHead>
                          <TableHead className="py-2 min-w-[240px]">Inclusions / Exclusions Notes</TableHead>
                          <TableHead className="py-2">Status</TableHead>
                          <TableHead className="py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-8 px-3 font-semibold"
                              onClick={() => toggleBidSort('submitted_at')}
                            >
                              Submitted{getSortIndicator('submitted_at')}
                            </Button>
                          </TableHead>
                          <TableHead className="py-2 text-center bg-muted/40">Score</TableHead>
                          <TableHead className="py-2 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analyzedSortedBids.map((bid) => (
                          <TableRow
                            key={bid.id}
                            className="cursor-pointer hover:bg-muted/40"
                            onClick={() => navigate(`/construction/bids/${bid.id}`)}
                          >
                            <TableCell className="py-2 font-medium">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={bid.vendor.logo_display_url || bid.vendor.logo_url || undefined} alt={bid.vendor.name} />
                                  <AvatarFallback className="text-[10px]">
                                    {String(bid.vendor.name || '')
                                      .split(' ')
                                      .map((part) => part[0] || '')
                                      .join('')
                                      .slice(0, 2)
                                      .toUpperCase() || 'V'}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate">{bid.vendor.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline">v{Number(bid.version_number || 1)}</Badge>
                            </TableCell>
                            <TableCell className="py-2 font-medium">
                              <div className="flex items-center gap-2">
                                <span>
                                  ${computeBidFinalTotal(bid).toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                                {lowestBidId === bid.id && <Badge className="bg-emerald-600 hover:bg-emerald-600">Lowest Bid</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-sm text-muted-foreground">
                              <span className="block truncate">
                                {bid.comparison_notes?.trim() || '-'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">{getBidStatusBadge(bid.status)}</TableCell>
                            <TableCell className="py-2">{format(new Date(bid.submitted_at), 'MMM d, yyyy')}</TableCell>
                            <TableCell className="py-2 text-center bg-muted/40 font-semibold">
                              {(bid.weighted_total || 0).toFixed(1)}
                            </TableCell>
                            <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Score Criteria"
                                  aria-label="Score Criteria"
                                  onClick={() => setScoringBidId(bid.id)}
                                >
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!previewAttachmentId}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewAttachmentId(null);
            setPreviewAttachmentUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl h-[90vh] p-0">
          <ZoomableDocumentPreview
            url={previewAttachmentUrl}
            fileName={attachments.find((row) => row.id === previewAttachmentId)?.file_name || 'Drawing Preview'}
            className="h-full"
            emptyMessage="No preview available"
            emptySubMessage="Select a drawing to preview it"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={rfpAttachDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRfpAttachDialogOpen(false);
            setSelectedTargetRfpId('');
            setAttachmentToCopy(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Attach to Another RFP</DialogTitle>
            <DialogDescription>
              {attachmentToCopy ? `Attach ${attachmentToCopy.file_name} to another RFP.` : 'Attach this file to another RFP.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="copy-attachment-rfp-id">RFP</Label>
            <Select value={selectedTargetRfpId} onValueChange={setSelectedTargetRfpId}>
              <SelectTrigger id="copy-attachment-rfp-id">
                <SelectValue placeholder="Select an RFP" />
              </SelectTrigger>
              <SelectContent>
                {sortedRfpTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.rfp_number} - {target.title}{target.job_id && target.job_id === rfp?.job_id ? ' • Matching job' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRfpAttachDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void copyAttachmentToRfp()} disabled={!selectedTargetRfpId || !attachmentToCopy || copyingAttachmentToRfp}>
              {copyingAttachmentToRfp ? 'Attaching...' : 'Attach to RFP'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rfpLinksDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRfpLinksDialogOpen(false);
            setRfpLinksDialogTitle('');
            setRfpLinksDialogRefs([]);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{rfpLinksDialogTitle || 'Linked RFPs'}</DialogTitle>
            <DialogDescription>
              These RFPs already reference this file.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-auto">
            {rfpLinksDialogRefs.map((ref) => (
              <button
                key={ref.rfp_id}
                type="button"
                className="w-full rounded-md border px-3 py-2 text-left hover:bg-muted/40"
                onClick={() => {
                  setRfpLinksDialogOpen(false);
                  navigate(`/construction/rfps/${ref.rfp_id}`);
                }}
              >
                <div className="font-medium">{ref.rfp_number} - {ref.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  {ref.job_name ? <span className="text-xs text-muted-foreground">{ref.job_name}</span> : null}
                  <Badge variant={getRfpStatusBadgeVariant(ref.status)} className="capitalize">
                    {ref.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRfpLinksDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewPlanPage}
        onOpenChange={(open) => {
          if (!open) setPreviewPlanPage(null);
        }}
      >
        <DialogContent className="max-w-7xl h-[90vh] p-0 overflow-hidden">
          {previewPlanPage ? (
            <RfpPlanPageNoteViewer
              fileUrl={previewPlanPage.plan_file_url}
              pageNumber={previewPlanPage.page_number}
              sheetNumber={previewPlanPage.sheet_number}
              pageTitle={previewPlanPage.page_title}
              planName={previewPlanPage.plan_name}
              planNumber={previewPlanPage.plan_number}
              notes={previewPlanPage.callouts}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!scoringBid}
        onOpenChange={(open) => {
          if (!open) setScoringBidId(null);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Score Bid</DialogTitle>
            <DialogDescription>
              {scoringBid ? `Set comparison criteria scores for ${scoringBid.vendor.name}` : 'Set comparison criteria scores'}
            </DialogDescription>
          </DialogHeader>

          {scoringBid && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-md border p-3 md:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">Vendor</p>
                  <p className="font-medium">{scoringBid.vendor.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Final Total</p>
                  <p className="font-medium">
                    ${computeBidFinalTotal(scoringBid).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Weighted Total</p>
                  <p className="font-medium">{(scoringBid.weighted_total || 0).toFixed(1)}</p>
                </div>
              </div>

              {effectiveCriteria.length === 0 ? (
                <div className="text-sm text-muted-foreground">No scoring criteria set yet.</div>
              ) : (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {effectiveCriteria.map((criterion) => (
                    <div key={`modal-${criterion.id}`} className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-2 items-center">
                      <div>
                        <div className="font-medium text-sm">{criterion.criterion_name}</div>
                        <div className="text-xs text-muted-foreground">Weight {criterion.weight} | Max {criterion.max_score}</div>
                      </div>
                      {priceCriteriaIds.has(criterion.id) ? (
                        <div className="space-y-1">
                          <Input
                            type="number"
                            value={bidScoreMap[scoringBid.id]?.[criterion.id] || ''}
                            disabled
                            className="w-full md:w-56"
                          />
                          <p className="text-xs text-muted-foreground">
                            {`${formatOrdinal(priceRankByBidId[scoringBid.id] || bids.length)} lowest -> ${bidScoreMap[scoringBid.id]?.[criterion.id] ?? '-'} point(s)`}
                          </p>
                        </div>
                      ) : normalizeCriterionType(criterion.criterion_type) === 'yes_no' ? (
                        <Select
                          value={
                            bidScoreMap[scoringBid.id]?.[criterion.id] === criterion.max_score
                              ? 'yes'
                              : bidScoreMap[scoringBid.id]?.[criterion.id] === 0
                                ? 'no'
                                : ''
                          }
                          onValueChange={(selected) => {
                            if (selected === 'yes') updateBidScore(scoringBid.id, criterion.id, criterion.max_score);
                            if (selected === 'no') updateBidScore(scoringBid.id, criterion.id, 0);
                          }}
                        >
                          <SelectTrigger className="w-full md:w-56">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : normalizeCriterionType(criterion.criterion_type) === 'picklist' ? (
                        <Select
                          value={String(bidScoreMap[scoringBid.id]?.[criterion.id] ?? '')}
                          onValueChange={(selected) => updateBidScore(scoringBid.id, criterion.id, Number(selected))}
                        >
                          <SelectTrigger className="w-full md:w-72">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {(criterion.criterion_options || []).map((option) => (
                              <SelectItem key={`modal-opt-${criterion.id}-${option.label}-${option.score}`} value={String(option.score)}>
                                {option.label} ({option.score})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          max={criterion.max_score}
                          value={bidScoreMap[scoringBid.id]?.[criterion.id] || ''}
                          onChange={(e) => updateBidScore(scoringBid.id, criterion.id, parseInt(e.target.value, 10) || 0)}
                          className="w-full md:w-56"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setScoringBidId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingCriterion}
        onOpenChange={(open) => {
          if (!open) setEditingCriterion(null);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Scoring Criterion</DialogTitle>
            <DialogDescription>
              Update this criterion. Manual per-bid scoring is entered in Bid Comparison.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Criterion Name</Label>
              <Input
                value={criterionForm.criterion_name}
                onChange={(e) => setCriterionForm((prev) => ({ ...prev, criterion_name: e.target.value }))}
                placeholder="e.g., Build Approach"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={criterionForm.description}
                onChange={(e) => setCriterionForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="How should this be evaluated?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={criterionForm.criterion_type}
                  onValueChange={(value) =>
                    setCriterionForm((prev) => ({
                      ...prev,
                      criterion_type: value as 'numeric' | 'yes_no' | 'picklist',
                      max_score: value === 'yes_no' ? '1' : prev.max_score,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="numeric">Numeric</SelectItem>
                    <SelectItem value="yes_no">Yes / No</SelectItem>
                    <SelectItem value="picklist">Picklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Weight</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={criterionForm.weight}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Score</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={criterionForm.max_score}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, max_score: e.target.value }))}
                  disabled={criterionForm.criterion_type === 'yes_no'}
                />
              </div>
            </div>

            {criterionForm.criterion_type === 'picklist' && (
              <div className="space-y-2">
                <Label>Picklist Options</Label>
                <Textarea
                  value={criterionForm.options_text}
                  onChange={(e) => setCriterionForm((prev) => ({ ...prev, options_text: e.target.value }))}
                  placeholder={`Concrete | 10\nWood | 6\nOther | 3`}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">One option per line as: Label | Score</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCriterion(null)} disabled={savingCriterion}>
              Cancel
            </Button>
            <Button onClick={saveCriterionEdit} disabled={savingCriterion}>
              {savingCriterion ? 'Saving...' : 'Save Criterion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
