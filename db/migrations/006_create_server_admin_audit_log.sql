CREATE TABLE IF NOT EXISTS server_admin_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_server_admin_audit_created (created_at),
  KEY idx_server_admin_audit_admin (admin_id, created_at),
  CONSTRAINT fk_server_admin_audit_admin FOREIGN KEY (admin_id)
    REFERENCES server_admin_accounts (id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
