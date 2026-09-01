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
import { db, storage } from "./firebase-config.js";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getOrCreatePlayerId, generateRoomCode } from "./identity.js";
import { shuffle, randomStartSeconds, requiredApprovals, getYouTubeId, fuzzyMatch } from "./utils.js";
import { REAL_SONGS } from "./songs.js";
import { registerWithUsername, loginWithUsername, logout, watchAuthState, friendlyAuthError } from "./auth.js";
import { ensureStatsDoc, getStats, recordCardGuess, recordGameResult, recordSuccessfulGuess, recordSongAdded, topArtists, getLeaderboard, awardXp, xpForLevel, levelFromXp, currentWeekKey, currentDayKey, recordDailyResult, claimAchievementXp, markPerfectDailyIfNeeded, updateAchievementCounters, checkQuickReturn, updateLongestGuessStreak, setAvatarUrl, consumeDoubleXpFlag, getWeeklyChallenges, bumpWeeklyChallengeProgress, claimWeeklyChallenge } from "./stats.js";
import { fetchAllSongsFromDb, addSongToDb, updateSongInDb, deleteSongFromDb, migrateBundledLibraryToDb, submitSongProposal, fetchPendingProposals, updateProposal, acceptProposal, rejectProposal, importSongsFromCsv, logBrokenLink, fetchBrokenLinkReports, dismissBrokenLinkReport, deleteBrokenSongAndDismiss, updateBrokenSongAndDismiss, incrementSongPlayCount, getSongCount, migrateRarityForExistingSongs } from "./songsDb.js";
import { cleanupOldRooms } from "./roomsDb.js";
import { heartbeat, clearPresence, getOnlinePlayers } from "./presence.js";
import { sendDuelChallenge, listenForIncomingChallenge, listenForSentChallenges, acceptDuelChallenge, declineDuelChallenge, clearDuelChallenge, isChallengeStale } from "./duelInvites.js";
import { getOrCreateDailySong } from "./dailySong.js";
import { getOrCreateDailyPlaylist, hasPlayedPlaylistToday, recordDailyPlaylistScore, fetchDailyPlaylistLeaderboard, fetchWeeklyPlaylistLeaderboard, fetchAllTimePlaylistLeaderboard, processWeeklyPlaylistRewardsIfNeeded } from "./dailyPlaylist.js";
import { createTournament, cancelTournament, fetchActiveTournament, fetchLastCompletedTournament, fetchTournament, signUpForTournament, recordTournamentMatchResult, checkAndAdvanceTournament, settleTournamentXpIfNeeded, pickMatchPlaylist } from "./tournaments.js";
import { awardHitcoin, computeWinHitcoin, computeSecondPlaceHitcoin, computeThirdPlaceHitcoin, claimDailyHitcoin, drawCardAfterGame, effectiveRarity, PACKS, openPack, SELL_PRICES, sellDuplicateCard, sellAllDuplicates } from "./cards.js";
import { DAILY_REWARD_SEGMENTS, claimDailyWheelReward } from "./dailyWheel.js";
import { HIT_RUSH_CONFIG, pickNextHitRushSong, computeHitRushPoints, checkHitRushTimeBonus, difficultyLabel, submitHitRushRun, fetchHitRushLeaderboard, processHitRushWeeklyRewardsIfNeeded } from "./hitRush.js";
import { updateHeadToHead, fetchHeadToHeadOpponents } from "./headToHead.js";
import { getAchievementProgress, ACHIEVEMENTS } from "./achievements.js";
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
import packPodstawowa from "./assets/icons/pack-podstawowa.webp";
import packRozszerzona from "./assets/icons/pack-rozszerzona.webp";
import packPremium from "./assets/icons/pack-premium.webp";
import iconSklep from "./assets/icons/icon-sklep.png";
import iconHitcoin from "./assets/icons/icon-hitcoin.png";
import iconToken from "./assets/icons/icon-token.png";
import heroBanner from "./assets/home/hero-banner.webp";
import homeBg from "./assets/home/bg.jpg";
import footerStrip from "./assets/home/footer-strip.webp";
import glTrening from "./assets/icons/gl-trening.png";
import glHitRush from "./assets/icons/gl-hitrush.png";
import hitrushFrameRef from "./assets/icons/hitrush-frame-ref.webp";
import hitrushFrameBlue from "./assets/icons/hitrush-frame-blue.webp";
import hitrushFramePink from "./assets/icons/hitrush-frame-pink.webp";
import hitrushNowPlaying from "./assets/icons/hitrush-nowplaying.webp";
import hitrushMenuGold from "./assets/icons/hitrush-menu-gold.webp";
import hitrushMenuBlueThin from "./assets/icons/hitrush-menu-blue-thin.webp";
import hitrushMenuDesc from "./assets/icons/hitrush-menu-desc.webp";
import hitrushMenuBlue from "./assets/icons/hitrush-menu-blue.webp";
import hitrushMenuPink from "./assets/icons/hitrush-menu-pink.webp";
import hitrushMenuStart from "./assets/icons/hitrush-menu-start.webp";
import playingPanelFrame from "./assets/icons/playing-panel-frame-v3.webp";
import timelineCardFrame from "./assets/icons/timeline-card-frame-v3.webp";
import confirmSlotBtnInactive from "./assets/icons/confirm-slot-btn-inactive.webp";
import timelineSlotFrame from "./assets/icons/timeline-slot-frame.webp";
import confirmSlotBtn from "./assets/icons/confirm-slot-btn.webp";
import playingConfirmBtn from "./assets/icons/playing-confirm-btn.webp";
import playingYearCard from "./assets/icons/playing-year-card.webp";
import glPiosenka from "./assets/icons/gl-piosenka.png";
import glPlaylista from "./assets/icons/gl-playlista.png";
import glTurniej from "./assets/icons/gl-turniej.png";
import glStatystyki from "./assets/icons/gl-statystyki.png";
import glMedal from "./assets/icons/gl-medal.png";
import glKolekcja from "./assets/icons/gl-kolekcja.png";
import glKorona from "./assets/icons/gl-korona.png";
import glPrezent from "./assets/icons/gl-prezent.png";
import glKoszyk from "./assets/icons/gl-koszyk.png";
import glOsoba from "./assets/icons/gl-osoba.png";
import glGraj from "./assets/icons/gl-graj.png";
import achOsiagniecia from "./assets/icons/ach-osiagniecia.png";
import ach1Miejsce from "./assets/icons/ach-1miejsce.png";
import ach2Miejsce from "./assets/icons/ach-2miejsce.png";
import ach3Miejsce from "./assets/icons/ach-3miejsce.png";
import achDoOdebrania from "./assets/icons/ach-doodebrania.png";
import achZablokowane from "./assets/icons/ach-zablokowane.png";
import achOdebrane from "./assets/icons/ach-odebrane.png";
import achKupionaKarta from "./assets/icons/ach-kupionakarta.png";
import achAlbum from "./assets/icons/ach-album.png";
import achSeria from "./assets/icons/ach-seria.png";
import achNajszybszy from "./assets/icons/ach-najszybszy.png";
import cardRewers from "./assets/icons/card-rewers-v2.webp";
import cardWinylImg from "./assets/icons/card-winyl.webp";
import cardSrebroImg from "./assets/icons/card-srebro.webp";
import cardZlotoImg from "./assets/icons/card-zlota.webp";
import cardPlatynaImg from "./assets/icons/card-platynowa.webp";
import cardDiamentImg from "./assets/icons/card-diamentowa.webp";

// 👉 PODMIEŃ TO NA SWOJE WŁASNE HASŁO trybu admina
const ADMIN_PASSWORD = "zmien-to-haslo-123";

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
  { slug: "religijne", label: "Religijne" },
];

function normCategories(categories) {
  return (categories || []).map((c) => (c || "").trim().toLowerCase());
}

const RARITY_INFO = {
  winyl: { label: "Winyl", color: "#aab8c4", icon: "⚪" },
  srebrna: { label: "Srebrna Płyta", color: "#dbe6ee", icon: "⚪" },
  zlota: { label: "Złota Płyta", color: "#ffd66b", icon: "🟡" },
  platynowa: { label: "Platynowa Płyta", color: "#c4b5fd", icon: "🟣" },
  diamentowa: { label: "Diamentowa Płyta", color: "#7dffef", icon: "💎" },
};
const RARITY_ORDER = ["winyl", "srebrna", "zlota", "platynowa", "diamentowa"];

