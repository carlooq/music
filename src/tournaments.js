import { doc, getDoc, setDoc, updateDoc, increment, runTransaction, collection, query, where, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { pushRewardNotice } from "./stats.js";

const COLLECTION = "tournaments";
const SCORED_COUNT = 10; // tyle kart faktycznie się ocenia w każdym meczu — pierwsza karta "wchodzi za darmo" (bez punktu odniesienia), dokładnie jak w Playliście dnia
const MATCH_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24h na rozegranie swojej tury
const ONE_HOUR_MS = 60 * 60 * 1000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickMatchPlaylist(pool) {
  const picked = shuffle(pool).slice(0, SCORED_COUNT + 1);
  return picked.map((s) => ({
    id: s.id || s.videoId,
    videoId: s.videoId,
    artist: s.artist,
    title: s.title,
    year: s.year,
    startSeconds: Math.floor(Math.random() * 61) + 15,
  }));
}

// Buduje pary z listy zapisanych graczy (losowo) i dla KAŻDEJ pary losuje
// osobną, unikalną talię (obaj gracze w danej parze grają na tej samej).
function buildRound(players, pool, roundNumber) {
  const shuffled = shuffle(players);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      matchId: `r${roundNumber}m${matches.length + 1}`,
      player1: shuffled[i],
      player2: shuffled[i + 1] || null, // "wolny los" — teoretyczne zabezpieczenie, nie powinno wystąpić przy 4/8 graczach
      playlist: pickMatchPlaylist(pool),
      player1Result: null,
      player2Result: null,
      deadline: Date.now() + MATCH_DEADLINE_MS,
      winnerUid: shuffled[i + 1] ? null : shuffled[i].uid, // wolny los = automatyczny awans
    });
  }
  return { roundNumber, matches };
}

// --- Admin: tworzenie i zarządzanie ---

export async function createTournament(mode, maxPlayers, entryFee, createdByUid) {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    id: ref.id,
    format: "bracket",
    mode,
    maxPlayers,
    entryFee,
    status: "signup",
    signups: [],
    rounds: [],
    winnerUid: null,
    settledAt: null,
    createdAt: Date.now(),
    createdByUid,
  });
  return ref.id;
}

export async function cancelTournament(tournamentId) {
  // Nic nie było jeszcze pobrane z XP na etapie zapisów, więc "anulowanie" to po prostu usunięcie — nie ma czego zwracać.
  await deleteDoc(doc(db, COLLECTION, tournamentId));
}

// Aktywny turniej to taki w stanie "signup" albo "active" — zakładamy, że
// naraz istnieje co najwyżej jeden (prostsze zarządzanie przy tej skali).
export async function fetchActiveTournament() {
  // Filtrowanie lokalne (nie where("format",...)) celowo — dokładnie ten sam
  // powód co w fetchLastCompletedTournament niżej: unikamy złożonego indeksu
  // Firestore, którego nie da się tu utworzyć. Stare turnieje sprzed dodania
  // pola "format" traktujemy jako puchar (brakujące pole = bracket).
  const q = query(collection(db, COLLECTION), where("status", "in", ["signup", "active"]));
  const snap = await getDocs(q);
  const bracket = snap.docs.map((d) => d.data()).find((t) => t.format !== "league");
  return bracket || null;
}

export async function fetchActiveLeague() {
  const q = query(collection(db, COLLECTION), where("status", "in", ["signup", "active"]));
  const snap = await getDocs(q);
  const league = snap.docs.map((d) => d.data()).find((t) => t.format === "league");
  return league || null;
}


export async function fetchLastCompletedTournament() {
  // Celowo bez where("status","==","completed") w połączeniu z orderBy — to wymagałoby
  // złożonego indeksu w Firestore, którego nie da się utworzyć stąd. Zamiast tego pobieramy
  // kilka ostatnich turniejów (posortowane po samym createdAt, co nie wymaga indeksu) i filtrujemy lokalnie.
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(10));
  const snap = await getDocs(q);
  const completed = snap.docs.map((d) => d.data()).find((t) => t.status === "completed");
  return completed || null;
}

export async function fetchTournament(tournamentId) {
  const snap = await getDoc(doc(db, COLLECTION, tournamentId));
  return snap.exists() ? snap.data() : null;
}

