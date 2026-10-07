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

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function specialName(special) {
  if (special === "row") return "BASS LINE";
  if (special === "col") return "DROP LINE";
  if (special === "bomb") return "GŁOŚNIK";
  if (special === "color") return "ZŁOTY WINYL";
  return "";
}

function HitMatchPiece({ tile, index, selected, matched, onPointerDown, onPointerMove, onPointerUp, onClick }) {
  const row = rowOf(index);
  const col = colOf(index);
  const image = ICONS[tile.type] || ICONS.vinyl;
  const classNames = [
    "hm-piece",
    `type-${tile.type}`,
    tile.special ? `special-${tile.special}` : "",
    selected ? "is-selected" : "",
    matched ? "is-matched" : "",
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

  const pointerStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const runTokenRef = useRef(0);
  const statsRef = useRef({
    moves: LEVEL.moves,
    score: 0,
    collected: { vinyl: 0, microphone: 0 },
    hitMeter: 0,
  });

  const syncStats = useCallback(() => {
    const stats = statsRef.current;
    setMoves(stats.moves);
    setScore(stats.score);
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
    statsRef.current = {
      moves: LEVEL.moves,
      score: 0,
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
      setBusy(false);
      setStatus("won");
      setCascade(0);
      playVictorySound();
      flashBanner("LEVEL COMPLETE!", "Pierwszy koncert zaliczony", "gold", 1400);
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
      flashBanner("BRAK RUCHÓW", "Miksujemy planszę", "violet", 900);
      await wait(450);
      if (runTokenRef.current !== token) return;
      setBoard(shufflePlayable(finalBoard));
      await wait(260);
    }
    if (runTokenRef.current === token) {
      setCascade(0);
      setBusy(false);
    }
  }, [flashBanner]);

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
    if (cascadeLevel >= 2) flashBanner(`COMBO x${cascadeLevel}`, cascadeLevel >= 4 ? "MEGA KASKADA!" : "Kaskada!", cascadeLevel >= 4 ? "gold" : "cyan", 1050);

    const specialCreation = swapMeta ? chooseSpecialCreation(groups, currentBoard, swapMeta.a, swapMeta.b) : null;
    const matchedBase = uniqueMatchedIndices(groups);
    let affected = expandSpecialEffects(currentBoard, matchedBase);
    if (specialCreation) affected = affected.filter((index) => index !== specialCreation.index);

    setMatched(affected);
    playCorrectSound();
    await wait(340);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(currentBoard, affected, cascadeLevel, specialCreation);
    let removed = removeIndices(currentBoard, affected, specialCreation);
    setBoard(removed);
    await wait(130);
    if (runTokenRef.current !== token) return;

    let dropped = collapseAndRefill(removed);
    setMatched([]);
    setBoard(dropped);
    await wait(440);
    if (runTokenRef.current !== token) return;

    const nextGroups = findMatches(dropped);
    if (nextGroups.length) {
      await resolve(dropped, nextGroups, token, cascadeLevel + 1, null);
      return;
    }

    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, finishOrShuffle, flashBanner]);

  const resolveColorMove = useCallback(async (swapped, a, b, token) => {
    const affected = resolveColorSwap(swapped, a, b) || [];
    setCascade(1);
    setMatched(affected);
    playCorrectSound();
    flashBanner("ZŁOTY WINYL!", "Cały kolor znika z planszy", "gold", 900);
    await wait(420);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, { special: "color" });
    let removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(130);
    if (runTokenRef.current !== token) return;

    let dropped = collapseAndRefill(removed);
    setMatched([]);
    setBoard(dropped);
    await wait(450);
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
    const label = specials.length > 1 ? "SPECJALNE COMBO!" : specialName(specials[0]?.special);
    setCascade(1);
    setSpecialPulse(specials.length > 1 ? "mega" : specials[0]?.special || "special");
    setMatched(affected);
    playCorrectSound();
    flashBanner(label || "HIT POWER!", specials.length > 1 ? "Dwa boostery odpalone razem" : "Booster aktywowany", specials.length > 1 ? "gold" : "violet", 1200);
    await wait(430);
    if (runTokenRef.current !== token) return;

    applyRemovalStats(swapped, affected, 1, null);
    statsRef.current.score += specials.length > 1 ? 1200 : 500;
    syncStats();
    let removed = removeIndices(swapped, affected, null);
    setBoard(removed);
    await wait(150);
    if (runTokenRef.current !== token) return;

    let dropped = collapseAndRefill(removed);
    setMatched([]);
    setBoard(dropped);
    await wait(480);
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
    setBusy(true);
    const token = runTokenRef.current;

    if (kind === "encore") {
      statsRef.current.hitMeter = 0;
      statsRef.current.moves += 3;
      syncStats();
      flashBanner("ENCORE!", "+3 ruchy", "lime", 1200);
      setSpecialPulse("power");
      await wait(520);
      setSpecialPulse("");
      setBusy(false);
      return;
    }

    if (kind === "gold") {
      const candidates = board.map((tile, index) => ({ tile, index })).filter(({ tile }) => tile && !tile.special);
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      if (picked) {
        const next = board.slice();
        next[picked.index] = { ...picked.tile, type: "wild", special: "color", freshSpecial: true };
        statsRef.current.hitMeter = 0;
        syncStats();
        setBoard(next);
        setSpecialPulse("gold");
        flashBanner("ZŁOTY WINYL!", "Specjalny kafel gotowy", "gold", 1200);
        await wait(620);
        setSpecialPulse("");
      }
      setBusy(false);
      return;
    }

    // BASS BLAST: natychmiast czyści losowy rząd i kolumnę.
    const row = Math.floor(Math.random() * 8);
    const col = Math.floor(Math.random() * 8);
    const base = [];
    for (let c = 0; c < 8; c += 1) base.push(row * 8 + c);
    for (let r = 0; r < 8; r += 1) base.push(r * 8 + col);
    const affected = expandSpecialEffects(board, [...new Set(base)]);
    setMatched(affected);
    setSpecialPulse("blast");
    playCorrectSound();
    flashBanner("BASS BLAST!", "Rząd + kolumna", "cyan", 1200);
    await wait(470);
    if (runTokenRef.current !== token) return;
    applyRemovalStats(board, affected, 1, null);
    statsRef.current.hitMeter = 0;
    statsRef.current.score += 800;
    syncStats();
    let removed = removeIndices(board, affected, null);
    setBoard(removed);
    await wait(150);
    let dropped = collapseAndRefill(removed);
    setMatched([]);
    setBoard(dropped);
    await wait(500);
    setSpecialPulse("");
    const groups = findMatches(dropped);
    if (groups.length) {
      await resolveCascades(dropped, groups, token, 2, null);
      return;
    }
    await finishOrShuffle(dropped, token);
  }, [applyRemovalStats, board, busy, finishOrShuffle, flashBanner, resolveCascades, status, syncStats]);

  const attemptSwap = useCallback(async (a, b) => {
    if (status !== "running" || busy || !areAdjacent(a, b)) return;
    unlockAudio();
    setSelected(null);
    setBusy(true);
    const token = runTokenRef.current;
    const original = board;
    const swapped = swapBoardCells(original, a, b);
    setBoard(swapped);
    await wait(155);
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
      await wait(120);
      if (runTokenRef.current !== token) return;
      setBoard(original);
      await wait(160);
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
  }, [attemptSwap, busy, selected, status]);

  const handlePointerDown = useCallback((event, index) => {
    if (busy || status !== "running") return;
    event.preventDefault();
    pointerStartRef.current = {
      index,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [busy, status]);


  const handlePointerMove = useCallback((event, index) => {
    const start = pointerStartRef.current;
    if (!start || start.index !== index || start.pointerId !== event.pointerId || busy || status !== "running") return;
    event.preventDefault();
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
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
      if (nextRow >= 0 && nextRow < 8) target = nextRow * HIT_MATCH_COLS + col;
    }
    if (target !== null) attemptSwap(index, target);
  }, [attemptSwap, busy, status]);

  const handlePointerUp = useCallback((event, index, cancelled = false) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start || cancelled || start.index !== index || busy || status !== "running") return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
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
        <button type="button" className="hm-help" onClick={() => setShowHelp((value) => !value)}><Sparkles size={17} /> JAK GRAĆ?</button>
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
            <button type="button" className={`hm-meter-card ${hitMeter >= 100 ? "ready" : ""}`} onClick={() => hitMeter >= 100 && !busy && setShowPower(true)} disabled={hitMeter < 100 || busy}>
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
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onClick={handlePieceClick}
                  />
                ) : null)}
                <span className="hm-board-shine" aria-hidden="true" />
              </div>
              {cascade >= 2 && status === "running" ? <div key={cascade} className={`hm-combo-badge combo-${Math.min(cascade, 5)}`}>COMBO <b>x{cascade}</b></div> : null}
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
              <div><b>4</b><span><strong>Bass Line</strong><small>czyści rząd lub kolumnę</small></span></div>
              <div><b>L</b><span><strong>Głośnik</strong><small>wybuch 3×3</small></span></div>
              <div><b>5</b><span><strong>Złoty Winyl</strong><small>usuwa cały wybrany symbol</small></span></div>
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
            <span className="hm-modal-kicker">NOWA MINIGRA · PROTOTYP</span>
            <h2>HIT <b>MATCH</b></h2>
            <p>Muzyczny match-3 w stylu HITSTERIADY. Przeciągaj symbole, twórz serie i odpalaj specjalne combo.</p>
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
              <button type="button" onClick={() => activateHitPower("blast")}><span className="power-icon blast"><Zap size={30} /></span><strong>BASS BLAST</strong><small>czyści rząd i kolumnę</small></button>
              <button type="button" onClick={() => activateHitPower("gold")}><span className="power-icon gold"><Star size={30} fill="currentColor" /></span><strong>ZŁOTY WINYL</strong><small>tworzy color bomb</small></button>
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
            <p>{status === "won" ? "Cele wykonane. Hit Match działa — teraz możemy rozbudowywać kolejne poziomy." : "Skończyły się ruchy. Zmiksuj planszę i spróbuj ponownie."}</p>
            <div className="hm-result-stats">
              <div><span>WYNIK</span><strong>{score.toLocaleString("pl-PL")}</strong></div>
              <div><span>NAJLEPSZA KASKADA</span><strong>x{Math.max(1, bestCascade)}</strong></div>
              <div><span>RUCHY</span><strong>{moves}</strong></div>
            </div>
            <button type="button" className="hm-primary" onClick={() => resetGame(true)}><RotateCcw size={18} /> ZAGRAJ PONOWNIE</button>
            <button type="button" className="hm-secondary" onClick={onBack}>WRÓĆ DO HITSTERIADY</button>
          </div>
        </div>
      ) : null}

      {showHelp ? (
        <div className="hm-help-popover">
          <button type="button" onClick={() => setShowHelp(false)}>×</button>
          <strong>Jak grać?</strong>
          <p>Połącz minimum 3 identyczne symbole. Możesz przeciągać kafelki albo zaznaczyć dwa sąsiadujące.</p>
          <ul><li>4 symbole tworzą liniowy booster.</li><li>Układ L/T tworzy bombę 3×3.</li><li>5 symboli tworzy Złoty Winyl.</li><li>Specjalny kafel możesz odpalić także przez zamianę z sąsiednim polem.</li><li>Przy 100% HIT METER wybierasz jedną z trzech mocy.</li><li>Niepoprawna zwykła zamiana cofa się i nie zabiera ruchu.</li></ul>
        </div>
      ) : null}
    </div>
  );
}
