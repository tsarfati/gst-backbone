import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TimeCardDetailView from './TimeCardDetailView';
import { useNavigate } from 'react-router-dom';

interface TimeCardDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeCardId?: string;
}

export default function TimeCardDetailModal({ open, onOpenChange, timeCardId }: TimeCardDetailModalProps) {
  const navigate = useNavigate();

  if (!timeCardId) return null;

  return (
    <TimeCardDetailView 
      open={open} 
      onOpenChange={onOpenChange} 
      timeCardId={timeCardId} 
    />
  );
}