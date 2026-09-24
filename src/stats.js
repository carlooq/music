import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion, collection, query, orderBy, limit, getDocs, runTransaction, where, getCountFromServer } from "firebase/firestore";
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

// Wspólna ekonomia nagród dla rankingów tygodniowych: Hit Rush,
// Zgadnij Rok i Playlista dnia. Jedno źródło prawdy dla backendu i UI.
export const WEEKLY_RANKING_REWARDS = [
  { place: 1, xp: 500, hitcoin: 150 },
  { place: 2, xp: 300, hitcoin: 100 },
  { place: 3, xp: 200, hitcoin: 75 },
];

export function weeklyRankingRewardForPlace(place) {
  return WEEKLY_RANKING_REWARDS.find((reward) => reward.place === Number(place)) || null;
}

function lastWeekKeyFromNow() {
  return currentWeekKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
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
      tournamentsWon: 0,
      tournamentRewardClaims: {},
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


// Liga korzysta z solowego silnika meczu, ale jej mecze mają liczyć się do
// zwykłych statystyk i rankingu sezonowego. Markery per liga/mecz chronią
// przed podwójnym naliczeniem przy ponownym wejściu lub dwóch klientach.
export async function recordLeagueMatchParticipation(uid, matchKey, guessesCorrect = 0) {
  if (!uid || !matchKey) return;
  const ref = doc(db, "userStats", uid);
  const sk = currentSeasonKey();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const claims = { ...(data.leagueMatchStatClaims || {}) };
    const claim = { ...(claims[matchKey] || {}) };
    if (claim.participation) return;

    const prev = data.seasonProgress;
    let history = data.seasonHistory || {};
    let counters;
    if (prev && prev.seasonKey === sk) counters = { ...prev };
    else {
      if (prev?.seasonKey) history = { ...history, [prev.seasonKey]: { gamesPlayed: prev.gamesPlayed || 0, gamesWon: prev.gamesWon || 0, guessesCorrect: prev.guessesCorrect || 0 } };
      counters = { seasonKey: sk, gamesPlayed: 0, gamesWon: 0, guessesCorrect: 0 };
    }
    counters.gamesPlayed = Number(counters.gamesPlayed || 0) + 1;
    counters.guessesCorrect = Number(counters.guessesCorrect || 0) + Number(guessesCorrect || 0);
    claims[matchKey] = { ...claim, participation: Date.now() };
    tx.set(ref, {
      gamesPlayed: increment(1),
      leagueMatchStatClaims: claims,
      seasonProgress: counters,
      seasonHistory: history,
    }, { merge: true });
  });
}

