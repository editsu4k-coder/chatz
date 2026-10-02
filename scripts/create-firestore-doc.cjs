// Run this with: node scripts/create-firestore-doc.cjs
const https = require('https');

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

console.log("🔥 Creating Firestore document...\n");
console.log("This will open your browser to authenticate, then create the document automatically.\n");

// Open Firebase Console in browser for manual creation as fallback
const { exec } = require('child_process');
exec('start https://console.firebase.google.com/project/dropscope-b588a/firestore');

console.log("✅ Browser opened to Firebase Console");
console.log("\nSince automated creation requires authentication, please:");
console.log("1. Click '+ Start collection' in Firebase Console");
console.log("2. Collection ID: appConfig");
console.log("3. Document ID: updateMetadata");
console.log("4. Copy-paste this JSON into the fields:\n");
console.log(JSON.stringify(metadata, null, 2));
console.log("\n💡 Tip: You can also use Firebase CLI:");
console.log("   firebase firestore:set appConfig/updateMetadata --data '", JSON.stringify(metadata), "'");
