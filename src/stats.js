import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, collection, query, orderBy, limit, getDocs, runTransaction, where } from "firebase/firestore";
import { db } from "./firebase-config.js";

export function decadeLabel(year) {
  const start = Math.floor(year / 10) * 10;
  return `${start}s`; // e.g. "1980s", "2020s"
}

// Grupuje rok utworu w jedną z 7 "kubełków" do osiągnięć za dekady —
// lata do 1969 połączone w jedną grupę (mniej utworów, mniej znane).
export function decadeGroupKey(year) {
  if (year < 1970) return "60s_earlier";
  if (year < 1980) return "70s";
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  if (year < 2010) return "00s";
  if (year < 2020) return "10s";
  return "20s";
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
      guessesByDecadeGroup: {},
      hitcoin: 0,
      cardCollection: {},
      cardsByRarity: {},
      duplicatesSold: 0,
      lastDailyHitcoinDate: "",
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

export async function setAvatarUrl(uid, url) {
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, { avatarUrl: url });
}

// Zeruje flagę "Podwójne XP" ustawioną przez ruletkę nagrody dnia - wołane RAZ,
// zaraz po tym jak jej efekt (podwojenie XP z zakończonej gry) już się zastosował.
export async function consumeDoubleXpFlag(uid) {
  const ref = doc(db, "userStats", uid);
  await updateDoc(ref, { doubleXpNextGame: false });
}

