import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase-config.js";
import { getOrCreatePlayerId, generateRoomCode } from "./identity.js";
import { shuffle, randomStartSeconds, requiredApprovals, getYouTubeId } from "./utils.js";
import { REAL_SONGS } from "./songs.js";
import { registerWithUsername, loginWithUsername, logout, watchAuthState, friendlyAuthError } from "./auth.js";
import { ensureStatsDoc, getStats, recordCardGuess, recordGameResult, recordSuccessfulGuess, recordSongAdded, topArtists, getLeaderboard } from "./stats.js";
import { fetchAllSongsFromDb, addSongToDb, updateSongInDb, deleteSongFromDb, migrateBundledLibraryToDb, applyCategoryPatchToDb, submitSongProposal, fetchPendingProposals, updateProposal, acceptProposal, rejectProposal, importSongsFromCsv } from "./songsDb.js";
import { playCorrectSound, playWrongSound, playApplause, unlockAudio } from "./sounds.js";
import { Play, Music4, Trophy, RotateCcw, Users, ChevronRight, Copy, Check, LogIn, LogOut, BarChart3, Flame, Crown, Shield, Search, Trash2, Pencil, Save, X, MessageCircle, Send } from "lucide-react";
import logoImg from "./assets/logo-v2.png";

// 👉 PODMIEŃ TO NA SWOJE WŁASNE HASŁO trybu admina
const ADMIN_PASSWORD = "zmien-to-haslo-123";

// Bezpieczna konwersja znacznika czasu z serwera Firestore na milisekundy.
// Zwraca null, jeśli zapis jeszcze nie doszedł do serwera (chwilowy stan
// tylko u klienta, który właśnie zapisał — reszta graczy tego nie widzi).
function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

const CATEGORIES = [
  { slug: "najwieksze-hity", label: "Największe Hity" },
  { slug: "polskie", label: "Polskie" },
  { slug: "rock", label: "Rock" },
  { slug: "pop", label: "Pop" },
  { slug: "rap", label: "Rap" },
  { slug: "elektroniczna", label: "Elektroniczna" },
];

// ---------- vinyl / now-playing widget ----------

const Vinyl = memo(function Vinyl({ spinning, revealed, progress = 0 }) {
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
        <defs>
          <linearGradient id="vinylGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent2)" />
          </linearGradient>
        </defs>
        <circle cx={118} cy={118} r={radius} stroke="rgba(34,211,197,0.15)" strokeWidth={4} fill="none" />
        <circle
          cx={118}
          cy={118}
          r={radius}
          stroke="url(#vinylGradient)"
          strokeWidth={4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.2s linear", filter: "drop-shadow(0 0 5px rgba(34,211,197,0.5))" }}
        />
      </svg>
      <div
        className="relative rounded-full flex items-center justify-center"
        style={{
          width: 220,
          height: 220,
          background: "radial-gradient(circle at 35% 30%, #1c2946 0%, #101827 60%, #060a14 100%)",
          boxShadow: "0 20px 45px -15px rgba(0,0,0,0.7), inset 0 0 0 6px #060a14, 0 0 30px -10px var(--accent)",
          animation: spinning ? "spin-record 3.2s linear infinite" : "none",
        }}
      >
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="absolute rounded-full"
            style={{ width: 220 - n * 34, height: 220 - n * 34, border: "1px solid rgba(34,211,197,0.1)" }}
          />
        ))}
        <div
          className="rounded-full flex items-center justify-center text-center px-2"
          style={{ width: 78, height: 78, background: "linear-gradient(135deg, var(--accent), var(--accent2))", color: "#061018" }}
        >
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, lineHeight: 1 }}>
            {revealed ? "ODKRYTE" : "?"}
          </span>
        </div>
        <div className="absolute rounded-full" style={{ width: 10, height: 10, background: "#060a14" }} />
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
});

const SlotButton = memo(function SlotButton({ index, chosen, onPick, label }) {
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
});

const TimelineCard = memo(function TimelineCard({ year, title, artist, onHold, onRelease }) {
  const timerRef = useRef(null);
  const start = () => {
    timerRef.current = setTimeout(() => {
      onHold && onHold({ year, title, artist });
    }, 350);
  };
  const cancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onRelease && onRelease();
  };
  return (
    <div
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      className="rounded-lg flex flex-col items-center justify-center text-center px-3 select-none"
      style={{ width: 92, height: 60, background: "var(--surface2)", border: "1px solid #33294f", cursor: "pointer", touchAction: "manipulation" }}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--accent)" }}>{year}</span>
      <span style={{ fontSize: 9, color: "var(--muted)", lineHeight: 1.1, marginTop: 2 }}>
        {artist.length > 14 ? artist.slice(0, 13) + "…" : artist}
      </span>
    </div>
  );
});

