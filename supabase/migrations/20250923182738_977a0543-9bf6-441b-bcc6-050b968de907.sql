-- Fix security issues from previous migration

-- Update function to fix search path issue
CREATE OR REPLACE FUNCTION public.create_time_card_audit_entry()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;