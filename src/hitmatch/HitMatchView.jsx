import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Sparkles, Star, Trophy, Zap, Music2, Move, Target, Play, SkipForward, BarChart3, Lock, ChevronRight, Crown, Gamepad2 } from "lucide-react";
import { playCorrectSound, playWrongSound, playVictorySound, unlockAudio, startHitMatchMusic, stopHitMatchMusic, setHitMatchMusicIntensity, playHitMatchComboSound, playHitMatchStarSound, playHitMatchRewardSound, playHitMatchMeterReadySound } from "../sounds.js";
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
import {
  HIT_MATCH_LEVELS,
  HIT_MATCH_STAGES,
  HIT_MATCH_TOTAL_STARS,
  countShieldHp,
  countShieldCells,
  createShieldState,
  getHitMatchStage,
  isHitMatchLevelCompleted,
  starsForHitMatchLevel,
} from "./hitMatchConfig.js";
import { fetchHitMatchLevelLeaderboard, fetchHitMatchStarsLeaderboard, getHitMatchProgress, submitHitMatchLevelResult } from "./hitMatchDb.js";
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

function emptyCollected(level) {
  return Object.keys(level?.goals || {}).reduce((acc, type) => { acc[type] = 0; return acc; }, {});
}

function levelProgressPercent(level, collected, score, shieldsRemaining = 0) {
  const parts = [];
  Object.entries(level?.goals || {}).forEach(([type, target]) => {
    parts.push(Math.min(1, Number(collected?.[type] || 0) / Math.max(1, Number(target || 1))));
  });
  if (level?.scoreGoal) parts.push(Math.min(1, Number(score || 0) / Math.max(1, Number(level.scoreGoal || 1))));
  if ((level?.shields || []).length) {
    const totalShieldHp = countShieldHp(createShieldState(level));
    parts.push(totalShieldHp ? Math.max(0, Math.min(1, 1 - Number(shieldsRemaining || 0) / totalShieldHp)) : 1);
  }
  if (!parts.length) return 0;
  return Math.round((parts.reduce((sum, value) => sum + value, 0) / parts.length) * 100);
}

