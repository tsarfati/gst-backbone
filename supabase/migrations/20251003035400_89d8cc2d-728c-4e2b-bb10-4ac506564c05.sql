-- Fix audit trigger function to use correct column names
CREATE OR REPLACE FUNCTION public.create_change_request_audit_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
            NEW.user_id, -- use the actual column on time_card_change_requests
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