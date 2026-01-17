import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, FileSpreadsheet, Trophy, DollarSign, Clock, Star, Save, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  job?: {
    name: string;
  };
}

interface Bid {
  id: string;
  bid_amount: number;
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
  weight: number;
  max_score: number;
}

interface BidScore {
  bid_id: string;
  criterion_id: string;
  score: number;
}

export default function BidComparison() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && currentCompany?.id) {
      loadData();
    }
  }, [id, currentCompany?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load RFP
      const { data: rfpData, error: rfpError } = await supabase
        .from('rfps')
        .select(`
          id, rfp_number, title,
          job:jobs(name)
        `)
        .eq('id', id)
        .single();

      if (rfpError) throw rfpError;
      setRfp(rfpData);

      // Load criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('bid_scoring_criteria')
        .select('id, criterion_name, weight, max_score')
        .eq('rfp_id', id)
        .order('sort_order');

      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData || []);

      // Load bids
      const { data: bidsData, error: bidsError } = await supabase
        .from('bids')
        .select(`
          id, bid_amount, proposed_timeline, notes, status, submitted_at,
          vendor:vendors(id, name)
        `)
        .eq('rfp_id', id)
        .order('bid_amount');

      if (bidsError) throw bidsError;

      // Load existing scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('bid_scores')
        .select('bid_id, criterion_id, score')
        .in('bid_id', (bidsData || []).map(b => b.id));

      if (scoresError) throw scoresError;

      // Build scores map
      const scoresMap: Record<string, Record<string, number>> = {};
      (scoresData || []).forEach(s => {
        if (!scoresMap[s.bid_id]) scoresMap[s.bid_id] = {};
        scoresMap[s.bid_id][s.criterion_id] = s.score;
      });
      setScores(scoresMap);

      // Calculate weighted totals for each bid
      const bidsWithScores = (bidsData || []).map(bid => {
        const bidScores = scoresMap[bid.id] || {};
        let weightedTotal = 0;
        (criteriaData || []).forEach(c => {
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

  const updateScore = (bidId: string, criterionId: string, value: number) => {
    setScores(prev => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [criterionId]: value
      }
    }));

    // Recalculate weighted totals
    setBids(prev => prev.map(bid => {
      if (bid.id !== bidId) return bid;
      const bidScores = {
        ...(scores[bidId] || {}),
        [criterionId]: value
      };
      let weightedTotal = 0;
      criteria.forEach(c => {
        const score = bidScores[c.id] || 0;
        weightedTotal += score * c.weight;
      });
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

  const exportToCSV = () => {
    if (!rfp || bids.length === 0) return;

    const headers = ['Vendor', 'Bid Amount', 'Timeline', ...criteria.map(c => `${c.criterion_name} (${c.weight}x)`), 'Weighted Total'];
    const rows = bids.map(bid => [
      bid.vendor.name,
      `$${bid.bid_amount.toLocaleString()}`,
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
    return bids.reduce((min, bid) => bid.bid_amount < min.bid_amount ? bid : min);
  };

  const getHighestScore = () => {
    if (bids.length === 0) return null;
    return bids.reduce((max, bid) => bid.weighted_total > max.weighted_total ? bid : max);
  };

  const lowestBid = getLowestBid();
  const highestScore = getHighestScore();

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/construction/rfps/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Bid Comparison</h1>
            <p className="text-muted-foreground">
              {rfp.rfp_number} - {rfp.title}
            </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
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
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lowest Bid</p>
                  <p className="text-lg font-bold">${lowestBid.bid_amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{lowestBid.vendor.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {highestScore && criteria.length > 0 && (
          <Card>
            <CardContent className="pt-6">
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
          <CardContent className="pt-6">
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
                    <TableHead className="text-right">Bid Amount</TableHead>
                    <TableHead>Timeline</TableHead>
                    {criteria.map(c => (
                      <TableHead key={c.id} className="text-center min-w-[120px]">
                        <div>
                          <span>{c.criterion_name}</span>
                          <Badge variant="outline" className="ml-1">{c.weight}x</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">Max: {c.max_score}</span>
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
                              ${bid.bid_amount.toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{bid.proposed_timeline || '-'}</TableCell>
                        {criteria.map(c => (
                          <TableCell key={c.id} className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={c.max_score}
                              value={scores[bid.id]?.[c.id] || ''}
                              onChange={(e) => updateScore(bid.id, c.id, parseInt(e.target.value) || 0)}
                              className="w-20 mx-auto text-center"
                            />
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
                const minBid = Math.min(...bids.map(b => b.bid_amount));
                const maxBid = Math.max(...bids.map(b => b.bid_amount));
                const range = maxBid - minBid;
                const percentage = range > 0 ? ((bid.bid_amount - minBid) / range) * 100 : 0;
                const isLowest = bid.bid_amount === minBid;

                return (
                  <div key={bid.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{bid.vendor.name}</span>
                      <span className={isLowest ? 'text-green-600 font-semibold' : ''}>
                        ${bid.bid_amount.toLocaleString()}
                        {!isLowest && minBid > 0 && (
                          <span className="text-muted-foreground text-sm ml-2">
                            (+{(((bid.bid_amount - minBid) / minBid) * 100).toFixed(1)}%)
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
    </div>
  );
}
