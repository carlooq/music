import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";

export function decadeLabel(year) {
  const start = Math.floor(year / 10) * 10;
  return `${start}s`; // e.g. "1980s", "2020s"
}

// Zwraca klucz tygodnia w formacie "2026-W34" (ISO-ish, wystarczająco dobry
// do naszych celów — nie musi być idealnie zgodny z prawdziwym ISO 8601).
export function currentWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

// Zwraca klucz dnia w formacie "2026-08-21" (lokalny czas gracza).
export function currentDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Firestore treats "." as a nested-path separator, so artist names that
// contain one (e.g. "N.E.R.D") need a safe field-key form.
function artistKey(artist) {
  return (artist || "").toLowerCase().replace(/[.$/[\]#]/g, "_");
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
      guessesCorrect: 0,
      heardSongs: [],
      guessedSongs: [],
      songsAdded: 0,
      decades: {},
      artists: {},
      currentStreak: 0,
      longestStreak: 0,
      xp: 0,
      weeklyChallenge: { weekKey: "", gamesThisWeek: 0, claimed: false },
      dailyStreak: 0,
      dailyLastPlayedDate: "",
      claimedAchievements: [],
      perfectGames: 0,
      longestGuessStreak: 0,
      uniqueOpponents: [],
      maxPlayersInGame: 0,
      cardsBought: 0,
      currentLossStreak: 0,
      maxLossStreak: 0,
      hadPerfectDaily: false,
      hadNightGame: false,
      hadFrugalFinish: false,
      hadQuickReturn: false,
      lastGameEndedAt: 0,
      playlistTotalScore: 0,
      playlistGamesPlayed: 0,
    });
  } else if (username && snap.data().username !== username) {
    // odświeżamy nazwę przy każdym logowaniu — naprawia stare konta, którym
    // nazwa nie zapisała się poprawnie przy pierwszej rejestracji
    await updateDoc(ref, { username });
  }
}

export async function getStats(uid) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Called once per card placement (w tym przy przekroczeniu czasu — to
// wcześniej się nie liczyło i zaniżało statystyki dekad/kart).
export async function recordCardGuess(uid, year, correct, artist, videoId) {
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
    ...(videoId ? { heardSongs: arrayUnion(videoId) } : {}),
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

// Called gdy admin zaakceptuje propozycję utworu od gracza — motywuje do
// rozbudowywania bazy.
export async function recordSongAdded(uid) {
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, { songsAdded: increment(1) });
}

// Called whenever a player's artist+title guess gets approved (bezpośrednio
// lub przez głosowanie) — licznik + zbiór unikalnych trafionych utworów.
export async function recordSuccessfulGuess(uid, videoId) {
  const ref = doc(db, "userStats", uid);
  const update = { guessesCorrect: increment(1) };
  if (videoId) update.guessedSongs = arrayUnion(videoId);
  await updateDoc(ref, update);
}

// Best/worst artists for a player, requiring a minimum number of
// attempts so a single lucky guess doesn't show up as "100%".
export function topArtists(stats, count = 5, minAttempts = 2) {
  if (!stats?.artists) return { best: [], worst: [] };
  const entries = Object.values(stats.artists)
    .filter((a) => a.total >= minAttempts)
    .map((a) => ({ ...a, pct: a.correct / a.total }));
  const best = [...entries].sort((a, b) => b.pct - a.pct || b.total - a.total).slice(0, count);
  const bestNames = new Set(best.map((a) => a.name));
  const worst = [...entries]
    .filter((a) => !bestNames.has(a.name)) // przy mało zróżnicowanych danych nie duplikujemy tych samych pozycji w obu listach
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, count);
  return { best, worst };
}

// --- system poziomów (XP) ---

// XP potrzebne, żeby przejść z poziomu (level-1) na level. Rośnie liniowo —
// wczesne poziomy przychodzą szybko (satysfakcja na start), później dłużej.
export function xpForLevel(level) {
  return 100 + (level - 2) * 50; // poziom 2: 100 XP, poziom 3: 150 XP, poziom 4: 200 XP...
}

// Zamienia sumę XP na { level, currentLevelXp, xpForNextLevel } do wyświetlenia paska postępu.
export function levelFromXp(totalXp) {
  const xp = Math.max(0, totalXp || 0);
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level + 1)) {
    remaining -= xpForLevel(level + 1);
    level++;
  }
  return { level, currentLevelXp: remaining, xpForNextLevel: xpForLevel(level + 1) };
}

