import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, DollarSign, Receipt } from "lucide-react";

interface Job {
  id: string;
  name: string;
  budget: string;
  spent: string;
  receipts: number;
  startDate: string;
  status: string;
}

interface JobCompactViewProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

export default function JobCompactView({ jobs, onJobClick }: JobCompactViewProps) {
  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const budgetUsage = Math.round((parseInt(job.spent.replace(/[$,]/g, '')) / parseInt(job.budget.replace(/[$,]/g, ''))) * 100);
        
        return (
          <Card key={job.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onJobClick(job)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{job.name}</span>
                      <Badge variant={job.status === "active" ? "default" : "success"} className="text-xs">
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        <span>{job.spent} / {job.budget}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        <span>{job.receipts} receipts</span>
                      </div>
                      <span>Started {job.startDate}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, budgetUsage)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground w-10 text-right">{budgetUsage}%</span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobClick(job);
                    }}
                  >
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}