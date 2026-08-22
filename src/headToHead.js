import { doc, runTransaction, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "headToHead";

function pairKeyFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

// Wywoływane raz na koniec czystej gry 1v1 (dokładnie 2 zalogowanych graczy,
// bez trybu Trening). Zabezpieczone transakcją ze znacznikiem gry, żeby
// niezależnie od tego, ilu klientów spróbuje to zrobić naraz, zapisało się
// tylko raz na jedną, realnie rozegraną grę.
export async function updateHeadToHead(room) {
  if (!room || room.practiceMode) return;
  const authedPlayers = (room.players || []).filter((p) => p.authed);
  if (room.players.length !== 2 || authedPlayers.length !== 2) return;

  const [pA, pB] = [...authedPlayers].sort((a, b) => a.id.localeCompare(b.id));
  const marker = room.expireAt && typeof room.expireAt.toMillis === "function" ? room.expireAt.toMillis() : null;
  if (!marker) return;

  const ref = doc(db, COLLECTION, pairKeyFor(pA.id, pB.id));

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists() ? snap.data() : null;
    if (prev?.lastProcessedMarker === marker) return; // już przetworzone przez drugiego klienta

    const winnerId = room.winnerIds?.length === 1 ? room.winnerIds[0] : null; // remis = nikt nie dostaje punktu

    const statsFor = (uid) => {
      const cards = (room.playedCards || []).filter((c) => c.playerId === uid && !c.bought);
      const placementCorrect = cards.filter((c) => c.correct).length;
      const guessCards = cards.filter((c) => c.guessedCorrect === true || c.guessedCorrect === false);
      const guessesCorrect = guessCards.filter((c) => c.guessedCorrect === true).length;
      const times = room.decisionTimes?.[uid] || [];
      const decisionTimeSum = times.reduce((a, b) => a + b, 0);
      return {
        placementTotal: cards.length,
        placementCorrect,
        guessesAttempted: guessCards.length,
        guessesCorrect,
        decisionTimeSum,
        decisionCount: times.length,
      };
    };
    const sA = statsFor(pA.id);
    const sB = statsFor(pB.id);

    const add = (field, uid, amount) => ((prev?.[field]?.[uid] || 0) + amount);

    const updated = {
      uids: [pA.id, pB.id],
      names: { ...(prev?.names || {}), [pA.id]: pA.name, [pB.id]: pB.name },
      gamesPlayed: (prev?.gamesPlayed || 0) + 1,
      wins: {
        [pA.id]: add("wins", pA.id, winnerId === pA.id ? 1 : 0),
        [pB.id]: add("wins", pB.id, winnerId === pB.id ? 1 : 0),
      },
      placementCorrect: { [pA.id]: add("placementCorrect", pA.id, sA.placementCorrect), [pB.id]: add("placementCorrect", pB.id, sB.placementCorrect) },
      placementTotal: { [pA.id]: add("placementTotal", pA.id, sA.placementTotal), [pB.id]: add("placementTotal", pB.id, sB.placementTotal) },
      guessesCorrect: { [pA.id]: add("guessesCorrect", pA.id, sA.guessesCorrect), [pB.id]: add("guessesCorrect", pB.id, sB.guessesCorrect) },
      guessesAttempted: { [pA.id]: add("guessesAttempted", pA.id, sA.guessesAttempted), [pB.id]: add("guessesAttempted", pB.id, sB.guessesAttempted) },
      decisionTimeSumMs: { [pA.id]: add("decisionTimeSumMs", pA.id, sA.decisionTimeSum), [pB.id]: add("decisionTimeSumMs", pB.id, sB.decisionTimeSum) },
      decisionCount: { [pA.id]: add("decisionCount", pA.id, sA.decisionCount), [pB.id]: add("decisionCount", pB.id, sB.decisionCount) },
      lastProcessedMarker: marker,
    };
    tx.set(ref, updated);
  });
}

// Zwraca listę wszystkich par (pojedynków), w których brał udział dany uid.
export async function fetchHeadToHeadOpponents(uid) {
  const q = query(collection(db, COLLECTION), where("uids", "array-contains", uid));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}
