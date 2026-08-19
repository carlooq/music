import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "./firebase-config.js";

export function decadeLabel(year) {
  const start = Math.floor(year / 10) * 10;
  return `${start}s`; // e.g. "1980s"
}

export async function ensureStatsDoc(uid, username) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      username,
      gamesPlayed: 0,
      gamesWon: 0,
      cardsCorrect: 0,
      cardsTotal: 0,
      decades: {},
    });
  }
}

export async function getStats(uid) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Called once per card placement, for the player who just placed it.
export async function recordCardGuess(uid, year, correct) {
  const ref = doc(db, "userStats", uid);
  const label = decadeLabel(year);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { decades: {} };
  const prevDecade = data.decades?.[label] || { correct: 0, total: 0 };

  await updateDoc(ref, {
    cardsTotal: increment(1),
    cardsCorrect: increment(correct ? 1 : 0),
    [`decades.${label}.total`]: (prevDecade.total || 0) + 1,
    [`decades.${label}.correct`]: (prevDecade.correct || 0) + (correct ? 1 : 0),
  });
}

// Called once per player at the end of a game.
export async function recordGameResult(uid, won) {
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, {
    gamesPlayed: increment(1),
    gamesWon: increment(won ? 1 : 0),
  });
}
