-- Fix time card audit trail to support system-driven updates (e.g., recalculation)
-- When auth.uid() is null (service role), fall back to the time card's user_id
CREATE OR REPLACE FUNCTION public.create_time_card_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Handle INSERT (new time card with punch in/out logging)
    IF TG_OP = 'INSERT' THEN
        -- Log the creation
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
        
        -- Explicitly log punch in event
        INSERT INTO public.time_card_audit_trail (
            time_card_id,
            changed_by,
            change_type,
            field_name,
            new_value
        ) VALUES (
            NEW.id,
            NEW.user_id,
            'punch_in',
            'punch_in_time',
            NEW.punch_in_time::text
        );
        
        -- Log punch out event if it exists
        IF NEW.punch_out_time IS NOT NULL THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id,
                changed_by,
                change_type,
                field_name,
                new_value
            ) VALUES (
                NEW.id,
                NEW.user_id,
                'punch_out',
                'punch_out_time',
                NEW.punch_out_time::text
            );
        END IF;
        
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
                COALESCE(NEW.approved_by, auth.uid(), NEW.user_id),
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
        
        -- Punch in time changes
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
                COALESCE(auth.uid(), NEW.user_id),
                'update',
                'punch_in_time',
                OLD.punch_in_time::text,
                NEW.punch_in_time::text,
                NEW.correction_reason
            );
        END IF;
        
        -- Punch out time changes
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
                COALESCE(auth.uid(), NEW.user_id),
                'update',
                'punch_out_time',
                OLD.punch_out_time::text,
                NEW.punch_out_time::text,
                NEW.correction_reason
            );
        END IF;
        
        -- Total hours changes
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
                COALESCE(auth.uid(), NEW.user_id),
                'update',
                'total_hours',
                OLD.total_hours::text,
                NEW.total_hours::text,
                NEW.correction_reason
            );
        END IF;
        
        -- Job changes
        IF OLD.job_id IS DISTINCT FROM NEW.job_id THEN
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
                COALESCE(auth.uid(), NEW.user_id),
                'update',
                'job_id',
                OLD.job_id::text,
                NEW.job_id::text,
                NEW.correction_reason
            );
        END IF;
        
        -- Cost code changes
        IF OLD.cost_code_id IS DISTINCT FROM NEW.cost_code_id THEN
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
                COALESCE(auth.uid(), NEW.user_id),
                'update',
                'cost_code_id',
                OLD.cost_code_id::text,
                NEW.cost_code_id::text,
                NEW.correction_reason
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;