export const HIT_MATCH_REWARD_PER_STAR = Object.freeze({ xp: 20, hitcoin: 10 });

export const HIT_MATCH_LEVELS = Object.freeze([
  {
    id: "level_1",
    number: 1,
    title: "Pierwszy Drop",
    subtitle: "Rozgrzewka",
    moves: 25,
    goals: { vinyl: 12, microphone: 10 },
    starScoreThresholds: { 2: 18000, 3: 25000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_2",
    number: 2,
    title: "Kasetowa Fala",
    subtitle: "Retro mix",
    moves: 25,
    goals: { cassette: 18, note: 10 },
    starScoreThresholds: { 2: 18000, 3: 26000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_3",
    number: 3,
    title: "Słuchawkowy Set",
    subtitle: "Pełne brzmienie",
    moves: 25,
    goals: { headphones: 18, speaker: 12 },
    starScoreThresholds: { 2: 19000, 3: 27000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_4",
    number: 4,
    title: "Neonowy Mix",
    subtitle: "Trzy symbole",
    moves: 26,
    goals: { vinyl: 8, microphone: 8, cassette: 8 },
    starScoreThresholds: { 2: 21000, 3: 30000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_5",
    number: 5,
    title: "Głośniej!",
    subtitle: "Podkręć scenę",
    moves: 24,
    goals: { speaker: 16, note: 16 },
    starScoreThresholds: { 2: 20000, 3: 28000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_6",
    number: 6,
    title: "Kolorowa Scena",
    subtitle: "Potrójny cel",
    moves: 26,
    goals: { headphones: 8, cassette: 8, speaker: 8 },
    starScoreThresholds: { 2: 22000, 3: 31000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_7",
    number: 7,
    title: "Szybki Set",
    subtitle: "Mniej ruchów",
    moves: 20,
    goals: { vinyl: 12, note: 12 },
    starScoreThresholds: { 2: 18000, 3: 26000 },
    endgameMoveBonus: 800,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_8",
    number: 8,
    title: "Pełne Pasmo",
    subtitle: "Wszystko gra",
    moves: 28,
    goals: { vinyl: 5, microphone: 5, headphones: 5, cassette: 5, speaker: 5, note: 5 },
    starScoreThresholds: { 2: 24000, 3: 34000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_9",
    number: 9,
    title: "Punkt Zapalny",
    subtitle: "Graj na wynik",
    moves: 22,
    goals: {},
    scoreGoal: 14000,
    starScoreThresholds: { 2: 20000, 3: 28000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_10",
    number: 10,
    title: "Nocny Mix",
    subtitle: "Cel + wynik",
    moves: 26,
    goals: { microphone: 10, headphones: 10, speaker: 10 },
    scoreGoal: 12000,
    starScoreThresholds: { 2: 24000, 3: 34000 },
    endgameMoveBonus: 750,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
  {
    id: "level_11",
    number: 11,
    title: "Wielki Drop",
    subtitle: "Finał pierwszej serii",
    moves: 32,
    goals: { vinyl: 7, microphone: 7, headphones: 7, cassette: 7, speaker: 7, note: 7 },
    scoreGoal: 20000,
    starScoreThresholds: { 2: 32000, 3: 44000 },
    endgameMoveBonus: 800,
    rewardPerStar: HIT_MATCH_REWARD_PER_STAR,
  },
]);

export const HIT_MATCH_TOTAL_STARS = HIT_MATCH_LEVELS.length * 3;
export const HIT_MATCH_LEVEL_1 = HIT_MATCH_LEVELS[0];

export function getHitMatchLevel(levelId) {
  return HIT_MATCH_LEVELS.find((level) => level.id === levelId) || HIT_MATCH_LEVEL_1;
}

export function isHitMatchLevelCompleted(level, stats = {}) {
  const collected = stats.collected || {};
  const collectOk = Object.entries(level?.goals || {}).every(([type, target]) => Number(collected[type] || 0) >= Number(target || 0));
  const scoreOk = !level?.scoreGoal || Number(stats.score || 0) >= Number(level.scoreGoal || 0);
  return collectOk && scoreOk;
}

export function starsForHitMatchLevel(level, score, completed) {
  if (!completed) return 0;
  let stars = 1;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[2] || Infinity)) stars = 2;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[3] || Infinity)) stars = 3;
  return stars;
}
