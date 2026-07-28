CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id serial PRIMARY KEY,
  email varchar(255) NOT NULL,
  token varchar(100) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_password_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
