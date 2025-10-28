import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";

interface Job {
  id: string;
  name: string;
  budget: string;
  spent: string;
  receipts: number;
  startDate: string;
  status: string;
}

interface JobListViewProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

export default function JobListView({ jobs, onJobClick }: JobListViewProps) {
  return (
    <div className="border border-border rounded-md">
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          <TableRow>
            <TableHead>Job Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Spent</TableHead>
            <TableHead>Usage</TableHead>
            <TableHead>Receipts</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const budgetUsage = Math.round((parseInt(job.spent.replace(/[$,]/g, '')) / parseInt(job.budget.replace(/[$,]/g, ''))) * 100);
            
            return (
              <TableRow key={job.id} className="cursor-pointer hover:bg-primary/5 transition-colors" onClick={() => onJobClick(job)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium group-hover:text-primary transition-colors">{job.name}</span>
                  </div>
                </TableCell>
                <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                  <Badge variant={job.status === "active" ? "default" : "success"}>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{job.budget}</TableCell>
                <TableCell className="font-medium border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{job.spent}</TableCell>
                <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, budgetUsage)}%` }}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground">{budgetUsage}%</span>
                  </div>
                </TableCell>
                <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{job.receipts}</TableCell>
                <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">{job.startDate}</TableCell>
                <TableCell className="border-y border-transparent group-hover:border-primary first:border-l first:border-l-transparent first:group-hover:border-l-primary first:rounded-l-lg last:border-r last:border-r-transparent last:group-hover:border-r-primary last:rounded-r-lg">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJobClick(job);
                    }}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}