-- ============================================================
--  Brand Lover Family Store — POS & Accounts Management
--  Redesigned schema | InnoDB | utf8mb4
-- ============================================================

DROP DATABASE IF EXISTS brand_lover_pos;
CREATE DATABASE brand_lover_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE brand_lover_pos;

-- ---------- Company / Config ----------
CREATE TABLE companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  licensed_to VARCHAR(150) NOT NULL,
  address VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(120) NULL,
  gst_reg_no VARCHAR(50) NULL,
  ntn VARCHAR(50) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'Rs.',
  logo_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE financial_years (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  company_id INT UNSIGNED NOT NULL,
  label VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_fy_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Users ----------
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  role ENUM('administrator','manager','cashier') NOT NULL DEFAULT 'cashier',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Cash & Bank ----------
CREATE TABLE accounts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type ENUM('cash','bank') NOT NULL DEFAULT 'cash',
  account_number VARCHAR(60) NULL,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- Inventory hierarchy ----------
CREATE TABLE categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE sub_categories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_subcat_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  INDEX idx_subcat_cat (category_id)
) ENGINE=InnoDB;

CREATE TABLE brands (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
    sub_category_id INT UNSIGNED NULL,
  brand_id INT UNSIGNED NULL,
  purchase_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'Pcs',
  reorder_quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  low_stock_threshold DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  cost_valuation_method ENUM('weighted_average','manual') NOT NULL DEFAULT 'weighted_average',
  valuation_cost DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  barcode VARCHAR(60) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_item_subcat FOREIGN KEY (sub_category_id) REFERENCES sub_categories(id),
  CONSTRAINT fk_item_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL,
  INDEX idx_item_subcat (sub_category_id),
  INDEX idx_item_name (name)
) ENGINE=InnoDB;

CREATE TABLE stock_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  movement_type ENUM('purchase','sale','sale_return','purchase_return','adjustment','opening') NOT NULL,
  reference_type VARCHAR(30) NULL,
  reference_id BIGINT UNSIGNED NULL,
  quantity_in DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity_out DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  balance_qty DECIMAL(12,2) NOT NULL DEFAULT 0,
  balance_avg_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  movement_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ledger_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  INDEX idx_ledger_item (item_id),
  INDEX idx_ledger_date (movement_date)
) ENGINE=InnoDB;

-- ---------- Parties ----------
CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  telephone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_walk_in TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customer_name (name)
) ENGINE=InnoDB;

CREATE TABLE vendors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  telephone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  gst_reg_no VARCHAR(50) NULL,
  ntn VARCHAR(50) NULL,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vendor_name (name)
) ENGINE=InnoDB;

-- ---------- Sales ----------
CREATE TABLE sales (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(30) NOT NULL,
  invoice_type ENUM('counter','online') NOT NULL DEFAULT 'counter',
  payment_type ENUM('cash','online','credit') NOT NULL DEFAULT 'cash',
  customer_id INT UNSIGNED NOT NULL,
  financial_year_id INT UNSIGNED NULL,
  invoice_date DATE NOT NULL,
  invoice_time TIME NULL,
  due_date DATE NULL,
  sub_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount DECIMAL(15,2) NOT NULL DEFAULT 0,
  delivery_charges DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount_received DECIMAL(15,2) NOT NULL DEFAULT 0,
  cash_back DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_account_id INT UNSIGNED NULL,
  is_posted TINYINT(1) NOT NULL DEFAULT 1,
  is_cancelled TINYINT(1) NOT NULL DEFAULT 0,
  remarks VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoice (invoice_no, invoice_type),
  CONSTRAINT fk_sale_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sale_account FOREIGN KEY (payment_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_sale_date (invoice_date),
  INDEX idx_sale_customer (customer_id)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sale_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'Pcs',
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  gross_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_saleitem_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  CONSTRAINT fk_saleitem_item FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_saleitem_sale (sale_id)
) ENGINE=InnoDB;

-- ---------- Purchases ----------
CREATE TABLE purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  serial_no VARCHAR(30) NOT NULL UNIQUE,
  vendor_id INT UNSIGNED NULL,
  order_date DATE NOT NULL,
  delivery_date DATE NULL,
  terms_of_payment VARCHAR(150) NULL,
  job_description VARCHAR(255) NULL,
  employee_reference VARCHAR(120) NULL,
  sub_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_incl_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
  status ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
  terms_conditions TEXT NULL,
  remarks TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_po_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_po_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_po_date (order_date)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  description VARCHAR(255) NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL DEFAULT 'Pcs',
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  value_incl_tax DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_poitem_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poitem_item FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_poitem_po (purchase_order_id)
) ENGINE=InnoDB;

-- ---------- Receipts / Payments / Expenses ----------
CREATE TABLE vouchers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  voucher_no VARCHAR(30) NOT NULL,
  voucher_type ENUM('receipt','payment','expense') NOT NULL,
  party_type ENUM('customer','vendor','none') NOT NULL DEFAULT 'none',
  party_id INT UNSIGNED NULL,
  account_id INT UNSIGNED NOT NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash','bank','cheque','card') NOT NULL DEFAULT 'cash',
  reference VARCHAR(120) NULL,
  description VARCHAR(255) NULL,
  voucher_date DATE NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_voucher (voucher_no, voucher_type),
  CONSTRAINT fk_voucher_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_voucher_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_voucher_date (voucher_date),
  INDEX idx_voucher_party (party_type, party_id)
) ENGINE=InnoDB;