export async function recordLeagueMatchWin(uid, matchKey) {
  if (!uid || !matchKey) return;
  const ref = doc(db, "userStats", uid);
  const sk = currentSeasonKey();
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const claims = { ...(data.leagueMatchStatClaims || {}) };
    const claim = { ...(claims[matchKey] || {}) };
    if (claim.win) return;

    const prev = data.seasonProgress;
    let history = data.seasonHistory || {};
    let counters;
    if (prev && prev.seasonKey === sk) counters = { ...prev };
    else {
      if (prev?.seasonKey) history = { ...history, [prev.seasonKey]: { gamesPlayed: prev.gamesPlayed || 0, gamesWon: prev.gamesWon || 0, guessesCorrect: prev.guessesCorrect || 0 } };
      counters = { seasonKey: sk, gamesPlayed: 0, gamesWon: 0, guessesCorrect: 0 };
    }
    counters.gamesWon = Number(counters.gamesWon || 0) + 1;
    claims[matchKey] = { ...claim, win: Date.now() };
    tx.set(ref, {
      gamesWon: increment(1),
      leagueMatchStatClaims: claims,
      seasonProgress: counters,
      seasonHistory: history,
    }, { merge: true });
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
// ZGADNIJ ROK — osobny ranking trybu, niezależny od głównego
// rankingu/sezonów Hitsteriady. Ranking tygodniowy bierze sumę
// 5 najlepszych wyników w bieżącym tygodniu, a ogólny sumę
// wszystkich punktów zdobytych od wdrożenia tego systemu.
// ============================================================
function yearGuessWeekOrdinal(weekKey) {
  const match = String(weekKey || "").match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number(match[2]);
}

function yearGuessWeeklySortValue(weekKey, top5Points) {
  // Tydzień ma dużo większą wagę niż wynik (max 375 pkt przy 15 rundach),
  // dzięki czemu stare tygodnie nigdy nie wchodzą przed bieżący bez potrzeby
  // złożonego indeksu Firestore.
  return yearGuessWeekOrdinal(weekKey) * 1_000_000 + Math.max(0, Number(top5Points || 0));
}

function yearGuessStatsFromWeek(week) {
  return {
    points: Number(week?.top5Points || 0),
    gamesPlayed: Number(week?.gamesPlayed || 0),
    gamesWon: Number(week?.gamesWon || 0),
    exactYears: Number(week?.exactYears || 0),
    rankingExactYears: Number(week?.top5ExactYears ?? week?.exactYears ?? 0),
    rankingWins: Number(week?.top5Wins ?? week?.gamesWon ?? 0),
    bestScore: Number(week?.bestScore || 0),
    bestScores: Array.isArray(week?.bestScores) ? week.bestScores : [],
  };
}

function getYearGuessStatsForWeek(statsData, weekKey) {
  const ranking = statsData?.yearGuessRanking || {};
  const week = ranking.week?.weekKey === weekKey
    ? ranking.week
    : ranking.weekHistory?.[weekKey] || null;
  return yearGuessStatsFromWeek(week);
}

export function getYearGuessRankingStats(statsData, period = "weekly") {
  const ranking = statsData?.yearGuessRanking || {};
  if (period === "all") {
    return {
      points: Number(ranking.totalPoints || 0),
      gamesPlayed: Number(ranking.gamesPlayed || 0),
      gamesWon: Number(ranking.gamesWon || 0),
      exactYears: Number(ranking.exactYears || 0),
      rankingExactYears: Number(ranking.exactYears || 0),
      rankingWins: Number(ranking.gamesWon || 0),
      bestScore: Number(ranking.bestScore || 0),
      bestScores: [],
    };
  }
  return getYearGuessStatsForWeek(statsData, currentWeekKey());
}

function compareYearGuessEntries(a = {}, b = {}, period = "weekly") {
  const aStats = a.selectedYearGuessStats || {};
  const bStats = b.selectedYearGuessStats || {};
  const aPoints = Number(aStats.points || 0);
  const bPoints = Number(bStats.points || 0);
  if (bPoints !== aPoints) return bPoints - aPoints;
  const aExact = Number(aStats.rankingExactYears ?? aStats.exactYears ?? 0);
  const bExact = Number(bStats.rankingExactYears ?? bStats.exactYears ?? 0);
  if (bExact !== aExact) return bExact - aExact;
  const aWins = Number(aStats.rankingWins ?? aStats.gamesWon ?? 0);
  const bWins = Number(bStats.rankingWins ?? bStats.gamesWon ?? 0);
  if (bWins !== aWins) return bWins - aWins;
  const aPlayed = Number(aStats.gamesPlayed || 0);
  const bPlayed = Number(bStats.gamesPlayed || 0);
  if (aPlayed !== bPlayed) return aPlayed - bPlayed;
  return String(a.uid || "").localeCompare(String(b.uid || ""));
}

// Idempotentny zapis wyniku jednego meczu Zgadnij Rok. Korzysta z tego
// samego dokumentu markera co nagrody końca gry, ale z osobną flagą, więc
// nawet przerwane naliczanie może zostać bezpiecznie dokończone po reloadzie.
export async function recordYearGuessRankingResult(uid, rewardMarkerId, { score = 0, won = false, exactYears = 0 } = {}) {
  if (!uid || !rewardMarkerId) return false;
  const statsRef = doc(db, "userStats", uid);
  const markerRef = doc(db, "gameRewardsProcessed", rewardMarkerId);
  const wk = currentWeekKey();
  let updated = false;

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    const markerSnap = await tx.get(markerRef);
    if (markerSnap.exists() && markerSnap.data()?.yearGuessRankingProcessedAt) return;

    const data = statsSnap.exists() ? statsSnap.data() : {};
    const previous = data.yearGuessRanking || {};
    const points = Math.max(0, Number(score || 0));
    const exact = Math.max(0, Number(exactYears || 0));
    const weekHistory = { ...(previous.weekHistory || {}) };
    if (previous.week?.weekKey && previous.week.weekKey !== wk && Number(previous.week.gamesPlayed || 0) > 0) {
      // Do historii odkładamy tylko dane potrzebne do późniejszego rozliczenia
      // i tie-breaków — bez listy pojedynczych runów, żeby userStats nie puchł.
      weekHistory[previous.week.weekKey] = {
        weekKey: previous.week.weekKey,
        gamesPlayed: Number(previous.week.gamesPlayed || 0),
        gamesWon: Number(previous.week.gamesWon || 0),
        exactYears: Number(previous.week.exactYears || 0),
        bestScore: Number(previous.week.bestScore || 0),
        top5Points: Number(previous.week.top5Points || 0),
        top5ExactYears: Number(previous.week.top5ExactYears ?? previous.week.exactYears ?? 0),
        top5Wins: Number(previous.week.top5Wins ?? previous.week.gamesWon ?? 0),
      };
    }
    const previousWeek = previous.week?.weekKey === wk ? previous.week : {
      weekKey: wk,
      gamesPlayed: 0,
      gamesWon: 0,
      exactYears: 0,
      bestScore: 0,
      bestScores: [],
      bestRuns: [],
      top5Points: 0,
      top5ExactYears: 0,
      top5Wins: 0,
      sortValue: yearGuessWeeklySortValue(wk, 0),
    };
    const legacyRuns = Array.isArray(previousWeek.bestRuns) && previousWeek.bestRuns.length
      ? previousWeek.bestRuns
      : (Array.isArray(previousWeek.bestScores) ? previousWeek.bestScores.map((value) => ({ score: Number(value || 0), exactYears: 0, won: false })) : []);
    const bestRuns = [...legacyRuns, { score: points, exactYears: exact, won: !!won }]
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.exactYears || 0) - Number(a.exactYears || 0) || Number(!!b.won) - Number(!!a.won))
      .slice(0, 5);
    const bestScores = bestRuns.map((run) => Number(run.score || 0));
    const top5Points = bestScores.reduce((sum, value) => sum + value, 0);
    const top5ExactYears = bestRuns.reduce((sum, run) => sum + Number(run.exactYears || 0), 0);
    const top5Wins = bestRuns.reduce((sum, run) => sum + (run.won ? 1 : 0), 0);

    const next = {
      totalPoints: Number(previous.totalPoints || 0) + points,
      gamesPlayed: Number(previous.gamesPlayed || 0) + 1,
      gamesWon: Number(previous.gamesWon || 0) + (won ? 1 : 0),
      exactYears: Number(previous.exactYears || 0) + exact,
      bestScore: Math.max(Number(previous.bestScore || 0), points),
      weekHistory,
      week: {
        weekKey: wk,
        gamesPlayed: Number(previousWeek.gamesPlayed || 0) + 1,
        gamesWon: Number(previousWeek.gamesWon || 0) + (won ? 1 : 0),
        exactYears: Number(previousWeek.exactYears || 0) + exact,
        bestScore: Math.max(Number(previousWeek.bestScore || 0), points),
        bestScores,
        bestRuns,
        top5Points,
        top5ExactYears,
        top5Wins,
        sortValue: yearGuessWeeklySortValue(wk, top5Points),
      },
    };

    tx.set(statsRef, { yearGuessRanking: next }, { merge: true });
    tx.set(markerRef, { yearGuessRankingProcessedAt: Date.now() }, { merge: true });
    updated = true;
  });

  return updated;
}

export async function getYearGuessLeaderboard(count = 10, period = "weekly") {
  const safeCount = Math.max(1, Math.min(50, Number(count || 10)));
  const field = period === "all" ? "yearGuessRanking.totalPoints" : "yearGuessRanking.week.sortValue";
  // Pobieramy mały zapas, żeby poprawnie rozstrzygnąć remisy na granicy TOP10
  // dokładnymi trafieniami / wygranymi / liczbą gier.
  const q = query(collection(db, "userStats"), orderBy(field, "desc"), limit(Math.max(30, safeCount * 3)));
  const snap = await getDocs(q);
  const players = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const mapped = players.map((player) => ({
    ...player,
    selectedYearGuessStats: getYearGuessRankingStats(player, period),
  })).filter((player) => player.selectedYearGuessStats.gamesPlayed > 0);
  return mapped.sort((a, b) => compareYearGuessEntries(a, b, period)).slice(0, safeCount);
}

