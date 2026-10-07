export const HIT_MATCH_REWARD_PER_STAR = Object.freeze({ xp: 20, hitcoin: 10 });

const stage1 = [
  { id:"level_1", number:1, title:"Pierwszy Drop", subtitle:"Rozgrzewka", moves:25, goals:{ vinyl:12, microphone:10 }, starScoreThresholds:{2:18000,3:25000}, endgameMoveBonus:750 },
  { id:"level_2", number:2, title:"Kasetowa Fala", subtitle:"Retro mix", moves:25, goals:{ cassette:18, note:10 }, starScoreThresholds:{2:18000,3:26000}, endgameMoveBonus:750 },
  { id:"level_3", number:3, title:"Słuchawkowy Set", subtitle:"Pełne brzmienie", moves:25, goals:{ headphones:18, speaker:12 }, starScoreThresholds:{2:19000,3:27000}, endgameMoveBonus:750 },
  { id:"level_4", number:4, title:"Neonowy Mix", subtitle:"Trzy symbole", moves:26, goals:{ vinyl:8, microphone:8, cassette:8 }, starScoreThresholds:{2:21000,3:30000}, endgameMoveBonus:750 },
  { id:"level_5", number:5, title:"Głośniej!", subtitle:"Podkręć scenę", moves:24, goals:{ speaker:16, note:16 }, starScoreThresholds:{2:20000,3:28000}, endgameMoveBonus:750 },
  { id:"level_6", number:6, title:"Kolorowa Scena", subtitle:"Potrójny cel", moves:26, goals:{ headphones:8, cassette:8, speaker:8 }, starScoreThresholds:{2:22000,3:31000}, endgameMoveBonus:750 },
  { id:"level_7", number:7, title:"Szybki Set", subtitle:"Mniej ruchów", moves:20, goals:{ vinyl:12, note:12 }, starScoreThresholds:{2:18000,3:26000}, endgameMoveBonus:800 },
  { id:"level_8", number:8, title:"Pełne Pasmo", subtitle:"Wszystko gra", moves:28, goals:{ vinyl:5, microphone:5, headphones:5, cassette:5, speaker:5, note:5 }, starScoreThresholds:{2:24000,3:34000}, endgameMoveBonus:750 },
  { id:"level_9", number:9, title:"Punkt Zapalny", subtitle:"Graj na wynik", moves:22, goals:{}, scoreGoal:14000, starScoreThresholds:{2:20000,3:28000}, endgameMoveBonus:750 },
  { id:"level_10", number:10, title:"Nocny Finał", subtitle:"Finał Neonowej Sceny", moves:27, goals:{ microphone:10, headphones:10, speaker:10 }, scoreGoal:14000, starScoreThresholds:{2:25000,3:35000}, endgameMoveBonus:800, finale:true },
];

const C = {
  corners:[0,7,56,63],
  deepCorners:[0,1,6,7,8,15,48,55,56,57,62,63],
  sideNotches:[24,31,32,39],
  plusCorners:[0,1,6,7,8,9,14,15,48,49,54,55,56,57,62,63],
  hourglass:[0,7,8,15,16,23,40,47,48,55,56,63],
};

