import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "dropscope-b588a.firebaseapp.com",
  projectId: "dropscope-b588a",
  storageBucket: "dropscope-b588a.appspot.com",
  messagingSenderId: "626880059849",
  appId: "1:626880059849:web:XXXXXXXXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

try {
  await setDoc(doc(db, "appConfig", "updateMetadata"), metadata, { merge: true });
  console.log("✅ SUCCESS! Firestore metadata published.");
  console.log("\nAll connected devices will show update popup within 5-10 seconds!");
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error("\nYou may need to authenticate. Try running this in browser console instead:");
  console.log(JSON.stringify(metadata, null, 2));
}
