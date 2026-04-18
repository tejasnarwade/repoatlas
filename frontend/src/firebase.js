import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBUHyqRWtAjyBWDAelUuHJ9T6c_zqIzieQ",
  authDomain: "repoatlas-63915.firebaseapp.com",
  projectId: "repoatlas-63915",
  storageBucket: "repoatlas-63915.firebasestorage.app",
  messagingSenderId: "876828819507",
  appId: "1:876828819507:web:8dfec5b1fcacef54fea346",
  measurementId: "G-5T9Z9F36W9",
};

const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const auth = getAuth(app);

export async function firebaseSignUp(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  return { name, email };
}

export async function firebaseLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return {
    name: cred.user.displayName || email.split("@")[0],
    email: cred.user.email,
  };
}

export async function firebaseLogout() {
  await signOut(auth);
}

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, (user) => {
    if (user) cb({ name: user.displayName || user.email.split("@")[0], email: user.email });
    else cb(null);
  });
}
