CREATE TABLE IF NOT EXISTS server_admin_alert_acknowledgements (
  admin_id BIGINT UNSIGNED NOT NULL,
  alert_key VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  generation BIGINT UNSIGNED NOT NULL,
  acknowledged_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (admin_id, alert_key, generation),
  CONSTRAINT fk_server_admin_alert_ack_admin FOREIGN KEY (admin_id)
    REFERENCES server_admin_accounts (id) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
