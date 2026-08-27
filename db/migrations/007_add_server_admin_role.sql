ALTER TABLE server_admin_accounts
  ADD COLUMN role ENUM('admin', 'viewer') NOT NULL DEFAULT 'admin' AFTER password_hash;