export async function getYearGuessLeaderboardPosition(uid, period = "weekly") {
  if (!uid) return null;
  const ownSnap = await getDoc(doc(db, "userStats", uid));
  if (!ownSnap.exists()) return null;
  const ownData = ownSnap.data();
  const ownStats = getYearGuessRankingStats(ownData, period);
  if (ownStats.gamesPlayed <= 0) return null;

  const collectionRef = collection(db, "userStats");
  if (period === "all") {
    const ownPrimary = Number(ownStats.points || 0);
    const higherQ = query(collectionRef, where("yearGuessRanking.totalPoints", ">", ownPrimary));
    const tiedQ = query(collectionRef, where("yearGuessRanking.totalPoints", "==", ownPrimary));
    const [higherCountSnap, tiedSnap] = await Promise.all([getCountFromServer(higherQ), getDocs(tiedQ)]);
    const ownEntry = { uid, ...ownData, selectedYearGuessStats: ownStats };
    const tiedAhead = tiedSnap.docs
      .filter((d) => d.id !== uid)
      .map((d) => ({ uid: d.id, ...d.data(), selectedYearGuessStats: getYearGuessRankingStats(d.data(), "all") }))
      .filter((entry) => compareYearGuessEntries(entry, ownEntry, "all") < 0).length;
    return Number(higherCountSnap.data().count || 0) + tiedAhead + 1;
  }

  const week = ownData.yearGuessRanking?.week;
  if (!week || week.weekKey !== currentWeekKey()) return null;
  const ownSort = Number(week.sortValue || yearGuessWeeklySortValue(week.weekKey, week.top5Points));
  const higherQ = query(collectionRef, where("yearGuessRanking.week.sortValue", ">", ownSort));
  const tiedQ = query(collectionRef, where("yearGuessRanking.week.sortValue", "==", ownSort));
  const [higherCountSnap, tiedSnap] = await Promise.all([getCountFromServer(higherQ), getDocs(tiedQ)]);
  const ownEntry = { uid, ...ownData, selectedYearGuessStats: ownStats };
  const tiedAhead = tiedSnap.docs
    .filter((d) => d.id !== uid)
    .map((d) => ({ uid: d.id, ...d.data(), selectedYearGuessStats: getYearGuessRankingStats(d.data(), "weekly") }))
    .filter((entry) => compareYearGuessEntries(entry, ownEntry, "weekly") < 0).length;
  return Number(higherCountSnap.data().count || 0) + tiedAhead + 1;
}

// Nagrody rankingu Zgadnij Rok zaczynają się od tygodnia wdrożenia nowego
// systemu. Starsze tygodnie nie miały jeszcze archiwum tygodniowego, więc ich
// retroaktywne rozliczenie mogłoby pominąć graczy, którzy zdążyli już zagrać
// w kolejnym tygodniu.
const YEAR_GUESS_WEEKLY_REWARDS_START_WEEK = "2026-W38";
const YEAR_GUESS_WEEKLY_REWARDS_PROCESSED_COLLECTION = "weeklyPlaylistRewardsProcessed";

export async function processYearGuessWeeklyRewardsIfNeeded() {
  const prevWeekKey = lastWeekKeyFromNow();
  if (yearGuessWeekOrdinal(prevWeekKey) < yearGuessWeekOrdinal(YEAR_GUESS_WEEKLY_REWARDS_START_WEEK)) {
    return { skipped: true, weekKey: prevWeekKey };
  }

  const markerRef = doc(db, YEAR_GUESS_WEEKLY_REWARDS_PROCESSED_COLLECTION, `yearguess_${prevWeekKey}`);
  const markerSnap = await getDoc(markerRef);
  if (markerSnap.exists()) return { alreadyProcessed: true, weekKey: prevWeekKey };

  // Raz w tygodniu czytamy profile graczy i korzystamy z zachowanego snapshotu
  // poprzedniego tygodnia. Dzięki temu tie-break jest identyczny jak w samym
  // rankingu: punkty → idealne lata → wygrane → mniej gier.
  const snap = await getDocs(collection(db, "userStats"));
  const entries = snap.docs
    .map((d) => {
      const data = d.data();
      return { uid: d.id, ...data, selectedYearGuessStats: getYearGuessStatsForWeek(data, prevWeekKey) };
    })
    .filter((entry) => Number(entry.selectedYearGuessStats?.gamesPlayed || 0) > 0 && Number(entry.selectedYearGuessStats?.points || 0) > 0)
    .sort((a, b) => compareYearGuessEntries(a, b, "weekly"));

  const top3 = entries.slice(0, 3);
  for (let i = 0; i < top3.length; i += 1) {
    await queueWeeklyRankingReward(top3[i].uid, {
      source: "yearguess",
      weekKey: prevWeekKey,
      place: i + 1,
      label: "Zgadnij Rok (ranking tygodnia)",
    });
  }

  await setDoc(markerRef, {
    processedAt: Date.now(),
    weekKey: prevWeekKey,
    winners: top3.map((entry, index) => ({ uid: entry.uid, place: index + 1, points: entry.selectedYearGuessStats?.points || 0 })),
  });
  return { processed: true, weekKey: prevWeekKey, winners: top3.length };
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
  // Transakcja (nie zwykłe getDoc+updateDoc) — przy końcu gry appka woła tę
  // funkcję kilka razy pod rząd dla różnych typów (gamesPlayed, gamesWon,
  // bestStreak...) bez czekania na siebie nawzajem. Bez transakcji każde z
  // tych wywołań czytałoby ten sam "stary" stan i ostatni zapis kasowałby
  // zmiany poprzednich (stąd liczniki czasem w ogóle nie rosły).
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const prev = data.weeklyProgress && data.weeklyProgress.weekKey === wk ? data.weeklyProgress : { weekKey: wk, counters: {}, claimed: {} };
    const counters = { ...prev.counters };
    if (active.mode === "max") counters[type] = Math.max(counters[type] || 0, amount);
    else if (active.mode === "flag") counters[type] = true;
    else counters[type] = (counters[type] || 0) + amount;
    tx.set(ref, { weeklyProgress: { weekKey: wk, counters, claimed: prev.claimed } }, { merge: true });
  });
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

// ============================================================
// RANKING SEZONOWY (miesięczny) — Brąz/Srebro/Złoto/Platyna/Diament
// ============================================================
// Sezon = pełny miesiąc kalendarzowy (prościej i bezpieczniej niż ręcznie
// pilnowana data startu — nic nie trzeba pamiętać co miesiąc). Numer sezonu
// liczony jest od SEASON_START, czysto do wyświetlania ("Sezon 3" zamiast
// surowego klucza "2026-11").
const SEASON_START = "2026-09"; // pierwszy miesiąc liczony jako "Sezon 1"

