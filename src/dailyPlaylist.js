import { doc, getDoc, setDoc, updateDoc, increment, runTransaction, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { awardXp, currentWeekKey } from "./stats.js";

const PLAYLISTS_COLLECTION = "dailyPlaylists";
const SCORES_COLLECTION = "dailyPlaylistScores";
const WEEKLY_COLLECTION = "weeklyPlaylistScores";
const WEEKLY_REWARDS_PROCESSED_COLLECTION = "weeklyPlaylistRewardsProcessed";
const SCORED_COUNT = 10; // tyle kart faktycznie się ocenia — pierwsza karta zawsze "wchodzi za darmo" (nie ma z czym jej porównać), dokładnie jak w reszcie silnika gry
const WEEKLY_REWARDS = [500, 250, 100]; // 1., 2., 3. miejsce w tygodniu

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Pobiera (albo, jeśli jeszcze nie istnieje dzisiaj, losuje i zapisuje)
// "Playlistę dnia" — te same 10 piosenek dla wszystkich graczy danego dnia.
export async function getOrCreateDailyPlaylist(dayKey, pool) {
  const ref = doc(db, PLAYLISTS_COLLECTION, dayKey);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data().songs;

  const picked = shuffle(pool).slice(0, SCORED_COUNT + 1);
  const songs = picked.map((s) => ({
    id: s.id || s.videoId,
    videoId: s.videoId,
    artist: s.artist,
    title: s.title,
    year: s.year,
    startSeconds: Math.floor(Math.random() * 61) + 15,
  }));

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return; // ktoś inny już ustawił playlistę dnia w międzyczasie
      tx.set(ref, { songs });
    });
  } catch (e) {
    // ciche niepowodzenie — poniżej i tak spróbujemy odczytać, co ostatecznie tam jest
  }

  const final = await getDoc(ref);
  return final.exists() ? final.data().songs : songs;
}

// Czy gracz już dziś grał w Playlistę dnia?
export async function hasPlayedPlaylistToday(uid, dayKey) {
  const ref = doc(db, SCORES_COLLECTION, `${dayKey}_${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Zapisuje wynik dnia (z czasem wykonania — decyduje przy remisach), dolicza
// go do sumy tygodnia i do sumy wszech czasów.
export async function recordDailyPlaylistScore(uid, name, dayKey, score, timeMs) {
  const scoreRef = doc(db, SCORES_COLLECTION, `${dayKey}_${uid}`);
  await setDoc(scoreRef, { uid, name, dayKey, score, timeMs });

  const weekKey = currentWeekKey();
  const weeklyRef = doc(db, WEEKLY_COLLECTION, `${weekKey}_${uid}`);
  const weeklySnap = await getDoc(weeklyRef);
  const prevWeekly = weeklySnap.exists() ? weeklySnap.data() : null;
  await setDoc(weeklyRef, {
    uid,
    name,
    weekKey,
    score: (prevWeekly?.score || 0) + score,
    gamesPlayed: (prevWeekly?.gamesPlayed || 0) + 1,
  });

  const statsRef = doc(db, "userStats", uid);
  await updateDoc(statsRef, {
    playlistTotalScore: increment(score),
    playlistGamesPlayed: increment(1),
  });
}

// Ranking dnia — kto dziś ułożył najwięcej poprawnie, a przy remisie kto był
// szybszy. Sortujemy po stronie klienta (nie orderBy w zapytaniu), żeby
// uniknąć konieczności ręcznego zakładania złożonego indeksu w Firestore.
export async function fetchDailyPlaylistLeaderboard(dayKey, count = 10) {
  const q = query(collection(db, SCORES_COLLECTION), where("dayKey", "==", dayKey));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => b.score - a.score || (a.timeMs || Infinity) - (b.timeMs || Infinity))
    .slice(0, count);
}

// Ranking tygodnia (od poniedziałku) — suma punktów z tego tygodnia.
export async function fetchWeeklyPlaylistLeaderboard(weekKey, count = 10) {
  const q = query(collection(db, WEEKLY_COLLECTION), where("weekKey", "==", weekKey));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}

// Ranking wszech czasów — suma punktów ze wszystkich dni (reużywa userStats,
// tak jak zwykły ranking gier/zgadywania — ten sam, tani wzorzec zapytania).
export async function fetchAllTimePlaylistLeaderboard(count = 10) {
  const q = query(collection(db, "userStats"), orderBy("playlistTotalScore", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

// Sprawdza, czy zeszły tydzień doczekał się już nagród za 1./2./3. miejsce —
// jeśli nie, rozdaje je (zabezpieczone transakcją ze znacznikiem tygodnia,
// więc niezależnie od tego, ile osób akurat otworzy Playlistę dnia, nagrody
// rozdadzą się dokładnie raz). Wywoływane przy każdym otwarciu huba —
// appka nie ma serwera/crona, więc to jedyny sposób na "koniec tygodnia".
export async function processWeeklyPlaylistRewardsIfNeeded() {
  const lastWeekKey = currentWeekKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const markerRef = doc(db, WEEKLY_REWARDS_PROCESSED_COLLECTION, lastWeekKey);
  let shouldProcess = false;
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(markerRef);
      if (snap.exists()) return;
      shouldProcess = true;
      tx.set(markerRef, { processedAt: Date.now() });
    });
  } catch (e) {
    return;
  }
  if (!shouldProcess) return;

  try {
    const q = query(collection(db, WEEKLY_COLLECTION), where("weekKey", "==", lastWeekKey));
    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => d.data()).sort((a, b) => b.score - a.score);
    for (let i = 0; i < Math.min(3, entries.length); i++) {
      if (!entries[i].score) continue; // nie nagradzaj kogoś z zerowym wynikiem
      await awardXp(entries[i].uid, WEEKLY_REWARDS[i]);
    }
  } catch (e) {
    // ciche niepowodzenie — znacznik już ustawiony, nie spróbujemy ponownie w tym tygodniu, ale i tak nie ma dużej straty
  }
}
