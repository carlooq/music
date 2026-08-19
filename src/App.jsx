import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import { db } from "./firebase-config.js";
import { getOrCreatePlayerId, generateRoomCode } from "./identity.js";
import { shuffle, randomStartSeconds, fuzzyMatch } from "./utils.js";
import { REAL_SONGS } from "./songs.js";
import { registerWithUsername, loginWithUsername, logout, watchAuthState, friendlyAuthError } from "./auth.js";
import { ensureStatsDoc, getStats, recordCardGuess, recordGameResult, topArtists, getLeaderboard } from "./stats.js";
import { Play, Music4, Trophy, RotateCcw, Users, ChevronRight, Copy, Check, LogIn, LogOut, BarChart3, Flame, Crown } from "lucide-react";

const CATEGORIES = [
  { slug: "najwieksze-hity", label: "Największe Hity" },
  { slug: "polskie", label: "Polskie" },
  { slug: "rock", label: "Rock" },
  { slug: "pop", label: "Pop" },
  { slug: "rap", label: "Rap" },
  { slug: "elektroniczna", label: "Elektroniczna" },
];

// ---------- vinyl / now-playing widget ----------

function Vinyl({ spinning, revealed, progress = 0 }) {
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  return (
    <div className="relative flex flex-col items-center">
      <svg
        width={236}
        height={236}
        className="absolute"
        style={{ top: -8, left: -8, transform: "rotate(-90deg)" }}
      >
        <circle cx={118} cy={118} r={radius} stroke="rgba(231,178,76,0.15)" strokeWidth={4} fill="none" />
        <circle
          cx={118}
          cy={118}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 220,
          height: 220,
          background: "radial-gradient(circle at 35% 30%, #2b2440 0%, #171226 60%, #0d0a17 100%)",
          boxShadow: "0 20px 45px -15px rgba(0,0,0,0.7), inset 0 0 0 6px #0d0a17",
          animation: spinning ? "spin-record 3.2s linear infinite" : "none",
        }}
      >
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="absolute rounded-full"
            style={{ width: 220 - n * 34, height: 220 - n * 34, border: "1px solid rgba(231,178,76,0.08)" }}
          />
        ))}
        <div
          className="rounded-full flex items-center justify-center text-center px-2"
          style={{ width: 78, height: 78, background: "var(--accent)", color: "#1a1428" }}
        >
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, lineHeight: 1 }}>
            {revealed ? "ODKRYTE" : "?"}
          </span>
        </div>
        <div className="absolute rounded-full" style={{ width: 10, height: 10, background: "#0d0a17" }} />
      </div>
      <div
        className="absolute"
        style={{
          top: -6,
          right: 6,
          width: 90,
          height: 4,
          background: "linear-gradient(90deg, var(--muted), var(--accent))",
          borderRadius: 4,
          transformOrigin: "right center",
          transform: spinning ? "rotate(-22deg)" : "rotate(-38deg)",
          transition: "transform 0.5s ease",
        }}
      />
    </div>
  );
}

function SlotButton({ index, chosen, onPick, label }) {
  return (
    <button
      onClick={() => onPick(index)}
      className="slot-btn rounded-lg flex items-center justify-center"
      style={{
        width: 34,
        height: 60,
        background: chosen === index ? "var(--accent)" : "var(--surface2)",
        color: chosen === index ? "#1a1428" : "var(--muted)",
        border: "1px dashed #4a3f6b",
        fontSize: 16,
      }}
      title={label}
    >
      +
    </button>
  );
}

function TimelineCard({ year, title, artist }) {
  return (
    <div
      className="rounded-lg flex flex-col items-center justify-center text-center px-3"
      style={{ width: 92, height: 60, background: "var(--surface2)", border: "1px solid #33294f" }}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--accent)" }}>{year}</span>
      <span style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.1, marginTop: 2 }}>
        {artist.length > 14 ? artist.slice(0, 13) + "…" : artist}
      </span>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-lg px-4 py-3 flex-1" style={{ background: "var(--surface2)", minWidth: 110 }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--accent)" }}>{value}</p>
      <p style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase" }}>{label}</p>
    </div>
  );
}

// ---------- main app ----------

const guestId = getOrCreatePlayerId();

