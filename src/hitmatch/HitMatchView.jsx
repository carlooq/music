import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Sparkles, Star, Trophy, Zap, Music2, Move, Target, Play, SkipForward } from "lucide-react";
import { playCorrectSound, playWrongSound, playVictorySound, unlockAudio } from "../sounds.js";
import { auth } from "../firebase-config.js";
import { fetchAllSongsFromDb } from "../songsDb.js";
import { REAL_SONGS } from "../songs.js";
import vinylImg from "../assets/hitmatch/vinyl.webp";
import microphoneImg from "../assets/hitmatch/microphone.webp";
import headphonesImg from "../assets/hitmatch/headphones.webp";
import cassetteImg from "../assets/hitmatch/cassette.webp";
import speakerImg from "../assets/hitmatch/speaker.webp";
import noteImg from "../assets/hitmatch/note.webp";
import {
  HIT_MATCH_COLS,
  HIT_MATCH_ROWS,
  areAdjacent,
  colOf,
  collapseAndRefill,
  countRemovedByType,
  createPlayableBoard,
  expandSpecialEffects,
  findMatches,
  hasPossibleMove,
  removeIndices,
  resolveColorSwap,
  resolveSpecialSwap,
  rowOf,
  chooseSpecialCreation,
  shufflePlayable,
  swapBoardCells,
  uniqueMatchedIndices,
} from "./hitMatchEngine.js";
import { HIT_MATCH_LEVEL_1 as LEVEL, starsForHitMatchLevel } from "./hitMatchConfig.js";
import { getHitMatchProgress, submitHitMatchLevelResult } from "./hitMatchDb.js";
import "./hitmatch.css";

const ICONS = {
  vinyl: vinylImg,
  microphone: microphoneImg,
  headphones: headphonesImg,
  cassette: cassetteImg,
  speaker: speakerImg,
  note: noteImg,
  wild: vinylImg,
};

