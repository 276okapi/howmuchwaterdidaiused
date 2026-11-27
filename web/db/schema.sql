-- Application tables (Better Auth tables are created by `npm run migrate` from its config).
-- Every table has the cw_ prefix, so the app can live in an existing database.
-- Works on MySQL 5.7+/8.x and MariaDB 10.5+. Create the database as utf8mb4.

-- One row = one prompt ("turn") of one user: metrics only, never the prompt text.
CREATE TABLE IF NOT EXISTS cw_turn (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(36)     NOT NULL,
  sid         VARCHAR(64)     NOT NULL,
  started_at  DATETIME(3)     NOT NULL,
  data        JSON            NOT NULL,
  created_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cw_turn (user_id, sid, started_at),
  KEY ix_cw_turn_user_time (user_id, started_at),
  CONSTRAINT fk_cw_turn_user FOREIGN KEY (user_id) REFERENCES cw_user (id) ON DELETE CASCADE
) ENGINE=InnoDB; -- charset/collation inherited from the database, must match cw_user for the FK

-- The agent key of each user: one API key that the site writes into the installer and the
-- one-file agent. Better Auth keeps only a hash of API keys, so the key itself is kept here
-- encrypted (AES-256-GCM, key derived from BETTER_AUTH_SECRET) to embed it on every download.
-- "Generate a new key" on the Konto page revokes all API keys of the user and makes a new one.
CREATE TABLE IF NOT EXISTS cw_agent_key (
  user_id     VARCHAR(36)   NOT NULL,
  apikey_id   VARCHAR(36)   NOT NULL,
  key_enc     TEXT          NOT NULL,
  created_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_cw_agent_key_user FOREIGN KEY (user_id) REFERENCES cw_user (id) ON DELETE CASCADE
) ENGINE=InnoDB; -- charset/collation inherited from the database, must match cw_user for the FK