const Vinyl = memo(function Vinyl({ spinning, revealed, progress = 0, showRing = true }) {
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  return (
    <div className="relative flex flex-col items-center">
      {showRing && (
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
      )}      <div
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

// POPRAWKA ROZMIARU 1: Zmniejszony przycisk ze slotem
const SlotButton = memo(function SlotButton({ index, chosen, onPick, label }) {
  return (
    <button
      onClick={() => onPick(index)}
      className="flex items-center justify-center slot-btn"
      style={{
        width: 30,
        height: 48,
        backgroundImage: `url(${timelineSlotFrame})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        border: "none",
        color: chosen === index ? "#fff" : "#4fd6ff",
        fontSize: 13,
        fontWeight: "bold",
        opacity: chosen === index ? 1 : 0.65,
        filter: chosen === index ? "drop-shadow(0 0 6px rgba(79,214,255,0.8))" : "none",
      }}
      title={label}
    >
      +
    </button>
  );
});

// POPRAWKA ROZMIARU 2: Zmniejszona karta osi czasu
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
      className="flex flex-col items-center justify-center text-center select-none"
      style={{
        width: 82,
        height: 64,
        backgroundImage: `url(${timelineCardFrame})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        filter: highlight ? `drop-shadow(0 0 8px ${highlight})` : "none",
        cursor: "pointer",
        touchAction: "manipulation",
        padding: "6% 8%",
      }}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "var(--accent)", lineHeight: 1 }}>{year}</span>
      <span style={{ fontSize: 8, color: "var(--muted)", lineHeight: 1.15, marginTop: 2 }}>
        {artist.length > 14 ? artist.slice(0, 13) + "…" : artist}
      </span>
    </div>
  );
});

const CARD_FRAMES = {
  winyl: cardWinylImg,
  srebrna: cardSrebroImg,
  zlota: cardZlotoImg,
  platynowa: cardPlatynaImg,
  diamentowa: cardDiamentImg,
};

const CollectibleCard = memo(function CollectibleCard({ song, size = 140, onClick }) {
  const rarity = effectiveRarity(song);
  const frame = CARD_FRAMES[rarity] || CARD_FRAMES.winyl;
  const thumbUrl = song.videoId ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg` : null;
  return (
    <div
      onClick={onClick}
      style={{ position: "relative", width: size, aspectRatio: "1024 / 1536", cursor: onClick ? "pointer" : "default", flexShrink: 0 }}
    >
      <img src={frame} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      {thumbUrl && (
        <div style={{ position: "absolute", left: "14%", right: "14%", top: "16.2%", height: "44%", borderRadius: "4%", overflow: "hidden", background: "#0a1420" }}>
          <img src={thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          top: "62.5%",
          height: "25.5%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.11, lineHeight: 1, color: "#dfe9ff", margin: 0 }}>{song.year}</p>
        <p
          style={{
            fontSize: Math.max(6.5, size * 0.032),
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: "#9fb0c8",
            margin: "2px 0 0",
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {song.artist}
        </p>
        <p
          style={{
            fontSize: Math.max(7, size * 0.037),
            color: "#f4eefc",
            margin: "1px 0 0",
            width: "100%",
            lineHeight: 1.15,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {song.title}
        </p>
      </div>
    </div>
  );
});

const REVEAL_GLOW_COLORS = {
  winyl: null,
  srebrna: "rgba(220,230,240,0.55)",
  zlota: "rgba(255,214,107,0.65)",
  platynowa: "rgba(139,92,246,0.7)",
  diamentowa: "rgba(0,230,195,0.85)",
};

const CardBack = memo(function CardBack({ size = 140, glowColor, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        aspectRatio: "1024 / 1536",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        filter: glowColor ? `drop-shadow(0 0 20px ${glowColor}) drop-shadow(0 0 36px ${glowColor})` : "none",
      }}
    >
      <img src={cardRewers} alt="" style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
});

const StatBox = memo(function StatBox({ label, value }) {
  return (
    <div className="rounded-lg px-4 py-3 flex-1" style={{ background: "#0c0c1c", border: "1px solid rgba(79,214,255,0.35)", boxShadow: "0 0 16px rgba(79,214,255,0.15)", minWidth: 110 }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "#4fd6ff" }}>{value}</p>
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

const DAILY_WHEEL_ICON = { hitcoin: "🪙", xp: "⭐", doubleXp: "✨", card: "🃏" };

const DAILY_WHEEL_SEGMENTS_WITH_ANGLES = (() => {
  const angleStep = 360 / DAILY_REWARD_SEGMENTS.length;
  return DAILY_REWARD_SEGMENTS.map((seg, i) => {
    const startAngle = i * angleStep;
    const endAngle = (i + 1) * angleStep;
    return { ...seg, startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 };
  });
})();

const DailyWheel = memo(function DailyWheel({ rotation, spinning }) {
  const gradientStops = DAILY_WHEEL_SEGMENTS_WITH_ANGLES.map((s) => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`).join(", ");
  const size = 260;
  const r = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <div
        style={{
          position: "absolute",
          top: -6,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 4,
          fontSize: 30,
          color: "var(--gold)",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.7))",
        }}
      >
        ▼
      </div>
      <div
        style={{
          position: "absolute",
          inset: -10,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(245,196,81,0.4), transparent 70%)",
          filter: "blur(14px)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          position: "relative",
          background: `conic-gradient(${gradientStops})`,
          border: "5px solid #1a1428",
          boxShadow: "0 0 0 3px rgba(245,196,81,0.6), 0 0 40px rgba(245,196,81,0.4), inset 0 0 24px rgba(0,0,0,0.45)",
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4.2s cubic-bezier(0.12, 0.85, 0.15, 1)" : "none",
          zIndex: 1,
        }}
      >
        {DAILY_WHEEL_SEGMENTS_WITH_ANGLES.map((s) => {
          const rad = (s.midAngle - 90) * (Math.PI / 180);
          const iconR = r * 0.68;
          const x = r + iconR * Math.cos(rad);
          const y = r + iconR * Math.sin(rad);
          return (
            <div
              key={s.id}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: "translate(-50%, -50%)",
                fontSize: 18,
                filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))",
                pointerEvents: "none",
              }}
            >
              {DAILY_WHEEL_ICON[s.type]}
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "#0c0c1c",
          border: "3px solid var(--gold)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          zIndex: 2,
          boxShadow: "0 0 16px rgba(245,196,81,0.6)",
        }}
      >
        🎁
      </div>
    </div>
  );
});

const guestId = getOrCreatePlayerId();