// --- Zapisy i start drabinki ---

export async function signUpForTournament(tournamentId, uid, name, pool, avatarUrl = null) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Turniej nie istnieje.");
    const data = snap.data();
    if (data.status !== "signup") throw new Error("Zapisy do tego turnieju są już zamknięte.");
    if (data.signups.some((p) => p.uid === uid)) return; // już zapisany, nic nie rób
    const newSignups = [...data.signups, { uid, name, avatarUrl: avatarUrl || null }];
    if (newSignups.length >= data.maxPlayers) {
      const round = buildRound(newSignups, pool, 1);
      tx.update(ref, { signups: newSignups, status: "active", rounds: [round], startedAt: Date.now() });
    } else {
      tx.update(ref, { signups: newSignups });
    }
  });
}

// --- Rozegranie meczu (wywoływane po zakończeniu solowej gry gracza) ---

export async function recordTournamentMatchResult(tournamentId, roundNumber, matchId, uid, score, timeMs) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const rounds = data.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
    const round = rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) return;
    const match = round.matches.find((m) => m.matchId === matchId);
    if (!match || match.winnerUid) return; // mecz już rozstrzygnięty albo nie istnieje

    const result = { score, timeMs, playedAt: Date.now() };
    if (match.player1.uid === uid && !match.player1Result) match.player1Result = result;
    else if (match.player2?.uid === uid && !match.player2Result) match.player2Result = result;
    else return; // ten gracz już zagrał swoją turę w tym meczu

    if (match.player1Result && match.player2Result) {
      match.winnerUid = resolveMatchWinner(match);
    }
    tx.update(ref, { rounds });
  });
}

function resolveMatchWinner(match) {
  const r1 = match.player1Result;
  const r2 = match.player2Result;
  if (!r1 && !r2) return null;
  if (!r1) return match.player2.uid; // gracz 1 nie zagrał wcale (przegrana walkowerem)
  if (!r2) return match.player1.uid;
  if (r1.score !== r2.score) return r1.score > r2.score ? match.player1.uid : match.player2.uid;
  return r1.timeMs <= r2.timeMs ? match.player1.uid : match.player2.uid; // remis → szybszy wygrywa
}

// --- Leniwe sprawdzanie postępu turnieju (wywoływane przy otwarciu huba) ---
// Appka nie ma backendu/crona, więc to jedyny sposób na wykrycie upłynięcia
// 24h terminu i przejście do kolejnej rundy — dokładnie ten sam wzorzec co
// przy cotygodniowych nagrodach Playlisty dnia.

export async function checkAndAdvanceTournament(tournamentId, pool) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "active") return;

    const rounds = data.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
    const currentRound = rounds[rounds.length - 1];
    const now = Date.now();

    // walkowery za przekroczony termin
    currentRound.matches.forEach((match) => {
      if (match.winnerUid || now < match.deadline) return;
      match.winnerUid = resolveMatchWinner(match) || match.player1.uid; // jeśli obaj nie zagrali, gracz 1 wygrywa domyślnie (skrajny, mało prawdopodobny przypadek)
    });

    const roundDone = currentRound.matches.every((m) => m.winnerUid);
    if (!roundDone) {
      tx.update(ref, { rounds });
      return;
    }

    const advancing = currentRound.matches.map((m) => {
      const winnerPlayer = m.player1.uid === m.winnerUid ? m.player1 : m.player2;
      return winnerPlayer;
    });

    if (advancing.length === 1) {
      // turniej zakończony
      tx.update(ref, { rounds, status: "completed", winnerUid: advancing[0].uid });
    } else {
      const nextRound = buildRound(advancing, pool, currentRound.roundNumber + 1);
      tx.update(ref, { rounds: [...rounds, nextRound] });
    }
  });
}

