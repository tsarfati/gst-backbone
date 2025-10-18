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
      // Build query
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
          vendor:vendors(name),
          job:jobs(name)
        `)
        .eq('pending_coding', true)
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

  const handleBillClick = (billId: string) => {
    navigate(`/bills/${billId}/edit`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Bills Needing Coding
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
          Bills Needing Coding
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
            No bills need coding
          </p>
        ) : (
          <div className="space-y-3">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="p-3 rounded-lg border bg-accent/50 hover:bg-primary/10 hover:border-primary cursor-pointer transition-colors"
                onClick={() => handleBillClick(bill.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-warning" />
                      <h4 className="font-medium">
                        {bill.invoice_number || 'No Invoice #'}
                      </h4>
                      <Badge variant="outline" className="ml-auto">
                        ${bill.amount.toLocaleString()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Vendor: {bill.vendor?.name || 'Unknown'}
                    </p>
                    {!jobId && bill.job && (
                      <p className="text-sm text-muted-foreground">
                        Job: {bill.job.name}
                      </p>
                    )}
                    {bill.description && (
                      <p className="text-sm mt-1 line-clamp-1">
                        {bill.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {formatDistanceToNow(new Date(bill.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {bills.length >= limit && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/bills?filter=pending_coding')}
              >
                View All Bills Needing Coding
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
