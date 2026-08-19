import { doc, getDoc, setDoc, updateDoc, increment, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";

export function decadeLabel(year) {
  const start = Math.floor(year / 10) * 10;
  return `${start}s`; // e.g. "1980s"
}

// Firestore treats "." as a nested-path separator, so artist names that
// contain one (e.g. "N.E.R.D") need a safe field-key form.
function artistKey(artist) {
  return artist.replace(/[.$/[\]#]/g, "_");
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
      artists: {},
      currentStreak: 0,
      longestStreak: 0,
    });
  }
}

export async function getStats(uid) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Called once per card placement, for the player who just placed it.
export async function recordCardGuess(uid, year, correct, artist) {
  const ref = doc(db, "userStats", uid);
  const decade = decadeLabel(year);
  const aKey = artistKey(artist || "Nieznany");
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const prevDecade = data.decades?.[decade] || { correct: 0, total: 0 };
  const prevArtist = data.artists?.[aKey] || { name: artist || "Nieznany", correct: 0, total: 0 };
  const newCurrentStreak = correct ? (data.currentStreak || 0) + 1 : 0;
  const newLongestStreak = Math.max(data.longestStreak || 0, newCurrentStreak);

  await updateDoc(ref, {
    cardsTotal: increment(1),
    cardsCorrect: increment(correct ? 1 : 0),
    [`decades.${decade}.total`]: (prevDecade.total || 0) + 1,
    [`decades.${decade}.correct`]: (prevDecade.correct || 0) + (correct ? 1 : 0),
    [`artists.${aKey}.name`]: artist || "Nieznany",
    [`artists.${aKey}.total`]: (prevArtist.total || 0) + 1,
    [`artists.${aKey}.correct`]: (prevArtist.correct || 0) + (correct ? 1 : 0),
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
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

// Best/worst artists for a player, requiring a minimum number of
// attempts so a single lucky guess doesn't show up as "100%".
export function topArtists(stats, count = 5, minAttempts = 2) {
  if (!stats?.artists) return { best: [], worst: [] };
  const entries = Object.values(stats.artists)
    .filter((a) => a.total >= minAttempts)
    .map((a) => ({ ...a, pct: a.correct / a.total }));
  const best = [...entries].sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, count);
  const worst = [...entries].sort((a, b) => a.pct - b.pct || b.total - a.total).slice(0, count);
  return { best, worst };
}

// Top players globally, sorted by number of games won.
export async function getLeaderboard(count = 10) {
  const q = query(collection(db, "userStats"), orderBy("gamesWon", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