const StatBox = memo(function StatBox({ label, value }) {
  return (
    <div className="rounded-lg px-4 py-3 flex-1" style={{ background: "var(--surface2)", minWidth: 110 }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--accent)" }}>{value}</p>
      <p style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase" }}>{label}</p>
    </div>
  );
});

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
  const [practiceTarget, setPracticeTarget] = useState(15);

  const [chosenSlot, setChosenSlot] = useState(null);
  const [heldCard, setHeldCard] = useState(null);
  const clearHeldCard = useCallback(() => setHeldCard(null), []);
  const [showChat, setShowChat] = useState(false);
  const [chatSeenCount, setChatSeenCount] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playElapsed, setPlayElapsed] = useState(0); // seconds played in current listen session (0-25)
  const [decisionLeft, setDecisionLeft] = useState(60); // seconds left of the 60s total decision timer
  const [guessArtist, setGuessArtist] = useState("");
  const [guessTitle, setGuessTitle] = useState("");
  const iframeRef = useRef(null);
  const playIntervalRef = useRef(null);
  const decisionIntervalRef = useRef(null);

  const PLAY_CAP_SECONDS = 25;
  const DECISION_SECONDS = 60;
  const BUY_CARD_TOKENS = 3;
  const SWAP_SONG_TOKENS = 1;
  const VOTING_SECONDS = 20;

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
  const [leaderboardSort, setLeaderboardSort] = useState("gamesWon"); // "gamesWon" | "guessesCorrect"
  const [viewingPlayer, setViewingPlayer] = useState(null); // { uid, username, stats }
  const [leaderboard, setLeaderboard] = useState(null);

  const [librarySongs, setLibrarySongs] = useState(null); // null = jeszcze nie sprawdzono
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const ADMIN_PAGE_SIZE = 100;
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminEditingId, setAdminEditingId] = useState(null);
  const [adminEditDraft, setAdminEditDraft] = useState({});
  const [adminNewSong, setAdminNewSong] = useState({ artist: "", title: "", url: "", year: "", categories: "" });
  const [migrateProgress, setMigrateProgress] = useState(null);
  const [importCsvText, setImportCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposeDraft, setProposeDraft] = useState({ artist: "", title: "", url: "", year: "", categories: [] });
  const [proposeBusy, setProposeBusy] = useState(false);
  const [proposeError, setProposeError] = useState("");
  const [proposeSuccess, setProposeSuccess] = useState(false);

  const [showProposals, setShowProposals] = useState(false);
  const [proposals, setProposals] = useState(null);
  const [proposalEditingId, setProposalEditingId] = useState(null);
  const [proposalEditDraft, setProposalEditDraft] = useState({});

  const playerId = user ? user.uid : guestId;

  // odblokowanie dźwięku na iOS/Androidzie — musi się zdarzyć w reakcji na
  // prawdziwy dotyk/klik, więc łapiemy pierwszą taką interakcję w całej appce
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, []);

  const effectivePool = librarySongs && librarySongs.length > 0 ? librarySongs : REAL_SONGS;

  const LIBRARY_CACHE_KEY = "hitster-library-cache-v1";
  const LIBRARY_CACHE_TTL_MS = 60 * 60 * 1000; // 1h — świeża baza wystarczająco często, a nie za każdym odświeżeniem

  function saveLibraryCache(songs) {
    try {
      localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ songs, ts: Date.now() }));
    } catch (e) {
      // localStorage może być niedostępny (np. tryb prywatny) — nic się nie dzieje, po prostu nie cache'ujemy
    }
  }

  // Ładuje bibliotekę TYLKO gdy jest faktycznie potrzebna (host w lobby,
  // panel admina) — dołączenie do cudzej gry i zwykłe granie nigdy jej nie
  // wymaga, więc nie ma sensu pobierać 700+ dokumentów za każdym razem.
  function ensureLibraryLoaded() {
    if (librarySongs !== null) return; // już wczytana (albo w trakcie) w tej sesji
    setLibrarySongs(undefined); // znacznik "ładowanie", żeby nie odpalić drugi raz równolegle
    try {
      const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
      if (cached) {
        const { songs, ts } = JSON.parse(cached);
        if (Array.isArray(songs) && songs.length > 0 && Date.now() - ts < LIBRARY_CACHE_TTL_MS) {
          setLibrarySongs(songs);
          return; // świeży cache — zero odczytów z Firestore
        }
      }
    } catch (e) {
      // uszkodzony/nieodczytywalny cache — po prostu pobieramy normalnie
    }
    fetchAllSongsFromDb()
      .then((songs) => {
        setLibrarySongs(songs);
        saveLibraryCache(songs);
      })
      .catch(() => setLibrarySongs([])); // brak kolekcji / błąd → cicho wracamy do wbudowanej listy
  }

  useEffect(() => {
    if (screen === "lobby" && room?.hostId === playerId) ensureLibraryLoaded();
  }, [screen, room?.hostId, playerId]);

  useEffect(() => {
    setAdminPage(1);
  }, [adminSearch]);

  function refreshLibrary() {
    fetchAllSongsFromDb()
      .then((songs) => {
        setLibrarySongs(songs);
        saveLibraryCache(songs);
      })
      .catch(() => {});
  }

  function unlockAdmin() {
    if (adminPasswordInput === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setShowAdminLogin(false);
      setAdminError("");
      setAdminPasswordInput("");
      loadProposals();
      ensureLibraryLoaded();
    } else {
      setAdminError("Złe hasło.");
    }
  }

  async function handleAdminSave(id) {
    const videoId = getYouTubeId(adminEditDraft.url);
    if (!videoId) {
      setError("Podany link YouTube wygląda na niepoprawny.");
      return;
    }
    setAdminBusy(true);
    try {
      const categories = (adminEditDraft.categoriesText || "")
        .split(";")
        .map((c) => c.trim())
        .filter(Boolean);
      await updateSongInDb(id, {
        artist: adminEditDraft.artist,
        title: adminEditDraft.title,
        year: parseInt(adminEditDraft.year, 10),
        videoId,
        categories,
      });
      setLibrarySongs((prev) => {
        const next = prev.map((s) => (s.id === id ? { ...s, artist: adminEditDraft.artist, title: adminEditDraft.title, year: parseInt(adminEditDraft.year, 10), videoId, categories } : s));
        saveLibraryCache(next);
        return next;
      });
      setAdminEditingId(null);
    } catch (e) {
      setError("Błąd zapisu: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleAdminDelete(id) {
    setAdminBusy(true);
    try {
      await deleteSongFromDb(id);
      setLibrarySongs((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveLibraryCache(next);
        return next;
      });
    } catch (e) {
      setError("Błąd usuwania: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleAdminAdd() {
    const videoId = getYouTubeId(adminNewSong.url);
    const year = parseInt(adminNewSong.year, 10);
    if (!videoId || !adminNewSong.artist.trim() || !adminNewSong.title.trim() || isNaN(year)) {
      setError("Uzupełnij wykonawcę, tytuł, poprawny link YouTube i rok.");
      return;
    }
    setAdminBusy(true);
    try {
      const added = await addSongToDb({
        videoId,
        artist: adminNewSong.artist.trim(),
        title: adminNewSong.title.trim(),
        year,
        categories: adminNewSong.categories.split(";").map((c) => c.trim()).filter(Boolean),
      });
      setAdminNewSong({ artist: "", title: "", url: "", year: "", categories: "" });
      setLibrarySongs((prev) => {
        const next = [...(prev || []), added];
        saveLibraryCache(next);
        return next;
      });
    } catch (e) {
      setError("Błąd dodawania: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  function toggleProposeCategory(slug) {
    setProposeDraft((d) => ({
      ...d,
      categories: d.categories.includes(slug) ? d.categories.filter((c) => c !== slug) : [...d.categories, slug],
    }));
  }

  async function handleSubmitProposal() {
    const videoId = getYouTubeId(proposeDraft.url);
    const year = parseInt(proposeDraft.year, 10);
    if (!videoId || !proposeDraft.artist.trim() || !proposeDraft.title.trim() || isNaN(year)) {
      setProposeError("Uzupełnij wykonawcę, tytuł, poprawny link YouTube i rok.");
      return;
    }
    if (proposeDraft.categories.length === 0) {
      setProposeError("Zaznacz co najmniej jedną kategorię.");
      return;
    }
    setProposeBusy(true);
    setProposeError("");
    try {
      await submitSongProposal({
        videoId,
        artist: proposeDraft.artist.trim(),
        title: proposeDraft.title.trim(),
        year,
        categories: proposeDraft.categories,
        submittedBy: name || user?.displayName || "nieznany",
        submittedByUid: user?.uid || null,
      });
      setProposeDraft({ artist: "", title: "", url: "", year: "", categories: [] });
      setProposeSuccess(true);
      setTimeout(() => {
        setProposeSuccess(false);
        setShowProposeForm(false);
      }, 2000);
    } catch (e) {
      setProposeError("Błąd wysyłania: " + e.message);
    } finally {
      setProposeBusy(false);
    }
  }

  function loadProposals() {
    fetchPendingProposals()
      .then((list) => setProposals(list))
      .catch(() => setProposals([]));
  }

  async function handleAcceptProposal(p) {
    setAdminBusy(true);
    try {
      const added = await acceptProposal(p);
      if (p.submittedByUid) {
        recordSongAdded(p.submittedByUid).catch(() => {});
      }
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
      setLibrarySongs((prev) => {
        const next = [...(prev || []), added];
        saveLibraryCache(next);
        return next;
      });
    } catch (e) {
      setError("Błąd akceptacji: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleRejectProposal(id) {
    setAdminBusy(true);
    try {
      await rejectProposal(id);
      setProposals((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError("Błąd odrzucania: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleSaveProposalEdit(id) {
    setAdminBusy(true);
    try {
      const categories = (proposalEditDraft.categoriesText || "").split(";").map((c) => c.trim()).filter(Boolean);
      const videoId = getYouTubeId(proposalEditDraft.url) || proposalEditDraft.videoId;
      await updateProposal(id, {
        artist: proposalEditDraft.artist,
        title: proposalEditDraft.title,
        year: parseInt(proposalEditDraft.year, 10),
        videoId,
        categories,
      });
      setProposals((prev) =>
        prev.map((p) => (p.id === id ? { ...p, artist: proposalEditDraft.artist, title: proposalEditDraft.title, year: parseInt(proposalEditDraft.year, 10), videoId, categories } : p))
      );
      setProposalEditingId(null);
    } catch (e) {
      setError("Błąd zapisu: " + e.message);
    } finally {
      setAdminBusy(false);
    }
  }

  async function handleMigrate() {
    if (!window.confirm(`Wgrać ${REAL_SONGS.length} utworów z wbudowanej listy do bazy? Rób to tylko raz.`)) return;
    setAdminBusy(true);
    setMigrateProgress({ done: 0, total: REAL_SONGS.length });
    try {
      await migrateBundledLibraryToDb((done, total) => setMigrateProgress({ done, total }));
      refreshLibrary();
    } catch (e) {
      setError("Błąd migracji: " + e.message);
    } finally {
      setAdminBusy(false);
      setMigrateProgress(null);
    }
  }

  async function handleApplyCategoryPatch() {
    if (!window.confirm("Dograć kategorie do istniejących utworów w bazie (na podstawie zapisanej wcześniej analizy)? Nadpisze kategorie tam, gdzie już są dopasowania.")) return;
    setAdminBusy(true);
    setMigrateProgress({ done: 0, total: 1 });
    try {
      const written = await applyCategoryPatchToDb((done, total) => setMigrateProgress({ done, total }));
      refreshLibrary();
      alert(`Zaktualizowano kategorie dla ${written} utworów.`);
    } catch (e) {
      setError("Błąd wgrywania kategorii: " + e.message);
    } finally {
      setAdminBusy(false);
      setMigrateProgress(null);
    }
  }

  async function handleImportCsv() {
    if (!importCsvText.trim()) return;
    setImportBusy(true);
    setImportResult(null);
    setError("");
    try {
      // upewniamy się, że deduplikujemy względem NAJŚWIEŻSZEJ biblioteki
      const fresh = await fetchAllSongsFromDb();
      const existingVideoIds = fresh.map((s) => s.videoId);
      const result = await importSongsFromCsv(importCsvText, existingVideoIds, (done, total) =>
        setMigrateProgress({ done, total })
      );
      setImportResult(result);
      const merged = [...fresh, ...result.addedSongs];
      setLibrarySongs(merged);
      saveLibraryCache(merged);
      setImportCsvText("");
    } catch (e) {
      setError("Błąd importu: " + e.message);
    } finally {
      setImportBusy(false);
      setMigrateProgress(null);
    }
  }

  function handleImportFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImportCsvText(ev.target.result);
    reader.readAsText(file, "utf-8");
  }


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

  async function openLeaderboard(sortBy = leaderboardSort) {
    setLeaderboardSort(sortBy);
    setLeaderboard(null);
    setViewingPlayer(null);
    setShowLeaderboard(true);
    try {
      const list = await getLeaderboard(10, sortBy);
      setLeaderboard(list);
    } catch (e) {
      // pierwsza próba czasem pada na chwilowy problem z połączeniem —
      // cicho próbujemy jeszcze raz, zanim pokażemy błąd
      try {
        await new Promise((r) => setTimeout(r, 600));
        const list = await getLeaderboard(10, sortBy);
        setLeaderboard(list);
      } catch (e2) {
        setLeaderboard([]);
        setError("Nie udało się wczytać rankingu: " + e2.message);
      }
    }
  }

  async function viewPlayerProfile(p) {
    const s = await getStats(p.uid);
    setViewingPlayer({ uid: p.uid, username: p.username, stats: s });
  }

  const lastSnapshotAtRef = useRef(Date.now());
  const [connectionStale, setConnectionStale] = useState(false);
  useEffect(() => {
    if (!roomId) return;
    const ref = doc(db, "rooms", roomId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        lastSnapshotAtRef.current = Date.now();
        setConnectionStale(false);
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

  // wskaźnik słabego połączenia — jeśli od dawna nie przyszła żadna aktualizacja
  // z Firestore, pokazujemy to graczowi zamiast ciszy wyglądającej jak awaria
  useEffect(() => {
    if (!roomId) return;
    const id = setInterval(() => {
      setConnectionStale(Date.now() - lastSnapshotAtRef.current > 6000);
    }, 1500);
    return () => clearInterval(id);
  }, [roomId]);

  // reset local per-round UI whenever the shared card changes
  const timeoutFiredRef = useRef(false);
  useEffect(() => {
    setChosenSlot(null);
    setIsPlaying(false);
    setPlayElapsed(0);
    setGuessArtist("");
    setGuessTitle("");
    timeoutFiredRef.current = false;
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
  }, [room?.currentCard?.id, toMillis(room?.openerCreatedAt), room?.openerWinnerId]);

  // 60s total decision timer, liczony od serwerowego znacznika turnStartedAt
  // (nie zegara żadnego konkretnego telefonu — eliminuje rozjazdy między urządzeniami).
  // Mechanizm awaryjny: jeśli aktywny gracz nie zdąży (zablokowany ekran,
  // karta w tle), dowolny inny gracz wymusza timeout po dodatkowym czasie.
  useEffect(() => {
    if (decisionIntervalRef.current) clearInterval(decisionIntervalRef.current);
    const turnStartedAtMs = toMillis(room?.turnStartedAt);
    if (screen !== "playing" || !turnStartedAtMs) return;
    const turnDeadlineMs = turnStartedAtMs + DECISION_SECONDS * 1000;

    const FALLBACK_EXTRA_MS = 8000;
    const isResponsible = room.currentPlayerId === playerId;
    const tick = () => {
      const msLeft = turnDeadlineMs - Date.now();
      const left = Math.max(0, Math.ceil(msLeft / 1000));
      setDecisionLeft(left);
      const shouldFire = isResponsible ? msLeft <= 0 : msLeft <= -FALLBACK_EXTRA_MS;
      if (shouldFire && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        handleTimeout();
      }
    };
    tick();
    decisionIntervalRef.current = setInterval(tick, 500);
    return () => clearInterval(decisionIntervalRef.current);
  }, [screen, toMillis(room?.turnStartedAt), room?.currentPlayerId]);

  // automatyczne przejście do kolejnej tury po wyniku rundy (licznik 3-2-1);
  // normalnie robi to klient gracza, którego tura się kończy — ale gdyby jego
  // urządzenie akurat "zasnęło" (zablokowany ekran, karta w tle), dowolny
  // inny gracz przejmuje to po dłuższym czasie oczekiwania (mechanizm awaryjny)
  const advanceFiredRef = useRef(null);
  const [advanceCountdown, setAdvanceCountdown] = useState(null);
  useEffect(() => {
    const resultAtMs = toMillis(room?.resultAt);
    if (screen !== "roundResult" || !resultAtMs) {
      setAdvanceCountdown(null);
      return;
    }
    const ADVANCE_SECONDS = 5;
    const FALLBACK_EXTRA_MS = 8000; // dodatkowy czas, zanim ktoś inny przejmie
    const isResponsible = room.currentPlayerId === playerId;
    const tick = () => {
      const elapsedMs = Date.now() - resultAtMs;
      const left = Math.max(0, ADVANCE_SECONDS - elapsedMs / 1000);
      setAdvanceCountdown(Math.ceil(left));
      const shouldFire = isResponsible ? left <= 0 : elapsedMs >= ADVANCE_SECONDS * 1000 + FALLBACK_EXTRA_MS;
      if (shouldFire && advanceFiredRef.current !== resultAtMs) {
        advanceFiredRef.current = resultAtMs;
        nextRound();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [screen, toMillis(room?.resultAt), room?.currentPlayerId, room?.lastResult?.correct]);

  // 20s na głosowanie — kto nie zdąży zagłosować, liczy się jako "TAK";
  // każdy klient odpowiada tylko za swój własny (domyślny) głos
  const votingAutoVoteFiredRef = useRef(null);
  const [votingCountdown, setVotingCountdown] = useState(null);
  useEffect(() => {
    const votingStartedAtMs = toMillis(room?.votingStartedAt);
    if (screen !== "voting" || !votingStartedAtMs) {
      setVotingCountdown(null);
      return;
    }
    const votingDeadlineMs = votingStartedAtMs + VOTING_SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((votingDeadlineMs - Date.now()) / 1000));
      setVotingCountdown(left);
      const alreadyVoted = room.votes?.[playerId] !== undefined;
      if (
        left <= 0 &&
        playerId !== room.currentPlayerId &&
        !alreadyVoted &&
        votingAutoVoteFiredRef.current !== votingStartedAtMs
      ) {
        votingAutoVoteFiredRef.current = votingStartedAtMs;
        castVote(true);
      }
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [screen, toMillis(room?.votingStartedAt), room?.currentPlayerId, room?.votes, playerId]);

  // dźwięk trafienia/pudła (i braw przy zaliczonym zgadywaniu) — leci
  // u każdego gracza w chwili ujawnienia wyniku rundy
  const soundPlayedRef = useRef(null);
  useEffect(() => {
    const resultAtMs = toMillis(room?.resultAt);
    if (screen !== "roundResult" || !resultAtMs) return;
    if (soundPlayedRef.current === resultAtMs) return;
    soundPlayedRef.current = resultAtMs;
    if (room.lastResult?.correct) playCorrectSound();
    else playWrongSound();
    if (room.lastResult?.tokenAwarded) setTimeout(() => playApplause(), 250);
  }, [screen, toMillis(room?.resultAt)]);

  // minigra "kto zaczyna": 3s odliczanie na pełnym ekranie, muzyka odtwarza
  // się automatycznie wszystkim, 20s na odpowiedź; jeśli nikt nie trafi,
  // host (jedyny gwarantowany klient) rozstrzyga na siebie
  const OPENER_COUNTDOWN_MS = 3000;
  const OPENER_ANSWER_MS = 20000;
  const OPENER_REVEAL_MS = 5000; // dłuższy czas na pokazanie zwycięzcy przed startem
  const [openerPhase, setOpenerPhase] = useState("countdown"); // "countdown" | "answering"
  const [openerCountdownNum, setOpenerCountdownNum] = useState(3);
  const [openerLockedOut, setOpenerLockedOut] = useState(false);
  const openerFallbackFiredRef = useRef(null);
  const openerFinalizeFiredRef = useRef(null);
  const [openerRevealCountdown, setOpenerRevealCountdown] = useState(null);

  useEffect(() => {
    setOpenerLockedOut(false);
  }, [toMillis(room?.openerCreatedAt)]);

  useEffect(() => {
    const openerCreatedAtMs = toMillis(room?.openerCreatedAt);
    if (screen !== "opener" || !openerCreatedAtMs) return;
    const tick = () => {
      const elapsed = Date.now() - openerCreatedAtMs;
      setOpenerPhase(elapsed < OPENER_COUNTDOWN_MS ? "countdown" : "answering");
      setOpenerCountdownNum(Math.max(1, Math.ceil((OPENER_COUNTDOWN_MS - elapsed) / 1000)));
      const isHostNow = room.hostId === playerId;
      if (
        isHostNow &&
        !room.openerWinnerId &&
        elapsed >= OPENER_COUNTDOWN_MS + OPENER_ANSWER_MS &&
        openerFallbackFiredRef.current !== openerCreatedAtMs
      ) {
        openerFallbackFiredRef.current = openerCreatedAtMs;
        (async () => {
          try {
            const ref = doc(db, "rooms", roomId);
            await runTransaction(db, async (tx) => {
              const snap = await tx.get(ref);
              const data = snap.data();
              if (data.status !== "opener" || data.openerWinnerId) return;
              tx.update(ref, {
                openerWinnerId: data.hostId,
                openerResolvedAt: serverTimestamp(),
              });
            });
          } catch (e) {
            // ciche niepowodzenie
          }
        })();
      }
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [screen, toMillis(room?.openerCreatedAt), room?.openerWinnerId, room?.hostId, roomId, playerId]);

  // po wyłonieniu zwycięzcy minigry: pokazujemy wynik przez 5s (5 4 3 2 1),
  // a klient zwycięzcy finalizuje przejście do właściwej gry
  useEffect(() => {
    const openerResolvedAtMs = toMillis(room?.openerResolvedAt);
    if (screen !== "opener" || !room?.openerWinnerId || !openerResolvedAtMs) {
      setOpenerRevealCountdown(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, OPENER_REVEAL_MS - (Date.now() - openerResolvedAtMs)) / 1000;
      setOpenerRevealCountdown(Math.ceil(left));
      if (
        left <= 0 &&
        playerId === room.openerWinnerId &&
        openerFinalizeFiredRef.current !== openerResolvedAtMs
      ) {
        openerFinalizeFiredRef.current = openerResolvedAtMs;
        finalizeOpenerStart();
      }
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [screen, room?.openerWinnerId, toMillis(room?.openerResolvedAt), playerId]);


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
        winnerIds: [],
        createdAt: serverTimestamp(),
        messages: [],
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się stworzyć pokoju: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function startPractice() {
    if (!name.trim() && !user) return setError("Podaj swoje imię.");
    setBusy(true);
    setError("");
    try {
      const pool = effectivePool;
      const target = practiceTarget && practiceTarget > 0 ? practiceTarget : 15;
      const needed = target + 7;
      if (pool.length < needed) {
        setError(`Za mało utworów w bibliotece (masz ${pool.length}, potrzeba ${needed}).`);
        setBusy(false);
        return;
      }
      const code = generateRoomCode();
      const ref = doc(db, "rooms", code);
      const deck = shuffle(pool).slice(0, needed);
      const me = { id: playerId, name: name.trim() || user?.displayName || "Gracz", authed: !!user };
      await setDoc(ref, {
        code,
        hostId: playerId,
        target,
        status: "playing",
        players: [me],
        deck,
        deckIndex: 2,
        currentPlayerId: playerId,
        startingPlayerId: playerId,
        currentCard: deck[1],
        startSeconds: randomStartSeconds(),
        turnStartedAt: serverTimestamp(),
        timelines: { [playerId]: [deck[0]] },
        tokens: { [playerId]: 0 },
        lastResult: null,
        pendingGuess: null,
        votes: {},
        requiredApprovals: 0,
        resultAt: null,
        winnerIds: [],
        finishingRound: false,
        decisionTimes: {},
        gameStreaks: {},
        gameGuesses: {},
        gameBestStreaks: {},
        playedCards: [],
        messages: [],
        practiceMode: true,
        createdAt: serverTimestamp(),
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się rozpocząć treningu: " + e.message);
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

  async function beginGame() {
    if (!room) return;
    if (!target || target < 1) {
      setError("Podaj liczbę kart do wygrania.");
      return;
    }
    if (room.players.length < 2) {
      setError("Potrzeba minimum 2 graczy. Do gry solo użyj trybu Trening na ekranie głównym.");
      return;
    }
    const basePool = effectivePool;
    const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
    const pool = filterActive
      ? basePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c)))
      : basePool;
    const EXTRA_CARDS_PER_PLAYER = 7;
    const needed = room.players.length * (target + EXTRA_CARDS_PER_PLAYER);
    if (pool.length < needed + 1) {
      const catNote = filterActive ? ` w wybranych kategoriach (${selectedCategories.join(", ")})` : "";
      setError(`Za mało utworów${catNote} (masz ${pool.length}, potrzeba ${needed + 1}: (${target}+${EXTRA_CARDS_PER_PLAYER}) × ${room.players.length} graczy + 1 na rundę otwierającą).`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      // +1 karta na minigrę "kto zaczyna" — osobna, nie wchodzi do talii rozgrywki
      const extended = shuffle(pool).slice(0, needed + 1);
      const openerCard = extended[0];
      const deck = extended.slice(1);
      const players = room.players;
      const timelines = {};
      const tokens = {};
      players.forEach((p, i) => {
        timelines[p.id] = [deck[i]];
        tokens[p.id] = 1;
      });

      const decoys = shuffle(deck.filter((s) => s.id !== openerCard.id)).slice(0, 3);
      const shuffledOptions = shuffle([openerCard, ...decoys]);
      const openerCorrectIndex = shuffledOptions.findIndex((s) => s.id === openerCard.id);
      const openerOptions = shuffledOptions.map((s) => ({ artist: s.artist, title: s.title }));

      const ref = doc(db, "rooms", roomId);
      await updateDoc(ref, {
        status: "opener",
        target,
        deck,
        deckIndex: players.length + 1,
        currentCard: deck[players.length],
        startSeconds: randomStartSeconds(),
        timelines,
        tokens,
        lastResult: null,
        pendingGuess: null,
        votes: {},
        requiredApprovals: 0,
        resultAt: null,
        winnerIds: [],
        finishingRound: false,
        currentPlayerId: null,
        startingPlayerId: null,
        openerCard,
        openerOptions,
        openerCorrectIndex,
        openerStartSeconds: randomStartSeconds(),
        openerCreatedAt: serverTimestamp(),
        openerWinnerId: null,
        decisionTimes: {},
        gameStreaks: {},
        gameBestStreaks: {},
        playedCards: [],
      });
    } catch (e) {
      setError("Nie udało się rozpocząć gry: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function answerOpener(index) {
    if (!room || room.status !== "opener" || room.openerWinnerId) return;
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "opener" || data.openerWinnerId) return;
        if (index !== data.openerCorrectIndex) return; // zła odpowiedź — nikt nie wygrywa
        tx.update(ref, {
          openerWinnerId: playerId,
          openerResolvedAt: serverTimestamp(),
        });
      });
    } catch (e) {
      setError("Błąd rundy otwierającej: " + e.message);
    }
  }

  // dopiero po chwili wyświetlania wyniku ("X zaczyna!") faktycznie
  // przechodzimy do właściwej gry — wywołuje to klient zwycięzcy
  async function finalizeOpenerStart() {
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "opener" || !data.openerWinnerId) return;
        tx.update(ref, {
          status: "playing",
          currentPlayerId: data.openerWinnerId,
          startingPlayerId: data.openerWinnerId,
          turnStartedAt: serverTimestamp(),
        });
      });
    } catch (e) {
      // ciche niepowodzenie
    }
  }

  function togglePlay() {
    const win = iframeRef.current && iframeRef.current.contentWindow;
    const willPlay = !isPlaying;
    setIsPlaying(willPlay);

    if (playIntervalRef.current) clearInterval(playIntervalRef.current);

    if (willPlay) {
      setPlayElapsed(0);
      const startAt = screen === "opener" ? room.openerStartSeconds : room.startSeconds;
      if (win) {
        win.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [startAt, true] }), "*");
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
    const artist = guessArtist.trim();
    const title = guessTitle.trim();
    const hasGuess = artist.length > 0 || title.length > 0;
    try {
      const ref = doc(db, "rooms", roomId);
      let capturedResult = null;
      let instantGuessAwardedTo = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // runda już się rozstrzygnęła (np. timeout) — nie dokładamy karty drugi raz
        const timeline = data.timelines[data.currentPlayerId] || [];
        const sorted = [...timeline].sort((a, b) => a.year - b.year);
        const before = sorted[chosenSlot - 1];
        const after = sorted[chosenSlot];
        const card = data.currentCard;
        const correct = (!before || before.year <= card.year) && (!after || card.year <= after.year);
        const newTimelines = { ...data.timelines };
        if (correct) newTimelines[data.currentPlayerId] = [...timeline, card];
        capturedResult = { correct, card, practiceMode: !!data.practiceMode };

        // podsumowanie gry: czas decyzji, seria trafień, playlista wieczoru
        const elapsed = Date.now() - (toMillis(data.turnStartedAt) || Date.now());
        const newDecisionTimes = { ...(data.decisionTimes || {}) };
        newDecisionTimes[data.currentPlayerId] = [...(newDecisionTimes[data.currentPlayerId] || []), elapsed];
        const prevStreak = data.gameStreaks?.[data.currentPlayerId] || 0;
        const newStreak = correct ? prevStreak + 1 : 0;
        const newGameStreaks = { ...(data.gameStreaks || {}), [data.currentPlayerId]: newStreak };
        const prevBest = data.gameBestStreaks?.[data.currentPlayerId] || 0;
        const newGameBestStreaks = { ...(data.gameBestStreaks || {}), [data.currentPlayerId]: Math.max(prevBest, newStreak) };
        const newPlayedCards = [...(data.playedCards || []), { ...card, correct, playerId: data.currentPlayerId }];
        const summaryFields = {
          decisionTimes: newDecisionTimes,
          gameStreaks: newGameStreaks,
          gameBestStreaks: newGameBestStreaks,
          playedCards: newPlayedCards,
        };

        const players = data.players;
        if (hasGuess && players.length > 1) {
          tx.update(ref, {
            status: "voting",
            lastResult: { correct, card },
            timelines: newTimelines,
            pendingGuess: { artist, title },
            votes: {},
            requiredApprovals: requiredApprovals(players.length),
            votingStartedAt: serverTimestamp(),
            resultAt: null,
            ...summaryFields,
          });
        } else {
          // brak zgadywania, albo gra solo — bez głosowania (a w solo od razu przyznajemy token)
          if (hasGuess) instantGuessAwardedTo = data.currentPlayerId;
          tx.update(ref, {
            status: "roundResult",
            lastResult: { correct, card, tokenAwarded: hasGuess },
            timelines: newTimelines,
            pendingGuess: null,
            resultAt: serverTimestamp(),
            ...summaryFields,
            ...(hasGuess ? { [`tokens.${data.currentPlayerId}`]: increment(1) } : {}),
          });
        }
      });
      if (user && capturedResult && !capturedResult.practiceMode) {
        recordCardGuess(user.uid, capturedResult.card.year, capturedResult.correct, capturedResult.card.artist, capturedResult.card.videoId).catch(() => {});
      }
      if (user && instantGuessAwardedTo === user.uid && !capturedResult?.practiceMode) {
        recordSuccessfulGuess(user.uid, capturedResult?.card?.videoId).catch(() => {});
      }
    } catch (e) {
      setError("Błąd zatwierdzania: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function buyCard() {
    if (!room || (room.tokens?.[playerId] || 0) < BUY_CARD_TOKENS) return;
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // runda już się rozstrzygnęła — bez sensu kupować kartę do minionej tury
        if ((data.tokens?.[data.currentPlayerId] || 0) < BUY_CARD_TOKENS) return;
        if (data.deckIndex >= data.deck.length) return; // brak kart w talii do kupienia

        const boughtCard = data.deck[data.deckIndex];
        const timeline = data.timelines[data.currentPlayerId] || [];
        const newTimelines = { ...data.timelines, [data.currentPlayerId]: [...timeline, boughtCard] };

        const prevStreak = data.gameStreaks?.[data.currentPlayerId] || 0;
        const newStreak = prevStreak + 1; // kupiona karta zawsze trafiona
        const prevBest = data.gameBestStreaks?.[data.currentPlayerId] || 0;
        const newPlayedCards = [...(data.playedCards || []), { ...boughtCard, correct: true, playerId: data.currentPlayerId, bought: true }];

        const update = {
          timelines: newTimelines,
          deckIndex: data.deckIndex + 1,
          [`tokens.${data.currentPlayerId}`]: increment(-BUY_CARD_TOKENS),
          [`gameStreaks.${data.currentPlayerId}`]: newStreak,
          [`gameBestStreaks.${data.currentPlayerId}`]: Math.max(prevBest, newStreak),
          playedCards: newPlayedCards,
        };

        // kupiona karta może dopełnić cel — nie kończymy gry od razu,
        // tylko oznaczamy rundę do dogrania (jak przy normalnym trafieniu celu)
        if (newTimelines[data.currentPlayerId].length >= data.target) {
          update.finishingRound = true;
        }

        tx.update(ref, update);
      });
    } catch (e) {
      setError("Błąd kupowania karty: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function castVote(accept) {
    if (!room || room.status !== "voting") return;
    if (playerId === room.currentPlayerId) return; // nie głosujesz na własne zgadywanie
    if (room.votes && room.votes[playerId] !== undefined) return; // już zagłosowano
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      let awardedGuessTo = null;
      let awardedGuessVideoId = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "voting") return;
        if (data.votes && data.votes[playerId] !== undefined) return;
        const newVotes = { ...(data.votes || {}), [playerId]: accept };
        const approvals = Object.values(newVotes).filter((v) => v === true).length;
        const rejections = Object.values(newVotes).filter((v) => v === false).length;
        const totalVoters = data.players.length - 1;
        const remaining = totalVoters - (approvals + rejections);
        const required = data.requiredApprovals;

        if (approvals >= required) {
          const guesser = data.players.find((p) => p.id === data.currentPlayerId);
          if (guesser?.authed) {
            awardedGuessTo = data.currentPlayerId;
            awardedGuessVideoId = data.lastResult?.card?.videoId;
          }
          tx.update(ref, {
            status: "roundResult",
            votes: newVotes,
            lastResult: { ...data.lastResult, tokenAwarded: true },
            resultAt: serverTimestamp(),
            [`tokens.${data.currentPlayerId}`]: increment(1),
          });
        } else if (approvals + remaining < required) {
          tx.update(ref, {
            status: "roundResult",
            votes: newVotes,
            lastResult: { ...data.lastResult, tokenAwarded: false },
            resultAt: serverTimestamp(),
          });
        } else {
          tx.update(ref, { votes: newVotes });
        }
      });
      if (awardedGuessTo) {
        recordSuccessfulGuess(awardedGuessTo, awardedGuessVideoId).catch(() => {});
      }
    } catch (e) {
      setError("Błąd głosowania: " + e.message);
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
          turnStartedAt: serverTimestamp(),
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
      let capturedCard = null;
      let capturedPracticeMode = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // ktoś już zdążył zatwierdzić/kupić
        const card = data.currentCard;
        capturedCard = card;
        capturedPracticeMode = !!data.practiceMode;
        const elapsed = Date.now() - (toMillis(data.turnStartedAt) || Date.now());
        const newDecisionTimes = { ...(data.decisionTimes || {}) };
        newDecisionTimes[data.currentPlayerId] = [...(newDecisionTimes[data.currentPlayerId] || []), elapsed];
        const newPlayedCards = [...(data.playedCards || []), { ...card, correct: false, playerId: data.currentPlayerId, timedOut: true }];
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct: false, card, timedOut: true },
          pendingGuess: null,
          resultAt: serverTimestamp(),
          decisionTimes: newDecisionTimes,
          [`gameStreaks.${data.currentPlayerId}`]: 0,
          playedCards: newPlayedCards,
        });
      });
      if (user && capturedCard && !capturedPracticeMode) {
        recordCardGuess(user.uid, capturedCard.year, false, capturedCard.artist, capturedCard.videoId).catch(() => {});
      }
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
        if (data.status !== "roundResult") return; // ktoś już zdążył przejść dalej
        const players = data.players;
        const idx = players.findIndex((p) => p.id === data.currentPlayerId);
        const nextIdx = (idx + 1) % players.length;

        const someoneReachedTarget = Object.values(data.timelines).some((t) => t.length >= data.target);
        const finishingRound = data.finishingRound || someoneReachedTarget;
        const deckExhausted = data.deckIndex >= data.deck.length;
        // runda kończy się, gdy tura wraca do gracza, który zaczynał —
        // wtedy wszyscy mieli dokładnie tyle samo tur
        const lapWillComplete = players[nextIdx].id === data.startingPlayerId;

        if (deckExhausted || (finishingRound && lapWillComplete)) {
          let best = 0;
          players.forEach((p) => {
            const len = (data.timelines[p.id] || []).length;
            if (len > best) best = len;
          });
          let contenders = players.filter((p) => (data.timelines[p.id] || []).length === best);

          if (contenders.length > 1) {
            let bestTokens = 0;
            contenders.forEach((p) => {
              const t = data.tokens?.[p.id] || 0;
              if (t > bestTokens) bestTokens = t;
            });
            const byTokens = contenders.filter((p) => (data.tokens?.[p.id] || 0) === bestTokens);
            if (byTokens.length > 0) contenders = byTokens;
          }

          if (contenders.length > 1) {
            let bestGuesses = 0;
            contenders.forEach((p) => {
              const g = data.gameGuesses?.[p.id] || 0;
              if (g > bestGuesses) bestGuesses = g;
            });
            const byGuesses = contenders.filter((p) => (data.gameGuesses?.[p.id] || 0) === bestGuesses);
            if (byGuesses.length > 0) contenders = byGuesses;
          }

          const winnerIds = contenders.map((p) => p.id);
          tx.update(ref, { status: "gameover", winnerIds });
          gameOverInfo = { winnerIds, players, practiceMode: !!data.practiceMode };
          return;
        }

        tx.update(ref, {
          status: "playing",
          currentPlayerId: players[nextIdx].id,
          currentCard: data.deck[data.deckIndex],
          deckIndex: data.deckIndex + 1,
          startSeconds: randomStartSeconds(),
          turnStartedAt: serverTimestamp(),
          lastResult: null,
          pendingGuess: null,
          votes: {},
          resultAt: null,
          finishingRound,
        });
      });
      if (gameOverInfo && !gameOverInfo.practiceMode) {
        gameOverInfo.players
          .filter((p) => p.authed)
          .forEach((p) => {
            recordGameResult(p.id, gameOverInfo.winnerIds.includes(p.id)).catch(() => {});
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
    setShowChat(false);
    setChatInput("");
  }

  function goHome() {
    if (roomId) {
      leaveRoom();
    } else {
      setShowStats(false);
      setShowLeaderboard(false);
      setShowAdminPanel(false);
      setViewingPlayer(null);
      setShowProposeForm(false);
    }
  }

  async function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !roomId) return;
    setChatInput("");
    try {
      const ref = doc(db, "rooms", roomId);
      await updateDoc(ref, {
        messages: arrayUnion({ playerId, name: name || user?.displayName || "Gracz", text, ts: Date.now() }),
      });
    } catch (e) {
      // ciche niepowodzenie — wiadomość po prostu nie doleci
    }
  }

  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (showChat) {
      setChatSeenCount(room?.messages?.length || 0);
    }
  }, [showChat, room?.messages?.length]);

  async function playAgain() {
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      await updateDoc(ref, {
        status: "lobby",
        deck: [],
        deckIndex: 0,
        currentPlayerId: null,
        startingPlayerId: null,
        currentCard: null,
        timelines: {},
        lastResult: null,
        winnerIds: [],
        finishingRound: false,
        openerCard: null,
        openerOptions: [],
        openerWinnerId: null,
        openerCreatedAt: null,
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
      style={{
        background:
          "radial-gradient(ellipse 850px 600px at 8% -5%, rgba(0,230,195,0.20), transparent 60%), radial-gradient(ellipse 800px 650px at 100% 0%, rgba(139,92,246,0.18), transparent 55%), radial-gradient(ellipse 750px 550px at 50% 115%, rgba(255,95,201,0.10), transparent 55%), var(--bg)",
        color: "var(--text)",
        fontFamily: "'Space Mono', monospace",
        padding: "32px 16px 64px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        :root {
          --bg: #050810; --surface: rgba(14,26,38,0.78); --surface2: rgba(20,36,50,0.9);
          --accent: #00e6c3; --accent2: #8b5cf6; --accent3: #ff5fc9; --gold: #ffb020;
          --good: #2af598; --bad: #ff3868;
          --text: #f4eefc; --muted: #9c8fc2;
        }
        @keyframes spin-record { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bg-drift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 18px -4px var(--accent), 0 0 34px -12px var(--accent2); }
          50% { box-shadow: 0 0 28px -2px var(--accent), 0 0 48px -8px var(--accent2); }
        }
        button { transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease; }
        .btn-grad {
          background: linear-gradient(115deg, var(--accent), var(--accent2) 55%, var(--accent3));
          background-size: 220% 220%;
          color: #0a0410;
          box-shadow: 0 0 20px -4px var(--accent), 0 0 34px -10px var(--accent2), 0 6px 18px -8px rgba(0,0,0,0.6);
          animation: bg-drift 5s ease infinite;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .btn-grad:hover { filter: brightness(1.12); transform: translateY(-2px); box-shadow: 0 0 30px -2px var(--accent), 0 0 50px -6px var(--accent3), 0 10px 24px -8px rgba(0,0,0,0.6); }
        .btn-grad:active { transform: translateY(0); }
        .card-glow {
          position: relative;
          background: var(--surface);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 0 0 1px rgba(0,230,195,0.25), 0 0 30px -14px var(--accent2), 0 16px 34px -20px rgba(0,0,0,0.75);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .card-glow::before {
          content: ""; position: absolute; top: 0; left: 16px; right: 16px; height: 2px; border-radius: 2px;
          background: linear-gradient(90deg, transparent, var(--accent), var(--accent3), var(--accent2), transparent);
          opacity: 0.9;
        }
        .row-hover { transition: transform 0.15s ease, background 0.15s ease; }
        .row-hover:hover { transform: translateX(2px); background: var(--surface2) !important; }
        .slot-btn { transition: all 0.15s ease; }
        .slot-btn:hover { background: linear-gradient(115deg, var(--accent), var(--accent2), var(--accent3)) !important; color: #0a0410 !important; box-shadow: 0 0 16px -2px var(--accent); }
        .pulse-cta { animation: pulse-glow 2.4s ease-in-out infinite; }
        input[type="text"], input[type="number"], input[type="password"], textarea {
          background: var(--surface2); border: 1px solid rgba(139,92,246,0.35); color: var(--text);
          border-radius: 8px; padding: 8px 10px; font-family: 'Space Mono', monospace;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        input:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(0,230,195,0.25); }
      `}</style>

      <div className="w-full flex flex-col items-center" style={{ maxWidth: 720 }}>
        <button
          onClick={goHome}
          className="flex items-center justify-center mb-1"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          title="Strona główna"
        >
          <img src={logoImg} alt="Hitsteriada" style={{ height: 100, filter: "drop-shadow(0 0 18px rgba(0,230,195,0.55)) drop-shadow(0 0 28px rgba(139,92,246,0.3))" }} />
        </button>
        <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 24 }}>online • każdy gra u siebie, w swoim miejscu</p>

        {error && (
          <div className="w-full rounded-lg p-3 mb-4 text-sm" style={{ background: "rgba(232,97,93,0.12)", border: "1px solid var(--bad)", color: "var(--bad)" }}>
            {error}
          </div>
        )}

        {screen === "home" && showStats && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
                    <StatBox label="🎧 Odgadnięte wykonawcy/tytuły" value={stats.guessesCorrect || 0} />
                    <StatBox label="🎵 Przesłuchane piosenki" value={`${(stats.heardSongs || []).length}/${effectivePool.length}`} />
                    <StatBox label="🔎 Odgadnięte piosenki" value={`${(stats.guessedSongs || []).length}/${effectivePool.length}`} />
                    <StatBox label="📀 Dodane do bazy" value={stats.songsAdded || 0} />
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

        {screen === "home" && showLeaderboard && !viewingPlayer && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 12 }}>RANKING GRACZY</h2>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => openLeaderboard("gamesWon")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: leaderboardSort === "gamesWon" ? "var(--accent)" : "var(--surface2)", color: leaderboardSort === "gamesWon" ? "#1a1428" : "var(--muted)" }}
                >
                  🏆 Wygrane
                </button>
                <button
                  onClick={() => openLeaderboard("guessesCorrect")}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: leaderboardSort === "guessesCorrect" ? "var(--accent)" : "var(--surface2)", color: leaderboardSort === "guessesCorrect" ? "#1a1428" : "var(--muted)" }}
                >
                  🎧 Zgadywanie
                </button>
              </div>
              {!leaderboard ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Ładowanie…</p>
              ) : leaderboard.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Brak jeszcze żadnych wyników.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {leaderboard.map((p, i) => (
                    <button
                      key={p.uid}
                      onClick={() => viewPlayerProfile(p)}
                      className="flex items-center justify-between px-3 py-2 rounded-lg w-full text-left"
                      style={{ background: "var(--surface2)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: i === 0 ? "var(--accent)" : "var(--muted)", width: 24 }}>
                          {i === 0 ? <Crown size={18} /> : `#${i + 1}`}
                        </span>
                        <span>{p.username}</span>
                      </div>
                      <span style={{ color: "var(--accent)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>
                        {leaderboardSort === "gamesWon" ? `${p.gamesWon || 0} wygranych` : `${p.guessesCorrect || 0} zgadniętych`}
                      </span>
                    </button>
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

        {screen === "home" && showLeaderboard && viewingPlayer && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 12 }}>{viewingPlayer.username}</h2>
              {!viewingPlayer.stats ? (
                <p style={{ color: "var(--muted)", fontSize: 13 }}>Brak jeszcze żadnych rozegranych gier.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-4 flex-wrap">
                    <StatBox label="Rozegrane gry" value={viewingPlayer.stats.gamesPlayed || 0} />
                    <StatBox label="Wygrane" value={viewingPlayer.stats.gamesWon || 0} />
                    <StatBox
                      label="% wygranych"
                      value={viewingPlayer.stats.gamesPlayed ? Math.round(((viewingPlayer.stats.gamesWon || 0) / viewingPlayer.stats.gamesPlayed) * 100) + "%" : "—"}
                    />
                    <StatBox
                      label="Trafność kart"
                      value={viewingPlayer.stats.cardsTotal ? Math.round(((viewingPlayer.stats.cardsCorrect || 0) / viewingPlayer.stats.cardsTotal) * 100) + "%" : "—"}
                    />
                    <StatBox label="Rekordowy streak" value={(viewingPlayer.stats.longestStreak || 0) + " 🔥"} />
                    <StatBox label="🎧 Odgadnięte wykonawcy/tytuły" value={viewingPlayer.stats.guessesCorrect || 0} />
                    <StatBox label="📀 Dodane do bazy" value={viewingPlayer.stats.songsAdded || 0} />
                  </div>
                  {viewingPlayer.stats.decades && Object.keys(viewingPlayer.stats.decades).length > 0 && (
                    <div>
                      <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Skuteczność wg dekad</p>
                      <div className="flex flex-col gap-1">
                        {Object.entries(viewingPlayer.stats.decades)
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
                </div>
              )}
            </section>
            <button
              onClick={() => setViewingPlayer(null)}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ border: "1px solid #33294f", color: "var(--muted)" }}
            >
              ← Wróć do rankingu
            </button>
          </div>
        )}

        {screen === "home" && showAdminPanel && (
          <div className="w-full flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24 }}>PANEL ADMINA</h2>
              <button onClick={() => setShowAdminPanel(false)} className="text-xs" style={{ color: "var(--muted)" }}>
                ← Wróć
              </button>
            </div>

            <button
              onClick={() => {
                setShowProposals((v) => !v);
                if (!proposals) loadProposals();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
            >
              💡 Propozycje utworów od graczy {proposals ? `(${proposals.length})` : ""}
            </button>

            {showProposals && (
              <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                {!proposals ? (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>Ładowanie…</p>
                ) : proposals.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--muted)" }}>Brak oczekujących propozycji.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {proposals.map((p) => (
                      <div key={p.id} className="rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                        {proposalEditingId === p.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap">
                              <input type="text" value={proposalEditDraft.artist} onChange={(e) => setProposalEditDraft({ ...proposalEditDraft, artist: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                              <input type="text" value={proposalEditDraft.title} onChange={(e) => setProposalEditDraft({ ...proposalEditDraft, title: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                            </div>
                            <input type="text" value={proposalEditDraft.url} onChange={(e) => setProposalEditDraft({ ...proposalEditDraft, url: e.target.value })} placeholder="Link YouTube" />
                            <div className="flex gap-2 flex-wrap">
                              <input type="number" value={proposalEditDraft.year} onChange={(e) => setProposalEditDraft({ ...proposalEditDraft, year: e.target.value })} style={{ width: 90 }} />
                              <input type="text" value={proposalEditDraft.categoriesText} onChange={(e) => setProposalEditDraft({ ...proposalEditDraft, categoriesText: e.target.value })} placeholder="kategorie;po;średniku" className="flex-1" style={{ minWidth: 140 }} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveProposalEdit(p.id)} disabled={adminBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                                <Save size={12} /> Zapisz
                              </button>
                              <button onClick={() => setProposalEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid #33294f", color: "var(--muted)" }}>
                                <X size={12} /> Anuluj
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <p style={{ fontSize: 13 }}>
                                <strong>{p.artist}</strong> — {p.title} ({p.year})
                              </p>
                              <p style={{ fontSize: 10, color: "var(--muted)" }}>
                                {(p.categories || []).join(", ")} · zgłosił: {p.submittedBy}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAcceptProposal(p)} disabled={adminBusy} style={{ color: "var(--good)" }} title="Akceptuj">
                                <Check size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setProposalEditingId(p.id);
                                  setProposalEditDraft({
                                    artist: p.artist,
                                    title: p.title,
                                    year: p.year,
                                    url: `https://www.youtube.com/watch?v=${p.videoId}`,
                                    videoId: p.videoId,
                                    categoriesText: (p.categories || []).join(";"),
                                  });
                                }}
                                style={{ color: "var(--accent)" }}
                                title="Edytuj"
                              >
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleRejectProposal(p.id)} disabled={adminBusy} style={{ color: "var(--bad)" }} title="Odrzuć">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {(!librarySongs || librarySongs.length === 0) && (
              <section className="w-full rounded-2xl p-4" style={{ background: "rgba(231,178,76,0.1)", border: "1px solid var(--accent)" }}>
                <p style={{ fontSize: 12, marginBottom: 8 }}>
                  Baza w Firestore jest pusta — gra korzysta teraz z wbudowanej listy ({REAL_SONGS.length} utworów), której nie da się edytować na żywo.
                  Wgraj ją do bazy jednym kliknięciem, żeby móc dalej edytować bezpośrednio w appce:
                </p>
                <button
                  onClick={handleMigrate}
                  disabled={adminBusy}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: "var(--accent)", color: "#1a1428" }}
                >
                  {migrateProgress ? `Wgrywanie… ${migrateProgress.done}/${migrateProgress.total}` : "Wgraj wbudowaną listę do bazy"}
                </button>
              </section>
            )}

            {librarySongs && librarySongs.length > 0 && (
              <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <p style={{ fontSize: 12, marginBottom: 8, color: "var(--muted)" }}>
                  Dogrywa kategorie zapisane wcześniej z analizy (dopasowanie po linku YouTube) do utworów już będących w bazie.
                </p>
                <button
                  onClick={handleApplyCategoryPatch}
                  disabled={adminBusy}
                  className="px-4 py-2 rounded-lg text-sm font-bold"
                  style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
                >
                  {migrateProgress ? `Wgrywanie… ${migrateProgress.done}/${migrateProgress.total}` : "Zastosuj zapisane kategorie"}
                </button>
              </section>
            )}

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>📥 Import z CSV (masowo)</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Format wierszy: <code>url;wykonawca;tytuł;rok;kategorie;po;średniku</code>. Duplikaty (po linku YouTube) są pomijane automatycznie.
              </p>
              <input type="file" accept=".csv,text/csv" onChange={handleImportFilePick} style={{ fontSize: 12, marginBottom: 8 }} />
              <textarea
                rows={5}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder="Wklej tu zawartość pliku CSV, albo wybierz plik powyżej…"
                className="w-full"
              />
              <button
                onClick={handleImportCsv}
                disabled={importBusy || !importCsvText.trim()}
                className="mt-2 px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--good)", color: "#0d1f1a" }}
              >
                {importBusy
                  ? migrateProgress
                    ? `Importowanie… ${migrateProgress.done}/${migrateProgress.total}`
                    : "Sprawdzam duplikaty…"
                  : "Importuj do bazy"}
              </button>
              {importResult && (
                <p style={{ fontSize: 12, marginTop: 8, color: "var(--good)" }}>
                  ✓ Dodano {importResult.added} nowych utworów. Pominięto: {importResult.skippedDup} duplikatów, {importResult.skippedBad} błędnych wierszy (z {importResult.totalRows} w pliku).
                </p>
              )}
            </section>

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Dodaj nowy utwór</p>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 flex-wrap">
                  <input type="text" placeholder="Wykonawca" value={adminNewSong.artist} onChange={(e) => setAdminNewSong({ ...adminNewSong, artist: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                  <input type="text" placeholder="Tytuł" value={adminNewSong.title} onChange={(e) => setAdminNewSong({ ...adminNewSong, title: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                </div>
                <input type="text" placeholder="Link YouTube" value={adminNewSong.url} onChange={(e) => setAdminNewSong({ ...adminNewSong, url: e.target.value })} />
                <div className="flex gap-2 flex-wrap">
                  <input type="number" placeholder="Rok" value={adminNewSong.year} onChange={(e) => setAdminNewSong({ ...adminNewSong, year: e.target.value })} style={{ width: 90 }} />
                  <input type="text" placeholder="kategorie;po;średniku" value={adminNewSong.categories} onChange={(e) => setAdminNewSong({ ...adminNewSong, categories: e.target.value })} className="flex-1" style={{ minWidth: 140 }} />
                </div>
                <button onClick={handleAdminAdd} disabled={adminBusy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                  + Dodaj
                </button>
              </div>
            </section>

            <div className="flex items-center gap-2">
              <Search size={16} color="var(--muted)" />
              <input type="text" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Szukaj po wykonawcy lub tytule…" className="flex-1" />
            </div>

            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              {librarySongs ? `${librarySongs.length} utworów w bazie` : "Ładowanie…"}
            </p>

            {(() => {
              const filtered = (librarySongs || [])
                .filter((s) => {
                  const q = adminSearch.trim().toLowerCase();
                  if (!q) return true;
                  return s.artist.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
                })
                .sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
              const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_PAGE_SIZE));
              const page = Math.min(adminPage, totalPages);
              const pageItems = filtered.slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);

              return (
                <>
                  <p style={{ fontSize: 11, color: "var(--muted)" }}>
                    {filtered.length} wyników — strona {page}/{totalPages}
                  </p>

                  <div className="flex flex-col gap-2">
                    {pageItems.map((s) => (
                      <div key={s.id} className="rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                        {adminEditingId === s.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap">
                              <input type="text" value={adminEditDraft.artist} onChange={(e) => setAdminEditDraft({ ...adminEditDraft, artist: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                              <input type="text" value={adminEditDraft.title} onChange={(e) => setAdminEditDraft({ ...adminEditDraft, title: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                            </div>
                            <input type="text" value={adminEditDraft.url} onChange={(e) => setAdminEditDraft({ ...adminEditDraft, url: e.target.value })} placeholder="Link YouTube" />
                            <div className="flex gap-2 flex-wrap">
                              <input type="number" value={adminEditDraft.year} onChange={(e) => setAdminEditDraft({ ...adminEditDraft, year: e.target.value })} style={{ width: 90 }} />
                              <input type="text" value={adminEditDraft.categoriesText} onChange={(e) => setAdminEditDraft({ ...adminEditDraft, categoriesText: e.target.value })} placeholder="kategorie;po;średniku" className="flex-1" style={{ minWidth: 140 }} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleAdminSave(s.id)} disabled={adminBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                                <Save size={12} /> Zapisz
                              </button>
                              <button onClick={() => setAdminEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid #33294f", color: "var(--muted)" }}>
                                <X size={12} /> Anuluj
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <p style={{ fontSize: 13 }}>
                                <strong>{s.artist}</strong> — {s.title} ({s.year})
                              </p>
                              <p style={{ fontSize: 10, color: "var(--muted)" }}>{(s.categories || []).join(", ") || "brak kategorii"}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setAdminEditingId(s.id);
                                  setAdminEditDraft({
                                    artist: s.artist,
                                    title: s.title,
                                    year: s.year,
                                    url: `https://www.youtube.com/watch?v=${s.videoId}`,
                                    categoriesText: (s.categories || []).join(";"),
                                  });
                                }}
                                style={{ color: "var(--accent)" }}
                              >
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => handleAdminDelete(s.id)} disabled={adminBusy} style={{ color: "var(--bad)" }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
                      <button
                        onClick={() => setAdminPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: page <= 1 ? "#231d38" : "var(--surface2)", color: page <= 1 ? "var(--muted)" : "var(--text)", border: "1px solid #33294f" }}
                      >
                        ← Poprzednia
                      </button>
                      <span style={{ fontSize: 12, color: "var(--muted)" }}>
                        Strona {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setAdminPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold"
                        style={{ background: page >= totalPages ? "#231d38" : "var(--surface2)", color: page >= totalPages ? "var(--muted)" : "var(--text)", border: "1px solid #33294f" }}
                      >
                        Następna →
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {screen === "home" && !showStats && !showLeaderboard && !showAdminPanel && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
              <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Graj bez konta — podaj imię</label>
                <input type="text" value={name} onChange={(e) => saveName(e.target.value)} className="w-full mt-2" placeholder="np. Kasia" />
              </section>
            )}

            <button
              onClick={() => openLeaderboard()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "var(--surface2)", border: "1px solid #33294f", color: "var(--accent)" }}
            >
              <Trophy size={16} /> Ranking graczy
            </button>

            {user && (
              <>
                <button
                  onClick={() => setShowProposeForm((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "var(--surface2)", border: "1px solid #33294f", color: "var(--good)" }}
                >
                  💡 Zaproponuj nowy utwór
                </button>

                {showProposeForm && (
                  <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                    {proposeSuccess ? (
                      <p style={{ color: "var(--good)", fontSize: 13, textAlign: "center" }}>✓ Dzięki! Propozycja czeka na zatwierdzenie.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2 flex-wrap">
                          <input type="text" placeholder="Wykonawca" value={proposeDraft.artist} onChange={(e) => setProposeDraft({ ...proposeDraft, artist: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                          <input type="text" placeholder="Tytuł" value={proposeDraft.title} onChange={(e) => setProposeDraft({ ...proposeDraft, title: e.target.value })} className="flex-1" style={{ minWidth: 100 }} />
                        </div>
                        <input type="text" placeholder="Link YouTube" value={proposeDraft.url} onChange={(e) => setProposeDraft({ ...proposeDraft, url: e.target.value })} />
                        <input type="number" placeholder="Rok" value={proposeDraft.year} onChange={(e) => setProposeDraft({ ...proposeDraft, year: e.target.value })} style={{ width: 90 }} />

                        <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginTop: 4 }}>Kategorie (min. 1)</p>
                        <div className="flex flex-wrap gap-2">
                          {CATEGORIES.map((c) => {
                            const active = proposeDraft.categories.includes(c.slug);
                            return (
                              <button
                                key={c.slug}
                                type="button"
                                onClick={() => toggleProposeCategory(c.slug)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                                style={{ background: active ? "var(--accent)" : "var(--surface2)", color: active ? "#1a1428" : "var(--muted)" }}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>

                        {proposeError && <p style={{ color: "var(--bad)", fontSize: 12 }}>{proposeError}</p>}
                        <button onClick={handleSubmitProposal} disabled={proposeBusy} className="px-4 py-2 rounded-lg text-sm font-bold mt-1" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                          Wyślij propozycję
                        </button>
                      </div>
                    )}
                  </section>
                )}
              </>
            )}

            {adminUnlocked ? (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                <Shield size={16} /> Panel admina ({effectivePool.length} utworów)
              </button>
            ) : showAdminLogin ? (
              <div className="w-full rounded-xl p-3 flex gap-2 items-center flex-wrap" style={{ background: "var(--surface2)", border: "1px solid #33294f" }}>
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlockAdmin()}
                  placeholder="Hasło admina"
                  className="flex-1"
                  style={{ minWidth: 120 }}
                />
                <button onClick={unlockAdmin} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                  Odblokuj
                </button>
                {adminError && <span style={{ color: "var(--bad)", fontSize: 11 }}>{adminError}</span>}
              </div>
            ) : (
              <button
                onClick={() => setShowAdminLogin(true)}
                className="self-center text-xs"
                style={{ color: "var(--muted)" }}
              >
                🔐 Tryb admina
              </button>
            )}

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>NOWA GRA</h2>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>Stwórz pokój i wyślij kod znajomym.</p>
              <button onClick={createRoom} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold btn-grad">
                Stwórz pokój
              </button>
            </section>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>🎯 TRENING (SOLO)</h2>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10 }}>
                Ćwicz sam — tylko układanie kart na osi, bez zgadywania i bez zapisywania statystyk.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Kart do zebrania:</label>
                <input type="number" min={1} value={practiceTarget} onChange={(e) => setPracticeTarget(parseInt(e.target.value, 10) || "")} style={{ width: 60 }} />
                <button onClick={startPractice} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                  Zacznij trening
                </button>
              </div>
            </section>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
                <button onClick={joinRoom} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold btn-grad">
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

            <section className="w-full rounded-2xl p-5 flex flex-col items-center card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <p style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase" }}>Kod pokoju</p>
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, letterSpacing: 4, color: "var(--accent)" }}>{roomId}</span>
                <button onClick={copyCode} style={{ color: "var(--muted)" }}>
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </button>
              </div>
              <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 4 }}>Prześlij ten kod znajomym, żeby dołączyli</p>
            </section>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
              <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
                  {(() => {
                    const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
                    const count = filterActive
                      ? effectivePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c))).length
                      : effectivePool.length;
                    return filterActive
                      ? `${count} utworów pasuje do wybranych kategorii (z ${effectivePool.length} w całej bibliotece).`
                      : `Gracie z pełną biblioteką ${effectivePool.length} utworów.`;
                  })()}
                </p>
                <button
                  onClick={beginGame}
                  disabled={busy || !target || room.players.length < 2}
                  className="w-full mt-4 py-3 rounded-xl text-lg font-bold flex items-center justify-center gap-2 btn-grad pulse-cta"
                  style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                >
                  ROZPOCZNIJ GRĘ <ChevronRight size={20} />
                </button>
                {!target && <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>Podaj liczbę kart do wygrania</p>}
                {target && room.players.length < 2 && (
                  <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>
                    Potrzeba minimum 2 graczy — do gry solo użyj Treningu na ekranie głównym.
                  </p>
                )}
              </section>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Czekasz, aż {room.players.find((p) => p.id === room.hostId)?.name} rozpocznie grę…</p>
            )}
          </div>
        )}

        {screen === "opener" && room && room.openerCard && (
          <div className="w-full flex flex-col items-center gap-6">
            {openerPhase === "countdown" ? (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "var(--bg)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 50,
                }}
              >
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--muted)", marginBottom: 16, letterSpacing: 2 }}>
                  KTO ZACZYNA?
                </p>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 160, color: "var(--accent)", lineHeight: 1 }}>
                  {openerCountdownNum}
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, textAlign: "center" }}>KTO ZACZYNA?</p>
                <div className="w-full rounded-2xl p-5 flex flex-col items-center card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                  <Vinyl spinning={isPlaying} revealed={!!room.openerWinnerId} progress={playElapsed / PLAY_CAP_SECONDS} />
                  <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
                    <iframe
                      key={"opener-" + room.openerCard.id}
                      ref={iframeRef}
                      title="opener-player"
                      width="280"
                      height="158"
                      src={`https://www.youtube.com/embed/${room.openerCard.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.openerStartSeconds}&controls=0&modestbranding=1&rel=0`}
                      allow="autoplay; encrypted-media"
                      style={{ border: "none" }}
                    />
                  </div>
                  {!isPlaying && (
                    <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 10, textAlign: "center" }}>
                      Wideo już gra wyciszone — kliknij, żeby usłyszeć dźwięk
                    </p>
                  )}
                  <button
                    onClick={togglePlay}
                    className="mt-2 flex items-center gap-2 px-8 py-3 rounded-full text-base font-bold"
                    style={{ background: "var(--accent)", color: "#1a1428" }}
                  >
                    <Play size={20} />
                    {isPlaying ? `Gra… (${Math.ceil(PLAY_CAP_SECONDS - playElapsed)}s)` : "🔊 Włącz dźwięk"}
                  </button>
                </div>

                {room.openerWinnerId ? (
                  <div className="w-full flex flex-col items-center gap-2">
                    <p style={{ color: "var(--good)", fontSize: 18, fontWeight: "bold", textAlign: "center" }}>
                      {room.players.find((p) => p.id === room.openerWinnerId)?.name} zgadł(a) pierwszy(a) i zaczyna!
                    </p>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 44, color: "var(--accent)" }}>
                      {openerRevealCountdown ?? 5}
                    </p>
                  </div>
                ) : (
                  <>
                    <p style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase" }}>Kto pierwszy zaznaczy poprawną odpowiedź, zaczyna grę</p>
                    <div className="w-full grid grid-cols-1 gap-2">
                      {room.openerOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setOpenerLockedOut(true);
                            answerOpener(i);
                          }}
                          disabled={openerLockedOut}
                          className="w-full py-3 rounded-xl text-sm font-bold text-left px-4"
                          style={{
                            background: openerLockedOut ? "#33294f" : "var(--surface2)",
                            color: openerLockedOut ? "var(--muted)" : "var(--text)",
                            border: "1px solid #33294f",
                          }}
                        >
                          {opt.artist} — {opt.title}
                        </button>
                      ))}
                    </div>
                    {openerLockedOut && <p style={{ color: "var(--muted)", fontSize: 11 }}>Odpowiedziałeś(aś) — czekaj na wynik…</p>}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {(screen === "playing" || screen === "voting" || screen === "roundResult") && room && room.currentCard && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="w-full rounded-2xl p-5 flex flex-col items-center card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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

            {screen === "playing" && isMyTurn && !room.practiceMode && (
              <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <div className="flex items-center justify-between mb-2">
                  <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Zgadnij wykonawcę i tytuł (opcjonalnie, +1 token)</p>
                  <span style={{ color: "var(--accent)", fontSize: 12, fontWeight: "bold" }}>🪙 {room.tokens?.[playerId] || 0}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input type="text" value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} placeholder="Wykonawca" className="flex-1" style={{ minWidth: 120 }} />
                  <input type="text" value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} placeholder="Tytuł" className="flex-1" style={{ minWidth: 120 }} />
                </div>
                <p style={{ color: "var(--muted)", fontSize: 10, marginTop: 4 }}>
                  Inni gracze zagłosują, czy Twoja odpowiedź się liczy — zostaw puste, jeśli nie zgadujesz.
                </p>

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
                      <TimelineCard year={c.year} title={c.title} artist={c.artist} onHold={setHeldCard} onRelease={clearHeldCard} />
                      <SlotButton index={i + 1} chosen={chosenSlot} onPick={setChosenSlot} label="tutaj" />
                    </React.Fragment>
                  ))}
                </div>
                <button
                  onClick={confirmPlacement}
                  disabled={chosenSlot === null || busy}
                  className={`w-full mt-5 py-3 rounded-xl text-lg font-bold ${chosenSlot !== null ? "btn-grad" : ""}`}
                  style={{
                    background: chosenSlot === null ? "#232f4d" : undefined,
                    color: chosenSlot === null ? "var(--muted)" : undefined,
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
                    <TimelineCard key={c.id} year={c.year} title={c.title} artist={c.artist} onHold={setHeldCard} onRelease={clearHeldCard} />
                  ))}
                </div>
              </div>
            )}

            {screen === "voting" && room.pendingGuess && (
              <div className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, textAlign: "center", marginBottom: 10 }}>
                  {isMyTurn ? "Czekasz na głosy…" : `Czy ${turnPlayerName} zgadł(a) poprawnie?`}
                </p>
                <div className="rounded-lg p-3 mb-2" style={{ background: "var(--surface2)" }}>
                  <p style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Prawidłowa odpowiedź</p>
                  <p style={{ fontSize: 15 }}>{room.lastResult.card.artist} — „{room.lastResult.card.title}"</p>
                </div>
                <div className="rounded-lg p-3 mb-3" style={{ background: "var(--surface2)" }}>
                  <p style={{ fontSize: 10, color: "var(--accent)", textTransform: "uppercase" }}>Odpowiedź gracza</p>
                  <p style={{ fontSize: 15 }}>{room.pendingGuess.artist || "—"} — „{room.pendingGuess.title || "—"}"</p>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 11, textAlign: "center", marginBottom: 4 }}>
                  Potrzeba {room.requiredApprovals} głos{room.requiredApprovals === 1 ? "u" : "ów"} na TAK
                  {" · "}oddano {Object.keys(room.votes || {}).length}/{room.players.length - 1}
                </p>
                {votingCountdown !== null && (
                  <p style={{ color: votingCountdown <= 5 ? "var(--bad)" : "var(--muted)", fontSize: 11, textAlign: "center", marginBottom: 10 }}>
                    ⏱ {votingCountdown}s (brak głosu = TAK)
                  </p>
                )}
                {!isMyTurn && (room.votes?.[playerId] === undefined ? (
                  <div className="flex gap-3">
                    <button onClick={() => castVote(true)} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                      ✓ TAK, zalicza się
                    </button>
                    <button onClick={() => castVote(false)} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--bad)", color: "#2a1414" }}>
                      ✗ NIE
                    </button>
                  </div>
                ) : (
                  <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12 }}>Twój głos: {room.votes[playerId] ? "TAK" : "NIE"}</p>
                ))}
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
                  {room.lastResult.tokenAwarded !== undefined && (
                    <p style={{ fontSize: 12, marginTop: 6, color: room.lastResult.tokenAwarded ? "var(--accent)" : "var(--muted)" }}>
                      {room.lastResult.tokenAwarded ? "🪙 Zgadywanie zaliczone! +1 token" : "Zgadywanie nie zaliczone"}
                    </p>
                  )}
                </div>
                <p style={{ color: "var(--muted)", fontSize: 13 }}>
                  Kolejny gracz za {advanceCountdown ?? 5}…
                </p>
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
                  {p.name}: {(room.timelines[p.id] || []).length}/{room.target} · 🪙{room.tokens?.[p.id] || 0}
                </div>
              ))}
            </div>
          </div>
        )}

        {screen === "gameover" && room && room.winnerIds && room.winnerIds.length > 0 && (
          <div className="w-full flex flex-col items-center gap-5 text-center">
            <Trophy size={48} color="var(--accent)" />
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34 }}>
              {room.winnerIds.length > 1
                ? `REMIS: ${room.winnerIds.map((id) => room.players.find((p) => p.id === id)?.name).join(" i ")}!`
                : `${room.players.find((p) => p.id === room.winnerIds[0])?.name} WYGRYWA!`}
            </p>
            {room.winnerIds.map((id) => (
              <p key={id} style={{ color: "var(--muted)", fontSize: 13 }}>
                {room.winnerIds.length > 1 && <strong style={{ color: "var(--text)" }}>{room.players.find((p) => p.id === id)?.name}: </strong>}
                Oś czasu: {(room.timelines[id] || []).map((c) => c.year).sort((a, b) => a - b).join(" → ")}
              </p>
            ))}

            {(() => {
              // najszybszy gracz — najniższy średni czas decyzji
              const avgTimes = Object.entries(room.decisionTimes || {})
                .filter(([, times]) => times.length > 0)
                .map(([id, times]) => ({ id, avg: times.reduce((a, b) => a + b, 0) / times.length }));
              const fastest = avgTimes.length ? avgTimes.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

              // najdłuższa seria trafień w tej rozgrywce
              const streakEntries = Object.entries(room.gameBestStreaks || {}).filter(([, s]) => s > 0);
              const bestStreak = streakEntries.length ? streakEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;

              if (!fastest && !bestStreak) return null;

              return (
                <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                  <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>Podsumowanie gry</p>
                  <div className="flex gap-3 flex-wrap justify-center">
                    {fastest && (
                      <StatBox
                        label="Najszybszy gracz"
                        value={`${room.players.find((p) => p.id === fastest.id)?.name} (${(fastest.avg / 1000).toFixed(1)}s)`}
                      />
                    )}
                    {bestStreak && (
                      <StatBox
                        label="Najdłuższa seria"
                        value={`${room.players.find((p) => p.id === bestStreak[0])?.name}: ${bestStreak[1]} z rzędu`}
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {room.playedCards && room.playedCards.length > 0 && (
              <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                  🎵 Playlista wieczoru ({room.playedCards.length})
                </p>
                <div className="flex flex-col gap-1 text-left" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {room.playedCards.map((c, i) => (
                    <a
                      key={i}
                      href={`https://www.youtube.com/watch?v=${c.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-2 py-1.5 rounded"
                      style={{ background: "var(--surface2)", textDecoration: "none", color: "var(--text)" }}
                    >
                      <span style={{ fontSize: 12 }}>
                        {c.correct ? "✓" : "✗"} {c.artist} — {c.title}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--accent)" }}>{c.year}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {isHost && (
              <button onClick={playAgain} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                <RotateCcw size={16} /> ZAGRAJ PONOWNIE
              </button>
            )}
          </div>
        )}
      </div>

      {heldCard && (
        <div
          onClick={() => setHeldCard(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-5 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)", maxWidth: 320 }}
          >
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "var(--accent)" }}>{heldCard.year}</p>
            <p style={{ fontSize: 15, fontWeight: "bold", marginTop: 4 }}>{heldCard.artist}</p>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>„{heldCard.title}"</p>
            <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>(kliknij poza kartą, żeby zamknąć)</p>
          </div>
        </div>
      )}

      {connectionStale && roomId && screen !== "home" && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 95,
            textAlign: "center",
            padding: "8px 12px",
            background: "var(--bad)",
            color: "#2a0a12",
            fontSize: 12,
            fontWeight: "bold",
          }}
        >
          ⚠ Słabe połączenie — czekam na aktualizację stanu gry…
        </div>
      )}

      {roomId && room && screen !== "home" && (
        <>
          <button
            onClick={() => setShowChat((v) => !v)}
            style={{
              position: "fixed",
              bottom: 20,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "#1a1428",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
              zIndex: 90,
              border: "none",
            }}
          >
            <MessageCircle size={24} />
            {(() => {
              const unread = Math.max(0, (room.messages?.length || 0) - chatSeenCount);
              return unread > 0 ? (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "var(--bad)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: "bold",
                    borderRadius: "50%",
                    width: 18,
                    height: 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null;
            })()}
          </button>

          {showChat && (
            <div
              style={{
                position: "fixed",
                bottom: 88,
                right: 20,
                width: "min(360px, calc(100vw - 40px))",
                height: "min(480px, calc(100vh - 140px))",
                background: "var(--surface)",
                border: "1px solid #2a2340",
                borderRadius: 16,
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                zIndex: 90,
                overflow: "hidden",
              }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #2a2340" }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>Czat pokoju</p>
                <button onClick={() => setShowChat(false)} style={{ color: "var(--muted)" }}>
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                {(!room.messages || room.messages.length === 0) && (
                  <p style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginTop: 20 }}>
                    Brak wiadomości — napisz coś pierwszy!
                  </p>
                )}
                {(room.messages || [])
                  .slice()
                  .sort((a, b) => a.ts - b.ts)
                  .map((m, i) => (
                    <div
                      key={i}
                      className="rounded-lg px-3 py-2"
                      style={{
                        background: m.playerId === playerId ? "var(--accent)" : "var(--surface2)",
                        color: m.playerId === playerId ? "#061018" : "var(--text)",
                        alignSelf: m.playerId === playerId ? "flex-end" : "flex-start",
                        maxWidth: "85%",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: m.playerId === playerId ? "#0a2420" : "var(--accent)",
                          fontWeight: "bold",
                          marginBottom: 2,
                        }}
                      >
                        {m.name}
                      </p>
                      <p style={{ fontSize: 13, wordBreak: "break-word" }}>{m.text}</p>
                    </div>
                  ))}
                <div ref={chatEndRef} />
              </div>

              <div className="flex items-center gap-2 px-3 py-3" style={{ borderTop: "1px solid #2a2340" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Napisz wiadomość…"
                  className="flex-1"
                  maxLength={300}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim()}
                  style={{ color: chatInput.trim() ? "var(--accent)" : "var(--muted)" }}
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
