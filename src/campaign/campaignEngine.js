// Czysta logika kampanii — bez Firebase i bez Reacta, więc w pełni testowalna.
import { DEFAULT_PER_STAR_REWARD, getChapter, getStage, maxStarsForChapter } from "./campaignConfig.js";

export function emptyProgress() {
  return { version: 1, chapters: {}, totalStars: 0, campaignScore: 0 };
}

// Gwiazdki z wyniku: 0–3 według progów [1★, 2★, 3★].
export function starsForScore(score, thresholds) {
  let stars = 0;
  thresholds.forEach((t, i) => { if (score >= t) stars = i + 1; });
  return stars;
}

function stageEntry(progress, chapterId, stageId) {
  return progress?.chapters?.[chapterId]?.stages?.[stageId] || { stars: 0, best: 0, cleared: false };
}

export function isChapterUnlocked(campaign, progress, chapterId) {
  const chapter = getChapter(campaign, chapterId);
  if (!chapter) return false;
  if (!chapter.unlockAfterChapter) return true;
  const prev = getChapter(campaign, chapter.unlockAfterChapter);
  const finale = prev?.stages.find((s) => s.isFinale) || prev?.stages[prev.stages.length - 1];
  return !!finale && stageEntry(progress, prev.id, finale.id).cleared;
}

// Etap jest odblokowany, gdy rozdział jest dostępny, a poprzedni etap ma
// zaliczone min. 1★ (ukończ etap → odblokuj następny; liczba gwiazdek nie blokuje).
export function isStageUnlocked(campaign, progress, chapterId, stageId) {
  const chapter = getChapter(campaign, chapterId);
  const stage = getStage(chapter, stageId);
  if (!chapter || !stage) return false;
  if (!isChapterUnlocked(campaign, progress, chapterId)) return false;
  if (!stage.unlockAfter) return true;
  return stageEntry(progress, chapterId, stage.unlockAfter).cleared;
}

export function getStageStatus(campaign, progress, chapterId, stageId) {
  if (!isStageUnlocked(campaign, progress, chapterId, stageId)) return "locked";
  return stageEntry(progress, chapterId, stageId).cleared ? "cleared" : "unlocked";
}

export function chapterStars(progress, chapterId) {
  const stages = progress?.chapters?.[chapterId]?.stages || {};
  return Object.values(stages).reduce((sum, s) => sum + (s.stars || 0), 0);
}

// Główna funkcja: przyjmuje dotychczasowy postęp i wynik jednego podejścia,
// zwraca nowy postęp oraz dokładnie to, co należy wypłacić. Nigdy nie
// obniża gwiazdek ani rekordu. Nagroda = tylko za gwiazdki, których wcześniej nie było.
export function applyStageResult(campaign, progress, chapterId, stageId, rawResult) {
  const chapter = getChapter(campaign, chapterId);
  const stage = getStage(chapter, stageId);
  if (!chapter || !stage) throw new Error("Nieznany etap kampanii.");
  if (!isStageUnlocked(campaign, progress, chapterId, stageId)) throw new Error("Ten etap jest jeszcze zablokowany.");

  const base = progress && progress.chapters ? progress : emptyProgress();
  const score = Math.max(0, Math.min(stage.maxScore, Math.floor(Number(rawResult?.score) || 0)));
  const stars = starsForScore(score, stage.starThresholds);
  const prev = stageEntry(base, chapterId, stageId);

  const newStarsTotal = Math.max(prev.stars, stars);
  const gainedStars = newStarsTotal - prev.stars;
  const best = Math.max(prev.best, score);
  const cleared = prev.cleared || stars >= 1;
  const perfect = !!prev.perfect || (!!stage.perfectScore && score >= stage.perfectScore);

  const perStar = stage.reward?.perStar || DEFAULT_PER_STAR_REWARD;
  const rewards = { xp: gainedStars * perStar.xp, hitcoin: gainedStars * perStar.hitcoin, completion: false, special: null };

  const prevChapter = base.chapters[chapterId] || { stages: {}, fullStarsClaimed: false, perfectShow: false };
  const nextChapter = {
    ...prevChapter,
    stages: { ...prevChapter.stages, [stageId]: { stars: newStarsTotal, best, cleared, ...(perfect ? { perfect: true } : {}) } },
    perfectShow: !!prevChapter.perfectShow || (!!stage.isFinale && perfect),
  };

  const next = { ...base, chapters: { ...base.chapters, [chapterId]: nextChapter } };
  next.totalStars = Object.keys(next.chapters).reduce((sum, id) => sum + chapterStars(next, id), 0);
  next.campaignScore = Object.values(next.chapters).reduce(
    (sum, ch) => sum + Object.values(ch.stages || {}).reduce((s, st) => s + (st.best || 0), 0), 0);

  // nagroda za komplet gwiazdek w rozdziale — raz
  if (!nextChapter.fullStarsClaimed && chapterStars(next, chapterId) >= maxStarsForChapter(chapter)) {
    nextChapter.fullStarsClaimed = true;
    rewards.xp += chapter.completionReward?.xp || 0;
    rewards.hitcoin += chapter.completionReward?.hitcoin || 0;
    rewards.completion = true;
    rewards.special = chapter.completionReward?.special || null;
  }

  const nextIdx = chapter.stages.findIndex((s) => s.id === stageId) + 1;
  const newlyUnlocked = !prev.cleared && cleared && chapter.stages[nextIdx] ? chapter.stages[nextIdx].id : null;

  return {
    progress: next,
    result: { score, stars, previousStars: prev.stars, gainedStars, newBest: score > prev.best, previousBest: prev.best, perfect, newlyUnlockedStageId: newlyUnlocked },
    rewards,
  };
}

