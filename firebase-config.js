// Shared Firebase setup — imported as an ES module by index.html, client-area.html, and admin.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, GithubAuthProvider, FacebookAuthProvider, OAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6EIvX77Dm8MYeZ4mAUlh8PYhiwmssW2Q",
  authDomain: "brightstack-portfolio.firebaseapp.com",
  projectId: "brightstack-portfolio",
  storageBucket: "brightstack-portfolio.firebasestorage.app",
  messagingSenderId: "1063629053655",
  appId: "1:1063629053655:web:3c80553bdc0c16cc089a92"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Auto-detect lets the SDK try a normal WebChannel connection first and fall back
// to long-polling only if that genuinely fails (restrictive proxies, some corporate
// networks). Preferred over forcing long-polling for everyone.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
});

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
// LinkedIn is wired in Firebase as a generic OIDC provider — the ID below must
// exactly match the "Provider ID" you set when adding it in the Firebase console.
export const linkedinProvider = new OAuthProvider('oidc.linkedin');

// TEMPORARY — replace with your real Firebase UID (Authentication → Users tab)
// once you've signed in once. This same string must also be pasted into your
// Firestore security rules wherever you see the same placeholder.
export const ADMIN_UID = "9pzEI4cfAyPBH0M51QU3McDMqfP2";
