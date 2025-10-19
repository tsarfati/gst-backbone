import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';
import CompanySettings from '@/components/CompanySettings';
import PayablesSettings from '@/components/PayablesSettings';
import JobSettings from '@/components/JobSettings';
import CreditCardSettings from '@/components/CreditCardSettings';
import PunchClockSettingsComponent from '@/components/PunchClockSettingsComponent';
import CompanySettingsSaveButton from '@/components/CompanySettingsSaveButton';
import JobCostSetup from '@/pages/JobCostSetup';
import { Building, CreditCard, Briefcase, DollarSign, Banknote, Clock, Palette, FileText } from 'lucide-react';
import PdfTemplateSettings from '@/components/PdfTemplateSettings';
import ThemeSettings from '@/pages/ThemeSettings';
import PunchClockSettings from '@/pages/PunchClockSettings';

export default function CompanySettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Check URL params for initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'company';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleSaveSettings = () => {
    toast({
      title: "Company settings saved",
      description: "Your company preferences have been updated successfully.",
    });
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Settings</h1>
            <p className="text-muted-foreground">
              Manage your company-specific configurations and preferences
            </p>
          </div>
          <CompanySettingsSaveButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="company" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Building className="h-4 w-4" />
              Company Info
            </TabsTrigger>
            <TabsTrigger 
              value="payables" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Payables Settings
            </TabsTrigger>
            <TabsTrigger 
              value="credit-cards" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Banknote className="h-4 w-4" />
              Credit Cards
            </TabsTrigger>
            <TabsTrigger 
              value="jobs" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Briefcase className="h-4 w-4" />
              Job Settings
            </TabsTrigger>
            <TabsTrigger 
              value="punch-clock" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              Punch Clock
            </TabsTrigger>
            <TabsTrigger 
              value="theme" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Palette className="h-4 w-4" />
              Theme & Appearance
            </TabsTrigger>
            <TabsTrigger 
              value="templates" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF Templates
            </TabsTrigger>
            <TabsTrigger 
              value="banking" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Banking Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <CompanySettings />
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

          <TabsContent value="credit-cards">
            <Card>
              <CardHeader>
                <CardTitle>Credit Card Settings</CardTitle>
                <CardDescription>
                  Manage credit cards, configure approval workflows, and set spending controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreditCardSettings />
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

          <TabsContent value="punch-clock">
            <PunchClockSettings />
          </TabsContent>

          <TabsContent value="theme">
            <ThemeSettings embedded />
          </TabsContent>

          <TabsContent value="templates">
            <PdfTemplateSettings />
          </TabsContent>

          <TabsContent value="banking">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Chart of Accounts</CardTitle>
                  <CardDescription>
                    Manage your company's chart of accounts and accounting structure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Set up and manage your company's chart of accounts for proper financial tracking and reporting.
                    </p>
                    <Button 
                      onClick={() => navigate('/settings/company/chart-of-accounts')}
                      variant="outline"
                    >
                      Manage Chart of Accounts
                    </Button>
                  </div>
                </CardContent>
              </Card>

               <Card>
                <CardHeader>
                  <CardTitle>Bank Accounts</CardTitle>
                  <CardDescription>
                    Add and manage your company's bank accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Add new bank accounts which will automatically create associated cash accounts in your chart of accounts.
                    </p>
                    <Button 
                      onClick={() => navigate('/banking/accounts/add')}
                      variant="outline"
                    >
                      Add Bank Account
                    </Button>
                  </div>
                </CardContent>
               </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}