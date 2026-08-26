import { doc, getDoc, setDoc, updateDoc, increment, runTransaction, collection, query, where, orderBy, limit, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "tournaments";
const SCORED_COUNT = 10; // tyle kart faktycznie się ocenia w każdym meczu — pierwsza karta "wchodzi za darmo" (bez punktu odniesienia), dokładnie jak w Playliście dnia
const MATCH_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24h na rozegranie swojej tury

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

export async function fetchTournament(tournamentId) {
  const snap = await getDoc(doc(db, COLLECTION, tournamentId));
  return snap.exists() ? snap.data() : null;
}

// --- Zapisy i start drabinki ---

export async function signUpForTournament(tournamentId, uid, name, pool) {
  const ref = doc(db, COLLECTION, tournamentId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Turniej nie istnieje.");
    const data = snap.data();
    if (data.status !== "signup") throw new Error("Zapisy do tego turnieju są już zamknięte.");
    if (data.signups.some((p) => p.uid === uid)) return; // już zapisany, nic nie rób
    const newSignups = [...data.signups, { uid, name }];
    if (newSignups.length >= data.maxPlayers) {
      const round = buildRound(newSignups, pool, 1);
      tx.update(ref, { signups: newSignups, status: "active", rounds: [round] });
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

// --- Rozliczenie XP na koniec turnieju (leniwe, zabezpieczone przez settledAt) ---

export async function settleTournamentXpIfNeeded(tournamentId) {
  const ref = doc(db, COLLECTION, tournamentId);
  let toSettle = null;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status !== "completed" || data.settledAt) return;
    tx.update(ref, { settledAt: Date.now() });
    toSettle = data;
  });
  if (!toSettle) return;

  const pot = (toSettle.signups.length - 1) * toSettle.entryFee;
  for (const p of toSettle.signups) {
    const statsRef = doc(db, "userStats", p.uid);
    if (p.uid === toSettle.winnerUid) {
      await updateDoc(statsRef, { xp: increment(pot) }).catch(() => {});
    } else {
      try {
        const statsSnap = await getDoc(statsRef);
        const currentXp = statsSnap.exists() ? statsSnap.data().xp || 0 : 0;
        await updateDoc(statsRef, { xp: Math.max(0, currentXp - toSettle.entryFee) });
      } catch (e) {
        // ciche niepowodzenie
      }
    }
  }
}

export { pickMatchPlaylist };
