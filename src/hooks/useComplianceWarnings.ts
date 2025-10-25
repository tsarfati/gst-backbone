import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ComplianceWarning {
  id: string;
  vendor_id: string;
  vendor_name: string;
  type: string;
  expiration_date: string | null;
  is_expired: boolean;
  days_until_expiration: number | null;
  warning_level: 'missing_required' | 'expired' | 'expiring_soon' | 'compliant';
  warning_message: string;
  file_name: string | null;
  file_url: string | null;
}

export function useComplianceWarnings(vendorIds: string[]) {
  const [warnings, setWarnings] = useState<Record<string, number>>({});
  const [detailedWarnings, setDetailedWarnings] = useState<ComplianceWarning[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (vendorIds.length === 0) {
      setWarnings({});
      setDetailedWarnings([]);
      return;
    }

    const fetchWarnings = async () => {
      setLoading(true);
      try {
        // Fetch basic compliance document data
        const { data, error } = await supabase
          .from('vendor_compliance_documents')
          .select('vendor_id, type, is_required, is_uploaded, expiration_date')
          .in('vendor_id', vendorIds);

        if (error) throw error;

        const warningsMap: Record<string, number> = {};
        
        vendorIds.forEach(vendorId => {
          const vendorDocs = data?.filter(doc => doc.vendor_id === vendorId) || [];
          let warningCount = 0;
          
          vendorDocs.forEach(doc => {
            // Count missing required documents
            if (doc.is_required && !doc.is_uploaded) {
              warningCount++;
            }
            // Count expired documents
            if (doc.expiration_date && new Date(doc.expiration_date) < new Date()) {
              warningCount++;
            }
            // Count expiring soon (within 30 days)
            if (doc.expiration_date) {
              const daysUntil = Math.floor((new Date(doc.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              if (daysUntil > 0 && daysUntil <= 30) {
                warningCount++;
              }
            }
          });
          
          if (warningCount > 0) {
            warningsMap[vendorId] = warningCount;
          }
        });

        // Fetch detailed warnings from the view
        const { data: detailedData, error: detailedError } = await supabase
          .from('vendor_compliance_warnings')
          .select('*')
          .in('vendor_id', vendorIds);

        if (!detailedError && detailedData) {
          setDetailedWarnings(detailedData as ComplianceWarning[]);
        }

        setWarnings(warningsMap);
      } catch (error) {
        console.error('Error fetching compliance warnings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWarnings();
  }, [vendorIds]);

  return { warnings, detailedWarnings, loading };
}

export function useVendorCompliance(vendorId: string) {
  const [missingCount, setMissingCount] = useState(0);
  const [expiredCount, setExpiredCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [totalWarnings, setTotalWarnings] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailedWarnings, setDetailedWarnings] = useState<ComplianceWarning[]>([]);

  useEffect(() => {
    if (!vendorId) {
      setMissingCount(0);
      setExpiredCount(0);
      setExpiringSoonCount(0);
      setTotalWarnings(0);
      setDetailedWarnings([]);
      return;
    }

    const fetchCompliance = async () => {
      setLoading(true);
      try {
        // Get detailed warnings from the view
        const { data: warningsData, error: warningsError } = await supabase
          .from('vendor_compliance_warnings')
          .select('*')
          .eq('vendor_id', vendorId);

        if (warningsError) throw warningsError;

        const warnings = (warningsData || []) as ComplianceWarning[];
        setDetailedWarnings(warnings);

        const missing = warnings.filter(w => w.warning_level === 'missing_required').length;
        const expired = warnings.filter(w => w.warning_level === 'expired').length;
        const expiringSoon = warnings.filter(w => w.warning_level === 'expiring_soon').length;

        setMissingCount(missing);
        setExpiredCount(expired);
        setExpiringSoonCount(expiringSoon);
        setTotalWarnings(warnings.length);
      } catch (error) {
        console.error('Error fetching vendor compliance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompliance();
  }, [vendorId]);

  return { 
    missingCount, 
    expiredCount, 
    expiringSoonCount, 
    totalWarnings,
    detailedWarnings,
    loading 
  };
}