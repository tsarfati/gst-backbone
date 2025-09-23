import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useComplianceWarnings(vendorIds: string[]) {
  const [warnings, setWarnings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendorIds.length === 0) {
      setWarnings({});
      return;
    }

    const fetchWarnings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendor_compliance_documents')
          .select('vendor_id, type, is_required, is_uploaded')
          .in('vendor_id', vendorIds);

        if (error) throw error;

        const warningsMap: Record<string, number> = {};
        
        vendorIds.forEach(vendorId => {
          const vendorDocs = data?.filter(doc => doc.vendor_id === vendorId) || [];
          const missingRequired = vendorDocs.filter(doc => 
            doc.is_required && !doc.is_uploaded
          ).length;
          
          if (missingRequired > 0) {
            warningsMap[vendorId] = missingRequired;
          }
        });

        setWarnings(warningsMap);
      } catch (error) {
        console.error('Error fetching compliance warnings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarnings();
  }, [vendorIds]);

  return { warnings, loading };
}

export function useVendorCompliance(vendorId: string) {
  const [missingCount, setMissingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId) {
      setMissingCount(0);
      return;
    }

    const fetchCompliance = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('vendor_compliance_documents')
          .select('type, is_required, is_uploaded')
          .eq('vendor_id', vendorId);

        if (error) throw error;

        const missing = (data || []).filter(doc => 
          doc.is_required && !doc.is_uploaded
        ).length;

        setMissingCount(missing);
      } catch (error) {
        console.error('Error fetching vendor compliance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompliance();
  }, [vendorId]);

  return { missingCount, loading };
}