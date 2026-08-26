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
import { shuffle, randomStartSeconds, requiredApprovals, getYouTubeId, fuzzyMatch } from "./utils.js";
import { REAL_SONGS } from "./songs.js";
import { registerWithUsername, loginWithUsername, logout, watchAuthState, friendlyAuthError } from "./auth.js";
import { ensureStatsDoc, getStats, recordCardGuess, recordGameResult, recordSuccessfulGuess, recordSongAdded, topArtists, getLeaderboard, awardXp, xpForLevel, levelFromXp, progressWeeklyChallenge, currentWeekKey, currentDayKey, recordDailyResult, claimAchievementXp, markPerfectDailyIfNeeded, updateAchievementCounters, checkQuickReturn, updateLongestGuessStreak } from "./stats.js";
import { fetchAllSongsFromDb, addSongToDb, updateSongInDb, deleteSongFromDb, migrateBundledLibraryToDb, submitSongProposal, fetchPendingProposals, updateProposal, acceptProposal, rejectProposal, importSongsFromCsv, logBrokenLink, fetchBrokenLinkReports, dismissBrokenLinkReport, deleteBrokenSongAndDismiss, updateBrokenSongAndDismiss, incrementSongPlayCount, getSongCount, migrateRarityForExistingSongs } from "./songsDb.js";
import { cleanupOldRooms } from "./roomsDb.js";
import { heartbeat, clearPresence, getOnlinePlayers } from "./presence.js";
import { sendDuelChallenge, listenForIncomingChallenge, listenForSentChallenges, acceptDuelChallenge, declineDuelChallenge, clearDuelChallenge, isChallengeStale } from "./duelInvites.js";
import { getOrCreateDailySong } from "./dailySong.js";
import { getOrCreateDailyPlaylist, hasPlayedPlaylistToday, recordDailyPlaylistScore, fetchDailyPlaylistLeaderboard, fetchWeeklyPlaylistLeaderboard, fetchAllTimePlaylistLeaderboard, processWeeklyPlaylistRewardsIfNeeded } from "./dailyPlaylist.js";
import { createTournament, cancelTournament, fetchActiveTournament, fetchTournament, signUpForTournament, recordTournamentMatchResult, checkAndAdvanceTournament, settleTournamentXpIfNeeded, pickMatchPlaylist } from "./tournaments.js";
import { awardHitcoin, computeWinHitcoin, computeSecondPlaceHitcoin, computeThirdPlaceHitcoin, claimDailyHitcoin, drawCardAfterGame, effectiveRarity, PACKS, openPack, SELL_PRICES, sellDuplicateCard, sellAllDuplicates } from "./cards.js";
import { updateHeadToHead, fetchHeadToHeadOpponents } from "./headToHead.js";
import { getAchievementProgress } from "./achievements.js";
import { playCorrectSound, playWrongSound, playApplause, playVictorySound, unlockAudio } from "./sounds.js";
import { Play, Music4, Trophy, RotateCcw, Users, ChevronRight, Copy, Check, LogIn, LogOut, BarChart3, Flame, Crown, Shield, Search, Trash2, Pencil, Save, X, MessageCircle, Send } from "lucide-react";
import logoImg from "./assets/logo-v2.png";
import iconTrening from "./assets/icons/trening.png";
import iconPiosenkaDnia from "./assets/icons/piosenka_dnia.png";
import iconPlaylistaDnia from "./assets/icons/playlista_dnia.png";
import iconTurniej from "./assets/icons/turniej.png";
import iconStatystyki from "./assets/icons/statystyki.png";
import iconRanking from "./assets/icons/ranking.png";
import iconZaproponuj from "./assets/icons/zaproponuj.png";
import iconAdmin from "./assets/icons/admin.png";

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
  { slug: "tymek", label: "Tymek" },
];

// Wspólne metadane 5 poziomów rzadkości kart — używane wszędzie, gdzie
// pokazujemy kartę (koniec gry, album, paczki), żeby kolory/etykiety były
// spójne w całej appce. Ikony to tymczasowy placeholder — do podmiany na
// prawdziwe grafiki, gdy będą gotowe.
const RARITY_INFO = {
  winyl: { label: "Winyl", color: "#aab8c4", icon: "⚪" },
  srebrna: { label: "Srebrna Płyta", color: "#dbe6ee", icon: "⚪" },
  zlota: { label: "Złota Płyta", color: "#ffd66b", icon: "🟡" },
  platynowa: { label: "Platynowa Płyta", color: "#c4b5fd", icon: "🟣" },
  diamentowa: { label: "Diamentowa Płyta", color: "#7dffef", icon: "💎" },
};
const RARITY_ORDER = ["winyl", "srebrna", "zlota", "platynowa", "diamentowa"];

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

const TimelineCard = memo(function TimelineCard({ year, title, artist, onHold, onRelease, highlight }) {
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
      style={{
        width: 92,
        height: 60,
        background: highlight ? `${highlight}22` : "var(--surface2)",
        border: `1px solid ${highlight || "#33294f"}`,
        boxShadow: highlight ? `0 0 12px -2px ${highlight}` : undefined,
        cursor: "pointer",
        touchAction: "manipulation",
      }}
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

const CONFETTI_COLORS = ["#00e6c3", "#8b5cf6", "#ff5fc9", "#ffb020", "#39ff9a"];
const Confetti = memo(function Confetti() {
  const pieces = React.useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
      })),
    []
  );
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 99 }}>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.6,
            background: p.color,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
});

