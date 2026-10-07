import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, RotateCcw, Sparkles, Star, Trophy, Zap, Music2, Move, Target } from "lucide-react";
import { playCorrectSound, playWrongSound, playVictorySound, unlockAudio } from "../sounds.js";
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

const LEVEL = {
  number: 1,
  moves: 25,
  goals: { vinyl: 12, microphone: 10 },
};

const ENDGAME_MOVE_BONUS = 750;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function HitMatchPiece({ tile, index, selected, matched, activated, targetable, onPointerDown, onPointerMove, onPointerUp, onClick }) {
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
    targetable ? "is-power-targetable" : "",
    tile.fresh ? "is-fresh" : "",
    tile.freshSpecial ? "is-special-born" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className="hm-piece-slot"
      style={{
        "--hm-row": row,
        "--hm-col": col,
        "--hm-spawn-delay": `${Math.min(180, (tile.spawnOrder || 0) * 28)}ms`,
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

export default function HitMatchView({ onBack }) {
  const [board, setBoard] = useState(() => createPlayableBoard());
  const [selected, setSelected] = useState(null);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(LEVEL.moves);
  const [score, setScore] = useState(0);
  const [collected, setCollected] = useState({ vinyl: 0, microphone: 0 });
  const [hitMeter, setHitMeter] = useState(0);
  const [status, setStatus] = useState("intro"); // intro | running | won | lost
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(null);
  const [invalidFlash, setInvalidFlash] = useState(false);
  const [cascade, setCascade] = useState(0);
  const [bestCascade, setBestCascade] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showPower, setShowPower] = useState(false);
  const [specialPulse, setSpecialPulse] = useState("");
  const [activeSpecials, setActiveSpecials] = useState([]);
  const [fxMarks, setFxMarks] = useState([]);
  const [powerTarget, setPowerTarget] = useState(null);
  const [endgame, setEndgame] = useState(null);
  const [bonusScore, setBonusScore] = useState(0);

  const pointerStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const runTokenRef = useRef(0);
  const endingRef = useRef(false);
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

  const flashBanner = useCallback((title, subtitle = "", tone = "cyan", hold = 800) => {
    const id = `${Date.now()}_${Math.random()}`;
    setBanner({ id, title, subtitle, tone });
    window.setTimeout(() => setBanner((current) => current?.id === id ? null : current), hold);
  }, []);

  const resetGame = useCallback((autoStart = false) => {
    runTokenRef.current += 1;
    setBoard(createPlayableBoard());
    setSelected(null);
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
    setShowPower(false);
    setSpecialPulse("");
    setActiveSpecials([]);
    setFxMarks([]);
    setPowerTarget(null);
    setEndgame(null);
    setBonusScore(0);
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

  useEffect(() => () => { runTokenRef.current += 1; }, []);

  const finishOrShuffle = useCallback(async (finalBoard, token) => {
    if (runTokenRef.current !== token) return;
    const stats = statsRef.current;
    const won = Object.entries(LEVEL.goals).every(([type, target]) => (stats.collected[type] || 0) >= target);

    if (won) {
      if (endingRef.current) return;
      endingRef.current = true;
      setBusy(true);
      setCascade(0);
      setPowerTarget(null);
      setShowPower(false);

      const remaining = Math.max(0, stats.moves);
      let bonusBoard = finalBoard.slice();

      if (remaining > 0) {
        setEndgame({ phase: "charging", total: remaining, left: remaining });
        flashBanner("ENCORE!", `${remaining} niewykorzystanych ruchów zamienia się w bonus`, "gold", 1800);
        await wait(700);
        if (runTokenRef.current !== token) return;

        const pace = remaining >= 12 ? 82 : remaining >= 7 ? 105 : 135;
        for (let step = 0; step < remaining; step += 1) {
          const candidates = bonusBoard
            .map((tile, index) => ({ tile, index }))
            .filter(({ tile }) => tile && !tile.special);
          if (!candidates.length) break;

          const picked = candidates[Math.floor(Math.random() * candidates.length)];
          const makeGold = remaining >= 5 && step === remaining - 1;
          const cycle = ["row", "col", "bomb"];
          const special = makeGold ? "color" : cycle[step % cycle.length];
          bonusBoard[picked.index] = {
            ...picked.tile,
            type: special === "color" ? "wild" : picked.tile.type,
            special,
            freshSpecial: true,
          };

          stats.moves = Math.max(0, stats.moves - 1);
          stats.score += ENDGAME_MOVE_BONUS;
          stats.bonusScore = (stats.bonusScore || 0) + ENDGAME_MOVE_BONUS;
          syncStats();
          setBoard(bonusBoard.slice());
          setActiveSpecials([picked.index]);
          setEndgame({ phase: "charging", total: remaining, left: Math.max(0, remaining - step - 1) });
          await wait(pace);
          if (runTokenRef.current !== token) return;
        }

        setActiveSpecials([]);
        const specials = bonusBoard
          .map((tile, index) => tile?.special ? index : null)
          .filter((index) => index !== null);

        if (specials.length) {
          const affected = expandSpecialEffects(bonusBoard, specials);
          setEndgame({ phase: "blast", total: remaining, left: 0 });
          setMatched(affected);
          setActiveSpecials(specials);
          setFxMarks(buildSpecialFx(bonusBoard, specials));
          setSpecialPulse("mega");
          flashBanner("FINAL DROP!", "Pozostałe ruchy odpalają boostery", "gold", 1500);
          playCorrectSound();
          await wait(760);
          if (runTokenRef.current !== token) return;

          stats.score += affected.length * 140;
          syncStats();
          const removed = removeIndices(bonusBoard, affected, null);
          setBoard(removed);
          await wait(120);
          if (runTokenRef.current !== token) return;

          const dropped = collapseAndRefill(removed);
          setMatched([]);
          setActiveSpecials([]);
          setFxMarks([]);
          setBoard(dropped);
          await wait(560);
          if (runTokenRef.current !== token) return;
        }
      }

      setEndgame(null);
      setSpecialPulse("");
      setActiveSpecials([]);
      setFxMarks([]);
      setBusy(false);
      setStatus("won");
      playVictorySound();
      flashBanner("POZIOM UKOŃCZONY!", remaining > 0 ? `Bonus ENCORE: +${(remaining * ENDGAME_MOVE_BONUS).toLocaleString("pl-PL")}` : "Pierwszy Drop zaliczony", "gold", 1700);
      return;
    }

    if (stats.moves <= 0) {
      setBusy(false);
      setStatus("lost");
      setCascade(0);
      flashBanner("KONIEC RUCHÓW", "Spróbuj ponownie", "pink", 1200);
      return;
    }

    if (!hasPossibleMove(finalBoard)) {
      flashBanner("BRAK RUCHÓW", "Miksujemy planszę", "violet", 1000);
      await wait(520);
      if (runTokenRef.current !== token) return;
      setBoard(shufflePlayable(finalBoard));
      await wait(420);
    }
    if (runTokenRef.current === token) {
      setCascade(0);
      setBusy(false);
    }
  }, [flashBanner, syncStats]);

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
    stats.hitMeter = clamp(stats.hitMeter + actualIndices.length * 4 + Math.max(0, cascadeLevel - 1) * 10, 0, 100);
    syncStats();
  }, [syncStats]);

  const resolveCascades = useCallback(async function resolve(currentBoard, groups, token, cascadeLevel = 1, swapMeta = null) {
    if (runTokenRef.current !== token) return;
    setCascade(cascadeLevel);
    setBestCascade((value) => Math.max(value, cascadeLevel));
    if (cascadeLevel >= 2) {
      flashBanner(
        `COMBO x${cascadeLevel}`,
        cascadeLevel >= 4 ? "MEGA KASKADA!" : cascadeLevel === 3 ? "Świetna seria!" : "Kaskada!",
        cascadeLevel >= 4 ? "gold" : "cyan",
        1350,
      );
    }

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
    await wait(triggeredSpecials.length ? 620 : 520);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(currentBoard, affected, cascadeLevel, specialCreation);
    const removed = removeIndices(currentBoard, affected, specialCreation);
    setBoard(removed);
    await wait(110);
    if (runTokenRef.current !== token) return;

    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setBoard(dropped);
    await wait(560);
    if (runTokenRef.current !== token) return;

    const nextGroups = findMatches(dropped);
    if (nextGroups.length) {
      await wait(120);
      await resolve(dropped, nextGroups, token, cascadeLevel + 1, null);
      return;
    }

    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner]);

  const resolveColorMove = useCallback(async (swapped, a, b, token) => {
    const affected = resolveColorSwap(swapped, a, b) || [];
    const triggeredSpecials = affected.filter((index) => swapped[index]?.special);
    setCascade(1);
    setMatched(affected);
    setActiveSpecials(triggeredSpecials);
    setFxMarks([{ key: `gold-${Date.now()}`, kind: "color" }, ...buildSpecialFx(swapped, triggeredSpecials.filter((index) => swapped[index]?.special !== "color"))]);
    setSpecialPulse("gold");
    playCorrectSound();
    flashBanner("ZŁOTY WINYL!", "Wybrany symbol znika z całej planszy", "gold", 1300);
    await wait(700);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, { special: "color" });
    const removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(120);
    if (runTokenRef.current !== token) return;

    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setSpecialPulse("");
    setBoard(dropped);
    await wait(580);
    if (runTokenRef.current !== token) return;

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
    flashBanner(
      label || "HIT POWER!",
      specials.length > 1 ? "Boostery łączą siły" : specials[0]?.special === "bomb" ? "Wybuch 3×3 wokół bomby" : "Booster aktywowany",
      specials.length > 1 ? "gold" : "violet",
      1400,
    );
    await wait(specials.length > 1 ? 760 : 650);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, null);
    statsRef.current.score += specials.length > 1 ? 1400 : 550;
    syncStats();
    const removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(120);
    if (runTokenRef.current !== token) return;

    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setBoard(dropped);
    await wait(600);
    if (runTokenRef.current !== token) return;
    setSpecialPulse("");

    const groups = findMatches(dropped);
    if (groups.length) {
      await resolveCascades(dropped, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner, resolveCascades, syncStats]);

  const activateHitPower = useCallback(async (kind) => {
    if (status !== "running" || busy || statsRef.current.hitMeter < 100) return;
    unlockAudio();
    setShowPower(false);

    if (kind === "encore") {
      setBusy(true);
      statsRef.current.hitMeter = 0;
      statsRef.current.moves += 3;
      syncStats();
      flashBanner("ENCORE!", "+3 ruchy", "lime", 1300);
      setSpecialPulse("power");
      await wait(620);
      setSpecialPulse("");
      setBusy(false);
      return;
    }

    setPowerTarget(kind);
    setSelected(null);
    flashBanner(
      kind === "blast" ? "BASS BLAST" : "ZŁOTY WINYL",
      kind === "blast" ? "Wskaż pole — wyczyścimy jego rząd i kolumnę" : "Wskaż zwykły kafel, który zamienimy w Złoty Winyl",
      kind === "blast" ? "cyan" : "gold",
      1700,
    );
  }, [busy, flashBanner, status, syncStats]);

  const executePowerTarget = useCallback(async (index) => {
    if (!powerTarget || status !== "running" || busy || statsRef.current.hitMeter < 100) return;
    const token = runTokenRef.current;
    const targetTile = board[index];
    if (!targetTile) return;

    if (powerTarget === "gold" && targetTile.special) {
      flashBanner("WYBIERZ ZWYKŁY KAFEL", "Specjalnego kafla nie nadpisujemy", "pink", 1100);
      return;
    }

    setBusy(true);
    setPowerTarget(null);
    statsRef.current.hitMeter = 0;
    syncStats();

    if (powerTarget === "gold") {
      const next = board.slice();
      next[index] = { ...targetTile, type: "wild", special: "color", freshSpecial: true };
      setBoard(next);
      setActiveSpecials([index]);
      setFxMarks([{ key: `target-gold-${Date.now()}`, kind: "color-soft", row: rowOf(index), col: colOf(index) }]);
      setSpecialPulse("gold");
      flashBanner("ZŁOTY WINYL!", "Gotowy — zamień go z wybranym symbolem", "gold", 1400);
      await wait(760);
      if (runTokenRef.current !== token) return;
      setActiveSpecials([]);
      setFxMarks([]);
      setSpecialPulse("");
      setBusy(false);
      return;
    }

    const row = rowOf(index);
    const col = colOf(index);
    const base = [];
    for (let c = 0; c < HIT_MATCH_COLS; c += 1) base.push(row * HIT_MATCH_COLS + c);
    for (let r = 0; r < HIT_MATCH_ROWS; r += 1) base.push(r * HIT_MATCH_COLS + col);
    const affected = expandSpecialEffects(board, [...new Set(base)]);
    const chainedSpecials = affected.filter((i) => board[i]?.special);

    setMatched(affected);
    setActiveSpecials(chainedSpecials);
    setFxMarks([
      { key: `blast-row-${Date.now()}`, kind: "row", row },
      { key: `blast-col-${Date.now()}`, kind: "col", col },
      { key: `blast-core-${Date.now()}`, kind: "bomb", row, col },
      ...buildSpecialFx(board, chainedSpecials),
    ]);
    setSpecialPulse("blast");
    playCorrectSound();
    flashBanner("BASS BLAST!", "Dokładnie ten rząd i ta kolumna", "cyan", 1500);
    await wait(720);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(board, affected, 1, null);
    statsRef.current.score += 900;
    syncStats();
    const removed = removeIndices(board, affected, null);
    setBoard(removed);
    await wait(120);
    if (runTokenRef.current !== token) return;

    const dropped = collapseAndRefill(removed);
    setMatched([]);
    setActiveSpecials([]);
    setFxMarks([]);
    setBoard(dropped);
    await wait(600);
    if (runTokenRef.current !== token) return;
    setSpecialPulse("");

    const groups = findMatches(dropped);
    if (groups.length) {
      await resolveCascades(dropped, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, board, busy, finishOrShuffle, flashBanner, powerTarget, resolveCascades, status, syncStats]);

  const attemptSwap = useCallback(async (a, b) => {
    if (status !== "running" || busy || !areAdjacent(a, b)) return;
    unlockAudio();
    setSelected(null);
    setBusy(true);
    const token = runTokenRef.current;
    const original = board;
    const swapped = swapBoardCells(original, a, b);
    setBoard(swapped);
    await wait(230);
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
      await wait(180);
      if (runTokenRef.current !== token) return;
      setBoard(original);
      await wait(240);
      setInvalidFlash(false);
      setBusy(false);
      return;
    }

    statsRef.current.moves -= 1;
    syncStats();
    await resolveCascades(swapped, groups, token, 1, { a, b });
  }, [board, busy, resolveCascades, resolveColorMove, resolveSpecialMove, status, syncStats]);

  const handlePieceClick = useCallback((index) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (busy || status !== "running") return;
    if (powerTarget) {
      executePowerTarget(index);
      return;
    }
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
  }, [attemptSwap, busy, executePowerTarget, powerTarget, selected, status]);

  const handlePointerDown = useCallback((event, index) => {
    if (busy || status !== "running") return;
    event.preventDefault();
    if (powerTarget) return;
    pointerStartRef.current = {
      index,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [busy, powerTarget, status]);


  const handlePointerMove = useCallback((event, index) => {
    const start = pointerStartRef.current;
    if (!start || start.index !== index || start.pointerId !== event.pointerId || busy || status !== "running") return;
    event.preventDefault();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    const dominant = Math.max(Math.abs(dx), Math.abs(dy));
    const secondary = Math.min(Math.abs(dx), Math.abs(dy));
    if (secondary > dominant * 0.78) return;
    event.preventDefault();
    pointerStartRef.current = null;
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
  }, [attemptSwap, busy, status]);

  const handlePointerUp = useCallback((event, index, cancelled = false) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || cancelled || start.index !== index || busy || status !== "running") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 26) return;
    const dominant = Math.max(Math.abs(dx), Math.abs(dy));
    const secondary = Math.min(Math.abs(dx), Math.abs(dy));
    if (secondary > dominant * 0.78) return;
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
  }, [attemptSwap, busy, status]);

  const startGame = () => {
    unlockAudio();
    resetGame(true);
    flashBanner("LEVEL 1", "Zbierz cele, zanim skończą się ruchy", "cyan", 1100);
  };

  const progressPct = Math.round((Object.entries(LEVEL.goals).reduce((sum, [type, target]) => sum + Math.min(1, (collected[type] || 0) / target), 0) / Object.keys(LEVEL.goals).length) * 100);

  return (
    <div className={`hm-page ${invalidFlash ? "hm-invalid" : ""}`}>
      <div className="hm-bg" aria-hidden="true"><i /><i /><i /></div>

      <header className="hm-topbar">
        <button type="button" className="hm-back" onClick={onBack}><ArrowLeft size={19} /> <span>WRÓĆ</span></button>
        <div className="hm-title-lockup">
          <span className="hm-eyebrow">HITSTERIADA ARCADE</span>
          <h1>HIT <b>MATCH</b></h1>
        </div>
        <button type="button" className="hm-help" onClick={() => setShowHelp(true)} aria-label="Jak grać"><span className="hm-help-q">?</span><em>JAK GRAĆ</em></button>
      </header>

      <main className="hm-layout">
        <section className="hm-stage-panel">
          <div className="hm-stage-heading">
            <div><span>POZIOM {LEVEL.number}</span><h2>PIERWSZY DROP</h2><p>Łącz muzyczne symbole i buduj kaskady.</p></div>
            <div className="hm-stage-progress"><strong>{progressPct}%</strong><span><i style={{ width: `${progressPct}%` }} /></span></div>
          </div>

          <div className="hm-hud-row">
            <div className="hm-stat-card moves"><Move size={18} /><span><small>RUCHY</small><strong>{moves}</strong></span></div>
            <div className="hm-stat-card score"><Trophy size={18} /><span><small>WYNIK</small><strong>{score.toLocaleString("pl-PL")}</strong></span></div>
            <button type="button" className={`hm-meter-card ${hitMeter >= 100 ? "ready" : ""}`} onClick={() => hitMeter >= 100 && !busy && !powerTarget && !endgame && setShowPower(true)} disabled={hitMeter < 100 || busy || Boolean(powerTarget) || Boolean(endgame)}>
              <div><Music2 size={19} /><span><small>{hitMeter >= 100 ? "HIT POWER GOTOWY" : "HIT METER"}</small><strong>{Math.min(hitMeter, 100)}%</strong></span></div>
              <b><i style={{ width: `${Math.min(hitMeter, 100)}%` }} /></b>
              {hitMeter >= 100 ? <em>ODPAL HIT POWER</em> : null}
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
                    targetable={Boolean(powerTarget) && (powerTarget !== "gold" || !tile.special)}
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
                  if (fx.kind === "color-soft") return <i key={fx.key} className="hm-fx-gold-mark" style={{ left: `${((fx.col + 0.5) / HIT_MATCH_COLS) * 100}%`, top: `${((fx.row + 0.5) / HIT_MATCH_ROWS) * 100}%` }} />;
                  return <i key={fx.key} className="hm-fx-color-wave" />;
                })}
              </div>

              {powerTarget && status === "running" ? (
                <div className="hm-target-callout">
                  <span>{powerTarget === "blast" ? "BASS BLAST" : "ZŁOTY WINYL"}</span>
                  <strong>{powerTarget === "blast" ? "WSKAŻ POLE" : "WYBIERZ ZWYKŁY KAFEL"}</strong>
                  <button type="button" onClick={() => setPowerTarget(null)}>ANULUJ</button>
                </div>
              ) : null}

              {endgame ? (
                <div className={`hm-endgame-badge ${endgame.phase}`}>
                  <span>ENCORE</span>
                  <strong>{endgame.phase === "blast" ? "FINAL DROP!" : `${endgame.left} RUCHÓW`}</strong>
                  <small>{endgame.phase === "blast" ? "Boostery odpalają się automatycznie" : `+${ENDGAME_MOVE_BONUS} pkt za każdy`}</small>
                </div>
              ) : null}

              {cascade >= 2 && status === "running" && !endgame ? <div key={cascade} className={`hm-combo-badge combo-${Math.min(cascade, 5)}`}>COMBO <b>x{cascade}</b><small>{cascade >= 4 ? "MEGA KASKADA" : cascade === 3 ? "ŚWIETNA SERIA" : "KASKADA"}</small></div> : null}
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
            <div className="hm-goal-list">
              {Object.entries(LEVEL.goals).map(([type, target]) => <GoalChip key={type} type={type} value={collected[type] || 0} target={target} />)}
            </div>
          </section>

          <section className="hm-panel hm-specials">
            <div className="hm-panel-title"><Zap size={17} /><span>SPECJALNE COMBO</span></div>
            <div className="hm-special-list">
              <div><b>4</b><span><strong>Bass Line</strong><small>czyści cały rząd lub kolumnę</small></span></div>
              <div><b>L/T</b><span><strong>Bomba 3×3</strong><small>wybucha dokładnie wokół siebie</small></span></div>
              <div><b>5</b><span><strong>Złoty Winyl</strong><small>zamień z symbolem, aby usunąć wszystkie takie kafle</small></span></div>
            </div>
          </section>

          <section className="hm-panel hm-tip">
            <span>♪</span><p><strong>TIP</strong> Kaskady szybciej ładują HIT METER. Przy 100% sam wybierasz HIT POWER.</p>
          </section>

          <button type="button" className="hm-restart" onClick={() => resetGame(true)}><RotateCcw size={16} /> NOWA PLANSZA</button>
        </aside>
      </main>

      {banner ? <div className={`hm-banner tone-${banner.tone}`} key={banner.id}><strong>{banner.title}</strong>{banner.subtitle ? <span>{banner.subtitle}</span> : null}</div> : null}

      {status === "intro" ? (
        <div className="hm-overlay">
          <div className="hm-modal hm-intro-modal">
            <span className="hm-modal-kicker">HITSTERIADA ARCADE · POZIOM 1</span>
            <h2>HIT <b>MATCH</b></h2>
            <p>Łącz muzyczne symbole, buduj kaskady i wykorzystuj boostery. Zrealizuj cele, zanim skończą się ruchy.</p>
            <div className="hm-intro-goals">
              {Object.entries(LEVEL.goals).map(([type, target]) => <div key={type}><img src={ICONS[type]} alt="" /><strong>{target}</strong><span>{TYPE_LABELS[type]}</span></div>)}
              <div className="moves"><Move size={26} /><strong>{LEVEL.moves}</strong><span>ruchów</span></div>
            </div>
            <button type="button" className="hm-primary" onClick={startGame}><Zap size={19} fill="currentColor" /> ZACZYNAMY</button>
            <small>Możesz przeciągać kafelki albo klikać dwa sąsiadujące pola.</small>
          </div>
        </div>
      ) : null}


      {showPower ? (
        <div className="hm-overlay hm-power-overlay" onClick={() => !busy && setShowPower(false)}>
          <div className="hm-modal hm-power-modal" onClick={(event) => event.stopPropagation()}>
            <span className="hm-modal-kicker">HIT METER · 100%</span>
            <h2>WYBIERZ <b>HIT POWER</b></h2>
            <p>Pasek jest pełny. Wybierz bonus, który najlepiej pasuje do sytuacji na planszy.</p>
            <div className="hm-power-grid">
              <button type="button" onClick={() => activateHitPower("encore")}><span className="power-icon encore"><Music2 size={30} /></span><strong>ENCORE</strong><small>+3 ruchy</small></button>
              <button type="button" onClick={() => activateHitPower("blast")}><span className="power-icon blast"><Zap size={30} /></span><strong>BASS BLAST</strong><small>wybierasz pole — czyści jego rząd i kolumnę</small></button>
              <button type="button" onClick={() => activateHitPower("gold")}><span className="power-icon gold"><Star size={30} fill="currentColor" /></span><strong>ZŁOTY WINYL</strong><small>wybierasz kafel, który stanie się Złotym Winylem</small></button>
            </div>
            <button type="button" className="hm-secondary" onClick={() => setShowPower(false)}>JESZCZE NIE</button>
          </div>
        </div>
      ) : null}

      {status === "won" || status === "lost" ? (
        <div className="hm-overlay">
          <div className={`hm-modal hm-result-modal ${status}`}>
            <div className="hm-result-icon">{status === "won" ? <Trophy size={38} /> : <Music2 size={36} />}</div>
            <span className="hm-modal-kicker">POZIOM {LEVEL.number}</span>
            <h2>{status === "won" ? "KONCERT ZALICZONY!" : "JESZCZE RAZ!"}</h2>
            <p>{status === "won" ? "Cele wykonane. Niewykorzystane ruchy zamieniły się w bonus ENCORE." : "Skończyły się ruchy. Zmiksuj planszę i spróbuj ponownie."}</p>
            <div className="hm-result-stats">
              <div><span>WYNIK</span><strong>{score.toLocaleString("pl-PL")}</strong></div>
              <div className="bonus"><span>BONUS ENCORE</span><strong>+{bonusScore.toLocaleString("pl-PL")}</strong></div>
              <div><span>NAJLEPSZA KASKADA</span><strong>x{Math.max(1, bestCascade)}</strong></div>
              <div><span>RUCHY</span><strong>{moves}</strong></div>
            </div>
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
            <p>Przeciągnij kafel w górę, dół, lewo lub prawo. Ruch jest zaliczony tylko wtedy, gdy tworzy match albo odpala booster.</p>
            <div className="hm-how-grid">
              <div className="hm-how-card"><span className="hm-demo-icons">{[0,1,2].map((n) => <img key={n} src={microphoneImg} alt="" />)}</span><strong>3 = MATCH</strong><small>Podstawowe połączenie usuwa symbole.</small></div>
              <div className="hm-how-card"><span className="hm-demo-icons four">{[0,1,2,3].map((n) => <img key={n} src={cassetteImg} alt="" />)}</span><strong>4 = BASS LINE</strong><small>Powstaje booster czyszczący cały rząd lub kolumnę.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special bomb"><Zap size={30} /></span><strong>L/T = BOMBA 3×3</strong><small>Bomba zawsze wybucha wokół pola, na którym się znajduje.</small></div>
              <div className="hm-how-card"><span className="hm-demo-special gold"><img src={vinylImg} alt="" /></span><strong>5 = ZŁOTY WINYL</strong><small>Zamień go z symbolem, aby usunąć wszystkie kafle tego typu.</small></div>
            </div>
            <div className="hm-help-power"><Music2 size={22} /><span><strong>HIT METER</strong><small>Przy 100% wybierasz moc. Bass Blast i Złoty Winyl wskazujesz sam na planszy.</small></span></div>
            <button type="button" className="hm-primary" onClick={() => setShowHelp(false)}>ROZUMIEM</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
