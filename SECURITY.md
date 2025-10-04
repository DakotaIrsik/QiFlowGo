# Security Documentation

## Overview

This document outlines the security measures implemented in QiFlow Control Center to protect against common vulnerabilities.

## Implemented Security Features

### 1. Security Headers (Helmet.js)

The application uses Helmet.js to set secure HTTP headers:

- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: Prevents clickjacking
- **X-XSS-Protection**: Enables XSS filtering
- **Strict-Transport-Security**: Enforces HTTPS

### 2. API Key Authentication

API key authentication is implemented via the `X-API-Key` header:

- All API endpoints (except `/health`) require authentication
- API keys validated via `authenticateApiKey` middleware
- Configured via `API_KEY_SECRET` environment variable
- Returns 401 Unauthorized for missing/invalid keys

**Usage:**
```bash
curl -H "X-API-Key: your-api-key" https://api.example.com/api/v1/swarms
```

### 3. Rate Limiting

Rate limiting middleware is applied to all API routes via `src/middleware/rateLimiter.ts`:

- **General Limiter**: 100 requests per 15 minutes per IP
- Applied to all `/api/*` routes
- Returns 429 Too Many Requests when limit exceeded
- Includes rate limit headers in all responses

**Planned Rate Limiters** (not yet implemented):
- **Strict Limiter**: 20 requests per 15 minutes per IP (for write operations)
- **Command Limiter**: 10 command executions per 5 minutes per IP
- **Auth Limiter**: 5 authentication attempts per 15 minutes per IP

### 4. Command Whitelisting

Only pre-approved commands can be executed on remote hosts (Issue #13):
- Whitelisted commands defined in `remoteCommandService`
- Command validation before execution
- Audit logging for all command executions

### 5. SSH Security

- SSH key-based authentication only
- Connection pooling with proper cleanup
- Host status monitoring
- Automated connection management

### 6. Input Validation

- URL validation for swarm registration
- Parameter sanitization via express-validator
- SQL injection prevention through parameterized queries (using `pg` library)
- Size limits on request payloads
- JSON parsing with error handling

## Security Recommendations

### For Deployment

1. **Enable HTTPS** with valid SSL/TLS certificates
2. **Configure CORS** to allow only trusted domains
3. **Set secure environment variables**
4. **Use a firewall** to restrict network access
5. **Enable database connection encryption**
6. **Regular security audits** and dependency updates

### Environment Variables

```bash
# API Security
API_KEY_SECRET=your-secure-api-key-here

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# SSH Configuration (stored in database, not environment)
# SSH keys are stored encrypted in the hosts table

# CORS (configured in app.ts)
CORS_ORIGIN=https://your-domain.com

# Optional: Discord Webhooks
DISCORD_COMMIT_CHANNEL=https://discord.com/api/webhooks/...
DISCORD_RELEASE_CHANNEL=https://discord.com/api/webhooks/...
```

## Security Checklist

- [x] Security headers (Helmet.js)
- [x] Rate limiting middleware created and applied
- [x] Command whitelisting
- [x] SSH key-based authentication
- [x] Audit logging
- [x] Input validation
- [x] API Key Authentication (Issue #18) ✅
- [x] Rate limiting applied to all routes (Issue #18) ✅
- [ ] Penetration testing
- [ ] Production hardening

## Vulnerability Reporting

If you discover a security vulnerability:

1. **Do NOT** open a public GitHub issue
2. Contact maintainers privately
3. Provide detailed reproduction steps
4. Allow time for patching before disclosure

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
