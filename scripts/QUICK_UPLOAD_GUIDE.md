# Upload ChatZ Update - Quick Guide

## Option 1: GitHub Releases (Recommended)

### Step 1: Create Repository (if not exists)

1. Go to: **https://github.com/new**
2. Repository name: `chatz` (or any name you prefer)
3. Visibility: **Public** (so friends can download)
4. Click **Create repository**

### Step 2: Upload APK as Release

1. Go to your new repo → **Releases** tab → **Create a new release**
   - Or direct URL: `https://github.com/YOUR_USERNAME/REPO_NAME/releases/new`
2. Tag: `v1.1`
3. Release title: `ChatZ v1.1`
4. Click **Attach binaries by dropping them here or selecting them**
5. Select file: `android/app/build/outputs/apk/release/app-release.apk`
6. Wait for upload to complete
7. Right-click the uploaded APK → **Copy link address**
8. Save this URL (you'll need it in Step 3)

## Option 2: Firebase Storage (Simpler)

1. Go to: **https://console.firebase.google.com/project/dropscope-b588a/storage**
2. If Storage isn't enabled, click **Get started** → choose location → enable
3. Click **Add folder** → name it `releases`
4. Open `releases` folder → click **Upload file**
5. Select: `android/app/build/outputs/apk/release/app-release.apk`
6. After upload, click the file → **File details** tab
7. Copy the **Download URL** (looks like `https://firebasestorage.googleapis.com/...`)
8. Save this URL

## Step 3: Publish to Firestore

1. Go to: **https://console.firebase.google.com/project/dropscope-b588a/firestore**
2. Find collection **appConfig** (create if doesn't exist)
3. Find document **updateMetadata** (create if doesn't exist)
4. Add these fields:

| Field Name | Type | Value |
|------------|------|-------|
| latestVersionCode | number | `2` |
| latestVersionName | string | `"1.1"` |
| downloadUrl | string | `PASTE_YOUR_URL_HERE` |
| sha256 | string | `"57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787"` |
| title | string | `"New Features Available"` |
| description | string | `"Friend sorting, online indicators, hide/show cards"` |
| mandatory | boolean | `false` |
| releaseDate | timestamp | `October 2, 2026 at 12:00:00 AM UTC` |

For the `changes` field (array):
- Click **Add field** → type `changes` → select **array** type
- Add items:
  - `"Sort friends by screen time (highest first)"`
  - `"Fix online indicator accuracy"`
  - `"Hide/show friend cards with toggle"`
  - `"DM list sorted by online status"`
  - `"Consistent circular refresh animation"`

5. Click **Save**

## Done!

All connected devices will show the update popup within 5-10 seconds automatically.

---

**APK Location:** `android/app/build/outputs/apk/release/app-release.apk`

**SHA-256:** `57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787`
