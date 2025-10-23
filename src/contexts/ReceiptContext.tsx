import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';

export interface Receipt {
  id: string;
  company_id: string;
  created_by: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  amount?: string; // Changed back to string for legacy compatibility
  vendor_name?: string;
  receipt_date?: string;
  job_id?: string;
  cost_code_id?: string;
  notes?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  job?: { id: string; name: string };
  costCode?: { id: string; description: string };
  // Legacy fields for compatibility
  filename: string;
  date: string;
  vendor?: string;
  type: 'image' | 'pdf';
  previewUrl?: string;
  uploadedBy?: string;
  uploadedDate?: Date;
  assignedUser?: {
    id: string;
    name: string;
    role: string;
    assignedDate: Date;
  };
}

export interface ReceiptMessage {
  id: string;
  receipt_id: string;
  from_user_id: string;
  message: string;
  created_at: string;
  // Legacy fields for compatibility
  receiptId: string;
  userId: string;
  userName: string;
  timestamp: Date;
  type: 'message' | 'assignment' | 'coding' | 'status';
}

export interface CodedReceipt extends Receipt {
  jobName: string;
  costCodeName: string;
  codedBy: string;
  codedDate: Date;
  vendorId?: string;
}

interface ReceiptContextType {
  uncodedReceipts: Receipt[];
  codedReceipts: CodedReceipt[];
  messages: ReceiptMessage[];
  addReceipts: (files: FileList, amounts?: number[], receiptData?: {
    vendor?: string;
    job?: string;
    costCode?: string;
    date?: string;
  }[]) => Promise<void>;
  codeReceipt: (receiptId: string, job: string, costCode: string, codedBy: string, vendorId?: string, newAmount?: string) => void;
  uncodeReceipt: (receiptId: string) => void;
  assignReceipt: (receiptId: string, userId: string, userName: string, userRole: string) => void;
  unassignReceipt: (receiptId: string) => void;
  addMessage: (receiptId: string, message: string, userId: string, userName: string, type?: 'message' | 'assignment' | 'coding' | 'status') => void;
  deleteReceipt: (receiptId: string) => void;
  refreshReceipts: () => Promise<void>;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  
  const [uncodedReceipts, setUncodedReceipts] = useState<Receipt[]>([]);
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [messages, setMessages] = useState<ReceiptMessage[]>([]);

  // Load receipts from database
  const refreshReceipts = useCallback(async () => {
    if (!user || !currentCompany) return;

    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch job and cost code details for coded receipts
      const jobIds = [...new Set(receipts?.filter(r => r.job_id).map(r => r.job_id))];
      const costCodeIds = [...new Set(receipts?.filter(r => r.cost_code_id).map(r => r.cost_code_id))];
      
      const jobsMap = new Map();
      const costCodesMap = new Map();
      
      if (jobIds.length > 0) {
        const { data: jobsData } = await supabase
          .from('jobs')
          .select('id, name')
          .in('id', jobIds);
        jobsData?.forEach(job => jobsMap.set(job.id, job));
      }
      
      if (costCodeIds.length > 0) {
        const { data: costCodesData } = await supabase
          .from('cost_codes')
          .select('id, code, description')
          .in('id', costCodeIds);
        costCodesData?.forEach(cc => costCodesMap.set(cc.id, cc));
      }

      // Fetch user profiles for uploadedBy
      const userIds = [...new Set(receipts?.map(r => r.created_by).filter(Boolean))];
      const profilesMap = new Map();
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);
        profilesData?.forEach(p => {
          const name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
          profilesMap.set(p.user_id, name || 'User');
        });
      }

      const processedReceipts = (receipts || []).map(receipt => ({
        ...receipt,
        // Legacy compatibility fields
        filename: receipt.file_name,
        date: receipt.receipt_date || new Date(receipt.created_at).toISOString().split('T')[0],
        vendor: receipt.vendor_name,
        type: receipt.file_name.toLowerCase().includes('.pdf') ? 'pdf' as const : 'image' as const,
        previewUrl: receipt.file_url,
        uploadedBy: profilesMap.get(receipt.created_by) || 'User',
        uploadedDate: new Date(receipt.created_at),
        amount: receipt.amount !== null && receipt.amount !== undefined ? receipt.amount.toString() : undefined
      }));

      const uncoded = processedReceipts.filter(r => r.status === 'uncoded');
      const coded = processedReceipts.filter(r => r.status !== 'uncoded').map(r => {
        const job = r.job_id ? jobsMap.get(r.job_id) : null;
        const costCode = r.cost_code_id ? costCodesMap.get(r.cost_code_id) : null;
        return {
          ...r,
          jobName: job?.name || '',
          costCodeName: costCode ? `${costCode.code} - ${costCode.description}` : '',
          codedBy: profilesMap.get(r.created_by) || 'User',
          codedDate: new Date(r.updated_at),
          vendorId: r.vendor_id || r.vendor_name // Use vendor_id if available, fallback to vendor_name
        };
      });

      setUncodedReceipts(uncoded);
      setCodedReceipts(coded);

      // Load messages
      const { data: messageData, error: messageError } = await supabase
        .from('receipt_messages')
        .select('*')
        .in('receipt_id', processedReceipts.map(r => r.id))
        .order('created_at', { ascending: true });

