import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import JobViewSelector, { ViewType } from "@/components/JobViewSelector";
import JobCard from "@/components/JobCard";
import JobListView from "@/components/JobListView";
import JobCompactView from "@/components/JobCompactView";

const mockJobs = [
  {
    id: "1",
    name: "Office Renovation",
    budget: "$25,000",
    spent: "$18,450",
    receipts: 8,
    startDate: "2024-01-01",
    status: "active"
  },
  {
    id: "2",
    name: "Warehouse Project",
    budget: "$50,000",
    spent: "$32,100",
    receipts: 15,
    startDate: "2023-12-15",
    status: "active"
  },
  {
    id: "3",
    name: "Retail Buildout",
    budget: "$15,000",
    spent: "$14,800",
    receipts: 4,
    startDate: "2024-01-10",
    status: "completed"
  },
];

export default function Jobs() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ViewType>("tiles");

  const handleJobClick = (job: any) => {
    navigate(`/jobs/${job.id}`);
  };

  const renderJobs = () => {
    switch (currentView) {
      case "tiles":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockJobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => handleJobClick(job)} />
            ))}
          </div>
        );
      case "list":
        return <JobListView jobs={mockJobs} onJobClick={handleJobClick} />;
      case "compact":
        return <JobCompactView jobs={mockJobs} onJobClick={handleJobClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">
            Manage projects and view associated receipts
          </p>
        </div>
        <div className="flex items-center gap-4">
          <JobViewSelector currentView={currentView} onViewChange={setCurrentView} />
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>
      </div>

      {renderJobs()}
    </div>
  );
}