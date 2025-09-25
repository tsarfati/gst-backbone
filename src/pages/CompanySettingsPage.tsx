import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import CompanySettings from '@/components/CompanySettings';
import PayablesSettings from '@/components/PayablesSettings';
import JobSettings from '@/components/JobSettings';
import { Building, CreditCard, Briefcase } from 'lucide-react';

export default function CompanySettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("company");

  const handleSaveSettings = () => {
    toast({
      title: "Company settings saved",
      description: "Your company preferences have been updated successfully.",
    });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage your company-specific configurations and preferences
          </p>
        </div>
        
        <div className="flex items-center justify-end">
          <Button onClick={handleSaveSettings}>Save Changes</Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company Info
            </TabsTrigger>
            <TabsTrigger value="payables" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Payables Settings
            </TabsTrigger>
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Job Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Configuration</CardTitle>
                <CardDescription>
                  Configure basic company information and general settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompanySettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payables">
            <Card>
              <CardHeader>
                <CardTitle>Payables & Payment Settings</CardTitle>
                <CardDescription>
                  Configure approval workflows, thresholds, and payment processing settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PayablesSettings />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle>Job Management Settings</CardTitle>
                <CardDescription>
                  Configure job creation, budget approvals, time tracking, and workflow settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <JobSettings />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}