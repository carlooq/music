// Zapis postępu kampanii i wypłata nagród. Postęp i nagroda zapisują się
// W JEDNEJ transakcji (campaignProgress + userStats), więc reload, drugie
// urządzenie ani ponowne podejście nie wypłacą nagrody drugi raz.
import { doc, getDoc, runTransaction, collection, query, orderBy, limit, getDocs, increment } from "firebase/firestore";
import { db } from "../firebase-config.js";
import { CAMPAIGN } from "./campaignConfig.js";
import { applyStageResult, emptyProgress } from "./campaignEngine.js";

const PROGRESS_COLLECTION = "campaignProgress";

export async function getCampaignProgress(uid) {
  const snap = await getDoc(doc(db, PROGRESS_COLLECTION, uid));
  return snap.exists() ? snap.data() : emptyProgress();
}

// Zwraca { progress, result, rewards } — result.gainedStars/rewards pokazujemy na ekranie wyniku.
export async function submitStageResult(uid, chapterId, stageId, rawResult) {
  const progressRef = doc(db, PROGRESS_COLLECTION, uid);
  const statsRef = doc(db, "userStats", uid);
  let outcome = null;
  await runTransaction(db, async (tx) => {
    const [progressSnap, statsSnap] = await Promise.all([tx.get(progressRef), tx.get(statsRef)]);
    const current = progressSnap.exists() ? progressSnap.data() : emptyProgress();
    outcome = applyStageResult(CAMPAIGN, current, chapterId, stageId, rawResult);
    tx.set(progressRef, { ...outcome.progress, updatedAt: Date.now() });
    if (statsSnap.exists() && (outcome.rewards.xp || outcome.rewards.hitcoin)) {
      tx.update(statsRef, {
        ...(outcome.rewards.xp ? { xp: increment(outcome.rewards.xp) } : {}),
        ...(outcome.rewards.hitcoin ? { hitcoin: increment(outcome.rewards.hitcoin) } : {}),
      });
    }
  });
  return outcome;
}

// Ranking kampanii: wyłącznie łączna liczba zdobytych gwiazdek.
export async function fetchCampaignLeaderboard(count = 20) {
  const q = query(collection(db, PROGRESS_COLLECTION), orderBy("totalStars", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ uid: d.id, totalStars: d.data().totalStars || 0 }))
    .sort((a, b) => b.totalStars - a.totalStars);
}
