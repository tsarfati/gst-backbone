import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, FileSpreadsheet, Trophy, DollarSign, Star, Save, BarChart3, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useWebsiteJobAccess } from '@/hooks/useWebsiteJobAccess';
import { canAccessAssignedJobOnly } from '@/utils/jobAccess';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  job_id?: string | null;
  job?: {
    name: string;
  };
}

interface Bid {
  id: string;
  bid_amount: number;
  shipping_included?: boolean | null;
  shipping_amount?: number | null;
  taxes_included?: boolean | null;
  tax_amount?: number | null;
  discount_amount?: number | null;
  proposed_timeline: string | null;
  notes: string | null;
  status: string;
  submitted_at: string;
  vendor: {
    id: string;
    name: string;
  };
  scores: Record<string, number>;
  weighted_total: number;
}

interface ScoringCriterion {
  id: string;
  criterion_name: string;
  description?: string | null;
  weight: number;
  max_score: number;
  criterion_type?: 'numeric' | 'yes_no' | 'picklist' | null;
  criterion_options?: Array<{ label: string; score: number }> | null;
  sort_order?: number | null;
}

interface BidScore {
  bid_id: string;
  criterion_id: string;
  score: number;
}

interface ComparisonMessage {
  id: string;
  message: string;
  user_id: string;
  created_at: string;
  sender_name: string;
  sender_avatar_url?: string | null;
}

const isPriceCriterion = (criterionName: string) => {
  const value = String(criterionName || '').toLowerCase();
  return value.includes('price') || value.includes('cost');
};

const normalizeCriterionType = (value: unknown): 'numeric' | 'yes_no' | 'picklist' => {
  if (value === 'yes_no' || value === 'picklist' || value === 'numeric') return value;
  return 'numeric';
};

const normalizeCriterionOptions = (value: unknown): Array<{ label: string; score: number }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const label = String((entry as any)?.label ?? '').trim();
      const score = Number((entry as any)?.score);
      return {
        label,
        score: Number.isFinite(score) ? score : 0,
      };
    })
    .filter((entry) => entry.label.length > 0);
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

const buildAutoPriceScores = (bids: Bid[], criteria: ScoringCriterion[]) => {
  const priceCriteria = criteria.filter((criterion) => isPriceCriterion(criterion.criterion_name));
  if (priceCriteria.length === 0 || bids.length === 0) return {} as Record<string, Record<string, number>>;

  const sorted = [...bids].sort((a, b) => computeBidFinalTotal(a) - computeBidFinalTotal(b));
  const rankByBidId: Record<string, number> = {};
  let currentRank = 1;
  sorted.forEach((bid, index) => {
    if (index > 0 && computeBidFinalTotal(bid) > computeBidFinalTotal(sorted[index - 1])) {
      currentRank = index + 1;
    }
    rankByBidId[bid.id] = currentRank;
  });

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
    merged[bidId] = {
      ...(merged[bidId] || {}),
      ...(bidScores || {}),
    };
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
    return total + score * criterion.weight;
  }, 0);
};

