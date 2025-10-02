# CI/CD Pipeline Documentation

## Overview

QiFlowGo uses GitHub Actions for automated testing, building, and deployment. This document outlines the CI/CD workflows and how to use them.

## Workflows

### 1. Pull Request Validation (`.github/workflows/pr-check.yml`)

**Triggers:** Every pull request to `main`

**What it does:**
- Runs TypeScript type checking (`npm run lint`)
- Executes Jest unit tests with coverage reporting
- Ensures test coverage is above 75% (currently achieving **95.59%**)
- Builds the project to verify no compilation errors
- Uploads coverage reports to Codecov (optional)

**Matrix Testing:**
- Tests against Node.js 18.x and 20.x

**Preventing Merges:**
- PRs cannot be merged if any checks fail
- Coverage must be above 75% threshold

### 2. Backend Deployment (`.github/workflows/backend-deploy.yml`)

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch

**What it does:**
- Installs production dependencies
- Builds the TypeScript project
- Runs database migrations (when implemented)
- Deploys to cloud platform
- Performs health checks
- Creates deployment records

**Environments:**
- Production (default)
- Staging (manual dispatch option)

**Platform Support:**
The workflow is designed to support multiple deployment platforms:
- Firebase Functions
- AWS Lambda
- DigitalOcean App Platform
- Custom servers via SSH

### 3. Mobile Build & Release (`.github/workflows/mobile-release.yml`)

**Triggers:**
- Push to `main` branch
- Version tags (v*.*.*)
- Manual workflow dispatch

**iOS Build:**
- Runs on macOS runners
- Installs CocoaPods dependencies
- Imports code signing certificates and provisioning profiles
- Builds and archives the iOS app
- Exports signed IPA file

**Android Build:**
- Runs on Ubuntu runners
- Sets up Java 17 and Gradle
- Decodes and uses release keystore
- Builds APK for testing
- Builds AAB for Play Store

**Release Process:**
- Downloads all build artifacts
- Generates release notes from git commits
- Creates GitHub Release with IPA, APK, and AAB files
- Tags release with semantic version

## Version Management

Use npm scripts to manage semantic versioning:

```bash
# Patch release (1.0.0 -> 1.0.1)
npm run version:patch

# Minor release (1.0.0 -> 1.1.0)
npm run version:minor

# Major release (1.0.0 -> 2.0.0)
npm run version:major
```

**Automatic Checks:**
- `preversion`: Runs linting and tests before version bump
- `postversion`: Pushes commits and tags to remote

**Creating a Release:**
1. Ensure all changes are committed
2. Run version script: `npm run version:patch`
3. GitHub Actions will automatically build and release

## Required GitHub Secrets

### iOS Code Signing

- `IOS_CERTIFICATE_BASE64` - Apple distribution certificate (base64 encoded)
- `IOS_PROVISIONING_PROFILE_BASE64` - Provisioning profile (base64 encoded)
- `IOS_CERTIFICATE_PASSWORD` - Certificate password
- `APP_STORE_CONNECT_API_KEY` - For TestFlight uploads (optional)

**Encoding certificates:**
```bash
base64 -i certificate.p12 -o certificate.txt
base64 -i profile.mobileprovision -o profile.txt
```

### Android Code Signing

- `ANDROID_KEYSTORE_BASE64` - Release keystore (base64 encoded)
- `ANDROID_KEYSTORE_PASSWORD` - Keystore password
- `ANDROID_KEY_ALIAS` - Key alias
- `ANDROID_KEY_PASSWORD` - Key password

**Encoding keystore:**
```bash
base64 -i release.keystore -o keystore.txt
```

### Backend & Services

- `DATABASE_URL` - PostgreSQL database connection string
- `SSH_DEPLOY_KEY` - SSH key for deployment to cloud servers (optional)
- `FIREBASE_SERVICE_ACCOUNT` - Firebase admin credentials (optional)
- `CODECOV_TOKEN` - Codecov upload token (optional)

## Setting Up Secrets

1. Navigate to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each required secret with its value
4. Secrets are encrypted and only visible to GitHub Actions

## Rollback Strategy

### Backend Rollback

1. Navigate to Actions → Backend Deployment
2. Find the successful deployment you want to rollback to
3. Click "Re-run jobs" to redeploy that version

### Mobile Rollback

- Previous releases are retained in GitHub Releases for 90 days
- Download previous IPA/APK from Releases page
- Redistribute to users or upload to app stores

## Health Checks

The backend deployment workflow includes health check verification:
- Waits 10 seconds for deployment to stabilize
- Calls `/health` endpoint
- Fails deployment if health check fails

**Implementing Health Check Endpoint:**
```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

## Troubleshooting

### PR Check Failures

**Lint errors:**
```bash
npm run lint
```

**Test failures:**
```bash
npm test
```

**Coverage below 75%:**
- Write additional tests
- Check coverage report: `npm test -- --coverage`

### Deployment Failures

**Database migration errors:**
- Check `DATABASE_URL` secret is set correctly
- Verify migration scripts are valid

**Health check failures:**
- Check application logs
- Verify deployment environment variables
- Test health endpoint locally

### Build Failures

**iOS build errors:**
- Verify certificates and provisioning profiles are valid
- Check CocoaPods installation
- Review Xcode project settings

**Android build errors:**
- Verify keystore credentials
- Check Gradle configuration
- Ensure Java version compatibility

## Best Practices

1. **Always create PRs** - Never push directly to `main`
2. **Write tests** - Maintain >75% coverage
3. **Use semantic versioning** - Follow semver conventions
4. **Test locally first** - Run `npm run lint && npm test` before pushing
5. **Monitor deployments** - Check Actions tab for deployment status
6. **Keep secrets secure** - Never commit secrets to repository
7. **Document changes** - Write clear commit messages for release notes

## Release Artifacts

**Current Status**: Backend-only project
- Mobile app is not yet implemented
- Workflows are configured and ready for when mobile app is built

**When mobile app is implemented**, each release will generate:
- **iOS IPA**: `QiFlowControlCenter-v{version}-ios.ipa`
- **Android APK**: `QiFlowControlCenter-v{version}-android.apk`
- **Android AAB**: `QiFlowControlCenter-v{version}-android-bundle.aab`
- **Release notes**: Auto-generated from commit messages
- **Changelog**: Updated version history

## Future Enhancements

- [ ] TestFlight automatic upload for iOS
- [ ] Google Play Internal Testing upload for Android
- [ ] Automated E2E testing in CI
- [ ] Performance benchmarking
- [ ] Security scanning (Snyk, Dependabot)
- [ ] Database migration system
- [ ] Blue-green deployment strategy
- [ ] Canary releases

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
