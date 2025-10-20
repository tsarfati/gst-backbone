-- Insert overdue bill notification email template
INSERT INTO public.email_templates (
  key,
  name,
  description,
  subject,
  html_content,
  editor_type,
  created_by
) VALUES (
  'overdue_bill_alert',
  'Overdue Bill Alert',
  'Email notification for overdue bills requiring immediate attention',
  'Overdue Invoice Alert - {{vendor_name}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', ''Roboto'', ''Oxygen'', ''Ubuntu'', ''Cantarell'', ''Fira Sans'', ''Droid Sans'', ''Helvetica Neue'', sans-serif;
      background-color: #1a1a1a;
      color: #ffffff;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 40px 20px;
    }
    .title {
      font-size: 42px;
      font-weight: bold;
      margin-bottom: 30px;
      line-height: 1.2;
    }
    .red-text {
      color: #ef4444;
    }
    .highlight {
      background-color: #fef08a;
      color: #000000;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .intro {
      font-size: 18px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    .details-box {
      background-color: #262626;
      border-left: 4px solid #ef4444;
      padding: 30px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .details-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 20px;
    }
    .detail-row {
      font-size: 18px;
      margin-bottom: 16px;
      line-height: 1.6;
    }
    .detail-label {
      font-weight: bold;
    }
    .button {
      display: inline-block;
      background-color: #ef4444;
      color: #ffffff;
      padding: 16px 32px;
      font-size: 20px;
      font-weight: bold;
      text-decoration: none;
      border-radius: 8px;
      margin-top: 10px;
    }
    .button:hover {
      background-color: #dc2626;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">
      <span class="red-text">Overdue</span> <span class="highlight">Invoice</span> <span class="red-text">Alert</span>
    </h1>
    
    <p class="intro">
      The following <span class="highlight">invoice</span> is overdue and requires immediate attention.
    </p>
    
    <div class="details-box">
      <h2 class="details-title">
        <span class="highlight">Invoice</span> Details:
      </h2>
      
      <div class="detail-row">
        <span class="detail-label">Job:</span> {{job_name}}
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Vendor:</span> {{vendor_name}}
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Amount:</span> {{amount}}
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Due Date:</span> {{due_date}}
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Days Overdue:</span> {{days_overdue}}
      </div>
    </div>
    
    <a href="{{dashboard_url}}" class="button">View Dashboard</a>
  </div>
</body>
</html>',
  'html',
  (SELECT id FROM auth.users LIMIT 1)
)
ON CONFLICT (key) DO UPDATE SET
  html_content = EXCLUDED.html_content,
  subject = EXCLUDED.subject,
  updated_at = now();