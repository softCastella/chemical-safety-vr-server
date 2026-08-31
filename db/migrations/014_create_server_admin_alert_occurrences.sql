CREATE TABLE IF NOT EXISTS server_admin_alert_occurrences (
  alert_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  generation BIGINT UNSIGNED NOT NULL DEFAULT 1,
  source VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  message VARCHAR(500) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  push_processed_at DATETIME(3) NULL,
  PRIMARY KEY (alert_key),
  KEY idx_server_admin_alert_pending (active, push_processed_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
