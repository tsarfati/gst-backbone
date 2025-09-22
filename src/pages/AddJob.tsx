import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building, ArrowLeft, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import CostCodeManager from "@/components/CostCodeManager";
import JobBudgetManager from "@/components/JobBudgetManager";

export default function AddJob() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [managers, setManagers] = useState<{ user_id: string; display_name: string | null; first_name: string | null; last_name: string | null; role: string }[]>([]);
  const [loadingManagers, setLoadingManagers] = useState(false);
  
  const [formData, setFormData] = useState({
    jobName: "",
    client: "",
    address: "",
    jobType: "residential",
    startDate: "",
    endDate: "",
    budget: "",
    description: "",
    projectManagerId: "",
    status: "planning"
  });
  
  const [costCodes, setCostCodes] = useState<Array<{ id: string; code: string; description: string }>>([]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    const fetchManagers = async () => {
      setLoadingManagers(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, role')
        .in('role', ['admin', 'controller']);
      if (!error && data) setManagers(data as any);
      setLoadingManagers(false);
    };
    fetchManagers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Not signed in", description: "Please sign in to create a job.", variant: "destructive" });
      return;
    }

    const budgetNumber = formData.budget ? Number(String(formData.budget).replace(/[^0-9.]/g, '')) : null;

    const { error } = await supabase.from('jobs').insert({
      name: formData.jobName,
      client: formData.client,
      address: formData.address,
      job_type: formData.jobType as any,
      status: formData.status as any,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      budget: budgetNumber,
      description: formData.description,
      project_manager_user_id: formData.projectManagerId || null,
      created_by: user.id,
    } as any);

    if (error) {
      toast({ title: "Error creating job", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Job created", description: "New job has been successfully created" });
    navigate("/jobs");
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate("/jobs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Job</h1>
          <p className="text-muted-foreground">Create a new job or project</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Job Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobName">Job Name *</Label>
                <Input
                  id="jobName"
                  value={formData.jobName}
                  onChange={(e) => handleInputChange("jobName", e.target.value)}
                  placeholder="Enter job name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Input
                  id="client"
                  value={formData.client}
                  onChange={(e) => handleInputChange("client", e.target.value)}
                  placeholder="Enter client name"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Job Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Enter job site address"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobType">Job Type</Label>
                <Select value={formData.jobType} onValueChange={(value) => handleInputChange("jobType", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="renovation">Renovation</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Project Details */}
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange("startDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange("endDate", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget">Budget</Label>
                <Input
                  id="budget"
                  value={formData.budget}
                  onChange={(e) => handleInputChange("budget", e.target.value)}
                  placeholder="$0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectManager">Project Manager</Label>
                <Select value={formData.projectManagerId} onValueChange={(v) => handleInputChange("projectManagerId", v)}>
                  <SelectTrigger id="projectManager">
                    <SelectValue placeholder={loadingManagers ? "Loading..." : "Select a project manager"} />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.display_name || `${m.first_name || ''} ${m.last_name || ''}`.trim()} ({m.role})
                      </SelectItem>
                    ))}
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
                placeholder="Enter job description and details"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Job Banner */}
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

        {/* Cost Codes */}
        <CostCodeManager 
          costCodes={costCodes} 
          onCostCodesChange={setCostCodes} 
        />

        {/* Job Budget Section */}
        <div className="p-6 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
          <p className="text-muted-foreground">Budget setup will be available after creating the job</p>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3">
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" />
            Create Job
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/jobs")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}