const stage2 = [
  { id:"level_11", number:11, title:"Wejście do Labu", subtitle:"Nowy układ · Neon Shield", moves:25, goals:{ cassette:12, note:12 }, layout:{ inactive:C.corners }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:20500,3:29500}, endgameMoveBonus:750 },
  { id:"level_12", number:12, title:"Światło Pod Napięciem", subtitle:"Więcej osłon", moves:25, goals:{ vinyl:12, microphone:10 }, layout:{ inactive:C.corners }, shields:[{index:17,hp:1},{index:18,hp:1},{index:21,hp:1},{index:22,hp:1},{index:41,hp:1},{index:46,hp:1}], starScoreThresholds:{2:21500,3:30500}, endgameMoveBonus:750 },
  { id:"level_13", number:13, title:"Ścięte Rogi", subtitle:"Mniej miejsca", moves:25, goals:{ headphones:12, speaker:12 }, layout:{ inactive:C.deepCorners }, shields:[{index:19,hp:1},{index:20,hp:1},{index:27,hp:1},{index:28,hp:1},{index:35,hp:1},{index:36,hp:1}], starScoreThresholds:{2:22000,3:31500}, endgameMoveBonus:750 },
  { id:"level_14", number:14, title:"Boczne Zakłócenia", subtitle:"Przerwany przepływ", moves:26, goals:{ cassette:10, note:10, microphone:8 }, layout:{ inactive:C.sideNotches }, shields:[{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1}], starScoreThresholds:{2:23000,3:32500}, endgameMoveBonus:750 },
  { id:"level_15", number:15, title:"Podwójna Warstwa", subtitle:"Shield x2", moves:27, goals:{ vinyl:10, speaker:10 }, layout:{ inactive:C.deepCorners }, shields:[{index:26,hp:2},{index:29,hp:2},{index:34,hp:2},{index:37,hp:2}], starScoreThresholds:{2:24500,3:34500}, endgameMoveBonus:750 },
  { id:"level_16", number:16, title:"Krzyżowy Remix", subtitle:"Węższa scena", moves:27, goals:{ headphones:10, cassette:10, note:10 }, layout:{ inactive:C.plusCorners }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:25000,3:35500}, endgameMoveBonus:750 },
  { id:"level_17", number:17, title:"Przebicie", subtitle:"Dużo osłon", moves:28, goals:{ microphone:10, speaker:10 }, scoreGoal:14000, layout:{ inactive:C.corners }, shields:[{index:10,hp:1},{index:13,hp:1},{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1},{index:50,hp:1},{index:53,hp:1}], starScoreThresholds:{2:27000,3:38000}, endgameMoveBonus:750 },
  { id:"level_18", number:18, title:"Klepsydra", subtitle:"Nietypowy przepływ", moves:29, goals:{ vinyl:8, headphones:8, cassette:8 }, layout:{ inactive:C.hourglass }, shields:[{index:27,hp:2},{index:28,hp:1},{index:35,hp:1},{index:36,hp:2}], starScoreThresholds:{2:28000,3:39500}, endgameMoveBonus:750 },
  { id:"level_19", number:19, title:"Ostatni Set", subtitle:"Ciasny limit", moves:24, goals:{ vinyl:8, microphone:8, headphones:8, speaker:8 }, layout:{ inactive:C.deepCorners }, shields:[{index:19,hp:1},{index:20,hp:1},{index:27,hp:2},{index:28,hp:2},{index:35,hp:2},{index:36,hp:2},{index:43,hp:1},{index:44,hp:1}], starScoreThresholds:{2:29000,3:41000}, endgameMoveBonus:800 },
  { id:"level_20", number:20, title:"Neon Lab: Finał", subtitle:"Finał Neon Lab", moves:31, goals:{ vinyl:6, microphone:6, headphones:6, cassette:6, speaker:6, note:6 }, scoreGoal:22000, layout:{ inactive:C.plusCorners }, shields:[{index:18,hp:2},{index:21,hp:2},{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1},{index:42,hp:2},{index:45,hp:2}], starScoreThresholds:{2:36000,3:50000}, endgameMoveBonus:850, finale:true },
];

export const HIT_MATCH_LEVELS = Object.freeze([...stage1, ...stage2].map((level) => ({ ...level, rewardPerStar:HIT_MATCH_REWARD_PER_STAR })));

export const HIT_MATCH_STAGES = Object.freeze([
  { id:"stage_1", number:1, title:"NEONOWA SCENA", subtitle:"Podstawy HIT MATCH", from:1, to:10, mechanic:"Klasyczna plansza" },
  { id:"stage_2", number:2, title:"NEON LAB", subtitle:"Nowe układy i Neon Shield", from:11, to:20, mechanic:"Ścięte pola + osłony" },
]);

export const HIT_MATCH_TOTAL_STARS = HIT_MATCH_LEVELS.length * 3;
export const HIT_MATCH_LEVEL_1 = HIT_MATCH_LEVELS[0];

export function getHitMatchLevel(levelId) {
  return HIT_MATCH_LEVELS.find((level) => level.id === levelId) || HIT_MATCH_LEVEL_1;
}

export function getHitMatchStage(levelNumber) {
  return HIT_MATCH_STAGES.find((stage) => levelNumber >= stage.from && levelNumber <= stage.to) || HIT_MATCH_STAGES[0];
}

export function createShieldState(level) {
  return Object.fromEntries((level?.shields || []).map(({ index, hp = 1 }) => [Number(index), Math.max(1, Number(hp || 1))]));
}

export function countShieldHp(shields = {}) {
  return Object.values(shields || {}).reduce((sum, hp) => sum + Math.max(0, Number(hp || 0)), 0);
}

export function isHitMatchLevelCompleted(level, stats = {}) {
  const collected = stats.collected || {};
  const collectOk = Object.entries(level?.goals || {}).every(([type, target]) => Number(collected[type] || 0) >= Number(target || 0));
  const scoreOk = !level?.scoreGoal || Number(stats.score || 0) >= Number(level.scoreGoal || 0);
  const shieldsOk = !(level?.shields || []).length || Number(stats.shieldsRemaining || 0) <= 0;
  return collectOk && scoreOk && shieldsOk;
}

export function starsForHitMatchLevel(level, score, completed) {
  if (!completed) return 0;
  let stars = 1;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[2] || Infinity)) stars = 2;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[3] || Infinity)) stars = 3;
  return stars;
}
