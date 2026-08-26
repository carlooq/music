import { doc, getDoc, updateDoc, increment, runTransaction } from "firebase/firestore";
import { db } from "./firebase-config.js";

// --- HITCOIN — zarabianie ---

export async function awardHitcoin(uid, amount) {
  if (!amount) return;
  await updateDoc(doc(db, "userStats", uid), { hitcoin: increment(amount) });
}

// Zwycięstwo skalowane liczbą graczy — dokładnie ten sam wzorzec co przy XP.
export function computeWinHitcoin(playerCount) {
  return Math.max(50, (playerCount - 1) * 50);
}
export function computeSecondPlaceHitcoin(playerCount) {
  return Math.round(computeWinHitcoin(playerCount) / 2);
}
export function computeThirdPlaceHitcoin(playerCount) {
  return Math.round(computeWinHitcoin(playerCount) / 4);
}

// Codzienna darmowa nagroda — zawsze stałe +25, bez licznika serii.
const DAILY_HITCOIN_AMOUNT = 25;
export async function claimDailyHitcoin(uid, dayKey) {
  const ref = doc(db, "userStats", uid);
  let claimed = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (data.lastDailyHitcoinDate === dayKey) return; // już odebrane dzisiaj
    claimed = true;
    tx.update(ref, { hitcoin: increment(DAILY_HITCOIN_AMOUNT), lastDailyHitcoinDate: dayKey });
  });
  return claimed ? DAILY_HITCOIN_AMOUNT : 0;
}

// --- Karty — losowanie i rzadkość ---

export function effectiveRarity(song) {
  return song.isDiamond ? "diamentowa" : song.rarity || "winyl";
}

// Losowanie karty po KAŻDEJ rozgrywce (wygranej i przegranej) — NIGDY nie
// może dać Diamentu, wyłącznie 4 pozostałe poziomy. Duplikat = licznik rośnie.
export async function drawCardAfterGame(uid, songPool) {
  const eligible = songPool.filter((s) => !s.isDiamond);
  if (eligible.length === 0) return null;
  const song = eligible[Math.floor(Math.random() * eligible.length)];

  const ref = doc(db, "userStats", uid);
  const snap = await getDoc(ref);
  const wasOwned = !!(snap.exists() && snap.data().cardCollection?.[song.id]);
  const updates = { [`cardCollection.${song.id}`]: increment(1) };
  if (!wasOwned) updates[`cardsByRarity.${effectiveRarity(song)}`] = increment(1);
  await updateDoc(ref, updates);
  return { song, isDuplicate: wasOwned };
}

// --- Paczki ---

export const PACKS = {
  50: { price: 50, cards: 3, diamondChance: 0.005 },
  75: { price: 75, cards: 5, diamondChance: 0.01 },
  100: { price: 100, cards: 6, diamondChance: 0.02 },
};

const NON_DIAMOND_WEIGHTS = [
  ["winyl", 56],
  ["srebrna", 26],
  ["zlota", 12],
  ["platynowa", 6],
];

function rollPackTier(diamondChance) {
  if (Math.random() < diamondChance) return "diamentowa";
  const total = NON_DIAMOND_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of NON_DIAMOND_WEIGHTS) {
    if (r < w) return key;
    r -= w;
  }
  return NON_DIAMOND_WEIGHTS[0][0];
}

function pickSongOfTier(pool, tier) {
  const matches = tier === "diamentowa" ? pool.filter((s) => s.isDiamond) : pool.filter((s) => s.rarity === tier && !s.isDiamond);
  if (matches.length === 0) return null;
  return matches[Math.floor(Math.random() * matches.length)];
}

// Otwiera paczkę: pobiera HITCOIN (transakcja z walidacją salda), losuje
// karty, zapisuje je do kolekcji. Zwraca listę wylosowanych kart (z
// oznaczeniem, czy to duplikat na podstawie stanu SPRZED otwarcia).
export async function openPack(uid, packKey, songPool) {
  const config = PACKS[packKey];
  if (!config) throw new Error("Nieznana paczka.");
  const ref = doc(db, "userStats", uid);

  const beforeSnap = await getDoc(ref);
  const ownedBefore = beforeSnap.exists() ? beforeSnap.data().cardCollection || {} : {};

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if ((data.hitcoin || 0) < config.price) throw new Error("Za mało HITCOIN.");
    tx.update(ref, { hitcoin: increment(-config.price) });
  });

  const drawn = [];
  for (let i = 0; i < config.cards; i++) {
    const tier = rollPackTier(config.diamondChance);
    const song = pickSongOfTier(songPool, tier);
    if (song) drawn.push(song);
  }

  const counts = {};
  drawn.forEach((s) => {
    counts[s.id] = (counts[s.id] || 0) + 1;
  });
  const updates = {};
  Object.entries(counts).forEach(([songId, n]) => {
    updates[`cardCollection.${songId}`] = increment(n);
  });
  const newRarityCounts = {};
  const countedAsNew = new Set();
  drawn.forEach((song) => {
    if (!ownedBefore[song.id] && !countedAsNew.has(song.id)) {
      countedAsNew.add(song.id);
      const tier = effectiveRarity(song);
      newRarityCounts[tier] = (newRarityCounts[tier] || 0) + 1;
    }
  });
  Object.entries(newRarityCounts).forEach(([tier, n]) => {
    updates[`cardsByRarity.${tier}`] = increment(n);
  });
  if (Object.keys(updates).length > 0) await updateDoc(ref, updates);

  return drawn.map((song) => ({ song, isDuplicate: !!ownedBefore[song.id] }));
}

// --- Duplikaty — sprzedaż ---

export const SELL_PRICES = { winyl: 7, srebrna: 12, zlota: 20, platynowa: 35, diamentowa: 70 };

export async function sellDuplicateCard(uid, songId, rarity) {
  const ref = doc(db, "userStats", uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const owned = data.cardCollection?.[songId] || 0;
    if (owned < 2) throw new Error("To nie jest duplikat.");
    tx.update(ref, {
      [`cardCollection.${songId}`]: increment(-1),
      hitcoin: increment(SELL_PRICES[rarity] || 0),
      duplicatesSold: increment(1),
    });
  });
}

// Sprzedaje WSZYSTKIE duplikaty naraz (zostawia dokładnie 1 sztukę każdej
// posiadanej karty). songPoolById: Map songId -> obiekt piosenki (do rarity).
export async function sellAllDuplicates(uid, songPoolById) {
  const ref = doc(db, "userStats", uid);
  let totalEarned = 0;
  let totalSold = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    const coll = data.cardCollection || {};
    const updates = {};
    Object.entries(coll).forEach(([songId, count]) => {
      if (count > 1) {
        const extra = count - 1;
        const song = songPoolById.get(songId);
        const rarity = song ? effectiveRarity(song) : "winyl";
        totalEarned += extra * (SELL_PRICES[rarity] || 0);
        totalSold += extra;
        updates[`cardCollection.${songId}`] = 1;
      }
    });
    if (Object.keys(updates).length > 0) {
      updates.hitcoin = increment(totalEarned);
      updates.duplicatesSold = increment(totalSold);
      tx.update(ref, updates);
    }
  });
  return { totalEarned, totalSold };
}
