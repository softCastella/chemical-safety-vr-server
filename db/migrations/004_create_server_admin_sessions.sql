CREATE TABLE IF NOT EXISTS server_admin_sessions (
  id CHAR(36) NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revoked_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_server_admin_sessions_token_hash (token_hash),
  KEY idx_server_admin_sessions_admin (admin_id, expires_at),
  CONSTRAINT fk_server_admin_sessions_admin FOREIGN KEY (admin_id)
    REFERENCES server_admin_accounts (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
