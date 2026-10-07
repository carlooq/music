// Cały stan i przebieg kampanii w jednym miejscu (hook), żeby App.jsx dostał
// tylko cienką integrację. Hook NIE dotyka zwykłych statystyk, rankingów,
// wyzwań tygodniowych ani rankingu Hit Rush — kampania ma własne nagrody
// (zapisywane atomowo w campaignDb.submitStageResult).
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase-config.js";
import { generateRoomCode } from "../identity.js";
import { randomStartSeconds } from "../utils.js";
import { CAMPAIGN, getChapter, getStage } from "./campaignConfig.js";
import {
  buildQuizQuestions, buildYearGuessSongs, buildTimelineDeck, buildRunPlan, scorePart,
  computeStageScore, filterDecadePool, pickRushSongInDecade, yearGuessPoints, getStageStatus, isChapterUnlocked,
} from "./campaignEngine.js";
import { getCampaignProgress, submitStageResult, fetchCampaignLeaderboard } from "./campaignDb.js";

export const CAMPAIGN_MIN_LISTEN_MS = 1000;
const POOL_SAFETY_MARGIN = 10; // ile utworów ponad absolutne minimum chcemy mieć w dekadzie

function requiredSongs(parts) {
  return parts.reduce((sum, p) => {
    if (p.type === "timeline") return sum + p.scoredCount + 3;
    if (p.type === "quiz") return sum + p.questionCount + 4;
    if (p.type === "yearGuess") return sum + p.rounds + 3;
    return sum + 15; // rush
  }, 0);
}

function toMs(v) {
  if (!v) return 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  const t = v instanceof Date ? v.getTime() : Number(v);
  return Number.isFinite(t) ? t : 0;
}

