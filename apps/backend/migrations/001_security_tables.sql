-- Security Tables Migration
-- Run this migration to create necessary security tables

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  scopes TEXT[] DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);

-- User permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  resource VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID,
  expires_at TIMESTAMPTZ,
  conditions JSONB
);

CREATE UNIQUE INDEX idx_user_permissions_unique ON user_permissions(user_id, resource, action);
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier VARCHAR(255) NOT NULL, -- user_id, ip_address, or api_key
  endpoint VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  blocked_until TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_rate_limits_unique ON rate_limits(identifier, endpoint, window_start);
CREATE INDEX idx_rate_limits_window_end ON rate_limits(window_end);

-- Encrypted secrets table (for additional secret storage)
CREATE TABLE IF NOT EXISTS encrypted_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  encrypted_value TEXT NOT NULL,
  salt VARCHAR(64) NOT NULL,
  iv VARCHAR(32) NOT NULL,
  auth_tag VARCHAR(32) NOT NULL,
  algorithm VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  key_derivation VARCHAR(50) NOT NULL DEFAULT 'scrypt',
  iterations INTEGER NOT NULL DEFAULT 32768,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  created_by UUID,
  tags JSONB
);

CREATE INDEX idx_encrypted_secrets_name ON encrypted_secrets(name);

-- Security events table (for monitoring)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL, -- login_failed, suspicious_activity, etc.
  severity VARCHAR(20) NOT NULL, -- low, medium, high, critical
  user_id UUID,
  ip_address INET,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_resolved ON security_events(resolved);

-- Row Level Security Policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_secrets ENABLE ROW LEVEL SECURITY;

-- Policies for user_sessions
CREATE POLICY user_sessions_user_policy ON user_sessions
  FOR ALL 
  USING (auth.uid() = user_id);

-- Policies for api_keys
CREATE POLICY api_keys_user_policy ON api_keys
  FOR ALL 
  USING (auth.uid() = user_id);

-- Policies for user_permissions
CREATE POLICY user_permissions_user_policy ON user_permissions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Policies for audit_logs (read-only for users)
CREATE POLICY audit_logs_user_policy ON audit_logs
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for encrypted_secrets
CREATE TRIGGER update_encrypted_secrets_updated_at
  BEFORE UPDATE ON encrypted_secrets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
  DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired sessions (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-sessions', '0 */1 * * *', 'SELECT cleanup_expired_sessions();');