// Stan turniejowy konkretnego użytkownika. Używany wspólnie przez mobile, desktop
// oraz system przypomnień, żeby uniknąć rozjazdu logiki między widokami.
export function getTournamentUserState(tournament, uid, now = Date.now()) {
  const signups = tournament?.signups || [];
  const signedUp = !!uid && signups.some((player) => player.uid === uid);
  const rounds = tournament?.rounds || [];
  const currentRound = rounds.length ? rounds[rounds.length - 1] : null;
  const match = currentRound?.matches?.find((item) => item.player1?.uid === uid || item.player2?.uid === uid) || null;
  const myResult = !match ? null : match.player1?.uid === uid ? match.player1Result : match.player2Result;
  const opponent = !match ? null : match.player1?.uid === uid ? match.player2 : match.player1;
  const deadline = Number(match?.deadline || 0);
  const msLeft = deadline ? Math.max(0, deadline - now) : null;
  const canPlay = !!(tournament?.status === "active" && match && opponent && !match.winnerUid && !myResult);
  const waiting = !!(match && myResult && !match.winnerUid);
  const wonMatch = !!(match?.winnerUid && match.winnerUid === uid);
  const eliminated = !!(match?.winnerUid && match.winnerUid !== uid && (match.player1?.uid === uid || match.player2?.uid === uid));
  return { signedUp, currentRound, roundNumber: currentRound?.roundNumber || null, match, myResult, opponent, deadline, msLeft, canPlay, waiting, wonMatch, eliminated, urgent: canPlay && msLeft !== null && msLeft <= ONE_HOUR_MS };
}

