import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  where,
} from "firebase/firestore";
import { db } from "./firebase-config.js";

export const GAME_HISTORY_COLLECTION = "gameHistory";

function safeMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function average(values = []) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0;
  return Math.round(nums.reduce((sum, value) => sum + value, 0) / nums.length);
}

function buildStandings(room) {
  const players = Array.isArray(room.players) ? room.players : [];
  return [...players].sort((a, b) => {
    const cardsA = room.timelines?.[a.id]?.length || 0;
    const cardsB = room.timelines?.[b.id]?.length || 0;
    if (cardsB !== cardsA) return cardsB - cardsA;
    const tokensA = Number(room.tokens?.[a.id] || 0);
    const tokensB = Number(room.tokens?.[b.id] || 0);
    if (tokensB !== tokensA) return tokensB - tokensA;
    const guessesA = Number(room.gameGuesses?.[a.id] || 0);
    const guessesB = Number(room.gameGuesses?.[b.id] || 0);
    return guessesB - guessesA;
  });
}

export function gameHistoryDocumentId(roomId, room) {
  const created = safeMillis(room?.gameSessionStartedAt) || safeMillis(room?.createdAt) || Date.now();
  // Firestore bez orderBy zwraca dokumenty po __name__ rosnąco. Odwrócony
  // timestamp na początku ID sprawia więc, że najnowsze gry są pierwsze bez
  // dodatkowego indeksu złożonego.
  const reverseTimestamp = Math.max(0, 9999999999999 - created);
  return `${String(reverseTimestamp).padStart(13, "0")}_${String(roomId || "game")}`;
}

export function buildGameHistoryRecord(room, roomId, winnerIds = []) {
  const standings = buildStandings(room);
  const winnerSet = new Set(winnerIds || []);
  const playedCards = Array.isArray(room.playedCards) ? room.playedCards : [];

  const players = standings.map((player, index) => {
    const placements = playedCards.filter((card) => card.playerId === player.id && !card.bought);
    const correctPlacements = placements.filter((card) => card.correct).length;
    const decisions = room.decisionTimes?.[player.id] || [];
    return {
      id: player.id,
      uid: player.uid || null,
      name: player.name || "Gracz",
      avatarUrl: player.avatarUrl || null,
      position: index + 1,
      winner: winnerSet.has(player.id),
      cards: room.timelines?.[player.id]?.length || 0,
      tokens: Number(room.tokens?.[player.id] || 0),
      guessesCorrect: Number(room.gameGuesses?.[player.id] || 0),
      bestStreak: Number(room.gameBestStreaks?.[player.id] || 0),
      placementCorrect: correctPlacements,
      placementTotal: placements.length,
      avgDecisionMs: average(decisions),
    };
  });

  const playerUids = [...new Set(players.map((player) => player.uid).filter(Boolean))];
  const winnerUids = players.filter((player) => player.winner && player.uid).map((player) => player.uid);

  return {
    roomId,
    playerUids,
    winnerIds: [...winnerIds],
    winnerUids,
    playerCount: players.length,
    players,
    target: Number(room.target || 0),
    categories: Array.isArray(room.categories) ? room.categories : [],
    createdAtMs: safeMillis(room.gameSessionStartedAt) || safeMillis(room.createdAt) || Date.now(),
  };
}

// Pobieramy historię stronicowaną: najpierw 5, dopiero po rozwinięciu kolejne 10.
// Nie używamy dodatkowego orderBy: odwrócony timestamp w ID daje kolejność
// newest-first w naturalnym porządku dokumentów Firestore.
export async function fetchGameHistoryPage(uid, pageSize = 5, cursor = null) {
  if (!uid) return { games: [], cursor: null, hasMore: false };
  const constraints = [
    where("playerUids", "array-contains", uid),
    limit(pageSize),
  ];
  if (cursor) constraints.splice(1, 0, startAfter(cursor));
  const q = query(collection(db, GAME_HISTORY_COLLECTION), ...constraints);
  const snap = await getDocs(q);
  const docs = snap.docs;
  return {
    games: docs.map((item) => ({ id: item.id, ...item.data() })),
    cursor: docs.length ? docs[docs.length - 1] : cursor,
    hasMore: docs.length === pageSize,
  };
}