function compactGoal(level) {
  const entries = Object.entries(level?.goals || {});
  const sameTarget = entries.length === 6 && new Set(entries.map(([, target]) => target)).size === 1;
  const bits = sameTarget
    ? [`Po ${entries[0][1]} każdego symbolu`]
    : entries.map(([type, target]) => `${TYPE_LABELS[type] || type} ${target}`);
  if (level?.scoreGoal) bits.push(`${Number(level.scoreGoal).toLocaleString("pl-PL")} pkt`);
  if ((level?.shields || []).length) bits.push(`Neon Shield ${(level.shields || []).length}`);
  return bits.join(" · ") || "Graj na wynik";
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
const settleBoardVisuals = (board) => (board || []).map((tile) => tile ? ({ ...tile, fresh: false, freshSpecial: false, spawnOrder: 0 }) : tile);
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
    const allowed = (song) => {
      const categories = (song?.categories || []).map((value) => String(value || "").trim().toLowerCase());
      return song?.videoId && song?.artist && song?.title && !categories.includes("rap") && !categories.includes("religijne");
    };
    quizPoolPromise = fetchAllSongsFromDb()
      .then((rows) => rows.filter(allowed))
      .catch(() => REAL_SONGS.filter(allowed));
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

function HitMatchPiece({ tile, index, selected, matched, activated, dragging, colorPhase, colorOrder = -1, swapOffset = null, onPointerDown, onPointerMove, onPointerUp, onClick }) {
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
    colorPhase === "charge" ? "is-color-charged" : "",
    colorPhase === "vanish" ? "is-color-vanishing" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={`hm-piece-slot ${swapOffset ? "is-swap-animating" : ""}`}
      style={{
        "--hm-row": row,
        "--hm-col": col,
        transform: `translate(${col * 100 + (swapOffset?.x || 0)}%, ${row * 100 + (swapOffset?.y || 0)}%)`,
        "--hm-spawn-delay": `${Math.min(120, (tile.spawnOrder || 0) * 18)}ms`,
        "--hm-color-delay": `${Math.max(0, colorOrder) * 16}ms`,
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
        {tile.special === "row" ? <span className="hm-special-arrows horizontal" aria-hidden="true"><b>←</b><b>→</b></span> : null}
        {tile.special === "col" ? <span className="hm-special-arrows vertical" aria-hidden="true"><b>↑</b><b>↓</b></span> : null}
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

function ScoreGoalChip({ value, target }) {
  const done = Number(value || 0) >= Number(target || 0);
  return (
    <div className={`hm-goal-chip hm-score-goal ${done ? "done" : ""}`}>
      <Trophy size={22} />
      <span><small>Wynik</small><strong>{Math.min(Number(value || 0), Number(target || 0)).toLocaleString("pl-PL")} / {Number(target || 0).toLocaleString("pl-PL")}</strong></span>
      {done ? <b>✓</b> : null}
    </div>
  );
}

function ShieldGoalChip({ remaining = 0, total = 0 }) {
  const done = remaining <= 0;
  return (
    <div className={`hm-goal-chip hm-shield-goal ${done ? "done" : ""}`}>
      <span className="hm-shield-mini">◆</span>
      <span><small>NEON SHIELD</small><strong>{Math.max(0, remaining)} / {Math.max(0, total)}</strong></span>
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

function QuizModal({ state, iframeRef, onAnswer, onReplay, onSkip, onPlayerLoad }) {
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
              <button type="button" onClick={onReplay}><Play size={16} fill="currentColor" /> ODTWÓRZ PONOWNIE</button>
              <iframe
                key={`${quiz.song.videoId}-${quiz.startSeconds}-${state.playToken || 0}`}
                ref={iframeRef}
                title="hit-match-quiz-player"
                className="hm-quiz-player"
                src={`https://www.youtube.com/embed/${quiz.song.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${quiz.startSeconds}&controls=0&modestbranding=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                onLoad={() => onPlayerLoad?.(quiz)}
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

function HitMatchGame({ onBack, onNextLevel, nextLevel, level: LEVEL, progressEntry, onProgressUpdate }) {
  const inactiveIndices = LEVEL?.layout?.inactive || [];
  const initialShieldState = () => createShieldState(LEVEL);
  const [board, setBoard] = useState(() => createPlayableBoard(inactiveIndices));
  const [selected, setSelected] = useState(null);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(LEVEL.moves);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState(() => emptyCollected(LEVEL));
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
  const [visualSwap, setVisualSwap] = useState(null);
  const [comboNotice, setComboNotice] = useState(null);
  const [meterReadyNotice, setMeterReadyNotice] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [resultStars, setResultStars] = useState(0);
  const [previousStars, setPreviousStars] = useState(() => Number(progressEntry?.stars || 0));
  const [rewardState, setRewardState] = useState(null);
  const [shields, setShields] = useState(() => initialShieldState());
  const [colorSweep, setColorSweep] = useState(null);
  const [resultDisplayScore, setResultDisplayScore] = useState(0);
  const [resultDisplayStars, setResultDisplayStars] = useState(0);
  const [resultRewardsVisible, setResultRewardsVisible] = useState(false);
  const [resultActionsVisible, setResultActionsVisible] = useState(false);

  const pointerStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const runTokenRef = useRef(0);
  const endingRef = useRef(false);
  const comboTimerRef = useRef(null);
  const comboAudioTimerRef = useRef(null);
  const meterReadyTimerRef = useRef(null);
  const previousHitMeterRef = useRef(0);
  const quizPoolRef = useRef(null);
  const quizIframeRef = useRef(null);
  const shieldsRef = useRef(initialShieldState());
  const statsRef = useRef({
    moves: LEVEL.moves,
    score: 0,
    bonusScore: 0,
    collected: emptyCollected(LEVEL),
    hitMeter: 0,
    shieldsRemaining: countShieldHp(initialShieldState()),
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
    if (comboAudioTimerRef.current) window.clearTimeout(comboAudioTimerRef.current);
    setComboNotice({ level, id: `${Date.now()}_${level}` });
    setHitMatchMusicIntensity(Math.min(5, level));
    playHitMatchComboSound(level);
    comboTimerRef.current = window.setTimeout(() => setComboNotice(null), 1050);
    comboAudioTimerRef.current = window.setTimeout(() => setHitMatchMusicIntensity(0), 1550);
  }, []);

  useEffect(() => {
    setPreviousStars(Number(progressEntry?.stars || 0));
  }, [progressEntry?.stars, LEVEL.id]);

  useEffect(() => () => {
    runTokenRef.current += 1;
    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    if (comboAudioTimerRef.current) window.clearTimeout(comboAudioTimerRef.current);
    if (meterReadyTimerRef.current) window.clearTimeout(meterReadyTimerRef.current);
    stopHitMatchMusic();
  }, []);

  // HIT METER ma własny, jednoznaczny feedback. Komunikat pojawia się dopiero
  // po przekroczeniu 100%, dzięki czemu nie spamuje po każdym rerenderze.
  useEffect(() => {
    const previous = previousHitMeterRef.current;
    previousHitMeterRef.current = hitMeter;
    if (previous < 100 && hitMeter >= 100 && status === "running" && !quizState && !endgame) {
      playHitMatchMeterReadySound();
      if (meterReadyTimerRef.current) window.clearTimeout(meterReadyTimerRef.current);
      const id = `${Date.now()}_meter`;
      // Krótkie opóźnienie pozwala dokończyć komunikat COMBO bez nakładania napisów.
      meterReadyTimerRef.current = window.setTimeout(() => {
        setMeterReadyNotice({ id });
        meterReadyTimerRef.current = window.setTimeout(() => setMeterReadyNotice(null), 1450);
      }, 520);
    }
    if (hitMeter < 100) setMeterReadyNotice(null);
  }, [hitMeter, status, Boolean(quizState), Boolean(endgame)]);

  // Zaczynamy dociągać pulę dopiero pod koniec ładowania paska. Dzięki temu
  // wejście do Hit Match nie generuje tysięcy odczytów, jeśli gracz szybko wyjdzie.
  useEffect(() => {
    if (hitMeter < 70 || quizPoolRef.current) return;
    loadQuizPool().then((pool) => { quizPoolRef.current = pool; }).catch(() => {});
  }, [hitMeter]);

  // Adaptacyjny podkład działa tylko podczas aktywnej planszy. Quiz i ekran końcowy
  // zatrzymują groove, żeby muzyka nie walczyła z fragmentem utworu / fanfarą.
  useEffect(() => {
    if (status === "running" && !quizState && !endgame) {
      startHitMatchMusic();
      setHitMatchMusicIntensity(0);
      return;
    }
    stopHitMatchMusic();
  }, [status, Boolean(quizState), Boolean(endgame)]);

  // Sekwencja wyniku: licznik -> gwiazdki jedna po drugiej -> nagroda -> akcje.
  useEffect(() => {
    if (status !== "won") {
      setResultDisplayScore(0);
      setResultDisplayStars(0);
      setResultRewardsVisible(false);
      setResultActionsVisible(false);
      return undefined;
    }

    const timers = [];
    const targetScore = Math.max(0, Number(score || 0));
    const duration = 760;
    const startAt = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - startAt) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setResultDisplayScore(Math.round(targetScore * eased));
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);

    const firstStarAt = 420;
    for (let star = 1; star <= resultStars; star += 1) {
      timers.push(window.setTimeout(() => {
        setResultDisplayStars(star);
        playHitMatchStarSound(star);
      }, firstStarAt + (star - 1) * 330));
    }
    const rewardAt = firstStarAt + Math.max(1, resultStars) * 330 + 130;
    timers.push(window.setTimeout(() => {
      setResultRewardsVisible(true);
      playHitMatchRewardSound();
    }, rewardAt));
    timers.push(window.setTimeout(() => setResultActionsVisible(true), rewardAt + 240));

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [status, score, resultStars]);

  const resetGame = useCallback((autoStart = false) => {
    runTokenRef.current += 1;
    setBoard(createPlayableBoard(inactiveIndices));
    setSelected(null);
    setDraggingIndex(null);
    setMatched([]);
    setMoves(LEVEL.moves);
    setScore(0);
    setCollected(emptyCollected(LEVEL));
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
    setVisualSwap(null);
    setComboNotice(null);
    setMeterReadyNotice(null);
    previousHitMeterRef.current = 0;
    if (meterReadyTimerRef.current) window.clearTimeout(meterReadyTimerRef.current);
    setQuizState(null);
    setResultStars(0);
    setRewardState(null);
    setResultDisplayScore(0);
    setResultDisplayStars(0);
    setResultRewardsVisible(false);
    setResultActionsVisible(false);
    const nextShields = initialShieldState();
    shieldsRef.current = nextShields;
    setShields(nextShields);
    setColorSweep(null);
    endingRef.current = false;
    statsRef.current = {
      moves: LEVEL.moves,
      score: 0,
      bonusScore: 0,
      collected: emptyCollected(LEVEL),
      hitMeter: 0,
      shieldsRemaining: countShieldHp(nextShields),
    };
    setStatus(autoStart ? "running" : "intro");
  }, [LEVEL]);

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
      onProgressUpdate?.(result.progress);
      setRewardState({ saved: true, ...result });
    } catch (error) {
      if (runTokenRef.current !== token) return;
      setRewardState({ saved: false, error: error?.message || "Nie udało się zapisać nagrody." });
    }
  }, [LEVEL, onProgressUpdate]);

  const finishOrShuffle = useCallback(async (finalBoard, token) => {
    if (runTokenRef.current !== token) return;
    const stats = statsRef.current;
    const won = isHitMatchLevelCompleted(LEVEL, stats);

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
        playHitMatchComboSound(5);
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

    if (!hasPossibleMove(finalBoard, inactiveIndices)) {
      flashBanner("BRAK RUCHÓW", "Miksujemy planszę", "violet", 900);
      await wait(260);
      if (runTokenRef.current !== token) return;
      setMotionMode("shuffle");
      setBoard(shufflePlayable(finalBoard, inactiveIndices));
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
    let shieldHits = 0;
    if ((LEVEL.shields || []).length) {
      const nextShields = { ...shieldsRef.current };
      const shieldContactIndices = specialCreation?.index !== undefined
        ? [...new Set([...actualIndices, specialCreation.index])]
        : actualIndices;
      shieldContactIndices.forEach((index) => {
        const hp = Number(nextShields[index] || 0);
        if (hp > 0) {
          nextShields[index] = Math.max(0, hp - 1);
          shieldHits += 1;
        }
      });
      if (shieldHits) {
        shieldsRef.current = nextShields;
        setShields(nextShields);
        stats.shieldsRemaining = countShieldHp(nextShields);
      }
    }
    stats.score += base + specialBonus + shieldHits * 250;
    // HIT METER ma być rzadkim bonusem, nie czymś odpalanym co kilka ruchów.
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

    const dropped = collapseAndRefill(removed, inactiveIndices);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setColorSweep(null);
    setMotionMode("fall");
    setBoard(dropped);
    await wait(300);
    if (runTokenRef.current !== token) return;
    const settled = settleBoardVisuals(dropped);
    setMotionMode("idle");
    setBoard(settled);

    const nextGroups = findMatches(settled);
    if (nextGroups.length) {
      await wait(75);
      await resolve(settled, nextGroups, token, cascadeLevel + 1, null);
      return;
    }
    await finishOrShuffle(settled, token);
  }, [applyRemovalStats, finishOrShuffle, showCombo]);

  const resolveColorMove = useCallback(async (swapped, a, b, token) => {
    const affected = resolveColorSwap(swapped, a, b) || [];
    const triggeredSpecials = affected.filter((index) => swapped[index]?.special);
    const colorIndex = swapped[a]?.special === "color" ? a : b;
    const partnerIndex = colorIndex === a ? b : a;
    const partnerType = swapped[partnerIndex]?.type;
    setCascade(1);
    setMatched([]);
    setActiveSpecials([colorIndex, ...triggeredSpecials.filter((index) => index !== colorIndex)]);
    setFxMarks([{ key: `gold-${Date.now()}`, kind: "color" }]);
    setSpecialPulse("gold");
    setColorSweep({ phase:"charge", targets:affected, sourceIndex:colorIndex, targetType:partnerType });
    playCorrectSound();
    flashBanner("ZŁOTY WINYL!", `${TYPE_LABELS[partnerType] || "Wybrane symbole"} pod napięciem…`, "gold", 1100);
    await wait(300);
    if (runTokenRef.current !== token) return;
    setColorSweep({ phase:"vanish", targets:affected, sourceIndex:colorIndex, targetType:partnerType });
    setFxMarks([{ key:`gold-wave-${Date.now()}`, kind:"color" }, ...buildSpecialFx(swapped, triggeredSpecials.filter((index) => swapped[index]?.special !== "color"))]);
    await wait(560);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, { special: "color" });
    const removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(35);
    const dropped = collapseAndRefill(removed, inactiveIndices);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setColorSweep(null);
    setMotionMode("fall");
    setBoard(dropped);
    await wait(310);
    if (runTokenRef.current !== token) return;
    const settled = settleBoardVisuals(dropped);
    setMotionMode("idle");
    setBoard(settled);

    const groups = findMatches(settled);
    if (groups.length) {
      await resolveCascades(settled, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(settled, token);
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
    const dropped = collapseAndRefill(removed, inactiveIndices);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setMotionMode("fall");
    setBoard(dropped);
    await wait(310);
    if (runTokenRef.current !== token) return;
    const settled = settleBoardVisuals(dropped);
    setMotionMode("idle");
    setBoard(settled);

    const groups = findMatches(settled);
    if (groups.length) {
      await resolveCascades(settled, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(settled, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner, resolveCascades, syncStats]);

  const attemptSwap = useCallback(async (a, b) => {
    if (status !== "running" || busy || quizState || !areAdjacent(a, b) || !board[a] || !board[b]) return;
    unlockAudio();
    setSelected(null);
    setDraggingIndex(null);
    setBusy(true);
    const token = runTokenRef.current;
    const original = board;
    const swapped = swapBoardCells(original, a, b);

    // Najpierw liczymy wynik ruchu w pamięci. DOM/React nadal pokazuje ORYGINALNĄ
    // planszę — animowane są wyłącznie dwa wskazane sloty. To usuwa artefakt,
    // w którym pionowy swap reorganizował po drodze inne kafle w liście Reacta.
    const colorClear = resolveColorSwap(swapped, a, b);
    const specialClear = colorClear ? null : resolveSpecialSwap(swapped, a, b);
    const groups = colorClear || specialClear?.length ? [] : findMatches(swapped);
    const validMove = Boolean(colorClear || specialClear?.length || groups.length);

    const deltaCol = colOf(b) - colOf(a);
    const deltaRow = rowOf(b) - rowOf(a);
    setMotionMode("swap");
    setVisualSwap({
      a, b,
      aOffset: { x: deltaCol * 100, y: deltaRow * 100 },
      bOffset: { x: -deltaCol * 100, y: -deltaRow * 100 },
    });
    await wait(185);
    if (runTokenRef.current !== token) return;

    if (!validMove) {
      playWrongSound();
      setInvalidFlash(true);
      // Cofnięcie też dotyczy tylko dwóch kafli — dane planszy nie zostały ruszone.
      // Trzymamy klasę animacji do końca powrotu, a dopiero potem ją zdejmujemy.
      setVisualSwap({ a, b, aOffset: { x: 0, y: 0 }, bOffset: { x: 0, y: 0 } });
      await wait(185);
      if (runTokenRef.current !== token) return;
      setInvalidFlash(false);
      setVisualSwap(null);
      setMotionMode("idle");
      setBusy(false);
      return;
    }

    // Commit bez transition: kafel jest już wizualnie w punkcie docelowym, więc
    // podmiana danych nie może wywołać dodatkowego ruchu sąsiednich elementów.
    setMotionMode("commit");
    setBoard(swapped);
    setVisualSwap(null);
    await wait(24);
    if (runTokenRef.current !== token) return;
    setMotionMode("idle");

    if (colorClear) {
      statsRef.current.moves -= 1;
      syncStats();
      await resolveColorMove(swapped, a, b, token);
      return;
    }

    if (specialClear?.length) {
      statsRef.current.moves -= 1;
      syncStats();
      await resolveSpecialMove(swapped, a, b, specialClear, token);
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

  const sendQuizCommand = useCallback((func, args = []) => {
    const win = quizIframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  }, []);

  const kickQuizPlayback = useCallback((quiz) => {
    if (!quiz) return;
    unlockAudio();
    const play = (seek = false) => {
      sendQuizCommand("unMute", []);
      sendQuizCommand("setVolume", [100]);
      if (seek) sendQuizCommand("seekTo", [quiz.startSeconds, true]);
      sendQuizCommand("playVideo", []);
    };
    // YouTube potrafi zgłosić onLoad zanim player jest w pełni gotowy na komendy.
    // Pierwsza próba ustawia pozycję, kolejne tylko ponawiają PLAY — bez słyszalnego
    // cofania fragmentu, jeśli player ruszył już za pierwszym razem.
    play(true);
    window.setTimeout(() => play(false), 180);
    window.setTimeout(() => play(false), 520);
  }, [sendQuizCommand]);

  const replayQuiz = useCallback(() => {
    const quiz = quizState?.quiz;
    if (!quiz) return;
    unlockAudio();
    // Natychmiast próbujemy sterować istniejącym playerem…
    kickQuizPlayback(quiz);
    // …i równocześnie remountujemy iframe. Dzięki temu przycisk działa również,
    // gdy poprzedni embed YouTube wszedł w błędny / zablokowany stan.
    setQuizState((prev) => prev ? { ...prev, playToken: (prev.playToken || 0) + 1 } : prev);
  }, [kickQuizPlayback, quizState?.quiz]);

  const openHitQuiz = useCallback(async () => {
    if (status !== "running" || busy || statsRef.current.hitMeter < 100 || quizState) return;
    unlockAudio();
    stopHitMatchMusic();
    setBusy(true);
    statsRef.current.hitMeter = 0;
    syncStats();
    setQuizState({ loading: true, answered: false, playToken: 0 });
    try {
      const pool = quizPoolRef.current || await loadQuizPool();
      quizPoolRef.current = pool;
      const quiz = buildQuiz(pool);
      if (!quiz) throw new Error("Za mało utworów do quizu.");
      setQuizState({ loading: false, quiz, answered: false, playToken: 1 });
    } catch (error) {
      statsRef.current.hitMeter = 100; // awaria źródła nie zabiera paska
      syncStats();
      setQuizState(null);
      setBusy(false);
      flashBanner("QUIZ NIEDOSTĘPNY", "HIT METER został zwrócony", "pink", 1300);
    }
  }, [busy, flashBanner, quizState, status, syncStats]);

  const skipQuizSong = useCallback(() => {
    const pool = quizPoolRef.current || [];
    const next = buildQuiz(pool, quizState?.quiz?.song?.videoId);
    if (!next) return;
    setQuizState((prev) => ({ loading: false, quiz: next, answered: false, playToken: (prev?.playToken || 0) + 1 }));
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
    flashBanner(`LEVEL ${LEVEL.number}`, LEVEL.title, "cyan", 1000);
  };

  const shieldsRemainingHp = countShieldHp(shields);
  const shieldsTotalHp = countShieldHp(createShieldState(LEVEL));
  const shieldsRemaining = countShieldCells(shields);
  const shieldsTotal = (LEVEL.shields || []).length;
  const progressPct = levelProgressPercent(LEVEL, collected, score, shieldsRemainingHp);
  const currentStage = getHitMatchStage(LEVEL.number);

  return (
    <div className={`hm-page hm-v4 hm-stage-${currentStage.number} hm-motion-${motionMode} ${invalidFlash ? "hm-invalid" : ""}`}>
      <div className="hm-bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="hm-topbar">
        <button type="button" className="hm-back" onClick={onBack}><ArrowLeft size={19} /> <span>WRÓĆ</span></button>
        <div className="hm-title-lockup"><span className="hm-eyebrow">HITSTERIADA ARCADE</span><h1>HIT <b>MATCH</b></h1></div>
        <button type="button" className="hm-help" onClick={() => setShowHelp(true)} aria-label="Jak grać"><span className="hm-help-q">?</span><em>JAK GRAĆ</em></button>
      </header>

      <main className="hm-layout">
        <section className="hm-stage-panel">
          <div className="hm-stage-heading">
            <div><span>{currentStage.title} · POZIOM {LEVEL.number}</span><h2>{LEVEL.title.toUpperCase()}</h2><p>{currentStage.number === 2 ? "Nowe układy planszy i Neon Shield." : "Łącz muzyczne symbole i buduj kaskady."}</p></div>
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
                {inactiveIndices.map((index) => (
                  <span key={`void-${index}`} className="hm-board-void" style={{ left: `${colOf(index) * 12.5}%`, top: `${rowOf(index) * 12.5}%`, transform: "none" }} aria-hidden="true" />
                ))}
                {board.map((tile, index) => tile ? (
                  <HitMatchPiece
                    key={tile.id}
                    tile={tile}
                    index={index}
                    selected={selected === index}
                    matched={matched.includes(index)}
                    activated={activeSpecials.includes(index)}
                    dragging={draggingIndex === index}
                    colorPhase={colorSweep?.targets?.includes(index) ? colorSweep.phase : null}
                    colorOrder={colorSweep?.targets?.indexOf(index) ?? -1}
                    swapOffset={visualSwap?.a === index ? visualSwap.aOffset : visualSwap?.b === index ? visualSwap.bOffset : null}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onClick={handlePieceClick}
                  />
                ) : null)}
                {Object.entries(shields).filter(([, hp]) => Number(hp) > 0).map(([rawIndex, hp]) => {
                  const index = Number(rawIndex);
                  const maxHp = Number(LEVEL.shields?.find((item) => Number(item.index) === index)?.hp || 1);
                  return <span key={`shield-${index}`} className={`hm-neon-shield hp-${hp} ${maxHp > 1 ? "reinforced" : ""}`} style={{ left:`${colOf(index) * 12.5}%`, top:`${rowOf(index) * 12.5}%`, transform:"none" }} aria-hidden="true"><i /><b>{maxHp > 1 ? hp : ""}</b></span>;
                })}
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

              {meterReadyNotice && status === "running" && !endgame && !quizState ? (
                <div key={meterReadyNotice.id} className="hm-meter-ready-badge">
                  HIT METER <b>GOTOWY!</b><small>ODPAL QUIZ · +3 RUCHY</small>
                </div>
              ) : null}
            </div>

            <div className="hm-goals-mobile">
              {Object.entries(LEVEL.goals).map(([type, target]) => <GoalChip key={type} type={type} value={collected[type] || 0} target={target} />)}
              {LEVEL.scoreGoal ? <ScoreGoalChip value={score} target={LEVEL.scoreGoal} /> : null}
              {shieldsTotal ? <ShieldGoalChip remaining={shieldsRemaining} total={shieldsTotal} /> : null}
            </div>
          </div>
        </section>

        <aside className="hm-side-panel">
          <section className="hm-panel hm-objectives">
            <div className="hm-panel-title"><Target size={17} /><span>CEL POZIOMU</span></div>
            <p>{shieldsTotal ? "Zrealizuj cele i rozbij wszystkie warstwy Neon Shield przed końcem ruchów." : LEVEL.scoreGoal && Object.keys(LEVEL.goals).length ? "Zrealizuj cele i osiągnij wymagany wynik przed końcem ruchów." : LEVEL.scoreGoal ? "Zdobądź wymagany wynik przed końcem ruchów." : "Zbierz wszystkie wymagane symbole przed końcem ruchów."}</p>
            <div className="hm-goal-list">
              {Object.entries(LEVEL.goals).map(([type, target]) => <GoalChip key={type} type={type} value={collected[type] || 0} target={target} />)}
              {LEVEL.scoreGoal ? <ScoreGoalChip value={score} target={LEVEL.scoreGoal} /> : null}
              {shieldsTotal ? <ShieldGoalChip remaining={shieldsRemaining} total={shieldsTotal} /> : null}
            </div>
          </section>

          <section className="hm-panel hm-star-rules">
            <div className="hm-panel-title"><Star size={17} /><span>GWIAZDKI I NAGRODY</span></div>
            <div className="hm-star-rule"><Star size={18} fill="currentColor" /><span><strong>Ukończ poziom</strong><small>+20 XP · +10 HITCOIN</small></span></div>
            <div className="hm-star-rule"><span className="two-stars">★★</span><span><strong>{LEVEL.starScoreThresholds[2].toLocaleString("pl-PL")} pkt</strong><small>kolejna gwiazdka i nagroda</small></span></div>
            <div className="hm-star-rule"><span className="three-stars">★★★</span><span><strong>{LEVEL.starScoreThresholds[3].toLocaleString("pl-PL")} pkt</strong><small>pełny komplet</small></span></div>
            <div className="hm-star-rule hm-encore-rule"><span className="encore-mark">↯</span><span><strong>ENCORE +{Number(LEVEL.endgameMoveBonus || 0).toLocaleString("pl-PL")}</strong><small>za każdy niewykorzystany ruch</small></span></div>
          </section>

          <section className="hm-panel hm-specials">
            <div className="hm-panel-title"><Zap size={17} /><span>SPECJALNE COMBO</span></div>
            <div className="hm-special-list">
              <div><b>4</b><span><strong>Bass Line</strong><small>po utworzeniu włącz go do kolejnego matchu, aby wyczyścić linię</small></span></div>
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
            <span className="hm-modal-kicker">HITSTERIADA ARCADE · POZIOM {LEVEL.number}</span>
            <h2>HIT <b>MATCH</b></h2>
            <p>Łącz muzyczne symbole, buduj kaskady i zrealizuj cele przed końcem ruchów.</p>
            <div className="hm-intro-goals">
              {Object.entries(LEVEL.goals).map(([type, target]) => <div key={type}><img src={ICONS[type]} alt="" /><strong>{target}</strong><span>{TYPE_LABELS[type]}</span></div>)}
              {LEVEL.scoreGoal ? <div className="score-goal"><Trophy size={26} /><strong>{Number(LEVEL.scoreGoal).toLocaleString("pl-PL")}</strong><span>punktów</span></div> : null}
              {shieldsTotal ? <div className="shield-goal"><span className="hm-shield-intro-icon">◆</span><strong>{shieldsTotal}</strong><span>Neon Shield</span></div> : null}
              <div className="moves"><Move size={26} /><strong>{LEVEL.moves}</strong><span>ruchów</span></div>
            </div>
            <div className="hm-intro-stars"><span><b>★</b> ukończenie</span><span><b>★★</b> {LEVEL.starScoreThresholds[2].toLocaleString("pl-PL")} pkt</span><span><b>★★★</b> {LEVEL.starScoreThresholds[3].toLocaleString("pl-PL")} pkt</span></div>
            {shieldsTotal ? <div className="hm-stage2-intro-note"><span>◆</span><p><strong>NEON SHIELD</strong><small>Zrób match, który usuwa kafel stojący na osłonie. Każde trafienie zdejmuje jedną warstwę.</small></p></div> : null}
            <button type="button" className="hm-primary" onClick={startGame}><Zap size={19} fill="currentColor" /> ZACZYNAMY</button>
            <small>Przeciągnij kafel w dowolnym kierunku albo kliknij dwa sąsiadujące pola.</small>
          </div>
        </div>
      ) : null}

      <QuizModal state={quizState} iframeRef={quizIframeRef} onAnswer={answerQuiz} onReplay={replayQuiz} onSkip={skipQuizSong} onPlayerLoad={kickQuizPlayback} />

      {status === "won" || status === "lost" ? (
        <div className="hm-overlay">
          <div className={`hm-modal hm-result-modal ${status}`}>
            <div className="hm-result-icon">{status === "won" ? <Trophy size={38} /> : <Music2 size={36} />}</div>
            <span className="hm-modal-kicker">POZIOM {LEVEL.number}</span>
            <h2>{status === "won" ? "KONCERT ZALICZONY!" : "JESZCZE RAZ!"}</h2>
            {status === "won" ? (
              <div className="hm-result-stars hm-result-stars-sequenced">
                {[1, 2, 3].map((n) => <Star key={n} size={42} fill={n <= resultDisplayStars ? "currentColor" : "none"} className={n <= resultDisplayStars ? "earned reveal" : ""} />)}
              </div>
            ) : null}
            <p>{status === "won" ? "Cele wykonane. Niewykorzystane ruchy dały stały bonus ENCORE." : "Skończyły się ruchy. Zmiksuj planszę i spróbuj ponownie."}</p>
            <div className="hm-result-stats">
              <div className="hm-score-counter"><span>WYNIK</span><strong>{(status === "won" ? resultDisplayScore : score).toLocaleString("pl-PL")}</strong></div>
              <div className="bonus"><span>BONUS ENCORE</span><strong>+{bonusScore.toLocaleString("pl-PL")}</strong></div>
              <div><span>NAJLEPSZA KASKADA</span><strong>x{Math.max(1, bestCascade)}</strong></div>
              <div><span>RUCHY</span><strong>{moves}</strong></div>
            </div>
            {status === "won" ? (
              <div className={`hm-reward-result ${resultRewardsVisible ? "show" : "waiting"}`}>
                {!resultRewardsVisible ? <span>Podsumowuję koncert…</span> : null}
                {resultRewardsVisible && rewardState?.saving ? <span>Zapisuję wynik i nagrodę…</span> : null}
                {resultRewardsVisible && rewardState?.saved && rewardState.gainedStars > 0 ? (
                  <>
                    <strong>NOWE GWIAZDKI: +{rewardState.gainedStars}</strong>
                    <div className="hm-reward-fly"><b>+{rewardState.xp} XP</b><b>+{rewardState.hitcoin} HITCOIN</b></div>
                  </>
                ) : null}
                {resultRewardsVisible && rewardState?.saved && rewardState.gainedStars === 0 ? <span>Wynik zapisany · nagrody za te gwiazdki były już odebrane.</span> : null}
                {resultRewardsVisible && rewardState?.guest ? <span>Zaloguj się, aby zapisywać gwiazdki i nagrody.</span> : null}
                {resultRewardsVisible && rewardState?.error ? <span className="error">{rewardState.error}</span> : null}
              </div>
            ) : null}
            <div className={`hm-result-actions ${status === "lost" || resultActionsVisible ? "show" : ""}`}>
              {status === "won" && nextLevel && onNextLevel ? (
                <button type="button" className="hm-primary hm-next-level" onClick={onNextLevel}><ChevronRight size={20} /> NASTĘPNY LEVEL · {nextLevel.number}</button>
              ) : null}
              <button type="button" className={status === "won" && nextLevel ? "hm-secondary" : "hm-primary"} onClick={() => resetGame(true)}><RotateCcw size={18} /> ZAGRAJ PONOWNIE</button>
              <button type="button" className="hm-secondary hm-hub-return" onClick={onBack}>WRÓĆ DO HUBU</button>
            </div>
          </div>
        </div>
      ) : null}

      {showHelp ? (
        <div className="hm-overlay hm-help-overlay" onClick={() => setShowHelp(false)}>
          <div className="hm-modal hm-help-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="hm-modal-close" onClick={() => setShowHelp(false)}>×</button>
            <span className="hm-modal-kicker">SZYBKA INSTRUKCJA</span>
            <h2>JAK <b>GRAĆ?</b></h2>
            <p>Przeciągnij kafel w górę, dół, lewo lub prawo. Ruch jest zaliczony tylko wtedy, gdy tworzy połączenie. Dwa boostery można połączyć bezpośrednio.</p>
            <div className="hm-how-grid">
              <div className="hm-how-card"><span className="hm-demo-icons">{[0,1,2].map((n) => <img key={n} src={microphoneImg} alt="" />)}</span><strong>3 = MATCH</strong><small>Podstawowe połączenie usuwa symbole.</small></div>
              <div className="hm-how-card"><span className="hm-demo-icons four">{[0,1,2,3].map((n) => <img key={n} src={cassetteImg} alt="" />)}</span><strong>4 = BASS LINE</strong><small>Strzałki pokazują kierunek. Booster odpala się dopiero, gdy ponownie wejdzie w match.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special bomb"><Zap size={30} /></span><strong>L/T = BOMBA 3×3</strong><small>Wybucha wokół swojego pola.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special gold"><img src={vinylImg} alt="" /></span><strong>5 = ZŁOTY WINYL</strong><small>Zamień go z symbolem, aby usunąć wszystkie takie kafle.</small></div>
            </div>
            <div className="hm-help-power"><Music2 size={22} /><span><strong>HIT METER</strong><small>Przy 100% uruchom krótki quiz. Poprawna odpowiedź daje +3 ruchy.</small></span></div>
            {currentStage.number >= 2 ? <div className="hm-help-power hm-help-shield"><span className="hm-shield-mini">◆</span><span><strong>NEON SHIELD</strong><small>Usuń kafel z osłoniętego pola, aby zdjąć warstwę. Wzmocnione osłony wymagają kilku trafień.</small></span></div> : null}
            <button type="button" className="hm-primary" onClick={() => setShowHelp(false)}>ROZUMIEM</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HitMatchHub({ onBack }) {
  const [progress, setProgress] = useState({ levels: {}, totalStars: 0, completedLevels: 0, updatedAt: 0 });
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [activeLevelId, setActiveLevelId] = useState(null);
  const [screen, setScreen] = useState("levels");
  const [rankingMode, setRankingMode] = useState("stars");
  const [rankingRows, setRankingRows] = useState(null);
  const [rankingError, setRankingError] = useState("");
  const currentUser = auth.currentUser;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingProgress(true);
      try {
        const next = currentUser?.uid ? await getHitMatchProgress(currentUser.uid) : { levels: {}, totalStars: 0, completedLevels: 0, updatedAt: 0 };
        if (!cancelled) setProgress(next);
      } catch {
        if (!cancelled) setProgress({ levels: {}, totalStars: 0, completedLevels: 0, updatedAt: 0 });
      } finally {
        if (!cancelled) setLoadingProgress(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (screen !== "ranking") return;
    let cancelled = false;
    setRankingRows(null);
    setRankingError("");
    const load = async () => {
      try {
        const rows = rankingMode === "stars"
          ? await fetchHitMatchStarsLeaderboard(20)
          : await fetchHitMatchLevelLeaderboard(rankingMode, 20);
        if (!cancelled) setRankingRows(rows);
      } catch (error) {
        if (!cancelled) {
          setRankingRows([]);
          setRankingError(error?.message || "Nie udało się pobrać rankingu.");
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [screen, rankingMode]);

  const levelIndex = activeLevelId ? HIT_MATCH_LEVELS.findIndex((level) => level.id === activeLevelId) : -1;
  const activeLevel = levelIndex >= 0 ? HIT_MATCH_LEVELS[levelIndex] : null;

  if (activeLevel) {
    return (
      <HitMatchGame
        key={activeLevel.id}
        level={activeLevel}
        progressEntry={progress.levels?.[activeLevel.id] || null}
        nextLevel={levelIndex >= 0 ? HIT_MATCH_LEVELS[levelIndex + 1] || null : null}
        onNextLevel={levelIndex >= 0 && HIT_MATCH_LEVELS[levelIndex + 1] ? () => setActiveLevelId(HIT_MATCH_LEVELS[levelIndex + 1].id) : null}
        onProgressUpdate={(nextProgress) => setProgress(nextProgress)}
        onBack={() => setActiveLevelId(null)}
      />
    );
  }

  const isUnlocked = (level, index) => {
    if (index === 0) return true;
    if (progress.levels?.[level.id]?.completed) return true;
    const previous = HIT_MATCH_LEVELS[index - 1];
    return !!progress.levels?.[previous.id]?.completed;
  };

  const nextLevel = HIT_MATCH_LEVELS.find((level, index) => isUnlocked(level, index) && !progress.levels?.[level.id]?.completed)
    || HIT_MATCH_LEVELS.find((level, index) => isUnlocked(level, index))
    || HIT_MATCH_LEVELS[0];

  const progressPct = Math.max(0, Math.min(100, Math.round((Number(progress.totalStars || 0) / HIT_MATCH_TOTAL_STARS) * 100)));
  const selectedRankingLevel = rankingMode === "stars" ? null : HIT_MATCH_LEVELS.find((level) => level.id === rankingMode);

  return (
    <div className="hm-page hm-hub-page">
      <div className="hm-bg" aria-hidden="true"><i /><i /><i /></div>
      <header className="hm-topbar hm-hub-topbar">
        <button type="button" className="hm-back" onClick={onBack}><ArrowLeft size={19} /> <span>WRÓĆ</span></button>
        <div className="hm-title-lockup"><span className="hm-eyebrow">HITSTERIADA ARCADE</span><h1>HIT <b>MATCH</b></h1></div>
        <button type="button" className={`hm-hub-rank-btn ${screen === "ranking" ? "active" : ""}`} onClick={() => setScreen(screen === "ranking" ? "levels" : "ranking")}>
          <BarChart3 size={18} /><span>{screen === "ranking" ? "POZIOMY" : "RANKING"}</span>
        </button>
      </header>

      {screen === "levels" ? (
        <main className="hm-hub-main">
          <section className="hm-hub-hero">
            <div className="hm-hub-hero-copy">
              <span className="hm-hub-kicker">20 POZIOMÓW · 60 GWIAZDEK</span>
              <h2>PIERWSZA <b>TRASA</b></h2>
              <p>Pierwsza część trasy uczy podstaw, kolejne dziesiątki zmieniają układ planszy i dokładają nowe mechaniki. Każda nowa gwiazdka to <strong>20 XP + 10 HITCOIN</strong>.</p>
              <button type="button" className="hm-primary hm-hub-continue" onClick={() => setActiveLevelId(nextLevel.id)}>
                <Play size={19} fill="currentColor" /> {progress.levels?.[nextLevel.id]?.completed ? "ZAGRAJ PONOWNIE" : `GRAJ · LEVEL ${nextLevel.number}`}
              </button>
            </div>
            <div className="hm-hub-progress-card">
              <div className="hm-hub-progress-ring" style={{ "--hm-progress": `${progressPct}%` }}>
                <span><strong>{loadingProgress ? "…" : progress.totalStars || 0}</strong><small>/ {HIT_MATCH_TOTAL_STARS} ★</small></span>
              </div>
              <div className="hm-hub-progress-meta">
                <span><small>UKOŃCZONE</small><strong>{progress.completedLevels || 0} / {HIT_MATCH_LEVELS.length}</strong></span>
                <span><small>POSTĘP</small><strong>{progressPct}%</strong></span>
              </div>
            </div>
          </section>

          <section className="hm-levels-section">
            <div className="hm-levels-heading">
              <div><span>WYBIERZ POZIOM</span><h3>PIERWSZA TRASA</h3></div>
              <div className="hm-levels-legend"><span><i className="open" /> dostępny</span><span><i className="done" /> ukończony</span><span><i className="locked" /> zablokowany</span></div>
            </div>

            <div className="hm-stage-groups">
              {HIT_MATCH_STAGES.map((stage) => {
                const stageLevels = HIT_MATCH_LEVELS.filter((level) => level.number >= stage.from && level.number <= stage.to);
                const stageUnlocked = stage.number === 1 || !!progress.levels?.[`level_${stage.from - 1}`]?.completed || stageLevels.some((level) => progress.levels?.[level.id]?.completed);
                const stageStars = stageLevels.reduce((sum, level) => sum + Number(progress.levels?.[level.id]?.stars || 0), 0);
                return (
                  <div key={stage.id} className={`hm-stage-group stage-${stage.number} ${stageUnlocked ? "open" : "locked"}`}>
                    <div className="hm-stage-group-heading">
                      <div><span>POZIOMY {stage.from}–{stage.to}</span><h4>{stage.title}</h4><small>{stage.subtitle}</small></div>
                      <div className="hm-stage-group-meta"><b>{stageStars} / {stageLevels.length * 3} ★</b><span>{stage.mechanic}</span></div>
                    </div>
                    <div className="hm-level-grid">
                      {stageLevels.map((level) => {
                        const index = HIT_MATCH_LEVELS.findIndex((item) => item.id === level.id);
                        const entry = progress.levels?.[level.id] || {};
                        const unlocked = isUnlocked(level, index);
                        const completed = !!entry.completed;
                        const stars = Number(entry.stars || 0);
                        return (
                          <button
                            type="button"
                            key={level.id}
                            className={`hm-level-card ${unlocked ? "unlocked" : "locked"} ${completed ? "completed" : ""} ${level.finale ? "finale" : ""} ${stage.number === 2 ? "stage-two" : ""}`}
                            disabled={!unlocked}
                            onClick={() => unlocked && setActiveLevelId(level.id)}
                          >
                            <div className="hm-level-number">{unlocked ? String(level.number).padStart(2, "0") : <Lock size={18} />}</div>
                            <div className="hm-level-card-body">
                              <span className="hm-level-subtitle">{level.subtitle}</span>
                              <strong>{level.title}</strong>
                              <small>{unlocked ? compactGoal(level) : `Ukończ level ${level.number - 1}`}</small>
                            </div>
                            <div className="hm-level-card-side">
                              <Stars count={stars} size={18} />
                              {entry.bestScore ? <small>{Number(entry.bestScore).toLocaleString("pl-PL")} pkt</small> : <small>{unlocked ? `${level.moves} ruchów` : "LOCK"}</small>}
                              {unlocked ? <ChevronRight size={19} /> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      ) : (
        <main className="hm-ranking-main">
          <section className="hm-ranking-hero">
            <div>
              <span className="hm-hub-kicker">HIT MATCH · RANKING</span>
              <h2>NAJLEPSI NA <b>SCENIE</b></h2>
              <p>Ranking główny liczy zdobyte gwiazdki. Wyniki punktowe porównujemy wyłącznie w obrębie tego samego levelu.</p>
            </div>
            <div className="hm-ranking-filter">
              <label htmlFor="hm-ranking-mode">Ranking</label>
              <select id="hm-ranking-mode" value={rankingMode} onChange={(event) => setRankingMode(event.target.value)}>
                <option value="stars">Łączna liczba gwiazdek</option>
                {HIT_MATCH_LEVELS.map((level) => <option key={level.id} value={level.id}>Level {level.number} · {level.title}</option>)}
              </select>
            </div>
          </section>

          <section className="hm-ranking-card">
            <div className="hm-ranking-title-row">
              <div><Trophy size={22} /><span><strong>{rankingMode === "stars" ? "GWIAZDKI" : `LEVEL ${selectedRankingLevel?.number}`}</strong><small>{rankingMode === "stars" ? `maks. ${HIT_MATCH_TOTAL_STARS} ★` : selectedRankingLevel?.title}</small></span></div>
              {rankingMode !== "stars" ? <span className="hm-ranking-goal">{compactGoal(selectedRankingLevel)}</span> : null}
            </div>

            {rankingRows === null ? (
              <div className="hm-ranking-empty"><Sparkles size={28} /><strong>Ładuję ranking…</strong></div>
            ) : rankingError ? (
              <div className="hm-ranking-empty error"><Music2 size={28} /><strong>Nie udało się pobrać rankingu</strong><span>{rankingError}</span></div>
            ) : rankingRows.length === 0 ? (
              <div className="hm-ranking-empty"><Gamepad2 size={28} /><strong>Jeszcze bez wyników</strong><span>Zagraj jako pierwszy.</span></div>
            ) : (
              <div className="hm-ranking-list">
                {rankingRows.map((row, index) => {
                  const isMe = row.uid === currentUser?.uid;
                  return (
                    <div key={`${row.uid}-${index}`} className={`hm-ranking-row ${isMe ? "me" : ""} place-${index + 1}`}>
                      <div className="hm-rank-place">{index === 0 ? <Crown size={18} fill="currentColor" /> : index + 1}</div>
                      <div className="hm-rank-name"><strong>{row.name}</strong>{isMe ? <small>TY</small> : null}</div>
                      {rankingMode === "stars" ? (
                        <div className="hm-rank-score"><strong>{row.stars} ★</strong><small>{row.completedLevels} lvl</small></div>
                      ) : (
                        <div className="hm-rank-score"><strong>{Number(row.score || 0).toLocaleString("pl-PL")}</strong><Stars count={row.stars || 0} size={13} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  );
}

export default function HitMatchView({ onBack }) {
  return <HitMatchHub onBack={onBack} />;
}