-- 003 — Product returns / refunds (logged separately from sales).
CREATE TABLE sales_returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_no VARCHAR(30) NOT NULL,
  sale_id BIGINT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  return_date DATE NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  refund_mode ENUM('cash','bank','credit_adjust') NOT NULL DEFAULT 'cash',
  refund_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  account_id INT UNSIGNED NULL,
  reason VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_return_no (return_no),
  CONSTRAINT fk_ret_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_ret_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_ret_account FOREIGN KEY (account_id) REFERENCES accounts(id),
  CONSTRAINT fk_ret_user FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ret_sale (sale_id),
  INDEX idx_ret_date (return_date)
) ENGINE=InnoDB;

CREATE TABLE sales_return_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  return_id BIGINT UNSIGNED NOT NULL,
  sale_item_id BIGINT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0,
  rate DECIMAL(15,2) NOT NULL DEFAULT 0,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_reti_ret FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_reti_saleitem FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
  CONSTRAINT fk_reti_item FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_reti_ret (return_id)
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA (reproduces the dashboard screenshot figures)
-- ============================================================
INSERT INTO companies (id, name, licensed_to, address, phone, currency) VALUES
(1,'Brand Lover Family Store','Brand Lover Family Store','Main Bazar, Rahim Yar Khan','000-0000000','Rs.');

INSERT INTO financial_years (id, company_id, label, start_date, end_date, is_default) VALUES
(1,1,'2026-27','2026-07-01','2027-06-30',1),
(2,1,'2025-26','2025-07-01','2026-06-30',0);

INSERT INTO accounts (id, name, type, opening_balance, current_balance) VALUES
(1,'Cash In Hand','cash',33290.00,33290.00),
(2,'Bank Account','bank',0.00,0.00);

INSERT INTO categories (id, code, name) VALUES
(1,'1','KIDS'),(2,'2','MENS'),(3,'3','WOMEN'),(4,'4','LOT'),(5,'5','TURKISH'),(6,'6','Summer');

INSERT INTO sub_categories (id, category_id, code, name) VALUES
(1,1,'101','SHIRT'),(2,1,'102','PANT'),(3,1,'103','SUITS'),
(4,1,'104','Jacket'),(5,1,'105','Trouser'),(6,1,'106','Kurta Shalwar Waistcoat'),
(7,2,'201','Accessories');

INSERT INTO brands (id, name) VALUES (1,'Generic'),(2,'Imported');

INSERT INTO items (id, item_code, name, sub_category_id, brand_id, purchase_price, selling_price, unit, reorder_quantity, discount_percent, current_stock, average_cost, barcode) VALUES
(1,'00081','Double Shirt',1,1,1250.00,2075.00,'Pcs',1,20.00,120,1250.00,'00081'),
(2,'00082','Sweat Shirt',1,1,900.00,1600.00,'Pcs',1,10.00,80,900.00,'00082'),
(3,'00083','Hoody Shirt',1,2,1100.00,1900.00,'Pcs',1,15.00,60,1100.00,'00083'),
(4,'00120','Girl Kurti',1,1,850.00,1500.00,'Pcs',1,10.00,150,850.00,'00120'),
(5,'00296','Fix Belt',7,1,120.00,250.00,'Pcs',1,0.00,200,120.00,'00296');

INSERT INTO customers (id, code, name, telephone, opening_balance, current_balance, is_walk_in) VALUES
(1,'12001001','Walk In Cash Customer',NULL,0.00,0.00,1),
(2,'12001002','Ali Traders (Credit)','0300-1234567',1027764.00,1027764.00,0);

INSERT INTO vendors (id, code, name, telephone, opening_balance, current_balance) VALUES
(1,'13001001','Faisalabad Textile Supplier','041-1234567',0.00,0.00);

INSERT INTO sales (id, invoice_no, invoice_type, customer_id, financial_year_id, invoice_date, invoice_time, sub_total, net_total, amount_received, payment_account_id) VALUES
(1,'101','online',1,1,CURDATE(),'12:46:00',250.00,250.00,250.00,1),
(2,'102','counter',1,1,CURDATE(),'13:10:00',33200.00,33200.00,33200.00,1),
(3,'103','counter',1,1,CURDATE(),'14:20:00',43150.00,43150.00,43150.00,1);

INSERT INTO sale_items (sale_id, item_id, description, quantity, unit, rate, gross_amount, discount_percent, discount_amount, net_amount) VALUES
(1,5,'Fix Belt',1,'Pcs',250.00,250.00,0.00,0.00,250.00),
(2,1,'Double Shirt',20,'Pcs',2075.00,41500.00,20.00,8300.00,33200.00),
(3,4,'Girl Kurti',20,'Pcs',1500.00,30000.00,10.00,3000.00,27000.00),
(3,3,'Hoody Shirt',10,'Pcs',1900.00,19000.00,15.00,2850.00,16150.00);

INSERT INTO vouchers (voucher_no, voucher_type, party_type, party_id, account_id, amount, payment_method, description, voucher_date) VALUES
('RV-001','receipt','customer',2,1,83798.00,'cash','Payment received from Ali Traders',CURDATE()),
('PV-001','payment','vendor',1,1,6600.00,'cash','Shop expense / vendor payment',CURDATE());