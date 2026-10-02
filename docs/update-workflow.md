# ChatZ Professional In-App Update Workflow

## Overview

Friends automatically receive update notifications via Firestore real-time listeners — no manual APK sharing required.

## Release Process (For Each New Version)

### 1. Build Release APK

```bash
cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

### 2. Calculate SHA-256 Hash

```bash
certutil -hashfile app-release.apk SHA256
```

### 3. Upload APK to Hosting Service

**Option A: GitHub Releases**
1. Go to repository → Releases → Create new release
2. Tag: `v1.1` (or current versionName)
3. Attach `app-release.apk`
4. Publish release
5. Copy download URL (right-click APK → Copy link address)

**Option B: Firebase Storage**
1. Go to Firebase Console → Storage
2. Upload `app-release.apk` to a folder like `releases/v1.1/`
3. Get download URL from file details

### 4. Publish Metadata to Firestore

Go to Firebase Console → Firestore Database → Start collection (if not exists):

**Collection:** `appConfig`  
**Document ID:** `updateMetadata`

**Fields:**
```
latestVersionCode: 2 (number, integer)
latestVersionName: "1.1" (string)
downloadUrl: "https://github.com/.../app-release.apk" (string)
sha256: "57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787" (string)
title: "New Features Available" (string)
description: "Friend card sorting, online indicator fixes, and more" (string)
changes: ["Sort friends by screen time", "Fix online indicator accuracy", "Hide/show friend cards"] (array of strings)
mandatory: false (boolean)
releaseDate: "2026-10-02T00:00:00.000Z" (timestamp or string)
```

**Important:** The `latestVersionCode` field MUST be incremented for each release (3, 4, 5...). This is what triggers the update popup on connected devices.

### 5. Test Update Flow

1. Keep app open on test device
2. Publish metadata to Firestore
3. Within 5-10 seconds, device should show update popup
4. Click "Update Now" → downloads APK → verifies SHA-256 → installs

## How It Works

1. **Real-time Listener:** App shell (`src/routes/app.tsx`) starts Firestore listener when user reaches dashboard
2. **Metadata Change Detection:** When you update `appConfig/updateMetadata`, all connected devices fire callback immediately
3. **Version Comparison:** App compares `latestVersionCode` from Firestore vs installed version
4. **Update Popup:** If newer version detected, shows modal with download button
5. **Secure Installation:** Downloads APK, verifies SHA-256 hash, launches installer via FileProvider

## Current Release Info

- **Version Code:** 2
- **Version Name:** 1.1
- **SHA-256:** `57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787`
- **APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

## Next Steps

1. Upload `app-release.apk` to GitHub Releases or Firebase Storage
2. Copy the download URL
3. Publish Firestore metadata document with fields above
4. Test on your device — update popup should appear within seconds
5. Friends' devices will automatically detect future updates the same way
