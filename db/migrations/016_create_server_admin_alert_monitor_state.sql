CREATE TABLE IF NOT EXISTS server_admin_alert_monitor_state (
  id TINYINT UNSIGNED NOT NULL,
  initialized BOOLEAN NOT NULL DEFAULT FALSE,
  last_security_event_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT chk_server_admin_alert_monitor_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
