import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase-config.js";
import { getOrCreatePlayerId, generateRoomCode } from "./identity.js";
import { parseCSV, shuffle, randomStartSeconds } from "./utils.js";
import { REAL_SONGS } from "./songs.js";
import { Play, Music4, Trophy, RotateCcw, Users, ChevronRight, Copy, Check } from "lucide-react";

// ---------- vinyl / now-playing widget ----------

function Vinyl({ spinning, revealed }) {
  return (
    <div className="relative flex flex-col items-center">
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

// ---------- main app ----------

const playerId = getOrCreatePlayerId();

export default function App() {
  const [screen, setScreen] = useState("home"); // home | lobby | playing | roundResult | gameover
  const [name, setName] = useState(localStorage.getItem("hitster-player-name") || "");
  const [joinCode, setJoinCode] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [customInput, setCustomInput] = useState("");
  const [customSongs, setCustomSongs] = useState(null);
  const [target, setTarget] = useState(5);

  const [chosenSlot, setChosenSlot] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const iframeRef = useRef(null);

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
  useEffect(() => {
    setChosenSlot(null);
    setIsPlaying(false);
  }, [room?.currentCard?.id]);

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
        target: 5,
        status: "lobby",
        players: [{ id: playerId, name: name.trim() }],
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
          tx.update(ref, { players: [...data.players, { id: playerId, name: name.trim() }] });
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

  function handleParseCustom() {
    const songs = parseCSV(customInput);
    if (!songs.length) {
      setError("Nie znaleziono poprawnych wierszy. Format: url,wykonawca,tytuł,rok");
      return;
    }
    setCustomSongs(songs);
    setError("");
  }

  async function startGame() {
    if (!room) return;
    const pool = customSongs || REAL_SONGS;
    const needed = target * room.players.length;
    if (pool.length < needed) {
      setError(`Za mało utworów (masz ${pool.length}, potrzeba ${needed}).`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const deck = shuffle(pool);
      const players = room.players;
      const timelines = {};
      players.forEach((p, i) => {
        timelines[p.id] = [deck[i]];
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
        timelines,
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
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);
    const win = iframeRef.current && iframeRef.current.contentWindow;
    if (win) {
      if (willPlay) {
        win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      } else {
        win.postMessage(JSON.stringify({ event: "command", func: "mute", args: [] }), "*");
      }
    }
  }

  async function confirmPlacement() {
    if (chosenSlot === null || !room) return;
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
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
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct, card },
          timelines: newTimelines,
        });
      });
    } catch (e) {
      setError("Błąd zatwierdzania: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function nextRound() {
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        const players = data.players;

        const winnerEntry = Object.entries(data.timelines).find(([, t]) => t.length >= data.target);
        if (winnerEntry) {
          tx.update(ref, { status: "gameover", winnerId: winnerEntry[0] });
          return;
        }
        if (data.deckIndex >= data.deck.length) {
          let bestId = players[0].id;
          players.forEach((p) => {
            if ((data.timelines[p.id] || []).length > (data.timelines[bestId] || []).length) bestId = p.id;
          });
          tx.update(ref, { status: "gameover", winnerId: bestId });
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
          lastResult: null,
        });
      });
    } catch (e) {
      setError("Błąd przechodzenia dalej: " + e.message);
    } finally {
      setBusy(false);
    }
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

        {screen === "home" && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Twoje imię</label>
              <input type="text" value={name} onChange={(e) => saveName(e.target.value)} className="w-full mt-2" placeholder="np. Kasia" />
            </section>

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
                <div className="flex items-center gap-2 mb-3">
                  <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Kart do wygrania:</label>
                  <input type="number" min={3} max={15} value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10) || 5)} style={{ width: 60 }} />
                </div>
                <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
                  Domyślnie gracie z Twoją wgraną listą ({REAL_SONGS.length} utworów). Możesz też wkleić inną:
                </p>
                <textarea rows={4} value={customInput} onChange={(e) => setCustomInput(e.target.value)} placeholder="url,wykonawca,tytuł,rok" className="w-full" />
                <div className="flex gap-2 mt-2 items-center flex-wrap">
                  <button onClick={handleParseCustom} className="px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid #33294f", color: "var(--muted)" }}>
                    Wczytaj tę listę
                  </button>
                  {customSongs && <span style={{ color: "var(--good)", fontSize: 12 }}>✓ {customSongs.length} utworów gotowe</span>}
                </div>
                <button
                  onClick={startGame}
                  disabled={busy || room.players.length < 2}
                  className="w-full mt-4 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2"
                  style={{ background: "var(--good)", color: "#0d1f1a", fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  ROZPOCZNIJ GRĘ <ChevronRight size={20} />
                </button>
                {room.players.length < 2 && <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>Potrzeba minimum 2 graczy</p>}
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

              <Vinyl spinning={isPlaying} revealed={screen === "roundResult"} />

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
                {isPlaying ? "Gra…" : "Odtwórz dźwięk"}
              </button>
            </div>

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
                    {room.lastResult.correct ? "TRAFIONE!" : "PUDŁO!"}
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