const LevelBar = memo(function LevelBar({ level, currentLevelXp, xpForNextLevel, size = "normal" }) {
  const pct = Math.min(100, Math.round((currentLevelXp / xpForNextLevel) * 100));
  const big = size === "big";
  return (
    <div
      className="w-full rounded-xl relative overflow-hidden"
      style={{
        padding: big ? "16px 18px" : "10px 12px",
        background: "linear-gradient(135deg, rgba(0,230,195,0.14), rgba(139,92,246,0.14))",
        border: "1px solid transparent",
        backgroundClip: "padding-box",
        boxShadow: "0 0 0 1px rgba(0,230,195,0.35), 0 0 24px -8px var(--accent), 0 0 40px -14px var(--accent2)",
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: big ? 30 : 20,
            color: "var(--accent)",
            letterSpacing: 1,
            textShadow: "0 0 8px var(--accent), 0 0 18px rgba(0,230,195,0.5)",
          }}
        >
          POZIOM {level}
        </span>
        <span style={{ fontSize: big ? 12 : 11, color: "var(--muted)" }}>
          {currentLevelXp} / {xpForNextLevel} XP
        </span>
      </div>
      <div className="w-full rounded-full" style={{ height: big ? 12 : 8, background: "#0d0a17", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent), var(--accent2), var(--accent3))",
            backgroundSize: "200% 100%",
            animation: "bg-drift 3s ease infinite",
            boxShadow: "0 0 10px var(--accent), 0 0 4px var(--accent3)",
            borderRadius: 999,
            transition: "width 0.4s ease",
          }}
        />
      </div>
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
  const [boughtCardReveal, setBoughtCardReveal] = useState(null);
  const [sharedBoughtNotice, setSharedBoughtNotice] = useState(null);
  const [viewedPlayerId, setViewedPlayerId] = useState(null);
  const [showOnlyMyPlaylist, setShowOnlyMyPlaylist] = useState(false);
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
  const [totalSongCount, setTotalSongCount] = useState(null);
  const [h2hOpponents, setH2hOpponents] = useState(null);
  const [h2hExpanded, setH2hExpanded] = useState(null);
  const [myXp, setMyXp] = useState(null);
  const [myHitcoin, setMyHitcoin] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
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
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupProgress, setCleanupProgress] = useState(null);
  const [brokenLinkReports, setBrokenLinkReports] = useState(null);
  const [mostPlayedSongs, setMostPlayedSongs] = useState(null);
  const [mostPlayedBusy, setMostPlayedBusy] = useState(false);
  const [showBrokenLinkReports, setShowBrokenLinkReports] = useState(false);
  const [brokenLinkBusy, setBrokenLinkBusy] = useState(false);
  const [brokenLinkEditingId, setBrokenLinkEditingId] = useState(null);
  const [brokenLinkEditDraft, setBrokenLinkEditDraft] = useState({});
  const [brokenLinkNotice, setBrokenLinkNotice] = useState(null);

  const [showProposeForm, setShowProposeForm] = useState(false);
  const [showAuthForm, setShowAuthForm] = useState(false);
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

  const LIBRARY_CACHE_KEY = "hitster-library-cache-v3"; // v3: unieważnia stary cache sprzed dodania systemu rzadkości kart (mógł nie mieć pola `rarity`)
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

  // Piosenka/Playlista dnia MUSZĄ mieć prawdziwe kategorie do filtrowania
  // (np. wykluczenie rapu) — nie mogą polegać na effectivePool, bo ten
  // przy pierwszej wizycie w appce cicho spada do starej, wbudowanej listy
  // 746 utworów BEZ zapisanych kategorii (filtr wtedy nic by nie wykluczał).
  // Ten sam mechanizm gwarantuje żywą bibliotekę też przy starcie zwykłej
  // gry i Treningu (tam ryzyko jest dużo mniejsze — host zwykle czeka
  // chwilę w lobby, co daje appce czas na doładowanie — ale wolę mieć to
  // pewne wszędzie, nie tylko "zwykle wystarczająco dużo czasu").
  async function getLiveLibraryPool() {
    let pool = librarySongs;
    if (!pool || pool.length === 0) {
      try {
        pool = await fetchAllSongsFromDb();
        setLibrarySongs(pool);
        saveLibraryCache(pool);
      } catch (e) {
        pool = REAL_SONGS; // ostateczny fallback, gdyby Firestore było niedostępne
      }
    }
    return pool;
  }

  async function getDailyFeaturesPool() {
    const pool = await getLiveLibraryPool();
    return pool.filter((s) => !(s.categories || []).includes("rap"));
  }

  useEffect(() => {
    if ((screen === "lobby" && room?.hostId === playerId) || screen === "practiceSetup" || showAdminPanel) ensureLibraryLoaded();
  }, [screen, room?.hostId, playerId, showAdminPanel]);

  const [playerLevels, setPlayerLevels] = useState({});
  useEffect(() => {
    if (screen !== "lobby" || !room?.players) return;
    const authedPlayers = room.players.filter((p) => p.authed);
    Promise.all(
      authedPlayers.map((p) =>
        getStats(p.id)
          .then((s) => [p.id, s?.xp || 0])
          .catch(() => [p.id, 0])
      )
    ).then((entries) => {
      setPlayerLevels((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
  }, [screen, room?.players?.length]);

  const [onlinePlayers, setOnlinePlayers] = useState([]);
  useEffect(() => {
    if (!playerId) return;
    const displayName = name || user?.displayName || "Gracz";
    heartbeat(playerId, displayName, user?.uid);
    const id = setInterval(() => heartbeat(playerId, displayName, user?.uid), 25000);
    const clear = () => clearPresence(playerId);
    window.addEventListener("beforeunload", clear);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", clear);
      clear();
    };
  }, [playerId, user?.uid]);

  useEffect(() => {
    getOnlinePlayers().then(setOnlinePlayers);
    const id = setInterval(() => getOnlinePlayers().then(setOnlinePlayers), 40000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchActiveTournament().then(setActiveTournament).catch(() => {});
    const id = setInterval(() => fetchActiveTournament().then(setActiveTournament).catch(() => {}), 60000);
    return () => clearInterval(id);
  }, []);

  // --- Wyzwania 1v1 (na żywo) ---
  const [showOnlineList, setShowOnlineList] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [challengeSentTo, setChallengeSentTo] = useState(null);
  const [challengeBusy, setChallengeBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForIncomingChallenge(user.uid, (data) => {
      if (data && !isChallengeStale(data.createdAt)) {
        setIncomingChallenge(data);
      } else {
        setIncomingChallenge(null);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const unsub = listenForSentChallenges(user.uid, (data) => {
      if (isChallengeStale(data.createdAt)) return; // stary, nieposprzątany wpis — ignorujemy
      if (data.status === "accepted" && data.roomCode) {
        clearDuelChallenge(data.toUid).catch(() => {});
        setChallengeSentTo(null);
        joinRoom(data.roomCode);
      } else if (data.status === "declined") {
        setChallengeSentTo(null);
        setError(`${data.toName} odrzucił(a) wyzwanie.`);
        clearDuelChallenge(data.toUid).catch(() => {});
      }
    });
    return () => unsub();
  }, [user?.uid]);

  async function handleSendChallenge(toPlayer) {
    if (!user) return setError("Zaloguj się, żeby wyzwać kogoś na pojedynek.");
    setChallengeBusy(true);
    try {
      await sendDuelChallenge(user.uid, name.trim() || user.displayName || "Gracz", toPlayer.uid, toPlayer.name);
      setChallengeSentTo(toPlayer);
      setTimeout(() => {
        setChallengeSentTo((current) => {
          if (current?.uid === toPlayer.uid) {
            clearDuelChallenge(user.uid).catch(() => {});
            setError(`${toPlayer.name} nie odpowiedział(a) na wyzwanie.`);
            return null;
          }
          return current;
        });
      }, 95000);
    } catch (e) {
      setError("Nie udało się wysłać wyzwania: " + e.message);
    } finally {
      setChallengeBusy(false);
    }
  }

  async function handleAcceptChallenge() {
    if (!incomingChallenge || !user) return;
    setChallengeBusy(true);
    try {
      const code = await createDuelRoom();
      await acceptDuelChallenge(user.uid, code);
      setIncomingChallenge(null);
    } catch (e) {
      setError("Nie udało się przyjąć wyzwania: " + e.message);
    } finally {
      setChallengeBusy(false);
    }
  }

  async function handleDeclineChallenge() {
    if (!incomingChallenge || !user) return;
    declineDuelChallenge(user.uid).catch(() => {});
    setIncomingChallenge(null);
  }

  // --- "Piosenka dnia" ---
  const [showDailySong, setShowDailySong] = useState(false);
  const [dailyPlaylistSongs, setDailyPlaylistSongs] = useState(null);
  const [dailyPlaylistAlreadyPlayed, setDailyPlaylistAlreadyPlayed] = useState(null);
  const [dailyPlaylistDailyBoard, setDailyPlaylistDailyBoard] = useState([]);
  const [dailyPlaylistWeeklyBoard, setDailyPlaylistWeeklyBoard] = useState([]);
  const [dailyPlaylistAllTimeBoard, setDailyPlaylistAllTimeBoard] = useState([]);
  const [dailyPlaylistBusy, setDailyPlaylistBusy] = useState(false);
  const [activeTournament, setActiveTournament] = useState(null);
  const [tournamentBusy, setTournamentBusy] = useState(false);
  const [adminNewTournament, setAdminNewTournament] = useState({ maxPlayers: "4", entryFee: "200" });
  const [rarityMigrateBusy, setRarityMigrateBusy] = useState(false);
  const [rarityMigrateProgress, setRarityMigrateProgress] = useState(null);
  const [packShopBusy, setPackShopBusy] = useState(false);
  const [packOpenResult, setPackOpenResult] = useState(null);
  const [packRevealedIndices, setPackRevealedIndices] = useState(new Set());
  const [albumSongs, setAlbumSongs] = useState(null);
  const [albumSelectedRarity, setAlbumSelectedRarity] = useState("winyl");
  const [albumOnlyOwned, setAlbumOnlyOwned] = useState(false);
  const [albumVisibleCount, setAlbumVisibleCount] = useState(60);
  const [albumSellBusy, setAlbumSellBusy] = useState(false);
  const [dailySong, setDailySong] = useState(null);
  const [dailyAlreadyPlayed, setDailyAlreadyPlayed] = useState(false);
  const [dailyGuessArtist, setDailyGuessArtist] = useState("");
  const [dailyGuessTitle, setDailyGuessTitle] = useState("");
  const [dailyGuessYear, setDailyGuessYear] = useState("");
  const [dailyResult, setDailyResult] = useState(null);
  const [dailyBusy, setDailyBusy] = useState(false);
  const [dailyIsPlaying, setDailyIsPlaying] = useState(false);
  const [dailyPlayElapsed, setDailyPlayElapsed] = useState(0);
  const dailyIframeRef = useRef(null);
  const dailyPlayIntervalRef = useRef(null);

  async function openDailySong() {
    if (!user) return setError("Zaloguj się, żeby zagrać w Piosenkę dnia.");
    setDailyBusy(true);
    setError("");
    try {
      const dayKey = currentDayKey();
      const pool = await getDailyFeaturesPool();
      const song = await getOrCreateDailySong(dayKey, pool);
      setDailySong(song);
      const s = await getStats(user.uid);
      const alreadyPlayed = s?.dailyLastResult?.dayKey === dayKey;
      setDailyAlreadyPlayed(alreadyPlayed);
      setDailyResult(alreadyPlayed ? s.dailyLastResult : null);
      setShowDailySong(true);
    } catch (e) {
      setError("Nie udało się wczytać Piosenki dnia: " + e.message);
    } finally {
      setDailyBusy(false);
    }
  }

  async function openDailyPlaylistHub() {
    if (!user) return setError("Zaloguj się, żeby zagrać w Playlistę dnia.");
    setDailyPlaylistBusy(true);
    setError("");
    try {
      processWeeklyPlaylistRewardsIfNeeded().catch(() => {}); // ciche, okazjonalne sprawdzenie nagród za zeszły tydzień
      const dayKey = currentDayKey();
      const pool = await getDailyFeaturesPool();
      const songs = await getOrCreateDailyPlaylist(dayKey, pool);
      setDailyPlaylistSongs(songs);
      const [already, daily, weekly, allTime] = await Promise.all([
        hasPlayedPlaylistToday(user.uid, dayKey),
        fetchDailyPlaylistLeaderboard(dayKey, 10),
        fetchWeeklyPlaylistLeaderboard(currentWeekKey(), 10),
        fetchAllTimePlaylistLeaderboard(10),
      ]);
      setDailyPlaylistAlreadyPlayed(already);
      setDailyPlaylistDailyBoard(daily);
      setDailyPlaylistWeeklyBoard(weekly);
      setDailyPlaylistAllTimeBoard(allTime);
      setScreen("dailyPlaylistHub");
    } catch (e) {
      setError("Nie udało się wczytać Playlisty dnia: " + e.message);
    } finally {
      setDailyPlaylistBusy(false);
    }
  }

  async function startDailyPlaylistGame() {
    if (!user || !dailyPlaylistSongs || dailyPlaylistSongs.length < 2) return;
    setBusy(true);
    setError("");
    try {
      checkQuickReturn(user.uid).catch(() => {});
      const dayKey = currentDayKey();
      const code = generateRoomCode();
      const ref = doc(db, "rooms", code);
      const deck = dailyPlaylistSongs;
      const me = { id: playerId, name: name.trim() || user.displayName || "Gracz", authed: true };
      await setDoc(ref, {
        code,
        hostId: playerId,
        target: 10,
        status: "playing",
        players: [me],
        deck,
        deckIndex: 2,
        currentPlayerId: playerId,
        startingPlayerId: playerId,
        currentCard: deck[1],
        startSeconds: deck[1].startSeconds,
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
        gameGuessStreaks: {},
        gameGuesses: {},
        gameBestStreaks: {},
        playedCards: [],
        messages: [],
        practiceMode: true,
        dailyPlaylistMode: true,
        dailyPlaylistDayKey: dayKey,
        createdAt: serverTimestamp(),
        expireAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      setRoomId(code);
    } catch (e) {
      setError("Błąd startu Playlisty dnia: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function openAlbum() {
    if (!user) return;
    setScreen("album");
    setAlbumVisibleCount(60);
    if (!albumSongs) {
      const pool = await getLiveLibraryPool();
      setAlbumSongs(pool);
    }
  }

  async function handleSellAllDuplicates() {
    if (!user || !albumSongs) return;
    setAlbumSellBusy(true);
    try {
      const byId = new Map(albumSongs.map((s) => [s.id, s]));
      const result = await sellAllDuplicates(user.uid, byId);
      if (result.totalSold > 0) {
        setMyHitcoin((prev) => (prev || 0) + result.totalEarned);
        const s = await getStats(user.uid);
        setStats(s);
        setError("");
      }
    } catch (e) {
      setError("Błąd sprzedaży: " + e.message);
    } finally {
      setAlbumSellBusy(false);
    }
  }

  async function buyPack(packKey) {
    if (!user) return;
    setPackShopBusy(true);
    setError("");
    try {
      const pool = await getLiveLibraryPool();
      const drawn = await openPack(user.uid, packKey, pool);
      setMyHitcoin((prev) => (prev || 0) - PACKS[packKey].price);
      setPackOpenResult(drawn);
      setPackRevealedIndices(new Set());
    } catch (e) {
      setError(e.message || "Nie udało się otworzyć paczki.");
    } finally {
      setPackShopBusy(false);
    }
  }

  async function openTournamentHub() {
    if (!user) return setError("Zaloguj się, żeby wziąć udział w turnieju.");
    setTournamentBusy(true);
    setError("");
    try {
      let t = activeTournament;
      if (!t) {
        t = await fetchActiveTournament();
        setActiveTournament(t);
      }
      if (t && t.status === "active") {
        const pool = await getDailyFeaturesPool();
        await checkAndAdvanceTournament(t.id, pool);
        t = await fetchTournament(t.id);
        setActiveTournament(t);
        if (t?.status === "completed") await settleTournamentXpIfNeeded(t.id);
      }
      setScreen("tournamentHub");
    } catch (e) {
      setError("Nie udało się wczytać turnieju: " + e.message);
    } finally {
      setTournamentBusy(false);
    }
  }

  async function handleTournamentSignUp() {
    if (!user || !activeTournament) return;
    setTournamentBusy(true);
    try {
      const pool = await getDailyFeaturesPool();
      await signUpForTournament(activeTournament.id, user.uid, name.trim() || user.displayName || "Gracz", pool);
      const fresh = await fetchTournament(activeTournament.id);
      setActiveTournament(fresh);
    } catch (e) {
      setError("Nie udało się zapisać: " + e.message);
    } finally {
      setTournamentBusy(false);
    }
  }

  async function startTournamentMatch(match, roundNumber) {
    if (!user || !activeTournament) return;
    setBusy(true);
    setError("");
    try {
      const code = generateRoomCode();
      const ref = doc(db, "rooms", code);
      const deck = match.playlist;
      const me = { id: playerId, name: name.trim() || user.displayName || "Gracz", authed: true };
      await setDoc(ref, {
        code,
        hostId: playerId,
        target: 10,
        status: "playing",
        players: [me],
        deck,
        deckIndex: 2,
        currentPlayerId: playerId,
        startingPlayerId: playerId,
        currentCard: deck[1],
        startSeconds: deck[1].startSeconds,
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
        gameGuessStreaks: {},
        gameGuesses: {},
        gameBestStreaks: {},
        playedCards: [],
        messages: [],
        practiceMode: true,
        tournamentMode: true,
        tournamentId: activeTournament.id,
        tournamentRoundNumber: roundNumber,
        tournamentMatchId: match.matchId,
        createdAt: serverTimestamp(),
        expireAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      setRoomId(code);
    } catch (e) {
      setError("Błąd startu meczu: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  function closeDailySong() {
    setShowDailySong(false);
    setDailyGuessArtist("");
    setDailyGuessTitle("");
    setDailyGuessYear("");
    setDailyIsPlaying(false);
    setDailyPlayElapsed(0);
    if (dailyPlayIntervalRef.current) clearInterval(dailyPlayIntervalRef.current);
  }

  function toggleDailyPlay() {
    const win = dailyIframeRef.current && dailyIframeRef.current.contentWindow;
    const willPlay = !dailyIsPlaying;
    setDailyIsPlaying(willPlay);
    if (willPlay) {
      setDailyPlayElapsed(0);
      if (win) {
        win.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [dailySong.startSeconds, true] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
        win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
      const startedAt = Date.now();
      dailyPlayIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= PLAY_CAP_SECONDS) {
          setDailyIsPlaying(false);
          setDailyPlayElapsed(PLAY_CAP_SECONDS);
          if (win) win.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
          clearInterval(dailyPlayIntervalRef.current);
        } else {
          setDailyPlayElapsed(elapsed);
        }
      }, 200);
    } else {
      if (win) win.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      if (dailyPlayIntervalRef.current) clearInterval(dailyPlayIntervalRef.current);
    }
  }

  async function submitDailyGuess() {
    if (!user || !dailySong) return;
    setDailyBusy(true);
    try {
      const correctArtist = fuzzyMatch(dailyGuessArtist, dailySong.artist);
      const correctTitle = fuzzyMatch(dailyGuessTitle, dailySong.title);
      const correctYear = parseInt(dailyGuessYear, 10) === dailySong.year;
      const score = (correctArtist ? 1 : 0) + (correctTitle ? 1 : 0) + (correctYear ? 1 : 0);
      const result = {
        guessArtist: dailyGuessArtist,
        guessTitle: dailyGuessTitle,
        guessYear: dailyGuessYear,
        correctArtist,
        correctTitle,
        correctYear,
        score,
      };
      const newStreak = await recordDailyResult(user.uid, currentDayKey(), result);
      markPerfectDailyIfNeeded(user.uid, score).catch(() => {});
      const xp = 10 + score * 15; // 10 za sam udział, +15 za każdą trafioną część
      await awardXp(user.uid, xp);
      const before = myXp || 0;
      setMyXp(before + xp);
      setDailyResult({ ...result, dayKey: currentDayKey(), streak: newStreak, xpEarned: xp });
      setDailyAlreadyPlayed(true);
      if (score === 3) {
        playVictorySound();
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 4000);
      } else if (score > 0) {
        playCorrectSound();
      } else {
        playWrongSound();
      }
    } catch (e) {
      setError("Błąd zapisu wyniku: " + e.message);
    } finally {
      setDailyBusy(false);
    }
  }



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
      const base = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
      const next = base.map((s) => (s.id === id ? { ...s, artist: adminEditDraft.artist, title: adminEditDraft.title, year: parseInt(adminEditDraft.year, 10), videoId, categories } : s));
      setLibrarySongs(next);
      saveLibraryCache(next);
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
      const base = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
      const next = base.filter((s) => s.id !== id);
      setLibrarySongs(next);
      saveLibraryCache(next);
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
      const base = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
      const next = [...base, added];
      setLibrarySongs(next);
      saveLibraryCache(next);
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
        awardXp(p.submittedByUid, 25).catch(() => {}); // zaakceptowana propozycja utworu
      }
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
      const base = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
      const next = [...base, added];
      setLibrarySongs(next);
      saveLibraryCache(next);
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
    reader.onload = (ev) => {
      const buffer = ev.target.result;
      let text = new TextDecoder("utf-8").decode(buffer);
      if (text.includes("\uFFFD")) {
        // UTF-8 dało nieprawidłowe znaki — to zwykle CSV zapisany przez Excela
        // w kodowaniu Windows-1250 (domyślne dla polskiego Windowsa), spróbuj tego
        text = new TextDecoder("windows-1250").decode(buffer);
      }
      setImportCsvText(text);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleExportCsv() {
    try {
      const songs = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
      const escapeCsv = (v) => {
        const s = String(v ?? "");
        return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const rows = songs.map((s) =>
        [
          `https://www.youtube.com/watch?v=${s.videoId}`,
          s.artist,
          s.title,
          s.year,
          (s.categories || []).join(";"),
        ]
          .map(escapeCsv)
          .join(";")
      );
      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hitsteriada-baza-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Błąd eksportu: " + e.message);
    }
  }

  async function handleCleanupRooms() {
    if (!window.confirm("Usunąć wszystkie przeterminowane pokoje (zakończone, porzucone lub bardzo stare)? Statystyki graczy zostają nietknięte — to dotyczy tylko tymczasowych danych rozgrywek.")) return;
    setCleanupBusy(true);
    setCleanupResult(null);
    setCleanupProgress(null);
    setError("");
    try {
      const result = await cleanupOldRooms((done, total) => setCleanupProgress({ done, total }));
      setCleanupResult(result);
    } catch (e) {
      setError("Błąd czyszczenia pokojów: " + e.message);
    } finally {
      setCleanupBusy(false);
      setCleanupProgress(null);
    }
  }

  function loadBrokenLinkReports() {
    fetchBrokenLinkReports()
      .then((list) => setBrokenLinkReports(list))
      .catch(() => setBrokenLinkReports([]));
  }

  async function handleDismissBrokenLink(id) {
    setBrokenLinkBusy(true);
    try {
      await dismissBrokenLinkReport(id);
      setBrokenLinkReports((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError("Błąd odrzucania zgłoszenia: " + e.message);
    } finally {
      setBrokenLinkBusy(false);
    }
  }

  async function handleDeleteBrokenSong(report) {
    if (!window.confirm(`Usunąć "${report.artist} — ${report.title}" z bazy utworów i odrzucić zgłoszenie?`)) return;
    setBrokenLinkBusy(true);
    try {
      const found = await deleteBrokenSongAndDismiss(report.id, report.videoId);
      setBrokenLinkReports((prev) => prev.filter((r) => r.id !== report.id));
      setLibrarySongs((prev) => (prev ? prev.filter((s) => s.videoId !== report.videoId) : prev));
      if (!found) alert("Nie znaleziono tego utworu w bazie (mógł już zostać usunięty) — samo zgłoszenie odrzucono.");
    } catch (e) {
      setError("Błąd usuwania utworu: " + e.message);
    } finally {
      setBrokenLinkBusy(false);
    }
  }

  async function handleSaveBrokenLinkEdit(report) {
    const videoId = getYouTubeId(brokenLinkEditDraft.url);
    if (!videoId) {
      setError("Podany link YouTube wygląda na niepoprawny.");
      return;
    }
    setBrokenLinkBusy(true);
    try {
      const categories = (brokenLinkEditDraft.categoriesText || "").split(";").map((c) => c.trim()).filter(Boolean);
      const fields = {
        artist: brokenLinkEditDraft.artist,
        title: brokenLinkEditDraft.title,
        year: parseInt(brokenLinkEditDraft.year, 10),
        videoId,
        categories,
      };
      const updated = await updateBrokenSongAndDismiss(report.id, report.videoId, fields);
      setBrokenLinkReports((prev) => prev.filter((r) => r.id !== report.id));
      if (updated) {
        setLibrarySongs((prev) => (prev ? prev.map((s) => (s.id === updated.id ? updated : s)) : prev));
      } else {
        alert("Nie znaleziono tego utworu w bazie (mógł już zostać usunięty) — samo zgłoszenie odrzucono, nic nie zapisano.");
      }
      setBrokenLinkEditingId(null);
    } catch (e) {
      setError("Błąd zapisu: " + e.message);
    } finally {
      setBrokenLinkBusy(false);
    }
  }


  useEffect(() => {
    const unsub = watchAuthState(async (u) => {
      setUser(u);
      setAuthChecked(true);
      if (u) {
        await ensureStatsDoc(u.uid, u.displayName || authUsername);
        getStats(u.uid).then((s) => {
          setMyXp(s?.xp || 0);
          setMyHitcoin(s?.hitcoin || 0);
        }).catch(() => {});
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

  // Sortuje wszystkich graczy wg tych samych zasad, co wyłanianie zwycięzcy
  // przy remisie: długość osi czasu → tokeny → liczba udanych zgadnięć.
  // Używane do podium (2./3. miejsce) w grach 3+ osobowych.
  function computeFinalStandings(gameRoom) {
    return [...(gameRoom.players || [])].sort((a, b) => {
      const lenA = (gameRoom.timelines?.[a.id] || []).length;
      const lenB = (gameRoom.timelines?.[b.id] || []).length;
      if (lenB !== lenA) return lenB - lenA;
      const tokA = gameRoom.tokens?.[a.id] || 0;
      const tokB = gameRoom.tokens?.[b.id] || 0;
      if (tokB !== tokA) return tokB - tokA;
      const guessA = gameRoom.gameGuesses?.[a.id] || 0;
      const guessB = gameRoom.gameGuesses?.[b.id] || 0;
      return guessB - guessA;
    });
  }

  // Wspólna logika liczenia XP na koniec gry — używana zarówno do
  // faktycznego przyznania punktów, jak i do wyświetlenia rozbicia graczowi.
  function computeGameEndXp(gameRoom, forPlayerId) {
    if (!gameRoom || gameRoom.practiceMode) return { items: [], total: 0 };
    const items = [{ label: "🎮 Udział w grze", amount: 30 }];
    const won = (gameRoom.winnerIds || []).includes(forPlayerId);
    const winXp = Math.max(100, ((gameRoom.players || []).length - 1) * 100);
    if (won) {
      items.push({ label: `🏆 Wygrana (${gameRoom.players.length} graczy)`, amount: winXp });
    } else if ((gameRoom.players || []).length >= 3) {
      // podium — tylko gry 3+ osobowe, tylko dla graczy spoza grona zwycięzców
      const winnerSet = new Set(gameRoom.winnerIds || []);
      const rest = computeFinalStandings(gameRoom).filter((p) => !winnerSet.has(p.id));
      const myRank = rest.findIndex((p) => p.id === forPlayerId);
      if (myRank === 0) items.push({ label: "🥈 2. miejsce", amount: Math.round(winXp / 2) });
      else if (myRank === 1) items.push({ label: "🥉 3. miejsce", amount: Math.round(winXp / 4) });
    }

    const avgTimes = Object.entries(gameRoom.decisionTimes || {})
      .filter(([, times]) => times.length > 0)
      .map(([id, times]) => ({ id, avg: times.reduce((a, b) => a + b, 0) / times.length }));
    const fastest = avgTimes.length ? avgTimes.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;
    if (fastest && fastest.id === forPlayerId) items.push({ label: "⚡ Najszybszy gracz", amount: 20 });

    const streakEntries = Object.entries(gameRoom.gameBestStreaks || {}).filter(([, s]) => s > 0);
    const bestStreak = streakEntries.length ? streakEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    if (bestStreak && bestStreak[0] === forPlayerId) items.push({ label: "🔥 Najdłuższa seria", amount: 20 });

    const unusedTokens = gameRoom.tokens?.[forPlayerId] || 0;
    if (unusedTokens > 0) items.push({ label: `🪙 Niewykorzystane tokeny (${unusedTokens})`, amount: 5 * unusedTokens });

    const myCards = (gameRoom.playedCards || []).filter((c) => c.playerId === forPlayerId && !c.bought);
    if ((gameRoom.target || 0) >= 7 && myCards.length > 0 && myCards.every((c) => c.correct)) {
      items.push({ label: "💎 Perfekcyjna gra", amount: 30 });
    }

    const total = items.reduce((sum, it) => sum + it.amount, 0);
    return { items, total };
  }

  // HITCOIN — ten sam wzorzec co XP (skalowane liczbą graczy), ale prostsze:
  // tylko udział + wygrana/podium, bez bonusów za szybkość/serie/perfekcję.
  function computeGameEndHitcoin(gameRoom, forPlayerId) {
    if (!gameRoom || gameRoom.practiceMode) return { items: [], total: 0 };
    const items = [{ label: "🎮 Udział w grze", amount: 25 }];
    const won = (gameRoom.winnerIds || []).includes(forPlayerId);
    const winHc = computeWinHitcoin((gameRoom.players || []).length);
    if (won) {
      items.push({ label: `🏆 Wygrana`, amount: winHc });
    } else if ((gameRoom.players || []).length >= 3) {
      const winnerSet = new Set(gameRoom.winnerIds || []);
      const rest = computeFinalStandings(gameRoom).filter((p) => !winnerSet.has(p.id));
      const myRank = rest.findIndex((p) => p.id === forPlayerId);
      if (myRank === 0) items.push({ label: "🥈 2. miejsce", amount: computeSecondPlaceHitcoin(gameRoom.players.length) });
      else if (myRank === 1) items.push({ label: "🥉 3. miejsce", amount: computeThirdPlaceHitcoin(gameRoom.players.length) });
    }
    const total = items.reduce((sum, it) => sum + it.amount, 0);
    return { items, total };
  }

  const [showConfetti, setShowConfetti] = useState(false);
  const confettiFiredRef = useRef(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.winnerIds?.length) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || confettiFiredRef.current === marker) return;
    confettiFiredRef.current = marker;
    playVictorySound();
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 4000);
  }, [screen, room?.winnerIds, toMillis(room?.expireAt)]);

  const xpAwardedRef = useRef(null);
  const [levelUpInfo, setLevelUpInfo] = useState(null);
  const [weeklyBonusInfo, setWeeklyBonusInfo] = useState(null);
  const [gameEndReward, setGameEndReward] = useState(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.winnerIds?.length || !user || room.practiceMode) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || xpAwardedRef.current === marker) return;
    xpAwardedRef.current = marker;
    updateHeadToHead(room).catch(() => {});
    (async () => {
      try {
        const { total } = computeGameEndXp(room, playerId);
        const before = await getStats(user.uid);
        const oldXp = before?.xp || 0;
        const oldLevel = levelFromXp(oldXp).level;
        let grandTotal = total;
        if (total) await awardXp(user.uid, total);

        // wyzwanie tygodniowe — liczy się każda (nie-treningowa) rozegrana gra
        const { gamesThisWeek, justCompleted } = await progressWeeklyChallenge(user.uid);
        if (justCompleted) {
          await awardXp(user.uid, 50);
          grandTotal += 50;
          setWeeklyBonusInfo({ gamesThisWeek });
          setTimeout(() => setWeeklyBonusInfo(null), 6000);
        }

        setMyXp(oldXp + grandTotal);
        const newLevel = levelFromXp(oldXp + grandTotal).level;
        if (newLevel > oldLevel) {
          setLevelUpInfo({ level: newLevel });
          setTimeout(() => setLevelUpInfo(null), 5000);
        }

        // liczniki potrzebne wyłącznie do osiągnięć
        const won = (room.winnerIds || []).includes(playerId);
        const myCards = (room.playedCards || []).filter((c) => c.playerId === playerId && !c.bought);
        const perfectGame = (room.target || 0) >= 7 && myCards.length > 0 && myCards.every((c) => c.correct);
        const opponents = room.players.filter((p) => p.authed && p.id !== playerId).map((p) => p.id);
        const nowHour = new Date().getHours();
        const nightGame = nowHour >= 0 && nowHour < 5;
        const frugalFinish = (room.tokens?.[playerId] || 0) >= 5;
        updateAchievementCounters(user.uid, { won, perfectGame, opponents, playerCount: room.players.length, nightGame, frugalFinish }).catch(() => {});

        // HITCOIN + losowanie karty
        const { total: hcTotal } = computeGameEndHitcoin(room, playerId);
        if (hcTotal) {
          await awardHitcoin(user.uid, hcTotal);
          setMyHitcoin((prev) => (prev || 0) + hcTotal);
        }
        const pool = await getLiveLibraryPool();
        const drawResult = await drawCardAfterGame(user.uid, pool);
        setGameEndReward({ hitcoin: hcTotal, card: drawResult });
      } catch (e) {
        // ciche niepowodzenie — najwyżej XP z tej gry się nie doliczy
      }
    })();
  }, [screen, room?.winnerIds, toMillis(room?.expireAt), user, playerId]);

  // Koniec gry w trybie "Playlista dnia" — osobny efekt, bo ta gra ma
  // celowo practiceMode:true (żeby ominąć zwykłe liczenie XP/wygranych),
  // a jej własna nagroda liczy się tutaj według innych zasad.
  const dailyPlaylistProcessedRef = useRef(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.dailyPlaylistMode || !user) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || dailyPlaylistProcessedRef.current === marker) return;
    dailyPlaylistProcessedRef.current = marker;
    (async () => {
      try {
        const score = (room.playedCards || []).filter((c) => c.playerId === playerId && c.correct).length;
        const timeMs = (room.decisionTimes?.[playerId] || []).reduce((a, b) => a + b, 0);
        await recordDailyPlaylistScore(user.uid, name.trim() || user.displayName || "Gracz", room.dailyPlaylistDayKey, score, timeMs);
        let xp = 25; // udział
        if (score === 10) xp += 100; // wszystkie 10 poprawnie
        const before = await getStats(user.uid);
        const oldXp = before?.xp || 0;
        const oldLevel = levelFromXp(oldXp).level;
        await awardXp(user.uid, xp);
        setMyXp(oldXp + xp);
        const newLevel = levelFromXp(oldXp + xp).level;
        if (newLevel > oldLevel) {
          setLevelUpInfo({ level: newLevel });
          setTimeout(() => setLevelUpInfo(null), 5000);
        }
      } catch (e) {
        // ciche niepowodzenie
      }
    })();
  }, [screen, room?.dailyPlaylistMode, toMillis(room?.expireAt), user, playerId]);

  // Koniec meczu turniejowego — zapisuje wynik do drabinki. Żadnego XP tutaj
  // nie przyznajemy — rozliczenie (zwycięzca zgarnia pulę, przegrani tracą
  // wpisowe) dzieje się dopiero po zakończeniu CAŁEGO turnieju.
  const tournamentMatchProcessedRef = useRef(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.tournamentMode || !user) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || tournamentMatchProcessedRef.current === marker) return;
    tournamentMatchProcessedRef.current = marker;
    (async () => {
      try {
        const score = (room.playedCards || []).filter((c) => c.playerId === playerId && c.correct).length;
        const timeMs = (room.decisionTimes?.[playerId] || []).reduce((a, b) => a + b, 0);
        await recordTournamentMatchResult(room.tournamentId, room.tournamentRoundNumber, room.tournamentMatchId, user.uid, score, timeMs);
      } catch (e) {
        // ciche niepowodzenie
      }
    })();
  }, [screen, room?.tournamentMode, toMillis(room?.expireAt), user, playerId]);

  async function openStats() {
    if (!user) return;
    const s = await getStats(user.uid);
    setStats(s);
    setShowStats(true);
    setH2hExpanded(null);
    fetchHeadToHeadOpponents(user.uid)
      .then(setH2hOpponents)
      .catch(() => setH2hOpponents([]));
    getSongCount().then((c) => c !== null && setTotalSongCount(c));
  }

  async function handleClaimAchievement(achievement) {
    if (!user) return;
    try {
      await claimAchievementXp(user.uid, achievement.id, achievement.xp);
      const newStats = await getStats(user.uid);
      const oldLevel = levelFromXp(myXp || 0).level;
      setStats(newStats);
      setMyXp(newStats.xp);
      const newLevel = levelFromXp(newStats.xp).level;
      if (newLevel > oldLevel) {
        setLevelUpInfo({ level: newLevel });
        setTimeout(() => setLevelUpInfo(null), 5000);
      }
    } catch (e) {
      setError("Błąd odbierania XP: " + e.message);
    }
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
    timeoutFiredRef.current = false;
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
  }, [room?.currentCard?.id, toMillis(room?.openerCreatedAt), room?.openerWinnerId]);

  // domyślnie podążamy za aktywnym graczem, ale reset następuje dopiero
  // na początku nowej tury — w trakcie tej samej tury wybór widza się utrzymuje
  useEffect(() => {
    setViewedPlayerId(null);
  }, [room?.currentPlayerId]);

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
      if (user) checkQuickReturn(user.uid).catch(() => {});
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
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // TTL: porzucone/niedokończone pokoje znikają po 24h
        messages: [],
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się stworzyć pokoju: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  // Osobna, lekka wersja tworzenia pokoju dla wyzwań 1v1 — zwraca kod, żeby
  // można było od razu przekazać go osobie wyzywającej (przez zaproszenie),
  // a przyjmujący wyzwanie od razu wchodzi do lobby jako host.
  async function createDuelRoom() {
    const code = generateRoomCode();
    const ref = doc(db, "rooms", code);
    await setDoc(ref, {
      code,
      hostId: playerId,
      target: 10,
      status: "lobby",
      players: [{ id: playerId, name: name.trim() || user?.displayName || "Gracz", authed: !!user }],
      deck: [],
      deckIndex: 0,
      currentPlayerId: null,
      currentCard: null,
      startSeconds: 0,
      timelines: {},
      lastResult: null,
      winnerIds: [],
      createdAt: serverTimestamp(),
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      messages: [],
    });
    setRoomId(code);
    return code;
  }

  async function startPractice() {
    if (!name.trim() && !user) return setError("Podaj swoje imię.");
    setBusy(true);
    setError("");
    try {
      const basePool = await getLiveLibraryPool();
      const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
      const pool = filterActive
        ? basePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c)))
        : basePool;
      const target = practiceTarget && practiceTarget > 0 ? practiceTarget : 15;
      const needed = target + 7;
      if (pool.length < needed) {
        const catNote = filterActive ? ` w wybranych kategoriach (${selectedCategories.join(", ")})` : "";
        setError(`Za mało utworów${catNote} (masz ${pool.length}, potrzeba ${needed}).`);
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
        gameGuessStreaks: {},
        gameGuesses: {},
        gameBestStreaks: {},
        playedCards: [],
        messages: [],
        practiceMode: true,
        createdAt: serverTimestamp(),
        expireAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // TTL: sesje treningowe znikają po 3h
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się rozpocząć treningu: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom(explicitCode) {
    if (!name.trim()) return setError("Podaj swoje imię.");
    const code = (explicitCode || joinCode).trim().toUpperCase();
    if (!code) return setError("Podaj kod pokoju.");
    setBusy(true);
    setError("");
    try {
      if (user) checkQuickReturn(user.uid).catch(() => {});
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
    setBusy(true);
    setError("");
    try {
      const basePool = await getLiveLibraryPool();
      const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
      const pool = filterActive
        ? basePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c)))
        : basePool;
      const EXTRA_CARDS_PER_PLAYER = 7;
      const needed = room.players.length * (target + EXTRA_CARDS_PER_PLAYER);
      if (pool.length < needed + 1) {
        const catNote = filterActive ? ` w wybranych kategoriach (${selectedCategories.join(", ")})` : "";
        setError(`Za mało utworów${catNote} (masz ${pool.length}, potrzeba ${needed + 1}: (${target}+${EXTRA_CARDS_PER_PLAYER}) × ${room.players.length} graczy + 1 na rundę otwierającą).`);
        setBusy(false);
        return;
      }
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
        gameGuessStreaks: {},
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
      if (user) awardXp(user.uid, 10).catch(() => {}); // wygrana minigra "kto zaczyna"
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
        capturedResult.newPlacementStreak = newStreak;
        const newGameStreaks = { ...(data.gameStreaks || {}), [data.currentPlayerId]: newStreak };
        const prevBest = data.gameBestStreaks?.[data.currentPlayerId] || 0;
        const newGameBestStreaks = { ...(data.gameBestStreaks || {}), [data.currentPlayerId]: Math.max(prevBest, newStreak) };
        const newPlayedCards = [...(data.playedCards || []), { ...card, correct, playerId: data.currentPlayerId, guessedCorrect: null }];
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
            lastResult: { correct, card, chosenSlot },
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
          const playedCardsWithGuess = hasGuess
            ? newPlayedCards.map((pc, i) => (i === newPlayedCards.length - 1 ? { ...pc, guessedCorrect: true } : pc))
            : newPlayedCards;
          const newGuessStreak = hasGuess ? (data.gameGuessStreaks?.[data.currentPlayerId] || 0) + 1 : data.gameGuessStreaks?.[data.currentPlayerId];
          if (hasGuess) capturedResult.newGuessStreak = newGuessStreak;
          tx.update(ref, {
            status: "roundResult",
            lastResult: { correct, card, tokenAwarded: hasGuess, chosenSlot },
            timelines: newTimelines,
            pendingGuess: null,
            resultAt: serverTimestamp(),
            ...summaryFields,
            playedCards: playedCardsWithGuess,
            ...(hasGuess ? { [`gameGuessStreaks.${data.currentPlayerId}`]: newGuessStreak } : {}),
            ...(hasGuess ? { [`tokens.${data.currentPlayerId}`]: increment(1) } : {}),
          });
        }
      });
      if (capturedResult && !capturedResult.practiceMode && capturedResult.card?.id) {
        incrementSongPlayCount(capturedResult.card.id).catch(() => {});
      }
      if (user && capturedResult && !capturedResult.practiceMode) {
        recordCardGuess(user.uid, capturedResult.card.year, capturedResult.correct, capturedResult.card.artist, capturedResult.card.videoId).catch(() => {});
        if (capturedResult.correct) {
          let xp = 10; // poprawne umieszczenie
          if (capturedResult.newPlacementStreak === 5) xp += 15; // seria 5 poprawnych z rzędu
          awardXp(user.uid, xp).catch(() => {});
        }
      }
      if (user && instantGuessAwardedTo === user.uid && !capturedResult?.practiceMode) {
        recordSuccessfulGuess(user.uid, capturedResult?.card?.videoId, capturedResult?.card?.year).catch(() => {});
        let xp = 20; // trafione zgadywanie
        if (capturedResult.newGuessStreak === 5) xp += 30; // seria 5 trafionych zgadywań z rzędu
        awardXp(user.uid, xp).catch(() => {});
        if (capturedResult.newGuessStreak) updateLongestGuessStreak(user.uid, capturedResult.newGuessStreak).catch(() => {});
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
      let capturedBought = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // runda już się rozstrzygnęła — bez sensu kupować kartę do minionej tury
        if ((data.tokens?.[data.currentPlayerId] || 0) < BUY_CARD_TOKENS) return;
        if (data.deckIndex >= data.deck.length) return; // brak kart w talii do kupienia

        const boughtCard = data.deck[data.deckIndex];
        capturedBought = boughtCard;
        const timeline = data.timelines[data.currentPlayerId] || [];
        const newTimelines = { ...data.timelines, [data.currentPlayerId]: [...timeline, boughtCard] };

        const prevStreak = data.gameStreaks?.[data.currentPlayerId] || 0;
        const newStreak = prevStreak + 1; // kupiona karta zawsze trafiona
        const prevBest = data.gameBestStreaks?.[data.currentPlayerId] || 0;
        const newPlayedCards = [...(data.playedCards || []), { ...boughtCard, correct: true, playerId: data.currentPlayerId, bought: true, guessedCorrect: null }];

        const update = {
          timelines: newTimelines,
          deckIndex: data.deckIndex + 1,
          [`tokens.${data.currentPlayerId}`]: increment(-BUY_CARD_TOKENS),
          [`gameStreaks.${data.currentPlayerId}`]: newStreak,
          [`gameBestStreaks.${data.currentPlayerId}`]: Math.max(prevBest, newStreak),
          playedCards: newPlayedCards,
          lastBoughtCard: { playerId: data.currentPlayerId, card: boughtCard, at: serverTimestamp() },
        };

        // kupiona karta może dopełnić cel — nie kończymy gry od razu,
        // tylko oznaczamy rundę do dogrania (jak przy normalnym trafieniu celu)
        if (newTimelines[data.currentPlayerId].length >= data.target) {
          update.finishingRound = true;
        }

        tx.update(ref, update);
      });
      if (capturedBought) {
        setBoughtCardReveal(capturedBought);
        setTimeout(() => setBoughtCardReveal(null), 3000);
        if (!room?.practiceMode && capturedBought.id) incrementSongPlayCount(capturedBought.id).catch(() => {});
        if (user && !room?.practiceMode) {
          const ref2 = doc(db, "userStats", user.uid);
          updateDoc(ref2, { cardsBought: increment(1) }).catch(() => {});
        }
      }
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
      let awardedGuessYear = null;
      let newGuessStreakValue = null;
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
            awardedGuessYear = data.lastResult?.card?.year;
          }
          const playedCards = data.playedCards || [];
          const updatedPlayedCards = playedCards.map((pc, i) => (i === playedCards.length - 1 ? { ...pc, guessedCorrect: true } : pc));
          const newStreak = (data.gameGuessStreaks?.[data.currentPlayerId] || 0) + 1;
          newGuessStreakValue = newStreak;
          tx.update(ref, {
            status: "roundResult",
            votes: newVotes,
            lastResult: { ...data.lastResult, tokenAwarded: true },
            resultAt: serverTimestamp(),
            [`tokens.${data.currentPlayerId}`]: increment(1),
            playedCards: updatedPlayedCards,
            [`gameGuessStreaks.${data.currentPlayerId}`]: newStreak,
          });
        } else if (approvals + remaining < required) {
          const playedCards = data.playedCards || [];
          const updatedPlayedCards = playedCards.map((pc, i) => (i === playedCards.length - 1 ? { ...pc, guessedCorrect: false } : pc));
          tx.update(ref, {
            status: "roundResult",
            votes: newVotes,
            lastResult: { ...data.lastResult, tokenAwarded: false },
            resultAt: serverTimestamp(),
            playedCards: updatedPlayedCards,
            [`gameGuessStreaks.${data.currentPlayerId}`]: 0,
          });
        } else {
          tx.update(ref, { votes: newVotes });
        }
      });
      if (awardedGuessTo) {
        recordSuccessfulGuess(awardedGuessTo, awardedGuessVideoId, awardedGuessYear).catch(() => {});
        let xp = 20; // trafione zgadywanie
        if (newGuessStreakValue === 5) xp += 30; // seria 5 trafionych zgadywań z rzędu
        awardXp(awardedGuessTo, xp).catch(() => {});
        if (newGuessStreakValue) updateLongestGuessStreak(awardedGuessTo, newGuessStreakValue).catch(() => {});
      }
    } catch (e) {
      setError("Błąd głosowania: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const boughtNoticeFiredRef = useRef(null);
  useEffect(() => {
    const at = toMillis(room?.lastBoughtCard?.at);
    if (!at || boughtNoticeFiredRef.current === at) return;
    boughtNoticeFiredRef.current = at;
    if (room.lastBoughtCard.playerId === playerId) return; // kupujący ma już swój lokalny popup
    const buyerName = room.players.find((p) => p.id === room.lastBoughtCard.playerId)?.name;
    setSharedBoughtNotice({ name: buyerName, card: room.lastBoughtCard.card });
    setTimeout(() => setSharedBoughtNotice(null), 4000);
  }, [toMillis(room?.lastBoughtCard?.at)]);

  const brokenLinkFiredRef = useRef(null);
  // Wywoływane, gdy YouTube zgłosi błąd wczytania filmu (usunięty/prywatny/
  // wyłączone osadzanie). Wymiana karty przez transakcję z zabezpieczeniem —
  // jeśli kilku graczy wykryje to jednocześnie, tylko pierwsza próba coś zrobi.
  async function handleBrokenLink(card) {
    if (!room || !roomId || !card) return;
    if (brokenLinkFiredRef.current === card.id) return;
    brokenLinkFiredRef.current = card.id;
    try {
      const ref = doc(db, "rooms", roomId);
      let swapped = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "playing") return; // po fazie decyzji już za późno na wymianę
        if (!data.currentCard || data.currentCard.id !== card.id) return; // ktoś już to obsłużył
        if (data.deckIndex >= data.deck.length) return; // brak zapasu w talii — zostawiamy jak jest
        swapped = true;
        tx.update(ref, {
          currentCard: data.deck[data.deckIndex],
          deckIndex: data.deckIndex + 1,
          startSeconds: randomStartSeconds(),
          turnStartedAt: serverTimestamp(),
        });
      });
      if (swapped) {
        logBrokenLink(card).catch(() => {});
        setBrokenLinkNotice(card);
        setTimeout(() => setBrokenLinkNotice(null), 4000);
      }
    } catch (e) {
      // ciche niepowodzenie — gracz może ręcznie skorzystać z wymiany za token
    }
  }

  // Ładujemy oficjalne IFrame API YouTube RAZ — potrzebne wyłącznie do
  // formalnego "zarejestrowania się" jako słuchacz zdarzeń (onError).
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById("youtube-iframe-api-script")) return;
    const tag = document.createElement("script");
    tag.id = "youtube-iframe-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

  // Wykrywanie zepsutych linków — osobny, ukryty i zawsze wyciszony
  // "testowy" odtwarzacz, niezależny od tego, co faktycznie słychać.
  // Błąd musi potwierdzić się DWA razy z rzędu (z chwilą przerwy między
  // próbami), zanim appka faktycznie wymieni kartę — pierwszy błąd może
  // być chwilowym problemem (np. sam mechanizm testera zbyt szybko tworzy
  // i niszczy odtwarzacze), a nie realnym, trwałym problemem z linkiem.
  const ytValidatorRef = useRef(null);
  useEffect(() => {
    if (screen !== "playing" || !room?.currentCard) return;
    let cancelled = false;
    let attempts = 0;
    let errorCount = 0;
    const currentCard = room.currentCard;

    const createValidator = () => {
      if (cancelled) return;
      try {
        if (ytValidatorRef.current) {
          ytValidatorRef.current.destroy?.();
          ytValidatorRef.current = null;
        }
        ytValidatorRef.current = new window.YT.Player("broken-link-validator", {
          videoId: currentCard.videoId,
          playerVars: { autoplay: 1, mute: 1, controls: 0 },
          events: {
            onError: () => {
              if (cancelled) return;
              errorCount += 1;
              if (errorCount === 1) {
                // pierwszy błąd — może być fałszywym alarmem, spróbuj jeszcze raz po chwili
                setTimeout(() => {
                  if (!cancelled) createValidator();
                }, 2500);
              } else {
                // błąd potwierdzony drugi raz z rzędu dla tej samej karty — dopiero teraz reagujemy
                handleBrokenLink(currentCard);
              }
            },
          },
        });
      } catch (e) {
        // ciche niepowodzenie — automatyczne wykrywanie po prostu nie zadziała tym razem
      }
    };

    const tryAttach = () => {
      if (cancelled) return;
      if (!window.YT || !window.YT.Player || !document.getElementById("broken-link-validator")) {
        attempts++;
        if (attempts < 40) setTimeout(tryAttach, 250);
        return;
      }
      createValidator();
    };
    tryAttach();
    return () => {
      cancelled = true;
    };
  }, [screen, room?.currentCard?.id]);

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
        const newPlayedCards = [...(data.playedCards || []), { ...card, correct: false, playerId: data.currentPlayerId, timedOut: true, guessedCorrect: null }];
        tx.update(ref, {
          status: "roundResult",
          lastResult: { correct: false, card, timedOut: true },
          pendingGuess: null,
          resultAt: serverTimestamp(),
          decisionTimes: newDecisionTimes,
          [`gameStreaks.${data.currentPlayerId}`]: 0,
          [`gameGuessStreaks.${data.currentPlayerId}`]: 0,
          playedCards: newPlayedCards,
        });
      });
      if (capturedCard && !capturedPracticeMode && capturedCard.id) {
        incrementSongPlayCount(capturedCard.id).catch(() => {});
      }
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
          tx.update(ref, {
            status: "gameover",
            winnerIds,
            expireAt: new Date(Date.now() + 60 * 60 * 1000), // TTL: zakończone gry znikają po 1h
          });
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
    setGameEndReward(null);
  }

  function goHome() {
    if (roomId) {
      leaveRoom();
    } else {
      setScreen("home");
      setShowStats(false);
      setShowLeaderboard(false);
      setShowAdminPanel(false);
      setShowAchievements(false);
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

  const displayedPlayerId = viewedPlayerId || room?.currentPlayerId;
  const displayedPlayerName = room && room.players.find((p) => p.id === displayedPlayerId)?.name;
  const viewedTimeline =
    room && displayedPlayerId && room.timelines[displayedPlayerId]
      ? [...room.timelines[displayedPlayerId]].sort((a, b) => a.year - b.year)
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
      {/* Osobny, zawsze ukryty i wyciszony odtwarzacz-tester do wykrywania
          zepsutych linków — nigdy nie jest tym, co gracze faktycznie słyszą. */}
      <div id="broken-link-validator" style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", top: -9999 }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        :root {
          --bg: #050810; --surface: rgba(14,26,38,0.78); --surface2: rgba(20,36,50,0.9);
          --accent: #00e6c3; --accent2: #8b5cf6; --accent3: #ff5fc9; --gold: #ffb020;
          --good: #2af598; --bad: #ff3868;
          --text: #f4eefc; --muted: #9c8fc2;
        }
        @keyframes spin-record { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slide-fade-in {
          from { opacity: 0; transform: translateY(-24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scale-pop-in {
          0% { opacity: 0; transform: scale(0.7); }
          70% { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes bg-drift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 18px -4px var(--accent), 0 0 34px -12px var(--accent2); }
          50% { box-shadow: 0 0 28px -2px var(--accent), 0 0 48px -8px var(--accent2); }
        }
        @keyframes card-reveal-flash {
          0% { opacity: 0; transform: scale(0.85) rotateY(90deg); }
          60% { opacity: 1; transform: scale(1.08) rotateY(0deg); }
          100% { opacity: 1; transform: scale(1) rotateY(0deg); }
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

      {user && myXp !== null && (
        <div style={{ position: "fixed", top: 14, right: 14, zIndex: 90, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <button
            onClick={screen === "home" ? openStats : undefined}
            style={{
              background: "linear-gradient(135deg, rgba(0,230,195,0.16), rgba(139,92,246,0.16))",
              border: "1px solid var(--accent)",
              borderRadius: 999,
              padding: "6px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 0 14px -4px var(--accent)",
              color: "var(--accent)",
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 15,
              letterSpacing: 0.5,
              cursor: screen === "home" ? "pointer" : "default",
            }}
          >
            ⭐ LVL {levelFromXp(myXp).level}
          </button>
          {myHitcoin !== null && (
            <div
              style={{
                background: "rgba(255,214,107,0.12)",
                border: "1px solid var(--gold)",
                borderRadius: 999,
                padding: "4px 12px",
                color: "var(--gold)",
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 13,
              }}
            >
              🪙 {myHitcoin}
            </div>
          )}
        </div>
      )}

      <div className="w-full flex flex-col items-center" style={{ maxWidth: 720 }}>
        <button
          onClick={goHome}
          className="flex items-center justify-center mb-1"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          title="Strona główna"
        >
          <img src={logoImg} alt="Hitsteriada" style={{ height: 100, filter: "drop-shadow(0 0 18px rgba(0,230,195,0.55)) drop-shadow(0 0 28px rgba(139,92,246,0.3))" }} />
        </button>
        <button
          onClick={() => setShowOnlineList((v) => !v)}
          style={{ color: "var(--muted)", fontSize: 12, marginBottom: showOnlineList ? 8 : 24, background: "none", border: "none", cursor: "pointer" }}
        >
          🟢 {onlinePlayers.length} graczy online • każdy gra u siebie, w swoim miejscu {showOnlineList ? "▲" : "▼"}
        </button>

        {showOnlineList && (
          <div className="w-full rounded-xl p-3 mb-6" style={{ background: "var(--surface2)", maxWidth: 340 }}>
            {onlinePlayers.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12, textAlign: "center" }}>Nikt inny teraz nie jest online.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {onlinePlayers.map((p) => {
                  const isMe = p.playerId === playerId;
                  const canChallenge = user && p.uid && !isMe;
                  return (
                    <div key={p.playerId} className="flex items-center justify-between text-sm">
                      <span>
                        {p.name} {isMe && <span style={{ color: "var(--muted)", fontSize: 10 }}>(Ty)</span>}
                        {!p.uid && !isMe && <span style={{ color: "var(--muted)", fontSize: 10 }}> · gość</span>}
                      </span>
                      {canChallenge &&
                        (challengeSentTo?.uid === p.uid ? (
                          <span style={{ color: "var(--accent)", fontSize: 11 }}>Czekam na odpowiedź…</span>
                        ) : (
                          <button
                            onClick={() => handleSendChallenge(p)}
                            disabled={challengeBusy || !!challengeSentTo}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold"
                            style={{ background: "var(--surface)", border: "1px solid var(--accent)", color: "var(--accent)" }}
                          >
                            ⚔️ Wyzwij
                          </button>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
                  {(() => {
                    const { level, currentLevelXp, xpForNextLevel } = levelFromXp(stats.xp);
                    return <LevelBar level={level} currentLevelXp={currentLevelXp} xpForNextLevel={xpForNextLevel} size="big" />;
                  })()}
                  {(() => {
                    const today = currentDayKey();
                    const alreadyClaimed = stats.lastDailyHitcoinDate === today;
                    return (
                      <button
                        onClick={async () => {
                          if (alreadyClaimed) return;
                          const amount = await claimDailyHitcoin(user.uid, today);
                          if (amount > 0) {
                            setMyHitcoin((prev) => (prev || 0) + amount);
                            setStats({ ...stats, lastDailyHitcoinDate: today, hitcoin: (stats.hitcoin || 0) + amount });
                          }
                        }}
                        disabled={alreadyClaimed}
                        className="w-full rounded-2xl p-4 flex items-center justify-between card-glow"
                        style={{ background: "var(--surface)", border: `1px solid ${alreadyClaimed ? "#33294f" : "var(--gold)"}`, opacity: alreadyClaimed ? 0.6 : 1 }}
                      >
                        <div className="text-left">
                          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: alreadyClaimed ? "var(--muted)" : "var(--gold)" }}>🪙 Codzienna nagroda</p>
                          <p style={{ fontSize: 11, color: "var(--muted)" }}>{alreadyClaimed ? "Odebrane — wróć jutro" : "Kliknij, żeby odebrać +25 HITCOIN"}</p>
                        </div>
                        {!alreadyClaimed && <span style={{ color: "var(--gold)", fontSize: 22 }}>→</span>}
                      </button>
                    );
                  })()}
                  {(() => {
                    const { level } = levelFromXp(stats.xp);
                    const duelWins = (h2hOpponents || []).reduce((sum, h) => sum + (h.wins?.[user.uid] || 0), 0);
                    const maxDuelsWithSamePerson = (h2hOpponents || []).reduce((max, h) => Math.max(max, h.gamesPlayed || 0), 0);
                    const achievementStats = { ...stats, duelWins, maxDuelsWithSamePerson };
                    const progress = getAchievementProgress(achievementStats, level);
                    const unclaimed = progress.filter((a) => a.qualifies && !a.claimed);
                    const claimedCount = progress.filter((a) => a.claimed).length;
                    return (
                      <button
                        onClick={() => {
                          setShowStats(false);
                          setShowAchievements(true);
                        }}
                        className="w-full rounded-2xl p-4 flex items-center justify-between card-glow"
                        style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}
                      >
                        <div className="text-left">
                          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--gold)" }}>🏅 Osiągnięcia</p>
                          <p style={{ fontSize: 11, color: "var(--muted)" }}>
                            {claimedCount}/{progress.length} odebranych
                            {unclaimed.length > 0 ? ` · ${unclaimed.length} czeka na odbiór!` : ""}
                          </p>
                        </div>
                        <span style={{ color: "var(--gold)", fontSize: 22 }}>→</span>
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => {
                      setShowStats(false);
                      openAlbum();
                    }}
                    className="w-full rounded-2xl p-4 flex items-center justify-between card-glow"
                    style={{ background: "var(--surface)", border: "1px solid #7dffef" }}
                  >
                    <div className="text-left">
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#7dffef" }}>🃏 Album</p>
                      <p style={{ fontSize: 11, color: "var(--muted)" }}>{Object.keys(stats.cardCollection || {}).length} unikalnych kart</p>
                    </div>
                    <span style={{ color: "#7dffef", fontSize: 22 }}>→</span>
                  </button>
                  {(() => {
                    const wc = stats.weeklyChallenge;
                    const isCurrentWeek = wc && wc.weekKey === currentWeekKey();
                    const gamesThisWeek = isCurrentWeek ? wc.gamesThisWeek : 0;
                    const claimed = isCurrentWeek && wc.claimed;
                    const pct = Math.min(100, Math.round((gamesThisWeek / 3) * 100));
                    return (
                      <div className="w-full rounded-xl p-3" style={{ background: "var(--surface2)" }}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontSize: 12, fontWeight: "bold" }}>🎯 Wyzwanie tygodnia: zagraj 3 gry</span>
                          <span style={{ fontSize: 11, color: claimed ? "var(--good)" : "var(--muted)" }}>
                            {claimed ? "✓ Ukończone (+50 XP)" : `${Math.min(gamesThisWeek, 3)} / 3`}
                          </span>
                        </div>
                        <div className="w-full rounded-full" style={{ height: 6, background: "#0d0a17", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: claimed ? "var(--good)" : "var(--accent)" }} />
                        </div>
                      </div>
                    );
                  })()}
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
                    <StatBox label="🎵 Przesłuchane piosenki" value={`${(stats.heardSongs || []).length}/${totalSongCount ?? effectivePool.length}`} />
                    <StatBox label="🔎 Odgadnięte piosenki" value={`${(stats.guessedSongs || []).length}/${totalSongCount ?? effectivePool.length}`} />
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

            {h2hOpponents && h2hOpponents.length > 0 && (
              <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, marginBottom: 4 }}>⚔️ POJEDYNKI 1V1</h2>
                <p style={{ color: "var(--muted)", fontSize: 11, marginBottom: 10 }}>
                  Liczą się tylko gry, w których graliście dokładnie we dwójkę.
                </p>
                <div className="flex flex-col gap-2">
                  {h2hOpponents.map((h2h) => {
                    const oppId = h2h.uids.find((id) => id !== user.uid);
                    const oppName = h2h.names?.[oppId] || "Gracz";
                    const myWins = h2h.wins?.[user.uid] || 0;
                    const oppWins = h2h.wins?.[oppId] || 0;
                    const expanded = h2hExpanded === oppId;
                    const pct = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : null);
                    const myGuessPct = pct(h2h.guessesCorrect?.[user.uid] || 0, h2h.guessesAttempted?.[user.uid] || 0);
                    const oppGuessPct = pct(h2h.guessesCorrect?.[oppId] || 0, h2h.guessesAttempted?.[oppId] || 0);
                    const myPlacePct = pct(h2h.placementCorrect?.[user.uid] || 0, h2h.placementTotal?.[user.uid] || 0);
                    const oppPlacePct = pct(h2h.placementCorrect?.[oppId] || 0, h2h.placementTotal?.[oppId] || 0);
                    const myAvgSpeed = h2h.decisionCount?.[user.uid] ? Math.round((h2h.decisionTimeSumMs[user.uid] / h2h.decisionCount[user.uid]) / 1000) : null;
                    const oppAvgSpeed = h2h.decisionCount?.[oppId] ? Math.round((h2h.decisionTimeSumMs[oppId] / h2h.decisionCount[oppId]) / 1000) : null;
                    return (
                      <div key={oppId} className="rounded-xl p-3" style={{ background: "var(--surface2)" }}>
                        <button onClick={() => setH2hExpanded(expanded ? null : oppId)} className="w-full flex items-center justify-between">
                          <span style={{ fontSize: 13, fontWeight: "bold" }}>vs {oppName}</span>
                          <span style={{ fontSize: 13, color: "var(--accent)" }}>
                            {myWins} : {oppWins} <span style={{ color: "var(--muted)", fontSize: 11 }}>({h2h.gamesPlayed} gier)</span>
                          </span>
                        </button>
                        {expanded && (
                          <div className="flex flex-col gap-1 mt-3 text-left" style={{ fontSize: 12 }}>
                            <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Skuteczność zgadywania</span><span>{myGuessPct ?? "—"}% vs {oppGuessPct ?? "—"}%</span></div>
                            <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Trafność umieszczania</span><span>{myPlacePct ?? "—"}% vs {oppPlacePct ?? "—"}%</span></div>
                            <div className="flex justify-between"><span style={{ color: "var(--muted)" }}>Średnia szybkość</span><span>{myAvgSpeed ?? "—"}s vs {oppAvgSpeed ?? "—"}s</span></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <button
              onClick={() => setShowStats(false)}
              className="w-full py-3 rounded-xl text-sm font-bold"
              style={{ border: "1px solid #33294f", color: "var(--muted)" }}
            >
              Wróć
            </button>
          </div>
        )}

        {screen === "home" && showAchievements && stats && (
          <div className="w-full flex flex-col gap-5">
            {(() => {
              const { level } = levelFromXp(stats.xp);
              const duelWins = (h2hOpponents || []).reduce((sum, h) => sum + (h.wins?.[user.uid] || 0), 0);
              const maxDuelsWithSamePerson = (h2hOpponents || []).reduce((max, h) => Math.max(max, h.gamesPlayed || 0), 0);
              const achievementStats = { ...stats, duelWins, maxDuelsWithSamePerson };
              const progress = getAchievementProgress(achievementStats, level);
              const unclaimed = progress.filter((a) => a.qualifies && !a.claimed);
              const claimedCount = progress.filter((a) => a.claimed).length;
              const grouped = {};
              progress.forEach((a) => {
                (grouped[a.category] = grouped[a.category] || []).push(a);
              });
              return (
                <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                  <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 4, color: "var(--gold)" }}>
                    🏅 OSIĄGNIĘCIA ({claimedCount}/{progress.length})
                  </h2>

                  {unclaimed.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4 mt-3">
                      <p style={{ fontSize: 11, color: "var(--good)", textTransform: "uppercase" }}>Do odebrania!</p>
                      {unclaimed.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: "rgba(42,245,152,0.1)", border: "1px solid var(--good)" }}>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: "bold" }}>{a.name}</p>
                            <p style={{ fontSize: 11, color: "var(--muted)" }}>{a.desc}</p>
                          </div>
                          <button
                            onClick={() => handleClaimAchievement(a)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap"
                            style={{ background: "var(--good)", color: "#0d1f1a" }}
                          >
                            Odbierz +{a.xp} XP
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {Object.entries(grouped).map(([cat, items]) => (
                      <details key={cat} className="rounded-lg" style={{ background: "var(--surface2)" }}>
                        <summary className="px-3 py-2 text-xs font-bold cursor-pointer" style={{ color: "var(--muted)" }}>
                          {cat} ({items.filter((a) => a.claimed).length}/{items.length})
                        </summary>
                        <div className="flex flex-col gap-1 px-3 pb-3">
                          {items.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between text-xs"
                              style={{ opacity: a.claimed ? 1 : a.qualifies ? 1 : 0.4 }}
                            >
                              <span>
                                {a.claimed ? "✅" : a.qualifies ? "🔓" : "🔒"} {a.name}
                              </span>
                              <span style={{ color: "var(--muted)" }}>{a.desc}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })()}
            <button
              onClick={() => {
                setShowAchievements(false);
                setShowStats(true);
              }}
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
                        <span style={{ fontSize: 10, color: "var(--accent2)", background: "var(--surface)", padding: "1px 6px", borderRadius: 8 }}>
                          lvl {levelFromXp(p.xp).level}
                        </span>
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
                  {(() => {
                    const { level, currentLevelXp, xpForNextLevel } = levelFromXp(viewingPlayer.stats.xp);
                    return <LevelBar level={level} currentLevelXp={currentLevelXp} xpForNextLevel={xpForNextLevel} size="big" />;
                  })()}
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

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🧹 Sprzątanie pokojów</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Usuwa zakończone gry (starsze niż 1h od końca), porzucone/nieukończone pokoje (starsze niż 24h) i sesje treningowe (starsze niż 3h). Bardzo stare pokoje sprzed tej funkcji usuwa, jeśli mają ponad 7 dni. Nie rusza statystyk graczy — te żyją osobno.
              </p>
              <button
                onClick={handleCleanupRooms}
                disabled={cleanupBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                {cleanupBusy
                  ? cleanupProgress
                    ? `Usuwanie… ${cleanupProgress.done}/${cleanupProgress.total}`
                    : "Sprawdzam pokoje…"
                  : "Wyczyść stare pokoje"}
              </button>
              {cleanupResult && (
                <p style={{ fontSize: 12, marginTop: 8, color: "var(--good)" }}>
                  ✓ Usunięto {cleanupResult.deleted} z {cleanupResult.totalRooms} sprawdzonych pokojów.
                </p>
              )}
            </section>

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                🚨 Zgłoszone uszkodzone linki
              </p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Gra sama wykrywa, gdy YouTube nie może wczytać filmu (usunięty/prywatny/wyłączone osadzanie), automatycznie losuje nową kartę i zapisuje to tutaj do przejrzenia.
              </p>
              <button
                onClick={() => {
                  setShowBrokenLinkReports((v) => !v);
                  if (!brokenLinkReports) loadBrokenLinkReports();
                }}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                {showBrokenLinkReports ? "Ukryj" : "Pokaż zgłoszenia"} {brokenLinkReports ? `(${brokenLinkReports.length})` : ""}
              </button>
              {showBrokenLinkReports && (
                <div className="flex flex-col gap-2 mt-3">
                  {!brokenLinkReports ? (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Ładowanie…</p>
                  ) : brokenLinkReports.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>Brak zgłoszeń — nic nie zawiodło (jeszcze 🙂).</p>
                  ) : (
                    brokenLinkReports.map((r) => (
                      <div key={r.id} className="rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                        {brokenLinkEditingId === r.id ? (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap">
                              <input type="text" value={brokenLinkEditDraft.artist} onChange={(e) => setBrokenLinkEditDraft({ ...brokenLinkEditDraft, artist: e.target.value })} className="flex-1" style={{ minWidth: 100 }} placeholder="Wykonawca" />
                              <input type="text" value={brokenLinkEditDraft.title} onChange={(e) => setBrokenLinkEditDraft({ ...brokenLinkEditDraft, title: e.target.value })} className="flex-1" style={{ minWidth: 100 }} placeholder="Tytuł" />
                            </div>
                            <input type="text" value={brokenLinkEditDraft.url} onChange={(e) => setBrokenLinkEditDraft({ ...brokenLinkEditDraft, url: e.target.value })} placeholder="Nowy link YouTube" />
                            <div className="flex gap-2 flex-wrap">
                              <input type="number" value={brokenLinkEditDraft.year} onChange={(e) => setBrokenLinkEditDraft({ ...brokenLinkEditDraft, year: e.target.value })} style={{ width: 90 }} placeholder="Rok" />
                              <input type="text" value={brokenLinkEditDraft.categoriesText} onChange={(e) => setBrokenLinkEditDraft({ ...brokenLinkEditDraft, categoriesText: e.target.value })} placeholder="kategorie;po;średniku" className="flex-1" style={{ minWidth: 140 }} />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveBrokenLinkEdit(r)} disabled={brokenLinkBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: "var(--good)", color: "#0d1f1a" }}>
                                <Save size={12} /> Zapisz (odrzuci zgłoszenie)
                              </button>
                              <button onClick={() => setBrokenLinkEditingId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs" style={{ border: "1px solid #33294f", color: "var(--muted)" }}>
                                <X size={12} /> Anuluj
                              </button>
                            </div>
                          </div>
                        ) : (
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p style={{ fontSize: 13 }}>
                              <strong>{r.artist}</strong> — {r.title} {r.year ? `(${r.year})` : ""}
                            </p>
                            <a
                              href={`https://www.youtube.com/watch?v=${r.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ fontSize: 10, color: "var(--accent)" }}
                            >
                              sprawdź na YouTube ↗
                            </a>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setBrokenLinkEditingId(r.id);
                                setBrokenLinkEditDraft({
                                  artist: r.artist,
                                  title: r.title,
                                  year: r.year || "",
                                  url: `https://www.youtube.com/watch?v=${r.videoId}`,
                                  categoriesText: "",
                                });
                              }}
                              style={{ color: "var(--accent)" }}
                              title="Edytuj link"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Na pewno usunąć "${r.artist} — ${r.title}" z bazy? Tego nie da się cofnąć.`)) handleDeleteBrokenSong(r);
                              }}
                              disabled={brokenLinkBusy}
                              style={{ color: "var(--bad)" }}
                              title="Usuń z bazy"
                            >
                              <Trash2 size={16} />
                            </button>
                            <button onClick={() => handleDismissBrokenLink(r.id)} disabled={brokenLinkBusy} style={{ color: "var(--muted)" }} title="Odrzuć zgłoszenie">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>


            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🃏 Rzadkość kart</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Utwory dodane od teraz dostają rzadkość automatycznie. Ten przycisk jednorazowo uzupełnia ją utworom, które trafiły do bazy ZANIM istniał system kart.
              </p>
              <button
                onClick={async () => {
                  setRarityMigrateBusy(true);
                  setRarityMigrateProgress(null);
                  try {
                    const pool = await fetchAllSongsFromDb();
                    const result = await migrateRarityForExistingSongs(pool, (done, total) => setRarityMigrateProgress({ done, total }));
                    setRarityMigrateProgress({ done: result.updated, total: result.total, finished: true });
                    const fresh = await fetchAllSongsFromDb();
                    setLibrarySongs(fresh);
                    saveLibraryCache(fresh);
                  } catch (e) {
                    setError("Błąd migracji rzadkości: " + e.message);
                  } finally {
                    setRarityMigrateBusy(false);
                  }
                }}
                disabled={rarityMigrateBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--gold)", color: "var(--gold)" }}
              >
                {rarityMigrateBusy ? "Uzupełniam…" : "Uzupełnij brakującą rzadkość"}
              </button>
              {rarityMigrateProgress && (
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  {rarityMigrateProgress.finished
                    ? `Gotowe — uzupełniono ${rarityMigrateProgress.total} utworów.`
                    : `${rarityMigrateProgress.done}/${rarityMigrateProgress.total}...`}
                </p>
              )}
            </section>


            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🏆 Turniej</p>
              {activeTournament ? (
                <div className="flex flex-col gap-2">
                  <p style={{ fontSize: 13 }}>
                    Aktywny turniej: {activeTournament.status === "signup" ? `zapisy (${activeTournament.signups.length}/${activeTournament.maxPlayers})` : activeTournament.status === "active" ? "w trakcie" : "zakończony"}
                  </p>
                  {activeTournament.status === "signup" && (
                    <button
                      onClick={async () => {
                        if (!window.confirm("Anulować turniej? Nikt nie zapłacił jeszcze wpisowego, więc nic nie trzeba zwracać.")) return;
                        await cancelTournament(activeTournament.id);
                        setActiveTournament(null);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-bold self-start"
                      style={{ background: "var(--surface2)", border: "1px solid var(--bad)", color: "var(--bad)" }}
                    >
                      Anuluj turniej
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Liczba graczy</label>
                  <select value={adminNewTournament.maxPlayers} onChange={(e) => setAdminNewTournament({ ...adminNewTournament, maxPlayers: e.target.value })}>
                    <option value="4">4 graczy</option>
                    <option value="8">8 graczy</option>
                  </select>
                  <label className="text-xs uppercase" style={{ color: "var(--muted)", marginTop: 4 }}>Wpisowe (XP)</label>
                  <input
                    type="number"
                    value={adminNewTournament.entryFee}
                    onChange={(e) => setAdminNewTournament({ ...adminNewTournament, entryFee: e.target.value })}
                  />
                  <button
                    onClick={async () => {
                      try {
                        const id = await createTournament("playlist_duel", parseInt(adminNewTournament.maxPlayers, 10), parseInt(adminNewTournament.entryFee, 10), user.uid);
                        setActiveTournament(await fetchTournament(id));
                      } catch (e) {
                        setError("Błąd tworzenia turnieju: " + e.message);
                      }
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-bold mt-2"
                    style={{ background: "var(--gold)", color: "#1a1428" }}
                  >
                    Stwórz turniej
                  </button>
                </div>
              )}
            </section>


            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🔥 Najczęściej grane utwory</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Licznik zlicza tylko karty, które faktycznie padły w prawdziwej rozgrywce (nie Treningu) — losowanie, które zostało zaraz zastąpione (np. zepsuty link), się nie liczy.
              </p>
              <button
                onClick={async () => {
                  setMostPlayedBusy(true);
                  try {
                    const fresh = await fetchAllSongsFromDb();
                    const sorted = fresh.filter((s) => s.timesPlayed > 0).sort((a, b) => (b.timesPlayed || 0) - (a.timesPlayed || 0));
                    setMostPlayedSongs(sorted.slice(0, 20));
                  } catch (e) {
                    setError("Błąd pobierania rankingu: " + e.message);
                  } finally {
                    setMostPlayedBusy(false);
                  }
                }}
                disabled={mostPlayedBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                {mostPlayedBusy ? "Wczytuję…" : "Pokaż ranking"}
              </button>
              {mostPlayedSongs && (
                <div className="flex flex-col gap-1 mt-3">
                  {mostPlayedSongs.length === 0 ? (
                    <p style={{ color: "var(--muted)", fontSize: 12 }}>Brak jeszcze danych — licznik zacznie się zapełniać od teraz.</p>
                  ) : (
                    mostPlayedSongs.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm">
                        <span>
                          {s.artist} — {s.title}
                        </span>
                        <span style={{ color: "var(--accent)" }}>{s.timesPlayed}×</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>


            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>📤 Eksportuj bazę do CSV</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Pobiera całą bibliotekę ({effectivePool.length} utworów) w tym samym formacie, co import poniżej — przydatne jako kopia zapasowa.
              </p>
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
              >
                Pobierz CSV
              </button>
            </section>


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
                              <p style={{ fontSize: 10, color: "var(--muted)" }}>
                                {(s.categories || []).join(", ") || "brak kategorii"}
                                {" · "}
                                <span style={{ color: RARITY_INFO[effectiveRarity(s)].color }}>{RARITY_INFO[effectiveRarity(s)].label}</span>
                              </p>
                            </div>
                            <div className="flex gap-2 items-center">
                              <button
                                onClick={async () => {
                                  const newVal = !s.isDiamond;
                                  await updateSongInDb(s.id, { isDiamond: newVal });
                                  const base = librarySongs && librarySongs.length > 0 ? librarySongs : await fetchAllSongsFromDb();
                                  const next = base.map((x) => (x.id === s.id ? { ...x, isDiamond: newVal } : x));
                                  setLibrarySongs(next);
                                  saveLibraryCache(next);
                                }}
                                title={s.isDiamond ? "Cofnij Diament" : "Ustaw jako Diament"}
                                style={{ color: s.isDiamond ? "#7dffef" : "var(--muted)", fontSize: 16 }}
                              >
                                💎
                              </button>
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
                              <button
                                onClick={() => {
                                  if (window.confirm(`Na pewno usunąć "${s.artist} — ${s.title}"? Tego nie da się cofnąć.`)) handleAdminDelete(s.id);
                                }}
                                disabled={adminBusy}
                                style={{ color: "var(--bad)" }}
                              >
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

        {screen === "home" && !showStats && !showLeaderboard && !showAdminPanel && !showAchievements && (
          <div className="w-full flex flex-col gap-5">
            {/* PASEK TOŻSAMOŚCI — kompaktowy, jedna linia zamiast całej formy */}
            <section
              className="w-full rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap"
              style={{ background: "var(--surface2)", border: user ? "1px solid #22304f" : "1px dashed #33294f" }}
            >
              {user ? (
                <>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16 }}>Cześć, {user.displayName}!</span>
                  <button onClick={handleLogout} className="flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
                    <LogOut size={13} /> Wyloguj
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Imię:</span>
                    <input type="text" value={name} onChange={(e) => saveName(e.target.value)} placeholder="np. Kasia" style={{ width: 120, fontSize: 12, padding: "4px 8px" }} />
                  </div>
                  <button onClick={() => setShowAuthForm((v) => !v)} className="text-xs font-bold" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                    {showAuthForm ? "Zwiń" : "Zaloguj się"}
                  </button>
                </>
              )}
            </section>

            {!user && showAuthForm && (
              <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
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
                    Konto = zbieramy Twoje statystyki gier (wygrane, skuteczność odgadywania). Bez konta też możesz grać — podaj tylko imię powyżej.
                  </p>
                </div>
              </section>
            )}

            {/* WARSTWA 1 — główna akcja */}
            <div>
              <p style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Zacznij grać</p>
              <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, textAlign: "center", marginBottom: 4 }}>Nowa gra</h2>
                <p style={{ color: "var(--muted)", fontSize: 12, textAlign: "center", marginBottom: 14 }}>Stwórz pokój i wyślij kod znajomym</p>
                <button onClick={createRoom} disabled={busy} className="w-full py-3 rounded-xl text-lg font-bold btn-grad" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  STWÓRZ POKÓJ
                </button>
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="KOD POKOJU"
                    maxLength={4}
                    className="flex-1"
                    style={{ textAlign: "center", fontSize: 15, letterSpacing: 2 }}
                  />
                  <button onClick={() => joinRoom()} disabled={busy} className="px-4 py-2 rounded-lg text-sm font-bold" style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
                    Dołącz
                  </button>
                </div>
              </section>
            </div>

            {/* WARSTWA 2 — tryby poboczne */}
            <div>
              <p style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Inne tryby</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setScreen("practiceSetup")}
                  className="flex-1 rounded-2xl p-4 text-center card-glow"
                  style={{ background: "var(--surface)", border: "1px solid #22304f", minWidth: 110 }}
                >
                  <img src={iconTrening} alt="" style={{ height: 40, margin: "0 auto" }} />
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15 }}>Trening</p>
                  <p style={{ color: "var(--muted)", fontSize: 9 }}>solo, wybierz kategorie</p>
                </button>
                {user && (
                  <button
                    onClick={openDailySong}
                    disabled={dailyBusy}
                    className="flex-1 rounded-2xl p-4 text-center card-glow"
                    style={{ background: "var(--surface)", border: "1px solid #22304f", minWidth: 110 }}
                  >
                    <img src={iconPiosenkaDnia} alt="" style={{ height: 40, margin: "0 auto" }} />
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15 }}>Piosenka dnia</p>
                    <p style={{ color: "var(--muted)", fontSize: 9 }}>ta sama dla wszystkich</p>
                  </button>
                )}
                {user && (
                  <button
                    onClick={openDailyPlaylistHub}
                    disabled={dailyPlaylistBusy}
                    className="flex-1 rounded-2xl p-4 text-center card-glow"
                    style={{ background: "var(--surface)", border: "1px solid #22304f", minWidth: 110 }}
                  >
                    <img src={iconPlaylistaDnia} alt="" style={{ height: 40, margin: "0 auto" }} />
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15 }}>Playlista dnia</p>
                    <p style={{ color: "var(--muted)", fontSize: 9 }}>ułóż 10 piosenek na osi</p>
                  </button>
                )}
                {user && activeTournament && (
                  <button
                    onClick={openTournamentHub}
                    disabled={tournamentBusy}
                    className="flex-1 rounded-2xl p-4 text-center card-glow"
                    style={{ background: "var(--surface)", border: "1px solid var(--gold)", minWidth: 110 }}
                  >
                    <img src={iconTurniej} alt="" style={{ height: 40, margin: "0 auto" }} />
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--gold)" }}>Turniej</p>
                    <p style={{ color: "var(--muted)", fontSize: 9 }}>{activeTournament.status === "signup" ? `${activeTournament.signups.length}/${activeTournament.maxPlayers} zapisanych` : "trwa!"}</p>
                  </button>
                )}
              </div>
            </div>

            {/* WARSTWA 3 — statystyki i ranking, wyróżnione podobnie jak tryby powyżej */}
            <div>
              <p style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sprawdź</p>
              <div className="flex gap-3">
                {user && (
                  <button
                    onClick={openStats}
                    className="flex-1 rounded-2xl p-4 text-center card-glow"
                    style={{ background: "var(--surface)", border: "1px solid var(--accent2)" }}
                  >
                    <img src={iconStatystyki} alt="" style={{ height: 40, margin: "0 auto" }} />
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--accent2)" }}>Statystyki</p>
                  </button>
                )}
                <button
                  onClick={() => openLeaderboard()}
                  className="flex-1 rounded-2xl p-4 text-center card-glow"
                  style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}
                >
                  <img src={iconRanking} alt="" style={{ height: 40, margin: "0 auto" }} />
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "var(--gold)" }}>Ranking</p>
                </button>
                {user && (
                  <button
                    onClick={() => setScreen("packShop")}
                    className="flex-1 rounded-2xl p-4 text-center card-glow"
                    style={{ background: "var(--surface)", border: "1px solid #7dffef" }}
                  >
                    <p style={{ fontSize: 32 }}>🎴</p>
                    <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "#7dffef" }}>Sklep</p>
                  </button>
                )}
              </div>
            </div>

            {user && (
              <>
                <button
                  onClick={() => setShowProposeForm((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "var(--surface2)", border: "1px solid #33294f", color: "var(--good)" }}
                >
                  <img src={iconZaproponuj} alt="" style={{ height: 20 }} /> Zaproponuj nowy utwór
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
                <img src={iconAdmin} alt="" style={{ height: 20 }} /> Panel admina ({effectivePool.length} utworów)
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
          </div>
        )}

        {screen === "dailyPlaylistHub" && (
          <div className="w-full flex flex-col gap-5">
            <button onClick={() => setScreen("home")} className="self-start flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              ← Wróć
            </button>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                <img src={iconPlaylistaDnia} alt="" style={{ height: 28 }} /> PLAYLISTA DNIA
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
                10 tych samych piosenek dla wszystkich graczy dzisiaj — ułóż je poprawnie na osi czasu, jedna po drugiej.
              </p>
              {dailyPlaylistAlreadyPlayed ? (
                <div className="rounded-xl p-4 text-center" style={{ background: "var(--surface2)" }}>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--accent)" }}>
                    Dzisiejszy wynik: {dailyPlaylistAlreadyPlayed.score} / 10
                  </p>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Wróć jutro po kolejną playlistę!</p>
                </div>
              ) : (
                <button onClick={startDailyPlaylistGame} disabled={busy} className="w-full py-3 rounded-xl text-lg font-bold btn-grad" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  ZAGRAJ
                </button>
              )}
            </section>

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🏆 Ranking dnia</p>
              {dailyPlaylistDailyBoard.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 12 }}>Nikt jeszcze dziś nie grał — możesz być pierwszy!</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dailyPlaylistDailyBoard.map((e, i) => (
                    <div key={e.uid} className="flex items-center justify-between text-sm">
                      <span>
                        #{i + 1} {e.name}
                      </span>
                      <span style={{ color: "var(--accent)" }}>{e.score} / 10</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ color: "var(--muted)", fontSize: 10, marginTop: 8 }}>Przy remisie decyduje czas wykonania — kto szybszy, wyżej.</p>
            </section>

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>📆 Ranking tygodnia</p>
              {dailyPlaylistWeeklyBoard.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 12 }}>Brak jeszcze wyników w tym tygodniu.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dailyPlaylistWeeklyBoard.map((e, i) => (
                    <div key={e.uid} className="flex items-center justify-between text-sm">
                      <span>
                        #{i + 1} {e.name} <span style={{ color: "var(--muted)", fontSize: 10 }}>({e.gamesPlayed} gier)</span>
                      </span>
                      <span style={{ color: "var(--accent)" }}>{e.score} pkt</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ color: "var(--muted)", fontSize: 10, marginTop: 8 }}>
                Nagrody za tydzień (od poniedziałku): 🥇 +500 XP · 🥈 +250 XP · 🥉 +100 XP — przyznawane automatycznie na starcie nowego tygodnia.
              </p>
            </section>

            <section className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>⭐ Ranking wszech czasów</p>
              {dailyPlaylistAllTimeBoard.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 12 }}>Brak jeszcze żadnych wyników.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dailyPlaylistAllTimeBoard.map((e, i) => (
                    <div key={e.uid} className="flex items-center justify-between text-sm">
                      <span>
                        #{i + 1} {e.username} <span style={{ color: "var(--muted)", fontSize: 10 }}>({e.playlistGamesPlayed || 0} gier)</span>
                      </span>
                      <span style={{ color: "var(--gold)" }}>{e.playlistTotalScore || 0} pkt</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {screen === "tournamentHub" && activeTournament && (
          <div className="w-full flex flex-col gap-5">
            <button onClick={() => setScreen("home")} className="self-start flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              ← Wróć
            </button>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid var(--gold)" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 8, color: "var(--gold)", display: "flex", alignItems: "center", gap: 8 }}>
                <img src={iconTurniej} alt="" style={{ height: 28 }} /> TURNIEJ
              </h2>
              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
                Wpisowe: {activeTournament.entryFee} XP — przegrani tracą je na koniec turnieju, zwycięzca zgarnia całą pulę.
              </p>

              {activeTournament.status === "signup" && (() => {
                const alreadyIn = activeTournament.signups.some((p) => p.uid === user?.uid);
                return (
                  <>
                    <p style={{ fontSize: 13, marginBottom: 10 }}>
                      Zapisanych: <strong>{activeTournament.signups.length}/{activeTournament.maxPlayers}</strong>
                    </p>
                    <div className="flex flex-col gap-1 mb-4">
                      {activeTournament.signups.map((p) => (
                        <p key={p.uid} style={{ fontSize: 13, color: "var(--muted)" }}>
                          • {p.name} {p.uid === user?.uid && <span style={{ color: "var(--accent)" }}>(Ty)</span>}
                        </p>
                      ))}
                    </div>
                    {alreadyIn ? (
                      <p style={{ color: "var(--good)", fontSize: 13 }}>✓ Jesteś zapisany — czekamy na resztę.</p>
                    ) : (
                      <button onClick={handleTournamentSignUp} disabled={tournamentBusy} className="w-full py-3 rounded-xl text-lg font-bold btn-grad" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                        ZAPISZ SIĘ ({activeTournament.entryFee} XP wpisowego)
                      </button>
                    )}
                  </>
                );
              })()}

              {activeTournament.status === "active" &&
                activeTournament.rounds.map((round) => (
                  <div key={round.roundNumber} className="mb-4">
                    <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
                      {round.matches.length === 1 ? "Finał" : `Runda ${round.roundNumber}`}
                    </p>
                    <div className="flex flex-col gap-2">
                      {round.matches.map((m) => {
                        const isMine = user && (m.player1.uid === user.uid || m.player2?.uid === user.uid);
                        const myResult = m.player1.uid === user?.uid ? m.player1Result : m.player2Result;
                        const canPlay = isMine && !m.winnerUid && !myResult;
                        return (
                          <div key={m.matchId} className="rounded-xl p-3" style={{ background: "var(--surface2)" }}>
                            <div className="flex items-center justify-between text-sm">
                              <span style={{ fontWeight: m.winnerUid === m.player1.uid ? "bold" : "normal", color: m.winnerUid === m.player1.uid ? "var(--good)" : "var(--text)" }}>
                                {m.player1.name} {m.player1Result && `(${m.player1Result.score}/10)`}
                              </span>
                              <span style={{ color: "var(--muted)", fontSize: 11 }}>vs</span>
                              <span style={{ fontWeight: m.winnerUid === m.player2?.uid ? "bold" : "normal", color: m.winnerUid === m.player2?.uid ? "var(--good)" : "var(--text)" }}>
                                {m.player2 ? `${m.player2.name} ${m.player2Result ? `(${m.player2Result.score}/10)` : ""}` : "wolny los"}
                              </span>
                            </div>
                            {canPlay && (
                              <button
                                onClick={() => startTournamentMatch(m, round.roundNumber)}
                                disabled={busy}
                                className="w-full mt-2 py-2 rounded-lg text-xs font-bold"
                                style={{ background: "var(--good)", color: "#0d1f1a" }}
                              >
                                Zagraj swój mecz
                              </button>
                            )}
                            {isMine && myResult && !m.winnerUid && (
                              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Zagrałeś — czekamy na przeciwnika.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {activeTournament.status === "completed" && (
                <div className="text-center">
                  <p style={{ fontSize: 32 }}>🏆</p>
                  <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--gold)" }}>
                    {activeTournament.signups.find((p) => p.uid === activeTournament.winnerUid)?.name} wygrywa turniej!
                  </p>
                  {activeTournament.winnerUid === user?.uid ? (
                    <p style={{ color: "var(--good)", fontSize: 13, marginTop: 6 }}>Zgarniasz {(activeTournament.signups.length - 1) * activeTournament.entryFee} XP!</p>
                  ) : (
                    <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Tracisz {activeTournament.entryFee} XP wpisowego.</p>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {screen === "album" && (
          <div className="w-full flex flex-col gap-5">
            <button onClick={() => setScreen("home")} className="self-start flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              ← Wróć
            </button>

            {!albumSongs ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center" }}>Wczytuję kolekcję…</p>
            ) : (
              (() => {
                const myCollection = stats?.cardCollection || {};
                const bySongId = new Map(albumSongs.map((s) => [s.id, s]));
                const counts = {};
                RARITY_ORDER.forEach((r) => (counts[r] = { owned: 0, total: 0 }));
                albumSongs.forEach((s) => {
                  const r = effectiveRarity(s);
                  counts[r].total++;
                  if (myCollection[s.id]) counts[r].owned++;
                });
                const totalOwned = Object.keys(myCollection).length;
                const totalDuplicates = Object.values(myCollection).reduce((sum, c) => sum + Math.max(0, c - 1), 0);

                const tabSongs = albumSongs.filter((s) => effectiveRarity(s) === albumSelectedRarity);
                const visibleSongs = albumOnlyOwned ? tabSongs.filter((s) => myCollection[s.id]) : tabSongs;
                const shown = visibleSongs.slice(0, albumVisibleCount);

                return (
                  <>
                    <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #7dffef" }}>
                      <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 4, color: "#7dffef" }}>🃏 ALBUM</h2>
                      <p style={{ fontSize: 13, marginBottom: 10 }}>
                        Kolekcja: {totalOwned}/{albumSongs.length}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {RARITY_ORDER.map((r) => (
                          <span key={r} style={{ fontSize: 10, color: RARITY_INFO[r].color }}>
                            {RARITY_INFO[r].icon} {counts[r].owned}/{counts[r].total}
                          </span>
                        ))}
                      </div>
                      {totalDuplicates > 0 && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Sprzedać wszystkie duplikaty (${totalDuplicates} kart)? Zostanie po 1 sztuce każdej.`)) handleSellAllDuplicates();
                          }}
                          disabled={albumSellBusy}
                          className="px-4 py-2 rounded-lg text-xs font-bold"
                          style={{ background: "var(--surface2)", border: "1px solid var(--gold)", color: "var(--gold)" }}
                        >
                          Sprzedaj wszystkie duplikaty ({totalDuplicates})
                        </button>
                      )}
                    </section>

                    <div className="flex flex-wrap gap-2">
                      {RARITY_ORDER.map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setAlbumSelectedRarity(r);
                            setAlbumVisibleCount(60);
                          }}
                          className="px-3 py-1.5 rounded-full text-xs font-bold"
                          style={{
                            background: albumSelectedRarity === r ? RARITY_INFO[r].color : "var(--surface2)",
                            color: albumSelectedRarity === r ? "#0a0410" : RARITY_INFO[r].color,
                          }}
                        >
                          {RARITY_INFO[r].icon} {RARITY_INFO[r].label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <input type="checkbox" checked={albumOnlyOwned} onChange={(e) => setAlbumOnlyOwned(e.target.checked)} />
                      Pokaż tylko zdobyte
                    </label>

                    <div className="flex flex-wrap gap-2 justify-center">
                      {shown.map((s) => {
                        const owned = myCollection[s.id] || 0;
                        const info = RARITY_INFO[effectiveRarity(s)];
                        return (
                          <div
                            key={s.id}
                            style={{
                              width: 100,
                              height: 130,
                              borderRadius: 10,
                              position: "relative",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              textAlign: "center",
                              padding: 6,
                              background: owned ? "var(--surface2)" : "rgba(20,26,38,0.5)",
                              border: owned ? `1px solid ${info.color}` : "1px dashed #33294f",
                            }}
                          >
                            {owned ? (
                              <>
                                <span style={{ fontSize: 16 }}>{info.icon}</span>
                                <p style={{ fontSize: 9, fontWeight: "bold", marginTop: 4 }}>{s.artist}</p>
                                <p style={{ fontSize: 8, color: "var(--muted)" }}>{s.title}</p>
                                {owned > 1 && (
                                  <span style={{ position: "absolute", top: 4, right: 4, fontSize: 9, background: "var(--surface)", borderRadius: 999, padding: "1px 5px" }}>
                                    ×{owned}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span style={{ fontSize: 18, color: "var(--muted)" }}>🔒 ?</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {visibleSongs.length > albumVisibleCount && (
                      <button
                        onClick={() => setAlbumVisibleCount((v) => v + 60)}
                        className="self-center px-4 py-2 rounded-lg text-xs font-bold"
                        style={{ background: "var(--surface2)", border: "1px solid #33294f", color: "var(--muted)" }}
                      >
                        Pokaż więcej ({visibleSongs.length - albumVisibleCount} pozostało)
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}

        {screen === "packShop" && (
          <div className="w-full flex flex-col gap-5">
            <button
              onClick={() => {
                setScreen("home");
                setPackOpenResult(null);
              }}
              className="self-start flex items-center gap-1 text-xs"
              style={{ color: "var(--muted)" }}
            >
              ← Wróć
            </button>

            {!packOpenResult ? (
              <>
                <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #7dffef" }}>
                  <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 4, color: "#7dffef" }}>🎴 SKLEP</h2>
                  <p style={{ color: "var(--muted)", fontSize: 12 }}>Twoje saldo: {myHitcoin ?? 0} 🪙</p>
                </section>

                <div className="flex flex-col gap-3">
                  {Object.entries(PACKS).map(([key, config]) => (
                    <div key={key} className="rounded-2xl p-4 flex items-center justify-between card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                      <div>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18 }}>{config.cards} kart</p>
                        <p style={{ fontSize: 11, color: "var(--muted)" }}>{(config.diamondChance * 100).toFixed(1)}% szans na Diament</p>
                      </div>
                      <button
                        onClick={() => buyPack(key)}
                        disabled={packShopBusy || (myHitcoin ?? 0) < config.price}
                        className="px-4 py-2 rounded-lg text-sm font-bold"
                        style={{ background: "var(--surface2)", border: "1px solid var(--gold)", color: "var(--gold)", opacity: (myHitcoin ?? 0) < config.price ? 0.5 : 1 }}
                      >
                        {config.price} 🪙
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <section className="w-full rounded-2xl p-5" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, marginBottom: 4, textAlign: "center" }}>Kliknij, żeby odkryć kartę</h2>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {packOpenResult.map((item, i) => {
                    const revealed = packRevealedIndices.has(i);
                    const info = RARITY_INFO[effectiveRarity(item.song)];
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (revealed) return;
                          setPackRevealedIndices((prev) => new Set(prev).add(i));
                        }}
                        style={{
                          width: 130,
                          height: 180,
                          borderRadius: 14,
                          cursor: revealed ? "default" : "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          textAlign: "center",
                          padding: 10,
                          background: revealed ? "var(--surface2)" : "linear-gradient(160deg, var(--accent2), #2a1a4a)",
                          border: revealed ? `2px solid ${info.color}` : "2px solid #4c1d95",
                          boxShadow: revealed ? `0 0 ${info.color === "#7dffef" ? 40 : info.color === "#c4b5fd" ? 26 : 14}px -4px ${info.color}` : "none",
                          animation: revealed ? "card-reveal-flash 0.5s ease" : "none",
                        }}
                      >
                        {revealed ? (
                          <>
                            <span style={{ fontSize: 22 }}>{info.icon}</span>
                            <p style={{ fontSize: 11, fontWeight: "bold", marginTop: 6 }}>{item.song.artist}</p>
                            <p style={{ fontSize: 10, color: "var(--muted)" }}>{item.song.title}</p>
                            <p style={{ fontSize: 10, color: info.color, marginTop: 4 }}>{info.label}</p>
                            {item.isDuplicate && <p style={{ fontSize: 9, color: "var(--muted)" }}>masz już tę kartę</p>}
                          </>
                        ) : (
                          <span style={{ fontSize: 28 }}>🎴</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {packRevealedIndices.size === packOpenResult.length && (
                  <button
                    onClick={() => setPackOpenResult(null)}
                    className="w-full mt-5 py-3 rounded-xl text-sm font-bold btn-grad"
                  >
                    Gotowe
                  </button>
                )}
              </section>
            )}
          </div>
        )}

        {screen === "practiceSetup" && (
          <div className="w-full flex flex-col gap-5">
            <button onClick={() => setScreen("home")} className="self-start flex items-center gap-1 text-xs" style={{ color: "var(--muted)" }}>
              ← Wróć
            </button>

            <section className="w-full rounded-2xl p-5 card-glow" style={{ background: "var(--surface)", border: "1px solid #22304f" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, marginBottom: 12 }}>🎯 USTAWIENIA TRENINGU</h2>

              <div className="flex items-center gap-2 mb-4">
                <label className="text-xs uppercase" style={{ color: "var(--muted)" }}>Kart do zebrania:</label>
                <input type="number" min={1} value={practiceTarget} onChange={(e) => setPracticeTarget(parseInt(e.target.value, 10) || "")} style={{ width: 60 }} />
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

              <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 14 }}>
                {(() => {
                  const filterActive = !selectedCategories.includes("wszystkie") && selectedCategories.length > 0;
                  const count = filterActive
                    ? effectivePool.filter((s) => s.categories && s.categories.some((c) => selectedCategories.includes(c))).length
                    : effectivePool.length;
                  return filterActive
                    ? `${count} utworów pasuje do wybranych kategorii (z ${effectivePool.length} w całej bibliotece).`
                    : `Trenujesz z pełną biblioteką ${effectivePool.length} utworów.`;
                })()}
              </p>

              <button onClick={startPractice} disabled={busy} className="w-full py-3 rounded-xl text-lg font-bold btn-grad" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                ROZPOCZNIJ TRENING
              </button>
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
                    {p.authed && playerLevels[p.id] !== undefined && (
                      <span style={{ fontSize: 10, color: "var(--accent2)", background: "var(--surface2)", padding: "1px 6px", borderRadius: 8 }}>
                        lvl {levelFromXp(playerLevels[p.id]).level}
                      </span>
                    )}
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
                  Oś czasu gracza {displayedPlayerName} <span style={{ fontSize: 10 }}>(kliknij gracza poniżej, żeby zmienić)</span>
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {viewedTimeline.map((c) => (
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

            {screen === "roundResult" && room.lastResult && (() => {
              const ownerId = room.currentPlayerId;
              const ownerName = room.players.find((p) => p.id === ownerId)?.name || "Gracz";
              const r = room.lastResult;

              const resultBox = (isCorrect, delayS) => (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    background: isCorrect ? "rgba(42,245,152,0.15)" : "rgba(255,56,104,0.15)",
                    border: `2px solid ${isCorrect ? "var(--good)" : "var(--bad)"}`,
                    boxShadow: `0 0 18px -3px ${isCorrect ? "var(--good)" : "var(--bad)"}`,
                    animation: `scale-pop-in 0.4s ease ${delayS}s both`,
                  }}
                >
                  {isCorrect ? <Check size={28} color="var(--good)" strokeWidth={3.5} /> : <X size={28} color="var(--bad)" strokeWidth={3.5} />}
                </div>
              );

              const resultRow = (label, isCorrect, delayS) => (
                <div
                  className="w-full flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{ background: "var(--surface2)", animation: `slide-fade-in 0.4s ease ${delayS - 0.1}s both` }}
                >
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 0.5 }}>{label}</span>
                  {resultBox(isCorrect, delayS)}
                </div>
              );

              const ownerTimeline = [...(room.timelines[ownerId] || [])].sort((a, b) => a.year - b.year);
              const hasGhost = !r.timedOut && !r.correct && r.chosenSlot !== undefined && r.chosenSlot !== null;
              const displayCards = hasGhost
                ? (() => {
                    const withGhost = [...ownerTimeline];
                    withGhost.splice(r.chosenSlot, 0, { ...r.card, __ghost: true });
                    return withGhost;
                  })()
                : ownerTimeline;

              return (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(5,8,16,0.92)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 97,
                    padding: 16,
                    overflowY: "auto",
                  }}
                >
                  <div className="w-full flex flex-col items-center gap-2.5" style={{ maxWidth: 380 }}>
                    <p
                      style={{
                        fontFamily: "'Bebas Neue', sans-serif",
                        fontSize: 44,
                        fontWeight: "bold",
                        textAlign: "center",
                        letterSpacing: 1,
                        color: "var(--text)",
                        textShadow: "0 0 20px rgba(0,230,195,0.45)",
                        animation: "slide-fade-in 0.45s ease both",
                        lineHeight: 1,
                      }}
                    >
                      {ownerName}
                    </p>

                    {r.bought ? (
                      resultRow("🎁 KUPIONA KARTA", true, 0.2)
                    ) : r.timedOut ? (
                      resultRow("OŚ CZASU", false, 0.2)
                    ) : (
                      <>
                        {resultRow("OŚ CZASU", r.correct, 0.2)}
                        {r.tokenAwarded !== undefined && resultRow("TYTUŁ I WYKONAWCA", r.tokenAwarded, 0.35)}
                      </>
                    )}

                    <div
                      className="rounded-2xl p-6 text-center card-glow"
                      style={{ background: "var(--surface)", minWidth: 220, marginTop: 8, animation: "scale-pop-in 0.5s ease 0.5s both" }}
                    >
                      <p style={{ fontSize: 13, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{r.card.artist}</p>
                      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: "var(--accent)", lineHeight: 1 }}>{r.card.year}</p>
                      <p style={{ fontSize: 15, marginTop: 8 }}>„{r.card.title}"</p>
                    </div>

                    {!r.timedOut && displayCards.length > 0 && (
                      <div className="w-full" style={{ animation: "slide-fade-in 0.5s ease 0.65s both" }}>
                        <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", marginBottom: 8, textAlign: "center" }}>
                          Oś czasu gracza {ownerName}
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {displayCards.map((c, i) => {
                            const isPlacedCard = !c.__ghost && r.correct && c.videoId === r.card.videoId && c.year === r.card.year;
                            const highlight = c.__ghost ? "var(--bad)" : isPlacedCard ? "var(--good)" : null;
                            return <TimelineCard key={c.__ghost ? "ghost" : c.id || i} year={c.year} title={c.title} artist={c.artist} highlight={highlight} />;
                          })}
                        </div>
                      </div>
                    )}

                    <p style={{ color: "var(--muted)", fontSize: 13 }}>Kolejny gracz za {advanceCountdown ?? 5}…</p>
                  </div>
                </div>
              );
            })()}

            <div className="w-full flex flex-wrap gap-2 justify-center">
              {room.players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setViewedPlayerId(p.id)}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{
                    background: displayedPlayerId === p.id ? "var(--accent)" : "var(--surface2)",
                    color: displayedPlayerId === p.id ? "#1a1428" : "var(--muted)",
                    border: p.id === room.currentPlayerId ? "1px solid var(--accent)" : "1px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {p.name}: {(room.timelines[p.id] || []).length}/{room.target} · 🪙{room.tokens?.[p.id] || 0}
                  {p.authed && playerLevels[p.id] !== undefined && ` · lvl ${levelFromXp(playerLevels[p.id]).level}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "gameover" && room && room.winnerIds && room.winnerIds.length > 0 && (
          <div className="w-full flex flex-col items-center gap-5 text-center">
            {showConfetti && <Confetti />}
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

            {room.players.length >= 3 && (() => {
              const winnerSet = new Set(room.winnerIds);
              const rest = computeFinalStandings(room).filter((p) => !winnerSet.has(p.id));
              if (rest.length === 0) return null;
              return (
                <div className="w-full flex flex-col gap-2" style={{ maxWidth: 320 }}>
                  {rest[0] && (
                    <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ background: "var(--surface2)", border: "1px solid #c0c0c0" }}>
                      <span>🥈 2. miejsce — {rest[0].name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{(room.timelines[rest[0].id] || []).length} kart</span>
                    </div>
                  )}
                  {rest[1] && (
                    <div className="flex items-center justify-between rounded-xl px-4 py-2" style={{ background: "var(--surface2)", border: "1px solid var(--gold)" }}>
                      <span>🥉 3. miejsce — {rest[1].name}</span>
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>{(room.timelines[rest[1].id] || []).length} kart</span>
                    </div>
                  )}
                </div>
              );
            })()}

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

            {user && !room.practiceMode && (() => {
              const { items, total } = computeGameEndXp(room, playerId);
              if (!items.length) return null;
              return (
                <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                  <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>⭐ Zdobyte XP</p>
                  <div className="flex flex-col gap-1 text-left">
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span>{it.label}</span>
                        <span style={{ color: it.amount >= 0 ? "var(--good)" : "var(--bad)" }}>
                          {it.amount >= 0 ? "+" : ""}
                          {it.amount} XP
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm mt-1 pt-1" style={{ borderTop: "1px solid #33294f", fontWeight: "bold" }}>
                      <span>Razem</span>
                      <span style={{ color: "var(--accent)" }}>
                        {total >= 0 ? "+" : ""}
                        {total} XP
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {user && !room.practiceMode && gameEndReward && (
              <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🪙 Zdobyty HITCOIN</p>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span>🎮 Za rozgrywkę</span>
                  <span style={{ color: "var(--gold)" }}>+{gameEndReward.hitcoin} 🪙</span>
                </div>
                {gameEndReward.card && (
                  <div
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "var(--surface2)", border: `1px solid ${RARITY_INFO[effectiveRarity(gameEndReward.card.song)].color}` }}
                  >
                    <span style={{ fontSize: 22 }}>{RARITY_INFO[effectiveRarity(gameEndReward.card.song)].icon}</span>
                    <div className="text-left flex-1">
                      <p style={{ fontSize: 13, fontWeight: "bold" }}>{gameEndReward.card.song.artist} — {gameEndReward.card.song.title}</p>
                      <p style={{ fontSize: 11, color: RARITY_INFO[effectiveRarity(gameEndReward.card.song)].color }}>
                        {RARITY_INFO[effectiveRarity(gameEndReward.card.song)].label}
                        {gameEndReward.card.isDuplicate && <span style={{ color: "var(--muted)" }}> · masz już tę kartę</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {room.playedCards && room.playedCards.length > 0 && (
              <div className="w-full rounded-2xl p-4" style={{ background: "var(--surface)", border: "1px solid #2a2340" }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)" }}>
                    🎵 {showOnlyMyPlaylist ? "Twoja playlista" : "Playlista wieczoru"} (
                    {showOnlyMyPlaylist ? room.playedCards.filter((c) => c.playerId === playerId).length : room.playedCards.length})
                  </p>
                  <button
                    onClick={() => setShowOnlyMyPlaylist((v) => !v)}
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: "var(--surface2)", border: "1px solid var(--accent)", color: "var(--accent)" }}
                  >
                    {showOnlyMyPlaylist ? "Pokaż wszystkich" : "Pokaż tylko moje"}
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-left" style={{ maxHeight: 240, overflowY: "auto" }}>
                  {(showOnlyMyPlaylist ? room.playedCards.filter((c) => c.playerId === playerId) : room.playedCards).map((c, i) => {
                    const guessColor = showOnlyMyPlaylist
                      ? c.guessedCorrect === true
                        ? "rgba(42,245,152,0.18)"
                        : c.guessedCorrect === false
                        ? "rgba(255,56,104,0.18)"
                        : "var(--surface2)"
                      : "var(--surface2)";
                    return (
                      <a
                        key={i}
                        href={`https://www.youtube.com/watch?v=${c.videoId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between px-2 py-1.5 rounded"
                        style={{ background: guessColor, textDecoration: "none", color: "var(--text)" }}
                      >
                        <span style={{ fontSize: 12 }}>
                          {c.correct ? "✓" : "✗"} {c.artist} — {c.title}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--accent)" }}>{c.year}</span>
                      </a>
                    );
                  })}
                </div>
                {showOnlyMyPlaylist && (
                  <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 8 }}>
                    🟢 odgadnięty wykonawca/tytuł · 🔴 nieodgadnięty · szare = nie próbowano zgadywać
                  </p>
                )}
              </div>
            )}

            {isHost && !room.dailyPlaylistMode && !room.tournamentMode && (
              <button onClick={playAgain} className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold" style={{ background: "var(--accent)", color: "#1a1428" }}>
                <RotateCcw size={16} /> ZAGRAJ PONOWNIE
              </button>
            )}
            {room.dailyPlaylistMode && (
              <button
                onClick={() => {
                  leaveRoom();
                  openDailyPlaylistHub();
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#1a1428" }}
              >
                🎶 Wróć do rankingów Playlisty dnia
              </button>
            )}
            {room.tournamentMode && (
              <button
                onClick={() => {
                  leaveRoom();
                  openTournamentHub();
                }}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                style={{ background: "var(--accent)", color: "#1a1428" }}
              >
                🏆 Wróć do turnieju
              </button>
            )}
          </div>
        )}
      </div>

      {incomingChallenge && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div className="rounded-2xl p-6 text-center card-glow" style={{ background: "var(--surface)", maxWidth: 320 }}>
            <p style={{ fontSize: 32 }}>⚔️</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, marginTop: 4 }}>
              {incomingChallenge.fromName} wyzywa Cię na pojedynek!
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAcceptChallenge}
                disabled={challengeBusy}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "var(--good)", color: "#0d1f1a" }}
              >
                Przyjmij
              </button>
              <button
                onClick={handleDeclineChallenge}
                disabled={challengeBusy}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ border: "1px solid #33294f", color: "var(--muted)" }}
              >
                Odrzuć
              </button>
            </div>
          </div>
        </div>
      )}

      {levelUpInfo && (
        <div
          onClick={() => setLevelUpInfo(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 24,
          }}
        >
          <div className="rounded-2xl p-6 text-center card-glow pulse-cta" style={{ background: "var(--surface)", maxWidth: 320 }}>
            <p style={{ fontSize: 40 }}>🎉</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--accent)" }}>AWANS POZIOMU!</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48 }}>Poziom {levelUpInfo.level}</p>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>(kliknij, żeby zamknąć)</p>
          </div>
        </div>
      )}

      {weeklyBonusInfo && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 96,
            textAlign: "center",
            padding: "10px 18px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--good)",
            color: "var(--text)",
            fontSize: 12,
            maxWidth: "90%",
          }}
        >
          🎯 Wyzwanie tygodnia ukończone! +50 XP
        </div>
      )}

      {showDailySong && dailySong && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 98,
            padding: 16,
            overflowY: "auto",
          }}
        >
          <div className="rounded-2xl p-5 card-glow w-full" style={{ background: "var(--surface)", maxWidth: 380 }}>
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <img src={iconPiosenkaDnia} alt="" style={{ height: 26 }} /> PIOSENKA DNIA
              </p>
              <button onClick={closeDailySong} style={{ color: "var(--muted)" }}>
                <X size={20} />
              </button>
            </div>

            {!dailyAlreadyPlayed ? (
              <div className="flex flex-col items-center gap-4">
                <Vinyl spinning={dailyIsPlaying} revealed={false} progress={dailyPlayElapsed / PLAY_CAP_SECONDS} />
                <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
                  <iframe
                    key={"daily-" + dailySong.videoId}
                    ref={dailyIframeRef}
                    title="daily-player"
                    width="280"
                    height="158"
                    src={`https://www.youtube.com/embed/${dailySong.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${dailySong.startSeconds}&controls=0&modestbranding=1&rel=0`}
                    allow="autoplay; encrypted-media"
                    style={{ border: "none" }}
                  />
                </div>
                <button onClick={toggleDailyPlay} className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold btn-grad">
                  <Play size={16} />
                  {dailyIsPlaying ? `Gra… (${Math.ceil(PLAY_CAP_SECONDS - dailyPlayElapsed)}s)` : "Odtwórz dźwięk"}
                </button>

                <div className="w-full flex flex-col gap-2">
                  <input type="text" value={dailyGuessArtist} onChange={(e) => setDailyGuessArtist(e.target.value)} placeholder="Wykonawca" />
                  <input type="text" value={dailyGuessTitle} onChange={(e) => setDailyGuessTitle(e.target.value)} placeholder="Tytuł" />
                  <input type="number" value={dailyGuessYear} onChange={(e) => setDailyGuessYear(e.target.value)} placeholder="Rok" />
                </div>
                <button onClick={submitDailyGuess} disabled={dailyBusy} className="w-full py-3 rounded-xl text-lg font-bold btn-grad" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  ZATWIERDŹ ODPOWIEDŹ
                </button>
                <p style={{ fontSize: 10, color: "var(--muted)" }}>Puste pola liczą się jako błędne — możesz zostawić to, czego nie wiesz.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>
                  {dailyResult?.score === 3 ? "🎉 KOMPLET!" : dailyResult?.score > 0 ? "Nieźle!" : "Może jutro pójdzie lepiej"}
                </p>
                <div className="w-full rounded-lg p-3" style={{ background: "var(--surface2)" }}>
                  <p style={{ fontSize: 13 }}>
                    <strong>{dailySong.artist}</strong> — {dailySong.title}
                  </p>
                  <p style={{ color: "var(--accent)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22 }}>{dailySong.year}</p>
                </div>
                {dailyResult && (
                  <div className="w-full flex flex-col gap-1 text-left" style={{ fontSize: 12 }}>
                    <span style={{ color: dailyResult.correctArtist ? "var(--good)" : "var(--bad)" }}>
                      {dailyResult.correctArtist ? "✓" : "✗"} Wykonawca: {dailyResult.guessArtist || "—"}
                    </span>
                    <span style={{ color: dailyResult.correctTitle ? "var(--good)" : "var(--bad)" }}>
                      {dailyResult.correctTitle ? "✓" : "✗"} Tytuł: {dailyResult.guessTitle || "—"}
                    </span>
                    <span style={{ color: dailyResult.correctYear ? "var(--good)" : "var(--bad)" }}>
                      {dailyResult.correctYear ? "✓" : "✗"} Rok: {dailyResult.guessYear || "—"}
                    </span>
                  </div>
                )}
                {dailyResult?.streak !== undefined && (
                  <p style={{ fontSize: 12, color: "var(--accent2)" }}>🔥 Seria dni z rzędu: {dailyResult.streak}</p>
                )}
                {dailyResult?.xpEarned !== undefined && (
                  <p style={{ fontSize: 12, color: "var(--good)" }}>+{dailyResult.xpEarned} XP</p>
                )}
                <p style={{ fontSize: 11, color: "var(--muted)" }}>Wróć jutro po kolejną piosenkę!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {sharedBoughtNotice && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 96,
            textAlign: "center",
            padding: "10px 18px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--accent)",
            color: "var(--text)",
            fontSize: 12,
            maxWidth: "90%",
          }}
        >
          🎁 {sharedBoughtNotice.name} kupił(a) kartę za tokeny!
        </div>
      )}

      {brokenLinkNotice && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 96,
            textAlign: "center",
            padding: "10px 18px",
            borderRadius: 12,
            background: "var(--surface)",
            border: "1px solid var(--bad)",
            color: "var(--text)",
            fontSize: 12,
            maxWidth: "90%",
          }}
        >
          ⚠ Ten utwór nie mógł się załadować — losujemy nowy.
        </div>
      )}

      {boughtCardReveal && (
        <div
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
          <div className="rounded-2xl p-5 text-center card-glow" style={{ background: "var(--surface)", maxWidth: 320 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--good)", marginBottom: 6 }}>🎁 Kupiona karta</p>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: "var(--accent)" }}>{boughtCardReveal.year}</p>
            <p style={{ fontSize: 15, fontWeight: "bold", marginTop: 4 }}>{boughtCardReveal.artist}</p>
            <p style={{ fontSize: 14, color: "var(--muted)", marginTop: 2 }}>„{boughtCardReveal.title}"</p>
            <p style={{ fontSize: 10, color: "var(--muted)", marginTop: 10 }}>trafiła na Twoją oś czasu</p>
          </div>
        </div>
      )}

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
