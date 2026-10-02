# ChatZ Release Procedure

This document describes the complete workflow for releasing a new version of ChatZ with in-app update support.

## Overview

ChatZ uses an in-app update system that checks Firestore for version metadata and downloads APKs from GitHub Releases. Each release requires:

1. Building and signing the APK
2. Creating a GitHub Release with the APK file
3. Computing the SHA-256 checksum
4. Updating the Firestore `appConfig/updateMetadata` document
5. Deploying updated security rules (if needed)

## Prerequisites

- Android build environment with signing keys configured
- GitHub repository with Releases enabled
- Firebase CLI installed and authenticated
- Access to Firebase Console for the ChatZ project

## Step-by-Step Release Process

### 1. Increment Version Code

Edit `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "com.chatz.app"
    versionCode 2        // Increment this number (must be higher than previous)
    versionName "1.0.1"  // Human-readable version
    ...
}
```

**Important:** `versionCode` must be a positive integer greater than the previous release. This is what the update system compares — NOT `versionName`.

### 2. Build Signed APK

```bash
cd android
./gradlew assembleRelease
```

The signed APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### 3. Test APK Locally

Install the APK on a test device:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Verify:
- App launches successfully
- Google Sign-In works
- Stats display correctly
- No crashes or obvious bugs

### 4. Create GitHub Release

#### Option A: Via Web UI

1. Go to your GitHub repository → Releases → Draft new release
2. Tag version: `v1.0.1` (match versionName)
3. Release title: `ChatZ v1.0.1`
4. Description: Add changelog bullet points
5. Upload asset: Attach `app-release.apk`
6. Publish release

#### Option B: Via GitHub CLI

```bash
gh release create v1.0.1 \
  --title "ChatZ v1.0.1" \
  --notes "- Improved friend statistics\n- Better notification reliability" \
  android/app/build/outputs/apk/release/app-release.apk
```

### 5. Compute SHA-256 Checksum

```bash
sha256sum android/app/build/outputs/apk/release/app-release.apk
```

Copy the 64-character hex string (e.g., `abc123...`).

**Alternative on Windows:**
```powershell
Get-FileHash android\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
```

### 6. Update Firestore Metadata

#### Option A: Via Firebase Console

1. Go to Firebase Console → Cloud Firestore
2. Navigate to collection: `appConfig`
3. Document ID: `updateMetadata`
4. Update fields:

```json
{
  "latestVersionCode": 2,              // Must match build.gradle versionCode
  "latestVersionName": "1.0.1",        // Human-readable version
  "minimumSupportedVersionCode": 1,    // Lowest versionCode that can still work
  "downloadUrl": "https://github.com/username/chatz/releases/download/v1.0.1/app-release.apk",
  "sha256": "abc123def456...",          // Full 64-char SHA-256 hash
  "title": "ChatZ 1.0.1",
  "description": "A new ChatZ update is ready.",
  "releaseDate": "2026-10-02T00:00:00Z", // ISO 8601 format
  "mandatory": false,                   // true = blocks app until updated
  "changes": [                          // Array of changelog items
    "Improved friend statistics",
    "Better notification reliability",
    "Fixed dark mode contrast issue"
  ],
  "updatedAt": "October 2, 2026 at 12:00:00 PM UTC"  // Server timestamp
}
```

#### Option B: Via Firebase Admin SDK Script

Create a Node.js script `update-metadata.js`:

```javascript
const admin = require('firebase-admin');

// Initialize with your service account key
admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

const db = admin.firestore();

async function updateMetadata() {
  const metadata = {
    latestVersionCode: 2,
    latestVersionName: "1.0.1",
    minimumSupportedVersionCode: 1,
    downloadUrl: "https://github.com/username/chatz/releases/download/v1.0.1/app-release.apk",
    sha256: "abc123def456...",
    title: "ChatZ 1.0.1",
    description: "A new ChatZ update is ready.",
    releaseDate: "2026-10-02T00:00:00Z",
    mandatory: false,
    changes: [
      "Improved friend statistics",
      "Better notification reliability"
    ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.collection('appConfig').doc('updateMetadata').set(metadata);
  console.log('Metadata updated successfully');
  process.exit(0);
}

updateMetadata().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
```

Then run:

```bash
npm install firebase-admin
node update-metadata.js
```

**Note:** Requires a Firebase service account key file with appropriate permissions.

### 7. Verify Update Flow

On a device running an older version:

1. Open ChatZ
2. Wait ~5 seconds after splash screen
3. Update dialog should appear
4. Tap "Update Now"
5. Verify download starts
6. Verify installation prompt appears
7. After install, verify new version code matches

### 8. Deploy Security Rules (If Changed)

If you modified `firestore.rules`:

```bash
firebase deploy --only firestore:rules
```

## Mandatory vs Optional Updates

### Optional Update (`mandatory: false`)

- User sees "Later" button
- Can dismiss and continue using app
- Update check respects 6-hour cooldown
- System notification shown once per version

### Mandatory Update (`mandatory: true`)

- Blocks dashboard access entirely
- No "Later" button — only "Update ChatZ"
- User cannot proceed without updating
- Use for critical security fixes or breaking API changes

**Set minimumSupportedVersionCode** to the lowest versionCode that should still work. Users below this threshold see mandatory update regardless of `mandatory` flag.

## Testing Checklist

Before publishing to all users:

- [ ] APK installs cleanly on fresh device
- [ ] Google Sign-In works with registered SHA-1
- [ ] Update check returns correct status for current version
- [ ] Download completes successfully
- [ ] SHA-256 verification passes
- [ ] Installation prompt appears
- [ ] Post-update version code matches expected value
- [ ] Offline behavior graceful (cached metadata used)
- [ ] Same-version check returns "up_to_date"
- [ ] Settings → About → Check for updates bypasses cooldown

## Rollback Procedure

If a release has issues:

1. **Immediate:** Set `mandatory: false` in Firestore to stop blocking users
2. **Revert:** Update `latestVersionCode` to previous working version
3. **Hotfix:** Build new APK with incremented versionCode, repeat release process

**Note:** Cannot delete a GitHub Release once published, but can mark as draft or delete tag.

## Automation Opportunities

Future improvements:

- GitHub Actions to auto-compute SHA-256 and update Firestore
- Automated APK upload to GitHub Releases on git tag push
- Semantic versioning validation in CI/CD pipeline

## Troubleshooting

### Update not appearing

- Check Firestore document exists at `appConfig/updateMetadata`
- Verify `latestVersionCode` > current app's `BuildConfig.VERSION_CODE`
- Check device has network connectivity
- Clear app cache and retry (Settings → About → Check for updates)

### SHA-256 mismatch

- Recompute checksum from exact APK file uploaded to GitHub
- Ensure no CDN caching or file modification during upload
- Delete downloaded APK from device cache: `/data/data/com.chatz.app/cache/`

### Download fails

- Verify GitHub Release URL is publicly accessible (no auth required)
- Check URL uses HTTPS (required by UpdateManager)
- Confirm APK file size < 100MB (Android limitation)

### Installation fails

- Check `REQUEST_INSTALL_PACKAGES` permission granted
- Verify FileProvider configuration in `AndroidManifest.xml`
- Ensure `file_paths.xml` references cache directory correctly

## Contact

For questions about this procedure, contact the development team or refer to the architecture documentation.
