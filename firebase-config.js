// Shared Firebase setup — Secure ES Module
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

// Initialize Firebase App securely
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with explicit database targeting and robust polling fallback
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false
}, 'default');

// Configure Auth Providers with secure custom parameters (e.g., forcing account selection prompt)
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const githubProvider = new GithubAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

// LinkedIn OIDC Provider setup
export const linkedinProvider = new OAuthProvider('oidc.linkedin');

// ADMIN CONSTANT
export const ADMIN_UID = "9pzEI4cfAyPBH0M51QU3McDMqfP2";

/**
 * Secure Helper: Client-side check to verify if the currently logged-in user is an admin.
 * NOTE: Client-side checks are strictly for UI rendering/routing. 
 * Real security and data protection MUST be enforced via Firestore Security Rules.
 * 
 * @param {import('firebase/auth').User | null} user 
 * @returns {boolean}
 */
export function verifyAdminAccess(user) {
  if (!user || !user.uid) return false;
  return user.uid === ADMIN_UID;
}
