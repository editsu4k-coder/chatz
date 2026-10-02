import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Calculate APK SHA-256
const apkPath = join(rootDir, 'android/app/build/outputs/apk/release/app-release.apk');
const apkBuffer = readFileSync(apkPath);
const sha256 = createHash('sha256').update(apkBuffer).digest('hex');

console.log('=== Publishing ChatZ Update Metadata ===\n');
console.log(`Version: 1.1 (versionCode 2)`);
console.log(`SHA-256: ${sha256}\n`);

// Initialize Firebase Admin
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccountPath) {
  console.error('ERROR: Set GOOGLE_APPLICATION_CREDENTIALS environment variable');
  console.error('Example: $env:GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8')))
});

const db = getFirestore();
const docRef = db.collection('appConfig').doc('updateMetadata');

// You need to upload the APK first and provide the URL
// For now, using a placeholder - replace with actual GitHub Releases or Firebase Storage URL
const downloadUrl = process.argv[2] || 'PLACEHOLDER_UPLOAD_TO_GITHUB_RELEASES';

await docRef.set({
  latestVersionCode: 2,
  latestVersionName: '1.1',
  downloadUrl: downloadUrl,
  sha256: sha256,
  title: 'New Features Available',
  description: 'Friend sorting, online indicators, hide/show cards',
  changes: [
    'Sort friends by screen time (highest first)',
    'Fix online indicator accuracy',
    'Hide/show friend cards with toggle',
    'DM list sorted by online status',
    'Consistent circular refresh animation'
  ],
  mandatory: false,
  releaseDate: new Date().toISOString()
}, { merge: true });

console.log('✅ Firestore metadata published successfully!');
console.log(`Document: appConfig/updateMetadata`);
console.log(`Download URL: ${downloadUrl}`);
console.log('\nConnected devices will show update popup within 5-10 seconds.');
console.log('\nNext steps:');
console.log('1. Upload android/app/build/outputs/apk/release/app-release.apk to GitHub Releases');
console.log('2. Copy the download URL');
console.log('3. Run this script again with the URL: node scripts/publish-firestore-update.mjs "https://..."');