// ============================================================
// GENERATOR PYTAŃ, PLAN ETAPU I PUNKTACJA CZĘŚCI (Etap B–E)
// Wszystko czyste i testowalne — bez Reacta i Firebase.
// ============================================================

function shuffled(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normText(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Dwa teksty uznajemy za "za podobne do siebie" jako opcje A/B/C/D, gdy są
// identyczne po normalizacji albo jeden zawiera się w drugim (np. "Queen" i
// "Queen & David Bowie") — takie opcje mogłyby oba być poprawne.
function tooSimilar(a, b) {
  const x = normText(a), y = normText(b);
  if (!x || !y) return true;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && (` ${long} `).includes(` ${short} `);
}

// Utwory nadające się do kampanii: pełne dane, rok w zakresie dekady.
export function filterDecadePool(songs, decadeStart, decadeEnd) {
  const seenVideo = new Set();
  const out = [];
  for (const s of songs || []) {
    const year = Number(s?.year);
    if (!s || !s.videoId || !s.artist || !s.title) continue;
    if (!Number.isInteger(year) || year < decadeStart || year > decadeEnd) continue;
    if (seenVideo.has(s.videoId)) continue;
    seenVideo.add(s.videoId);
    out.push({ ...s, year, id: s.id || s.videoId });
  }
  return out;
}

function pickTextDistractors(pool, song, field, rng) {
  const chosen = [];
  for (const cand of shuffled(pool, rng)) {
    if (cand.id === song.id) continue;
    if (tooSimilar(cand[field], song[field])) continue;
    if (chosen.some((c) => tooSimilar(c, cand[field]))) continue;
    chosen.push(cand[field]);
    if (chosen.length === 3) return chosen;
  }
  return null;
}

function pickYearDistractors(year, decadeStart, decadeEnd, spread, rng) {
  const all = [];
  for (let y = decadeStart; y <= decadeEnd; y++) if (y !== year) all.push(y);
  let cand = all;
  if (spread === "tight") {
    cand = all.filter((y) => Math.abs(y - year) <= 3);
    if (cand.length < 3) cand = all.filter((y) => Math.abs(y - year) <= 5);
    if (cand.length < 3) cand = all;
  }
  if (cand.length < 3) return null;
  return shuffled(cand, rng).slice(0, 3);
}

function buildOptions(type, pool, song, opts, rng) {
  if (type === "year") {
    const d = pickYearDistractors(song.year, opts.decadeStart, opts.decadeEnd, opts.yearOptionSpread, rng);
    if (!d) return null;
    const options = [song.year, ...d].sort((a, b) => a - b).map(String);
    return { options, correctIndex: options.indexOf(String(song.year)) };
  }
  const field = type === "artist" ? "artist" : "title";
  const d = pickTextDistractors(pool, song, field, rng);
  if (!d) return null;
  const options = shuffled([song[field], ...d], rng);
  return { options, correctIndex: options.indexOf(song[field]) };
}

const QUIZ_PROMPTS = {
  artist: "Kto wykonuje ten utwór?",
  title: "Jaki tytuł nosi ten utwór?",
  year: "Z którego roku pochodzi ten utwór?",
};

// Buduje pytania quizu: każde ma dokładnie 4 różne opcje i dokładnie jedną
// poprawną. Zwraca { questions, spares } — spares to zapasowe pytania na
// wypadek uszkodzonego linku (podmiana bez kary dla gracza).
export function buildQuizQuestions(pool, { count, questionTypes, yearOptionSpread = "decade", decadeStart, decadeEnd, spareCount = 4 }, rng = Math.random) {
  const songs = shuffled(filterDecadePool(pool, decadeStart, decadeEnd), rng);
  const types = questionTypes && questionTypes.length ? questionTypes : ["artist", "title", "year"];
  const total = count + spareCount;
  // równomierny rozkład typów, losowa kolejność
  const typeSeq = shuffled(Array.from({ length: total }, (_, i) => types[i % types.length]), rng);
  const out = [];
  let songIdx = 0;
  while (out.length < total && songIdx < songs.length) {
    const song = songs[songIdx++];
    const wanted = typeSeq[out.length];
    const order = [wanted, ...types.filter((t) => t !== wanted)];
    for (const type of order) {
      const built = buildOptions(type, songs, song, { decadeStart, decadeEnd, yearOptionSpread }, rng);
      if (built) {
        out.push({
          id: `q_${out.length}_${song.id}`,
          songId: song.id,
          videoId: song.videoId,
          artist: song.artist,
          title: song.title,
          year: song.year,
          type,
          prompt: QUIZ_PROMPTS[type],
          options: built.options,
          correctIndex: built.correctIndex,
        });
        break;
      }
    }
  }
  return { questions: out.slice(0, count), spares: out.slice(count) };
}

// Utwory do "Który to rok?" — różne utwory, plus zapas na uszkodzone linki.
export function buildYearGuessSongs(pool, { rounds, decadeStart, decadeEnd, spareCount = 3 }, rng = Math.random) {
  const songs = shuffled(filterDecadePool(pool, decadeStart, decadeEnd), rng);
  return { songs: songs.slice(0, rounds), spares: songs.slice(rounds, rounds + spareCount) };
}

// Utwory na oś czasu (karta startowa + scoredCount ocenianych). Do osi
// przydają się różne lata, więc najpierw bierzemy po jednym utworze z roku.
export function buildTimelineDeck(pool, { scoredCount, decadeStart, decadeEnd, spareCount = 2 }, rng = Math.random) {
  const songs = shuffled(filterDecadePool(pool, decadeStart, decadeEnd), rng);
  const need = scoredCount + 1 + spareCount;
  const byYear = new Map();
  songs.forEach((s) => { if (!byYear.has(s.year)) byYear.set(s.year, []); byYear.get(s.year).push(s); });
  const firstPass = shuffled([...byYear.values()].map((arr) => arr[0]), rng);
  const used = new Set(firstPass.map((s) => s.id));
  const rest = songs.filter((s) => !used.has(s.id));
  return [...firstPass, ...rest].slice(0, need);
}

// Rush w obrębie jednej dekady: odstępy lat skalowane do jej szerokości
// (zwykła tabela trudności zakłada rozpiętość kilkudziesięciu lat).
const RUSH_DECADE_TIERS = [
  { minCombo: 15, minGap: 1, maxGap: 1 },
  { minCombo: 10, minGap: 1, maxGap: 2 },
  { minCombo: 6, minGap: 2, maxGap: 3 },
  { minCombo: 3, minGap: 3, maxGap: 5 },
  { minCombo: 0, minGap: 4, maxGap: 9 },
];
export function pickRushSongInDecade(pool, referenceYear, combo, usedIds, rng = Math.random) {
  const tier = RUSH_DECADE_TIERS.find((t) => combo >= t.minCombo);
  const free = pool.filter((s) => !usedIds.has(s.id) && s.year !== referenceYear);
  if (!free.length) return null;
  let pick = free.filter((s) => { const g = Math.abs(s.year - referenceYear); return g >= tier.minGap && g <= tier.maxGap; });
  if (!pick.length) pick = free;
  return pick[Math.floor(rng() * pick.length)];
}

export function yearGuessPoints(guess, actual) {
  const diff = Math.abs(guess - actual);
  if (diff === 0) return 10;
  if (diff <= 3) return 8;
  if (diff <= 5) return 6;
  if (diff <= 8) return 4;
  if (diff <= 10) return 2;
  return 0;
}

// Plan etapu = lista części. Zwykły etap ma jedną część, finał kilka.
export function buildRunPlan(stage) {
  if (!stage) return [];
  if (stage.type === "finale") return stage.params.parts.map((p) => ({ ...p }));
  return [{ type: stage.type, ...stage.params }];
}

// Wynik jednej części z surowych danych rozgrywki.
//  timeline:  { correct }                 quiz: { correct }
//  yearGuess: { guesses:[{guess,actual}] } rush: { correct }
export function scorePart(part, raw) {
  if (part.type === "yearGuess") {
    const g = raw.guesses || [];
    const score = g.reduce((s, x) => s + (x.guess == null ? 0 : yearGuessPoints(x.guess, x.actual)), 0);
    const maxDiff = part.maxYearDiff ?? 2;
    const hits = g.filter((x) => x.guess != null && Math.abs(x.guess - x.actual) <= maxDiff).length;
    return { type: "yearGuess", score, hits, total: part.rounds };
  }
  const correct = Math.max(0, Math.floor(Number(raw.correct) || 0));
  const total = part.type === "timeline" ? part.scoredCount : part.type === "quiz" ? part.questionCount : null;
  const capped = total != null ? Math.min(correct, total) : correct;
  return { type: part.type, score: capped, hits: capped, total };
}

// Końcowy wynik etapu (liczba porównywana z progami gwiazdek).
export function computeStageScore(stage, partResults) {
  if (stage.type === "finale") return partResults.reduce((s, r) => s + (r.hits || 0), 0);
  return partResults[0]?.score || 0;
}
