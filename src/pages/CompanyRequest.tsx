import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Building2, Loader2, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Company {
  id: string;
  name: string;
  display_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
}

interface AccessRequest {
  company_id: string;
  is_active: boolean;
  status?: string;
}

export default function CompanyRequest() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingAccess, setRequestingAccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchCompanies();
      fetchAccessRequests();
    }
  }, [user]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load companies',
        variant: 'destructive'
      });
    }
  };

  const fetchAccessRequests = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('company_access_requests')
        .select('company_id, status')
        .eq('user_id', user.id);

      if (error) throw error;
      
      // Also fetch approved company access from user_company_access
      const { data: approvedAccess, error: accessError } = await supabase
        .from('user_company_access')
        .select('company_id, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (accessError) console.error('Error fetching approved access:', accessError);

      // Combine request data with approved access
      const combinedRequests = (data || []).map(req => ({
        company_id: req.company_id,
        is_active: req.status === 'approved',
        status: req.status
      }));

      // Add approved access that might not have requests
      (approvedAccess || []).forEach(access => {
        if (!combinedRequests.find(req => req.company_id === access.company_id)) {
          combinedRequests.push({
            company_id: access.company_id,
            is_active: true,
            status: 'approved'
          });
        }
      });

      setAccessRequests(combinedRequests);
    } catch (error) {
      console.error('Error fetching access requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestAccess = async (companyId: string) => {
    if (!user) return;

    setRequestingAccess(companyId);
    try {
      const { error } = await supabase
        .from('company_access_requests')
        .insert({
          user_id: user.id,
          company_id: companyId,
          status: 'pending'
        });

      if (error) throw error;

      toast({
        title: 'Request Sent',
        description: 'Your access request has been sent to the company administrators.',
      });

      // Refresh access requests
      await fetchAccessRequests();
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send access request',
        variant: 'destructive'
      });
    } finally {
      setRequestingAccess(null);
    }
  };

  const getRequestStatus = (companyId: string) => {
    const request = accessRequests.find(r => r.company_id === companyId);
    if (!request) return 'none';
    if (request.is_active) return 'approved';
    return request.status || 'pending';
  };

  const hasAnyApprovedAccess = accessRequests.some(r => r.is_active);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to GSTHUB</h1>
          <p className="text-muted-foreground text-lg">
            {hasAnyApprovedAccess 
              ? "You have access to company resources. You can request access to additional companies below."
              : "To get started, please request access to a company. A company administrator will need to approve your request."
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => {
            const status = getRequestStatus(company.id);
            
            return (
              <Card key={company.id} className="relative overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {company.logo_url ? (
                        <img 
                          src={company.logo_url} 
                          alt={`${company.name} logo`}
                          className="w-12 h-12 object-contain rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {company.display_name || company.name}
                        </CardTitle>
                      </div>
                    </div>
                    {status === 'approved' && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approved
                      </Badge>
                    )}
                    {status === 'pending' && (
                      <Badge variant="outline">
                        Pending
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {company.address && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {company.address}
                      {company.city && `, ${company.city}`}
                      {company.state && `, ${company.state}`}
                    </p>
                  )}
                  
                  {status === 'none' && (
                    <Button 
                      onClick={() => requestAccess(company.id)}
                      disabled={requestingAccess === company.id}
                      className="w-full"
                    >
                      {requestingAccess === company.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Request Access
                    </Button>
                  )}
                  
                  {status === 'pending' && (
                    <Button disabled className="w-full" variant="outline">
                      Request Pending
                    </Button>
                  )}
                  
                  {status === 'approved' && (
                    <Button disabled className="w-full" variant="outline">
                      Access Granted
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Companies Available</h3>
            <p className="text-muted-foreground">
              There are currently no companies available to request access to.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}