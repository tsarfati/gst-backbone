-- Enhanced audit trail for time cards

-- First, enhance the time_card_audit_entry trigger to log punch events and more fields
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
                auth.uid(),
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
                auth.uid(),
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
                auth.uid(),
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
                auth.uid(),
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
                auth.uid(),
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

-- Create trigger function for time card change requests
CREATE OR REPLACE FUNCTION public.create_change_request_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Handle INSERT (new change request)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.time_card_audit_trail (
            time_card_id,
            changed_by,
            change_type,
            reason
        ) VALUES (
            NEW.time_card_id,
            NEW.requested_by,
            'change_requested',
            NEW.reason
        );
        RETURN NEW;
    END IF;
    
    -- Handle UPDATE (request status changes)
    IF TG_OP = 'UPDATE' THEN
        -- Log when request is approved
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'approved' THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id,
                changed_by,
                change_type,
                reason
            ) VALUES (
                NEW.time_card_id,
                NEW.reviewed_by,
                'change_request_approved',
                NEW.review_notes
            );
        END IF;
        
        -- Log when request is rejected
        IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejected' THEN
            INSERT INTO public.time_card_audit_trail (
                time_card_id,
                changed_by,
                change_type,
                reason
            ) VALUES (
                NEW.time_card_id,
                NEW.reviewed_by,
                'change_request_rejected',
                NEW.review_notes
            );
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS create_change_request_audit_entry_trigger ON public.time_card_change_requests;

CREATE TRIGGER create_change_request_audit_entry_trigger
AFTER INSERT OR UPDATE ON public.time_card_change_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_change_request_audit_entry();