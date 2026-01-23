-- Complete mock data with all required fields
INSERT INTO vendors (id, company_id, name, vendor_type, contact_person, email, phone, address, city, state, zip_code, payment_terms, is_active) VALUES
('a0010001-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'ABC Building Supply', 'Supplier', 'John Smith', 'john@abcsupply.com', '555-0101', '123 Industrial Blvd', 'Phoenix', 'AZ', '85001', 'Net 30', true),
('a0010001-0001-0001-0001-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Southwest Concrete Co', 'Contractor', 'Maria Garcia', 'maria@swconcrete.com', '555-0102', '456 Mason Way', 'Tempe', 'AZ', '85281', 'Net 15', true),
('a0010001-0001-0001-0001-000000000003', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Desert Electric LLC', 'Contractor', 'Mike Johnson', 'mike@desertelectric.com', '555-0103', '789 Voltage Dr', 'Scottsdale', 'AZ', '85251', 'Net 30', true);

INSERT INTO cost_codes (id, company_id, code, description, type, is_active) VALUES
('b0010001-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '01-000', 'General Conditions', 'labor', true),
('b0010001-0001-0001-0001-000000000003', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '03-000', 'Concrete', 'material', true),
('b0010001-0001-0001-0001-000000000006', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', '06-000', 'Wood & Plastics', 'material', true);

INSERT INTO jobs (id, company_id, name, client, address, status, budget, start_date, end_date, description, is_active, created_by) VALUES
('c0010001-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Desert Vista Medical Center', 'Southwest Healthcare Group', '4500 E Camelback Rd, Phoenix, AZ', 'active', 8500000.00, '2025-01-15', '2026-06-30', 'New 45,000 sq ft medical office building', true, '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7'),
('c0010001-0001-0001-0001-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Scottsdale Luxury Residences', 'Pinnacle Development LLC', '7800 E Doubletree Ranch Rd, Scottsdale, AZ', 'active', 12500000.00, '2025-02-01', '2026-12-31', 'High-end residential complex', true, '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7');

INSERT INTO pin_employees (id, company_id, first_name, last_name, display_name, pin_code, email, phone, department, is_active, created_by) VALUES
('d0010001-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Carlos', 'Rodriguez', 'Carlos Rodriguez', '1234', 'carlos@apex.com', '555-2001', 'Field Ops', true, '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7'),
('d0010001-0001-0001-0001-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'James', 'Thompson', 'James Thompson', '2345', 'james@apex.com', '555-2002', 'Carpentry', true, '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7');

INSERT INTO invoices (id, vendor_id, job_id, cost_code_id, invoice_number, amount, issue_date, due_date, status, description, file_url, created_by) VALUES
('e0010001-0001-0001-0001-000000000001', 'a0010001-0001-0001-0001-000000000001', 'c0010001-0001-0001-0001-000000000001', 'b0010001-0001-0001-0001-000000000006', 'INV-ABC-2025-0142', 24500.00, '2025-01-10', '2025-02-09', 'approved', 'Lumber delivery for framing', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800', '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7'),
('e0010001-0001-0001-0001-000000000002', 'a0010001-0001-0001-0001-000000000002', 'c0010001-0001-0001-0001-000000000001', 'b0010001-0001-0001-0001-000000000003', 'SWC-2025-0089', 45000.00, '2025-01-12', '2025-01-27', 'paid', 'Foundation concrete pour', 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800', '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7');

INSERT INTO receipts (id, company_id, job_id, cost_code_id, vendor_id, amount, receipt_date, notes, file_name, file_url, status, created_by) VALUES
('f0010001-0001-0001-0001-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'c0010001-0001-0001-0001-000000000001', 'b0010001-0001-0001-0001-000000000006', 'a0010001-0001-0001-0001-000000000001', 485.50, '2025-01-14', 'Hardware supplies', 'receipt-001.jpg', 'https://images.unsplash.com/photo-1572666341285-c8cb9790ca50?w=800', 'coded', '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7'),
('f0010001-0001-0001-0001-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f23456789012', 'c0010001-0001-0001-0001-000000000001', 'b0010001-0001-0001-0001-000000000001', NULL, 125.00, '2025-01-15', 'Job site lunch', 'receipt-002.jpg', 'https://images.unsplash.com/photo-1554224155-1696413565d3?w=800', 'coded', '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7');