export function currentSeasonKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function seasonNumber(seasonKey) {
  const [sy, sm] = SEASON_START.split("-").map(Number);
  const [y, m] = String(seasonKey || "").split("-").map(Number);
  if (!y || !m) return 1;
  return (y - sy) * 12 + (m - sm) + 1;
}

export function seasonKeyForNumber(number) {
  const [sy, sm] = SEASON_START.split("-").map(Number);
  const offset = Number(number || 0) - 1;
  const d = new Date(Date.UTC(sy, sm - 1 + offset, 1));
  return currentSeasonKey(d);
}

export function seasonZeroKey() {
  return seasonKeyForNumber(0);
}

export function availableSeasonKeys(date = new Date()) {
  const currentNumber = Math.max(0, seasonNumber(currentSeasonKey(date)));
  return Array.from({ length: currentNumber + 1 }, (_, index) => seasonKeyForNumber(currentNumber - index));
}

export function seasonMonthLabel(seasonKey) {
  const [y, m] = String(seasonKey || "").split("-").map(Number);
  if (!y || !m) return "";
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });
}

function previousSeasonKey(seasonKey) {
  const [y, m] = String(seasonKey || currentSeasonKey()).split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1)); // m jest 1-indeksowane, cofamy o 1 miesiąc
  return currentSeasonKey(d);
}

// Progi rang sezonowych wg liczby wygranych gier w danym miesiącu — zgadywane
// na start (jak w Hit Rush), do skorygowania gdy zobaczymy realne wyniki.
export const SEASON_RANKS = [
  { key: "diamond", label: "Diament", minWins: 40, color: "#7dffef" },
  { key: "platinum", label: "Platyna", minWins: 25, color: "#c4b5fd" },
  { key: "gold", label: "Złoto", minWins: 15, color: "#f5c451" },
  { key: "silver", label: "Srebro", minWins: 7, color: "#dbe6ee" },
  { key: "bronze", label: "Brąz", minWins: 3, color: "#c98a5a" },
];

export function seasonRankForWins(wins) {
  return SEASON_RANKS.find((r) => (wins || 0) >= r.minWins) || null;
}

export function seasonRankProgress(wins) {
  const value = Math.max(0, Number(wins || 0));
  const current = seasonRankForWins(value);
  const ascending = [...SEASON_RANKS].sort((a, b) => a.minWins - b.minWins);
  const next = ascending.find((rank) => value < rank.minWins) || null;
  const floor = current?.minWins || 0;
  const ceiling = next?.minWins || Math.max(floor, value);
  const progressPct = next && ceiling > floor
    ? Math.max(0, Math.min(100, Math.round(((value - floor) / (ceiling - floor)) * 100)))
    : 100;
  return { current, next, winsToNext: next ? Math.max(0, next.minWins - value) : 0, progressPct };
}

function historicalSeasonResult(statsData, seasonKey) {
  if (!statsData || !seasonKey) return null;
  if (statsData.seasonProgress?.seasonKey === seasonKey) return statsData.seasonProgress;
  return statsData.seasonHistory?.[seasonKey] || null;
}

function reconstructedSeasonZeroResult(statsData) {
  const totals = {
    gamesPlayed: Number(statsData?.gamesPlayed || 0),
    gamesWon: Number(statsData?.gamesWon || 0),
    guessesCorrect: Number(statsData?.guessesCorrect || 0),
  };
  const subtract = (result, key) => {
    if (!result || seasonNumber(key) < 1) return;
    totals.gamesPlayed -= Number(result.gamesPlayed || 0);
    totals.gamesWon -= Number(result.gamesWon || 0);
    totals.guessesCorrect -= Number(result.guessesCorrect || 0);
  };
  Object.entries(statsData?.seasonHistory || {}).forEach(([key, result]) => subtract(result, key));
  if (statsData?.seasonProgress?.seasonKey) subtract(statsData.seasonProgress, statsData.seasonProgress.seasonKey);
  return {
    seasonKey: seasonZeroKey(),
    gamesPlayed: Math.max(0, totals.gamesPlayed),
    gamesWon: Math.max(0, totals.gamesWon),
    guessesCorrect: Math.max(0, totals.guessesCorrect),
  };
}

// Zwraca wynik konkretnego sezonu jednego gracza bez dodatkowego odczytu.
// Dla Sezonu 0 korzysta z zapisanej historii, a jeśli jej nie ma —
// odtwarza go z liczników all-time pomniejszonych o sezony 1+.
export function getPlayerSeasonResult(statsData, seasonKey = currentSeasonKey()) {
  const sk = seasonKey || currentSeasonKey();
  const direct = historicalSeasonResult(statsData, sk);
  if (direct) return { seasonKey: sk, ...direct };
  if (sk === seasonZeroKey()) return reconstructedSeasonZeroResult(statsData);
  return { seasonKey: sk, gamesPlayed: 0, gamesWon: 0, guessesCorrect: 0 };
}

function compareSeasonResults(aResult = {}, bResult = {}, aUid = "", bUid = "", sortBy = "gamesWon") {
  const aWins = Number(aResult.gamesWon || 0);
  const bWins = Number(bResult.gamesWon || 0);
  const aGuesses = Number(aResult.guessesCorrect || 0);
  const bGuesses = Number(bResult.guessesCorrect || 0);
  const aPlayed = Number(aResult.gamesPlayed || 0);
  const bPlayed = Number(bResult.gamesPlayed || 0);

  if (sortBy === "guessesCorrect") {
    if (bGuesses !== aGuesses) return bGuesses - aGuesses;
    if (bWins !== aWins) return bWins - aWins;
  } else {
    if (bWins !== aWins) return bWins - aWins;
    if (bGuesses !== aGuesses) return bGuesses - aGuesses;
  }
  if (aPlayed !== bPlayed) return aPlayed - bPlayed;
  return String(aUid || "").localeCompare(String(bUid || ""));
}

const historicalSeasonLeaderboardCache = new Map();
async function getHistoricalSeasonPlayers(seasonKey) {
  const sk = seasonKey || seasonZeroKey();
  if (historicalSeasonLeaderboardCache.has(sk)) return historicalSeasonLeaderboardCache.get(sk);
  const request = getDocs(collection(db, "userStats"))
    .then((snap) => snap.docs.map((d) => {
      const data = d.data();
      const selectedSeasonProgress = sk === seasonZeroKey()
        ? (data.seasonHistory?.[sk] || reconstructedSeasonZeroResult(data))
        : historicalSeasonResult(data, sk);
      return { uid: d.id, ...data, selectedSeasonProgress };
    }).filter((p) => p.selectedSeasonProgress && Number(p.selectedSeasonProgress.gamesPlayed || 0) > 0))
    .catch((error) => { historicalSeasonLeaderboardCache.delete(sk); throw error; });
  historicalSeasonLeaderboardCache.set(sk, request);
  return request;
}

