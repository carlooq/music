import { doc, runTransaction, increment } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { effectiveRarity } from "./cards.js";

// Segmenty koła nagrody dnia. Kolejność ma znaczenie tylko wizualnie (rysowanie
// koła) — szanse (weight) są celowo NIEwidoczne dla użytkownika, appka nigdzie
// nie pokazuje tych liczb.
export const DAILY_REWARD_SEGMENTS = [
  { id: "hc25", type: "hitcoin", amount: 25, label: "25 HITCOIN", weight: 26, color: "#4fd6ff" },
  { id: "xp50", type: "xp", amount: 50, label: "50 XP", weight: 20, color: "#a56bff" },
  { id: "hc35", type: "hitcoin", amount: 35, label: "35 HITCOIN", weight: 16, color: "#ff5fc9" },
  { id: "doublexp", type: "doubleXp", label: "2× XP", sublabel: "następna gra", weight: 12, color: "#f5c451" },
  { id: "xp100", type: "xp", amount: 100, label: "100 XP", weight: 10, color: "#4fe0c0" },
  { id: "hc50", type: "hitcoin", amount: 50, label: "50 HITCOIN", weight: 7, color: "#4fd6ff" },
  { id: "xp200", type: "xp", amount: 200, label: "200 XP", weight: 4, color: "#a56bff" },
  { id: "goldcard", type: "card", rarity: "zlota", label: "Złota Płyta", weight: 2.5, color: "#ffb020" },
  { id: "hc100", type: "hitcoin", amount: 100, label: "100 HITCOIN", weight: 2, color: "#ff5fc9" },
  { id: "hc500", type: "hitcoin", amount: 500, label: "500 HITCOIN!", weight: 0.5, color: "#ff3868" },
];

export function pickDailyRewardSegment() {
  const total = DAILY_REWARD_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const seg of DAILY_REWARD_SEGMENTS) {
    if (r < seg.weight) return seg;
    r -= seg.weight;
  }
  return DAILY_REWARD_SEGMENTS[0];
}

// Losuje nagrodę PO STRONIE KLIENTA (segment), ale samo przyznanie i znacznik
// "odebrano dzisiaj" idą przez transakcję Firestore — ten sam wzorzec co stara
// claimDailyHitcoin, więc nie da się odebrać dwa razy nawet z dwóch urządzeń.
// songPool: potrzebny tylko dla nagrody typu "card" (żeby wylosować konkretny
// utwór danej rzadkości) — jeśli null/pusty i akurat wypadnie karta, cicho
// zamieniamy na najbliższy odpowiednik w HITCOIN (nigdy nie zawodzi całkiem).
export async function claimDailyWheelReward(uid, dayKey, songPool) {
  const segment = pickDailyRewardSegment();
  const ref = doc(db, "userStats", uid);
  let claimed = false;

  if (segment.type === "card") {
    const matches = (songPool || []).filter((s) => !s.isDiamond && effectiveRarity(s) === segment.rarity);
    if (matches.length === 0) {
      // biblioteka jeszcze nie doładowana / brak utworów tej rzadkości — nie
      // blokujemy gracza, dajemy 50 HITCOIN jako bezpieczny odpowiednik.
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.lastDailyHitcoinDate === dayKey) return;
        claimed = true;
        tx.update(ref, { hitcoin: increment(50), lastDailyHitcoinDate: dayKey });
      });
      return claimed ? { id: "hc50-fallback", type: "hitcoin", amount: 50, label: "50 HITCOIN" } : null;
    }
    const song = matches[Math.floor(Math.random() * matches.length)];
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (data.lastDailyHitcoinDate === dayKey) return;
      claimed = true;
      const wasOwned = !!data.cardCollection?.[song.id];
      const updates = { [`cardCollection.${song.id}`]: increment(1), lastDailyHitcoinDate: dayKey };
      if (!wasOwned) updates[`cardsByRarity.${segment.rarity}`] = increment(1);
      tx.update(ref, updates);
    });
    return claimed ? { ...segment, song } : null;
  }

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data();
    if (data.lastDailyHitcoinDate === dayKey) return;
    claimed = true;
    const updates = { lastDailyHitcoinDate: dayKey };
    if (segment.type === "hitcoin") updates.hitcoin = increment(segment.amount);
    else if (segment.type === "xp") updates.xp = increment(segment.amount);
    else if (segment.type === "doubleXp") updates.doubleXpNextGame = true;
    tx.update(ref, updates);
  });
  return claimed ? segment : null;
}
