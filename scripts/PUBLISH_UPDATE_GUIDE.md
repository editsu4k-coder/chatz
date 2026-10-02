# Publish ChatZ Update - 3 Steps

## Step 1: Upload APK to GitHub Releases

1. Go to your GitHub repository
2. Click **Releases** → **Create new release**
3. Tag: `v1.1`
4. Click **Attach binaries** → select `android/app/build/outputs/apk/release/app-release.apk`
5. Click **Publish release**
6. Right-click the APK file → **Copy link address** (save this URL)

## Step 2: Open Firebase Console

1. Go to https://console.firebase.google.com/project/dropscope-b588a/firestore
2. In the left sidebar, find **appConfig** collection
   - If it doesn't exist, click **Start collection** and name it `appConfig`
3. Click **+ Add document** or find document ID `updateMetadata`
   - If it doesn't exist, type `updateMetadata` as the Document ID

## Step 3: Paste Metadata

Replace the `downloadUrl` value in this JSON with your GitHub Releases URL from Step 1:

```json
{
  "latestVersionCode": 2,
  "latestVersionName": "1.1",
  "downloadUrl": "PASTE_YOUR_GITHUB_RELEASES_URL_HERE",
  "sha256": "57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787",
  "title": "New Features Available",
  "description": "Friend sorting, online indicators, hide/show cards",
  "changes": [
    "Sort friends by screen time (highest first)",
    "Fix online indicator accuracy",
    "Hide/show friend cards with toggle",
    "DM list sorted by online status",
    "Consistent circular refresh animation"
  ],
  "mandatory": false,
  "releaseDate": "2026-10-02T00:00:00.000Z"
}
```

In Firebase Console:
- Click each field name and paste the corresponding value
- For `latestVersionCode`: select **number** type, enter `2`
- For `mandatory`: select **boolean** type, set to `false`
- For `releaseDate`: select **timestamp** type or just paste as string

Click **Save**.

## Done!

All connected devices will automatically show the update popup within 5-10 seconds. No app restart needed.

---

**For future updates:** Just increment `latestVersionCode` (3, 4, 5...) and repeat these steps.