// Nagrody sezonowe. Od Sezonu 1 każdy aktywny gracz dostaje nagrodę
// zależną od najwyższej osiągniętej rangi, a TOP 3 dostaje dodatkowo
// bonus za miejsce. Nagrody rangowe NIE sumują się między progami —
// wypłacamy wyłącznie nagrodę za najwyższy osiągnięty poziom.
export const SEASON_PARTICIPATION_MIN_GAMES = 3;

export const SEASON_RANK_REWARDS = {
  active: { key: "active", label: "Aktywny gracz", xp: 75, hitcoin: 25, color: "#8f879b" },
  bronze: { key: "bronze", label: "Brąz", xp: 150, hitcoin: 50, color: "#c98a5a" },
  silver: { key: "silver", label: "Srebro", xp: 300, hitcoin: 75, color: "#dbe6ee" },
  gold: { key: "gold", label: "Złoto", xp: 500, hitcoin: 125, color: "#f5c451" },
  platinum: { key: "platinum", label: "Platyna", xp: 750, hitcoin: 200, color: "#c4b5fd" },
  diamond: { key: "diamond", label: "Diament", xp: 1000, hitcoin: 300, color: "#7dffef" },
};

export const SEASON_PLACEMENT_REWARDS = [
  { place: 1, xp: 1500, hitcoin: 400 },
  { place: 2, xp: 1000, hitcoin: 250 },
  { place: 3, xp: 500, hitcoin: 150 },
];

export function seasonBaseRewardForResult(result = {}) {
  const gamesPlayed = Number(result.gamesPlayed || 0);
  const gamesWon = Number(result.gamesWon || 0);
  const rank = seasonRankForWins(gamesWon);
  if (rank) return { ...SEASON_RANK_REWARDS[rank.key], rank };
  if (gamesPlayed >= SEASON_PARTICIPATION_MIN_GAMES) return { ...SEASON_RANK_REWARDS.active, rank: null };
  return null;
}

export function seasonRewardBreakdown(result = {}, place = null) {
  const base = seasonBaseRewardForResult(result);
  const placement = Number(place) >= 1 && Number(place) <= 3 ? SEASON_PLACEMENT_REWARDS[Number(place) - 1] : null;
  const rankXp = Number(base?.xp || 0);
  const rankHitcoin = Number(base?.hitcoin || 0);
  const placementXp = Number(placement?.xp || 0);
  const placementHitcoin = Number(placement?.hitcoin || 0);
  return {
    base,
    placement,
    rankXp,
    rankHitcoin,
    placementXp,
    placementHitcoin,
    totalXp: rankXp + placementXp,
    totalHitcoin: rankHitcoin + placementHitcoin,
  };
}

// Wywoływane przy końcu KAŻDEJ gry (obok już istniejących dożywotnich
// liczników) — transakcja, więc bezpieczne nawet gdy leci równolegle z
// innymi zapisami do tego samego dokumentu (patrz: naprawiony wcześniej
// bug z bumpWeeklyChallengeProgress dokładnie na tym tle).
export async function updateSeasonProgress(uid, { won = false, guessesCorrect = 0 } = {}) {
  const sk = currentSeasonKey();
  const ref = doc(db, "userStats", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const prev = data.seasonProgress;
    let history = data.seasonHistory || {};
    let counters;
    if (prev && prev.seasonKey === sk) {
      counters = { ...prev };
    } else {
      // sezon się przewinął (albo to pierwsza gra w ogóle) — jeśli poprzedni
      // wpis istniał, jego OSTATECZNY wynik trafia na stałe do seasonHistory
      // zanim licznik wyzerujemy, żeby rozdanie nagród mogło to później
      // odczytać niezależnie od tego kiedy dokładnie ktoś zagra pierwszą
      // grę w nowym miesiącu.
      if (prev && prev.seasonKey) {
        history = { ...history, [prev.seasonKey]: { gamesPlayed: prev.gamesPlayed || 0, gamesWon: prev.gamesWon || 0, guessesCorrect: prev.guessesCorrect || 0 } };
      }
      counters = { seasonKey: sk, gamesPlayed: 0, gamesWon: 0, guessesCorrect: 0 };
    }
    counters.gamesPlayed = (counters.gamesPlayed || 0) + 1;
    if (won) counters.gamesWon = (counters.gamesWon || 0) + 1;
    counters.guessesCorrect = (counters.guessesCorrect || 0) + guessesCorrect;
    tx.set(ref, { seasonProgress: counters, seasonHistory: history }, { merge: true });
  });
}

// Ranking sezonowy — sortBy: "gamesWon" | "guessesCorrect". Bez where+orderBy
// złożonego (wymagałby ręcznie tworzonego indeksu w konsoli Firebase) —
// pobieramy szerszą pulę po polu zagnieżdżonym i filtrujemy po stronie
// klienta do BIEŻĄCEGO sezonu, dokładnie ten sam sprawdzony wzorzec co przy
// rankingu Hit Rush. Pula 100 zamiast np. 20 celowo — na początku nowego
// sezonu większość dotychczasowych "topowych" wpisów wg tego pola to jeszcze
// dane ze STAREGO sezonu (odsiewane niżej), więc trzeba zapasu.
export async function getSeasonLeaderboard(count = 10, sortBy = "gamesWon", seasonKey = currentSeasonKey()) {
  const sk = seasonKey || currentSeasonKey();
  const fieldName = sortBy === "guessesCorrect" ? "guessesCorrect" : "gamesWon";

  if (sk !== currentSeasonKey()) {
    const players = await getHistoricalSeasonPlayers(sk);
    return [...players]
      .sort((a, b) => compareSeasonResults(a.selectedSeasonProgress, b.selectedSeasonProgress, a.uid, b.uid, fieldName))
      .slice(0, count);
  }

  if (sk === currentSeasonKey()) {
    const field = `seasonProgress.${fieldName}`;
    const q = query(collection(db, "userStats"), orderBy(field, "desc"), limit(100));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .filter((p) => p.seasonProgress?.seasonKey === sk)
      .map((p) => ({ ...p, selectedSeasonProgress: p.seasonProgress }))
      .sort((a, b) => compareSeasonResults(a.selectedSeasonProgress, b.selectedSeasonProgress, a.uid, b.uid, fieldName))
      .slice(0, count);
  }

  return [];
}

