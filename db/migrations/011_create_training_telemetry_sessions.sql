CREATE TABLE training_telemetry_sessions (
  session_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  schema_version INT UNSIGNED NOT NULL,
  source_project VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  participant_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
  started_at DATETIME(6) NOT NULL,
  ended_at DATETIME(6) NULL,
  end_reason VARCHAR(128) NULL,
  app_version VARCHAR(64) NULL,
  scene VARCHAR(512) NULL,
  mode VARCHAR(64) NULL,
  work_plan VARCHAR(128) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (session_id),
  KEY idx_training_telemetry_sessions_started_at (started_at),
  KEY idx_training_telemetry_sessions_status (status),
  KEY idx_training_telemetry_sessions_participant (participant_id, started_at),
  CONSTRAINT fk_training_telemetry_session_participant
    FOREIGN KEY (participant_id) REFERENCES training_telemetry_participants (participant_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
