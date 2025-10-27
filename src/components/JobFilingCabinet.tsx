import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import JobDeliveryTicketsView from "./JobDeliveryTicketsView";
import JobPermits from "./JobPermits";
import { FileText, Truck } from "lucide-react";

interface JobFilingCabinetProps {
  jobId: string;
}

export default function JobFilingCabinet({ jobId }: JobFilingCabinetProps) {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="delivery-tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="delivery-tickets" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery Tickets
          </TabsTrigger>
          <TabsTrigger value="permits" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Permits
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="delivery-tickets" className="mt-6">
          <JobDeliveryTicketsView />
        </TabsContent>
        
        <TabsContent value="permits" className="mt-6">
          <JobPermits jobId={jobId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
