-- Seed default email templates
INSERT INTO public.email_templates (key, name, description, subject, html_content, editor_type, created_by)
VALUES
  ('overdue_invoice', 'Overdue Invoice Reminder', 'Notifies customers about overdue invoices', 'Invoice {{invoice_number}} is overdue',
   '<h2>Invoice {{invoice_number}} is overdue</h2><p>Dear {{customer_name}},</p><p>This is a reminder that your invoice <strong>{{invoice_number}}</strong> for <strong>{{amount}}</strong> was due on <strong>{{due_date}}</strong>.</p><p>Please make the payment at your earliest convenience.</p><p>Thank you,<br/>{{company_name}}</p>', 'html', 
   (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
  ('invoice_paid', 'Invoice Paid Confirmation', 'Confirms payment received', 'Payment received for invoice {{invoice_number}}',
   '<h2>Payment received</h2><p>Hi {{customer_name}},</p><p>We have received your payment of <strong>{{amount}}</strong> for invoice <strong>{{invoice_number}}</strong>.</p><p>Receipt attached.</p><p>Regards,<br/>{{company_name}}</p>', 'html',
   (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
  ('vendor_invitation', 'Vendor Invitation', 'Invite a vendor to your portal', 'You are invited to join {{company_name}} vendor portal',
   '<h2>Invitation to join {{company_name}}</h2><p>Hello {{vendor_name}},</p><p>You have been invited to join our vendor portal. Click the link below to get started:</p><p><a href="{{invitation_link}}">Accept Invitation</a></p>', 'html',
   (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
  ('job_assignment', 'Job Assignment', 'Notify employees of new job assignment', 'You have been assigned to {{job_name}}',
   '<h2>New Assignment: {{job_name}}</h2><p>Hi {{assignee_name}},</p><p>You have been assigned to {{job_name}} starting {{start_date}}.</p>', 'html',
   (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1)),
  ('receipt_uploaded', 'Receipt Uploaded', 'Notify controller a new receipt was uploaded', 'New receipt uploaded by {{uploader_name}}',
   '<h2>New Receipt Uploaded</h2><p>{{uploader_name}} uploaded a new receipt: {{filename}} for {{amount}}.</p>', 'html',
   (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1))
ON CONFLICT (key) DO NOTHING;