export async function getSeasonLeaderboardPosition(uid, seasonKey = currentSeasonKey(), sortBy = "gamesWon") {
  if (!uid) return null;
  const sk = seasonKey || currentSeasonKey();
  const fieldName = sortBy === "guessesCorrect" ? "guessesCorrect" : "gamesWon";

  if (sk !== currentSeasonKey()) {
    const players = await getHistoricalSeasonPlayers(sk);
    const ordered = [...players].sort((a, b) => compareSeasonResults(a.selectedSeasonProgress, b.selectedSeasonProgress, a.uid, b.uid, fieldName));
    const index = ordered.findIndex((p) => p.uid === uid);
    return index >= 0 ? index + 1 : null;
  }

  const ownSnap = await getDoc(doc(db, "userStats", uid));
  if (!ownSnap.exists()) return null;
  const ownData = ownSnap.data();
  const ownResult = historicalSeasonResult(ownData, sk);
  if (!ownResult || Number(ownResult.gamesPlayed || 0) <= 0) return null;
  const ownValue = Number(ownResult[fieldName] || 0);

  // Bez indeksu złożonego: osobno liczymy graczy z większym głównym wynikiem
  // oraz remisy na tym samym wyniku. Remisy rozstrzygamy dokładnie tak samo
  // jak ranking i wypłata nagród (wygrane -> zgadnięte -> mniej gier -> UID).
  const higherQuery = query(collection(db, "userStats"), where(`seasonProgress.${fieldName}`, ">", ownValue));
  const tiedQuery = query(collection(db, "userStats"), where(`seasonProgress.${fieldName}`, "==", ownValue));
  const [higher, tied] = await Promise.all([getDocs(higherQuery), getDocs(tiedQuery)]);
  const higherCount = higher.docs.filter((d) => d.data().seasonProgress?.seasonKey === sk).length;
  const tiedAhead = tied.docs
    .filter((d) => d.id !== uid && d.data().seasonProgress?.seasonKey === sk)
    .filter((d) => compareSeasonResults(d.data().seasonProgress, ownResult, d.id, uid, fieldName) < 0)
    .length;
  return higherCount + tiedAhead + 1;
}

// Rozliczenie poprzedniego sezonu. Nowy system działa od Sezonu 1:
// - każdy aktywny gracz (min. 3 gry) dostaje nagrodę za najwyższą rangę,
// - TOP 3 dostaje dodatkowy bonus za miejsce,
// - wypłata jest idempotentna per gracz/per sezon.
//
// Kluczowa różnica względem starej wersji: globalnego markera NIE ustawiamy
// przed wypłatami. Każdy userStats ma osobny seasonRewardClaims[seasonKey].
// Jeśli klient padnie w połowie rozliczenia, kolejny klient ominie już
// wypłaconych graczy i dokończy resztę. Dopiero po przejściu całej listy
// zapisujemy completedAt w markerze sezonu.
export async function processSeasonRewardsIfNeeded() {
  const endedSeason = previousSeasonKey(currentSeasonKey());
  const endedNumber = seasonNumber(endedSeason);

  // Sezon 0 był rozliczany według starego systemu / ręcznego seedowania.
  // Nie dopłacamy do niego nowych nagród rangowych wstecz.
  if (endedNumber < 1) return { skipped: true, reason: "pre-season", seasonKey: endedSeason };

  const markerRef = doc(db, "seasonRewardsProcessed", `${endedSeason}-v2`);
  const markerSnap = await getDoc(markerRef);
  if (markerSnap.exists() && markerSnap.data()?.completedAt) {
    return { alreadyProcessed: true, seasonKey: endedSeason };
  }

  const snap = await getDocs(collection(db, "userStats"));
  const rankedAll = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        username: data.username || "Gracz",
        avatarUrl: data.avatarUrl || null,
        result: historicalSeasonResult(data, endedSeason),
      };
    })
    .filter((p) => p.result && Number(p.result.gamesPlayed || 0) > 0)
    .sort((a, b) => compareSeasonResults(a.result, b.result, a.uid, b.uid, "gamesWon"));

  const archive = rankedAll.slice(0, 50).map((p, i) => ({
    uid: p.uid,
    username: p.username,
    avatarUrl: p.avatarUrl,
    place: i + 1,
    ...p.result,
    rank: seasonRankForWins(p.result.gamesWon)?.key || null,
  }));
  await setDoc(doc(db, "seasonArchive", endedSeason), {
    seasonKey: endedSeason,
    top: archive,
    finalizedAt: Date.now(),
    rewardVersion: 2,
  }, { merge: true });

  const eligiblePlayers = rankedAll.filter((player, index) => {
    const reward = seasonRewardBreakdown(player.result, index + 1);
    return reward.totalXp > 0 || reward.totalHitcoin > 0;
  }).length;
  let rewarded = 0;
  let skipped = 0;
  for (let i = 0; i < rankedAll.length; i++) {
    const player = rankedAll[i];
    const place = i + 1;
    const reward = seasonRewardBreakdown(player.result, place);
    if (reward.totalXp <= 0 && reward.totalHitcoin <= 0) {
      skipped += 1;
      continue;
    }

    const ref = doc(db, "userStats", player.uid);
    let granted = false;
    await runTransaction(db, async (tx) => {
      const userSnap = await tx.get(ref);
      if (!userSnap.exists()) return;
      const data = userSnap.data() || {};
      const claims = { ...(data.seasonRewardClaims || {}) };
      if (Number(claims?.[endedSeason]?.version || 0) >= 2) return;

      const baseLabel = reward.base?.label || null;
      const claim = {
        version: 2,
        seasonKey: endedSeason,
        seasonNumber: endedNumber,
        processedAt: Date.now(),
        place,
        tierKey: reward.base?.key || null,
        tierLabel: baseLabel,
        gamesPlayed: Number(player.result.gamesPlayed || 0),
        gamesWon: Number(player.result.gamesWon || 0),
        guessesCorrect: Number(player.result.guessesCorrect || 0),
        rankXp: reward.rankXp,
        rankHitcoin: reward.rankHitcoin,
        placementXp: reward.placementXp,
        placementHitcoin: reward.placementHitcoin,
        totalXp: reward.totalXp,
        totalHitcoin: reward.totalHitcoin,
      };
      claims[endedSeason] = claim;

      const notice = {
        id: `season-${endedSeason}-${player.uid}`,
        source: "season",
        seasonKey: endedSeason,
        seasonNumber: endedNumber,
        place,
        seasonRank: baseLabel,
        tierKey: reward.base?.key || null,
        gamesPlayed: claim.gamesPlayed,
        gamesWon: claim.gamesWon,
        rankXp: reward.rankXp,
        rankHitcoin: reward.rankHitcoin,
        placementXp: reward.placementXp,
        placementHitcoin: reward.placementHitcoin,
        xp: reward.totalXp,
        hitcoin: reward.totalHitcoin,
        label: `Sezon ${endedNumber} zakończony`,
      };

      tx.set(ref, {
        xp: Number(data.xp || 0) + reward.totalXp,
        hitcoin: Number(data.hitcoin || 0) + reward.totalHitcoin,
        seasonRewardClaims: claims,
        rewardNotices: [...(data.rewardNotices || []), notice],
      }, { merge: true });
      granted = true;
    });
    if (granted) rewarded += 1;
  }

  await setDoc(markerRef, {
    seasonKey: endedSeason,
    seasonNumber: endedNumber,
    rewardVersion: 2,
    completedAt: Date.now(),
    playersInRanking: rankedAll.length,
    eligiblePlayers,
    newRewardsGrantedThisRun: rewarded,
    playersWithoutReward: skipped,
  }, { merge: true });

  return { processed: true, seasonKey: endedSeason, rewarded, skipped, players: rankedAll.length };
}

