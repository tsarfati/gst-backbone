import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import CompanySettings from '@/components/CompanySettings';
import PayablesSettings from '@/components/PayablesSettings';
import PaymentTermsSettings from '@/components/PaymentTermsSettings';
import CreditCardSettings from '@/components/CreditCardSettings';
import CompanySettingsSaveButton from '@/components/CompanySettingsSaveButton';
import { CreditCard, DollarSign, Banknote, FileText, Building2, Palette } from 'lucide-react';
import AccrualAccountingSettings from '@/components/AccrualAccountingSettings';
import AIAInvoiceTemplateSettings from '@/components/AIAInvoiceTemplateSettings';
import PdfTemplateSettings from '@/components/PdfTemplateSettings';
import ThemeSettings from '@/pages/ThemeSettings';
import { useCompany } from '@/contexts/CompanyContext';

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  
  // Check URL params for initial tab
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  return (
    <div className="p-4 md:p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Settings</h1>
          </div>
          <CompanySettingsSaveButton />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Building2 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="payables" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              Payables
            </TabsTrigger>
            <TabsTrigger 
              value="receivable-settings" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              Receivables
            </TabsTrigger>
            <TabsTrigger 
              value="banking" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <DollarSign className="h-4 w-4" />
              Banking
            </TabsTrigger>
            <TabsTrigger 
              value="credit-cards" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Banknote className="h-4 w-4" />
              Credit Cards
            </TabsTrigger>
            <TabsTrigger 
              value="theme" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <Palette className="h-4 w-4" />
              Themes & Appearance
            </TabsTrigger>
            <TabsTrigger 
              value="pdf-templates" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent hover:text-primary transition-colors flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              PDF Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    Primary company details used across the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Company Name</Label>
                    <p className="text-sm">{currentCompany?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
                    <p className="text-sm">{currentCompany?.display_name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                    <p className="text-sm">{currentCompany?.phone || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                    <p className="text-sm break-all">{currentCompany?.email || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Website</Label>
                    <p className="text-sm break-all">{currentCompany?.website || 'Not set'}</p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground">Address</Label>
                    <p className="text-sm">
                      {[
                        currentCompany?.address,
                        [currentCompany?.city, currentCompany?.state].filter(Boolean).join(', '),
                        currentCompany?.zip_code,
                      ].filter(Boolean).join(' ') || 'Not set'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <CompanySettings
                showCheckPickupLocations={false}
                showBillApprovalSettings={false}
                showJournalEntrySettings={false}
              />
            </div>
          </TabsContent>


          <TabsContent value="payables">
            <div className="space-y-6">
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

              <PaymentTermsSettings />

              <CompanySettings
                showBranding={false}
                showJournalEntrySettings={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="receivable-settings">
            <Tabs defaultValue="aia-invoice-templates" className="space-y-4">
              <TabsList>
                <TabsTrigger value="aia-invoice-templates">AIA Invoice Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="aia-invoice-templates">
                <AIAInvoiceTemplateSettings />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="theme">
            <ThemeSettings embedded />
          </TabsContent>

          <TabsContent value="pdf-templates">
            <PdfTemplateSettings />
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

          <TabsContent value="banking">
            <div className="space-y-6">
              <CompanySettings
                showBranding={false}
                showCheckPickupLocations={false}
                showBillApprovalSettings={false}
              />

              <AccrualAccountingSettings />

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
