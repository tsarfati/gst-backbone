import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Receipt, DollarSign, Calendar } from "lucide-react";

interface Job {
  id: string;
  name: string;
  budget: string;
  spent: string;
  receipts: number;
  startDate: string;
  status: string;
  banner_url?: string | null;
}

interface JobCardProps {
  job: Job;
  onClick: () => void;
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const spentValue = parseInt(job.spent.replace(/[$,]/g, '')) || 0;
  const budgetValue = parseInt(job.budget.replace(/[$,]/g, '')) || 0;
  const budgetUsage = budgetValue > 0 ? Math.round((spentValue / budgetValue) * 100) : 0;

  return (
    <Card className="hover-card cursor-pointer animate-fade-in overflow-hidden" onClick={onClick}>
      {/* Banner Image */}
      {job.banner_url ? (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={job.banner_url}
            alt={`${job.name} banner`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="h-32 w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <FolderOpen className="h-12 w-12 text-primary/40" />
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <FolderOpen className="h-5 w-5 mr-2 text-primary" />
            {job.name}
          </CardTitle>
          <Badge variant={job.status === "active" ? "default" : "success"}>
            {job.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <DollarSign className="h-3 w-3 mr-1" />
              Budget
            </div>
            <div className="font-semibold">{job.budget}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <DollarSign className="h-3 w-3 mr-1" />
              Spent
            </div>
            <div className="font-semibold">{job.spent}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Receipt className="h-3 w-3 mr-1" />
              Receipts
            </div>
            <div className="font-semibold">{job.receipts}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="h-3 w-3 mr-1" />
              Started
            </div>
            <div className="font-semibold">{job.startDate}</div>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex justify-between text-sm text-muted-foreground mb-1">
            <span>Budget Usage</span>
            <span>{budgetUsage}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, budgetUsage)}%` }}
            />
          </div>
        </div>

        <Button 
          variant="outline" 
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
}