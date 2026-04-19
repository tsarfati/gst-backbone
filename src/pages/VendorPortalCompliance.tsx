import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PremiumLoadingScreen } from "@/components/PremiumLoadingScreen";
import { useToast } from "@/hooks/use-toast";
import { useVendorPortalData } from "@/hooks/useVendorPortalData";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function VendorPortalCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { loading, complianceDocs, jobs, uploadComplianceDocument } = useVendorPortalData();
  const [savingType, setSavingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [insuranceExpirationDate, setInsuranceExpirationDate] = useState("");
  const [targetCompanyId, setTargetCompanyId] = useState<string>("all");
  const [targetJobId, setTargetJobId] = useState<string>("all");

  const w9Doc = useMemo(
    () => complianceDocs.find((doc) => doc.type === "w9") || null,
    [complianceDocs],
  );

  const insuranceDocs = useMemo(
    () => complianceDocs.filter((doc) => doc.type === "insurance"),
    [complianceDocs],
  );

  const companyOptions = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((job) => {
      if (job.company_id && job.company_name && !map.has(job.company_id)) {
        map.set(job.company_id, job.company_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => targetCompanyId === "all" || job.company_id === targetCompanyId),
    [jobs, targetCompanyId],
  );

  const handleUpload = async (
    docType: "w9" | "insurance",
    file?: File | null,
  ) => {
    if (!file) return;
    try {
      setSavingType(docType);
      await uploadComplianceDocument(docType, file, {
        expirationDate: docType === "insurance" ? (insuranceExpirationDate || null) : null,
        targetCompanyId: docType === "insurance" && targetCompanyId !== "all" ? targetCompanyId : null,
        targetJobId: docType === "insurance" && targetJobId !== "all" ? targetJobId : null,
        onProgress: (percent) => setUploadProgress(percent),
      });
      if (docType === "insurance") {
        setInsuranceExpirationDate("");
        setTargetCompanyId("all");
        setTargetJobId("all");
      }
      toast({
        title: "Document uploaded",
        description: docType === "w9" ? "W-9 updated successfully." : "Insurance certificate uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error?.message || "Could not upload compliance document.",
        variant: "destructive",
      });
    } finally {
      setSavingType(null);
      setTimeout(() => setUploadProgress(0), 250);
    }
  };

  if (loading) {
    return <PremiumLoadingScreen text="Loading compliance..." />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <Button variant="ghost" className="px-0" onClick={() => navigate("/vendor/dashboard")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Compliance</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>W-9</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">Federal W-9</p>
                <Badge variant={w9Doc?.is_uploaded ? "default" : "outline"}>{w9Doc?.is_uploaded ? "Uploaded" : "Missing"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {w9Doc?.file_name ? w9Doc.file_name : "Upload your current W-9 so builders can review tax details."}
              </p>
            </div>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="max-w-[260px]"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void handleUpload("w9", file);
                event.target.value = "";
              }}
            />
            {savingType === "w9" ? <Progress value={uploadProgress} className="h-2" /> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Insurance Certificates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Expiration Date</Label>
              <Input type="date" value={insuranceExpirationDate} onChange={(e) => setInsuranceExpirationDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Builder Company</Label>
              <Select value={targetCompanyId} onValueChange={(value) => {
                setTargetCompanyId(value);
                setTargetJobId("all");
              }}>
                <SelectTrigger><SelectValue placeholder="All builder companies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">General / Not job specific</SelectItem>
                  {companyOptions.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Job</Label>
              <Select value={targetJobId} onValueChange={setTargetJobId}>
                <SelectTrigger><SelectValue placeholder="Select a job if this COI is job-specific" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">General / Not job specific</SelectItem>
                  {filteredJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.name}{job.company_name ? ` - ${job.company_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void handleUpload("insurance", file);
                  event.target.value = "";
                }}
              />
              {savingType === "insurance" ? <Progress value={uploadProgress} className="h-2" /> : null}
            </div>
          </div>

          {insuranceDocs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No insurance certificates uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {insuranceDocs.map((doc) => {
                const linkedJob = jobs.find((job) => job.id === doc.target_job_id);
                const linkedCompany = companyOptions.find((company) => company.id === doc.target_company_id);
                return (
                  <div key={doc.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{doc.file_name || "Insurance certificate"}</p>
                        <Badge variant={doc.is_uploaded ? "default" : "outline"}>{doc.is_uploaded ? "Uploaded" : "Missing"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {doc.expiration_date ? `Expires ${new Date(doc.expiration_date).toLocaleDateString()}` : "No expiration date set"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {linkedJob
                          ? `Job specific: ${linkedJob.name}`
                          : linkedCompany
                          ? `Builder specific: ${linkedCompany.name}`
                          : "General certificate"}
                      </p>
                    </div>
                    <Button variant="outline" disabled={savingType === "insurance"}>
                      {savingType === "insurance" ? `Uploading ${uploadProgress}%` : "Tracked"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
