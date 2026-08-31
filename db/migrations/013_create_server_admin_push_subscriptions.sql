CREATE TABLE IF NOT EXISTS server_admin_push_subscriptions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  endpoint_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  endpoint VARCHAR(2048) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  p256dh VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  auth VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  last_success_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_server_admin_push_endpoint (endpoint_hash),
  KEY idx_server_admin_push_admin (admin_id, updated_at),
  CONSTRAINT fk_server_admin_push_admin FOREIGN KEY (admin_id)
    REFERENCES server_admin_accounts (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
