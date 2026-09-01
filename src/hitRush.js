import { doc, getDoc, setDoc, updateDoc, increment, runTransaction, collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { currentDayKey, currentWeekKey } from "./stats.js";

// ============================================================
// BALANS STARTOWY — wszystko poniżej to PUNKT WYJŚCIA do balansowania
// po realnych testach, zgodnie z dokumentem projektowym. Stałe, nie
// rozrzucone po kodzie, żeby łatwo było je zmieniać.
// ============================================================
export const HIT_RUSH_CONFIG = {
  ROUND_SECONDS: 60,
  BASE_POINTS: 100,
  COMBO_MULTIPLIER: [
    { minCombo: 10, mult: 3 },
    { minCombo: 5, mult: 2 },
    { minCombo: 3, mult: 1.5 },
    { minCombo: 0, mult: 1 },
  ],
  TIME_BONUS_EVERY_COMBO: 10,
  TIME_BONUS_SECONDS: 5,
  DIFFICULTY_TIERS: [
    { name: "insane", minCombo: 15, minGap: 1, maxGap: 2 },
    { name: "expert", minCombo: 10, minGap: 2, maxGap: 4 },
    { name: "hard", minCombo: 6, minGap: 4, maxGap: 8 },
    { name: "normal", minCombo: 3, minGap: 8, maxGap: 15 },
    { name: "easy", minCombo: 0, minGap: 15, maxGap: 30 },
  ],
  // Progi rang PO WYNIKU PUNKTOWYM z jednego runu - zgadywane na start,
  // do skorygowania gdy zobaczymy realne wyniki graczy.
  RANKS: [
    { name: "diamond", minScore: 8000, xp: 80, hitcoin: 60 },
    { name: "platinum", minScore: 5000, xp: 55, hitcoin: 35 },
    { name: "gold", minScore: 3000, xp: 35, hitcoin: 20 },
    { name: "silver", minScore: 1500, xp: 20, hitcoin: 10 },
    { name: "bronze", minScore: 500, xp: 10, hitcoin: 5 },
  ],
  BASE_RUN_XP: 15, // XP za sam ukończony run, nawet poniżej progu Bronze
  // Malejąca skuteczność XP w ciągu dnia (reset o północy, jak reszta appki)
  DAILY_XP_MULTIPLIER: [
    { maxRuns: 3, mult: 1 },
    { maxRuns: 6, mult: 0.75 },
    { maxRuns: 10, mult: 0.5 },
    { maxRuns: Infinity, mult: 0.25 },
  ],
  DAILY_HITCOIN_POOL: 250, // twardy dzienny limit HITCOIN z tego trybu
  // Nagrody za miejsce w tygodniowym rankingu (tak jak w Playliście dnia) -
  // dzienny ranking istnieje tylko dla rywalizacji, BEZ nagród.
  WEEKLY_PLACE_HITCOIN: [200, 100, 75],
};

function difficultyForCombo(combo) {
  return HIT_RUSH_CONFIG.DIFFICULTY_TIERS.find((t) => combo >= t.minCombo) || HIT_RUSH_CONFIG.DIFFICULTY_TIERS[HIT_RUSH_CONFIG.DIFFICULTY_TIERS.length - 1];
}

function comboMultiplier(combo) {
  return HIT_RUSH_CONFIG.COMBO_MULTIPLIER.find((m) => combo >= m.minCombo)?.mult || 1;
}

function rankForScore(score) {
  return HIT_RUSH_CONFIG.RANKS.find((r) => score >= r.minScore) || null;
}

// Wybiera kolejny utwór względem karty referencyjnej, zgodnie z aktualną
// trudnością (zakres różnicy lat zależny od combo) - z falllbackiem na coraz
// szerszy zakres, gdyby w bazie zabrakło idealnie pasujących pozycji.
export function pickNextHitRushSong(pool, referenceYear, combo, usedIds) {
  const tier = difficultyForCombo(combo);
  const candidates = (gapMin, gapMax) =>
    pool.filter((s) => {
      if (usedIds.has(s.id)) return false;
      const gap = Math.abs(s.year - referenceYear);
      return gap >= gapMin && gap <= gapMax && s.year !== referenceYear;
    });

  let pickPool = candidates(tier.minGap, tier.maxGap);
  // Fallback: jeśli nic nie pasuje w idealnym zakresie (mała baza / wyczerpane
  // utwory), stopniowo poluzuj wymagania zamiast wywalić rundę błędem.
  if (pickPool.length === 0) pickPool = pool.filter((s) => !usedIds.has(s.id) && s.year !== referenceYear);
  if (pickPool.length === 0) return null;

  return pickPool[Math.floor(Math.random() * pickPool.length)];
}

export function computeHitRushPoints(combo) {
  return Math.round(HIT_RUSH_CONFIG.BASE_POINTS * comboMultiplier(combo));
}

export function checkHitRushTimeBonus(newCombo) {
  return newCombo > 0 && newCombo % HIT_RUSH_CONFIG.TIME_BONUS_EVERY_COMBO === 0 ? HIT_RUSH_CONFIG.TIME_BONUS_SECONDS : 0;
}

export function difficultyLabel(combo) {
  return difficultyForCombo(combo).name;
}

// ============================================================
// BACKEND — zapis wyniku, rekord osobisty, dzienny limit XP/HITCOIN,
// ten sam sprawdzony wzorzec transakcji co reszta appki (nagroda dnia,
// pojedynki 1v1) - żeby nie dało się tego łatwo oszukać z frontendu.
// ============================================================

export async function submitHitRushRun(uid, result) {
  // result: { score, correct, wrong, bestCombo, maxDifficulty }
  const dayKey = currentDayKey();
  const weekKey = currentWeekKey();
  const statsRef = doc(db, "userStats", uid);
  const dailyRef = doc(db, "hitRushDaily", `${uid}_${dayKey}`);
  const weeklyRef = doc(db, "hitRushWeekly", `${uid}_${weekKey}`);

  const rank = rankForScore(result.score);

  return runTransaction(db, async (tx) => {
    const [statsSnap, dailySnap, weeklySnap] = await Promise.all([tx.get(statsRef), tx.get(dailyRef), tx.get(weeklyRef)]);
    const stats = statsSnap.exists() ? statsSnap.data() : {};
    const daily = dailySnap.exists() ? dailySnap.data() : { runs: 0, hitcoinEarned: 0, dayKey };
    const weekly = weeklySnap.exists() ? weeklySnap.data() : { bestScore: 0, weekKey, name: stats.username || "Gracz" };

    const runsToday = (daily.dayKey === dayKey ? daily.runs : 0) + 1;
    const xpMult = HIT_RUSH_CONFIG.DAILY_XP_MULTIPLIER.find((m) => runsToday <= m.maxRuns)?.mult || 0.25;

    const prevBest = stats.hitRushBestScore || 0;
    const isNewBest = result.score > prevBest;

    let xpGain = Math.round((HIT_RUSH_CONFIG.BASE_RUN_XP + (rank?.xp || 0)) * xpMult);

    const hitcoinEarnedToday = daily.dayKey === dayKey ? daily.hitcoinEarned : 0;
    const remainingPool = Math.max(0, HIT_RUSH_CONFIG.DAILY_HITCOIN_POOL - hitcoinEarnedToday);
    const hitcoinGain = Math.min(rank?.hitcoin || 0, remainingPool);

    tx.set(statsRef, { xp: increment(xpGain), hitcoin: increment(hitcoinGain), hitRushBestScore: Math.max(prevBest, result.score), hitRushBestCombo: Math.max(stats.hitRushBestCombo || 0, result.bestCombo), hitRushRunsTotal: increment(1) }, { merge: true });
    const dailyBestBefore = daily.dayKey === dayKey ? daily.bestScore || 0 : 0;
    tx.set(dailyRef, { runs: runsToday, hitcoinEarned: hitcoinEarnedToday + hitcoinGain, dayKey, bestScore: Math.max(dailyBestBefore, result.score), uid, name: stats.username || "Gracz" });
    if (result.score > (weekly.weekKey === weekKey ? weekly.bestScore : 0)) {
      tx.set(weeklyRef, { bestScore: result.score, weekKey, uid, name: stats.username || weekly.name || "Gracz" });
    }

    return { xpGain, hitcoinGain, isNewBest, rank: rank?.name || null, runsToday, hitcoinPoolLeft: remainingPool - hitcoinGain };
  });
}

export async function fetchHitRushLeaderboard(period, count = 10) {
  // period: "daily" | "weekly" | "alltime"
  if (period === "alltime") {
    const q = query(collection(db, "userStats"), orderBy("hitRushBestScore", "desc"), limit(count));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ uid: d.id, name: d.data().username || "Gracz", score: d.data().hitRushBestScore || 0 }));
  }
  const key = period === "daily" ? currentDayKey() : currentWeekKey();
  const coll = period === "daily" ? "hitRushDaily" : "hitRushWeekly";
  const field = period === "daily" ? "bestScore" : "bestScore";
  const q = query(collection(db, coll), where(period === "daily" ? "dayKey" : "weekKey", "==", key), orderBy(field, "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.data().uid || d.id, name: d.data().name || "Gracz", score: d.data()[field] || 0 }));
}

// Nagrody tygodniowe (200/100/75 HITCOIN za 1./2./3. miejsce) - ten sam wzorzec
// co processWeeklyPlaylistRewardsIfNeeded w dailyPlaylist.js, wołany raz przy
// wejściu w ranking (bezpieczne, bo sprawdza znacznik "już rozliczone").
export async function processHitRushWeeklyRewardsIfNeeded() {
  const lastWeekDate = new Date();
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const prevWeekKey = currentWeekKey(lastWeekDate);
  const markerRef = doc(db, "hitRushWeeklySettled", prevWeekKey);
  const markerSnap = await getDoc(markerRef);
  if (markerSnap.exists()) return;

  const q = query(collection(db, "hitRushWeekly"), where("weekKey", "==", prevWeekKey), orderBy("bestScore", "desc"), limit(3));
  const snap = await getDocs(q);
  const top3 = snap.docs.map((d) => d.data());

  await setDoc(markerRef, { settledAt: Date.now(), winners: top3.map((w) => w.uid) });

  await Promise.all(
    top3.map((entry, i) => {
      const reward = HIT_RUSH_CONFIG.WEEKLY_PLACE_HITCOIN[i];
      if (!reward || !entry.uid) return Promise.resolve();
      return updateDoc(doc(db, "userStats", entry.uid), { hitcoin: increment(reward) }).catch(() => {});
    })
  );
}
