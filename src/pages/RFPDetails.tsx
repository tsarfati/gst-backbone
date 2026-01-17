import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Edit, FileText, Users, BarChart3, Plus, Building2, Calendar, DollarSign, Send, Award, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface RFP {
  id: string;
  rfp_number: string;
  title: string;
  description: string | null;
  scope_of_work: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  job_id: string | null;
  created_at: string;
  job?: {
    name: string;
    number: string;
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
  total_score?: number;
}

interface ScoringCriterion {
  id: string;
  criterion_name: string;
  description: string | null;
  weight: number;
  max_score: number;
  sort_order: number;
}

export default function RFPDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [rfp, setRfp] = useState<RFP | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [criteria, setCriteria] = useState<ScoringCriterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && currentCompany?.id) {
      loadRFP();
      loadBids();
      loadCriteria();
    }
  }, [id, currentCompany?.id]);

  const loadRFP = async () => {
    try {
      const { data, error } = await supabase
        .from('rfps')
        .select(`
          *,
          job:jobs(name, number)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setRfp(data);
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

  const loadBids = async () => {
    try {
      const { data, error } = await supabase
        .from('bids')
        .select(`
          *,
          vendor:vendors(id, name)
        `)
        .eq('rfp_id', id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (error) {
      console.error('Error loading bids:', error);
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
      setCriteria(data || []);
    } catch (error) {
      console.error('Error loading criteria:', error);
    }
  };

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
      under_review: { variant: 'default', label: 'Under Review' },
      shortlisted: { variant: 'default', label: 'Shortlisted' },
      accepted: { variant: 'default', label: 'Accepted' },
      rejected: { variant: 'destructive', label: 'Rejected' }
    };
    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
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
          <Button onClick={() => navigate(`/construction/rfps/${id}/compare`)}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Compare Bids
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {rfp.job && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                  <p className="text-sm text-muted-foreground">Job</p>
                  <p className="font-medium">{rfp.job.number} - {rfp.job.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
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
          <CardContent className="pt-6">
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
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bids">Bids ({bids.length})</TabsTrigger>
          <TabsTrigger value="scoring">Scoring Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {rfp.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{rfp.description}</p>
              </CardContent>
            </Card>
          )}
          
          {rfp.scope_of_work && (
            <Card>
              <CardHeader>
                <CardTitle>Scope of Work</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{rfp.scope_of_work}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bids" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Received Bids</h3>
            <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bid
            </Button>
          </div>
          
          {bids.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Bids Yet</h3>
                <p className="text-muted-foreground mb-4">No vendors have submitted bids for this RFP</p>
                <Button onClick={() => navigate(`/construction/rfps/${id}/bids/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Bid
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Bid Amount</TableHead>
                    <TableHead>Timeline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bids.map(bid => (
                    <TableRow key={bid.id}>
                      <TableCell className="font-medium">{bid.vendor.name}</TableCell>
                      <TableCell>${bid.bid_amount.toLocaleString()}</TableCell>
                      <TableCell>{bid.proposed_timeline || '-'}</TableCell>
                      <TableCell>{getBidStatusBadge(bid.status)}</TableCell>
                      <TableCell>{format(new Date(bid.submitted_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => navigate(`/construction/bids/${bid.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Scoring Criteria</h3>
              <p className="text-sm text-muted-foreground">Define weighted criteria for bid evaluation</p>
            </div>
            <Button onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Criterion
            </Button>
          </div>

          {criteria.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Scoring Criteria</h3>
                <p className="text-muted-foreground mb-4">Add criteria to evaluate and compare bids</p>
                <Button onClick={() => navigate(`/construction/rfps/${id}/criteria/add`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Criterion
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criterion</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Max Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.criterion_name}</TableCell>
                      <TableCell>{c.description || '-'}</TableCell>
                      <TableCell>{c.weight}x</TableCell>
                      <TableCell>{c.max_score}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
