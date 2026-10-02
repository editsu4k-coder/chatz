# ChatZ v1.1 - Upload Release & Publish Update

## ✅ What's Done

- ✅ Repository created: **https://github.com/editsu4k-coder/chatz**
- ✅ Code pushed to `main` branch
- ✅ Release APK built and ready
- ✅ Real-time update listener integrated in app

## 📤 Upload APK as Release (2 minutes)

### Option A: Use Browser (Already Open)

I've opened the releases page for you. Follow these steps:

1. **Tag version:** `v1.1`
2. **Release title:** `ChatZ v1.1`
3. Click **"Attach binaries by dropping them here or selecting them"**
4. Select this file:
   ```
   C:\Users\HP\Music\ChatZ\buddy-stats-chat-main\android\app\build\outputs\apk\release\app-release.apk
   ```
5. Wait for upload to complete
6. Click **"Publish release"**
7. Right-click the uploaded APK → **Copy link address**
8. Save this URL

### Option B: Manual Navigation

If the browser page didn't load:

1. Go to: https://github.com/editsu4k-coder/chatz/releases/new
2. Follow steps 1-8 above

## 🔥 Publish Firestore Metadata (1 minute)

Once you have the GitHub release URL:

1. Go to: https://console.firebase.google.com/project/dropscope-b588a/firestore
2. Collection: **appConfig** → Document: **updateMetadata**
3. Add these fields:

| Field | Type | Value |
|-------|------|-------|
| latestVersionCode | number | `2` |
| latestVersionName | string | `"1.1"` |
| downloadUrl | string | `[PASTE YOUR GITHUB RELEASES URL HERE]` |
| sha256 | string | `"57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787"` |
| title | string | `"New Features Available"` |
| description | string | `"Friend sorting, online indicators, hide/show cards"` |
| changes | array | See below |
| mandatory | boolean | `false` |
| releaseDate | timestamp | Today's date |

For the `changes` array field, add these items:
- `"Sort friends by screen time (highest first)"`
- `"Fix online indicator accuracy"`
- `"Hide/show friend cards with toggle"`
- `"DM list sorted by online status"`
- `"Consistent circular refresh animation"`

Click **Save**.

## 🎉 Done!

All connected devices will automatically show the update popup within 5-10 seconds.

**No more manual APK sharing needed!** Future updates follow the same process:
1. Build release APK
2. Upload to GitHub Releases
3. Update Firestore metadata with new versionCode

---

**APK Location:** `android/app/build/outputs/apk/release/app-release.apk`  
**SHA-256:** `57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787`  
**Repository:** https://github.com/editsu4k-coder/chatz