// Called whenever a player's artist+title guess gets approved (bezpośrednio
// lub przez głosowanie) — licznik + zbiór unikalnych trafionych utworów.
export async function recordSuccessfulGuess(uid, videoId, year) {
  const ref = doc(db, "userStats", uid);
  const update = { guessesCorrect: increment(1) };
  if (videoId) update.guessedSongs = arrayUnion(videoId);
  if (year) update[`guessesByDecadeGroup.${decadeGroupKey(year)}`] = increment(1);
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

// Rzeczywista pozycja gracza w rankingu. Liczymy ilu graczy ma wynik
// większy od bieżącego użytkownika, więc remis daje tę samą pozycję.
export async function getLeaderboardPosition(uid, sortBy = "gamesWon") {
  if (!uid) return null;
  const ownSnap = await getDoc(doc(db, "userStats", uid));
  if (!ownSnap.exists()) return null;
  const ownValue = Number(ownSnap.data()?.[sortBy] || 0);
  const q = query(collection(db, "userStats"), where(sortBy, ">", ownValue));
  const higher = await getDocs(q);
  return higher.size + 1;
}

// ============================================================
// WYZWANIA TYGODNIOWE — pula ~12 kandydatów, co tydzień losowanych
// dokładnie 5 (TAKICH SAMYCH dla wszystkich graczy — deterministycznie,
// z klucza tygodnia, jak Piosenka dnia). "mode" mówi jak liczyć postęp:
// "add" (kumulacyjnie w tygodniu), "max" (najwyższa wartość w tygodniu),
// "flag" (raz zdarzyło się - gotowe).
// ============================================================
export const WEEKLY_CHALLENGE_POOL = [
  { id: "games_3", desc: "Zagraj 3 gry", type: "gamesPlayed", target: 3, mode: "add", xp: 50, hitcoin: 0 },
  { id: "games_7", desc: "Zagraj 7 gier", type: "gamesPlayed", target: 7, mode: "add", xp: 90, hitcoin: 0 },
  { id: "wins_3", desc: "Wygraj 3 gry", type: "gamesWon", target: 3, mode: "add", xp: 80, hitcoin: 25 },
  { id: "guesses_10", desc: "Zgadnij poprawnie 10 wykonawców/tytułów", type: "guessesCorrect", target: 10, mode: "add", xp: 70, hitcoin: 0 },
  { id: "hitrush_combo10", desc: "Osiągnij combo 10 w Hit Rush", type: "hitRushCombo", target: 10, mode: "max", xp: 90, hitcoin: 25 },
  { id: "hitrush_gold", desc: "Zdobądź rangę Złoto lub lepszą w Hit Rush", type: "hitRushGoldPlus", target: 1, mode: "flag", xp: 110, hitcoin: 30 },
  { id: "dailysong_5x", desc: "Zagraj Piosenkę dnia 5 razy w tym tygodniu", type: "dailySongPlays", target: 5, mode: "add", xp: 120, hitcoin: 40 },
  { id: "duel_win", desc: "Wygraj pojedynek 1v1", type: "duelWins", target: 1, mode: "add", xp: 60, hitcoin: 0 },
  { id: "card_gold_plus", desc: "Zdobądź kartę Złota lub lepszą", type: "cardGoldPlus", target: 1, mode: "flag", xp: 100, hitcoin: 30 },
  { id: "streak_5", desc: "Osiągnij serię 5 trafień z rzędu", type: "bestStreak", target: 5, mode: "max", xp: 80, hitcoin: 0 },
  { id: "hitcoin_300", desc: "Zdobądź 300 HITCOIN w tym tygodniu", type: "hitcoinEarned", target: 300, mode: "add", xp: 150, hitcoin: 50 },
  { id: "wheel_5x", desc: "Zakręć kołem nagrody dnia 5 razy w tym tygodniu", type: "wheelSpins", target: 5, mode: "add", xp: 130, hitcoin: 40 },
];

// Deterministyczny generator — wszyscy gracze dostają ten sam zestaw.
// Od 2026-W36 obowiązuje V2: pięć wyzwań z nowego tygodnia nie może
// powtórzyć żadnego z pięciu wyzwań poprzedniego tygodnia. Przy puli 12
// zawsze zostaje 7 kandydatów, więc nadal losujemy pełne 5.
const WEEKLY_CHALLENGE_V2_START = "2026-W36";
const weeklyChallengeCache = new Map();

function seededWeeklyPick(weekKey, sourcePool = WEEKLY_CHALLENGE_POOL) {
  let seed = 0;
  for (let i = 0; i < weekKey.length; i++) seed = (seed * 31 + weekKey.charCodeAt(i)) >>> 0;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
  };
  const pool = [...sourcePool];
  const picked = [];
  for (let i = 0; i < 5 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

function weekKeyOrdinal(weekKey) {
  const match = String(weekKey || '').match(/^(\d{4})-W(\d{1,2})$/);
  return match ? Number(match[1]) * 54 + Number(match[2]) : 0;
}

function previousWeekKey(weekKey) {
  const match = String(weekKey || '').match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return weekKey;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week > 1) return `${year}-W${week - 1}`;
  return currentWeekKey(new Date(Date.UTC(year - 1, 11, 28)));
}

function pickWeeklyChallenges(weekKey) {
  if (weeklyChallengeCache.has(weekKey)) return weeklyChallengeCache.get(weekKey);
  if (weekKeyOrdinal(weekKey) < weekKeyOrdinal(WEEKLY_CHALLENGE_V2_START)) {
    const legacy = seededWeeklyPick(weekKey);
    weeklyChallengeCache.set(weekKey, legacy);
    return legacy;
  }

  const previous = pickWeeklyChallenges(previousWeekKey(weekKey));
  const blocked = new Set(previous.map((challenge) => challenge.id));
  const candidates = WEEKLY_CHALLENGE_POOL.filter((challenge) => !blocked.has(challenge.id));
  const picked = seededWeeklyPick(weekKey, candidates);
  weeklyChallengeCache.set(weekKey, picked);
  return picked;
}

// Zwraca 5 wyzwań na TEN tydzień + aktualny postęp gracza w każdym z nich,
// gotowe do wyrenderowania (bez dalszych obliczeń po stronie UI).
export function getWeeklyChallenges(stats) {
  const wk = currentWeekKey();
  const challenges = pickWeeklyChallenges(wk);
  const wp = stats?.weeklyProgress && stats.weeklyProgress.weekKey === wk ? stats.weeklyProgress : { counters: {}, claimed: {} };
  return challenges.map((c) => {
    const raw = wp.counters[c.type];
    const progress = c.mode === "flag" ? (raw ? 1 : 0) : raw || 0;
    return { ...c, progress, done: c.mode === "flag" ? !!raw : progress >= c.target, claimed: !!wp.claimed[c.id] };
  });
}

// Wywoływane z różnych miejsc appki w momencie zdarzenia (koniec gry, wygrana
// pojedynku, zdobycie karty, zakręcenie kołem itd.) - aktualizuje licznik
// TYLKO jeśli dany typ jest akurat jednym z 5 wyzwań tego tygodnia (inaczej
// nie ma sensu nic zapisywać). Bezpieczne wołać "na wszelki wypadek" nawet
// gdy dane wyzwanie akurat nie wypadło w danym tygodniu.
export async function bumpWeeklyChallengeProgress(uid, type, amount = 1) {
  const wk = currentWeekKey();
  const active = pickWeeklyChallenges(wk).find((c) => c.type === type);
  if (!active) return;
  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  const prev = data.weeklyProgress && data.weeklyProgress.weekKey === wk ? data.weeklyProgress : { weekKey: wk, counters: {}, claimed: {} };
  const counters = { ...prev.counters };
  if (active.mode === "max") counters[type] = Math.max(counters[type] || 0, amount);
  else if (active.mode === "flag") counters[type] = true;
  else counters[type] = (counters[type] || 0) + amount;
  await updateDoc(ref, { weeklyProgress: { weekKey: wk, counters, claimed: prev.claimed } });
}

// Odbiór nagrody za pojedyncze ukończone wyzwanie - transakcja jak przy
// reszcie nagród w appce, więc nie da się kliknąć "odbierz" dwa razy.
export async function claimWeeklyChallenge(uid, challengeId) {
  const def = WEEKLY_CHALLENGE_POOL.find((c) => c.id === challengeId);
  if (!def) return { ok: false };
  const ref = doc(db, "userStats", uid);
  let ok = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const wk = currentWeekKey();
    const prev = data.weeklyProgress && data.weeklyProgress.weekKey === wk ? data.weeklyProgress : { weekKey: wk, counters: {}, claimed: {} };
    if (prev.claimed[challengeId]) return;
    const raw = prev.counters[def.type];
    const done = def.mode === "flag" ? !!raw : (raw || 0) >= def.target;
    if (!done) return;
    ok = true;
    const claimed = { ...prev.claimed, [challengeId]: true };
    tx.update(ref, { weeklyProgress: { weekKey: wk, counters: prev.counters, claimed }, xp: increment(def.xp), hitcoin: increment(def.hitcoin) });
  });
  return { ok, xp: def.xp, hitcoin: def.hitcoin };
}