export function tournamentTimeLeftLabel(msLeft) {
  if (msLeft === null || msLeft === undefined) return "—";
  if (msLeft <= 0) return "czas minął";
  const totalMinutes = Math.max(1, Math.ceil(msLeft / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

// --- Rozliczenie XP na koniec turnieju ---
// Każdy gracz dostaje własny marker rozliczenia w userStats. Dzięki temu
// przerwanie przeglądarki w połowie nie powoduje ani podwójnej wypłaty, ani
// utraty nagrody. settledAt ustawiamy dopiero po przejściu wszystkich graczy.
export async function settleTournamentXpIfNeeded(tournamentId) {
  const ref = doc(db, COLLECTION, tournamentId);
  const tournamentSnap = await getDoc(ref);
  if (!tournamentSnap.exists()) return;
  const data = tournamentSnap.data();
  if (data.status !== "completed" || data.settledAt) return;

  const pot = Math.max(0, ((data.signups || []).length - 1) * Number(data.entryFee || 0));
  for (const player of data.signups || []) {
    const statsRef = doc(db, "userStats", player.uid);
    let granted = false;
    let winnerGranted = false;
    await runTransaction(db, async (tx) => {
      const statsSnap = await tx.get(statsRef);
      if (!statsSnap.exists()) return;
      const stats = statsSnap.data();
      const claims = { ...(stats.tournamentRewardClaims || {}) };
      if (claims[tournamentId]) return;
      const isWinner = player.uid === data.winnerUid;
      const currentXp = Number(stats.xp || 0);
      const nextXp = isWinner ? currentXp + pot : Math.max(0, currentXp - Number(data.entryFee || 0));
      claims[tournamentId] = {
        tournamentId,
        won: isWinner,
        xpDelta: isWinner ? pot : -Math.min(currentXp, Number(data.entryFee || 0)),
        settledAt: Date.now(),
      };
      tx.update(statsRef, {
        xp: nextXp,
        tournamentRewardClaims: claims,
        ...(isWinner ? { tournamentsWon: Number(stats.tournamentsWon || 0) + 1 } : {}),
      });
      granted = true;
      winnerGranted = isWinner;
    });
    if (granted && winnerGranted) {
      pushRewardNotice(player.uid, { source: "tournament", place: 1, xp: pot, hitcoin: 0, label: "Zwycięstwo w turnieju" }).catch(() => {});
    }
  }
  await updateDoc(ref, { settledAt: Date.now() }).catch(() => {});
}

export { pickMatchPlaylist, MATCH_DEADLINE_MS };

// Podium ligi — stałe nagrody niezależne od liczby graczy czy wpisowego
// (w przeciwieństwie do pucharu, gdzie zwycięzca zgarnia pulę wpisowego).
// Każdy mecz i tak liczy się do zwykłych statystyk gracza jak normalna gra —
// to jest WYŁĄCZNIE dodatkowa nagroda za końcowe miejsce w tabeli.
const LEAGUE_PODIUM_REWARDS = [
  { xp: 1500, hitcoin: 500 },
  { xp: 1000, hitcoin: 300 },
  { xp: 750, hitcoin: 200 },
];

export async function settleLeagueRewardsIfNeeded(tournamentId) {
  const ref = doc(db, COLLECTION, tournamentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data.status !== "completed" || data.rewardsSettled) return;

  const standings = data.standings && data.standings.length ? data.standings : computeLeagueStandings(data.rounds, data.signups);
  for (let i = 0; i < Math.min(3, standings.length); i++) {
    const player = standings[i];
    const reward = LEAGUE_PODIUM_REWARDS[i];
    const statsRef = doc(db, "userStats", player.uid);
    let granted = false;
    await runTransaction(db, async (tx) => {
      const statsSnap = await tx.get(statsRef);
      if (!statsSnap.exists()) return;
      const stats = statsSnap.data();
      const claims = { ...(stats.leagueRewardClaims || {}) };
      if (claims[tournamentId]) return; // już przyznane — nie dublujemy
      claims[tournamentId] = { place: i + 1, xp: reward.xp, hitcoin: reward.hitcoin, settledAt: Date.now() };
      tx.update(statsRef, {
        xp: increment(reward.xp),
        hitcoin: increment(reward.hitcoin),
        leagueRewardClaims: claims,
        ...(i === 0 ? { leaguesWon: increment(1) } : {}),
      });
      granted = true;
    });
    if (granted) {
      pushRewardNotice(player.uid, { source: "league", place: i + 1, xp: reward.xp, hitcoin: reward.hitcoin, label: `${i + 1}. miejsce w lidze` }).catch(() => {});
    }
  }
  await updateDoc(ref, { rewardsSettled: true }).catch(() => {});
}

// ============================================================
// LIGA — każdy z każdym, terminarz ustalony z góry (metoda kołowa),
// bez odpadania, tabela punktowa zamiast drabinki. Reużywa cały mechanizm
// "wspólna playlista na mecz" z pucharu — różni się tylko sposobem
// parowania graczy i rozliczaniem wyniku (prawdziwy remis, nie
// rozstrzyganie szybkością).
// ============================================================

const LEAGUE_MATCH_DEADLINE_MS = 48 * 60 * 60 * 1000; // 48h na kolejkę, nie 24h jak w pucharze

// Metoda kołowa: N graczy -> N-1 kolejek (N kolejek z jedną "wolną" osobą na
// kolejkę, jeśli N nieparzyste). Zwraca same UID-y w parach — budowanie
// właściwych obiektów meczów (z playlistą) dzieje się osobno, dopiero gdy
// dana kolejka faktycznie startuje.
export function buildRoundRobinPairings(playerIds) {
  const ids = [...playerIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push(null);
  const n = ids.length;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const rounds = [];
  for (let round = 0; round < n - 1; round++) {
    const current = [fixed, ...rotating];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) pairs.push([current[i], current[n - 1 - i]]);
    rounds.push(pairs);
    rotating.unshift(rotating.pop());
  }
  return rounds;
}

// Wynik POJEDYNCZEGO meczu ligowego — równy wynik to PRAWDZIWY remis
// (w przeciwieństwie do pucharu, gdzie o zwycięstwie przy remisie decyduje
// szybkość — tam potrzebny jest jednoznaczny zwycięzca do awansu).
export function resolveLeagueMatchOutcome(match) {
  const r1 = match.player1Result;
  const r2 = match.player2Result;
  if (!r1 && !r2) return "double_walkover";
  if (!r1) return "walkover_p2";
  if (!r2) return "walkover_p1";
  if (r1.score > r2.score) return "p1";
  if (r2.score > r1.score) return "p2";
  return "draw";
}

// Tabela ligowa. Tiebreak w kolejności: punkty w tabeli -> suma zdobytych
// punktów we wszystkich meczach -> wynik bezpośredniego pojedynku ->
// szybkość (łączny czas, mniejszy = lepiej).
export function computeLeagueStandings(rounds, players) {
  const table = {};
  players.forEach((p) => {
    table[p.uid] = { uid: p.uid, name: p.name, avatarUrl: p.avatarUrl || null, wins: 0, draws: 0, losses: 0, points: 0, played: 0, totalScore: 0, totalTimeMs: 0 };
  });
  const h2h = {};

  rounds.forEach((round) => {
    round.matches.forEach((m) => {
      if (!m.player2) return; // wolny los — nie liczy się do tabeli
      const outcome = resolveLeagueMatchOutcome(m);
      const p1 = table[m.player1.uid];
      const p2 = table[m.player2.uid];
      if (!p1 || !p2) return;
      if (outcome === "double_walkover") return;

      p1.played++; p2.played++;
      if (m.player1Result) { p1.totalScore += m.player1Result.score; p1.totalTimeMs += m.player1Result.timeMs || 0; }
      if (m.player2Result) { p2.totalScore += m.player2Result.score; p2.totalTimeMs += m.player2Result.timeMs || 0; }

      const key = [m.player1.uid, m.player2.uid].sort().join("|");
      if (!h2h[key]) h2h[key] = {};

      if (outcome === "p1" || outcome === "walkover_p1") {
        p1.wins++; p1.points += 3; p2.losses++;
        h2h[key][m.player1.uid] = (h2h[key][m.player1.uid] || 0) + 1;
      } else if (outcome === "p2" || outcome === "walkover_p2") {
        p2.wins++; p2.points += 3; p1.losses++;
        h2h[key][m.player2.uid] = (h2h[key][m.player2.uid] || 0) + 1;
      } else if (outcome === "draw") {
        p1.draws++; p2.draws++; p1.points += 1; p2.points += 1;
      }
    });
  });

  const rows = Object.values(table);
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    const key = [a.uid, b.uid].sort().join("|");
    const h = h2h[key];
    if (h) {
      const aWins = h[a.uid] || 0;
      const bWins = h[b.uid] || 0;
      if (aWins !== bWins) return bWins - aWins;
    }
    return a.totalTimeMs - b.totalTimeMs;
  });
  return rows;
}

// Buduje właściwe obiekty meczów (z playlistą) dla jednej kolejki, na
// podstawie gotowego już parowania UID-ów. Analogiczne do buildRound()
// z pucharu, tylko pary są z góry ustalone, nie losowane od nowa.
function buildLeagueRoundMatches(pairing, players, pool, roundNumber) {
  const byUid = {};
  players.forEach((p) => { byUid[p.uid] = p; });
  const matches = pairing.map(([uidA, uidB], i) => ({
    matchId: `r${roundNumber}m${i + 1}`,
    player1: byUid[uidA],
    player2: uidB ? byUid[uidB] : null,
    playlist: pickMatchPlaylist(pool),
    player1Result: null,
    player2Result: null,
    outcome: uidB ? null : "bye",
    deadline: Date.now() + LEAGUE_MATCH_DEADLINE_MS,
  }));
  return { roundNumber, matches };
}

export async function createLeague(mode, createdByUid) {
  const ref = doc(collection(db, COLLECTION));
  await setDoc(ref, {
    id: ref.id,
    format: "league",
    mode,
    entryFee: 0, // liga jest darmowa — w przeciwieństwie do pucharu, gdzie wpisowe napędza pulę dla zwycięzcy
    status: "signup",
    signups: [],
    pairingSchedule: null,
    rounds: [],
    standings: [],
    createdAt: Date.now(),
    createdByUid,
  });
  return ref.id;
}

// Zapisy do ligi — w przeciwieństwie do pucharu NIE startują automatycznie
// po osiągnięciu limitu graczy (liga jest otwarta dla dowolnej liczby chętnych)
// — admin startuje ją ręcznie przyciskiem, kiedy uzna że zapisy się zamykają.
export async function signUpForLeague(tournamentId, uid, name, avatarUrl = null) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Liga nie istnieje.");
    const data = snap.data();
    if (data.status !== "signup") throw new Error("Zapisy do tej ligi są już zamknięte.");
    if (data.signups.some((p) => p.uid === uid)) return;
    tx.update(ref, { signups: [...data.signups, { uid, name, avatarUrl: avatarUrl || null }] });
  });
}

