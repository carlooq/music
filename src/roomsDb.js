import { collection, getDocs, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "rooms";

// Usuwa pokoje, których czas minął (pole expireAt w przeszłości), oraz —
// jako siatkę bezpieczeństwa — stare pokoje sprzed wprowadzenia expireAt
// (starsze niż 7 dni wg createdAt). Zwraca podsumowanie do wyświetlenia adminowi.
export async function cleanupOldRooms(onProgress) {
  const snap = await getDocs(collection(db, COLLECTION));
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const toDelete = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    const expireAtMs = data.expireAt && typeof data.expireAt.toMillis === "function" ? data.expireAt.toMillis() : null;
    const createdAtMs = data.createdAt && typeof data.createdAt.toMillis === "function" ? data.createdAt.toMillis() : null;

    if (expireAtMs !== null) {
      if (expireAtMs <= now) toDelete.push(d.id);
    } else if (createdAtMs !== null && createdAtMs <= sevenDaysAgo) {
      // stary pokój sprzed wprowadzenia expireAt — brak pola, więc sprawdzamy wiek
      toDelete.push(d.id);
    }
  });

  const chunkSize = 450;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += chunkSize) {
    const chunk = toDelete.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((id) => batch.delete(doc(db, COLLECTION, id)));
    await batch.commit();
    deleted += chunk.length;
    if (onProgress) onProgress(deleted, toDelete.length);
  }

  return { totalRooms: snap.docs.length, deleted };
}