export default function App() {
  const [screen, setScreen] = useState("home"); // home | lobby | playing | roundResult | gameover
  const [name, setName] = useState(localStorage.getItem("hitster-player-name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [target, setTarget] = useState(10);
  const [selectedCategories, setSelectedCategories] = useState(["wszystkie"]);

  const [chosenSlot, setChosenSlot] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playElapsed, setPlayElapsed] = useState(0); // seconds played in current listen session (0-25)
  const [decisionLeft, setDecisionLeft] = useState(60); // seconds left of the 60s total decision timer
  const [guessArtist, setGuessArtist] = useState("");
  const [guessTitle, setGuessTitle] = useState("");
  const [guessFeedback, setGuessFeedback] = useState(null); // "correct" | "wrong" | null
  const iframeRef = useRef(null);
  const playIntervalRef = useRef(null);
  const decisionIntervalRef = useRef(null);

  const PLAY_CAP_SECONDS = 25;
  const DECISION_SECONDS = 60;
  const BUY_CARD_TOKENS = 3;
  const SWAP_SONG_TOKENS = 1;

  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // login | register
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);

  const playerId = user ? user.uid : guestId;

  useEffect(() => {
    const unsub = watchAuthState(async (u) => {
      setUser(u);
      setAuthChecked(true);
      if (u) {
        await ensureStatsDoc(u.uid, u.displayName || authUsername);
      }
    });
    return () => unsub();
  }, []);

  async function handleAuthSubmit() {
    if (!authUsername.trim() || !authPassword) {
      setAuthError("Podaj login i hasło.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "register") {
        await registerWithUsername(authUsername, authPassword);
      } else {
        await loginWithUsername(authUsername, authPassword);
      }
      setAuthPassword("");
    } catch (e) {
      setAuthError(friendlyAuthError(e));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await logout();
    setShowStats(false);
  }

  async function openStats() {
    if (!user) return;
    const s = await getStats(user.uid);
    setStats(s);
    setShowStats(true);
  }

  async function openLeaderboard() {
    const list = await getLeaderboard(10);
    setLeaderboard(list);
    setShowLeaderboard(true);
  }

  useEffect(() => {
    if (!roomId) return;
    const ref = doc(db, "rooms", roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setError("Ten pokój przestał istnieć.");
          setRoom(null);
          return;
        }
        const data = snap.data();
        setRoom(data);
        setScreen(data.status);
      },
      (err) => setError("Błąd połączenia: " + err.message)
    );
    return () => unsub();
  }, [roomId]);

  // reset local per-round UI whenever the shared card changes
  const timeoutFiredRef = useRef(false);
  useEffect(() => {
    setChosenSlot(null);
    setIsPlaying(false);
    setPlayElapsed(0);
    setGuessArtist("");
    setGuessTitle("");
    setGuessFeedback(null);
    timeoutFiredRef.current = false;
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
  }, [room?.currentCard?.id]);

  // 60s total decision timer, driven off the shared turnDeadline so every
  // client (and especially the active player) sees the same countdown.
  useEffect(() => {
    if (decisionIntervalRef.current) clearInterval(decisionIntervalRef.current);
    if (screen !== "playing" || !room?.turnDeadline) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000));
      setDecisionLeft(left);
      if (left <= 0 && room.currentPlayerId === playerId && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        handleTimeout();
      }
    };
    tick();
    decisionIntervalRef.current = setInterval(tick, 500);
    return () => clearInterval(decisionIntervalRef.current);
  }, [screen, room?.turnDeadline, room?.currentPlayerId]);

  useEffect(() => {
    if (user?.displayName) saveName(user.displayName);
  }, [user?.displayName]);

  function saveName(v) {
    setName(v);
    localStorage.setItem("hitster-player-name", v);
  }

  async function createRoom() {
    if (!name.trim()) return setError("Podaj swoje imię.");
    setBusy(true);
    setError("");
    try {
      const code = generateRoomCode();
      const ref = doc(db, "rooms", code);
      await setDoc(ref, {
        code,
        hostId: playerId,
        target: 10,
        status: "lobby",
        players: [{ id: playerId, name: name.trim(), authed: !!user }],
        deck: [],
        deckIndex: 0,
        currentPlayerId: null,
        currentCard: null,
        startSeconds: 0,
        timelines: {},
        lastResult: null,
        winnerId: null,
        createdAt: serverTimestamp(),
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się stworzyć pokoju: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!name.trim()) return setError("Podaj swoje imię.");
    const code = joinCode.trim().toUpperCase();
    if (!code) return setError("Podaj kod pokoju.");
    setBusy(true);
    setError("");
    try {
      const ref = doc(db, "rooms", code);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error("Nie znaleziono pokoju o tym kodzie.");
        const data = snap.data();
        const already = data.players.some((p) => p.id === playerId);
        if (!already) {
          tx.update(ref, { players: [...data.players, { id: playerId, name: name.trim(), authed: !!user }] });
        }
      });
      setRoomId(code);
    } catch (e) {
      setError(e.message || "Nie udało się dołączyć do pokoju.");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!roomId) return;
    navigator.clipboard?.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function toggleCategory(slug) {
    setSelectedCategories((prev) => {
      if (slug === "wszystkie") return ["wszystkie"];
      const withoutAll = prev.filter((c) => c !== "wszystkie");
      const has = withoutAll.includes(slug);
      const next = has ? withoutAll.filter((c) => c !== slug) : [...withoutAll, slug];
      return next.length === 0 ? ["wszystkie"] : next;
    });
  }

  async function startGame() {
    if (!room) return;
    if (!target || target < 1) {
      setError("Podaj liczbę kart do wygrania.");
      return;
    }
    const basePool = REAL_SONGS;
    const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
    const pool = filterActive
      ? basePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c)))
      : basePool;
    const EXTRA_CARDS_PER_PLAYER = 7;
    const needed = room.players.length * (target + EXTRA_CARDS_PER_PLAYER);
    if (pool.length < needed) {
      const catNote = filterActive ? ` w wybranych kategoriach (${selectedCategories.join(", ")})` : "";
      setError(`Za mało utworów${catNote} (masz ${pool.length}, potrzeba ${needed}: (${target}+${EXTRA_CARDS_PER_PLAYER}) × ${room.players.length} graczy).`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const deck = shuffle(pool).slice(0, needed);
      const players = room.players;
      const timelines = {};
      const tokens = {};
      players.forEach((p, i) => {
        timelines[p.id] = [deck[i]];
        tokens[p.id] = 1;
      });
      const ref = doc(db, "rooms", roomId);
      await updateDoc(ref, {
        status: "playing",
        target,
        deck,
        deckIndex: players.length + 1,
        currentPlayerId: players[0].id,
        currentCard: deck[players.length],
        startSeconds: randomStartSeconds(),
        turnDeadline: Date.now() + DECISION_SECONDS * 1000,
        timelines,
        tokens,
        lastResult: null,
        winnerId: null,
      });
    } catch (e) {
      setError("Nie udało się rozpocząć gry: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function togglePlay() {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);

    if (playIntervalRef.current) clearInterval(playIntervalRef.current);

    if (willPlay) {
      setPlayElapsed(0);
      if (win) {
        win.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [room.startSeconds, true] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
      const startedAt = Date.now();
      playIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= PLAY_CAP_SECONDS) {
          setPlayElapsed(PLAY_CAP_SECONDS);
          setIsPlaying(false);
          clearInterval(playIntervalRef.current);
          if (win) win.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
        } else {
          setPlayElapsed(elapsed);
        }
      }, 200);
    } else {
      if (win) win.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    }
  }

  async function confirmPlacement() {
    if (chosenSlot === null || !room) return;
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      let capturedResult = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        const timeline = data.timelines[data.currentPlayerId] || [];
        const sorted = [...timeline].sort((a, b) => a.year - b.year);
        const before = sorted[chosenSlot - 1];
        const after = sorted[chosenSlot];
        const card = data.currentCard;
        const correct = (!before || before.year <= card.year) && (!after || card.year <= after.year);
        const newTimelines = { ...data.timelines };
        if (correct) {
          newTimelines[data.currentPlayerId] = [...timeline, card];
        }
        capturedResult = { correct, card };
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct, card },
          timelines: newTimelines,
        });
      });
      if (user && capturedResult) {
        recordCardGuess(user.uid, capturedResult.card.year, capturedResult.correct, capturedResult.card.artist).catch(() => {});
      }
    } catch (e) {
      setError("Błąd zatwierdzania: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitGuess() {
    if (!room || guessFeedback !== null) return;
    const card = room.currentCard;
    const artistOk = fuzzyMatch(guessArtist, card.artist);
    const titleOk = fuzzyMatch(guessTitle, card.title);
    const correct = artistOk && titleOk;
    setGuessFeedback(correct ? "correct" : "wrong");
    if (correct) {
      try {
        const ref = doc(db, "rooms", roomId);
        await updateDoc(ref, { [`tokens.${playerId}`]: increment(1) });
      } catch (e) {
        // nie krytyczne — gra toczy się dalej nawet jeśli token się nie zapisał
      }
    }
  }

  async function buyCard() {
    if (!room || (room.tokens?.[playerId] || 0) < BUY_CARD_TOKENS) return;
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      let capturedResult = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if ((data.tokens?.[data.currentPlayerId] || 0) < BUY_CARD_TOKENS) return;
        const card = data.currentCard;
        const timeline = data.timelines[data.currentPlayerId] || [];
        const newTimelines = { ...data.timelines, [data.currentPlayerId]: [...timeline, card] };
        capturedResult = { correct: true, card, bought: true };
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct: true, card, bought: true },
          timelines: newTimelines,
          [`tokens.${data.currentPlayerId}`]: increment(-BUY_CARD_TOKENS),
        });
      });
      if (user && capturedResult) {
        recordCardGuess(user.uid, capturedResult.card.year, true, capturedResult.card.artist).catch(() => {});
      }
    } catch (e) {
      setError("Błąd kupowania karty: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function swapSong() {
    if (!room || (room.tokens?.[playerId] || 0) < SWAP_SONG_TOKENS) return;
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if ((data.tokens?.[data.currentPlayerId] || 0) < SWAP_SONG_TOKENS) return;
        if (data.deckIndex >= data.deck.length) return; // brak kart w talii do wymiany
        tx.update(ref, {
          currentCard: data.deck[data.deckIndex],
          deckIndex: data.deckIndex + 1,
          startSeconds: randomStartSeconds(),
          turnDeadline: Date.now() + DECISION_SECONDS * 1000,
          [`tokens.${data.currentPlayerId}`]: increment(-SWAP_SONG_TOKENS),
        });
      });
    } catch (e) {
      setError("Błąd wymiany piosenki: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTimeout() {
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // ktoś już zdążył zatwierdzić/kupić
        const card = data.currentCard;
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct: false, card, timedOut: true },
        });
      });
    } catch (e) {
      // ciche niepowodzenie — najwyżej gracz sam kliknie coś innego
    }
  }

  async function nextRound() {
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      let gameOverInfo = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        const players = data.players;

        const winnerEntry = Object.entries(data.timelines).find(([, t]) => t.length >= data.target);
        if (winnerEntry) {
          tx.update(ref, { status: "gameover", winnerId: winnerEntry[0] });
          gameOverInfo = { winnerId: winnerEntry[0], players };
          return;
        }
        if (data.deckIndex >= data.deck.length) {
          let bestId = players[0].id;
          players.forEach((p) => {
            if ((data.timelines[p.id] || []).length > (data.timelines[bestId] || []).length) bestId = p.id;
          });
          tx.update(ref, { status: "gameover", winnerId: bestId });
          gameOverInfo = { winnerId: bestId, players };
          return;
        }
        const idx = players.findIndex((p) => p.id === data.currentPlayerId);
        const nextIdx = (idx + 1) % players.length;
        tx.update(ref, {
          status: "playing",
          currentPlayerId: players[nextIdx].id,
          currentCard: data.deck[data.deckIndex],
          deckIndex: data.deckIndex + 1,
          startSeconds: randomStartSeconds(),
          turnDeadline: Date.now() + DECISION_SECONDS * 1000,
          lastResult: null,
        });
      });
      if (gameOverInfo) {
        gameOverInfo.players
          .filter((p) => p.authed)
          .forEach((p) => {
            recordGameResult(p.id, p.id === gameOverInfo.winnerId).catch(() => {});
          });
      }
    } catch (e) {
      setError("Błąd przechodzenia dalej: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function leaveRoom() {
    setRoomId(null);
    setRoom(null);
    setScreen("home");
    setChosenSlot(null);
    setIsPlaying(false);
    setError("");
  }

  async function playAgain() {
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      await updateDoc(ref, {
        status: "lobby",
        deck: [],
        deckIndex: 0,
        currentPlayerId: null,
        currentCard: null,
        timelines: {},
        lastResult: null,
        winnerId: null,
      });
    } finally {
      setBusy(false);
    }
  }

  const isHost = room && room.hostId === playerId;
  const isMyTurn = room && room.currentPlayerId === playerId;
  const turnPlayerName = room && room.players.find((p) => p.id === room.currentPlayerId)?.name;
  const turnTimeline =
    room && room.currentPlayerId && room.timelines[room.currentPlayerId]
      ? [...room.timelines[room.currentPlayerId]].sort((a, b) => a.year - b.year)
      : [];

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center"
      style={{ background: "var(--bg)", color: "var(--text)", fontFamily: "'Space Mono', monospace", padding: "32px 16px 64px" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        :root {
          --bg: #120f1d; --surface: #1d1830; --surface2: #241d3a;
          --accent: #e7b24c; --good: #4fd1ae; --bad: #e8615d;
          --text: #f5f1e8; --muted: #9c93b5;
        }
        @keyframes spin-record { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .slot-btn { transition: all 0.15s ease; }
        .slot-btn:hover { background: var(--accent) !important; color: #1a1428 !important; }
        input[type="text"], input[type="number"], textarea {
          background: var(--surface2); border: 1px solid #33294f; color: var(--text);
          border-radius: 8px; padding: 8px 10px; font-family: 'Space Mono', monospace;
        }
        input:focus, textarea:focus { outline: 2px solid var(--accent); }
      `}</style>

      <div className="w-full flex flex-col items-center" style={{ maxWidth: 720 }}>
        <div className="flex items-center gap-2 mb-1">
          <Music4 size={22} color="var(--accent)" />
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, letterSpacing: 1 }}>OŚ CZASU MUZYKI</h1>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 24 }}>online • każdy gra u siebie, w swoim miejscu</p>

        {error && (
          <div className="w-full rounded-lg p-3 mb-4 text-sm" style={{ background: "rgba(232,97,93,0.12)", border: "1px solid var(--bad)", color: "var(--bad)" }}>
            {error}
          </div>
        )}

        {screen === "home" && showStats && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 12 }}>TWOJE STATYSTYKI</h2>
              {!stats ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Brak jeszcze żadnych rozegranych gier.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 flex-wrap">
                    <StatBox label="Rozegrane gry" value={stats.gamesPlayed || 0} />
                    <StatBox label="Wygrane" value={stats.gamesWon || 0} />
                    <StatBox
                      label="% wygranych"
                      value={stats.gamesPlayed ? Math.round(((stats.gamesWon || 0) / stats.gamesPlayed) * 100) + "%" : "—"}
                    />
                    <StatBox
                      label="Trafność kart"
                      value={stats.cardsTotal ? Math.round(((stats.cardsCorrect || 0) / stats.cardsTotal) * 100) + "%" : "—"}
                    />
                    <StatBox label="Rekordowy streak" value={(stats.longestStreak || 0) + " 🔥"} />
                  </div>

                  {stats.decades && Object.keys(stats.decades).length > 0 && (
                    <div>
                      <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Skuteczność wg dekad</p>
                      <div className="flex flex-col gap-1">
                        {Object.entries(stats.decades)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([label, d]) => (
                            <div key={label} className="flex items-center justify-between text-sm">
                              <span>{label}</span>
                              <span style={{ color: "var(--accent)" }}>
                                {d.correct}/{d.total} ({Math.round((d.correct / d.total) * 100)}%)
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    const { best, worst } = topArtists(stats, 5, 2);
                    if (!best.length && !worst.length) return null;
                    return (
                      <div className="flex flex-col gap-4 md:flex-row">
                        {best.length > 0 && (
                          <div className="flex-1">
                            <p style={{ color: "var(--good)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Najlepiej zgadujesz</p>
                            <div className="flex flex-col gap-1">
                              {best.map((a) => (
                                <div key={a.name} className="flex items-center justify-between text-sm">
                                  <span>{a.name}</span>
                                  <span style={{ color: "var(--good)" }}>
                                    {a.correct}/{a.total} ({Math.round(a.pct * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {worst.length > 0 && (
                          <div className="flex-1">
                            <p style={{ color: "var(--bad)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Najgorzej zgadujesz</p>
                            <div className="flex flex-col gap-1">
                              {worst.map((a) => (
                                <div key={a.name} className="flex items-center justify-between text-sm">
                                  <span>{a.name}</span>
                                  <span style={{ color: "var(--bad)" }}>
                                    {a.correct}/{a.total} ({Math.round(a.pct * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {stats.cardsTotal > 0 && topArtists(stats, 5, 2).best.length === 0 && (
                    <p style={{ color: "var(--muted)", fontSize: 11 }}>
                      Statystyki wg wykonawcy pojawią się, gdy trafisz co najmniej dwa razy na tego samego artystę.
                    </p>
                  )}
                </div>
              )}
            </section>
            <button
              onClick={() => setShowStats(false)}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ border: "1px solid #33294f", color: "var(--muted)" }}
            >
              Wróć
            </button>
          </div>
        )}

        {screen === "home" && showLeaderboard && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 12 }}>RANKING GRACZY</h2>
              {!leaderboard ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Ładowanie…</p>
              ) : leaderboard.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Nikt jeszcze nie wygrał żadnej gry.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {leaderboard.map((p, i) => (
                    <div key={p.uid} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--surface2)" }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i === 0 ? "var(--accent)" : "var(--muted)", width: 24 }}>
                          {i === 0 ? <Crown size={18} /> : `#${i + 1}`}
                        </span>
                        <span>{p.username}</span>
                      </div>
                      <span style={{ color: "var(--accent)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>{p.gamesWon || 0} wygranych</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ border: "1px solid #33294f", color: "var(--muted)" }}
            >
              Wróć
            </button>
          </div>
        )}

        {screen === "home" && !showStats && !showLeaderboard && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              {user ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>Cześć, {user.displayName}!</p>
                    <p style={{ color: "var(--muted)", fontSize: 11 }}>Zalogowano — Twoje statystyki są zapisywane.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={openStats} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                      <BarChart3 size={14} /> Statystyki
                    </button>
                    <button onClick={handleLogout} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid #33294f", color: "var(--muted)" }}>
                      <LogOut size={14} /> Wyloguj
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setAuthMode("login")}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: authMode === "login" ? "var(--accent)" : "var(--surface2)", color: authMode === "login" ? "#1a1428" : "var(--muted)" }}
                    >
                      Zaloguj
                    </button>
                    <button
                      onClick={() => setAuthMode("register")}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: authMode === "register" ? "var(--accent)" : "var(--surface2)", color: authMode === "register" ? "#1a1428" : "var(--muted)" }}
                    >
                      Zarejestruj
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    <input type="text" value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} placeholder="Login" />
                    <input
                      type="password"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Hasło (wymyśl inne niż wszędzie indziej!)"
                    />
                    <button
                      onClick={handleAuthSubmit}
                      disabled={authBusy}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                      style={{ background: "var(--good)", color: "#0d1f1a" }}
                    >
                      <LogIn size={16} /> {authMode === "login" ? "Zaloguj się" : "Zarejestruj się"}
                    </button>
                    {authError && <p style={{ color: "var(--bad)", fontSize: 12 }}>{authError}</p>}
                    <p style={{ color: "var(--muted)", fontSize: 11 }}>
                      Konto = zbieramy Twoje statystyki gier (wygrane, skuteczność odgadywania). Możesz też zagrać bez konta poniżej.
                    </p>
                  </div>
                </>
              )}
            </section>

            {!user && (
              <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Graj bez konta — podaj imię</label>
                <input type="text" value={name} onChange={(e) => saveName(e.target.value)} className="w-full mt-2" placeholder="np. Kasia" />
              </section>
            )}

            <button
              onClick={openLeaderboard}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--surface2)", border: "1px solid #33294f", color: "var(--accent)" }}
            >
              <Trophy size={16} /> Ranking graczy
            </button>

            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>NOWA GRA</h2>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>Stwórz pokój i wyślij kod znajomym.</p>
              <button onClick={createRoom} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                Stwórz pokój
              </button>
            </section>

            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>DOŁĄCZ DO GRY</h2>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="KOD"
                  maxLength={4}
                  style={{ width: 100, textAlign: "center", fontSize: 18, letterSpacing: 2 }}
                />
                <button onClick={joinRoom} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                  Dołącz
                </button>
              </div>
            </section>
          </div>
        )}

        {screen === "lobby" && room && (
          <div className="w-full flex flex-col gap-5">
            <button
              onClick={leaveRoom}
              className="self-start flex items-center gap-1 text-xs"
              style={{ color: "var(--muted)" }}
            >
              ← Wróć
            </button>

            <section className="w-full rounded-2xl p-5 flex flex-col items-center" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase" }}>Kod pokoju</p>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 4, color: "var(--accent)" }}>{roomId}</span>
                <button onClick={copyCode} style={{ color: "var(--muted)" }}>
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Prześlij ten kod znajomym, żeby dołączyli</p>
            </section>

            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} color="var(--accent)" />
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>GRACZE ({room.players.length})</h2>
              </div>
              <div className="flex flex-col gap-1">
                {room.players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span>{p.name}</span>
                    {p.id === room.hostId && <span style={{ color: "var(--accent)", fontSize: 10 }}>HOST</span>}
                    {p.id === playerId && <span style={{ color: "var(--muted)", fontSize: 10 }}>(Ty)</span>}
                  </div>
                ))}
              </div>
            </section>

            {isHost ? (
              <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <div className="flex items-center gap-2 mb-4">
                  <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Kart do wygrania:</label>
                  <input
                    type="number"
                    min={1}
                    value={target}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTarget(v === "" ? "" : parseInt(v, 10));
                    }}
                    style={{ width: 60 }}
                  />
                </div>

                <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Kategorie</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[{ slug: "wszystkie", label: "Wszystkie" }, ...CATEGORIES].map((c) => {
                    const active = selectedCategories.includes(c.slug);
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCategory(c.slug)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: active ? "var(--accent)" : "var(--surface2)", color: active ? "#1a1428" : "var(--muted)" }}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>

                <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
                  Gracie z pełną biblioteką {REAL_SONGS.length} utworów.
                </p>
                <button
                  onClick={startGame}
                  disabled={busy || !target}
                  className="w-full mt-4 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2"
                  style={{ background: "var(--good)", color: "#0d1f1a", fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  ROZPOCZNIJ GRĘ <ChevronRight size={20} />
                </button>
                {!target && <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>Podaj liczbę kart do wygrania</p>}
              </section>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Czekasz, aż {room.players.find((p) => p.id === room.hostId)?.name} rozpocznie grę…</p>
            )}
          </div>
        )}

        {(screen === "playing" || screen === "roundResult") && room && room.currentCard && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="w-full rounded-2xl p-5 flex flex-col items-center" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ color: "var(--accent)", fontSize: 12, textTransform: "uppercase", letterSpacing: 2 }}>Tura gracza</p>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30 }}>
                {isMyTurn ? "Twoja kolej!" : turnPlayerName}
              </p>

              {screen === "playing" && (
                <p style={{ color: decisionLeft <= 10 ? "var(--bad)" : "var(--muted)", fontSize: 13, fontWeight: "bold" }}>
                  ⏱ {decisionLeft}s na decyzję
                </p>
              )}

              <Vinyl spinning={isPlaying} revealed={screen === "roundResult"} progress={playElapsed / PLAY_CAP_SECONDS} />

              <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
                <iframe
                  key={room.currentCard.id}
                  ref={iframeRef}
                  title="player"
                  width="280"
                  height="158"
                  src={`https://www.youtube.com/embed/${room.currentCard.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.startSeconds}&controls=0&modestbranding=1&rel=0`}
                  allow="autoplay; encrypted-media"
                  style={{ border: "none" }}
                />
              </div>

              <button onClick={togglePlay} className="mt-4 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                <Play size={16} />
                {isPlaying ? `Gra… (${Math.ceil(PLAY_CAP_SECONDS - playElapsed)}s)` : playElapsed >= PLAY_CAP_SECONDS ? "Odtwórz ponownie" : "Odtwórz dźwięk"}
              </button>
            </div>

            {screen === "playing" && isMyTurn && (
              <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <div className="flex items-center justify-between mb-2">
                  <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Zgadnij wykonawcę i tytuł (+1 token)</p>
                  <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: "bold" }}>🪙 {room.tokens?.[playerId] || 0}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input type="text" value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} placeholder="Wykonawca" disabled={guessFeedback !== null} className="flex-1" style={{ minWidth: 120 }} />
                  <input type="text" value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} placeholder="Tytuł" disabled={guessFeedback !== null} className="flex-1" style={{ minWidth: 120 }} />
                  <button
                    onClick={submitGuess}
                    disabled={guessFeedback !== null || !guessArtist.trim() || !guessTitle.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-bold"
                    style={{ background: "var(--accent)", color: "#1a1428" }}
                  >
                    Zgadnij
                  </button>
                </div>
                {guessFeedback === "correct" && <p style={{ color: "var(--good)", fontSize: 12, marginTop: 6 }}>✓ Trafione! +1 token</p>}
                {guessFeedback === "wrong" && <p style={{ color: "var(--bad)", fontSize: 12, marginTop: 6 }}>✗ Niestety nie tym razem.</p>}

                <div className="flex gap-2 mt-3 flex-wrap">
                  <button
                    onClick={swapSong}
                    disabled={busy || (room.tokens?.[playerId] || 0) < SWAP_SONG_TOKENS}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: (room.tokens?.[playerId] || 0) < SWAP_SONG_TOKENS ? "#33294f" : "var(--surface2)",
                      color: (room.tokens?.[playerId] || 0) < SWAP_SONG_TOKENS ? "var(--muted)" : "var(--text)",
                      border: "1px solid #33294f",
                    }}
                  >
                    🔁 Wymień piosenkę ({SWAP_SONG_TOKENS} 🪙)
                  </button>
                  <button
                    onClick={buyCard}
                    disabled={busy || (room.tokens?.[playerId] || 0) < BUY_CARD_TOKENS}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold"
                    style={{
                      background: (room.tokens?.[playerId] || 0) < BUY_CARD_TOKENS ? "#33294f" : "var(--good)",
                      color: (room.tokens?.[playerId] || 0) < BUY_CARD_TOKENS ? "var(--muted)" : "#0d1f1a",
                    }}
                  >
                    🎁 Kup kartę w ciemno ({BUY_CARD_TOKENS} 🪙)
                  </button>
                </div>
              </div>
            )}

            {screen === "playing" && isMyTurn && (
              <div className="w-full">
                <p style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", marginBottom: 10 }}>Gdzie umieszczasz tę piosenkę?</p>
                <div className="flex flex-wrap items-center gap-2">
                  <SlotButton index={0} chosen={chosenSlot} onPick={setChosenSlot} label="najstarsza" />
                  {turnTimeline.map((c, i) => (
                    <React.Fragment key={c.id}>
                      <TimelineCard year={c.year} title={c.title} artist={c.artist} />
                      <SlotButton index={i + 1} chosen={chosenSlot} onPick={setChosenSlot} label="tutaj" />
                    </React.Fragment>
                  ))}
                </div>
                <button
                  onClick={confirmPlacement}
                  disabled={chosenSlot === null || busy}
                  className="w-full mt-5 py-3 rounded-xl text-lg font-bold"
                  style={{
                    background: chosenSlot === null ? "#33294f" : "var(--good)",
                    color: chosenSlot === null ? "var(--muted)" : "#0d1f1a",
                    fontFamily: "'Bebas Neue', sans-serif",
                  }}
                >
                  ZATWIERDŹ MIEJSCE
                </button>
              </div>
            )}

            {screen === "playing" && !isMyTurn && (
              <div className="w-full">
                <p style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", marginBottom: 10, textAlign: "center" }}>
                  Oś czasu gracza {turnPlayerName}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {turnTimeline.map((c) => (
                    <TimelineCard key={c.id} year={c.year} title={c.title} artist={c.artist} />
                  ))}
                </div>
              </div>
            )}

            {screen === "roundResult" && room.lastResult && (
              <div className="w-full flex flex-col items-center gap-4">
                <div
                  className="w-full rounded-2xl p-5 text-center"
                  style={{
                    background: room.lastResult.correct ? "rgba(79,209,174,0.12)" : "rgba(232,97,93,0.12)",
                    border: `1px solid ${room.lastResult.correct ? "var(--good)" : "var(--bad)"}`,
                  }}
                >
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: room.lastResult.correct ? "var(--good)" : "var(--bad)" }}>
                    {room.lastResult.bought ? "KARTA KUPIONA!" : room.lastResult.timedOut ? "CZAS MINĄŁ!" : room.lastResult.correct ? "TRAFIONE!" : "PUDŁO!"}
                  </p>
                  <p style={{ fontSize: 14, marginTop: 4 }}>
                    {room.lastResult.card.artist} — „{room.lastResult.card.title}"
                  </p>
                  <p style={{ color: "var(--accent)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22 }}>{room.lastResult.card.year}</p>
                </div>
                <button onClick={nextRound} disabled={busy} className="w-full py-3 rounded-xl text-lg font-bold" style={{ background: "var(--accent)", color: "#1a1428", fontFamily: "'Bebas Neue', sans-serif" }}>
                  NASTĘPNY GRACZ →
                </button>
              </div>
            )}

            <div className="w-full flex flex-wrap gap-2 justify-center">
              {room.players.map((p) => (
                <div
                  key={p.id}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{
                    background: p.id === room.currentPlayerId ? "var(--accent)" : "var(--surface2)",
                    color: p.id === room.currentPlayerId ? "#1a1428" : "var(--muted)",
                  }}
                >
                  {p.name}: {(room.timelines[p.id] || []).length}/{room.target}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "gameover" && room && room.winnerId && (
          <div className="w-full flex flex-col items-center gap-5 text-center">
            <Trophy size={48} color="var(--accent)" />
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34 }}>
              {room.players.find((p) => p.id === room.winnerId)?.name} WYGRYWA!
            </p>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>
              Oś czasu: {(room.timelines[room.winnerId] || []).map((c) => c.year).sort((a, b) => a - b).join(" → ")}
            </p>
            {isHost && (
              <button onClick={playAgain} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                <RotateCcw size={16} /> ZAGRAJ PONOWNIE
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