// Historia sezonów danego gracza (do profilu/statystyk), bez dodatkowych
// zapytań. Uwzględnia również odtworzony Sezon 0 oraz sytuację, gdy gracz
// jeszcze nie rozegrał pierwszej gry w nowym miesiącu i poprzedni sezon
// nadal siedzi w seasonProgress zamiast seasonHistory.
export function getPlayerSeasonHistory(statsData) {
  const history = { ...(statsData?.seasonHistory || {}) };
  const zeroKey = seasonZeroKey();
  if (!history[zeroKey]) {
    const zero = reconstructedSeasonZeroResult(statsData);
    if (Number(zero.gamesPlayed || 0) > 0) history[zeroKey] = zero;
  }
  const liveProgress = statsData?.seasonProgress;
  if (liveProgress?.seasonKey && liveProgress.seasonKey !== currentSeasonKey() && !history[liveProgress.seasonKey]) {
    history[liveProgress.seasonKey] = liveProgress;
  }
  return Object.entries(history)
    .filter(([seasonKey]) => seasonKey !== currentSeasonKey())
    .map(([seasonKey, result]) => ({ seasonKey, seasonNumber: seasonNumber(seasonKey), ...result, rank: seasonRankForWins(result.gamesWon) }))
    .sort((a, b) => (a.seasonKey < b.seasonKey ? 1 : -1));
}

// ============================================================
// ODBIERANIE NAGRÓD ZA RANKINGI TYGODNIOWE
// ============================================================
function weeklyRankingClaimId(source, weekKey) {
  // Claim żyje wewnątrz dokumentu konkretnego gracza, więc nie potrzebujemy
  // UID w kluczu. Dzięki temu nie tworzymy nowej kolekcji ani nowych wymagań
  // dla reguł Firestore — korzystamy wyłącznie z istniejącego userStats.
  return `${String(source || "ranking")}_${String(weekKey || "week")}`;
}

// Kolejkuje nagrodę do ręcznego odebrania. Transakcja zapisuje jednocześnie
// trwały claim i popup, dlatego równoległe rozliczenia nie mogą dodać dubla.
export async function queueWeeklyRankingReward(uid, { source, weekKey, place, label } = {}) {
  const reward = weeklyRankingRewardForPlace(place);
  if (!uid || !source || !weekKey || !reward) return false;

  const claimId = weeklyRankingClaimId(source, weekKey);
  const statsRef = doc(db, "userStats", uid);
  let queued = false;

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    const data = statsSnap.exists() ? statsSnap.data() : {};
    const claims = { ...(data.weeklyRankingClaims || {}) };
    if (claims[claimId]) return;

    const claim = {
      claimId,
      source,
      weekKey,
      place: reward.place,
      xp: reward.xp,
      hitcoin: reward.hitcoin,
      label: label || "Ranking tygodniowy",
      status: "pending",
      createdAt: Date.now(),
    };
    const notice = {
      id: `weekly-${claimId}`,
      kind: "weeklyRanking",
      claimRequired: true,
      ...claim,
    };
    const notices = Array.isArray(data.rewardNotices) ? data.rewardNotices : [];
    claims[claimId] = claim;

    tx.set(statsRef, { weeklyRankingClaims: claims, rewardNotices: [...notices, notice] }, { merge: true });
    queued = true;
  });

  return queued;
}

// Faktyczna wypłata następuje dopiero po kliknięciu ODBIERZ NAGRODĘ.
// Wszystko odbywa się w jednej transakcji na istniejącym userStats: saldo,
// status claimu i usunięcie popupu zmieniają się atomowo.
export async function claimWeeklyRankingReward(uid, claimId) {
  if (!uid || !claimId) return { ok: false };
  const statsRef = doc(db, "userStats", uid);
  let result = { ok: false };

  await runTransaction(db, async (tx) => {
    const statsSnap = await tx.get(statsRef);
    if (!statsSnap.exists()) return;
    const data = statsSnap.data() || {};
    const claims = { ...(data.weeklyRankingClaims || {}) };
    const claim = claims[claimId];
    if (!claim) return;

    const notices = Array.isArray(data.rewardNotices) ? data.rewardNotices : [];
    const remainingNotices = notices.filter((notice) => notice?.claimId !== claimId);

    if (claim.status === "claimed") {
      if (remainingNotices.length !== notices.length) {
        tx.set(statsRef, { rewardNotices: remainingNotices }, { merge: true });
      }
      result = { ok: false, alreadyClaimed: true, xp: Number(claim.xp || 0), hitcoin: Number(claim.hitcoin || 0) };
      return;
    }
    if (claim.status !== "pending") return;

    const xp = Math.max(0, Number(claim.xp || 0));
    const hitcoin = Math.max(0, Number(claim.hitcoin || 0));
    claims[claimId] = { ...claim, status: "claimed", claimedAt: Date.now() };
    tx.set(statsRef, {
      xp: increment(xp),
      hitcoin: increment(hitcoin),
      weeklyRankingClaims: claims,
      rewardNotices: remainingNotices,
    }, { merge: true });
    result = { ok: true, xp, hitcoin, source: claim.source, place: claim.place, label: claim.label };
  });

  return result;
}