export function useCampaign(deps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const { screen, room, roomId, user, playbackUx } = deps;

  const [progress, setProgress] = useState(null);
  const [chapterId, setChapterId] = useState(CAMPAIGN.chapters[0].id);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [run, setRunState] = useState(null);
  const [play, setPlay] = useState(null); // quiz / yearGuess
  const [outcome, setOutcome] = useState(null); // wynik zapisu etapu
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(false);

  const runRef = useRef(null);
  const poolRef = useRef(null);
  const usedRef = useRef(new Set());
  const gameoverHandledRef = useRef(null);

  const setRun = useCallback((r) => { runRef.current = r; setRunState(r); }, []);

  const chapter = getChapter(CAMPAIGN, chapterId);

  // ---------- wejście / mapa ----------
  const openCampaign = useCallback(async () => {
    const d = depsRef.current;
    if (!d.user) {
      d.requestLogin?.("Kampania wymaga konta — zaloguj się, żeby zapisywać postęp.");
      return;
    }
    d.setError("");
    setRun(null); setPlay(null); setOutcome(null);
    d.setHitRush?.(null);
    setLoading(true);
    try {
      setProgress(await getCampaignProgress(d.user.uid));
      d.setScreen("campaignHome");
    } catch (e) {
      d.setError("Nie udało się wczytać kampanii: " + (e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [setRun]);

  const backToMap = useCallback(() => {
    setRun(null); setPlay(null); setOutcome(null);
    depsRef.current.setHitRush?.(null);
    depsRef.current.setScreen("campaignMap");
  }, [setRun]);

  const selectChapter = useCallback((nextChapterId) => {
    const d = depsRef.current;
    if (!progress || !isChapterUnlocked(CAMPAIGN, progress, nextChapterId)) return;
    setChapterId(nextChapterId);
    setSelectedStageId(null);
    setRun(null); setPlay(null); setOutcome(null);
    d.setHitRush?.(null);
    d.setScreen("campaignMap");
  }, [progress, setRun]);

  const backToCampaignHome = useCallback(() => {
    setRun(null); setPlay(null); setOutcome(null);
    depsRef.current.setHitRush?.(null);
    depsRef.current.setScreen("campaignHome");
  }, [setRun]);

  const selectStage = useCallback((stageId) => {
    setSelectedStageId(stageId);
    setOutcome(null);
    depsRef.current.setScreen("campaignStage");
  }, []);

  const openLeaderboard = useCallback(async () => {
    const d = depsRef.current;
    d.setScreen("campaignLeaderboard");
    setLeaderboard(null);
    try {
      const rows = await fetchCampaignLeaderboard(20);
      setLeaderboard(await d.enrichRows(rows));
    } catch (e) {
      setLeaderboard([]);
      d.setError("Nie udało się wczytać rankingu kampanii: " + (e?.message || e));
    }
  }, []);

  // ---------- uruchamianie części ----------
  const startPart = useCallback(async (runState) => {
    const d = depsRef.current;
    const ch = getChapter(CAMPAIGN, runState.chapterId);
    const part = runState.parts[runState.partIndex];
    const allYears = (poolRef.current || []).map((s) => Number(s.year)).filter(Number.isFinite);
    const base = {
      decadeStart: Number.isFinite(ch.decadeStart) ? ch.decadeStart : Math.min(...allYears),
      decadeEnd: Number.isFinite(ch.decadeEnd) ? ch.decadeEnd : Math.max(...allYears),
    };
    const available = poolRef.current.filter((s) => !usedRef.current.has(s.id));
    const markUsed = (songs) => songs.forEach((s) => usedRef.current.add(s.id || s.songId));

    if (part.type === "timeline") {
      const songs = buildTimelineDeck(available, { ...base, scoredCount: part.scoredCount });
      if (songs.length < part.scoredCount + 1) throw new Error("Za mało utworów z tego okresu w bazie.");
      markUsed(songs);
      const deck = songs.map((s) => ({ id: s.id, videoId: s.videoId, artist: s.artist, title: s.title, year: s.year, startSeconds: randomStartSeconds() }));
      const code = generateRoomCode();
      const me = { id: d.playerId, uid: d.user.uid, name: d.name?.trim() || d.user.displayName || "Gracz", authed: true, avatarUrl: d.stats?.avatarUrl || null };
      await setDoc(doc(db, "rooms", code), {
        code,
        hostId: d.playerId,
        // target nieosiągalny — koniec gry wyznacza campaignScoredCount (patrz nextRound)
        target: deck.length + 5,
        status: "playing",
        players: [me],
        deck,
        deckIndex: 2,
        currentPlayerId: d.playerId,
        startingPlayerId: d.playerId,
        currentCard: deck[1],
        startSeconds: deck[1].startSeconds,
        turnStartedAt: serverTimestamp(),
        timelines: { [d.playerId]: [deck[0]] },
        tokens: { [d.playerId]: 0 },
        lastResult: null,
        pendingGuess: null,
        votes: {},
        requiredApprovals: 0,
        resultAt: null,
        winnerIds: [],
        finishingRound: false,
        decisionTimes: {},
        gameStreaks: {},
        gameGuessStreaks: {},
        gameGuesses: {},
        gameBestStreaks: {},
        playedCards: [],
        messages: [],
        practiceMode: true, // omija zwykłe XP/staty/wyzwania/ranking sezonu
        campaignMode: true,
        campaignScoredCount: part.scoredCount,
        decisionSeconds: part.decisionSeconds || 60,
        createdAt: serverTimestamp(),
        expireAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      d.setRoomId(code);
      return;
    }

    if (part.type === "quiz") {
      const { questions, spares } = buildQuizQuestions(available, {
        ...base, count: part.questionCount, questionTypes: part.questionTypes, yearOptionSpread: part.yearOptionSpread,
      });
      if (questions.length < part.questionCount) throw new Error("Za mało utworów z tego okresu, żeby ułożyć quiz.");
      markUsed([...questions, ...spares]);
      const tag = (q) => ({ ...q, startSeconds: randomStartSeconds() });
      setPlay({ kind: "quiz", items: questions.map(tag), spares: spares.map(tag), index: 0, results: [], feedback: null, ready: false, readyAt: null, roundSeconds: null });
      d.setScreen("campaignPlay");
      return;
    }

    if (part.type === "yearGuess") {
      const { songs, spares } = buildYearGuessSongs(available, { ...base, rounds: part.rounds });
      if (songs.length < part.rounds) throw new Error("Za mało utworów z tego okresu dla Zgadnij Rok.");
      markUsed([...songs, ...spares]);
      const tag = (s) => ({ id: s.id, songId: s.id, videoId: s.videoId, artist: s.artist, title: s.title, year: s.year, startSeconds: randomStartSeconds() });
      setPlay({ kind: "yearGuess", items: songs.map(tag), spares: spares.map(tag), index: 0, results: [], feedback: null, ready: false, readyAt: null, roundSeconds: part.roundSeconds || 60, yearMin: base.decadeStart, yearMax: base.decadeEnd });
      d.setScreen("campaignPlay");
      return;
    }

    if (part.type === "rush") {
      const rushPool = poolRef.current;
      const referenceCard = rushPool[Math.floor(Math.random() * rushPool.length)];
      const usedIds = new Set([referenceCard.id]);
      const currentCard = pickRushSongInDecade(rushPool, referenceCard.year, 0, usedIds);
      if (!currentCard) throw new Error("Nie udało się dobrać utworów do Sprintu.");
      usedIds.add(currentCard.id);
      d.setHitRush({
        pool: rushPool, referenceCard, currentCard, currentStartSeconds: randomStartSeconds(),
        score: 0, combo: 0, bestCombo: 0, correct: 0, wrong: 0, usedIds,
        timeLeft: part.roundSeconds ?? 30, running: true, feedback: null, answerReady: false, maxDifficulty: "easy",
        campaign: true, comboGoal: part.comboGoal ?? 10, goalReached: false,
        pickFn: pickRushSongInDecade, roundSeconds: part.roundSeconds ?? 30,
      });
      d.setScreen("hitRush");
      return;
    }
    throw new Error("Nieznany typ części etapu.");
  }, []);

  // ---------- start etapu ----------
  const startStage = useCallback(async (stageId) => {
    const d = depsRef.current;
    const ch = getChapter(CAMPAIGN, chapterId);
    const stage = getStage(ch, stageId);
    if (!d.user || !stage || !progress) return;
    if (getStageStatus(CAMPAIGN, progress, chapterId, stageId) === "locked") {
      d.setError("Ten etap jest jeszcze zablokowany.");
      return;
    }
    d.setError("");
    d.setBusy(true);
    try {
      const live = await d.loadPool();
      const pool = filterDecadePool(live, ch.decadeStart, ch.decadeEnd);
      const parts = buildRunPlan(stage);
      if (pool.length < requiredSongs(parts) + POOL_SAFETY_MARGIN) {
        throw new Error(`Za mało utworów z okresu ${ch.subtitle || ch.title} w bazie, żeby uruchomić ten etap (jest ${pool.length}).`);
      }
      poolRef.current = pool;
      usedRef.current = new Set();
      setOutcome(null);
      setPlay(null);
      const runState = { chapterId, stageId, parts, partIndex: 0, partResults: [], completedIdx: -1 };
      setRun(runState);
      await startPart(runState);
    } catch (e) {
      d.setError(e?.message || "Nie udało się wystartować etapu.");
      setRun(null);
    } finally {
      d.setBusy(false);
    }
  }, [chapterId, progress, setRun, startPart]);

  // ---------- zakończenie części / etapu ----------
  const finalizeStage = useCallback(async (runState, partResults) => {
    const d = depsRef.current;
    const ch = getChapter(CAMPAIGN, runState.chapterId);
    const stage = getStage(ch, runState.stageId);
    const score = computeStageScore(stage, partResults);
    setOutcome({ pending: true, score, partResults, stageId: stage.id });
    d.setScreen("campaignResult");
    try {
      const out = await submitStageResult(d.user.uid, runState.chapterId, runState.stageId, { score });
      setProgress(out.progress);
      if (out.rewards.xp) d.setMyXp?.((x) => (x || 0) + out.rewards.xp);
      if (out.rewards.hitcoin) d.setMyHitcoin?.((h) => (h || 0) + out.rewards.hitcoin);
      setOutcome({ pending: false, score, partResults, stageId: stage.id, ...out });
    } catch (e) {
      setOutcome({ pending: false, saveError: e?.message || "Nie udało się zapisać wyniku.", score, partResults, stageId: stage.id });
    }
  }, []);

  const retrySubmit = useCallback(async () => {
    const r = runRef.current;
    if (!r || !outcome?.saveError) return;
    await finalizeStage(r, outcome.partResults);
  }, [finalizeStage, outcome]);

  // Wywoływane po zakończeniu każdej części (oś czasu / quiz / zgadnij rok / rush).
  const completePart = useCallback(async (raw) => {
    const r = runRef.current;
    if (!r || r.completedIdx === r.partIndex) return; // jedno zakończenie na część
    const part = r.parts[r.partIndex];
    const result = scorePart(part, raw);
    const partResults = [...r.partResults, result];
    const next = { ...r, partResults, completedIdx: r.partIndex };
    setPlay(null);
    if (r.partIndex + 1 < r.parts.length) {
      setRun(next);
      depsRef.current.setScreen("campaignIntermission");
      return;
    }
    setRun(next);
    await finalizeStage(next, partResults);
  }, [finalizeStage, setRun]);

  const continueRun = useCallback(async () => {
    const r = runRef.current;
    if (!r) return backToMap();
    const d = depsRef.current;
    const next = { ...r, partIndex: r.partIndex + 1 };
    setRun(next);
    d.setBusy(true);
    try {
      await startPart(next);
    } catch (e) {
      d.setError(e?.message || "Nie udało się wystartować kolejnej części.");
      backToMap();
    } finally {
      d.setBusy(false);
    }
  }, [backToMap, setRun, startPart]);

  // ---------- quiz / zgadnij rok ----------
  const finishPlayPart = useCallback((p) => {
    if (p.kind === "quiz") completePart({ correct: p.results.filter((x) => x.correct).length });
    else completePart({ guesses: p.results });
  }, [completePart]);

  const answerQuiz = useCallback((optionIndex) => {
    setPlay((p) => {
      if (!p || p.kind !== "quiz" || p.feedback || !p.ready) return p;
      const q = p.items[p.index];
      if (!q) return p;
      const correct = optionIndex === q.correctIndex;
      return { ...p, feedback: { chosen: optionIndex, correct }, results: [...p.results, { correct }] };
    });
  }, []);

  const submitYear = useCallback((guess) => {
    setPlay((p) => {
      if (!p || p.kind !== "yearGuess" || p.feedback) return p;
      if (guess != null && !p.ready) return p;
      const s = p.items[p.index];
      if (!s) return p;
      const points = guess == null ? 0 : yearGuessPoints(guess, s.year);
      return { ...p, feedback: { guess, actual: s.year, points }, results: [...p.results, { guess, actual: s.year }] };
    });
  }, []);

  const nextQuestion = useCallback(() => {
    const p = play;
    if (!p || !p.feedback) return;
    if (p.index + 1 >= p.items.length) {
      finishPlayPart(p);
      return;
    }
    setPlay({ ...p, index: p.index + 1, feedback: null, ready: false, readyAt: null });
  }, [play, finishPlayPart]);

  // Uszkodzony link: podmiana na zapasowe pytanie/utwór bez żadnej kary.
  const replaceBrokenCard = useCallback((card) => {
    setPlay((p) => {
      if (!p || p.feedback) return p;
      const cur = p.items[p.index];
      const mismatch = cur && (cur.songId || cur.id) !== (card.id || card.videoId) && cur.videoId !== card.videoId;
      if (!cur || mismatch) return p;
      const items = [...p.items];
      const spares = [...p.spares];
      if (spares.length) items[p.index] = spares.shift();
      else items.splice(p.index, 1);
      return { ...p, items, spares, ready: false, readyAt: null };
    });
  }, []);

  // Skończyły się pytania po usunięciu zepsutych (brak zapasów) — zamknij część.
  useEffect(() => {
    if (play && !play.feedback && play.index >= play.items.length) finishPlayPart(play);
  }, [play, finishPlayPart]);

  // Bieżąca karta (dla walidatora linków w App) i bramka "gotowe do odpowiedzi".
  const currentCard = screen === "campaignPlay" && play && !play.feedback && play.items[play.index]
    ? (() => { const it = play.items[play.index]; return { id: it.songId || it.id, videoId: it.videoId, artist: it.artist, title: it.title, year: it.year }; })()
    : null;
  const currentCardId = currentCard ? (currentCard.id || currentCard.videoId) : null;

  useEffect(() => {
    if (!currentCardId || play?.ready) return;
    const ok = playbackUx?.status === "ready" && playbackUx?.mode === "campaign" && playbackUx?.cardId === currentCardId;
    if (!ok) return;
    const t = setTimeout(() => {
      setPlay((p) => {
        const it = p?.items?.[p.index];
        if (!p || p.feedback || p.ready || !it || (it.songId || it.id) !== currentCardId) return p;
        return { ...p, ready: true, readyAt: Date.now() };
      });
    }, CAMPAIGN_MIN_LISTEN_MS);
    return () => clearTimeout(t);
  }, [currentCardId, play?.ready, playbackUx?.status, playbackUx?.mode, playbackUx?.cardId]);

  // Limit czasu rundy w "Który to rok?" — liczony od chwili, gdy utwór gra.
  useEffect(() => {
    if (!play || play.kind !== "yearGuess" || !play.ready || play.feedback) return;
    const deadline = play.readyAt + play.roundSeconds * 1000;
    const id = setInterval(() => { if (Date.now() >= deadline) submitYear(null); }, 250);
    return () => clearInterval(id);
  }, [play?.kind, play?.ready, play?.readyAt, play?.feedback, play?.roundSeconds, submitYear]);

  // ---------- koniec pokoju osi czasu ----------
  useEffect(() => {
    if (screen !== "gameover" || !room?.campaignMode || !user) return;
    const marker = `${roomId}_${toMs(room.expireAt)}`;
    if (gameoverHandledRef.current === marker) return;
    gameoverHandledRef.current = marker;
    const d = depsRef.current;
    const correct = (room.playedCards || []).filter((c) => c.playerId === d.playerId && !c.bought && c.correct).length;
    d.setRoomId(null);
    d.setRoom(null);
    if (!runRef.current) { backToMap(); return; } // odświeżona strona w trakcie gry — bez zapisu wyniku
    completePart({ correct });
  }, [screen, room?.campaignMode, roomId, toMs(room?.expireAt), user]);

  // Wyjście w trakcie etapu — bez zapisu, bez kary.
  const abortRun = useCallback(() => {
    backToMap();
  }, [backToMap]);

  return {
    progress, chapter, chapterId, selectedStageId, run, play, outcome, leaderboard, loading,
    currentCard,
    openCampaign, selectChapter, backToCampaignHome, backToMap, selectStage, openLeaderboard, startStage, continueRun, retrySubmit, abortRun,
    answerQuiz, submitYear, nextQuestion, replaceBrokenCard, completePart,
  };
}