export default function BidComparison() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const { loading: websiteJobAccessLoading, isPrivileged, allowedJobIds } = useWebsiteJobAccess();
  
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [comparisonMessages, setComparisonMessages] = useState<ComparisonMessage[]>([]);
  const [loadingComparisonMessages, setLoadingComparisonMessages] = useState(false);
  const [newComparisonMessage, setNewComparisonMessage] = useState('');
  const [sendingComparisonMessage, setSendingComparisonMessage] = useState(false);
  const [analysisView, setAnalysisView] = useState<'matrix' | 'criteria'>('matrix');
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

  useEffect(() => {
    if (id && currentCompany?.id && !websiteJobAccessLoading) {
      loadData();
    }
  }, [id, currentCompany?.id, websiteJobAccessLoading, isPrivileged, allowedJobIds.join(",")]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load RFP
      const { data: rfpData, error: rfpError } = await supabase
        .from('rfps')
        .select(`
          id, rfp_number, title, job_id,
          job:jobs(name)
        `)
        .eq('id', id)
        .single();

      if (rfpError) throw rfpError;

      if (!canAccessAssignedJobOnly([rfpData?.job_id], isPrivileged, allowedJobIds)) {
        toast({
          title: 'Access denied',
          description: 'You do not have access to this RFP job',
          variant: 'destructive'
        });
        navigate('/construction/rfps');
        return;
      }
      setRfp(rfpData);

      // Load criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('bid_scoring_criteria')
        .select('id, criterion_name, description, weight, max_score, criterion_type, criterion_options, sort_order')
        .eq('rfp_id', id)
        .order('sort_order');

      if (criteriaError) throw criteriaError;
      const normalizedCriteria = ((criteriaData || []) as any[]).map((criterion) => ({
        ...criterion,
        criterion_type: normalizeCriterionType(criterion.criterion_type),
        criterion_options: normalizeCriterionOptions(criterion.criterion_options),
      })) as ScoringCriterion[];
      setCriteria(normalizedCriteria);

      // Load bids
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          id, bid_amount, shipping_included, shipping_amount, taxes_included, tax_amount, discount_amount, proposed_timeline, notes, status, submitted_at,
          vendor:vendors(id, name)
        `)
        .eq('rfp_id', id)
        .order('submitted_at', { ascending: false });

      if (bidsError) throw bidsError;

      // Load existing scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('bid_scores')
        .select('bid_id, criterion_id, score')
        .in('bid_id', (bidsData || []).map(b => b.id));

      if (scoresError) throw scoresError;

      // Build manual scores map from saved values
      const manualScoresMap: Record<string, Record<string, number>> = {};
      (scoresData || []).forEach(s => {
        if (!manualScoresMap[s.bid_id]) manualScoresMap[s.bid_id] = {};
        manualScoresMap[s.bid_id][s.criterion_id] = s.score;
      });

      const autoPriceScores = buildAutoPriceScores((bidsData as any) || [], normalizedCriteria);
      const scoresMap = mergeScoresWithAutoPrice(manualScoresMap, autoPriceScores);
      setScores(scoresMap);

      // Calculate weighted totals for each bid
      const bidsWithScores = (bidsData || []).map(bid => {
        const bidScores = scoresMap[bid.id] || {};
        let weightedTotal = 0;
        normalizedCriteria.forEach(c => {
          const score = bidScores[c.id] || 0;
          weightedTotal += score * c.weight;
        });
        return {
          ...bid,
          scores: bidScores,
          weighted_total: weightedTotal
        };
      });

      setBids(bidsWithScores);
      await loadComparisonMessages(String(id));
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load comparison data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadComparisonMessages = async (rfpId: string) => {
    if (!rfpId) return;
    try {
      setLoadingComparisonMessages(true);
      const { data, error } = await supabase
        .from('rfp_bid_comparison_messages' as any)
        .select('id, message, user_id, created_at')
        .eq('rfp_id', rfpId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = (data || []) as Array<{ id: string; message: string; user_id: string; created_at: string }>;
      const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
      let profileMap = new Map<string, { name: string; avatarUrl: string | null }>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, first_name, last_name, avatar_url')
          .in('user_id', userIds);

        profileMap = new Map(
          (profiles || []).map((profile: any) => {
            const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
            return [
              profile.user_id,
              {
                name: profile?.display_name || fullName || 'Unknown User',
                avatarUrl: profile?.avatar_url || null,
              },
            ];
          }),
        );
      }

      setComparisonMessages(
        rows.map((row) => ({
          ...row,
          sender_name: profileMap.get(row.user_id)?.name || 'Unknown User',
          sender_avatar_url: profileMap.get(row.user_id)?.avatarUrl || null,
        })),
      );
    } catch (error) {
      console.error('Error loading comparison messages:', error);
      setComparisonMessages([]);
    } finally {
      setLoadingComparisonMessages(false);
    }
  };

  const sendComparisonMessage = async () => {
    if (!id || !currentCompany?.id || !user?.id) return;
    const value = newComparisonMessage.trim();
    if (!value) return;

    try {
      setSendingComparisonMessage(true);
      const { error } = await supabase
        .from('rfp_bid_comparison_messages' as any)
        .insert({
          company_id: currentCompany.id,
          rfp_id: id,
          user_id: user.id,
          message: value,
        });
      if (error) throw error;

      setNewComparisonMessage('');
      await loadComparisonMessages(id);
      toast({
        title: 'Message posted',
        description: 'Team discussion updated',
      });
    } catch (error: any) {
      console.error('Error sending comparison message:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to post message',
        variant: 'destructive',
      });
    } finally {
      setSendingComparisonMessage(false);
    }
  };

  const updateScore = (bidId: string, criterionId: string, value: number) => {
    const criterion = criteria.find((entry) => entry.id === criterionId);
    if (criterion && isPriceCriterion(criterion.criterion_name)) {
      return;
    }
    const clampedValue = Math.max(0, Math.min(value, criterion?.max_score ?? value));

    setScores(prev => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [criterionId]: clampedValue
      }
    }));

    // Recalculate weighted totals
    setBids(prev => prev.map(bid => {
      if (bid.id !== bidId) return bid;
      const bidScores = {
        ...(scores[bidId] || {}),
        [criterionId]: clampedValue
      };
      const weightedTotal = calculateWeightedTotal(bidId, criteria, { ...scores, [bidId]: bidScores });
      return { ...bid, scores: bidScores, weighted_total: weightedTotal };
    }));
  };

  const saveScores = async () => {
    try {
      setSaving(true);

      const scoresToUpsert: any[] = [];
      Object.entries(scores).forEach(([bidId, bidScores]) => {
        Object.entries(bidScores).forEach(([criterionId, score]) => {
          scoresToUpsert.push({
            bid_id: bidId,
            criterion_id: criterionId,
            company_id: currentCompany!.id,
            score,
            scored_by: user!.id,
            scored_at: new Date().toISOString()
          });
        });
      });

      if (scoresToUpsert.length > 0) {
        const { error } = await supabase
          .from('bid_scores')
          .upsert(scoresToUpsert, {
            onConflict: 'bid_id,criterion_id'
          });

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Scores saved successfully'
      });
    } catch (error: any) {
      console.error('Error saving scores:', error);
      toast({
        title: 'Error',
        description: 'Failed to save scores',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
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
      criterion_type: normalizeCriterionType(criterion.criterion_type),
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
    if (!id) return;

    const name = criterionForm.criterion_name.trim();
    if (!name) {
      toast({ title: 'Validation', description: 'Criterion name is required', variant: 'destructive' });
      return;
    }

    const options = criterionForm.criterion_type === 'picklist' ? parseCriterionOptions(criterionForm.options_text) : [];
    if (criterionForm.criterion_type === 'picklist' && options.length === 0) {
      toast({ title: 'Validation', description: 'Picklist requires at least one option', variant: 'destructive' });
      return;
    }

    try {
      setSavingCriterion(true);
      const payload: any = {
        criterion_name: name,
        description: criterionForm.description.trim() || null,
        weight: Number(criterionForm.weight) || 1,
        max_score: criterionForm.criterion_type === 'yes_no' ? 1 : (Number(criterionForm.max_score) || 10),
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
      await loadData();
      toast({ title: 'Saved', description: 'Criterion updated' });
    } catch (error: any) {
      console.error('Error updating criterion:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to update criterion', variant: 'destructive' });
    } finally {
      setSavingCriterion(false);
    }
  };

  const exportToCSV = () => {
    if (!rfp || bids.length === 0) return;

    const headers = ['Vendor', 'Final Total Bid', 'Timeline', ...criteria.map(c => `${c.criterion_name} (${c.weight}x)`), 'Weighted Total'];
    const rows = bids.map(bid => [
      bid.vendor.name,
      `$${computeBidFinalTotal(bid).toLocaleString()}`,
      bid.proposed_timeline || '-',
      ...criteria.map(c => scores[bid.id]?.[c.id] || 0),
      bid.weighted_total.toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rfp.rfp_number}_bid_comparison.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLowestBid = () => {
    if (bids.length === 0) return null;
    return bids.reduce((min, bid) => (computeBidFinalTotal(bid) < computeBidFinalTotal(min) ? bid : min));
  };

  const getHighestScore = () => {
    if (bids.length === 0) return null;
    return bids.reduce((max, bid) => bid.weighted_total > max.weighted_total ? bid : max);
  };

  const lowestBid = getLowestBid();
  const highestScore = getHighestScore();
  const priceCriteriaIds = new Set(criteria.filter((criterion) => isPriceCriterion(criterion.criterion_name)).map((criterion) => criterion.id));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><span className="loading-dots">Loading</span></div>;
  }

  if (!rfp) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/construction/rfps/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bid Comparison</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={saveScores} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Scores'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Bids</p>
                <p className="text-2xl font-bold">{bids.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {lowestBid && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lowest Bid</p>
                  <p className="text-lg font-bold">${computeBidFinalTotal(lowestBid).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{lowestBid.vendor.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {highestScore && criteria.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Trophy className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Highest Score</p>
                  <p className="text-lg font-bold">{highestScore.weighted_total.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">{highestScore.vendor.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Star className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Criteria</p>
                <p className="text-2xl font-bold">{criteria.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Matrix */}
      {bids.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Bids to Compare</h3>
            <p className="text-muted-foreground mb-4">Add bids to this RFP to start comparing</p>
            <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
              Add Bid
            </Button>
          </CardContent>
        </Card>
      ) : criteria.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Scoring Criteria</h3>
            <p className="text-muted-foreground mb-4">Add scoring criteria to evaluate bids</p>
            <Button onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
              Add Criteria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vendor Comparison Matrix</CardTitle>
            <CardDescription>Score each vendor against the defined criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Vendor</TableHead>
                    <TableHead className="text-right">Final Total Bid</TableHead>
                    <TableHead>Timeline</TableHead>
                    {criteria.map(c => (
                      <TableHead key={c.id} className="text-center min-w-[120px]">
                        <div>
                          <span>{c.criterion_name}</span>
                          <Badge variant="outline" className="ml-1">{c.weight}x</Badge>
                          {priceCriteriaIds.has(c.id) && <Badge variant="secondary" className="ml-1">Auto</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {priceCriteriaIds.has(c.id)
                            ? `Auto: ${bids.length} (low) to 1 (high)`
                            : normalizeCriterionType(c.criterion_type) === 'yes_no'
                              ? `Yes=${c.max_score}, No=0`
                              : normalizeCriterionType(c.criterion_type) === 'picklist'
                                ? 'Picklist scoring'
                                : `Max: ${c.max_score}`}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-center bg-muted/50">
                      <div className="font-bold">Weighted</div>
                      <div className="font-bold">Total</div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bids.map((bid, index) => {
                    const isLowest = lowestBid?.id === bid.id;
                    const isHighestScore = highestScore?.id === bid.id;
                    
                    return (
                      <TableRow key={bid.id} className={isHighestScore ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isHighestScore && <Trophy className="h-4 w-4 text-amber-500" />}
                            {bid.vendor.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isLowest && <Badge variant="outline" className="text-green-600">Lowest</Badge>}
                            <span className={isLowest ? 'text-green-600 font-semibold' : ''}>
                              ${computeBidFinalTotal(bid).toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{bid.proposed_timeline || '-'}</TableCell>
                        {criteria.map(c => (
                          <TableCell key={c.id} className="text-center">
                            {priceCriteriaIds.has(c.id) ? (
                              <Input
                                type="number"
                                min={0}
                                max={bids.length}
                                value={scores[bid.id]?.[c.id] || ''}
                                onChange={(e) => updateScore(bid.id, c.id, parseInt(e.target.value) || 0)}
                                className="w-20 mx-auto text-center"
                                disabled
                              />
                            ) : normalizeCriterionType(c.criterion_type) === 'yes_no' ? (
                              <Select
                                value={
                                  scores[bid.id]?.[c.id] === c.max_score
                                    ? 'yes'
                                    : scores[bid.id]?.[c.id] === 0
                                      ? 'no'
                                      : ''
                                }
                                onValueChange={(selected) => {
                                  if (selected === 'yes') updateScore(bid.id, c.id, c.max_score);
                                  if (selected === 'no') updateScore(bid.id, c.id, 0);
                                }}
                              >
                                <SelectTrigger className="w-28 mx-auto">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="yes">Yes</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : normalizeCriterionType(c.criterion_type) === 'picklist' ? (
                              <Select
                                value={String(scores[bid.id]?.[c.id] ?? '')}
                                onValueChange={(selected) => updateScore(bid.id, c.id, Number(selected))}
                              >
                                <SelectTrigger className="w-36 mx-auto">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(c.criterion_options || []).map((option) => (
                                    <SelectItem key={`${c.id}-${option.label}-${option.score}`} value={String(option.score)}>
                                      {option.label} ({option.score})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                max={c.max_score}
                                value={scores[bid.id]?.[c.id] || ''}
                                onChange={(e) => updateScore(bid.id, c.id, parseInt(e.target.value) || 0)}
                                className="w-20 mx-auto text-center"
                              />
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-muted/50">
                          <span className={`text-lg font-bold ${isHighestScore ? 'text-amber-600' : ''}`}>
                            {bid.weighted_total.toFixed(1)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Analysis */}
      {bids.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Price Analysis</CardTitle>
            <CardDescription>Comparison of bid amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bids.map((bid, index) => {
                const totals = bids.map((entry) => computeBidFinalTotal(entry));
                const minBid = Math.min(...totals);
                const maxBid = Math.max(...totals);
                const bidTotal = computeBidFinalTotal(bid);
                const range = maxBid - minBid;
                const percentage = range > 0 ? ((bidTotal - minBid) / range) * 100 : 0;
                const isLowest = bidTotal === minBid;

                return (
                  <div key={bid.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{bid.vendor.name}</span>
                      <span className={isLowest ? 'text-green-600 font-semibold' : ''}>
                        ${bidTotal.toLocaleString()}
                        {!isLowest && minBid > 0 && (
                          <span className="text-muted-foreground text-sm ml-2">
                            (+{(((bidTotal - minBid) / minBid) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${isLowest ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${Math.max(5, 100 - percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {criteria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Internal Bid Discussion
            </CardTitle>
            <CardDescription>Team-only chat about this bid comparison and scoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-72 overflow-y-auto space-y-2 rounded-md border p-3">
              {loadingComparisonMessages ? (
                <p className="text-sm text-muted-foreground"><span className="loading-dots">Loading</span></p>
              ) : comparisonMessages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No discussion yet.</p>
              ) : (
                comparisonMessages.map((message) => (
                  <div key={message.id} className="rounded-md bg-muted/40 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={message.sender_avatar_url || undefined} alt={message.sender_name} />
                        <AvatarFallback className="text-[10px]">
                          {message.sender_name
                            .split(' ')
                            .map((part) => part[0] || '')
                            .join('')
                            .slice(0, 2)
                            .toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span>{message.sender_name}</span>
                      <span>{format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Textarea
                rows={3}
                placeholder="Discuss bids and scoring with your team..."
                value={newComparisonMessage}
                onChange={(e) => setNewComparisonMessage(e.target.value)}
              />
              <Button onClick={sendComparisonMessage} disabled={sendingComparisonMessage || !newComparisonMessage.trim()}>
                <Send className="mr-2 h-4 w-4" />
                {sendingComparisonMessage ? 'Sending...' : 'Post Message'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
