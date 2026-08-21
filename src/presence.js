import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "presence";

// Każdy klient odświeża swój wpis co jakiś czas, dopóki appka jest otwarta.
export async function heartbeat(playerId, name) {
  try {
    const ref = doc(db, COLLECTION, playerId);
    await setDoc(ref, { name: name || "Gracz", lastSeen: serverTimestamp() });
  } catch (e) {
    // ciche niepowodzenie — licznik online to funkcja poglądowa, nie krytyczna
  }
}

// Best-effort — nie zawsze zdąży się wywołać (np. zamknięcie karty), dlatego
// licznik i tak filtruje po "ostatnio widziany", nie tylko po obecności wpisu.
export async function clearPresence(playerId) {
  try {
    await deleteDoc(doc(db, COLLECTION, playerId));
  } catch (e) {
    // nic się nie stanie — wpis i tak "wygaśnie" z licznika po chwili
  }
}

// Liczy, ile osób miało "puls" w ciągu ostatnich `withinMs` (domyślnie 60s).
export async function getOnlineCount(withinMs = 60000) {
  try {
    const cutoff = new Date(Date.now() - withinMs);
    const q = query(collection(db, COLLECTION), where("lastSeen", ">", cutoff));
    const snap = await getDocs(q);
    return snap.size;
  } catch (e) {
    return null;
  }
}
