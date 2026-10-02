import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Values mirror android/app/google-services.json. The appId here was stale
// (…5ba8221332639044b3b018) which is one reason native Google Sign-In used to
// fail with status 10 — it no longer matched the registered Android app.
const firebaseConfig = {
  apiKey: "AIzaSyCom5ZyFQbQOWDfLMky1e_f6inIzbcdD7Q",
  authDomain: "dropscope-b588a.firebaseapp.com",
  projectId: "dropscope-b588a",
  storageBucket: "dropscope-b588a.firebasestorage.app",
  messagingSenderId: "626880059849",
  appId: "1:626880059849:android:41fa69ca5aceccc6b3b018",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
