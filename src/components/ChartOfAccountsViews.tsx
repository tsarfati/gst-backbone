import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, Building2, Landmark, TrendingUp, TrendingDown, CreditCard, Wallet, DollarSign, Paperclip } from 'lucide-react';

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  account_category: string | null;
  current_balance: number;
  normal_balance: string | null;
  is_active: boolean;
  is_system_account: boolean;
  require_attachment?: boolean;
}

interface ChartOfAccountsViewsProps {
  accounts: Account[];
  onEdit: (account: Account) => void;
  formatCurrency: (amount: number) => string;
  getAccountTypeIcon: (type: string) => any;
}

export function ChartOfAccountsListView({ accounts, onEdit, formatCurrency, getAccountTypeIcon }: ChartOfAccountsViewsProps) {
  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 text-left text-sm font-medium">Number</th>
            <th className="p-3 text-left text-sm font-medium">Name</th>
            <th className="p-3 text-left text-sm font-medium">Type</th>
            <th className="p-3 text-left text-sm font-medium">Category</th>
            <th className="p-3 text-right text-sm font-medium">Balance</th>
            <th className="p-3 text-center text-sm font-medium">Normal Balance</th>
            <th className="p-3 text-center text-sm font-medium">Require Attachment</th>
            <th className="p-3 text-center text-sm font-medium">Status</th>
            <th className="p-3 text-center text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((account) => (
            <tr key={account.id} className="border-t hover:bg-primary/10">
              <td className="p-3 text-sm font-mono">{account.account_number}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  {getAccountTypeIcon(account.account_type)}
                  <span className="font-medium">{account.account_name}</span>
                </div>
              </td>
              <td className="p-3">
                <Badge variant="outline" className="capitalize">
                  {account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type}
                </Badge>
              </td>
              <td className="p-3 text-sm text-muted-foreground capitalize">
                {account.account_category?.replace(/_/g, ' ') || '-'}
              </td>
              <td className="p-3 text-right font-mono">
                {formatCurrency(account.current_balance)}
              </td>
              <td className="p-3 text-center">
                <Badge variant={account.normal_balance === 'debit' ? 'default' : 'secondary'}>
                  {account.normal_balance}
                </Badge>
              </td>
              <td className="p-3 text-center">
                {(account.require_attachment ?? true) ? (
                  <Paperclip className="h-4 w-4 inline-block text-primary" />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
              <td className="p-3 text-center">
                <Badge variant={account.is_active ? 'default' : 'secondary'}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </td>
              <td className="p-3 text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(account)}
                  disabled={account.is_system_account}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartOfAccountsCompactView({ accounts, onEdit, formatCurrency, getAccountTypeIcon }: ChartOfAccountsViewsProps) {
  return (
    <div className="space-y-2">
      {accounts.map((account) => (
        <Card key={account.id} className="p-3 hover:bg-primary/10 hover:border-primary transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                {getAccountTypeIcon(account.account_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{account.account_number}</span>
                  <span className="font-medium truncate">{account.account_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize text-xs">
                    {account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type}
                  </Badge>
                  {account.account_category && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {account.account_category.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="font-mono font-medium">{formatCurrency(account.current_balance)}</div>
                <Badge variant={account.normal_balance === 'debit' ? 'default' : 'secondary'} className="text-xs">
                  {account.normal_balance}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(account)}
                disabled={account.is_system_account}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function ChartOfAccountsSuperCompactView({ accounts, onEdit, formatCurrency, getAccountTypeIcon }: ChartOfAccountsViewsProps) {
  const getAccountTypeBadgeColor = (type: string, category: string | null) => {
    const displayType = type === 'asset' && category === 'cash_accounts' ? 'cash' : type;
    
    switch (displayType) {
      case 'asset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-800';
      case 'liability':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'equity':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800';
      case 'revenue':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-200 dark:border-green-800';
      case 'expense':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800';
      case 'cost_of_goods_sold':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800';
      case 'cash':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border-gray-200 dark:border-gray-800';
    }
  };

  return (
    <div className="space-y-1">
      {accounts.map((account) => {
        const displayType = account.account_type === 'asset' && account.account_category === 'cash_accounts' ? 'cash' : account.account_type;
        
        return (
          <div 
            key={account.id} 
            className="grid grid-cols-[auto_1fr_120px_80px_40px] items-center gap-2 p-2 rounded hover:bg-primary/10 hover:border-primary transition-colors border"
          >
            <div className="flex-shrink-0">
              {getAccountTypeIcon(account.account_type)}
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs text-muted-foreground">{account.account_number}</span>
              <span className="text-sm truncate">{account.account_name}</span>
            </div>
            <div className="flex justify-center">
              <Badge 
                variant="outline" 
                className={`capitalize text-xs ${getAccountTypeBadgeColor(account.account_type, account.account_category)}`}
              >
                {displayType.replace(/_/g, ' ')}
              </Badge>
            </div>
            <span className="font-mono text-sm text-right">{formatCurrency(account.current_balance)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(account)}
              disabled={account.is_system_account}
              className="h-6 w-6 p-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
