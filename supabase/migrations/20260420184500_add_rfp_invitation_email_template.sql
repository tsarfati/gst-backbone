insert into public.email_templates (
  key,
  name,
  description,
  subject,
  html_content,
  editor_type,
  created_by
)
select
  'rfp_invitation',
  'RFP Invitation',
  'Base email template used when inviting vendors to bid on an RFP',
  'Invitation to Bid: {{rfp_title}} - {{company_name}}',
  '<p style="font-size:16px;margin-bottom:20px;">Hello <strong>{{vendor_name}}</strong>,</p>
<p style="font-size:16px;margin-bottom:20px;"><strong>{{company_name}}</strong> invited you to review and bid the following RFP in BuilderLYNK:</p>
<div style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;">
  <h2 style="margin:0 0 15px 0;color:#1e40af;font-size:20px;">{{rfp_title}}</h2>
  <p style="margin:5px 0;font-size:14px;"><strong>RFP Number:</strong> {{rfp_number}}</p>
  <p style="margin:5px 0;font-size:14px;"><strong>Due Date:</strong> {{due_date}}</p>
  {{scope_of_work_block}}
</div>
{{custom_message_block}}
<p style="font-size:16px;margin-bottom:20px;">If you are not already familiar with BuilderLYNK, you will be prompted to sign up or open your existing account. From there, you can review the RFP, access the supporting information, communicate with the project team, and submit your bid.</p>
<p style="font-size:16px;margin-bottom:20px;">{{cta_secondary_copy}}</p>
<div style="text-align:center;margin:24px 0;">
  <a href="{{cta_href}}" style="display:inline-block;background-color:#E88A2D;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:8px;">
    {{cta_label}}
  </a>
</div>
<p style="font-size:13px;color:#6b7280;margin-bottom:20px;text-align:center;">Once inside BuilderLYNK, the vendor portal RFPs tab will show the invite, attachments, plan pages, and bid submission workflow.</p>',
  'html',
  gen_random_uuid()
where not exists (
  select 1 from public.email_templates where key = 'rfp_invitation'
);
