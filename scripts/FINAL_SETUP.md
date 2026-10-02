# ChatZ Release - Final Setup (3 Minutes)

## You've Authorized GitHub - Here's What To Do Next

Since you're already logged into GitHub, follow these exact steps:

### Step 1: Create Repository (30 seconds)

1. **Click this link:** https://github.com/new
2. **Repository name:** `chatz`
3. **Visibility:** Public ✓
4. **Click "Create repository"**

### Step 2: Push Code (1 minute)

Copy and paste these commands in your terminal:

```bash
cd C:\Users\HP\Music\ChatZ\buddy-stats-chat-main
git remote add origin https://github.com/YOUR_USERNAME/chatz.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Create Release & Upload APK (1 minute)

1. Go to your new repo → **Releases** tab → **Create a new release**
   - Or: `https://github.com/YOUR_USERNAME/chatz/releases/new`
2. **Tag:** `v1.1`
3. **Title:** `ChatZ v1.1`
4. Click **"Attach binaries"** → select this file:
   ```
   C:\Users\HP\Music\ChatZ\buddy-stats-chat-main\android\app\build\outputs\apk\release\app-release.apk
   ```
5. Wait for upload → **Right-click uploaded APK** → Copy link address
6. **Save this URL** (you'll need it for Firestore)

### Step 4: Publish to Firestore (1 minute)

1. Go to: https://console.firebase.google.com/project/dropscope-b588a/firestore
2. Collection: **appConfig** → Document: **updateMetadata**
3. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| latestVersionCode | number | `2` |
| latestVersionName | string | `"1.1"` |
| downloadUrl | string | `[PASTE YOUR GITHUB URL HERE]` |
| sha256 | string | `"57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787"` |
| title | string | `"New Features Available"` |
| description | string | `"Friend sorting, online indicators, hide/show cards"` |
| mandatory | boolean | `false` |
| releaseDate | timestamp | Today's date |

4. Click **Save**

## Done! ✅

All connected devices will show the update popup within 5-10 seconds automatically.

---

**APK is ready at:** `android/app/build/outputs/apk/release/app-release.apk`

**Total time:** ~3 minutes