// ============================================================
// POWIADOMIENIA O NAGRODACH Z ROZLICZEŃ TYGODNIOWYCH/SEZONOWYCH
// ============================================================
// Problem który to rozwiązuje: nagrody za Playlistę dnia / Hit Rush / Turniej
// / Sezon są przyznawane w tle, przez transakcję wyzwalaną przez PIERWSZEGO
// gracza, który akurat otworzy appkę w danym okresie — czyli niekoniecznie
// przez samego zwycięzcę. Dlatego "karteczka" jest dopisywana bezpośrednio
// do konta KONKRETNEGO zwycięzcy (niezależnie kto wyzwolił przetwarzanie),
// a odczytywana leniwie przy jego własnym najbliższym zalogowaniu — każdy
// zwycięzca prędzej czy później zobaczy swój popup, nawet jeśli nie był
// tym, kto wywołał samo rozliczenie.
export async function pushRewardNotice(uid, notice) {
  if (!uid) return;
  const ref = doc(db, "userStats", uid);
  const entry = { ...notice, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
  await updateDoc(ref, { rewardNotices: arrayUnion(entry) }).catch(() => {});
}

// Zdejmuje i zwraca JEDNĄ najstarszą nieodczytaną karteczkę (transakcja —
// bezpieczne nawet gdyby appka była otwarta na dwóch kartach naraz).
export async function consumeNextRewardNotice(uid) {
  if (!uid) return null;
  const ref = doc(db, "userStats", uid);
  let notice = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists() ? snap.data() : {};
    const notices = Array.isArray(data.rewardNotices) ? data.rewardNotices : [];
    if (!notices.length) return;
    notice = notices[0];
    // Nagroda rankingowa ma zostać w kolejce aż do faktycznego kliknięcia
    // ODBIERZ NAGRODĘ. Stare powiadomienia (już wcześniej wypłacone) zachowują
    // dotychczasowe zachowanie i są zdejmowane przy wyświetleniu.
    if (!notice?.claimRequired) tx.update(ref, { rewardNotices: notices.slice(1) });
  });
  return notice;
}

// ============================================================
// JEDNORAZOWE: "Sezon 0" z obecnego rankingu wszechczasów
// ============================================================
// Wywoływane ręcznie z panelu admina, raz. Traktuje DZISIEJSZY stan
// dożywotniego rankingu (sprzed wprowadzenia sezonów) jako zamknięty
// "Sezon 0" — zapisuje top 3 na stałe do ich seasonHistory, przyznaje
// nagrody i wysyła karteczki, dokładnie jak przy normalnym zamknięciu
// sezonu. Klucz wypada naturalnie przed SEASON_START, więc
// seasonNumber() sam policzy to jako "Sezon 0" bez specjalnych
// przypadków w kodzie wyświetlania.
export async function seedSeasonZeroFromAllTime() {
  const zeroKey = previousSeasonKey(SEASON_START);
  // Osobny, stały znacznik — NIE ten sam dokument co zwykłe, comiesięczne
  // rozliczenie sezonu (processSeasonRewardsIfNeeded). Oba kiedyś mogą policzyć
  // ten sam klucz kalendarzowy (np. teraz obydwa wychodzą na "2026-08"), a to
  // dwie zupełnie różne operacje — jednorazowy ręczny backfill nie może dzielić
  // znacznika z automatycznym, comiesięcznym mechanizmem.
  const markerRef = doc(db, "seasonRewardsProcessed", "season-zero-manual-seed");
  let shouldProcess = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(markerRef);
    if (snap.exists()) return;
    shouldProcess = true;
    tx.set(markerRef, { processedAt: Date.now(), seeded: true, zeroKey });
  });
  if (!shouldProcess) return { alreadyProcessed: true, zeroKey };

  const top3 = await getLeaderboard(3, "gamesWon");
  const archive = [];
  for (let i = 0; i < top3.length; i++) {
    const p = top3[i];
    if (!p.uid || !p.gamesWon) continue;
    const result = { gamesWon: p.gamesWon || 0, gamesPlayed: p.gamesPlayed || 0, guessesCorrect: p.guessesCorrect || 0 };
    const ref = doc(db, "userStats", p.uid);
    await updateDoc(ref, { [`seasonHistory.${zeroKey}`]: result }).catch(() => {});
    const reward = SEASON_PLACEMENT_REWARDS[i];
    if (reward) {
      await updateDoc(ref, { xp: increment(reward.xp), hitcoin: increment(reward.hitcoin) }).catch(() => {});
      await pushRewardNotice(p.uid, { source: "season", place: i + 1, xp: reward.xp, hitcoin: reward.hitcoin, label: "Sezon 0 (ranking)" }).catch(() => {});
    }
    archive.push({ uid: p.uid, place: i + 1, ...result });
  }
  await setDoc(doc(db, "seasonArchive", zeroKey), { seasonKey: zeroKey, top: archive, finalizedAt: Date.now(), seeded: true });
  return { seeded: true, zeroKey, top: archive };
}

// ============================================================
// JEDNORAZOWE (dopełniające): zamrożenie Sezonu 0 dla WSZYSTKICH
// pozostałych graczy, nie tylko top 3
// ============================================================
// seedSeasonZeroFromAllTime() zamroziło na stałe wynik tylko dla top 3
// (bo wtedy chodziło głównie o przetestowanie nagród). Reszta graczy nie
// miała żadnego zamrożonego wpisu, więc ranking historyczny liczył im
// wynik NA ŻYWO (reconstructedSeasonZeroResult) — a to rośnie bez końca
// wraz z każdą kolejną rozegraną grą, bo nie ma jak odróżnić "wygranej
// z Sezonu 0" od "wygranej z bieżącego sezonu" bez zamrożonego punktu
// odniesienia. Ta funkcja dopełnia brakujące wpisy — NIE rusza tych, które
// już istnieją (top 3 zostaje z ich oryginalnym, poprawnym zamrożeniem).
export async function freezeSeasonZeroForRemainingPlayers() {
  const zeroKey = seasonZeroKey();
  const snap = await getDocs(collection(db, "userStats"));
  let frozen = 0;
  let skippedAlready = 0;
  let skippedNoGames = 0;
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.seasonHistory?.[zeroKey]) { skippedAlready++; continue; }
    const result = reconstructedSeasonZeroResult(data);
    if (Number(result.gamesPlayed || 0) <= 0) { skippedNoGames++; continue; }
    await updateDoc(doc(db, "userStats", docSnap.id), { [`seasonHistory.${zeroKey}`]: result }).catch(() => {});
    frozen++;
  }
  return { frozen, skippedAlready, skippedNoGames };
}
