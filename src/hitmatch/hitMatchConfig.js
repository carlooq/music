export const HIT_MATCH_REWARD_PER_STAR = Object.freeze({ xp: 20, hitcoin: 15 });

export const HIT_MATCH_LEVELS = Object.freeze([
  {
    id: "level_1",
    number: 1,
    title: "Pierwszy Drop",
    moves: 25,
    goals: { vinyl: 12, microphone: 10 },
    // 1★ = samo ukończenie poziomu. 2★ i 3★ mają progi ustawiane osobno
    // dla każdego levelu, bo różne cele/przeszkody nie będą porównywalne.
    starScoreThresholds: { 2: 18000, 3: 25000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
]);

export const HIT_MATCH_LEVEL_1 = HIT_MATCH_LEVELS[0];

export function starsForHitMatchLevel(level, score, completed) {
  if (!completed) return 0;
  let stars = 1;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[2] || Infinity)) stars = 2;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[3] || Infinity)) stars = 3;
  return stars;
}
