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

### 2. Rate Limiting

Rate limiting middleware is available in `src/middleware/rateLimiter.ts`:

- **General Limiter**: 100 requests per 15 minutes per IP
- **Strict Limiter**: 20 requests per 15 minutes per IP (for write operations)
- **Command Limiter**: 10 command executions per 5 minutes per IP
- **Auth Limiter**: 5 authentication attempts per 15 minutes per IP

### 3. Command Whitelisting

Only pre-approved commands can be executed on remote hosts (Issue #13):
- Whitelisted commands defined in `remoteCommandService`
- Command validation before execution
- Audit logging for all command executions

### 4. SSH Security

- SSH key-based authentication only
- Connection pooling with proper cleanup
- Host status monitoring
- Automated connection management

### 5. Input Validation

- URL validation for swarm registration
- Parameter sanitization
- SQL injection prevention through parameterized queries
- Size limits on request payloads

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
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# SSH Configuration
SSH_KEY_PATH=/path/to/ssh/keys

# CORS
CORS_ORIGIN=https://your-domain.com
```

## Security Checklist

- [x] Security headers (Helmet.js)
- [x] Rate limiting middleware created
- [x] Command whitelisting
- [x] SSH key-based authentication
- [x] Audit logging
- [x] Input validation
- [ ] Authentication/Authorization (Issue #18)
- [ ] Penetration testing (Issue #18)
- [ ] Production hardening (Issue #18)

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
