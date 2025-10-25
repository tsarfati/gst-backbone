import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertCircle } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { formatDistanceToNow } from 'date-fns';

interface Bill {
  id: string;
  invoice_number: string | null;
  amount: number;
  issue_date: string;
  created_at: string;
  vendor_id: string;
  job_id: string;
  description: string | null;
  status: string;
  pending_coding: boolean;
  vendor?: {
    name: string;
  };
  job?: {
    name: string;
  };
}

interface BillsNeedingCodingProps {
  jobId?: string; // Optional: filter by specific job
  limit?: number;
}

export default function BillsNeedingCoding({ jobId, limit = 5 }: BillsNeedingCodingProps) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { currentCompany } = useCompany();

  useEffect(() => {
    fetchBillsNeedingCoding();
  }, [user, currentCompany, jobId]);

  const fetchBillsNeedingCoding = async () => {
    if (!user || !currentCompany) return;

    try {
      // Build query - fetch bills needing approval or coding
      // Show bills that need coding (pending_coding=true and not approved) OR need approval (status=pending_approval)
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          issue_date,
          created_at,
          vendor_id,
          job_id,
          description,
          status,
          pending_coding,
          vendor:vendors(name),
          job:jobs(name)
        `)
        .or('and(pending_coding.eq.true,status.neq.approved),status.eq.pending_approval')
        .order('created_at', { ascending: false });

      // Filter by job if specified
      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      // For project managers, only show bills for their jobs
      if (profile?.role === 'project_manager') {
        const { data: pmJobs } = await supabase
          .from('jobs')
          .select('id')
          .or(`project_manager_user_id.eq.${user.id},created_by.eq.${user.id}`)
          .eq('company_id', currentCompany.id);

        if (pmJobs && pmJobs.length > 0) {
          const jobIds = pmJobs.map(j => j.id);
          query = query.in('job_id', jobIds);
        } else {
          // PM has no jobs, return empty
          setBills([]);
          setLoading(false);
          return;
        }
      } else {
        // For other roles, show all bills in company
        const { data: companyJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('company_id', currentCompany.id);

        if (companyJobs && companyJobs.length > 0) {
          const jobIds = companyJobs.map(j => j.id);
          query = query.in('job_id', jobIds);
        }
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      setBills(data || []);
    } catch (error) {
      console.error('Error fetching bills needing coding:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBillClick = (billId: string, needsCoding: boolean) => {
    // If needs coding, go to edit page, otherwise go to details page for approval
    if (needsCoding) {
      navigate(`/invoices/${billId}/edit`);
    } else {
      navigate(`/invoices/${billId}`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Bills Needing Approval or Coding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Bills Needing Approval or Coding
          {bills.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {bills.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">
            No bills need approval or coding
          </p>
        ) : (
          <div className="space-y-2">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="px-3 py-2 rounded-md border bg-card hover:bg-primary/5 hover:border-primary cursor-pointer transition-colors"
                onClick={() => handleBillClick(bill.id, bill.pending_coding)}
              >
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium min-w-[120px] truncate">
                    {bill.invoice_number || 'No Invoice #'}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">
                    {bill.vendor?.name || 'Unknown'}
                  </span>
                  {!jobId && bill.job && (
                    <span className="text-muted-foreground text-xs truncate max-w-[150px]">
                      {bill.job.name}
                    </span>
                  )}
                  <span className="font-medium text-foreground whitespace-nowrap">
                    ${bill.amount.toLocaleString()}
                  </span>
                  {bill.pending_coding ? (
                    <Badge variant="secondary" className="text-xs whitespace-nowrap">
                      Needs Coding
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      Needs Approval
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                    {formatDistanceToNow(new Date(bill.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
            {bills.length >= limit && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/invoices?filter=pending')}
              >
                View All Bills Needing Action
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