// Ręczny start ligi przez admina — ustala CAŁY terminarz od razu (kto z kim
// w której kolejce), ale buduje (z playlistą) tylko pierwszą kolejkę,
// dokładnie jak w pucharze — kolejne kolejki dobudowują się dopiero gdy
// poprzednia się zamknie.
export async function startLeagueManually(tournamentId, pool) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Liga nie istnieje.");
    const data = snap.data();
    if (data.status !== "signup") throw new Error("Ta liga już wystartowała.");
    if (data.signups.length < 3) throw new Error("Potrzeba minimum 3 zapisanych graczy.");
    const schedule = buildRoundRobinPairings(data.signups.map((p) => p.uid));
    const round1 = buildLeagueRoundMatches(schedule[0], data.signups, pool, 1);
    tx.update(ref, { status: "active", pairingSchedule: schedule, rounds: [round1], startedAt: Date.now() });
  });
}

// Zapis wyniku meczu ligowego — analogiczne do recordTournamentMatchResult,
// ale z prawdziwym remisem (resolveLeagueMatchOutcome) zamiast rozstrzygania
// szybkością, i z zapisem PEŁNEGO przebiegu (playedCards) do późniejszego
// podglądu szczegółów meczu.
export async function recordLeagueMatchResult(tournamentId, roundNumber, matchId, uid, score, timeMs, playedCards = []) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const rounds = data.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
    const round = rounds.find((r) => r.roundNumber === roundNumber);
    if (!round) return;
    const match = round.matches.find((m) => m.matchId === matchId);
    if (!match || match.outcome) return;

    const result = { score, timeMs, playedAt: Date.now(), playedCards };
    if (match.player1.uid === uid && !match.player1Result) match.player1Result = result;
    else if (match.player2?.uid === uid && !match.player2Result) match.player2Result = result;
    else return;

    if (match.player1Result && match.player2Result) {
      match.outcome = resolveLeagueMatchOutcome(match);
    }
    tx.update(ref, { rounds });
  });
}

