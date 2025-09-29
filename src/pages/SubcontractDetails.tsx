import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Trash2, FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/formatNumber";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SubcontractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [subcontract, setSubcontract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSubcontract();
    }
  }, [id]);

  const fetchSubcontract = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subcontracts')
        .select(`
          *,
          jobs(id, name),
          vendors(id, name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setSubcontract(data);
    } catch (error) {
      console.error('Error fetching subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to load subcontract details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('subcontracts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subcontract deleted successfully",
      });

      navigate('/subcontracts');
    } catch (error) {
      console.error('Error deleting subcontract:', error);
      toast({
        title: "Error",
        description: "Failed to delete subcontract",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!subcontract) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Subcontract not found</p>
          <Button onClick={() => navigate('/subcontracts')} className="mt-4">
            Back to Subcontracts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{subcontract.name}</h1>
            <p className="text-muted-foreground">Subcontract Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Subcontract</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this subcontract? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Main Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subcontract Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              <p className="font-semibold text-foreground">{subcontract.vendors?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Job</p>
              <p className="font-semibold text-foreground">{subcontract.jobs?.name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contract Amount</p>
              <p className="font-semibold text-foreground text-xl">${formatNumber(subcontract.contract_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`${getStatusColor(subcontract.status)} text-white`}>
                {subcontract.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-semibold text-foreground">
                {subcontract.start_date ? format(new Date(subcontract.start_date), 'MMMM d, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-semibold text-foreground">
                {subcontract.end_date ? format(new Date(subcontract.end_date), 'MMMM d, yyyy') : 'Not set'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-semibold text-foreground">
                {format(new Date(subcontract.created_at), 'MMMM d, yyyy')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {subcontract.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">{subcontract.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Contract Files */}
      {subcontract.contract_file_url && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium text-foreground">Contract File</p>
                <p className="text-sm text-muted-foreground">Click to view or download</p>
              </div>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
