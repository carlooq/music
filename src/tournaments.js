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
  const q = query(collection(db, COLLECTION), where("status", "in", ["signup", "active"]));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
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
