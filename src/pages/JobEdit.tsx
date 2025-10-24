import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Save, Trash2, Building, Users, Calculator, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { DevelopmentFreezeGuard } from "@/components/DevelopmentFreezeGuard";
import { geocodeAddress } from "@/utils/geocoding";
import { formatCurrency } from "@/utils/formatNumber";
import { useActionPermissions } from "@/hooks/useActionPermissions";

export default function JobEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  
  const isAdmin = profile?.role === 'admin';
  const { currentCompany } = useCompany();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projectManagers, setProjectManagers] = useState<any[]>([]);
  const [assistantManagers, setAssistantManagers] = useState<any[]>([]);
  const permissions = useActionPermissions();

  useEffect(() => {
    if (!id) return;
    if (!permissions.canEditJobs()) {
      navigate(`/jobs/${id}`, { replace: true });
    }
  }, [id, permissions, navigate]);

  const [formData, setFormData] = useState({
    name: "",
    budget: "",
    start_date: "",
    end_date: "",
    status: "planning" as any,
    description: "",
    address: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    client: "",
    job_type: "residential" as any,
    project_manager_user_id: ""
  });

  useEffect(() => {
    const fetchProjectManagers = async () => {
      if (!currentCompany?.id) return;
      
      try {
        // Get user IDs for this company
        const { data: accessData, error: accessError } = await supabase
          .from('user_company_access')
          .select('user_id')
          .eq('company_id', currentCompany.id)
          .eq('is_active', true);

        if (accessError) {
          console.error('Error fetching company access:', accessError);
          return;
        }

        const userIds = (accessData || []).map(a => a.user_id);

        // Fetch profiles for users in this company with manager roles
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, display_name, role, status')
          .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
          .in('role', ['admin', 'controller', 'project_manager']);

        if (error) {
          console.error('Error fetching project managers:', error);
        } else {
          setProjectManagers(data || []);
        }
      } catch (err) {
        console.error('Error:', err);
      }
    };

    const fetchJob = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching job:', error);
          toast({
            title: "Error",
            description: "Failed to load job details",
            variant: "destructive",
          });
        } else if (data) {
          setJob(data);
          // Parse existing address into components
          const addressParts = data.address ? data.address.split(', ') : [];
          const street = addressParts[0] || "";
          const city = addressParts[1] || "";
          const stateZip = addressParts[2] || "";
          const [state, zip] = stateZip.split(' ');

          setFormData({
            name: data.name || "",
            budget: data.budget ? data.budget.toString() : "",
            start_date: data.start_date || "",
            end_date: data.end_date || "",
            status: data.status || "planning" as any,
            description: data.description || "",
            address: data.address || "",
            street: street,
            city: city || "",
            state: state || "",
            zip: zip || "",
            client: data.client || "",
            job_type: data.job_type || "residential" as any,
            project_manager_user_id: data.project_manager_user_id || ""
          });

          // Fetch assistant managers for this job
          const { data: assistants, error: assistantsError } = await supabase
            .from('job_assistant_managers')
            .select(`
              id,
              user_id,
              profiles!user_id (
                id,
                display_name,
                first_name,
                last_name
              )
            `)
            .eq('job_id', id);

          if (!assistantsError && assistants) {
            setAssistantManagers(assistants);
          }
        }
      } catch (err) {
        console.error('Error:', err);
        toast({
          title: "Error",
          description: "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchProjectManagers();
    fetchJob();
  }, [id, toast, currentCompany?.id]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">Loading job details...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Job Not Found</h1>
            <p className="text-muted-foreground">The requested job could not be found</p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            This job doesn&apos;t exist or you don&apos;t have permission to edit it.
          </p>
          <Button onClick={() => navigate("/jobs")}>
            Return to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    // Prevent changing TO planning status unless admin
    if (field === 'status' && value === 'planning' && !isAdmin && formData.status !== 'planning') {
      toast({
        title: "Permission Denied",
        description: "Only administrators can change a job to Planning status.",
        variant: "destructive",
      });
      return;
    }

    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Auto-build full address when component fields change
      if (['street', 'city', 'state', 'zip'].includes(field)) {
        const parts = [];
        if (field === 'street' ? value : updated.street) parts.push(field === 'street' ? value : updated.street);
        if (field === 'city' ? value : updated.city) parts.push(field === 'city' ? value : updated.city);
        if ((field === 'state' ? value : updated.state) || (field === 'zip' ? value : updated.zip)) {
          const stateZip = `${field === 'state' ? value : updated.state} ${field === 'zip' ? value : updated.zip}`.trim();
          if (stateZip) parts.push(stateZip);
        }
        updated.address = parts.join(', ');
      }
      
      return updated;
    });
  };

  const handleSave = async () => {
    if (!id || !job) return;
    if (!permissions.canEditJobs()) {
      toast({ title: "Permission Denied", description: "You do not have permission to edit jobs.", variant: "destructive" });
      return;
    }

    try {
      // Geocode the address to get coordinates if address changed
      let latitude: number | null = job.latitude;
      let longitude: number | null = job.longitude;
      
      if (formData.address && formData.address !== job.address) {
        const geocodeResult = await geocodeAddress(formData.address);
        if (geocodeResult) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
        }
      }

      // Update job details (excluding budget - it's managed from Cost Budget page)
      const { error } = await supabase
        .from('jobs')
        .update({
          name: formData.name,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          description: formData.description,
          address: formData.address,
          latitude,
          longitude,
          client: formData.client,
          job_type: formData.job_type,
          project_manager_user_id: formData.project_manager_user_id || null
        })
        .eq('id', id);

      if (error) {
        console.error('Error updating job:', error);
        toast({
          title: "Error",
          description: "Failed to update job details",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Job Updated",
        description: "Job details have been successfully updated.",
      });
      navigate(`/jobs/${id}`);
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const handleAddAssistantManager = async (userId: string) => {
    if (!id) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('job_assistant_managers')
        .insert({
          job_id: id,
          user_id: userId,
          assigned_by: user.user?.id
        });

      if (error) {
        console.error('Error adding assistant manager:', error);
        toast({
          title: "Error",
          description: "Failed to add assistant manager",
          variant: "destructive",
        });
      } else {
        // Refresh assistant managers list
        const { data: assistants } = await supabase
          .from('job_assistant_managers')
          .select(`
            id,
            user_id,
            profiles!user_id (
              id,
              display_name,
              first_name,
              last_name
            )
          `)
          .eq('job_id', id);

        if (assistants) {
          setAssistantManagers(assistants);
        }

        toast({
          title: "Assistant Manager Added",
          description: "Assistant manager has been added to the job.",
        });
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleRemoveAssistantManager = async (assistantId: string) => {
    try {
      const { error } = await supabase
        .from('job_assistant_managers')
        .delete()
        .eq('id', assistantId);

      if (error) {
        console.error('Error removing assistant manager:', error);
        toast({
          title: "Error",
          description: "Failed to remove assistant manager",
          variant: "destructive",
        });
      } else {
        setAssistantManagers(assistantManagers.filter(am => am.id !== assistantId));
        toast({
          title: "Assistant Manager Removed",
          description: "Assistant manager has been removed from the job.",
        });
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!permissions.canDelete('jobs')) {
      toast({ title: 'Permission Denied', description: 'You do not have permission to delete jobs.', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('Error deleting job:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to delete job.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Job Deleted",
        description: "Job has been successfully deleted.",
      });
      navigate("/jobs");
    } catch (err: any) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred while deleting the job",
        variant: "destructive",
      });
    }
  };

  return (
    <DevelopmentFreezeGuard>
      <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(`/jobs/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Edit Job</h1>
            <p className="text-muted-foreground">Update job details and settings</p>
          </div>
        </div>
        <div className="flex gap-2">
          {permissions.canDelete('jobs') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Job
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the job
                    and all associated data including receipts, photos, and documents.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Job
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={handleSave} disabled={!permissions.canEditJobs()}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Job Banner - Moved to top */}
        <Card>
          <CardHeader>
            <CardTitle>Job Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner">Banner Image</Label>
              <div className="flex items-center gap-4">
                <div className="h-20 w-32 border border-border rounded-lg flex items-center justify-center bg-muted">
                  <Building className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="banner-upload"
                  />
                  <Label htmlFor="banner-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" asChild>
                      <span>
                        Upload Banner
                      </span>
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: 1200x400px, max 5MB
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Job Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter job name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Total Budget</Label>
                <div className="relative">
                  <Input
                    id="budget"
                    type="text"
                    value={formatCurrency(job.budget_total || 0)}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Calculated from Cost Codes & Budget page
                  </p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleInputChange("start_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleInputChange("end_date", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <Select value={formData.job_type} onValueChange={(value) => handleInputChange("job_type", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter job description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Input
                id="client"
                value={formData.client}
                onChange={(e) => handleInputChange("client", e.target.value)}
                placeholder="Enter client name"
              />
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={formData.street}
                  onChange={(e) => handleInputChange("street", e.target.value)}
                  placeholder="Enter street address"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    placeholder="State"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => handleInputChange("zip", e.target.value)}
                    placeholder="ZIP"
                  />
                </div>
              </div>
              
              {formData.address && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Full Address (Auto-generated)</Label>
                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                    {formData.address}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Project Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Project Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectManager">Lead Project Manager</Label>
              <Select 
                value={formData.project_manager_user_id} 
                onValueChange={(value) => handleInputChange("project_manager_user_id", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a project manager" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border backdrop-blur-sm z-50">
                  {projectManagers.map((manager) => (
                    <SelectItem key={manager.user_id} value={manager.user_id}>
                      {manager.display_name || `${manager.first_name} ${manager.last_name}`} ({manager.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assistant Project Managers</Label>
              <div className="space-y-2">
                {assistantManagers.length > 0 ? (
                  assistantManagers.map((assistant) => (
                    <div key={assistant.id} className="flex items-center justify-between p-2 border rounded-lg">
                      <span className="text-sm">
                        {assistant.profiles?.display_name || 
                         `${assistant.profiles?.first_name} ${assistant.profiles?.last_name}`}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveAssistantManager(assistant.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No assistant managers assigned</p>
                )}
                
                <Select onValueChange={handleAddAssistantManager}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Add assistant manager" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border backdrop-blur-sm z-50">
                    {projectManagers
                      .filter(manager => 
                        manager.user_id !== formData.project_manager_user_id &&
                        !assistantManagers.some(am => am.user_id === manager.user_id)
                      )
                      .map((manager) => (
                        <SelectItem key={manager.user_id} value={manager.user_id}>
                          {manager.display_name || `${manager.first_name} ${manager.last_name}`} ({manager.role})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost Codes & Budget Link */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Cost Codes & Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage job cost codes and budget allocations for this project.
            </p>
            <Button onClick={() => navigate(`/jobs/${id}?tab=cost-budget`)}>
              <FileText className="h-4 w-4 mr-2" />
              Manage Cost Codes & Budget
            </Button>
          </CardContent>
        </Card>
      </div>
      </div>
    </DevelopmentFreezeGuard>
  );
}