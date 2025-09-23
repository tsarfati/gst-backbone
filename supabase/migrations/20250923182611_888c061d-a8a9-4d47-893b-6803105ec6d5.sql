-- Create audit trail table for time card changes
CREATE TABLE IF NOT EXISTS public.time_card_audit_trail (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    time_card_id UUID NOT NULL REFERENCES public.time_cards(id),
    changed_by UUID NOT NULL,
    change_type TEXT NOT NULL, -- 'create', 'update', 'approve', 'reject'
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_card_audit_trail ENABLE ROW LEVEL SECURITY;

-- Create policies for audit trail
CREATE POLICY "Users can view audit trail for their own time cards" 
ON public.time_card_audit_trail 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.time_cards tc 
        WHERE tc.id = time_card_audit_trail.time_card_id 
        AND tc.user_id = auth.uid()
    )
);

CREATE POLICY "Managers can view all audit trails" 
ON public.time_card_audit_trail 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role) OR has_role(auth.uid(), 'project_manager'::user_role));

CREATE POLICY "System can create audit trail entries" 
ON public.time_card_audit_trail 
FOR INSERT 
WITH CHECK (true);

-- Create function to automatically create audit trail entries
CREATE OR REPLACE FUNCTION public.create_time_card_audit_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT (new time card)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.time_card_audit_trail (
            time_card_id, 
            changed_by, 
            change_type, 
            reason
        ) VALUES (
            NEW.id,
            NEW.user_id,
            'create',
            CASE WHEN NEW.created_via_punch_clock THEN 'Created via punch clock' ELSE 'Manual entry' END
        );
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE (time card changes)
    IF TG_OP = 'UPDATE' THEN
        -- Status changes
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id, 
                changed_by, 
                change_type,
                field_name,
                old_value,
                new_value
            ) VALUES (
                NEW.id,
                COALESCE(NEW.approved_by, auth.uid()),
                CASE NEW.status 
                    WHEN 'approved' THEN 'approve'
                    WHEN 'rejected' THEN 'reject'
                    ELSE 'update'
                END,
                'status',
                OLD.status,
                NEW.status
            );
        END IF;
        
        -- Time changes
        IF OLD.punch_in_time IS DISTINCT FROM NEW.punch_in_time THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id, 
                changed_by, 
                change_type,
                field_name,
                old_value,
                new_value,
                reason
            ) VALUES (
                NEW.id,
                auth.uid(),
                'update',
                'punch_in_time',
                OLD.punch_in_time::text,
                NEW.punch_in_time::text,
                NEW.correction_reason
            );
        END IF;
        
        IF OLD.punch_out_time IS DISTINCT FROM NEW.punch_out_time THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id, 
                changed_by, 
                change_type,
                field_name,
                old_value,
                new_value,
                reason
            ) VALUES (
                NEW.id,
                auth.uid(),
                'update',
                'punch_out_time',
                OLD.punch_out_time::text,
                NEW.punch_out_time::text,
                NEW.correction_reason
            );
        END IF;
        
        -- Hours changes
        IF OLD.total_hours IS DISTINCT FROM NEW.total_hours THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id, 
                changed_by, 
                change_type,
                field_name,
                old_value,
                new_value,
                reason
            ) VALUES (
                NEW.id,
                auth.uid(),
                'update',
                'total_hours',
                OLD.total_hours::text,
                NEW.total_hours::text,
                NEW.correction_reason
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for audit trail
DROP TRIGGER IF EXISTS time_card_audit_trigger ON public.time_cards;
CREATE TRIGGER time_card_audit_trigger
    AFTER INSERT OR UPDATE ON public.time_cards
    FOR EACH ROW EXECUTE FUNCTION public.create_time_card_audit_entry();

-- Create edge function to get Mapbox token
CREATE OR REPLACE FUNCTION public.get_mapbox_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This is a placeholder - the actual token will be set in edge function
    RETURN '';
END;
$$;