-- Ensure credit-card-attachments bucket is public
update storage.buckets set public = true where id = 'credit-card-attachments';