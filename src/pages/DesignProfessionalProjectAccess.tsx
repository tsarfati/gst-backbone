import { useNavigate } from "react-router-dom";
import { Briefcase, Share2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DesignProfessionalProjectAccess() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Project Access</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Design professional access is managed from each project, not from a separate company user-management screen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            How Access Works
          </CardTitle>
          <CardDescription>
            Invite people to the specific projects they should work on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
            <p className="text-sm">
              Use each job to manage who can work on that project. That keeps access simple and gives project-level control.
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>Builder-owned jobs: the builder invites the design professional users who should have access.</li>
              <li>Design-pro-owned jobs: invite your own coworkers directly to that project.</li>
              <li>Same-company coworkers do not need to be set up here first. Just invite them from the project workflow.</li>
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Open Jobs
                </CardTitle>
                <CardDescription>
                  Open a job to review project details and manage who is involved on that project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate("/design-professional/jobs")}>
                  Open Jobs
                </Button>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Company Settings
                </CardTitle>
                <CardDescription>
                  Keep company profile and branding here. User access is still managed from projects.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => navigate("/design-professional/settings/company")}>
                  Open Company Settings
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
