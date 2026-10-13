import { collection, doc, getDocs, increment, limit, orderBy, query, runTransaction } from "firebase/firestore";
import { db } from "../firebase-config.js";

const HIT_MATCH_RELEASE_VERSION = "public-v1-2026-10-13";

function emptyProgress() {
  return { levels: {}, totalStars: 0, completedLevels: 0, updatedAt: 0 };
}

// Jednorazowa migracja premiery: czyści wyłącznie przedpremierowy progres HIT MATCH.
// XP i HITCOIN pozostają nietknięte. Po zapisaniu wersji release reset nie wykona
// się ponownie na kolejnych wejściach.
export async function getHitMatchProgress(uid) {
  if (!uid) return emptyProgress();
  const statsRef = doc(db, "userStats", uid);
  let outcome = emptyProgress();

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef);
    const data = snap.exists() ? snap.data() : {};

    if (data.hitMatchReleaseVersion !== HIT_MATCH_RELEASE_VERSION) {
      const progress = { ...emptyProgress(), updatedAt: Date.now() };
      const releaseFields = {
        hitMatchProgress: progress,
        hitMatchSummary: { totalStars: 0, completedLevels: 0 },
        hitMatchReleaseVersion: HIT_MATCH_RELEASE_VERSION,
      };
      if (snap.exists()) tx.update(statsRef, releaseFields);
      else tx.set(statsRef, releaseFields);
      outcome = progress;
      return;
    }

    const stored = data.hitMatchProgress;
    outcome = stored && typeof stored === "object"
      ? { ...emptyProgress(), ...stored, levels: stored.levels || {} }
      : emptyProgress();
  });

  return outcome;
}

export async function submitHitMatchLevelResult(uid, level, { score = 0, stars = 0 } = {}) {
  if (!uid || !level?.id) throw new Error("Brak gracza lub konfiguracji poziomu.");
  const statsRef = doc(db, "userStats", uid);
  let outcome = null;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(statsRef);
    const data = snap.exists() ? snap.data() : {};
    const current = data.hitMatchProgress && typeof data.hitMatchProgress === "object"
      ? data.hitMatchProgress
      : emptyProgress();
    const levels = { ...(current.levels || {}) };
    const previous = levels[level.id] || {};

    const previousStars = Math.max(0, Math.min(3, Number(previous.stars || 0)));
    const earnedStars = Math.max(0, Math.min(3, Number(stars || 0)));
    const bestStars = Math.max(previousStars, earnedStars);
    const gainedStars = Math.max(0, bestStars - previousStars);
    const bestScore = Math.max(Number(previous.bestScore || 0), Number(score || 0));

    levels[level.id] = {
      ...previous,
      levelId: level.id,
      levelNumber: level.number,
      stars: bestStars,
      bestScore,
      completed: bestStars > 0 || !!previous.completed,
      updatedAt: Date.now(),
    };

    const values = Object.values(levels);
    const totalStars = values.reduce((sum, entry) => sum + Math.max(0, Math.min(3, Number(entry?.stars || 0))), 0);
    const completedLevels = values.filter((entry) => entry?.completed).length;
    const rewardPerStar = level.rewardPerStar || { xp: 20, hitcoin: 10 };
    const xp = gainedStars * Number(rewardPerStar.xp || 0);
    const hitcoin = gainedStars * Number(rewardPerStar.hitcoin || 0);
    const progress = { levels, totalStars, completedLevels, updatedAt: Date.now() };

    tx.set(statsRef, {
      hitMatchProgress: progress,
      hitMatchSummary: { totalStars, completedLevels },
      hitMatchReleaseVersion: HIT_MATCH_RELEASE_VERSION,
      ...(xp ? { xp: increment(xp) } : {}),
      ...(hitcoin ? { hitcoin: increment(hitcoin) } : {}),
    }, { merge: true });

    outcome = { progress, previousStars, stars: bestStars, gainedStars, bestScore, xp, hitcoin };
  });

  return outcome;
}

export async function fetchHitMatchStarsLeaderboard(count = 20) {
  const q = query(collection(db, "userStats"), orderBy("hitMatchSummary.totalStars", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs
    .map((entry) => ({
      uid: entry.id,
      name: entry.data()?.username || "Gracz",
      stars: Number(entry.data()?.hitMatchSummary?.totalStars || 0),
      completedLevels: Number(entry.data()?.hitMatchSummary?.completedLevels || 0),
    }))
    .filter((entry) => entry.stars > 0);
}

export async function fetchHitMatchLevelLeaderboard(levelId, count = 20) {
  if (!levelId) return [];
  const field = `hitMatchProgress.levels.${levelId}.bestScore`;
  const q = query(collection(db, "userStats"), orderBy(field, "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs
    .map((entry) => ({
      uid: entry.id,
      name: entry.data()?.username || "Gracz",
      score: Number(entry.data()?.hitMatchProgress?.levels?.[levelId]?.bestScore || 0),
      stars: Number(entry.data()?.hitMatchProgress?.levels?.[levelId]?.stars || 0),
    }))
    .filter((entry) => entry.score > 0);
}
