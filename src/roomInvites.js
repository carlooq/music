import { deleteDoc, doc, onSnapshot, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "roomInvites";
const INVITE_STALE_MS = 90 * 1000;

// Jedno aktywne zaproszenie do zwykłego pokoju na odbiorcę. Kolejne zaproszenie
// po prostu zastępuje poprzednie, dzięki czemu nie tworzymy kolejki starych popupów.
export async function sendRoomInvite(fromUid, fromName, toUid, toName, roomCode) {
  const ref = doc(db, COLLECTION, toUid);
  await setDoc(ref, {
    fromUid,
    fromName: fromName || "Gracz",
    toUid,
    toName: toName || "Gracz",
    roomCode,
    createdAt: serverTimestamp(),
  });
}

export function listenForIncomingRoomInvite(myUid, callback) {
  const ref = doc(db, COLLECTION, myUid);
  return onSnapshot(ref, (snap) => callback(snap.exists() ? snap.data() : null));
}

export async function clearRoomInvite(toUid, expected = null) {
  if (!toUid) return;
  const ref = doc(db, COLLECTION, toUid);
  try {
    if (!expected) {
      await deleteDoc(ref);
      return;
    }
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (expected.fromUid && data.fromUid !== expected.fromUid) return;
      if (expected.roomCode && data.roomCode !== expected.roomCode) return;
      tx.delete(ref);
    });
  } catch {
    // best effort — zaproszenie i tak jest ignorowane po przekroczeniu TTL logicznego
  }
}

export function isRoomInviteStale(createdAt) {
  const ms = createdAt && typeof createdAt.toMillis === "function" ? createdAt.toMillis() : null;
  if (!ms) return false;
  return Date.now() - ms > INVITE_STALE_MS;
}
