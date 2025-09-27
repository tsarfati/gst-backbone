import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Plus, CreditCard, Settings, AlertTriangle, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function CreditCardSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Credit card settings state
  const [settings, setSettings] = useState({
    requireApproval: true,
    approvalThreshold: 500,
    autoCategorizePurchases: true,
    requireReceipts: true,
    overdraftProtection: false,
    lowBalanceAlert: true,
    lowBalanceThreshold: 1000,
    monthlySpendingLimit: 5000,
    defaultCostCode: '',
    defaultJob: '',
    notificationEmails: ['admin@company.com'],
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    // Save settings logic here
    toast({
      title: "Credit card settings saved",
      description: "Your credit card configuration has been updated successfully.",
    });
  };

  const handleAddCreditCard = () => {
    navigate('/banking/credit-cards/add');
  };

  return (
    <div className="space-y-6">
      {/* Add Credit Card Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credit Card Management
          </CardTitle>
          <CardDescription>
            Add new credit cards and manage existing accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add company credit cards to track expenses and manage payments.
            </p>
            <Button onClick={handleAddCreditCard} className="w-fit">
              <Plus className="h-4 w-4 mr-2" />
              Add Credit Card
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Credit Card Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Credit Card Settings
          </CardTitle>
          <CardDescription>
            Configure approval workflows and spending controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Approval Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Approval & Authorization</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-approval">Require approval for purchases</Label>
                <p className="text-xs text-muted-foreground">
                  All credit card purchases above threshold require approval
                </p>
              </div>
              <Switch
                id="require-approval"
                checked={settings.requireApproval}
                onCheckedChange={(checked) => handleSettingChange('requireApproval', checked)}
              />
            </div>

            {settings.requireApproval && (
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="approval-threshold">Approval threshold</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="approval-threshold"
                    type="number"
                    value={settings.approvalThreshold}
                    onChange={(e) => handleSettingChange('approvalThreshold', Number(e.target.value))}
                    className="pl-10"
                    placeholder="500"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Spending Controls */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Spending Controls</h4>
            
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="monthly-limit">Monthly spending limit</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="monthly-limit"
                  type="number"
                  value={settings.monthlySpendingLimit}
                  onChange={(e) => handleSettingChange('monthlySpendingLimit', Number(e.target.value))}
                  className="pl-10"
                  placeholder="5000"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="low-balance-alert">Low balance alerts</Label>
                <p className="text-xs text-muted-foreground">
                  Send notifications when available credit is low
                </p>
              </div>
              <Switch
                id="low-balance-alert"
                checked={settings.lowBalanceAlert}
                onCheckedChange={(checked) => handleSettingChange('lowBalanceAlert', checked)}
              />
            </div>

            {settings.lowBalanceAlert && (
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="low-balance-threshold">Alert threshold</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="low-balance-threshold"
                    type="number"
                    value={settings.lowBalanceThreshold}
                    onChange={(e) => handleSettingChange('lowBalanceThreshold', Number(e.target.value))}
                    className="pl-10"
                    placeholder="1000"
                  />
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Expense Management */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Expense Management</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-categorize">Auto-categorize purchases</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically assign cost codes based on vendor
                </p>
              </div>
              <Switch
                id="auto-categorize"
                checked={settings.autoCategorizePurchases}
                onCheckedChange={(checked) => handleSettingChange('autoCategorizePurchases', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="require-receipts">Require receipt uploads</Label>
                <p className="text-xs text-muted-foreground">
                  All purchases must have receipt documentation
                </p>
              </div>
              <Switch
                id="require-receipts"
                checked={settings.requireReceipts}
                onCheckedChange={(checked) => handleSettingChange('requireReceipts', checked)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="default-cost-code">Default cost code</Label>
                <Select value={settings.defaultCostCode} onValueChange={(value) => handleSettingChange('defaultCostCode', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cost code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="office">Office Expenses</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="materials">Materials</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-job">Default job</Label>
                <Select value={settings.defaultJob} onValueChange={(value) => handleSettingChange('defaultJob', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overhead">Company Overhead</SelectItem>
                    <SelectItem value="admin">Administrative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Security Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Security & Protection</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="overdraft-protection">Overdraft protection</Label>
                <p className="text-xs text-muted-foreground">
                  Prevent charges that would exceed credit limit
                </p>
              </div>
              <Switch
                id="overdraft-protection"
                checked={settings.overdraftProtection}
                onCheckedChange={(checked) => handleSettingChange('overdraftProtection', checked)}
              />
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSaveSettings}>
              Save Credit Card Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}