// Stan ligowy konkretnego gracza — czy zapisany, jaki ma aktualny mecz
// (jeśli jakiś czeka na rozegranie w bieżącej kolejce), i tabela (gdy liga
// już wystartowała). Używane wspólnie przez huby mobile/desktop.
export function getLeagueUserState(league, uid, now = Date.now()) {
  if (!league || !uid) return { signedUp: false, match: null, standings: [] };
  const signedUp = league.signups.some((p) => p.uid === uid);
  let match = null;
  if (league.status === "active" && league.rounds.length > 0) {
    const currentRound = league.rounds[league.rounds.length - 1];
    const myMatch = currentRound.matches.find((m) => (m.player1?.uid === uid || m.player2?.uid === uid) && !m.outcome);
    if (myMatch) {
      const iAmP1 = myMatch.player1?.uid === uid;
      const myResult = iAmP1 ? myMatch.player1Result : myMatch.player2Result;
      const opponent = iAmP1 ? myMatch.player2 : myMatch.player1;
      match = { ...myMatch, roundNumber: currentRound.roundNumber, opponent, myResult, waitingForOpponent: !!myResult };
    }
  }
  const standings = league.status !== "signup" ? computeLeagueStandings(league.rounds, league.signups) : [];
  return { signedUp, match, standings };
}

// Leniwe sprawdzanie postępu ligi (wywoływane przy otwarciu huba, jak
// w pucharze) — jeśli termin bieżącej kolejki minął, zamyka nierozegrane
// mecze (walkower/podwójny walkower) i dobudowuje kolejną kolejkę z góry
// ustalonego terminarza, albo kończy ligę jeśli to była ostatnia.
export async function checkAndAdvanceLeague(tournamentId, pool) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "active") return;

    const rounds = data.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
    const currentRound = rounds[rounds.length - 1];
    const now = Date.now();

    currentRound.matches.forEach((match) => {
      if (match.outcome || !match.player2 || now < match.deadline) return;
      match.outcome = resolveLeagueMatchOutcome(match); // brakujące wyniki -> walkower/podwójny walkower
    });

    const roundDone = currentRound.matches.every((m) => m.outcome);
    if (!roundDone) {
      tx.update(ref, { rounds });
      return;
    }

    const nextRoundIndex = rounds.length;
    if (nextRoundIndex >= data.pairingSchedule.length) {
      const standings = computeLeagueStandings(rounds, data.signups);
      tx.update(ref, { rounds, status: "completed", standings, completedAt: Date.now() });
    } else {
      const nextRound = buildLeagueRoundMatches(data.pairingSchedule[nextRoundIndex], data.signups, pool, nextRoundIndex + 1);
      tx.update(ref, { rounds: [...rounds, nextRound] });
    }
  });
}
