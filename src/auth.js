import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase-config.js";

// Firebase Auth requires an email format under the hood, but the user
// never sees or types a real email — we just turn their chosen login
// into a fake, unique address internally.
function usernameToPseudoEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return `${clean}@hitster-app.local`;
}

export async function registerWithUsername(username, password) {
  const email = usernameToPseudoEmail(username);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username.trim() });
  return cred.user;
}

export async function loginWithUsername(username, password) {
  const email = usernameToPseudoEmail(username);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// Friendlier Polish messages for the handful of errors users actually hit.
export function friendlyAuthError(e) {
  const code = e?.code || "";
  if (code.includes("email-already-in-use")) return "Ten login jest już zajęty.";
  if (code.includes("weak-password")) return "Hasło musi mieć co najmniej 6 znaków.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Zły login lub hasło.";
  }
  return "Coś poszło nie tak: " + (e?.message || "nieznany błąd");
}
