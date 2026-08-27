ALTER TABLE server_admin_accounts
  ADD COLUMN expires_at DATETIME(3) NULL AFTER locked_until;