      if (!messageError) {
        const processedMessages = (messageData || []).map(msg => ({
          ...msg,
          // Legacy compatibility fields
          receiptId: msg.receipt_id,
          userId: msg.from_user_id,
          userName: 'User', // This would need profile join
          timestamp: new Date(msg.created_at),
          type: 'message' as const
        }));
        setMessages(processedMessages);
      }
    } catch (error) {
      console.error('Failed to load receipts:', error);
    }
  }, [user, currentCompany]);

  useEffect(() => {
    refreshReceipts();
    // Only refetch when auth user or company actually changes to avoid duplicate calls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentCompany?.id]);

  const addReceipts = useCallback(async (files: FileList, amounts?: number[], receiptData?: {
    vendor?: string;
    job?: string;
    costCode?: string;
    date?: string;
  }[]) => {
    if (!user || !currentCompany) {
      console.error('User not authenticated or no company selected');
      return;
    }

    // Fetch file upload settings to get naming pattern
    const { data: settings } = await supabase
      .from('file_upload_settings')
      .select('receipt_naming_pattern')
      .eq('company_id', currentCompany.id)
      .single();

    const filesArray = Array.from(files);
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const amount = amounts?.[i];
      const data = receiptData?.[i];
      
      try {
        // Upload to Supabase storage
        const fileExt = file.name.split('.').pop();
        
        // Apply naming pattern if available
        let displayName = file.name;
        if (settings?.receipt_naming_pattern) {
          const today = new Date();
          const dateStr = data?.date || today.toISOString().split('T')[0]; // YYYY-MM-DD
          
          displayName = settings.receipt_naming_pattern
            .replace('{date}', dateStr)
            .replace('{amount}', amount ? amount.toFixed(2) : 'unknown')
            .replace('{vendor}', data?.vendor || 'unknown')
            .replace('{job}', data?.job || 'unknown')
            .replace('{cost_code}', data?.costCode || 'unknown')
            .replace('{original_filename}', file.name.replace(/\.[^/.]+$/, '')) // filename without extension
            + '.' + fileExt;
        }
        
        const storageFileName = `${currentCompany.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error } = await supabase.storage
          .from('receipts')
          .upload(storageFileName, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(storageFileName);

        // Insert into database with formatted name
        const { error: insertError } = await supabase
          .from('receipts')
          .insert({
            company_id: currentCompany.id,
            created_by: user.id,
            file_name: displayName,
            file_url: publicUrlData.publicUrl,
            file_size: file.size,
            amount: amount,
            status: 'uncoded'
          });

        if (insertError) {
          console.error('Database insert error:', insertError);
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error);
      }
    }

    await refreshReceipts(); // Refresh to get latest data
  }, [user, currentCompany, refreshReceipts]);

  const codeReceipt = useCallback(async (receiptId: string, job: string, costCode: string, codedBy: string, vendorId?: string, newAmount?: string) => {
    try {
      const amount = newAmount ? parseFloat(newAmount) : undefined;
      const { error } = await supabase
        .from('receipts')
        .update({
          amount,
          vendor_name: vendorId,
          job_id: job, // Assuming job is the ID
          cost_code_id: costCode, // Assuming costCode is the ID
          status: 'coded'
        })
        .eq('id', receiptId);

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to code receipt:', error);
    }
  }, [refreshReceipts]);

  const uncodeReceipt = useCallback(async (receiptId: string) => {
    try {
      const { error } = await supabase
        .from('receipts')
        .update({
          amount: null,
          vendor_name: null,
          receipt_date: null,
          job_id: null,
          cost_code_id: null,
          notes: null,
          status: 'uncoded'
        })
        .eq('id', receiptId);

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to uncode receipt:', error);
    }
  }, [refreshReceipts]);

  const assignReceipt = useCallback(async (receiptId: string, userId: string, userName: string, userRole: string) => {
    try {
      const { error } = await supabase
        .from('receipts')
        .update({ assigned_to: userId })
        .eq('id', receiptId);

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to assign receipt:', error);
    }
  }, [refreshReceipts]);

  const unassignReceipt = useCallback(async (receiptId: string) => {
    try {
      const { error } = await supabase
        .from('receipts')
        .update({ assigned_to: null })
        .eq('id', receiptId);

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to unassign receipt:', error);
    }
  }, [refreshReceipts]);

  const addMessage = useCallback(async (receiptId: string, message: string, userId: string, userName: string, type: 'message' | 'assignment' | 'coding' | 'status' = 'message') => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('receipt_messages')
        .insert({
          receipt_id: receiptId,
          from_user_id: user.id,
          message
        });

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to add message:', error);
    }
  }, [user, refreshReceipts]);

  const deleteReceipt = useCallback(async (receiptId: string) => {
    try {
      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (error) throw error;
      await refreshReceipts();
    } catch (error) {
      console.error('Failed to delete receipt:', error);
    }
  }, [refreshReceipts]);

  return (
    <ReceiptContext.Provider value={{ 
      uncodedReceipts, 
      codedReceipts, 
      messages,
      addReceipts, 
      codeReceipt,
      uncodeReceipt,
      assignReceipt,
      unassignReceipt,
      addMessage,
      deleteReceipt,
      refreshReceipts
    }}>
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipts() {
  const context = useContext(ReceiptContext);
  if (context === undefined) {
    throw new Error('useReceipts must be used within a ReceiptProvider');
  }
  return context;
}