CREATE TABLE training_telemetry_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_id VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sequence INT UNSIGNED NOT NULL,
  schema_version INT UNSIGNED NOT NULL,
  timestamp_utc DATETIME(6) NOT NULL,
  event_type VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload_json JSON NOT NULL,
  payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  server_received_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_training_telemetry_events_event_id (event_id),
  UNIQUE KEY uq_training_telemetry_events_session_sequence (session_id, sequence),
  KEY idx_training_telemetry_events_type_time (event_type, timestamp_utc),
  CONSTRAINT fk_training_telemetry_events_session
    FOREIGN KEY (session_id) REFERENCES training_telemetry_sessions (session_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