export default function App() {
  const [screen, setScreen] = useState("home");
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
  const [playElapsed, setPlayElapsed] = useState(0);
  const [decisionLeft, setDecisionLeft] = useState(60);
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
  const [authMode, setAuthMode] = useState("login");
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
  const [leaderboardSort, setLeaderboardSort] = useState("gamesWon");
  const [viewingPlayer, setViewingPlayer] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);

  const [librarySongs, setLibrarySongs] = useState(null);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminPage, setAdminPage] = useState(1);
  const ADMIN_PAGE_SIZE = 100;
  const [adminBusy, setAdminBusy] = useState(false);
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);
  const [showDailyWheel, setShowDailyWheel] = useState(false);
  const [dailyWheelBusy, setDailyWheelBusy] = useState(false);
  const [dailyWheelSpinning, setDailyWheelSpinning] = useState(false);
  const [dailyWheelRotation, setDailyWheelRotation] = useState(0);
  const [dailyWheelResult, setDailyWheelResult] = useState(null);
  const [hitRush, setHitRush] = useState(null);
  const [hitRushResult, setHitRushResult] = useState(null);
  const [hitRushLeaderboard, setHitRushLeaderboard] = useState(null);
  const [hitRushLeaderboardPeriod, setHitRushLeaderboardPeriod] = useState("weekly");
  const [showWeeklyChallenges, setShowWeeklyChallenges] = useState(false);
  const [hitRushMenuOpen, setHitRushMenuOpen] = useState(false);
  const [showHitRushFaq, setShowHitRushFaq] = useState(false);
  const hitRushTimerRef = useRef(null);
  const hitRushIframeRef = useRef(null);
  const [adminEditingId, setAdminEditingId] = useState(null);
  const [adminEditDraft, setAdminEditDraft] = useState({});
  const [adminNewSong, setAdminNewSong] = useState({ artist: "", title: "", url: "", year: "", categories: "" });
  const [migrateProgress, setMigrateProgress] = useState(null);
  const [importCsvText, setImportCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [duplicateSongs, setDuplicateSongs] = useState(null);
  const [duplicateScanBusy, setDuplicateScanBusy] = useState(false);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupProgress, setCleanupProgress] = useState(null);
  const [brokenLinkReports, setBrokenLinkReports] = useState(null);
  const [mostPlayedSongs, setMostPlayedSongs] = useState(null);
  const [mostPlayedBusy, setMostPlayedBusy] = useState(false);
  const [poolAnalysis, setPoolAnalysis] = useState(null);
  const [poolAnalysisBusy, setPoolAnalysisBusy] = useState(false);
  const [showLeastPlayed, setShowLeastPlayed] = useState(false);
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

  const LIBRARY_CACHE_KEY = "hitster-library-cache-v3";
  const LIBRARY_CACHE_TTL_MS = 60 * 60 * 1000;

  function saveLibraryCache(songs) {
    try {
      localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ songs, ts: Date.now() }));
    } catch (e) {}
  }

  function ensureLibraryLoaded() {
    if (librarySongs !== null) return;
    setLibrarySongs(undefined);
    try {
      const cached = localStorage.getItem(LIBRARY_CACHE_KEY);
      if (cached) {
        const { songs, ts } = JSON.parse(cached);
        if (Array.isArray(songs) && songs.length > 0 && Date.now() - ts < LIBRARY_CACHE_TTL_MS) {
          setLibrarySongs(songs);
          return;
        }
      }
    } catch (e) {}
    fetchAllSongsFromDb()
      .then((songs) => {
        setLibrarySongs(songs);
        saveLibraryCache(songs);
      })
      .catch(() => setLibrarySongs([]));
  }

  async function getLiveLibraryPool() {
    let pool = librarySongs;
    if (!pool || pool.length === 0) {
      try {
        pool = await fetchAllSongsFromDb();
        setLibrarySongs(pool);
        saveLibraryCache(pool);
      } catch (e) {
        pool = REAL_SONGS;
      }
    } else {
      try {
        const liveCount = await getSongCount();
        if (liveCount !== null && liveCount !== pool.length) {
          pool = await fetchAllSongsFromDb();
          setLibrarySongs(pool);
          saveLibraryCache(pool);
        }
      } catch (e) {}
    }
    return pool;
  }

  async function getDailyFeaturesPool() {
    const pool = await getLiveLibraryPool();
    return pool.filter((s) => !normCategories(s.categories).includes("rap") && !normCategories(s.categories).includes("religijne"));
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
    getSongCount().then((c) => c !== null && setTotalSongCount(c));
  }, []);

  useEffect(() => {
    function loadTournamentInfo() {
      fetchActiveTournament()
        .then((t) => {
          setActiveTournament(t);
          if (!t) fetchLastCompletedTournament().then(setLastCompletedTournament).catch(() => {});
        })
        .catch(() => {});
    }
    loadTournamentInfo();
    const id = setInterval(loadTournamentInfo, 60000);
    return () => clearInterval(id);
  }, []);

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
      if (isChallengeStale(data.createdAt)) return;
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

  const [showDailySong, setShowDailySong] = useState(false);
  const [dailyPlaylistSongs, setDailyPlaylistSongs] = useState(null);
  const [dailyPlaylistAlreadyPlayed, setDailyPlaylistAlreadyPlayed] = useState(null);
  const [dailyPlaylistDailyBoard, setDailyPlaylistDailyBoard] = useState([]);
  const [dailyPlaylistWeeklyBoard, setDailyPlaylistWeeklyBoard] = useState([]);
  const [dailyPlaylistAllTimeBoard, setDailyPlaylistAllTimeBoard] = useState([]);
  const [dailyPlaylistBusy, setDailyPlaylistBusy] = useState(false);
  const [activeTournament, setActiveTournament] = useState(null);
  const [lastCompletedTournament, setLastCompletedTournament] = useState(null);
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
  const [zoomedCard, setZoomedCard] = useState(null);
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
      processWeeklyPlaylistRewardsIfNeeded().catch(() => {});
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
      bumpWeeklyChallengeProgress(user.uid, "dailySongPlays", 1).catch(() => {});
      const xp = 10 + score * 15;
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
        .map((c) => c.trim().toLowerCase())
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
      const fresh = await fetchAllSongsFromDb();
      const dup = fresh.find((s) => s.videoId === videoId);
      if (dup) {
        setError(`Ten utwór już jest w bazie: "${dup.artist} – ${dup.title}" (dodano wcześniej). Duplikat NIE został dodany.`);
        setLibrarySongs(fresh);
        saveLibraryCache(fresh);
        setAdminBusy(false);
        return;
      }
      const added = await addSongToDb({
        videoId,
        artist: adminNewSong.artist.trim(),
        title: adminNewSong.title.trim(),
        year,
        categories: adminNewSong.categories.split(";").map((c) => c.trim().toLowerCase()).filter(Boolean),
      });
      setAdminNewSong({ artist: "", title: "", url: "", year: "", categories: "" });
      const next = [...fresh, added];
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
      const fresh = await fetchAllSongsFromDb();
      const dup = fresh.find((s) => s.videoId === p.videoId);
      if (dup) {
        await rejectProposal(p.id);
        setProposals((prev) => prev.filter((x) => x.id !== p.id));
        setLibrarySongs(fresh);
        saveLibraryCache(fresh);
        setError(`Ten utwór już jest w bazie: "${dup.artist} – ${dup.title}". Propozycja usunięta z kolejki, duplikat NIE został dodany.`);
        setAdminBusy(false);
        return;
      }
      const added = await acceptProposal(p);
      if (p.submittedByUid) {
        recordSongAdded(p.submittedByUid).catch(() => {});
        awardXp(p.submittedByUid, 25).catch(() => {});
      }
      setProposals((prev) => prev.filter((x) => x.id !== p.id));
      const next = [...fresh, added];
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
      const categories = (proposalEditDraft.categoriesText || "").split(";").map((c) => c.trim().toLowerCase()).filter(Boolean);
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

  async function handleAnalyzePool() {
    setPoolAnalysisBusy(true);
    setError("");
    try {
      const fresh = await fetchAllSongsFromDb();
      const total = fresh.length;
      const totalPlays = fresh.reduce((sum, s) => sum + (s.timesPlayed || 0), 0);
      const neverPlayed = fresh.filter((s) => !(s.timesPlayed > 0)).length;
      const sortedAsc = [...fresh].sort((a, b) => (a.timesPlayed || 0) - (b.timesPlayed || 0));
      const sortedDesc = [...fresh].sort((a, b) => (b.timesPlayed || 0) - (a.timesPlayed || 0));
      setPoolAnalysis({
        total,
        totalPlays,
        neverPlayed,
        neverPlayedPct: total > 0 ? Math.round((neverPlayed / total) * 100) : 0,
        avgPlays: total > 0 ? (totalPlays / total).toFixed(2) : "0",
        leastPlayed: sortedAsc.slice(0, 60),
        mostPlayed: sortedDesc.slice(0, 15),
      });
    } catch (e) {
      setError("Błąd analizy puli: " + e.message);
    } finally {
      setPoolAnalysisBusy(false);
    }
  }

  async function handleFindDuplicates() {
    setDuplicateScanBusy(true);
    setError("");
    try {
      const fresh = await fetchAllSongsFromDb();
      setLibrarySongs(fresh);
      saveLibraryCache(fresh);
      const byVideoId = {};
      fresh.forEach((s) => {
        if (!byVideoId[s.videoId]) byVideoId[s.videoId] = [];
        byVideoId[s.videoId].push(s);
      });
      const dupes = Object.values(byVideoId).filter((group) => group.length > 1);
      setDuplicateSongs(dupes);
    } catch (e) {
      setError("Błąd szukania duplikatów: " + e.message);
    } finally {
      setDuplicateScanBusy(false);
    }
  }

  async function handleImportCsv() {
    if (!importCsvText.trim()) return;
    setImportBusy(true);
    setImportResult(null);
    setError("");
    try {
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
      const categories = (brokenLinkEditDraft.categoriesText || "").split(";").map((c) => c.trim().toLowerCase()).filter(Boolean);
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
          setStats(s);
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

  function computeGameEndXp(gameRoom, forPlayerId) {
    if (!gameRoom || gameRoom.practiceMode) return { items: [], total: 0 };
    const items = [{ label: "🎮 Udział w grze", amount: 30 }];
    const won = (gameRoom.winnerIds || []).includes(forPlayerId);
    const winXp = Math.max(100, ((gameRoom.players || []).length - 1) * 100);
    if (won) {
      items.push({ label: `🏆 Wygrana (${gameRoom.players.length} graczy)`, amount: winXp });
    } else if ((gameRoom.players || []).length >= 3) {
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
  const [gameEndReward, setGameEndReward] = useState(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.winnerIds?.length || !user || room.practiceMode) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || xpAwardedRef.current === marker) return;
    xpAwardedRef.current = marker;
    updateHeadToHead(room).catch(() => {});
    if (room.players?.length === 2 && (room.winnerIds || []).includes(playerId)) {
      bumpWeeklyChallengeProgress(user.uid, "duelWins", 1).catch(() => {});
    }
    (async () => {
      try {
        const rewardMarkerRef = doc(db, "gameRewardsProcessed", `${roomId}_${marker}_${user.uid}`);
        let shouldProcess = false;
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(rewardMarkerRef);
          if (snap.exists()) return;
          shouldProcess = true;
          tx.set(rewardMarkerRef, { processedAt: Date.now() });
        });
        if (!shouldProcess) return;

        const { total: baseTotal } = computeGameEndXp(room, playerId);
        const before = await getStats(user.uid);
        const oldXp = before?.xp || 0;
        const oldLevel = levelFromXp(oldXp).level;
        const hadDoubleXp = !!before?.doubleXpNextGame && baseTotal > 0;
        const total = hadDoubleXp ? baseTotal * 2 : baseTotal;
        let grandTotal = total;
        if (total) await awardXp(user.uid, total);
        if (hadDoubleXp) consumeDoubleXpFlag(user.uid).catch(() => {});

        bumpWeeklyChallengeProgress(user.uid, "gamesPlayed", 1).catch(() => {});
        if ((room.winnerIds || []).includes(playerId)) {
          bumpWeeklyChallengeProgress(user.uid, "gamesWon", 1).catch(() => {});
        }
        const myBestStreak = room.gameBestStreaks?.[playerId] || 0;
        if (myBestStreak > 0) bumpWeeklyChallengeProgress(user.uid, "bestStreak", myBestStreak).catch(() => {});

        setMyXp(oldXp + grandTotal);
        const newLevel = levelFromXp(oldXp + grandTotal).level;
        if (newLevel > oldLevel) {
          setLevelUpInfo({ level: newLevel });
          setTimeout(() => setLevelUpInfo(null), 5000);
        }

        const won = (room.winnerIds || []).includes(playerId);
        const myCards = (room.playedCards || []).filter((c) => c.playerId === playerId && !c.bought);
        const perfectGame = (room.target || 0) >= 7 && myCards.length > 0 && myCards.every((c) => c.correct);
        const opponents = room.players.filter((p) => p.authed && p.id !== playerId).map((p) => p.id);
        const nowHour = new Date().getHours();
        const nightGame = nowHour >= 0 && nowHour < 5;
        const frugalFinish = (room.tokens?.[playerId] || 0) >= 5;
        updateAchievementCounters(user.uid, { won, perfectGame, opponents, playerCount: room.players.length, nightGame, frugalFinish }).catch(() => {});

        const hcResult = computeGameEndHitcoin(room, playerId);
        if (hcResult.total) {
          await awardHitcoin(user.uid, hcResult.total);
          setMyHitcoin((prev) => (prev || 0) + hcResult.total);
          bumpWeeklyChallengeProgress(user.uid, "hitcoinEarned", hcResult.total).catch(() => {});
        }
        const pool = await getLiveLibraryPool();
        const drawResult = await drawCardAfterGame(user.uid, pool);
        if (drawResult?.rarity && ["zlota", "platynowa", "diamentowa"].includes(drawResult.rarity)) {
          bumpWeeklyChallengeProgress(user.uid, "cardGoldPlus", 1).catch(() => {});
        }
        setGameEndReward({ hitcoinItems: hcResult.items, hitcoinTotal: hcResult.total, card: drawResult });
      } catch (e) {}
    })();
  }, [screen, room?.winnerIds, toMillis(room?.expireAt), user, playerId]);

  const dailyPlaylistProcessedRef = useRef(null);
  useEffect(() => {
    if (screen !== "gameover" || !room?.dailyPlaylistMode || !user) return;
    const marker = toMillis(room?.expireAt);
    if (!marker || dailyPlaylistProcessedRef.current === marker) return;
    dailyPlaylistProcessedRef.current = marker;
    (async () => {
      try {
        const rewardMarkerRef = doc(db, "gameRewardsProcessed", `${roomId}_${marker}_${user.uid}`);
        let shouldProcess = false;
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(rewardMarkerRef);
          if (snap.exists()) return;
          shouldProcess = true;
          tx.set(rewardMarkerRef, { processedAt: Date.now() });
        });
        if (!shouldProcess) return;

        const score = (room.playedCards || []).filter((c) => c.playerId === playerId && c.correct).length;
        const timeMs = (room.decisionTimes?.[playerId] || []).reduce((a, b) => a + b, 0);
        await recordDailyPlaylistScore(user.uid, name.trim() || user.displayName || "Gracz", room.dailyPlaylistDayKey, score, timeMs);
        let xp = 25;
        if (score === 10) xp += 100;
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
      } catch (e) {}
    })();
  }, [screen, room?.dailyPlaylistMode, toMillis(room?.expireAt), user, playerId]);

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
      } catch (e) {}
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
    getLiveLibraryPool();
    setViewingPlayer({ uid: p.uid, username: p.username, stats: s });
  }

  async function handleSpinDailyWheel() {
    if (!user || !stats || dailyWheelBusy || dailyWheelSpinning) return;
    const today = currentDayKey();
    if (stats.lastDailyHitcoinDate === today) return;
    setDailyWheelBusy(true);
    setError("");
    try {
      const pool = await getLiveLibraryPool();
      const won = await claimDailyWheelReward(user.uid, today, pool);
      if (!won) {
        setDailyWheelBusy(false);
        return;
      }
      const seg =
        DAILY_WHEEL_SEGMENTS_WITH_ANGLES.find((s) => s.id === won.id) ||
        DAILY_WHEEL_SEGMENTS_WITH_ANGLES.find((s) => s.id === "hc50") ||
        DAILY_WHEEL_SEGMENTS_WITH_ANGLES[0];
      const spins = 6;
      const target = dailyWheelRotation + spins * 360 + (360 - seg.midAngle) - (dailyWheelRotation % 360);
      setDailyWheelResult(null);
      setDailyWheelSpinning(true);
      setDailyWheelRotation(target);
      setTimeout(() => {
        setDailyWheelSpinning(false);
        setDailyWheelBusy(false);
        setDailyWheelResult(won);
        setStats((prev) => {
          if (!prev) return prev;
          const next = { ...prev, lastDailyHitcoinDate: today };
          if (won.type === "hitcoin") {
            next.hitcoin = (prev.hitcoin || 0) + won.amount;
            setMyHitcoin((h) => (h || 0) + won.amount);
          } else if (won.type === "xp") {
            next.xp = (prev.xp || 0) + won.amount;
            setMyXp((x) => (x || 0) + won.amount);
          } else if (won.type === "doubleXp") {
            next.doubleXpNextGame = true;
          } else if (won.type === "card" && won.song) {
            next.cardCollection = { ...(prev.cardCollection || {}) };
            next.cardCollection[won.song.id] = (next.cardCollection[won.song.id] || 0) + 1;
          }
          return next;
        });
        bumpWeeklyChallengeProgress(user.uid, "wheelSpins", 1).catch(() => {});
        if (won.type === "hitcoin") bumpWeeklyChallengeProgress(user.uid, "hitcoinEarned", won.amount).catch(() => {});
        if (won.type === "card") bumpWeeklyChallengeProgress(user.uid, "cardGoldPlus", 1).catch(() => {});
      }, 4300);
    } catch (e) {
      setError("Błąd losowania nagrody: " + e.message);
      setDailyWheelBusy(false);
      setDailyWheelSpinning(false);
    }
  }

  function startHitRush() {
    const pool = effectivePool.filter((s) => s.year && s.videoId);
    if (pool.length < 15) {
      setError("Za mało utworów w bazie, żeby uruchomić Hit Rush.");
      return;
    }
    const referenceCard = pool[Math.floor(Math.random() * pool.length)];
    const usedIds = new Set([referenceCard.id]);
    const currentCard = pickNextHitRushSong(pool, referenceCard.year, 0, usedIds);
    if (!currentCard) {
      setError("Nie udało się dobrać utworów do Hit Rush.");
      return;
    }
    usedIds.add(currentCard.id);
    setHitRushResult(null);
    setHitRush({
      pool,
      referenceCard,
      currentCard,
      currentStartSeconds: randomStartSeconds(),
      score: 0,
      combo: 0,
      bestCombo: 0,
      correct: 0,
      wrong: 0,
      usedIds,
      timeLeft: HIT_RUSH_CONFIG.ROUND_SECONDS,
      running: true,
      feedback: null,
      maxDifficulty: "easy",
    });
    setScreen("hitRush");
  }

  function answerHitRush(guess) {
    setHitRush((prev) => {
      if (!prev || !prev.running || prev.feedback) return prev;
      const isCorrect = guess === "earlier" ? prev.currentCard.year < prev.referenceCard.year : prev.currentCard.year > prev.referenceCard.year;
      const newCombo = isCorrect ? prev.combo + 1 : 0;
      const points = isCorrect ? computeHitRushPoints(newCombo) : 0;
      const timeBonus = isCorrect ? checkHitRushTimeBonus(newCombo) : 0;
      return {
        ...prev,
        feedback: { correct: isCorrect, year: prev.currentCard.year, points, timeBonus },
        score: prev.score + points,
        combo: newCombo,
        bestCombo: Math.max(prev.bestCombo, newCombo),
        correct: prev.correct + (isCorrect ? 1 : 0),
        wrong: prev.wrong + (isCorrect ? 0 : 1),
        timeLeft: prev.timeLeft + timeBonus,
        maxDifficulty: isCorrect ? difficultyLabel(newCombo) : prev.maxDifficulty,
      };
    });
    setTimeout(() => {
      setHitRush((prev) => {
        if (!prev || !prev.feedback) return prev;
        const newReference = prev.currentCard;
        const usedIds = new Set(prev.usedIds);
        usedIds.add(newReference.id);
        const nextCard = pickNextHitRushSong(prev.pool, newReference.year, prev.combo, usedIds);
        if (!nextCard) return { ...prev, running: false, timeLeft: 0, feedback: null };
        usedIds.add(nextCard.id);
        return { ...prev, referenceCard: newReference, currentCard: nextCard, currentStartSeconds: randomStartSeconds(), usedIds, feedback: null };
      });
    }, 900);
  }

  async function finishHitRush() {
    if (!hitRush) return;
    const result = { score: hitRush.score, correct: hitRush.correct, wrong: hitRush.wrong, bestCombo: hitRush.bestCombo, maxDifficulty: hitRush.maxDifficulty };
    setHitRushResult({ ...result, pending: true });
    if (user) {
      try {
        const res = await submitHitRushRun(user.uid, result);
        setHitRushResult({ ...result, ...res, pending: false });
        if (res.xpGain) setMyXp((x) => (x || 0) + res.xpGain);
        if (res.hitcoinGain) setMyHitcoin((h) => (h || 0) + res.hitcoinGain);
        bumpWeeklyChallengeProgress(user.uid, "hitRushCombo", result.bestCombo).catch(() => {});
        if (["gold", "platinum", "diamond"].includes(res.rank)) {
          bumpWeeklyChallengeProgress(user.uid, "hitRushGoldPlus", 1).catch(() => {});
        }
        if (res.hitcoinGain) bumpWeeklyChallengeProgress(user.uid, "hitcoinEarned", res.hitcoinGain).catch(() => {});
      } catch (e) {
        setHitRushResult({ ...result, pending: false, saveError: true });
      }
    } else {
      setHitRushResult({ ...result, pending: false, guestNoSave: true });
    }
  }

  useEffect(() => {
    if (!hitRush || !hitRush.running) return;
    const id = setInterval(() => {
      setHitRush((prev) => {
        if (!prev || !prev.running) return prev;
        const timeLeft = prev.timeLeft - 1;
        return { ...prev, timeLeft: Math.max(0, timeLeft), running: timeLeft > 0 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [hitRush?.running]);

  useEffect(() => {
    if (hitRush && !hitRush.running && hitRush.timeLeft === 0 && !hitRushResult) {
      finishHitRush();
    }
  }, [hitRush?.running, hitRush?.timeLeft]);

  function unlockHitRushAudio() {
    const win = hitRushIframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "*");
      win.postMessage(JSON.stringify({ event: "command", func: "setVolume", args: [100] }), "*");
      win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    }
  }

  useEffect(() => {
    if (!hitRush?.currentCard || !hitRush.running) return;
    const t = setTimeout(unlockHitRushAudio, 600);
    return () => clearTimeout(t);
  }, [hitRush?.currentCard?.id, hitRush?.running]);

  async function handleClaimWeeklyChallengeReward(challengeId) {
    if (!user) return;
    try {
      const res = await claimWeeklyChallenge(user.uid, challengeId);
      if (res.ok) {
        setMyXp((x) => (x || 0) + res.xp);
        if (res.hitcoin) setMyHitcoin((h) => (h || 0) + res.hitcoin);
        const s = await getStats(user.uid);
        setStats(s);
      }
    } catch (e) {
      setError("Błąd odbioru nagrody: " + e.message);
    }
  }

  async function loadHitRushLeaderboard(period) {
    setHitRushLeaderboardPeriod(period);
    setHitRushLeaderboard(null);
    try {
      if (period === "weekly") {
        processHitRushWeeklyRewardsIfNeeded().catch((e) => console.error("Błąd rozliczania nagród tygodniowych Hit Rush:", e));
      }
      const list = await fetchHitRushLeaderboard(period);
      setHitRushLeaderboard(list);
    } catch (e) {
      console.error(`Błąd ładowania rankingu Hit Rush (${period}):`, e);
      setHitRushLeaderboard([]);
      setError(`Nie udało się załadować rankingu (${period}): ${e.message}`);
    }
  }

  async function handleAvatarUpload(file) {
    if (!user || !file) return;
    if (!file.type.startsWith("image/")) {
      setError("Wybierz plik obrazu (JPG, PNG itp.).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Zdjęcie jest za duże — maksymalnie 3MB.");
      return;
    }
    setAvatarUploadBusy(true);
    setError("");
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `avatars/${user.uid}.${ext}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await setAvatarUrl(user.uid, url);
      setStats((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
    } catch (e) {
      console.error("Błąd uploadu avatara:", e);
      setError("Błąd wgrywania zdjęcia: " + e.message + " — sprawdź reguły Firebase Storage (Storage → Rules w konsoli Firebase).");
    } finally {
      setAvatarUploadBusy(false);
    }
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

  useEffect(() => {
    setViewedPlayerId(null);
  }, [room?.currentPlayerId]);

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

  const advanceFiredRef = useRef(null);
  const [advanceCountdown, setAdvanceCountdown] = useState(null);
  useEffect(() => {
    const resultAtMs = toMillis(room?.resultAt);
    if (screen !== "roundResult" || !resultAtMs) {
      setAdvanceCountdown(null);
      return;
    }
    const ADVANCE_SECONDS = 5;
    const FALLBACK_EXTRA_MS = 8000;
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

  const OPENER_COUNTDOWN_MS = 3000;
  const OPENER_ANSWER_MS = 20000;
  const OPENER_REVEAL_MS = 5000;
  const [openerPhase, setOpenerPhase] = useState("countdown");
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
          } catch (e) {}
        })();
      }
    };
    tick();
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [screen, toMillis(room?.openerCreatedAt), room?.openerWinnerId, room?.hostId, roomId, playerId]);

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
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        messages: [],
      });
      setRoomId(code);
    } catch (e) {
      setError("Nie udało się stworzyć pokoju: " + e.message);
    } finally {
      setBusy(false);
    }
  }

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
        ? basePool.filter((s) => normCategories(s.categories).some((c) => selectedCategories.includes(c)))
        : basePool.filter((s) => !normCategories(s.categories).includes("religijne"));
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
        expireAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
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
        ? basePool.filter((s) => normCategories(s.categories).some((c) => selectedCategories.includes(c)))
        : basePool.filter((s) => !normCategories(s.categories).includes("religijne"));
      const EXTRA_CARDS_PER_PLAYER = 7;
      const needed = room.players.length * (target + EXTRA_CARDS_PER_PLAYER);
      if (pool.length < needed + 1) {
        const catNote = filterActive ? ` w wybranych kategoriach (${selectedCategories.join(", ")})` : "";
        setError(`Za mało utworów${catNote} (masz ${pool.length}, potrzeba ${needed + 1}: (${target}+${EXTRA_CARDS_PER_PLAYER}) × ${room.players.length} graczy + 1 na rundę otwierającą).`);
        setBusy(false);
        return;
      }
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
        if (index !== data.openerCorrectIndex) return;
        tx.update(ref, {
          openerWinnerId: playerId,
          openerResolvedAt: serverTimestamp(),
        });
      });
    } catch (e) {
      setError("Błąd rundy otwierającej: " + e.message);
    }
  }

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
      if (user) awardXp(user.uid, 10).catch(() => {});
    } catch (e) {}
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
        if (data.status !== "playing") return;
        const timeline = data.timelines[data.currentPlayerId] || [];
        const sorted = [...timeline].sort((a, b) => a.year - b.year);
        const before = sorted[chosenSlot - 1];
        const after = sorted[chosenSlot];
        const card = data.currentCard;
        const correct = (!before || before.year <= card.year) && (!after || card.year <= after.year);
        const newTimelines = { ...data.timelines };
        if (correct) newTimelines[data.currentPlayerId] = [...timeline, card];
        capturedResult = { correct, card, practiceMode: !!data.practiceMode };

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
          let xp = 10;
          if (capturedResult.newPlacementStreak === 5) xp += 15;
          awardXp(user.uid, xp).catch(() => {});
        }
      }
      if (user && instantGuessAwardedTo === user.uid && !capturedResult?.practiceMode) {
        recordSuccessfulGuess(user.uid, capturedResult?.card?.videoId, capturedResult?.card?.year).catch(() => {});
        bumpWeeklyChallengeProgress(user.uid, "guessesCorrect", 1).catch(() => {});
        let xp = 20;
        if (capturedResult.newGuessStreak === 5) xp += 30;
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
        if (data.status !== "playing") return;
        if ((data.tokens?.[data.currentPlayerId] || 0) < BUY_CARD_TOKENS) return;
        if (data.deckIndex >= data.deck.length) return;

        const boughtCard = data.deck[data.deckIndex];
        capturedBought = boughtCard;
        const timeline = data.timelines[data.currentPlayerId] || [];
        const newTimelines = { ...data.timelines, [data.currentPlayerId]: [...timeline, boughtCard] };

        const prevStreak = data.gameStreaks?.[data.currentPlayerId] || 0;
        const newStreak = prevStreak + 1;
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
    if (playerId === room.currentPlayerId) return;
    if (room.votes && room.votes[playerId] !== undefined) return;
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
        bumpWeeklyChallengeProgress(awardedGuessTo, "guessesCorrect", 1).catch(() => {});
        let xp = 20;
        if (newGuessStreakValue === 5) xp += 30;
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
    if (room.lastBoughtCard.playerId === playerId) return;
    const buyerName = room.players.find((p) => p.id === room.lastBoughtCard.playerId)?.name;
    setSharedBoughtNotice({ name: buyerName, card: room.lastBoughtCard.card });
    setTimeout(() => setSharedBoughtNotice(null), 4000);
  }, [toMillis(room?.lastBoughtCard?.at)]);

  const brokenLinkFiredRef = useRef(null);
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
        if (data.status !== "playing") return;
        if (!data.currentCard || data.currentCard.id !== card.id) return;
        if (data.deckIndex >= data.deck.length) return;
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
    } catch (e) {}
  }

  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById("youtube-iframe-api-script")) return;
    const tag = document.createElement("script");
    tag.id = "youtube-iframe-api-script";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }, []);

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
                setTimeout(() => {
                  if (!cancelled) createValidator();
                }, 2500);
              } else {
                handleBrokenLink(currentCard);
              }
            },
          },
        });
      } catch (e) {}
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
        if (data.deckIndex >= data.deck.length) return;
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
        if (data.status !== "playing") return;
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
    } catch (e) {}
  }

  async function nextRound() {
    setBusy(true);
    try {
      const ref = doc(db, "rooms", roomId);
      let gameOverInfo = null;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data();
        if (data.status !== "roundResult") return;
        const players = data.players;
        const idx = players.findIndex((p) => p.id === data.currentPlayerId);
        const nextIdx = (idx + 1) % players.length;

        const someoneReachedTarget = Object.values(data.timelines).some((t) => t.length >= data.target);
        const finishingRound = data.finishingRound || someoneReachedTarget;
        const deckExhausted = data.deckIndex >= data.deck.length;

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
            expireAt: new Date(Date.now() + 60 * 60 * 1000),
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
    } catch (e) {}
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
      <div id="broken-link-validator" style={{ position: "fixed", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", top: -9999 }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap');
        :root {
          --bg: #05060d; --surface: rgba(12,12,28,0.92); --surface2: rgba(18,18,42,0.95);
          --accent: #4fd6ff; --accent2: #8b5cf6; --accent3: #ff5fc9; --gold: #f5c451;
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
        @keyframes reveal-glow-burst {
          0% { opacity: 0; transform: scale(0.6); }
          40% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.5); }
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

        .hs-wrap { position: relative; }
        .hs-bg { content: ""; position: fixed; inset: 0; height: 100vh; background: url(${homeBg}) center top / cover no-repeat; opacity: 0.5; z-index: 0; pointer-events: none; -webkit-mask-image: linear-gradient(to bottom, black 45%, transparent 85%); mask-image: linear-gradient(to bottom, black 45%, transparent 85%); }
        .hs-content { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; }
        .hs-hero-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 16px; }
        .hs-hero-left {
          border-radius: 18px; background: #100a1cdd; border: 1px solid rgba(180,120,255,0.5);
          box-shadow: 0 0 40px rgba(139,92,246,0.35); padding: 22px 26px; display: flex; flex-direction: column; justify-content: center;
        }
        .hs-hero-right {
          position: relative; border-radius: 18px; overflow: hidden;
          background: #100a1c url(${heroBanner}) center / 100% 100% no-repeat;
          aspect-ratio: 1738 / 905; padding: 26px; display: flex; flex-direction: column; justify-content: center;
        }
        .hs-eyebrow { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #b98bff; margin-bottom: 6px; font-weight: 700; }
        .hs-h1 { font-family: 'Bebas Neue', sans-serif; font-size: 30px; margin: 0 0 6px; line-height: 1.1; }
        .hs-h1 span { color: var(--accent3); }
        .hs-sub { color: #b8b8d0; font-size: 12px; margin: 0 0 16px; }
        .hs-btn-wrap { position: relative; height: 52px; max-width: 280px; }
        .hs-cut { clip-path: polygon(15px 0, calc(100% - 15px) 0, 100% 15px, 100% calc(100% - 15px), calc(100% - 15px) 100%, 15px 100%, 0 calc(100% - 15px), 0 15px); }
        .hs-glow { position: absolute; inset: -4px; border-radius: 16px; background: linear-gradient(90deg,#ee17f8,#7d1de8,#2a68f9); filter: blur(20px); opacity: 0.65; }
        .hs-rim { position: absolute; inset: 0; background: linear-gradient(90deg,#ff8bf0,#b18bff,#7fd4ff); }
        .hs-fillbtn { position: absolute; inset: 1.5px; background: linear-gradient(90deg,#c60ee0,#5d0dd0,#0e4ce8); transition: filter 0.15s ease; overflow: hidden; }
        .hs-fillbtn::after { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 55%; background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 100%); }
        .hs-btn-wrap:hover .hs-fillbtn { filter: brightness(1.15); }
        .hs-btnlabel { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: 'Bebas Neue', sans-serif; font-size: 17px; letter-spacing: 0.5px; z-index: 3; color: #fff; }
        .hs-join-row { display: flex; gap: 8px; margin-top: 18px; }
        .hs-input {
          height: 38px; border-radius: 0 !important; background: #0e0e22 !important;
          border: 1.3px solid rgba(79,214,255,0.6) !important; color: #fff; font-size: 12px;
          clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
        }
        .hs-input:focus { border-color: #4fd6ff !important; }
        .hs-join-btn {
          height: 38px; padding: 0 16px; border: 1.3px solid #4fd6ff; cursor: pointer;
          font-size: 12px; font-weight: 800; letter-spacing: 0.3px; color: #4fd6ff; white-space: nowrap;
          background: rgba(79,214,255,0.1);
          clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
        }
        .hs-join-btn:hover { background: rgba(79,214,255,0.2); }
        .hs-tiles-row { display: flex; align-items: stretch; gap: 12px; flex-wrap: wrap; }
        .hs-tile-slot { position: relative; flex: 1; min-width: 140px; height: 104px; }
        .hs-tile-glow { position: absolute; inset: -8px; filter: blur(16px); opacity: 0.55; border-radius: 12px; z-index: 0; }
        .hs-tile-rim {
          position: absolute; inset: 0; z-index: 1;
          clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
        }
        .hs-tile {
          position: absolute; inset: 1.5px; z-index: 2; border: none; padding: 10px 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          text-align: center; gap: 4px; background: #0c0c1c;
          clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
        }
        .hs-tile img.hs-icon { height: 58px; }
        .hs-tile .hs-t { font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: 0.5px; color: #fff; }
        .hs-tile .hs-d { font-size: 10px; color: #9d9db8; }
        .hs-tile-slot.cyan .hs-tile-glow, .hs-tile-slot.cyan .hs-tile-rim { background: #4fd6ff; }
        .hs-tile-slot.pink .hs-tile-glow, .hs-tile-slot.pink .hs-tile-rim { background: #ff5fc9; }
        .hs-tile-slot.violet .hs-tile-glow, .hs-tile-slot.violet .hs-tile-rim { background: #a56bff; }
        .hs-tile-slot.gold .hs-tile-glow, .hs-tile-slot.gold .hs-tile-rim { background: #f5c451; }
        .hs-tile-slot.gold .hs-t { color: #ffcf6b; }
        .hs-tile-slot.green .hs-tile-glow, .hs-tile-slot.green .hs-tile-rim { background: #2af598; }
        .hs-tile-slot.green .hs-t { color: #7dffc4; }
        .hs-badge {
          position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(90deg,#f5c451,#ffb020); color: #3a2400; font-size: 8px; font-weight: 900;
          letter-spacing: 0.4px; padding: 2px 9px; border-radius: 999px; white-space: nowrap; z-index: 2;
        }
        .hs-arrow {
          position: absolute; bottom: 8px; right: 8px; width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;
          background: rgba(255,255,255,0.06); border: 1px solid currentColor;
        }
        .hs-side-card { border-radius: 12px; background: #0c0c1cdd; border: 1px solid #2a2a4a; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
        .hs-stats-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
        .hs-stat-tile {
          border-radius: 10px; padding: 12px 12px; min-height: 78px; background: #0c0c1cdd;
          border: 1.5px solid; display: flex; align-items: center; gap: 10px; text-align: left;
        }
        .hs-stat-tile img { height: 30px; flex-shrink: 0; }
        .hs-stat-tile .hs-lbl { font-size: 10px; color: #9d9db8; text-transform: uppercase; letter-spacing: 0.5px; }
        .hs-stat-tile .hs-val { font-size: 17px; font-weight: 800; font-family: 'Bebas Neue', sans-serif; }
        .hs-xp-bar { width: 42px; height: 5px; border-radius: 4px; background: rgba(255,255,255,0.15); overflow: hidden; display: inline-block; vertical-align: middle; }
        .hs-xp-bar > div { height: 100%; background: linear-gradient(90deg,#4f8cff,#8b5cf6); }

        .hs-bottom-nav { display: none; }
        @media (max-width: 860px) {
          .hs-bottom-nav {
            display: flex; justify-content: space-around; align-items: center;
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
            background: rgba(8,8,18,0.94); border-top: 1px solid #26264a;
            backdrop-filter: blur(6px); padding: 8px 6px calc(8px + env(safe-area-inset-bottom));
          }
          .hs-nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; padding: 0; position: relative; }
          .hs-nav-item img { height: 22px; filter: grayscale(1) brightness(1.7) opacity(0.5); }
          .hs-nav-item span { font-size: 9px; color: #7d7d96; font-weight: 700; }
          .hs-nav-item.active img { filter: none; }
          .hs-nav-item.active span { color: #ff5fc9; }
          .hs-nav-item.active::after { content: ""; position: absolute; bottom: -8px; width: 22px; height: 3px; border-radius: 2px; background: linear-gradient(90deg,#ff5fc9,#4f8cff); left: 50%; transform: translateX(-50%); }
          .hs-page { padding-bottom: 70px; }
        }
        .hs-footer-full { width: 100%; height: 78px; background: url(${footerStrip}) center / contain no-repeat; margin-top: 4px; }

        @media (max-width: 860px) {
          .hs-hero-grid { grid-template-columns: 1fr; }
          .hs-hero-right { aspect-ratio: auto; min-height: 170px; }
          .hs-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .hs-tiles-row { flex-wrap: wrap; }
          .hs-tile-slot { min-width: calc(50% - 6px); flex: 0 0 calc(50% - 6px); height: 118px; }
          .hs-tile img.hs-icon { height: 54px; }
          .hs-h1 { font-size: 24px; }
        }
      `}</style>

      <div className="w-full flex flex-col items-center hs-page" style={{ maxWidth: screen === "home" ? 1200 : 720 }}>
        <div className="w-full" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <button onClick={goHome} className="flex items-center gap-2" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }} title="Strona główna">
            <img src={logoImg} alt="" style={{ height: 56 }} />
            <span
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24,
                letterSpacing: 0.5,
                background: "linear-gradient(90deg, #ff8bec, #7fb8ff)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 8px rgba(255,95,201,0.5))",
              }}
            >
              HITSTERIADA
            </span>
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowOnlineList((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#12122a", border: "1px solid #1fd97a", color: "#7dffb0", fontSize: 12, cursor: "pointer" }}
          >
            🟢 {onlinePlayers.length} online
          </button>
          {user && myXp !== null && (
            <button
              onClick={screen === "home" ? openStats : undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 999, background: "#12122a", border: "1px solid var(--accent)", color: "var(--accent)", fontSize: 12, cursor: screen === "home" ? "pointer" : "default", fontFamily: "'Bebas Neue', sans-serif" }}
            >
              ⭐ LVL {levelFromXp(myXp).level}
              <span className="hs-xp-bar"><div style={{ width: `${Math.round((levelFromXp(myXp).currentLevelXp / levelFromXp(myXp).xpForNextLevel) * 100)}%` }} /></span>
            </button>
          )}
          {user && stats && (
            <button
              onClick={screen === "home" ? openStats : undefined}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#12122a", border: "1px solid #a56bff", color: "#c9a8ff", fontSize: 12, cursor: screen === "home" ? "pointer" : "default" }}
            >
              ♪ {stats.guessesCorrect || 0}
            </button>
          )}
          {user && myHitcoin !== null && (
            <button
              onClick={screen === "home" ? () => setScreen("packShop") : undefined}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, background: "#12122a", border: "1px solid var(--gold)", color: "var(--gold)", fontSize: 12, cursor: screen === "home" ? "pointer" : "default" }}
            >
              <img src={iconHitcoin} alt="" style={{ height: 14 }} /> {myHitcoin}
            </button>
          )}
          {user && (
            <button
              onClick={screen === "home" ? openStats : undefined}
              title={user.displayName}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: stats?.avatarUrl ? `url(${stats.avatarUrl}) center/cover no-repeat` : "linear-gradient(135deg,#ff5fc9,#4f8cff)",
                border: "2px solid rgba(255,255,255,0.4)",
                cursor: screen === "home" ? "pointer" : "default",
                flexShrink: 0,
              }}
            />
          )}
        </div>

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
          <div className="w-full flex flex-col gap-5 hs-subview">
            <section className="w-full rounded-2xl p-5" style={{ background: "#0c0c1c", border: "1px solid rgba(79,214,255,0.4)", boxShadow: "0 0 30px rgba(79,214,255,0.18)" }}>
              <div className="flex items-center gap-3 mb-3">
                <label style={{ position: "relative", cursor: user ? "pointer" : "default", flexShrink: 0 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: stats?.avatarUrl ? `url(${stats.avatarUrl}) center/cover no-repeat` : "linear-gradient(135deg,#ff5fc9,#4f8cff)",
                      border: "2px solid rgba(255,255,255,0.4)",
                      opacity: avatarUploadBusy ? 0.5 : 1,
                    }}
                  />
                  {user && (
                    <>
                      <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, border: "2px solid #0c0c1c" }}>
                        📷
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={avatarUploadBusy}
                        onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                      />
                    </>
                  )}
                </label>
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24 }}>TWOJE STATYSTYKI</h2>
              </div>
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
                        onClick={() => {
                          if (alreadyClaimed) return;
                          setShowDailyWheel(true);
                        }}
                        disabled={alreadyClaimed}
                        className="w-full rounded-2xl p-4 flex items-center justify-between"
                        style={{ background: "#0c0c1c", border: `1.3px solid ${alreadyClaimed ? "#33294f" : "var(--gold)"}`, boxShadow: alreadyClaimed ? "none" : "0 0 22px rgba(245,196,81,0.4)", opacity: alreadyClaimed ? 0.6 : 1 }}
                      >
                        <div className="text-left">
                          <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: alreadyClaimed ? "var(--muted)" : "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
                            🎡 Nagroda dnia
                          </p>
                          <p style={{ fontSize: 11, color: "var(--muted)" }}>{alreadyClaimed ? "Odebrane — wróć jutro" : "Kliknij, żeby zakręcić kołem"}</p>
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
                        className="w-full rounded-2xl p-4 flex items-center justify-between"
                        style={{ background: "#0c0c1c", border: "1.3px solid var(--gold)", boxShadow: "0 0 22px rgba(245,196,81,0.4)" }}
                      >
                        <div className="text-left flex items-center gap-3">
                          <img src={glMedal} alt="" style={{ height: 32 }} />
                          <div>
                            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--gold)" }}>Osiągnięcia</p>
                            <p style={{ fontSize: 11, color: "var(--muted)" }}>
                              {claimedCount}/{progress.length} odebranych
                              {unclaimed.length > 0 ? ` · ${unclaimed.length} czeka na odbiór!` : ""}
                            </p>
                          </div>
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
                    className="w-full rounded-2xl p-4 flex items-center justify-between"
                    style={{ background: "#0c0c1c", border: "1.3px solid #4fd6ff", boxShadow: "0 0 22px rgba(79,214,255,0.4)" }}
                  >
                    <div className="text-left flex items-center gap-3">
                      <img src={glKolekcja} alt="" style={{ height: 32 }} />
                      <div>
                        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#4fd6ff" }}>Album</p>
                        <p style={{ fontSize: 11, color: "var(--muted)" }}>{Object.keys(stats.cardCollection || {}).length} unikalnych kart</p>
                      </div>
                    </div>
                    <span style={{ color: "#7dffef", fontSize: 22 }}>→</span>
                  </button>
                  {(() => {
                    const challenges = getWeeklyChallenges(stats);
                    const doneCount = challenges.filter((c) => c.claimed).length;
                    return (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => setShowWeeklyChallenges((v) => !v)}
                          className="w-full flex items-center justify-between"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                        >
                          <span style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                            🎯 Wyzwania tygodnia ({doneCount}/5)
                          </span>
                          <span style={{ color: "var(--muted)", fontSize: 14 }}>{showWeeklyChallenges ? "▲" : "▼"}</span>
                        </button>
                        {showWeeklyChallenges &&
                          challenges.map((c) => {
                          const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
                          return (
                            <div
                              key={c.id}
                              className="w-full rounded-xl p-3"
                              style={{ background: "#0c0c1c", border: `1px solid rgba(165,107,255,${c.claimed ? 0.15 : 0.35})`, boxShadow: c.claimed ? "none" : "0 0 16px rgba(165,107,255,0.15)", opacity: c.claimed ? 0.6 : 1 }}
                            >
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <span style={{ fontSize: 12, fontWeight: "bold" }}>{c.desc}</span>
                                {c.claimed ? (
                                  <span style={{ fontSize: 11, color: "var(--good)", flexShrink: 0 }}>✓ Odebrane</span>
                                ) : c.done ? (
                                  <button
                                    onClick={() => handleClaimWeeklyChallengeReward(c.id)}
                                    style={{ fontSize: 11, fontWeight: "bold", color: "#3a2400", background: "var(--gold)", borderRadius: 8, padding: "3px 10px", flexShrink: 0 }}
                                  >
                                    Odbierz +{c.xp} XP{c.hitcoin ? ` +${c.hitcoin} 🪙` : ""}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>
                                    {Math.min(c.progress, c.target)} / {c.target}
                                  </span>
                                )}
                              </div>
                              {!c.claimed && (
                                <div className="w-full rounded-full" style={{ height: 6, background: "#0d0a17", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: c.done ? "var(--good)" : "var(--accent2)" }} />
                                </div>
                              )}
                            </div>
                          );
                        })}
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
                    <StatBox
                      label="Rekordowy streak"
                      value={
                        <span className="flex items-center gap-1.5">
                          {stats.longestStreak || 0} <img src={achSeria} alt="" style={{ height: 20 }} />
                        </span>
                      }
                    />
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
              <section className="w-full rounded-2xl p-5" style={{ background: "#0c0c1c", border: "1px solid rgba(255,95,201,0.4)", boxShadow: "0 0 30px rgba(255,95,201,0.15)" }}>
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
              style={{ background: "#0c0c1c", border: "1px solid rgba(79,214,255,0.35)", color: "#4fd6ff" }}
            >
              ← Wróć
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
                <section className="w-full rounded-2xl p-5" style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.4)", boxShadow: "0 0 26px rgba(245,196,81,0.18)" }}>
                  <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 4, color: "var(--gold)", display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={achOsiagniecia} alt="" style={{ height: 28 }} /> OSIĄGNIĘCIA ({claimedCount}/{progress.length})
                  </h2>

                  {unclaimed.length > 0 && (
                    <div className="flex flex-col gap-2 mb-4 mt-3">
                      <p style={{ fontSize: 11, color: "var(--good)", textTransform: "uppercase" }}>Do odebrania!</p>
                      {unclaimed.map((a) => (
                        <div key={a.id} className="flex items-center justify-between rounded-lg p-2.5" style={{ background: "rgba(42,245,152,0.1)", border: "1px solid var(--good)" }}>
                          <div className="flex items-center gap-2.5">
                            <img src={achDoOdebrania} alt="" style={{ height: 26 }} />
                            <div>
                              <p style={{ fontSize: 13, fontWeight: "bold" }}>{a.name}</p>
                              <p style={{ fontSize: 11, color: "var(--muted)" }}>{a.desc}</p>
                            </div>
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
                      <details key={cat} className="rounded-lg" style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.2)" }}>
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
                              <span className="flex items-center gap-1.5">
                                <img src={a.claimed ? achOdebrane : a.qualifies ? achDoOdebrania : achZablokowane} alt="" style={{ height: 16 }} /> {a.name}
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
              style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.35)", color: "var(--gold)" }}
            >
              ← Wróć
            </button>
          </div>
        )}

        {screen === "home" && showLeaderboard && !viewingPlayer && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.4)", boxShadow: "0 0 26px rgba(245,196,81,0.18)" }}>
              <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, marginBottom: 12, color: "var(--gold)" }}>RANKING GRACZY</h2>
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
                      style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.2)" }}
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
              style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.35)", color: "var(--gold)" }}
            >
              ← Wróć
            </button>
          </div>
        )}

        {screen === "home" && showLeaderboard && viewingPlayer && (
          <div className="w-full flex flex-col gap-5">
            <section className="w-full rounded-2xl p-5" style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.4)", boxShadow: "0 0 26px rgba(245,196,81,0.18)" }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: viewingPlayer.stats?.avatarUrl ? `url(${viewingPlayer.stats.avatarUrl}) center/cover no-repeat` : "linear-gradient(135deg,#ff5fc9,#4f8cff)",
                    border: "2px solid rgba(255,255,255,0.4)",
                    flexShrink: 0,
                  }}
                />
                <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "var(--gold)" }}>{viewingPlayer.username}</h2>
              </div>
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
                    <StatBox
                      label="Rekordowy streak"
                      value={
                        <span className="flex items-center gap-1.5">
                          {viewingPlayer.stats.longestStreak || 0} <img src={achSeria} alt="" style={{ height: 20 }} />
                        </span>
                      }
                    />
                    <StatBox label="🎧 Odgadnięte wykonawcy/tytuły" value={viewingPlayer.stats.guessesCorrect || 0} />
                    <StatBox label="📀 Dodane do bazy" value={viewingPlayer.stats.songsAdded || 0} />
                  </div>
                  <div>
                    <p style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", marginBottom: 8 }}>Kolekcja kart</p>
                    <div className="flex flex-wrap gap-3">
                      {(() => {
                        const owned = viewingPlayer.stats.cardsByRarity || {};
                        const totals = {};
                        RARITY_ORDER.forEach((r) => (totals[r] = 0));
                        effectivePool.forEach((s) => {
                          totals[effectiveRarity(s)]++;
                        });
                        const totalOwned = RARITY_ORDER.reduce((sum, r) => sum + (owned[r] || 0), 0);
                        const totalAll = RARITY_ORDER.reduce((sum, r) => sum + totals[r], 0);
                        return (
                          <>
                            <StatBox label="Łącznie" value={`${totalOwned}/${totalAll}`} />
                            {RARITY_ORDER.map((r) => (
                              <StatBox
                                key={r}
                                label={<span style={{ color: RARITY_INFO[r].color }}>{RARITY_INFO[r].icon} {RARITY_INFO[r].label}</span>}
                                value={`${owned[r] || 0}/${totals[r]}`}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </div>
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
              style={{ background: "#0c0c1c", border: "1px solid rgba(245,196,81,0.35)", color: "var(--gold)" }}
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

            <section className="w-full rounded-2xl p-4" style={{ background: "#0c0c1c", border: "1px solid rgba(255,95,201,0.4)", boxShadow: "0 0 22px rgba(255,95,201,0.15)" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🔬 Analiza puli losowania</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Sprawdza, czy losowanie faktycznie korzysta z całej biblioteki, czy jakaś jej część nigdy (albo prawie nigdy) nie wypada.
                Pokazuje pełną listę utworów od najrzadziej granych — przejrzyj ją i sprawdź, czy skupiają się tam akurat starsze utwory.
              </p>
              <button
                onClick={handleAnalyzePool}
                disabled={poolAnalysisBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid #ff5fc9", color: "#ff5fc9" }}
              >
                {poolAnalysisBusy ? "Analizuję…" : "Analizuj pulę"}
              </button>
              {poolAnalysis && (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <p style={{ fontSize: 18, fontWeight: "bold" }}>{poolAnalysis.total}</p>
                      <p style={{ fontSize: 10, color: "var(--muted)" }}>UTWORÓW W BAZIE</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <p style={{ fontSize: 18, fontWeight: "bold", color: poolAnalysis.neverPlayedPct > 50 ? "var(--bad)" : "var(--text)" }}>
                        {poolAnalysis.neverPlayed} ({poolAnalysis.neverPlayedPct}%)
                      </p>
                      <p style={{ fontSize: 10, color: "var(--muted)" }}>NIGDY NIE WYPADŁO</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <p style={{ fontSize: 18, fontWeight: "bold" }}>{poolAnalysis.totalPlays}</p>
                      <p style={{ fontSize: 10, color: "var(--muted)" }}>WSZYSTKICH ODTWORZEŃ</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface2)" }}>
                      <p style={{ fontSize: 18, fontWeight: "bold" }}>{poolAnalysis.avgPlays}</p>
                      <p style={{ fontSize: 10, color: "var(--muted)" }}>ŚREDNIO/UTWÓR</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowLeastPlayed((v) => !v)}
                    className="px-3 py-2 rounded-lg text-xs font-bold self-start"
                    style={{ background: "var(--surface2)", border: "1px solid #ff5fc9", color: "#ff5fc9" }}
                  >
                    {showLeastPlayed ? "Ukryj" : "Pokaż"} 60 najrzadziej granych
                  </button>
                  <div>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Dla porównania — 15 NAJCZĘŚCIEJ granych:</p>
                    <div className="flex flex-col gap-1">
                      {poolAnalysis.mostPlayed.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs" style={{ padding: "3px 0", borderBottom: "1px solid #1a1428" }}>
                          <span>
                            {s.artist} — {s.title}
                            {s.addedAt ? (
                              <span style={{ color: "var(--muted)" }}> · dodano {new Date(s.addedAt).toLocaleDateString("pl-PL")}</span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontStyle: "italic" }}> · starszy wpis</span>
                            )}
                          </span>
                          <span style={{ color: "var(--good)" }}>{s.timesPlayed || 0}×</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {showLeastPlayed && (
                    <div className="flex flex-col gap-1" style={{ maxHeight: 400, overflowY: "auto" }}>
                      {poolAnalysis.leastPlayed.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-xs" style={{ padding: "3px 0", borderBottom: "1px solid #1a1428" }}>
                          <span>
                            {s.artist} — {s.title} <span style={{ color: "var(--muted)" }}>({s.year})</span>
                            {s.addedAt ? (
                              <span style={{ color: "var(--muted)" }}> · dodano {new Date(s.addedAt).toLocaleDateString("pl-PL")}</span>
                            ) : (
                              <span style={{ color: "var(--muted)", fontStyle: "italic" }}> · data dodania nieznana (starszy wpis)</span>
                            )}
                          </span>
                          <span style={{ color: (s.timesPlayed || 0) === 0 ? "var(--bad)" : "var(--muted)" }}>{s.timesPlayed || 0}×</span>
                        </div>
                      ))}
                    </div>
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

            <section className="w-full rounded-2xl p-4" style={{ background: "#0c0c1c", border: "1px solid rgba(255,95,201,0.4)", boxShadow: "0 0 22px rgba(255,95,201,0.15)" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>🔁 Znajdź duplikaty</p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                Ten sam utwór dodany do bazy dwa razy (np. ręcznie i przez propozycję) ma podwójną szansę na wylosowanie w każdej talii —
                niewidoczne "faworyzowanie" niektórych piosenek. Skanuje pełną bibliotekę i pokazuje, co się powtarza; usuwanie zrób ręcznie
                poniżej (przycisk 🗑 przy utworze), żeby na pewno zostawić właściwą kopię.
              </p>
              <button
                onClick={handleFindDuplicates}
                disabled={duplicateScanBusy}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--surface2)", border: "1px solid #ff5fc9", color: "#ff5fc9" }}
              >
                {duplicateScanBusy ? "Skanuję..." : "Skanuj bibliotekę"}
              </button>
              {duplicateSongs !== null && (
                <div className="mt-3 flex flex-col gap-2">
                  {duplicateSongs.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--good)" }}>✓ Brak duplikatów — każdy utwór jest w bazie tylko raz.</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 12, color: "#ff5fc9", fontWeight: "bold" }}>
                        Znaleziono {duplicateSongs.length} zduplikowanych utworów ({duplicateSongs.reduce((sum, g) => sum + g.length - 1, 0)} nadmiarowych kopii):
                      </p>
                      {duplicateSongs.map((group) => (
                        <div key={group[0].videoId} className="rounded-lg p-2" style={{ background: "var(--surface2)" }}>
                          <p style={{ fontSize: 12, fontWeight: "bold" }}>
                            {group[0].artist} – {group.map((s) => s.title).join(" / ")} ({group.length}×)
                          </p>
                          <p style={{ fontSize: 10, color: "var(--muted)" }}>videoId: {group[0].videoId}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {group.map((s) => (
                              <button
                                key={s.id}
                                onClick={async () => {
                                  await handleAdminDelete(s.id);
                                  setDuplicateSongs((prev) =>
                                    prev
                                      .map((g) => g.filter((x) => x.id !== s.id))
                                      .filter((g) => g.length > 1)
                                  );
                                }}
                                className="px-2 py-1 rounded text-xs"
                                style={{ background: "var(--surface)", border: "1px solid var(--bad)", color: "var(--bad)" }}
                              >
                                🗑 usuń "{s.title}" ({s.year})
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
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
                                    categoriesText: