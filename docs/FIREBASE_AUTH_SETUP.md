# Firebase Authentication Setup

This document describes the Firebase Authentication integration for the QiFlow Control Center backend API.

## Overview

The backend provides Firebase Authentication support for mobile clients, allowing users to authenticate using Firebase ID tokens. The system supports:

- Firebase ID token verification
- User session management
- Admin role management
- Custom token generation
- Multi-device logout

## Architecture

### Components

1. **FirebaseAuthService** (`src/services/firebaseAuthService.ts`)
   - Handles Firebase Admin SDK initialization
   - Verifies Firebase ID tokens
   - Manages user sessions

2. **Auth Middleware** (`src/middleware/auth.ts`)
   - `authenticateFirebase` - Validates Firebase tokens
   - `authenticateHybrid` - Accepts both API keys and Firebase tokens
   - `authenticateApiKey` - Legacy API key authentication

3. **Auth Routes** (`src/routes/authRoutes.ts`)
   - `POST /api/v1/auth/verify` - Verify Firebase token
   - `GET /api/v1/auth/user/:uid` - Get user information
   - `POST /api/v1/auth/logout` - Logout user (revoke tokens)
   - `POST /api/v1/auth/custom-token` - Create custom token (admin only)
   - `GET /api/v1/auth/status` - Check Firebase availability

4. **User Model** (`src/models/UserModel.ts`)
   - Database schema for users
   - User CRUD operations
   - Session tracking

## Setup Instructions

### 1. Firebase Project Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firebase Authentication with Email/Password provider
3. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate New Private Key"
   - Save the JSON file securely

### 2. Environment Configuration

Add the Firebase service account credentials to your `.env` file:

```env
# Firebase Admin SDK Configuration
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

> **Security Note**: Never commit the service account key to version control!

### 3. Database Migration

The UserModel will automatically create the necessary database tables when initialized:

```typescript
import { UserModel } from './models/UserModel';
import { pool } from './database/db';

const userModel = new UserModel(pool);
await userModel.initializeSchema();
```

The following table will be created:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  photo_url VARCHAR(500),
  email_verified BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);
```

## API Usage

### Mobile Client Authentication Flow

1. **User signs up/logs in via Firebase Auth SDK** (mobile app)
   ```typescript
   // Mobile app code
   import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

   const auth = getAuth();
   const userCredential = await signInWithEmailAndPassword(auth, email, password);
   const idToken = await userCredential.user.getIdToken();
   ```

2. **Verify token with backend**
   ```typescript
   // Mobile app sends token to backend
   const response = await fetch('https://api.example.com/api/v1/auth/verify', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ idToken })
   });

   const { user } = await response.json();
   // { uid: "...", email: "...", emailVerified: true }
   ```

3. **Use token for authenticated requests**
   ```typescript
   // Include token in Authorization header
   const response = await fetch('https://api.example.com/api/v1/swarms', {
     headers: {
       'Authorization': `Bearer ${idToken}`
     }
   });
   ```

### Backend API Examples

#### Verify Firebase Token

```bash
curl -X POST https://api.example.com/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"idToken": "firebase-id-token-here"}'
```

Response:
```json
{
  "success": true,
  "user": {
    "uid": "user-firebase-uid",
    "email": "user@example.com",
    "emailVerified": true
  }
}
```

#### Get User Information

```bash
curl -X GET https://api.example.com/api/v1/auth/user/USER_UID \
  -H "Authorization: Bearer firebase-id-token"
```

#### Logout (Revoke Tokens)

```bash
curl -X POST https://api.example.com/api/v1/auth/logout \
  -H "Authorization: Bearer firebase-id-token" \
  -H "Content-Type: application/json" \
  -d '{"uid": "user-firebase-uid"}'
```

## Security Considerations

### Token Validation

- All Firebase tokens are verified using Firebase Admin SDK
- Tokens are checked for expiration and signature validity
- Revoked tokens are rejected

### Authorization

- Users can only access their own data unless they have admin role
- Admin role is stored in custom claims and database
- Certain endpoints require admin privileges

### Rate Limiting

All authentication endpoints are protected by rate limiting (configured in `middleware/rateLimiter.ts`).

## Testing

Run tests with:

```bash
npm test
```

Authentication-related tests are in:
- `src/middleware/auth.test.ts`
- `src/services/firebaseAuthService.test.ts`
- `src/models/UserModel.test.ts`

## Troubleshooting

### Firebase Admin SDK not initialized

**Error**: `Firebase Admin SDK not initialized`

**Solution**: Ensure `FIREBASE_SERVICE_ACCOUNT_KEY` is properly set in `.env` file.

### Invalid token errors

**Error**: `Invalid or expired token`

**Causes**:
- Token expired (Firebase tokens expire after 1 hour)
- Token signature invalid
- Token issued by different Firebase project

**Solution**:
- Refresh the token on the client side
- Verify the Firebase project configuration

### Permission denied errors

**Error**: `Forbidden: Cannot access other user data`

**Cause**: User trying to access another user's data without admin privileges

**Solution**:
- Only request own user data
- Grant admin role if needed

## Migration Guide for Existing API Keys

The system supports hybrid authentication to maintain backward compatibility:

```typescript
// Both formats work:
Authorization: ApiKey your-api-key-here      // Legacy
Authorization: Bearer firebase-id-token     // Firebase Auth
```

Use the `authenticateHybrid` middleware for routes that need to support both methods.

## Future Enhancements

- [ ] 2FA support via Firebase Phone Authentication
- [ ] Social login providers (Google, Apple, GitHub)
- [ ] Role-based access control (RBAC)
- [ ] Session analytics and monitoring
- [ ] Multi-tenancy support
