import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Receipt {
  id: string;
  filename: string;
  amount: string;
  date: string;
  vendor?: string;
  vendorId?: string;
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
  receiptId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'assignment' | 'coding' | 'status';
}

export interface CodedReceipt extends Receipt {
  job: string;
  costCode: string;
  codedBy: string;
  codedDate: Date;
  vendorId?: string;
}

interface ReceiptContextType {
  uncodedReceipts: Receipt[];
  codedReceipts: CodedReceipt[];
  messages: ReceiptMessage[];
  addReceipts: (files: FileList) => void;
  codeReceipt: (receiptId: string, job: string, costCode: string, codedBy: string, vendorId?: string, newAmount?: string) => void;
  uncodeReceipt: (receiptId: string) => void;
  assignReceipt: (receiptId: string, userId: string, userName: string, userRole: string) => void;
  unassignReceipt: (receiptId: string) => void;
  addMessage: (receiptId: string, message: string, userId: string, userName: string, type?: 'message' | 'assignment' | 'coding' | 'status') => void;
  deleteReceipt: (receiptId: string) => void;
}

const ReceiptContext = createContext<ReceiptContextType | undefined>(undefined);

export function ReceiptProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  // Load receipts from localStorage - no demo data
  const [uncodedReceipts, setUncodedReceipts] = useState<Receipt[]>(() => {
    const saved = localStorage.getItem('uncoded-receipts');
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });
  const [codedReceipts, setCodedReceipts] = useState<CodedReceipt[]>([]);
  const [messages, setMessages] = useState<ReceiptMessage[]>([]);

  // Save receipts to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('uncoded-receipts', JSON.stringify(uncodedReceipts));
  }, [uncodedReceipts]);

  const addReceipts = useCallback(async (files: FileList) => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    const newReceipts: Receipt[] = [];
    
    for (const file of Array.from(files)) {
      try {
        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${user.id}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);

        let ocrData = null;
        
        // Process with AI OCR if it's an image
        if (file.type.startsWith('image/')) {
          try {
            console.log('Processing image with AI OCR...');
            
            // Convert file to base64 for AI processing
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]); // Remove data:image/jpeg;base64, prefix
              };
              reader.readAsDataURL(file);
            });

            const ocrResponse = await supabase.functions.invoke('process-receipt-ocr', {
              body: { imageBase64: base64 }
            });

            if (ocrResponse.data?.success) {
              ocrData = ocrResponse.data.data;
              console.log('OCR processed successfully:', ocrData);
            } else {
              console.warn('OCR processing failed:', ocrResponse.data?.error);
            }
          } catch (ocrError) {
            console.warn('OCR processing error:', ocrError);
          }
        }

        const newReceipt: Receipt = {
          id: `receipt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          filename: file.name,
          amount: ocrData?.amount || "$0.00",
          date: ocrData?.date || new Date().toISOString().split('T')[0],
          vendor: ocrData?.vendor || undefined,
          type: file.type.startsWith('image/') ? 'image' : 'pdf',
          previewUrl: urlData.publicUrl,
          uploadedBy: user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Current User",
          uploadedDate: new Date(),
        };
        
        newReceipts.push(newReceipt);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
      }
    }

    if (newReceipts.length > 0) {
      setUncodedReceipts(prev => [...prev, ...newReceipts]);
    }
  }, [user]);

  const codeReceipt = (receiptId: string, job: string, costCode: string, codedBy: string, vendorId?: string, newAmount?: string) => {
    const receipt = uncodedReceipts.find(r => r.id === receiptId);
    if (receipt) {
      const formattedAmount = newAmount !== undefined && newAmount !== null && newAmount !== ''
        ? `$${Number(newAmount).toFixed(2)}`
        : receipt.amount;
      const codedReceipt: CodedReceipt = {
        ...receipt,
        amount: formattedAmount,
        job,
        costCode,
        codedBy,
        codedDate: new Date(),
        vendorId,
      };
      
      setCodedReceipts(prev => [...prev, codedReceipt]);
      setUncodedReceipts(prev => prev.filter(r => r.id !== receiptId));
      
      // Add coding message
      const vendorText = vendorId ? ` with vendor ${vendorId}` : '';
      addMessage(receiptId, `Receipt coded to ${job} - ${costCode}${vendorText}. Amount set to ${formattedAmount}`, "system", codedBy, 'coding');
    }
  };

  const uncodeReceipt = (receiptId: string) => {
    const codedReceipt = codedReceipts.find(r => r.id === receiptId);
    if (codedReceipt) {
      // Convert back to regular receipt
      const receipt: Receipt = {
        id: codedReceipt.id,
        filename: codedReceipt.filename,
        amount: codedReceipt.amount,
        date: codedReceipt.date,
        vendor: codedReceipt.vendor,
        vendorId: codedReceipt.vendorId,
        type: codedReceipt.type,
        previewUrl: codedReceipt.previewUrl,
        uploadedBy: codedReceipt.uploadedBy,
        uploadedDate: codedReceipt.uploadedDate,
        assignedUser: codedReceipt.assignedUser,
      };
      
      setUncodedReceipts(prev => [...prev, receipt]);
      setCodedReceipts(prev => prev.filter(r => r.id !== receiptId));
      
      const userName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Current User";
      addMessage(receiptId, `Receipt uncoded and moved back to uncoded receipts`, "system", userName, 'status');
    }
  };

  const assignReceipt = (receiptId: string, userId: string, userName: string, userRole: string) => {
    setUncodedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { 
            ...receipt, 
            assignedUser: { 
              id: userId, 
              name: userName, 
              role: userRole, 
              assignedDate: new Date() 
            } 
          }
        : receipt
    ));
    
    // Add assignment message
    addMessage(receiptId, `Receipt assigned to ${userName} for review`, "system", user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "System", 'assignment');
  };

  const unassignReceipt = (receiptId: string) => {
    const receipt = uncodedReceipts.find(r => r.id === receiptId);
    const assignedUserName = receipt?.assignedUser?.name || "user";
    
    setUncodedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { ...receipt, assignedUser: undefined }
        : receipt
    ));
    
    // Add unassignment message
    addMessage(receiptId, `Receipt unassigned from ${assignedUserName}`, "system", user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "System", 'status');
  };

  const addMessage = (receiptId: string, message: string, userId: string, userName: string, type: 'message' | 'assignment' | 'coding' | 'status' = 'message') => {
    const newMessage: ReceiptMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      receiptId,
      userId,
      userName,
      message,
      timestamp: new Date(),
      type
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const updateCodedReceiptAmount = (receiptId: string, newAmount: string) => {
    const userName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email || "Current User";
    
    setCodedReceipts(prev => prev.map(receipt => 
      receipt.id === receiptId 
        ? { ...receipt, amount: `$${Number(newAmount).toFixed(2)}` }
        : receipt
    ));
    
    // Add audit message
    // Add audit message
    addMessage(receiptId, `Receipt amount updated to $${Number(newAmount).toFixed(2)}`, "system", userName, 'status');
  };

  const deleteReceipt = (receiptId: string) => {
    setUncodedReceipts(prev => prev.filter(r => r.id !== receiptId));
    setCodedReceipts(prev => prev.filter(r => r.id !== receiptId));
    setMessages(prev => prev.filter(m => m.receiptId !== receiptId));
  };

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
      deleteReceipt
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