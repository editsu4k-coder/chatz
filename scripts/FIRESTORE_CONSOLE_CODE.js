// Copy this entire block and paste it in your browser console (F12) while on Firebase Console
// This will create the appConfig/updateMetadata document automatically

const metadata = {
  latestVersionCode: 2,
  latestVersionName: "1.1",
  downloadUrl: "https://github.com/editsu4k-coder/chatz/releases/download/v1.1/app-release.apk",
  sha256: "57b0d41a9f2fd66069e0b617d243711a13ec1d1cfa40d35dd2e8e8ce3e353787",
  title: "New Features Available",
  description: "Friend sorting, online indicators, hide/show cards",
  changes: [
    "Sort friends by screen time (highest first)",
    "Fix online indicator accuracy",
    "Hide/show friend cards with toggle",
    "DM list sorted by online status",
    "Consistent circular refresh animation"
  ],
  mandatory: false,
  releaseDate: new Date().toISOString()
};

console.log("Publishing update metadata...");
console.log(JSON.stringify(metadata, null, 2));

// Use Firebase Console's internal API
fetch('/v1/projects/dropscope-b588a/databases/(default)/documents/appConfig/updateMetadata', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    fields: {
      latestVersionCode: { integerValue: "2" },
      latestVersionName: { stringValue: "1.1" },
      downloadUrl: { stringValue: metadata.downloadUrl },
      sha256: { stringValue: metadata.sha256 },
      title: { stringValue: metadata.title },
      description: { stringValue: metadata.description },
      changes: {
        arrayValue: {
          values: metadata.changes.map(c => ({ stringValue: c }))
        }
      },
      mandatory: { booleanValue: false },
      releaseDate: { stringValue: metadata.releaseDate }
    }
  })
})
.then(r => r.json())
.then(data => {
  console.log("✅ SUCCESS! Document created:", data.name);
  alert("Update metadata published! All devices will see the update popup within seconds.");
})
.catch(err => {
  console.error("❌ Error:", err);
  alert("Error creating document. Check console for details.");
});
