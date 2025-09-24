-- Fix orphaned vendors by assigning them to the correct company
UPDATE vendors 
SET company_id = 'dcdfec98-5141-4559-adb2-fe1d70bfce98'
WHERE company_id = '753df152-d63e-497f-aa97-252777ac6d4f';