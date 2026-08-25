import { doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "duelInvites";
const INVITE_STALE_MS = 90 * 1000; // po tylu ms zaproszenie uznajemy za nieaktualne

// Wysyła zaproszenie na pojedynek 1v1. ID dokumentu = uid wyzywanego, więc
// każdy może mieć naraz tylko jedno oczekujące zaproszenie (kolejne nadpisuje).
export async function sendDuelChallenge(fromUid, fromName, toUid, toName) {
  const ref = doc(db, COLLECTION, toUid);
  await setDoc(ref, {
    fromUid,
    fromName,
    toUid,
    toName,
    status: "pending",
    createdAt: serverTimestamp(),
    roomCode: null,
  });
}

// Nasłuchuje na zaproszenie skierowane DO mnie (jako odbiorca).
export function listenForIncomingChallenge(myUid, callback) {
  const ref = doc(db, COLLECTION, myUid);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    const data = snap.data();
    if (data.status !== "pending") {
      callback(null);
      return;
    }
    callback(data);
  });
}

// Nasłuchuje na WYSŁANE przeze mnie zaproszenia (żeby wykryć akceptację
// i automatycznie dołączyć do utworzonego pokoju, albo odrzucenie).
export function listenForSentChallenges(myUid, callback) {
  const q = query(collection(db, COLLECTION), where("fromUid", "==", myUid));
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "modified" || change.type === "added") {
        callback(change.doc.data());
      }
    });
  });
}

export async function acceptDuelChallenge(toUid, roomCode) {
  const ref = doc(db, COLLECTION, toUid);
  await updateDoc(ref, { status: "accepted", roomCode });
}

export async function declineDuelChallenge(toUid) {
  const ref = doc(db, COLLECTION, toUid);
  await updateDoc(ref, { status: "declined" });
}

export async function clearDuelChallenge(toUid) {
  try {
    await deleteDoc(doc(db, COLLECTION, toUid));
  } catch (e) {
    // ciche niepowodzenie
  }
}

export function isChallengeStale(createdAt) {
  const ms = createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : null;
  if (!ms) return false; // jeszcze nie potwierdzone przez serwer — traktuj jako świeże
  return Date.now() - ms > INVITE_STALE_MS;
}
