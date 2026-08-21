import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "dailySongs";

// Pobiera (albo, jeśli jeszcze nie istnieje dzisiaj, losuje i zapisuje)
// "piosenkę dnia" — tę samą dla wszystkich graczy danego dnia.
export async function getOrCreateDailySong(dayKey, pool) {
  const ref = doc(db, COLLECTION, dayKey);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const song = pool[Math.floor(Math.random() * pool.length)];
  const data = {
    videoId: song.videoId,
    artist: song.artist,
    title: song.title,
    year: song.year,
    startSeconds: Math.floor(Math.random() * 61) + 15, // 15–75s, żeby nie trafić w sam koniec
  };

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return; // ktoś inny już ustawił piosenkę dnia w międzyczasie
      tx.set(ref, data);
    });
  } catch (e) {
    // ciche niepowodzenie — poniżej i tak spróbujemy odczytać, co ostatecznie tam jest
  }

  const final = await getDoc(ref);
  return final.exists() ? final.data() : data;
}