// amount może być ujemny (np. kara za niewykorzystane tokeny).
export async function awardXp(uid, amount) {
  if (!amount) return;
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, { xp: increment(amount) });
}

// Wywoływane raz na koniec każdej (nie-treningowej) gry — odlicza postęp
// wyzwania tygodniowego "zagraj 3 gry" i zwraca, czy właśnie zostało ukończone.
export async function progressWeeklyChallenge(uid) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const wk = currentWeekKey();
  const prev = data.weeklyChallenge || { weekKey: "", gamesThisWeek: 0, claimed: false };
  const sameWeek = prev.weekKey === wk;
  const gamesThisWeek = (sameWeek ? prev.gamesThisWeek : 0) + 1;
  const alreadyClaimed = sameWeek && prev.claimed;
  const justCompleted = gamesThisWeek >= 3 && !alreadyClaimed;
  await updateDoc(ref, {
    weeklyChallenge: { weekKey: wk, gamesThisWeek, claimed: alreadyClaimed || justCompleted },
  });
  return { gamesThisWeek, justCompleted };
}

// Zapisuje wynik "Piosenki dnia" i aktualizuje serię dni z rzędu.
export async function recordDailyResult(uid, dayKey, result) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const yesterday = new Date(Date.now() - 86400000);
  const yesterdayKey = currentDayKey(yesterday);
  const prevStreak = data.dailyStreak || 0;
  const newStreak = data.dailyLastPlayedDate === yesterdayKey ? prevStreak + 1 : 1;
  await updateDoc(ref, {
    dailyStreak: newStreak,
    dailyLastPlayedDate: dayKey,
    dailyLastResult: { dayKey, ...result },
  });
  return newStreak;
}

// Ręczne odebranie XP za odblokowane osiągnięcie — gracz klika sam, XP nie
// dolicza się automatycznie.
export async function claimAchievementXp(uid, achievementId, xpAmount) {
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, {
    claimedAchievements: arrayUnion(achievementId),
    xp: increment(xpAmount),
  });
}

// Oznacza "Perfekcyjny dzień" (3/3 w Piosence dnia) — wywoływane od razu przy
// zapisie wyniku, nie wymaga osobnego przebiegu.
export async function markPerfectDailyIfNeeded(uid, score) {
  if (score !== 3) return;
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, { hadPerfectDaily: true });
}

// Aktualizuje liczniki potrzebne do osiągnięć, które nie mają już własnego
// miejsca w kodzie gry — wywoływane raz na koniec każdej nie-treningowej gry.
export async function updateAchievementCounters(uid, { won, perfectGame, opponents, playerCount, nightGame, frugalFinish }) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const newLossStreak = won ? 0 : (data.currentLossStreak || 0) + 1;
  const updates = {
    currentLossStreak: newLossStreak,
    maxLossStreak: Math.max(data.maxLossStreak || 0, newLossStreak),
    maxPlayersInGame: Math.max(data.maxPlayersInGame || 0, playerCount || 0),
    lastGameEndedAt: Date.now(),
  };
  if (perfectGame) updates.perfectGames = increment(1);
  if (nightGame) updates.hadNightGame = true;
  if (frugalFinish) updates.hadFrugalFinish = true;
  if (opponents && opponents.length) {
    const existing = new Set(data.uniqueOpponents || []);
    opponents.forEach((id) => existing.add(id));
    updates.uniqueOpponents = Array.from(existing);
  }
  await updateDoc(ref, updates);
}

// Sprawdza i ewentualnie ustawia flagę "Powrót" — wywoływane przy tworzeniu
// lub dołączaniu do nowej gry (nie w trakcie samej rozgrywki).
export async function checkQuickReturn(uid) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (data.lastGameEndedAt && Date.now() - data.lastGameEndedAt < 10 * 60 * 1000) {
    await updateDoc(ref, { hadQuickReturn: true });
  }
}

// Aktualizuje rekordową serię trafionych zgadnięć (jeśli nowa jest dłuższa).
export async function updateLongestGuessStreak(uid, streakValue) {
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  if (streakValue > (data.longestGuessStreak || 0)) {
    await updateDoc(ref, { longestGuessStreak: streakValue });
  }
}

// Top players globally. sortBy: "gamesWon" (domyślnie) albo "guessesCorrect".
export async function getLeaderboard(count = 10, sortBy = "gamesWon") {
  const q = query(collection(db, "userStats"), orderBy(sortBy, "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
