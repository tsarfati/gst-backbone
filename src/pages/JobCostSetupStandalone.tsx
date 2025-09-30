import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import JobCostSetup from './JobCostSetup';

export default function JobCostSetupStandalone() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Job Cost Setup</h1>
            <p className="text-muted-foreground">
              Configure cost code templates and job costing settings for your company
            </p>
          </div>
        </div>
      </div>
      
      <JobCostSetup />
    </div>
  );
}