const TYPE_LABELS = {
  vinyl: "Winyle",
  microphone: "Mikrofony",
  headphones: "Słuchawki",
  cassette: "Kasety",
  speaker: "Głośniki",
  note: "Nuty",
};

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const shuffle = (arr) => {
  const next = arr.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

let quizPoolPromise = null;
async function loadQuizPool() {
  if (!quizPoolPromise) {
    quizPoolPromise = fetchAllSongsFromDb()
      .then((rows) => rows.filter((s) => s?.videoId && s?.artist && s?.title))
      .catch(() => REAL_SONGS.filter((s) => s?.videoId && s?.artist && s?.title));
  }
  return quizPoolPromise;
}

function songLabel(song) {
  return `${song.artist} — ${song.title}`;
}

function buildQuiz(pool, previousVideoId = null) {
  const valid = (pool || []).filter((s) => s?.videoId && s?.artist && s?.title);
  if (valid.length < 4) return null;
  const candidates = valid.filter((s) => s.videoId !== previousVideoId);
  const song = candidates[Math.floor(Math.random() * candidates.length)] || valid[Math.floor(Math.random() * valid.length)];
  const correctLabel = songLabel(song);
  const distractors = shuffle(valid.filter((s) => s.videoId !== song.videoId && songLabel(s) !== correctLabel))
    .slice(0, 3);
  const answers = shuffle([
    { id: song.videoId, label: correctLabel, correct: true },
    ...distractors.map((s) => ({ id: s.videoId, label: songLabel(s), correct: false })),
  ]);
  return { song, answers, startSeconds: Math.floor(Math.random() * 61) + 15 };
}

function specialName(special) {
  if (special === "row") return "BASS LINE";
  if (special === "col") return "DROP LINE";
  if (special === "bomb") return "BOMBA 3×3";
  if (special === "color") return "ZŁOTY WINYL";
  return "";
}

function buildSpecialFx(board, indices = []) {
  const seen = new Set();
  const fx = [];
  indices.forEach((index) => {
    const tile = board[index];
    if (!tile?.special || seen.has(tile.id)) return;
    seen.add(tile.id);
    if (tile.special === "row") fx.push({ key: `${tile.id}-row`, kind: "row", row: rowOf(index) });
    if (tile.special === "col") fx.push({ key: `${tile.id}-col`, kind: "col", col: colOf(index) });
    if (tile.special === "bomb") fx.push({ key: `${tile.id}-bomb`, kind: "bomb", row: rowOf(index), col: colOf(index) });
    if (tile.special === "color") fx.push({ key: `${tile.id}-color`, kind: "color" });
  });
  return fx;
}

function HitMatchPiece({ tile, index, selected, matched, activated, dragging, onPointerDown, onPointerMove, onPointerUp, onClick }) {
  const row = rowOf(index);
  const col = colOf(index);
  const image = ICONS[tile.type] || ICONS.vinyl;
  const classNames = [
    "hm-piece",
    `type-${tile.type}`,
    tile.special ? `special-${tile.special}` : "",
    selected ? "is-selected" : "",
    matched ? "is-matched" : "",
    activated ? "is-activated-special" : "",
    dragging ? "is-dragging" : "",
    tile.fresh ? "is-fresh" : "",
    tile.freshSpecial ? "is-special-born" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="hm-piece-slot"
      style={{
        "--hm-row": row,
        "--hm-col": col,
        "--hm-spawn-delay": `${Math.min(120, (tile.spawnOrder || 0) * 18)}ms`,
      }}
    >
      <button
        type="button"
        className={classNames}
        aria-label={`${TYPE_LABELS[tile.type] || "Specjalny kafel"}${tile.special ? `, ${specialName(tile.special)}` : ""}`}
        onPointerDown={(event) => onPointerDown(event, index)}
        onPointerMove={(event) => onPointerMove(event, index)}
        onPointerUp={(event) => onPointerUp(event, index)}
        onPointerCancel={(event) => onPointerUp(event, index, true)}
        onClick={() => onClick(index)}
      >
        <span className="hm-piece-glow" />
        <img src={image} alt="" draggable="false" />
        {tile.special === "row" ? <span className="hm-special-mark line horizontal"><i /><i /></span> : null}
        {tile.special === "col" ? <span className="hm-special-mark line vertical"><i /><i /></span> : null}
        {tile.special === "bomb" ? <span className="hm-special-mark bomb"><Zap size={16} fill="currentColor" /></span> : null}
        {tile.special === "color" ? <span className="hm-special-mark color"><Star size={17} fill="currentColor" /></span> : null}
      </button>
    </div>
  );
}

function GoalChip({ type, value, target }) {
  const done = value >= target;
  return (
    <div className={`hm-goal-chip type-${type} ${done ? "done" : ""}`}>
      <img src={ICONS[type]} alt="" />
      <span><small>{TYPE_LABELS[type]}</small><strong>{Math.min(value, target)} / {target}</strong></span>
      {done ? <b>✓</b> : null}
    </div>
  );
}

function Stars({ count = 0, size = 18, className = "" }) {
  return (
    <span className={`hm-stars ${className}`.trim()}>
      {[1, 2, 3].map((n) => <Star key={n} size={size} fill={n <= count ? "currentColor" : "none"} className={n <= count ? "earned" : ""} />)}
    </span>
  );
}

function QuizModal({ state, iframeRef, onAnswer, onReplay, onSkip }) {
  if (!state) return null;
  const quiz = state.quiz;
  return (
    <div className="hm-overlay hm-quiz-overlay">
      <div className="hm-modal hm-quiz-modal">
        <span className="hm-modal-kicker">HIT METER · MUZYCZNY BONUS</span>
        <h2>ZGADNIJ <b>HIT</b></h2>
        {state.loading || !quiz ? (
          <div className="hm-quiz-loading"><Music2 size={32} /><strong>Losuję utwór…</strong></div>
        ) : (
          <>
            <div className="hm-quiz-audio">
              <div className="hm-quiz-wave"><i /><i /><i /><i /><i /><i /><i /></div>
              <div><strong>POSŁUCHAJ FRAGMENTU</strong><small>Wskaż poprawny wykonawca — tytuł</small></div>
              <button type="button" onClick={onReplay}><Play size={16} fill="currentColor" /> JESZCZE RAZ</button>
              <iframe
                key={`${quiz.song.videoId}-${quiz.startSeconds}`}
                ref={iframeRef}
                title="hit-match-quiz-player"
                className="hm-quiz-player"
                src={`https://www.youtube.com/embed/${quiz.song.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${quiz.startSeconds}&controls=0&modestbranding=1&rel=0&playsinline=1`}
                allow="autoplay; encrypted-media"
                onLoad={onReplay}
              />
            </div>

            <div className="hm-quiz-options">
              {quiz.answers.map((answer, idx) => {
                const chosen = state.answerId === answer.id;
                const revealCorrect = state.answered && answer.correct;
                const wrongChosen = state.answered && chosen && !answer.correct;
                return (
                  <button
                    type="button"
                    key={`${answer.id}-${idx}`}
                    disabled={state.answered}
                    className={`${revealCorrect ? "correct" : ""} ${wrongChosen ? "wrong" : ""}`.trim()}
                    onClick={() => onAnswer(answer)}
                  >
                    <b>{String.fromCharCode(65 + idx)}</b><span>{answer.label}</span>
                  </button>
                );
              })}
            </div>

            {state.answered ? (
              <div className={`hm-quiz-feedback ${state.correct ? "correct" : "wrong"}`}>
                <strong>{state.correct ? "+3 RUCHY!" : "NIE TYM RAZEM"}</strong>
                <span>{state.correct ? "Muzyczna wiedza się opłaciła." : `Poprawna odpowiedź: ${songLabel(quiz.song)}`}</span>
              </div>
            ) : (
              <button type="button" className="hm-quiz-skip" onClick={onSkip}><SkipForward size={15} /> NIE ODTWARZA SIĘ? INNY UTWÓR</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HitMatchView({ onBack }) {
  const [board, setBoard] = useState(() => createPlayableBoard());
  const [selected, setSelected] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(LEVEL.moves);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState({ vinyl: 0, microphone: 0 });
  const [hitMeter, setHitMeter] = useState(0);
  const [status, setStatus] = useState("intro");
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [invalidFlash, setInvalidFlash] = useState(false);
  const [cascade, setCascade] = useState(0);
  const [bestCascade, setBestCascade] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [specialPulse, setSpecialPulse] = useState("");
  const [activeSpecials, setActiveSpecials] = useState([]);
  const [fxMarks, setFxMarks] = useState([]);
  const [endgame, setEndgame] = useState(null);
  const [bonusScore, setBonusScore] = useState(0);
  const [motionMode, setMotionMode] = useState("idle");
  const [comboNotice, setComboNotice] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [resultStars, setResultStars] = useState(0);
  const [previousStars, setPreviousStars] = useState(0);
  const [rewardState, setRewardState] = useState(null);

  const pointerStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const runTokenRef = useRef(0);
  const endingRef = useRef(false);
  const comboTimerRef = useRef(null);
  const quizPoolRef = useRef(null);
  const quizIframeRef = useRef(null);
  const statsRef = useRef({
    moves: LEVEL.moves,
    score: 0,
    bonusScore: 0,
    collected: { vinyl: 0, microphone: 0 },
    hitMeter: 0,
  });

  const syncStats = useCallback(() => {
    const stats = statsRef.current;
    setMoves(stats.moves);
    setScore(stats.score);
    setBonusScore(stats.bonusScore || 0);
    setCollected({ ...stats.collected });
    setHitMeter(stats.hitMeter);
  }, []);

  const flashBanner = useCallback((title, subtitle = "", tone = "cyan", hold = 850) => {
    const id = `${Date.now()}_${Math.random()}`;
    setBanner({ id, title, subtitle, tone });
    window.setTimeout(() => setBanner((current) => current?.id === id ? null : current), hold);
  }, []);

  const showCombo = useCallback((level) => {
    if (level < 2) return;
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    setComboNotice({ level, id: `${Date.now()}_${level}` });
    comboTimerRef.current = window.setTimeout(() => setComboNotice(null), 1050);
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || auth.currentUser?.isAnonymous) return;
    getHitMatchProgress(uid).then((progress) => {
      setPreviousStars(Number(progress?.levels?.[LEVEL.id]?.stars || 0));
    }).catch(() => {});
  }, []);

  useEffect(() => () => {
    runTokenRef.current += 1;
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
  }, []);

  // Zaczynamy dociągać pulę dopiero pod koniec ładowania paska. Dzięki temu
  // wejście do Hit Match nie generuje tysięcy odczytów, jeśli gracz szybko wyjdzie.
  useEffect(() => {
    if (hitMeter < 70 || quizPoolRef.current) return;
    loadQuizPool().then((pool) => { quizPoolRef.current = pool; }).catch(() => {});
  }, [hitMeter]);

  const resetGame = useCallback((autoStart = false) => {
    runTokenRef.current += 1;
    setBoard(createPlayableBoard());
    setSelected(null);
    setDraggingIndex(null);
    setMatched([]);
    setMoves(LEVEL.moves);
    setScore(0);
    setCollected({ vinyl: 0, microphone: 0 });
    setHitMeter(0);
    setBusy(false);
    setBanner(null);
    setCascade(0);
    setBestCascade(0);
    setInvalidFlash(false);
    setSpecialPulse("");
    setActiveSpecials([]);
    setFxMarks([]);
    setEndgame(null);
    setBonusScore(0);
    setMotionMode("idle");
    setComboNotice(null);
    setQuizState(null);
    setResultStars(0);
    setRewardState(null);
    endingRef.current = false;
    statsRef.current = {
      moves: LEVEL.moves,
      score: 0,
      bonusScore: 0,
      collected: { vinyl: 0, microphone: 0 },
      hitMeter: 0,
    };
    setStatus(autoStart ? "running" : "intro");
  }, []);

  const saveCompletedLevel = useCallback(async (finalScore, stars, token) => {
    const user = auth.currentUser;
    if (!user?.uid || user.isAnonymous) {
      setRewardState({ saved: false, guest: true, gainedStars: 0, xp: 0, hitcoin: 0 });
      return;
    }
    setRewardState({ saving: true });
    try {
      const result = await submitHitMatchLevelResult(user.uid, LEVEL, { score: finalScore, stars });
      if (runTokenRef.current !== token) return;
      setPreviousStars(result.stars);
      setRewardState({ saved: true, ...result });
    } catch (error) {
      if (runTokenRef.current !== token) return;
      setRewardState({ saved: false, error: error?.message || "Nie udało się zapisać nagrody." });
    }
  }, []);

  const finishOrShuffle = useCallback(async (finalBoard, token) => {
    if (runTokenRef.current !== token) return;
    const stats = statsRef.current;
    const won = Object.entries(LEVEL.goals).every(([type, target]) => (stats.collected[type] || 0) >= target);

    if (won) {
      if (endingRef.current) return;
      endingRef.current = true;
      setBusy(true);
      setCascade(0);
      setSelected(null);
      setDraggingIndex(null);
      setComboNotice(null);

      const remaining = Math.max(0, stats.moves);
      const fixedBonus = remaining * Number(LEVEL.endgameMoveBonus || 0);
      stats.bonusScore += fixedBonus;
      stats.score += fixedBonus;
      syncStats();

      if (remaining > 0) {
        setEndgame({ phase: "charging", total: remaining, left: remaining });
        flashBanner("ENCORE!", `${remaining} ruchów zamienia się w bonus`, "gold", 1250);
        await wait(420);
        if (runTokenRef.current !== token) return;

        // Widowiskowy finał jest celowo tylko wizualny: wynik za pozostałe
        // ruchy jest stały, więc losowe fajerwerki nie wpływają na gwiazdki.
        const visualSteps = Math.min(8, Math.max(3, remaining));
        for (let step = 0; step < visualSteps; step += 1) {
          const index = Math.floor(Math.random() * finalBoard.length);
          const row = rowOf(index);
          const col = colOf(index);
          const kind = step % 3 === 0 ? "bomb" : step % 3 === 1 ? "row" : "col";
          setActiveSpecials([index]);
          setFxMarks([{ key: `encore-${step}-${Date.now()}`, kind, row, col }]);
          setSpecialPulse(step >= visualSteps - 2 ? "mega" : "special");
          setEndgame({ phase: "charging", total: remaining, left: Math.max(0, remaining - Math.round(((step + 1) / visualSteps) * remaining)) });
          await wait(135);
          if (runTokenRef.current !== token) return;
        }
        setFxMarks([
          { key: `final-row-${Date.now()}`, kind: "row", row: 3 },
          { key: `final-col-${Date.now()}`, kind: "col", col: 4 },
          { key: `final-bomb-${Date.now()}`, kind: "bomb", row: 3, col: 4 },
        ]);
        setEndgame({ phase: "blast", total: remaining, left: 0 });
        setSpecialPulse("mega");
        await wait(520);
        if (runTokenRef.current !== token) return;
      }

      setEndgame(null);
      setSpecialPulse("");
      setActiveSpecials([]);
      setFxMarks([]);
      setMotionMode("idle");
      const finalScore = stats.score;
      const stars = starsForHitMatchLevel(LEVEL, finalScore, true);
      setResultStars(stars);
      setBusy(false);
      setStatus("won");
      playVictorySound();
      flashBanner("POZIOM UKOŃCZONY!", `${stars}★ · ${finalScore.toLocaleString("pl-PL")} pkt`, "gold", 1500);
      saveCompletedLevel(finalScore, stars, token);
      return;
    }

    if (stats.moves <= 0) {
      setBusy(false);
      setStatus("lost");
      setCascade(0);
      setMotionMode("idle");
      flashBanner("KONIEC RUCHÓW", "Spróbuj ponownie", "pink", 1200);
      return;
    }

    if (!hasPossibleMove(finalBoard)) {
      flashBanner("BRAK RUCHÓW", "Miksujemy planszę", "violet", 900);
      await wait(260);
      if (runTokenRef.current !== token) return;
      setMotionMode("shuffle");
      setBoard(shufflePlayable(finalBoard));
      await wait(260);
    }
    if (runTokenRef.current === token) {
      setCascade(0);
      setMotionMode("idle");
      setBusy(false);
    }
  }, [flashBanner, saveCompletedLevel, syncStats]);

  const applyRemovalStats = useCallback((boardBefore, actualIndices, cascadeLevel, specialCreation) => {
    const counts = countRemovedByType(boardBefore, actualIndices);
    const stats = statsRef.current;
    Object.entries(counts).forEach(([type, value]) => {
      if (Object.prototype.hasOwnProperty.call(LEVEL.goals, type)) {
        stats.collected[type] = (stats.collected[type] || 0) + value;
      }
    });
    const base = actualIndices.length * 100 * cascadeLevel;
    const specialBonus = specialCreation ? (specialCreation.special === "color" ? 900 : specialCreation.special === "bomb" ? 600 : 350) : 0;
    stats.score += base + specialBonus;
    // V4: pasek ma być nagrodą rzadką, mniej więcej raz na kilkanaście ruchów.
    stats.hitMeter = clamp(stats.hitMeter + actualIndices.length * 2 + Math.max(0, cascadeLevel - 1) * 5, 0, 100);
    syncStats();
  }, [syncStats]);

  const resolveCascades = useCallback(async function resolve(currentBoard, groups, token, cascadeLevel = 1, swapMeta = null) {
    if (runTokenRef.current !== token) return;
    setCascade(cascadeLevel);
    setBestCascade((value) => Math.max(value, cascadeLevel));
    if (cascadeLevel >= 2) showCombo(cascadeLevel);

    const specialCreation = swapMeta ? chooseSpecialCreation(groups, currentBoard, swapMeta.a, swapMeta.b) : null;
    const matchedBase = uniqueMatchedIndices(groups);
    let affected = expandSpecialEffects(currentBoard, matchedBase);
    if (specialCreation) affected = affected.filter((index) => index !== specialCreation.index);

    const triggeredSpecials = affected.filter((index) => currentBoard[index]?.special);
    setMatched(affected);
    setActiveSpecials(triggeredSpecials);
    setFxMarks(buildSpecialFx(currentBoard, triggeredSpecials));
    if (triggeredSpecials.length) setSpecialPulse(triggeredSpecials.length > 1 ? "mega" : "special");
    playCorrectSound();
    await wait(triggeredSpecials.length ? 340 : 280);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(currentBoard, affected, cascadeLevel, specialCreation);
    const removed = removeIndices(currentBoard, affected, specialCreation);
    setBoard(removed);
    await wait(35);
    if (runTokenRef.current !== token) return;

    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setMotionMode("fall");
    setBoard(dropped);
    await wait(300);
    if (runTokenRef.current !== token) return;
    setMotionMode("idle");

    const nextGroups = findMatches(dropped);
    if (nextGroups.length) {
      await wait(75);
      await resolve(dropped, nextGroups, token, cascadeLevel + 1, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, showCombo]);

  const resolveColorMove = useCallback(async (swapped, a, b, token) => {
    const affected = resolveColorSwap(swapped, a, b) || [];
    const triggeredSpecials = affected.filter((index) => swapped[index]?.special);
    setCascade(1);
    setMatched(affected);
    setActiveSpecials(triggeredSpecials);
    setFxMarks([{ key: `gold-${Date.now()}`, kind: "color" }, ...buildSpecialFx(swapped, triggeredSpecials.filter((index) => swapped[index]?.special !== "color"))]);
    setSpecialPulse("gold");
    playCorrectSound();
    flashBanner("ZŁOTY WINYL!", "Wybrany symbol znika z planszy", "gold", 1000);
    await wait(380);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, { special: "color" });
    const removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(35);
    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setMotionMode("fall");
    setBoard(dropped);
    await wait(310);
    if (runTokenRef.current !== token) return;
    setMotionMode("idle");

    const groups = findMatches(dropped);
    if (groups.length) {
      await resolveCascades(dropped, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner, resolveCascades]);

  const resolveSpecialMove = useCallback(async (swapped, a, b, affected, token) => {
    const specials = [swapped[a], swapped[b]].filter((tile) => tile?.special);
    const triggerIndices = [...new Set([a, b, ...affected].filter((index) => swapped[index]?.special))];
    const label = specials.length > 1 ? "SPECJALNE COMBO!" : specialName(specials[0]?.special);
    setCascade(1);
    setSpecialPulse(specials.length > 1 ? "mega" : specials[0]?.special || "special");
    setMatched(affected);
    setActiveSpecials(triggerIndices);
    setFxMarks(buildSpecialFx(swapped, triggerIndices));
    playCorrectSound();
    flashBanner(label || "BOOSTER!", specials.length > 1 ? "Boostery łączą siły" : specials[0]?.special === "bomb" ? "Wybuch 3×3" : "Booster aktywowany", specials.length > 1 ? "gold" : "violet", 1000);
    await wait(specials.length > 1 ? 420 : 340);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, null);
    statsRef.current.score += specials.length > 1 ? 1400 : 550;
    syncStats();
    const removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(35);
    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setMotionMode("fall");
    setBoard(dropped);
    await wait(310);
    if (runTokenRef.current !== token) return;
    setMotionMode("idle");

    const groups = findMatches(dropped);
    if (groups.length) {
      await resolveCascades(dropped, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner, resolveCascades, syncStats]);

  const attemptSwap = useCallback(async (a, b) => {
    if (status !== "running" || busy || quizState || !areAdjacent(a, b)) return;
    unlockAudio();
    setSelected(null);
    setDraggingIndex(null);
    setBusy(true);
    const token = runTokenRef.current;
    const original = board;
    const swapped = swapBoardCells(original, a, b);
    setMotionMode("swap");
    setBoard(swapped);
    await wait(175);
    if (runTokenRef.current !== token) return;

    const colorClear = resolveColorSwap(swapped, a, b);
    if (colorClear) {
      statsRef.current.moves -= 1;
      syncStats();
      await resolveColorMove(swapped, a, b, token);
      return;
    }

    const specialClear = resolveSpecialSwap(swapped, a, b);
    if (specialClear?.length) {
      statsRef.current.moves -= 1;
      syncStats();
      await resolveSpecialMove(swapped, a, b, specialClear, token);
      return;
    }

    const groups = findMatches(swapped);
    if (!groups.length) {
      playWrongSound();
      setInvalidFlash(true);
      setBoard(original);
      await wait(175);
      setInvalidFlash(false);
      setMotionMode("idle");
      setBusy(false);
      return;
    }

    statsRef.current.moves -= 1;
    syncStats();
    await resolveCascades(swapped, groups, token, 1, { a, b });
  }, [board, busy, quizState, resolveCascades, resolveColorMove, resolveSpecialMove, status, syncStats]);

  const handlePieceClick = useCallback((index) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (busy || quizState || status !== "running") return;
    if (selected === null) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    if (areAdjacent(selected, index)) {
      attemptSwap(selected, index);
      return;
    }
    setSelected(index);
  }, [attemptSwap, busy, quizState, selected, status]);

  const handlePointerDown = useCallback((event, index) => {
    if (busy || quizState || status !== "running") return;
    event.preventDefault();
    pointerStartRef.current = { index, x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    setDraggingIndex(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [busy, quizState, status]);

  // Nie zmieniamy planszy w trakcie pointermove. To usuwa podwójne swapy i
  // przypadkowe animacje kafli przy pionowym geście na ekranach dotykowych.
  const handlePointerMove = useCallback((event) => {
    if (!pointerStartRef.current) return;
    event.preventDefault();
  }, []);

  const handlePointerUp = useCallback((event, index, cancelled = false) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setDraggingIndex(null);
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch {}
    if (!start || cancelled || start.index !== index || busy || quizState || status !== "running") return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (distance < 20) return; // krótki tap zostawiamy dla click+click na desktopie
    const dominant = Math.max(Math.abs(dx), Math.abs(dy));
    const secondary = Math.min(Math.abs(dx), Math.abs(dy));
    if (secondary > dominant * 0.82) return;

    suppressClickRef.current = true;
    const row = rowOf(index);
    const col = colOf(index);
    let target = null;
    if (Math.abs(dx) > Math.abs(dy)) {
      const nextCol = col + (dx > 0 ? 1 : -1);
      if (nextCol >= 0 && nextCol < HIT_MATCH_COLS) target = row * HIT_MATCH_COLS + nextCol;
    } else {
      const nextRow = row + (dy > 0 ? 1 : -1);
      if (nextRow >= 0 && nextRow < HIT_MATCH_ROWS) target = nextRow * HIT_MATCH_COLS + col;
    }
    if (target !== null) attemptSwap(index, target);
  }, [attemptSwap, busy, quizState, status]);

  const replayQuiz = useCallback(() => {
    const win = quizIframeRef.current?.contentWindow;
    const quiz = quizState?.quiz;
    if (!win || !quiz) return;
    unlockAudio();
    win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
    win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
    win.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [quiz.startSeconds, true] }), "*");
    win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
  }, [quizState?.quiz]);

  const openHitQuiz = useCallback(async () => {
    if (status !== "running" || busy || statsRef.current.hitMeter < 100 || quizState) return;
    unlockAudio();
    setBusy(true);
    statsRef.current.hitMeter = 0;
    syncStats();
    setQuizState({ loading: true, answered: false });
    try {
      const pool = quizPoolRef.current || await loadQuizPool();
      quizPoolRef.current = pool;
      const quiz = buildQuiz(pool);
      if (!quiz) throw new Error("Za mało utworów do quizu.");
      setQuizState({ loading: false, quiz, answered: false });
      window.setTimeout(replayQuiz, 220);
    } catch (error) {
      statsRef.current.hitMeter = 100; // awaria źródła nie zabiera paska
      syncStats();
      setQuizState(null);
      setBusy(false);
      flashBanner("QUIZ NIEDOSTĘPNY", "HIT METER został zwrócony", "pink", 1300);
    }
  }, [busy, flashBanner, quizState, replayQuiz, status, syncStats]);

  const skipQuizSong = useCallback(() => {
    const pool = quizPoolRef.current || [];
    const next = buildQuiz(pool, quizState?.quiz?.song?.videoId);
    if (!next) return;
    setQuizState({ loading: false, quiz: next, answered: false });
  }, [quizState?.quiz?.song?.videoId]);

  const answerQuiz = useCallback((answer) => {
    if (!quizState?.quiz || quizState.answered) return;
    const correct = !!answer.correct;
    setQuizState((prev) => ({ ...prev, answered: true, answerId: answer.id, correct }));
    if (correct) {
      statsRef.current.moves += 3;
      syncStats();
      playCorrectSound();
    } else {
      playWrongSound();
    }
    window.setTimeout(() => {
      setQuizState(null);
      setBusy(false);
    }, correct ? 1350 : 1650);
  }, [quizState, syncStats]);

  const startGame = () => {
    unlockAudio();
    resetGame(true);
    flashBanner("LEVEL 1", "Zbierz cele, zanim skończą się ruchy", "cyan", 1000);
  };

  const progressPct = Math.round((Object.entries(LEVEL.goals).reduce((sum, [type, target]) => sum + Math.min(1, (collected[type] || 0) / target), 0) / Object.keys(LEVEL.goals).length) * 100);

  return (
    <div className={`hm-page hm-v4 hm-motion-${motionMode} ${invalidFlash ? "hm-invalid" : ""}`}>
      <div className="hm-bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="hm-topbar">
        <button type="button" className="hm-back" onClick={onBack}><ArrowLeft size={19} /> <span>WRÓĆ</span></button>
        <div className="hm-title-lockup"><span className="hm-eyebrow">HITSTERIADA ARCADE</span><h1>HIT <b>MATCH</b></h1></div>
        <button type="button" className="hm-help" onClick={() => setShowHelp(true)} aria-label="Jak grać"><span className="hm-help-q">?</span><em>JAK GRAĆ</em></button>
      </header>

      <main className="hm-layout">
        <section className="hm-stage-panel">
          <div className="hm-stage-heading">
            <div><span>POZIOM {LEVEL.number}</span><h2>{LEVEL.title.toUpperCase()}</h2><p>Łącz muzyczne symbole i buduj kaskady.</p></div>
            <div className="hm-stage-score-block">
              <Stars count={previousStars} size={20} />
              <small>TWÓJ REKORD GWIAZDEK</small>
              <div className="hm-stage-progress"><strong>{progressPct}%</strong><span><i style={{ width: `${progressPct}%` }} /></span></div>
            </div>
          </div>

          <div className="hm-hud-row">
            <div className="hm-stat-card moves"><Move size={18} /><span><small>RUCHY</small><strong>{moves}</strong></span></div>
            <div className="hm-stat-card score"><Trophy size={18} /><span><small>WYNIK</small><strong>{score.toLocaleString("pl-PL")}</strong></span></div>
            <button type="button" className={`hm-meter-card ${hitMeter >= 100 ? "ready" : ""}`} onClick={openHitQuiz} disabled={hitMeter < 100 || busy || Boolean(quizState) || Boolean(endgame)}>
              <div><Music2 size={19} /><span><small>{hitMeter >= 100 ? "MUZYCZNY QUIZ GOTOWY" : "HIT METER"}</small><strong>{Math.min(hitMeter, 100)}%</strong></span></div>
              <b><i style={{ width: `${Math.min(hitMeter, 100)}%` }} /></b>
              {hitMeter >= 100 ? <em>ODPAL QUIZ · +3 RUCHY</em> : null}
            </button>
          </div>

          <div className="hm-board-wrap">
            <div className={`hm-board-shell ${specialPulse ? `hm-fx-${specialPulse}` : ""}`}>
              <div className="hm-board" role="grid" aria-label="Plansza Hit Match">
                {board.map((tile, index) => tile ? (
                  <HitMatchPiece
                    key={tile.id}
                    tile={tile}
                    index={index}
                    selected={selected === index}
                    matched={matched.includes(index)}
                    activated={activeSpecials.includes(index)}
                    dragging={draggingIndex === index}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onClick={handlePieceClick}
                  />
                ) : null)}
                <span className="hm-board-shine" aria-hidden="true" />
              </div>

              <div className="hm-fx-layer" aria-hidden="true">
                {fxMarks.map((fx) => {
                  if (fx.kind === "row") return <i key={fx.key} className="hm-fx-beam row" style={{ top: `${((fx.row + 0.5) / HIT_MATCH_ROWS) * 100}%` }} />;
                  if (fx.kind === "col") return <i key={fx.key} className="hm-fx-beam col" style={{ left: `${((fx.col + 0.5) / HIT_MATCH_COLS) * 100}%` }} />;
                  if (fx.kind === "bomb") return <i key={fx.key} className="hm-fx-bomb-wave" style={{ left: `${((fx.col + 0.5) / HIT_MATCH_COLS) * 100}%`, top: `${((fx.row + 0.5) / HIT_MATCH_ROWS) * 100}%` }} />;
                  return <i key={fx.key} className="hm-fx-color-wave" />;
                })}
              </div>

              {endgame ? (
                <div className={`hm-endgame-badge ${endgame.phase}`}>
                  <span>ENCORE</span>
                  <strong>{endgame.phase === "blast" ? "FINAL DROP!" : `${endgame.left} RUCHÓW`}</strong>
                  <small>{endgame.phase === "blast" ? "Finałowy pokaz" : `+${LEVEL.endgameMoveBonus} pkt za każdy`}</small>
                </div>
              ) : null}

              {comboNotice && status === "running" && !endgame ? (
                <div key={comboNotice.id} className={`hm-combo-badge combo-${Math.min(comboNotice.level, 5)}`}>
                  COMBO <b>x{comboNotice.level}</b><small>{comboNotice.level >= 4 ? "MEGA KASKADA" : comboNotice.level === 3 ? "ŚWIETNA SERIA" : "KASKADA"}</small>
                </div>
              ) : null}
            </div>

            <div className="hm-goals-mobile">
              {Object.entries(LEVEL.goals).map(([type, target]) => <GoalChip key={type} type={type} value={collected[type] || 0} target={target} />)}
            </div>
          </div>
        </section>

        <aside className="hm-side-panel">
          <section className="hm-panel hm-objectives">
            <div className="hm-panel-title"><Target size={17} /><span>CEL POZIOMU</span></div>
            <p>Zbierz wszystkie wymagane symbole przed końcem ruchów.</p>
            <div className="hm-goal-list">{Object.entries(LEVEL.goals).map(([type, target]) => <GoalChip key={type} type={type} value={collected[type] || 0} target={target} />)}</div>
          </section>

          <section className="hm-panel hm-star-rules">
            <div className="hm-panel-title"><Star size={17} /><span>GWIAZDKI I NAGRODY</span></div>
            <div className="hm-star-rule"><Star size={18} fill="currentColor" /><span><strong>Ukończ poziom</strong><small>+20 XP · +15 HITCOIN</small></span></div>
            <div className="hm-star-rule"><span className="two-stars">★★</span><span><strong>{LEVEL.starScoreThresholds[2].toLocaleString("pl-PL")} pkt</strong><small>kolejna gwiazdka i nagroda</small></span></div>
            <div className="hm-star-rule"><span className="three-stars">★★★</span><span><strong>{LEVEL.starScoreThresholds[3].toLocaleString("pl-PL")} pkt</strong><small>pełny komplet</small></span></div>
          </section>

          <section className="hm-panel hm-specials">
            <div className="hm-panel-title"><Zap size={17} /><span>SPECJALNE COMBO</span></div>
            <div className="hm-special-list">
              <div><b>4</b><span><strong>Bass Line</strong><small>czyści cały rząd lub kolumnę</small></span></div>
              <div><b>L/T</b><span><strong>Bomba 3×3</strong><small>wybucha dokładnie wokół siebie</small></span></div>
              <div><b>5</b><span><strong>Złoty Winyl</strong><small>usuwa wszystkie symbole wybranego typu</small></span></div>
            </div>
          </section>

          <section className="hm-panel hm-tip"><span>♪</span><p><strong>HIT METER</strong> Ładuje się wolniej. Przy 100% odpal quiz muzyczny — dobra odpowiedź daje +3 ruchy.</p></section>
          <button type="button" className="hm-restart" onClick={() => resetGame(true)}><RotateCcw size={16} /> NOWA PLANSZA</button>
        </aside>
      </main>

      {banner ? <div className={`hm-banner tone-${banner.tone}`} key={banner.id}><strong>{banner.title}</strong>{banner.subtitle ? <span>{banner.subtitle}</span> : null}</div> : null}

      {status === "intro" ? (
        <div className="hm-overlay">
          <div className="hm-modal hm-intro-modal">
            <span className="hm-modal-kicker">HITSTERIADA ARCADE · POZIOM 1</span>
            <h2>HIT <b>MATCH</b></h2>
            <p>Łącz muzyczne symbole, buduj kaskady i zrealizuj cele przed końcem ruchów.</p>
            <div className="hm-intro-goals">
              {Object.entries(LEVEL.goals).map(([type, target]) => <div key={type}><img src={ICONS[type]} alt="" /><strong>{target}</strong><span>{TYPE_LABELS[type]}</span></div>)}
              <div className="moves"><Move size={26} /><strong>{LEVEL.moves}</strong><span>ruchów</span></div>
            </div>
            <div className="hm-intro-stars"><span><b>★</b> ukończenie</span><span><b>★★</b> {LEVEL.starScoreThresholds[2].toLocaleString("pl-PL")} pkt</span><span><b>★★★</b> {LEVEL.starScoreThresholds[3].toLocaleString("pl-PL")} pkt</span></div>
            <button type="button" className="hm-primary" onClick={startGame}><Zap size={19} fill="currentColor" /> ZACZYNAMY</button>
            <small>Przeciągnij kafel w dowolnym kierunku albo kliknij dwa sąsiadujące pola.</small>
          </div>
        </div>
      ) : null}

      <QuizModal state={quizState} iframeRef={quizIframeRef} onAnswer={answerQuiz} onReplay={replayQuiz} onSkip={skipQuizSong} />

      {status === "won" || status === "lost" ? (
        <div className="hm-overlay">
          <div className={`hm-modal hm-result-modal ${status}`}>
            <div className="hm-result-icon">{status === "won" ? <Trophy size={38} /> : <Music2 size={36} />}</div>
            <span className="hm-modal-kicker">POZIOM {LEVEL.number}</span>
            <h2>{status === "won" ? "KONCERT ZALICZONY!" : "JESZCZE RAZ!"}</h2>
            {status === "won" ? <Stars count={resultStars} size={38} className="hm-result-stars" /> : null}
            <p>{status === "won" ? "Cele wykonane. Niewykorzystane ruchy dały stały bonus ENCORE." : "Skończyły się ruchy. Zmiksuj planszę i spróbuj ponownie."}</p>
            <div className="hm-result-stats">
              <div><span>WYNIK</span><strong>{score.toLocaleString("pl-PL")}</strong></div>
              <div className="bonus"><span>BONUS ENCORE</span><strong>+{bonusScore.toLocaleString("pl-PL")}</strong></div>
              <div><span>NAJLEPSZA KASKADA</span><strong>x{Math.max(1, bestCascade)}</strong></div>
              <div><span>RUCHY</span><strong>{moves}</strong></div>
            </div>
            {status === "won" ? (
              <div className="hm-reward-result">
                {rewardState?.saving ? <span>Zapisuję wynik i nagrodę…</span> : null}
                {rewardState?.saved && rewardState.gainedStars > 0 ? <><strong>NOWE GWIAZDKI: +{rewardState.gainedStars}</strong><span>+{rewardState.xp} XP · +{rewardState.hitcoin} HITCOIN</span></> : null}
                {rewardState?.saved && rewardState.gainedStars === 0 ? <span>Wynik zapisany · nagrody za te gwiazdki były już odebrane.</span> : null}
                {rewardState?.guest ? <span>Zaloguj się, aby zapisywać gwiazdki i nagrody.</span> : null}
                {rewardState?.error ? <span className="error">{rewardState.error}</span> : null}
              </div>
            ) : null}
            <button type="button" className="hm-primary" onClick={() => resetGame(true)}><RotateCcw size={18} /> ZAGRAJ PONOWNIE</button>
            <button type="button" className="hm-secondary" onClick={onBack}>WRÓĆ DO HITSTERIADY</button>
          </div>
        </div>
      ) : null}

      {showHelp ? (
        <div className="hm-overlay hm-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="hm-modal hm-help-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="hm-modal-close" onClick={() => setShowHelp(false)}>×</button>
            <span className="hm-modal-kicker">SZYBKA INSTRUKCJA</span>
            <h2>JAK <b>GRAĆ?</b></h2>
            <p>Przeciągnij kafel w górę, dół, lewo lub prawo. Ruch jest zaliczony tylko wtedy, gdy tworzy połączenie albo odpala booster.</p>
            <div className="hm-how-grid">
              <div className="hm-how-card"><span className="hm-demo-icons">{[0,1,2].map((n) => <img key={n} src={microphoneImg} alt="" />)}</span><strong>3 = MATCH</strong><small>Podstawowe połączenie usuwa symbole.</small></div>
              <div className="hm-how-card"><span className="hm-demo-icons four">{[0,1,2,3].map((n) => <img key={n} src={cassetteImg} alt="" />)}</span><strong>4 = BASS LINE</strong><small>Powstaje booster czyszczący rząd lub kolumnę.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special bomb"><Zap size={30} /></span><strong>L/T = BOMBA 3×3</strong><small>Wybucha wokół swojego pola.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special gold"><img src={vinylImg} alt="" /></span><strong>5 = ZŁOTY WINYL</strong><small>Zamień go z symbolem, aby usunąć wszystkie takie kafle.</small></div>
            </div>
            <div className="hm-help-power"><Music2 size={22} /><span><strong>HIT METER</strong><small>Przy 100% uruchom krótki quiz. Poprawna odpowiedź daje +3 ruchy.</small></span></div>
            <button type="button" className="hm-primary" onClick={() => setShowHelp(false)}>ROZUMIEM</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
