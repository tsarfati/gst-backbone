import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function CompanySwitcher() {
  const { currentCompany, userCompanies, loading, switchCompany } = useCompany();
  const { user } = useAuth();

  // Don't render until user is authenticated
  if (!user || loading || !currentCompany || userCompanies.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Show company switcher only if user has access to multiple companies
  if (userCompanies.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Avatar className="h-6 w-6">
          <AvatarImage src={currentCompany.logo_url || undefined} />
          <AvatarFallback className="text-xs bg-primary/10">
            <Building2 className="h-3 w-3" />
          </AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">
          {currentCompany.display_name || currentCompany.name}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-muted/50"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={currentCompany.logo_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10">
              <Building2 className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">
            {currentCompany.display_name || currentCompany.name}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 bg-background border shadow-lg" align="start">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">Switch Company</p>
            <p className="text-xs text-muted-foreground">
              Select which company to view
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {userCompanies.map((company) => (
          <DropdownMenuItem
            key={company.company_id}
            onClick={() => switchCompany(company.company_id)}
            className={cn(
              "flex items-center gap-2 p-2 cursor-pointer",
              currentCompany.id === company.company_id && "bg-muted"
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={undefined} />
              <AvatarFallback className="text-xs bg-primary/10">
                <Building2 className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{company.company_name}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {company.role}
              </p>
            </div>
            {currentCompany.id === company.company_id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}