import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Home,
  Disc3,
  BarChart3,
  Crown,
  Menu,
  Lock,
  LogIn,
  UserPlus,
  Users,
  Trophy,
  ShoppingCart,
  Medal,
  Music2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  X,
  Camera,
  Flame,
  Gift,
  Sparkles,
  CheckCircle2,
  Gamepad2,
  Send,
  Info,
  Settings,
} from 'lucide-react';

import logoImg from './assets/logo-v2.png';
import homeBg from './assets/home/bg.jpg';
import heroMobile from './assets/home/hero-mobile-generated.png';
import glTrening from './assets/icons/gl-trening.png';
import glHitRush from './assets/icons/gl-hitrush.png';
import glPiosenka from './assets/icons/gl-piosenka.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glTurniej from './assets/icons/gl-turniej.png';
import glKolekcja from './assets/icons/gl-kolekcja.png';
import glStatystyki from './assets/icons/gl-statystyki.png';
import glMedal from './assets/icons/gl-medal.png';
import glKorona from './assets/icons/gl-korona.png';
import glKoszyk from './assets/icons/gl-koszyk.png';
import glOsoba from './assets/icons/gl-osoba.png';
import glPrezent from './assets/icons/gl-prezent.png';
import iconHitcoin from './assets/icons/icon-hitcoin.png';
import packPodstawowa from './assets/icons/pack-podstawowa.webp';
import packRozszerzona from './assets/icons/pack-rozszerzona.webp';
import packPremium from './assets/icons/pack-premium.webp';
import achDoOdebrania from './assets/icons/ach-doodebrania.png';
import achOdebrane from './assets/icons/ach-odebrane.png';
import achZablokowane from './assets/icons/ach-zablokowane.png';
import cardWinylImg from './assets/icons/card-winyl.webp';
import cardSrebroImg from './assets/icons/card-srebro.webp';
import cardZlotoImg from './assets/icons/card-zlota.webp';
import cardPlatynaImg from './assets/icons/card-platynowa.webp';
import cardDiamentImg from './assets/icons/card-diamentowa.webp';
import cardRewersImg from './assets/icons/card-rewers-v2.webp';
import { effectiveRarity } from './cards.js';
import './mobile-shell.css';

const RARITIES = [
  { key: 'all', label: 'Wszystkie', color: '#65e8ff' },
  { key: 'winyl', label: 'Winyl', color: '#93a7bb' },
  { key: 'srebrna', label: 'Srebro', color: '#dce7ef' },
  { key: 'zlota', label: 'Złoto', color: '#ffd45d' },
  { key: 'platynowa', label: 'Platyna', color: '#bcadff' },
  { key: 'diamentowa', label: 'Diament', color: '#70ffe9' },
];

const MODE_TONES = {
  cyan: '#48e6ff',
  green: '#39ef9e',
  pink: '#ff58cb',
  violet: '#9b6cff',
  gold: '#ffd04f',
};

const MOBILE_CARD_FRAMES = {
  winyl: cardWinylImg,
  srebrna: cardSrebroImg,
  zlota: cardZlotoImg,
  platynowa: cardPlatynaImg,
  diamentowa: cardDiamentImg,
};

function MobileCollectibleCard({ song, count = 1, onClick, large = false }) {
  const rarity = effectiveRarity(song);
  const frame = MOBILE_CARD_FRAMES[rarity] || MOBILE_CARD_FRAMES.winyl;
  const thumbUrl = song.videoId ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg` : null;
  return (
    <button type="button" className={`mob-collectible-card ${large ? 'large' : ''}`} onClick={onClick}>
      <img className="mob-collectible-frame" src={frame} alt="" />
      {thumbUrl ? <div className="mob-collectible-thumb"><img src={thumbUrl} alt="" /></div> : null}
      <div className="mob-collectible-copy">
        <strong className="mob-collectible-year">{song.year || '—'}</strong>
        <span className="mob-collectible-artist">{song.artist || '—'}</span>
        <span className="mob-collectible-title">{song.title || '—'}</span>
      </div>
      {count > 1 ? <b className="mob-collectible-count">×{count}</b> : null}
    </button>
  );
}

function MobileCardBack({ onClick, accent = '#55e4ff' }) {
  return (
    <button type="button" className="mob-card-back" onClick={onClick} style={{ '--reveal-accent': accent }}>
      <img src={cardRewersImg} alt="Rewers karty" />
      <span>KLIKNIJ, ABY ODKRYĆ</span>
    </button>
  );
}

function MobileCardZoom({ song, count = 1, onClose }) {
  if (!song) return null;
  return (
    <div className="mob-card-zoom-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Podgląd karty">
      <div className="mob-card-zoom" onClick={(e) => e.stopPropagation()}>
        <button className="mob-card-zoom-close" type="button" onClick={onClose} aria-label="Zamknij"><X size={20} /></button>
        <div className="mob-card-zoom-card">
          <MobileCollectibleCard song={song} count={count} large />
        </div>
      </div>
    </div>
  );
}

function compact(value) {
  return new Intl.NumberFormat('pl-PL').format(Number(value || 0));
}

function pct(a, b) {
  if (!b) return 0;
  return Math.round((Number(a || 0) / Number(b || 0)) * 100);
}

function initials(value) {
  const text = String(value || 'G').trim();
  const parts = text.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'G';
}

function MobileHeader({ user, stats, levelInfo, hitcoin, playerName, onLogin, onStats, onAvatarUpload, avatarUploadBusy }) {
  const fileRef = useRef(null);
  const xpPct = Math.max(0, Math.min(100, pct(levelInfo?.currentLevelXp, levelInfo?.xpForNextLevel)));

  return (
    <header className="mob-topbar">
      <button className="mob-logo-btn" type="button" aria-label="Hitsteriada">
        <img src={logoImg} alt="Hitsteriada" />
      </button>

      <div className="mob-topbar-center">
        {user ? (
          <button className="mob-level-pill" type="button" onClick={onStats}>
            <div className="mob-level-line"><span>LVL {levelInfo?.level || 1}</span><small>{compact(levelInfo?.currentLevelXp)} XP</small></div>
            <div className="mob-level-track"><i style={{ width: `${xpPct}%` }} /></div>
          </button>
        ) : (
          <button className="mob-guest-pill" type="button" onClick={onLogin}><Lock size={13} /> TRYB GOŚCIA</button>
        )}
      </div>

      {user ? (
        <div className="mob-topbar-user">
          <div className="mob-coin-pill"><img src={iconHitcoin} alt="" /><b>{compact(hitcoin)}</b></div>
          <button
            className="mob-avatar-btn"
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Zmień avatar"
            disabled={avatarUploadBusy}
          >
            {stats?.avatarUrl ? <img src={stats.avatarUrl} alt={playerName || 'Gracz'} /> : <span>{initials(playerName)}</span>}
            <i><Camera size={10} /></i>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onAvatarUpload?.(file);
              event.target.value = '';
            }}
          />
        </div>
      ) : (
        <button className="mob-login-mini" type="button" onClick={onLogin}>ZALOGUJ</button>
      )}
    </header>
  );
}

function MobileAuthCard(props) {
  const {
    authMode,
    setAuthMode,
    authUsername,
    setAuthUsername,
    authPassword,
    setAuthPassword,
    authBusy,
    authError,
    onAuthSubmit,
    onGuide,
  } = props;
  const isRegister = authMode === 'register';

  return (
    <section className="mob-auth-card mob-panel">
      <div className="mob-auth-head">
        <div>
          <span className="mob-eyebrow">ODKRYJ PEŁNĄ GRĘ</span>
          <h1>DOŁĄCZ DO <span>HITSTERIADY</span></h1>
        </div>
        <div className="mob-auth-orb"><img src={logoImg} alt="" /></div>
      </div>
      <p>Zaloguj się, aby grać ze znajomymi, zdobywać karty, XP i HITCOIN. Bez konta możesz korzystać z Treningu.</p>

      <div className="mob-auth-tabs">
        <button className={!isRegister ? 'active' : ''} onClick={() => setAuthMode?.('login')} type="button"><LogIn size={15} /> ZALOGUJ</button>
        <button className={isRegister ? 'active' : ''} onClick={() => setAuthMode?.('register')} type="button"><UserPlus size={15} /> ZAŁÓŻ KONTO</button>
      </div>

      <form className="mob-auth-form" onSubmit={(event) => { event.preventDefault(); onAuthSubmit?.(); }}>
        <label>
          <span>LOGIN</span>
          <input value={authUsername} onChange={(e) => setAuthUsername?.(e.target.value)} placeholder="Twój login" autoComplete="username" />
        </label>
        <label>
          <span>HASŁO</span>
          <input type="password" value={authPassword} onChange={(e) => setAuthPassword?.(e.target.value)} placeholder="••••••••" autoComplete={isRegister ? 'new-password' : 'current-password'} />
        </label>
        {authError ? <div className="mob-auth-error">{authError}</div> : null}
        <button className="mob-main-cta" disabled={authBusy} type="submit">
          {authBusy ? 'CHWILA…' : isRegister ? 'ZAŁÓŻ KONTO' : 'WEJDŹ DO GRY'} <ChevronRight size={20} />
        </button>
      </form>
      <button className="mob-text-link" type="button" onClick={onGuide}><Info size={14} /> Jak działa Hitsteriada?</button>
    </section>
  );
}

function MobilePlayHero({ user, joinCode, setJoinCode, onCreateRoom, onJoinRoom, onRequireLogin, busy }) {
  return (
    <section className="mob-play-hero mob-panel">
      <div className="mob-play-hero-copy">
        <span className="mob-eyebrow">GRAJ TERAZ</span>
        <h1>ZAGRAJ <span>PO SWOJEMU.</span></h1>
        <p>Stwórz pokój albo wpisz kod znajomego i wskakuj prosto do rozgrywki.</p>
      </div>

      <div className="mob-room-actions">
        <button
          className={`mob-create-room ${!user ? 'locked' : ''}`}
          disabled={busy}
          onClick={() => user ? onCreateRoom?.() : onRequireLogin?.()}
          type="button"
        >
          <span>{user ? 'STWÓRZ POKÓJ' : 'ZALOGUJ, ABY STWORZYĆ POKÓJ'}</span>
          {user ? <b>+</b> : <Lock size={17} />}
        </button>
        <div className={`mob-join-box ${!user ? 'locked' : ''}`}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode?.(e.target.value.toUpperCase())}
            placeholder="Kod pokoju"
            maxLength={6}
            disabled={!user}
          />
          <button disabled={busy} onClick={() => user ? onJoinRoom?.() : onRequireLogin?.()} type="button">DOŁĄCZ</button>
        </div>
      </div>
    </section>
  );
}

function MobileGuideHero({ onGuide }) {
  return (
    <button className="mob-guide-hero mob-panel" type="button" onClick={onGuide}>
      <img src={heroMobile} alt="" className="mob-guide-art" />
      <div className="mob-guide-shade" />
      <div className="mob-guide-copy">
        <span className="mob-eyebrow">POZNAJ HITSTERIADĘ</span>
        <h2>JAK DZIAŁA <span>HITSTERIADA?</span></h2>
        <p>Tryby, karty, rankingi, nagrody i zasady w jednym miejscu.</p>
        <span className="mob-guide-link">DOWIEDZ SIĘ WIĘCEJ <ChevronRight size={17} /></span>
      </div>
    </button>
  );
}

function MobileModeCard({ icon, title, desc, tone = 'cyan', locked, badge, onClick, wide }) {
  const color = MODE_TONES[tone] || MODE_TONES.cyan;
  return (
    <button
      type="button"
      className={`mob-mode-card ${locked ? 'locked' : ''} ${wide ? 'wide' : ''}`}
      style={{ '--mob-accent': color }}
      onClick={onClick}
    >
      <div className="mob-mode-top">
        <img src={icon} alt="" />
        {badge ? <span className="mob-mode-badge">{badge}</span> : null}
        {locked ? <span className="mob-mode-lock"><Lock size={12} /> KONTO</span> : null}
      </div>
      <strong>{title}</strong>
      <span>{desc}</span>
      <i className="mob-mode-arrow"><ChevronRight size={16} /></i>
      <div className="mob-eq-line">{Array.from({ length: 14 }).map((_, i) => <b key={i} style={{ height: `${18 + ((i * 13) % 58)}%` }} />)}</div>
    </button>
  );
}

function MobileProgressCard({ icon, label, value, detail, color = '#4fe5ff', onClick }) {
  return (
    <button className="mob-progress-card" style={{ '--mob-accent': color }} type="button" onClick={onClick}>
      <div className="mob-progress-icon"><img src={icon} alt="" /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <ChevronRight size={16} />
    </button>
  );
}

function MobileSectionHeader({ title, subtitle, icon, onBack }) {
  return (
    <div className="mob-section-head">
      {onBack ? <button type="button" className="mob-back-btn" onClick={onBack}><ChevronLeft size={20} /></button> : null}
      <div className="mob-section-head-icon">{icon}</div>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function MobileHomeView(props) {
  const user = props.user;
  const collectionCount = Object.keys(props.stats?.cardCollection || {}).length;
  const accuracy = props.stats?.cardsTotal ? `${pct(props.stats?.cardsCorrect, props.stats?.cardsTotal)}%` : '—';
  const achievementCount = (props.achievementProgress || []).filter((a) => a.qualifies || a.claimed).length;
  const locked = !user;

  const requireUser = (fn) => () => user ? fn?.() : props.onRequireLogin?.();

  return (
    <div className="mob-stack mob-home-view">
      {!user ? <MobileAuthCard {...props} onGuide={() => props.onNavigate?.('guide')} /> : null}
      <MobilePlayHero {...props} onRequireLogin={props.onRequireLogin} />
      {user ? <MobileGuideHero onGuide={() => props.onNavigate?.('guide')} /> : null}

      <section className="mob-section-block">
        <div className="mob-block-title"><Sparkles size={15} /> TRYBY GRY</div>
        <div className="mob-mode-grid">
          <MobileModeCard icon={glTrening} title="TRENING" desc="Ćwicz bez presji i poznawaj muzykę" tone="cyan" onClick={props.onPractice} />
          <MobileModeCard icon={glHitRush} title="HIT RUSH" desc="Wcześniej czy później? Liczy się tempo" tone="green" locked={locked} onClick={requireUser(props.onHitRush)} />
          <MobileModeCard icon={glPiosenka} title="PIOSENKA DNIA" desc="Jedno wyzwanie dla wszystkich" tone="pink" locked={locked} onClick={requireUser(props.onDailySong)} />
          <MobileModeCard icon={glPlaylista} title="PLAYLISTA DNIA" desc="Codzienna playlista i ranking" tone="violet" locked={locked} onClick={requireUser(props.onDailyPlaylist)} />
          <MobileModeCard icon={glTurniej} title="TURNIEJ" desc={props.activeTournament ? 'Turniej jest aktywny' : 'Rywalizacja o najwyższe miejsca'} tone="gold" locked={locked} badge={props.activeTournament ? 'PREMIUM' : 'WKRÓTCE'} wide onClick={requireUser(props.onTournament)} />
        </div>
      </section>

      {user ? (
        <>
          <button
            type="button"
            className={`mob-daily-reward-banner ${props.stats?.lastDailyHitcoinDate === props.todayKey ? 'claimed' : 'ready'}`}
            onClick={props.onOpenDailyReward}
          >
            <span className="mob-daily-reward-icon"><Gift size={22} /></span>
            <span className="mob-daily-reward-copy">
              <small>BONUS DZIENNY</small>
              <strong>CODZIENNA NAGRODA</strong>
              <em>{props.stats?.lastDailyHitcoinDate === props.todayKey ? 'Odebrana — wróć jutro' : 'Gotowa do odebrania'}</em>
            </span>
            <span className="mob-daily-reward-action">{props.stats?.lastDailyHitcoinDate === props.todayKey ? '✓' : 'ODBIERZ'}</span>
          </button>

          <section className="mob-section-block">
            <div className="mob-block-title"><BarChart3 size={15} /> TWÓJ POSTĘP</div>
            <div className="mob-progress-scroll">
              <MobileProgressCard icon={glKolekcja} label="KOLEKCJA" value={`${collectionCount}/${props.songPoolSize || 0}`} detail="odblokowanych" onClick={() => props.onNavigate?.('collection')} />
              <MobileProgressCard icon={glMedal} label="OSIĄGNIĘCIA" value={`${achievementCount}/${(props.achievementProgress || []).length || 0}`} detail="postęp" color="#aa6cff" onClick={() => props.onNavigate?.('achievements')} />
              <MobileProgressCard icon={glStatystyki} label="STATYSTYKI" value={accuracy} detail="trafność kart" color="#55a9ff" onClick={() => props.onNavigate?.('stats')} />
              <MobileProgressCard icon={glKorona} label="RANKING" value={props.leaderboardPosition ? `#${props.leaderboardPosition}` : '—'} detail="Twoja pozycja" color="#ffd04f" onClick={() => props.onNavigate?.('ranking')} />
              <MobileProgressCard icon={glKoszyk} label="SKLEP" value="PACZKI" detail={`${compact(props.hitcoin)} HITCOIN`} color="#4fe5ff" onClick={() => props.onNavigate?.('shop')} />
              <MobileProgressCard icon={glOsoba} label="SPOŁECZNOŚĆ" value={props.onlinePlayers?.length || 0} detail="graczy online" color="#ff58cb" onClick={() => props.onNavigate?.('community')} />
            </div>
          </section>

          <section className="mob-quick-grid">
            <button type="button" className="mob-quick-card cyan" onClick={() => props.onNavigate?.('community')}>
              <Users size={20} /><div><span>ONLINE</span><strong>{props.onlinePlayers?.length || 0} graczy</strong></div><ChevronRight size={17} />
            </button>
            <button type="button" className="mob-quick-card pink" onClick={() => props.onNavigate?.('propose')}>
              <Music2 size={20} /><div><span>SPOŁECZNOŚĆ</span><strong>Zaproponuj utwór</strong></div><ChevronRight size={17} />
            </button>
          </section>
        </>
      ) : (
        <section className="mob-guest-note mob-panel">
          <Lock size={18} />
          <div><strong>Trening jest darmowy bez konta.</strong><span>Załóż konto, aby odblokować całą Hitsteriadę.</span></div>
        </section>
      )}
    </div>
  );
}

function MobileStatsView(props) {
  const winRate = props.stats?.gamesPlayed ? `${pct(props.stats?.gamesWon, props.stats?.gamesPlayed)}%` : '0%';
  const cardAccuracy = props.stats?.cardsTotal ? `${pct(props.stats?.cardsCorrect, props.stats?.cardsTotal)}%` : '0%';
  const xpPct = pct(props.levelInfo?.currentLevelXp, props.levelInfo?.xpForNextLevel);
  const challenges = props.weeklyChallenges || [];
  const decades = [...(props.decadeEntries || [])].sort((a, b) => String(a.label).localeCompare(String(b.label), 'pl', { numeric: true }));
  const bestArtists = props.bestArtists || [];
  const worstArtists = props.worstArtists || [];
  const collectionCount = Object.keys(props.stats?.cardCollection || {}).filter((id) => Number(props.stats?.cardCollection?.[id] || 0) > 0).length;
  const [expandedDuel, setExpandedDuel] = useState(null);

  useEffect(() => {
    props.onLoadHeadToHead?.();
  }, []); // load once when mobile statistics open

  return (
    <div className="mob-stack mob-inner-view mob-stats-view">
      <MobileSectionHeader title="STATYSTYKI" subtitle="Pełny obraz Twojej gry, skuteczności i postępu." icon={<BarChart3 size={24} />} onBack={() => props.onNavigate('home')} />

      <section className="mob-level-card mob-panel">
        <div className="mob-level-card-top"><span>POZIOM {props.levelInfo?.level || 1}</span><b>{compact(props.levelInfo?.currentLevelXp)} / {compact(props.levelInfo?.xpForNextLevel)} XP</b></div>
        <div className="mob-big-progress"><i style={{ width: `${Math.min(100, xpPct)}%` }} /></div>
        <small>Jeszcze {Math.max(0, Number(props.levelInfo?.xpForNextLevel || 0) - Number(props.levelInfo?.currentLevelXp || 0))} XP do następnego poziomu.</small>
      </section>

      <div className="mob-stats-feature-grid">
        <button type="button" className="mob-stats-feature cyan reward" onClick={props.onOpenDailyReward}>
          <Gift size={18} /><span>CODZIENNA NAGRODA</span><strong>{props.stats?.lastDailyHitcoinDate === props.todayKey ? 'ODEBRANA' : 'GOTOWA'}</strong><small>{props.stats?.lastDailyHitcoinDate === props.todayKey ? 'Zobacz status' : 'Kliknij i odbierz'}</small>
        </button>
        <button type="button" className="mob-stats-feature gold" onClick={() => props.onNavigate('achievements')}>
          <Trophy size={18} /><span>OSIĄGNIĘCIA</span><strong>{props.achievementClaimed || 0} / {props.totalAchievements || 0}</strong><small>Odebranych</small>
        </button>
        <button type="button" className="mob-stats-feature cyan" onClick={() => props.onNavigate('collection')}>
          <Disc3 size={18} /><span>ALBUM</span><strong>{compact(collectionCount)}</strong><small>unikalnych kart</small>
        </button>
      </div>

      <section className="mob-panel mob-list-panel">
        <div className="mob-panel-title"><Gift size={17} /> WYZWANIA TYGODNIA <small>{challenges.filter((c) => c.claimed).length}/5 ODEBRANYCH</small></div>
        {challenges.length ? challenges.map((challenge, index) => {
          const progress = Number(challenge.progress || 0);
          const target = Number(challenge.target || 1);
          const progressPct = Math.min(100, pct(progress, target));
          const claimable = (challenge.done || challenge.completed) && !challenge.claimed;
          return (
            <div className={`mob-challenge-row ${challenge.claimed ? 'claimed' : claimable ? 'ready' : ''}`} key={challenge.id || index}>
              <div className="mob-challenge-number">#{index + 1}</div>
              <div className="mob-challenge-copy"><strong>{challenge.desc || challenge.title || challenge.name || 'Wyzwanie'}</strong><span>{challenge.progressLabel || `${Math.min(progress, target)} / ${target}`} · +{challenge.xp || 0} XP{challenge.hitcoin ? ` +${challenge.hitcoin} HITCOIN` : ''}</span></div>
              <div className="mob-challenge-track"><i style={{ width: `${progressPct}%` }} /></div>
              {claimable ? <button onClick={() => props.onClaimWeeklyChallenge?.(challenge.id)} type="button">ODBIERZ</button> : challenge.claimed ? <small>✓ ODEBRANE</small> : null}
            </div>
          );
        }) : <div className="mob-empty">Brak aktywnych zadań tygodniowych.</div>}
      </section>

      <section className="mob-panel mob-stats-summary-panel">
        <div className="mob-panel-title"><BarChart3 size={17} /> PODSUMOWANIE STATYSTYK</div>
        <div className="mob-metric-grid full">
          <div className="mob-metric"><Gamepad2 size={18} /><strong>{compact(props.stats?.gamesPlayed)}</strong><span>Rozegrane gry</span></div>
          <div className="mob-metric gold"><Trophy size={18} /><strong>{compact(props.stats?.gamesWon)}</strong><span>Wygrane</span></div>
          <div className="mob-metric pink"><BarChart3 size={18} /><strong>{winRate}</strong><span>% wygranych</span></div>
          <div className="mob-metric green"><Disc3 size={18} /><strong>{cardAccuracy}</strong><span>Trafność kart</span></div>
          <div className="mob-metric violet"><Flame size={18} /><strong>{compact(props.stats?.longestStreak || 0)}</strong><span>Rekordowy streak</span></div>
          <div className="mob-metric cyan"><Users size={18} /><strong>{compact(props.stats?.guessesCorrect || 0)}</strong><span>Odgadnięci wykonawcy</span></div>
          <div className="mob-metric cyan"><Music2 size={18} /><strong>{compact(props.stats?.heardSongs?.length || 0)} / {compact(props.songPoolSize)}</strong><span>Przesłuchane piosenki</span></div>
          <div className="mob-metric pink"><Music2 size={18} /><strong>{compact(props.stats?.guessedSongs?.length || 0)} / {compact(props.songPoolSize)}</strong><span>Odgadnięte piosenki</span></div>
          <div className="mob-metric violet"><Sparkles size={18} /><strong>{compact(props.stats?.songsAdded || 0)}</strong><span>Dodane do bazy</span></div>
        </div>
      </section>

      <section className="mob-panel mob-stats-decade-panel">
        <div className="mob-panel-title"><Music2 size={17} /> SKUTECZNOŚĆ WG DEKAD</div>
        <div className="mob-decade-list">
          {decades.length ? decades.map((item) => (
            <div className="mob-decade-row" key={item.label}>
              <div className="mob-decade-copy"><strong>{item.label}</strong><span>{item.correct}/{item.total}</span></div>
              <div className="mob-decade-meter"><i style={{ width: `${item.pct || 0}%` }} /></div>
              <b>{item.pct || 0}%</b>
            </div>
          )) : <div className="mob-empty">Za mało danych o dekadach.</div>}
        </div>
      </section>

      <div className="mob-artist-panels">
        <section className="mob-panel mob-artist-panel best">
          <div className="mob-panel-title"><Crown size={17} /> NAJLEPIEJ ZGADUJESZ — TOP 5</div>
          {bestArtists.length ? bestArtists.map((artist, index) => (
            <div className="mob-artist-row" key={`${artist.name}-${index}`}><b>#{index + 1}</b><div><strong>{artist.name}</strong><span>{artist.correct}/{artist.total} poprawnych</span><i><em style={{ width: `${Math.round((artist.pct || 0) * 100)}%` }} /></i></div><strong>{Math.round((artist.pct || 0) * 100)}%</strong></div>
          )) : <div className="mob-empty">Za mało danych o wykonawcach.</div>}
        </section>
        <section className="mob-panel mob-artist-panel worst">
          <div className="mob-panel-title"><Flame size={17} /> NAJGORZEJ ZGADUJESZ — TOP 5</div>
          {worstArtists.length ? worstArtists.map((artist, index) => (
            <div className="mob-artist-row" key={`${artist.name}-${index}`}><b>#{index + 1}</b><div><strong>{artist.name}</strong><span>{artist.correct}/{artist.total} poprawnych</span><i><em style={{ width: `${Math.round((artist.pct || 0) * 100)}%` }} /></i></div><strong>{Math.round((artist.pct || 0) * 100)}%</strong></div>
          )) : <div className="mob-empty">Za mało danych o wykonawcach.</div>}
        </section>
      </div>

      <section className="mob-panel mob-h2h-panel">
        <div className="mob-panel-title"><Users size={17} /> POJEDYNKI 1V1 <small>{(props.h2hOpponents || []).reduce((sum, duel) => sum + Number(duel.gamesPlayed || 0), 0)} GIER</small></div>
        {props.h2hOpponents == null ? <div className="mob-empty">Wczytuję historię pojedynków…</div> : props.h2hOpponents.length ? props.h2hOpponents.map((duel, index) => {
          const opponentId = duel.uids?.find((id) => id !== props.user?.uid) || duel.uid || duel.id;
          const opponentName = duel.names?.[opponentId] || duel.username || duel.name || 'Gracz';
          const myWins = Number(duel.wins?.[props.user?.uid] ?? duel.myWins ?? duel.wins ?? 0);
          const opponentWins = Number(duel.wins?.[opponentId] ?? duel.opponentWins ?? duel.losses ?? 0);
          const expanded = expandedDuel === opponentId;
          const myGuessPct = duel.guessesAttempted?.[props.user?.uid] ? pct(duel.guessesCorrect?.[props.user.uid] || 0, duel.guessesAttempted[props.user.uid]) : null;
          const opponentGuessPct = duel.guessesAttempted?.[opponentId] ? pct(duel.guessesCorrect?.[opponentId] || 0, duel.guessesAttempted[opponentId]) : null;
          const myPlacePct = duel.placementTotal?.[props.user?.uid] ? pct(duel.placementCorrect?.[props.user.uid] || 0, duel.placementTotal[props.user.uid]) : null;
          const opponentPlacePct = duel.placementTotal?.[opponentId] ? pct(duel.placementCorrect?.[opponentId] || 0, duel.placementTotal[opponentId]) : null;
          const myDecisionCount = Number(duel.decisionCount?.[props.user?.uid] || 0);
          const opponentDecisionCount = Number(duel.decisionCount?.[opponentId] || 0);
          const myAvgSpeed = myDecisionCount ? Math.round(Number(duel.decisionTimeSumMs?.[props.user.uid] || 0) / myDecisionCount / 1000) : null;
          const opponentAvgSpeed = opponentDecisionCount ? Math.round(Number(duel.decisionTimeSumMs?.[opponentId] || 0) / opponentDecisionCount / 1000) : null;
          return (
            <article className={`mob-h2h-card ${expanded ? 'expanded' : ''}`} key={opponentId || index}>
              <button type="button" className="mob-h2h-main" onClick={() => setExpandedDuel(expanded ? null : opponentId)}>
                <div className="mob-h2h-vs"><span>VS</span><div><strong>{opponentName}</strong><small>{duel.gamesPlayed || duel.games || duel.total || 0} gier</small></div></div>
                <div className="mob-h2h-score"><span>BILANS</span><strong>{myWins} : {opponentWins}</strong></div><ChevronDown size={17} />
              </button>
              {expanded ? <div className="mob-h2h-details"><div><span>ZGADYWANIE</span><strong>{myGuessPct ?? '—'}% <small>vs</small> {opponentGuessPct ?? '—'}%</strong></div><div><span>OŚ CZASU</span><strong>{myPlacePct ?? '—'}% <small>vs</small> {opponentPlacePct ?? '—'}%</strong></div><div><span>ŚR. DECYZJA</span><strong>{myAvgSpeed ?? '—'}s <small>vs</small> {opponentAvgSpeed ?? '—'}s</strong></div>{opponentId ? <button type="button" onClick={() => props.onViewProfile?.({ uid: opponentId, username: opponentName })}>ZOBACZ PROFIL</button> : null}</div> : null}
            </article>
          );
        }) : <div className="mob-empty">Nie masz jeszcze rozegranego pojedynku 1v1.</div>}
      </section>
    </div>
  );
}

function MobileCollectionView(props) {
  const [rarity, setRarity] = useState('all');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
  const [visibleCount, setVisibleCount] = useState(40);
  const [zoomedSong, setZoomedSong] = useState(null);
  const collection = props.stats?.cardCollection || {};
  const songs = Array.isArray(props.songs) ? props.songs : [];

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return songs.filter((song) => {
      const songRarity = effectiveRarity(song);
      if (rarity !== 'all' && songRarity !== rarity) return false;
      const count = Number(collection[song.id] || 0);
      if (ownedOnly && count < 1) return false;
      if (normalized && !`${song.artist || ''} ${song.title || ''} ${song.year || ''}`.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [songs, collection, rarity, query, ownedOnly]);

  const rarityCounts = useMemo(() => {
    const all = {};
    RARITIES.slice(1).forEach((item) => { all[item.key] = { owned: 0, total: 0 }; });
    songs.forEach((song) => {
      const r = effectiveRarity(song);
      if (!all[r]) all[r] = { owned: 0, total: 0 };
      all[r].total += 1;
      if (Number(collection[song.id] || 0) > 0) all[r].owned += 1;
    });
    return all;
  }, [songs, collection]);

  const uniqueOwned = Object.keys(collection).filter((id) => Number(collection[id] || 0) > 0).length;
  const duplicates = Object.values(collection).reduce((sum, count) => sum + Math.max(0, Number(count || 0) - 1), 0);
  const shown = filtered.slice(0, visibleCount);

  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="KOLEKCJA" subtitle={`${uniqueOwned} / ${props.songPoolSize || songs.length} unikalnych kart`} icon={<Disc3 size={24} />} onBack={() => props.onNavigate('home')} />

      <section className="mob-collection-summary mob-panel">
        <div><span>UNIKALNE</span><strong>{uniqueOwned} / {props.songPoolSize || songs.length}</strong></div>
        <div><span>DUPLIKATY</span><strong>{duplicates}</strong></div>
        <div className="mob-collection-rarity-summary">{RARITIES.slice(1).map((item) => <span key={item.key} style={{ '--rarity': item.color }}><i />{item.label}<b>{rarityCounts[item.key]?.owned || 0}/{rarityCounts[item.key]?.total || 0}</b></span>)}</div>
      </section>

      <section className="mob-collection-tools mob-panel">
        <div className="mob-search"><Search size={16} /><input value={query} onChange={(e) => { setQuery(e.target.value); setVisibleCount(40); }} placeholder="Szukaj karty…" /></div>
        <button className={ownedOnly ? 'active' : ''} type="button" onClick={() => { setOwnedOnly((v) => !v); setVisibleCount(40); }}>{ownedOnly ? 'TYLKO MOJE' : 'POKAŻ WSZYSTKIE'}</button>
      </section>

      <div className="mob-rarity-tabs">
        {RARITIES.map((item) => {
          const info = rarityCounts[item.key];
          return <button type="button" key={item.key} className={rarity === item.key ? 'active' : ''} style={{ '--rarity': item.color }} onClick={() => { setRarity(item.key); setVisibleCount(40); }}><span>{item.label}</span>{item.key !== 'all' && info ? <small>{info.owned}/{info.total}</small> : null}</button>;
        })}
      </div>

      {props.libraryLoading ? <div className="mob-empty mob-panel">Ładowanie biblioteki…</div> : shown.length ? (
        <div className="mob-real-card-grid">
          {shown.map((song) => {
            const count = Number(collection[song.id] || 0);
            if (count > 0) return <MobileCollectibleCard key={song.id} song={song} count={count} onClick={() => setZoomedSong(song)} />;
            const rarityInfo = RARITIES.find((item) => item.key === effectiveRarity(song)) || RARITIES[1];
            return <div className="mob-locked-collectible" key={song.id} style={{ '--rarity': rarityInfo.color }}><Lock size={21} /><strong>?</strong><span>{rarityInfo.label}</span></div>;
          })}
        </div>
      ) : <div className="mob-empty mob-panel">Brak kart dla wybranego filtra.</div>}

      {filtered.length > visibleCount ? <button type="button" className="mob-load-more" onClick={() => setVisibleCount((v) => v + 40)}>POKAŻ WIĘCEJ <small>({filtered.length - visibleCount} pozostało)</small></button> : null}

      <MobileCardZoom song={zoomedSong} count={zoomedSong ? Number(collection[zoomedSong.id] || 1) : 1} onClose={() => setZoomedSong(null)} />
    </div>
  );
}

function MobileAchievementsView(props) {
  const list = props.achievementProgress || [];
  const claimed = list.filter((item) => item.claimed).length;
  const groups = useMemo(() => {
    const map = new Map();
    list.forEach((item) => {
      const category = item.category || 'Pozostałe';
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(item);
    });
    return Array.from(map.entries());
  }, [list]);
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.length ? [groups[0][0]] : []));

  useEffect(() => {
    if (!openGroups.size && groups.length) setOpenGroups(new Set([groups[0][0]]));
  }, [groups.length]);

  const toggleGroup = (category) => setOpenGroups((current) => {
    const next = new Set(current);
    if (next.has(category)) next.delete(category); else next.add(category);
    return next;
  });

  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="OSIĄGNIĘCIA" subtitle={`${claimed} / ${list.length} zdobytych`} icon={<Medal size={24} />} onBack={() => props.onNavigate('home')} />
      <section className="mob-achievement-summary mob-panel"><img src={glMedal} alt="" /><div><span>TWÓJ POSTĘP</span><strong>{list.length ? `${pct(claimed, list.length)}%` : '0%'}</strong><div className="mob-big-progress"><i style={{ width: `${list.length ? pct(claimed, list.length) : 0}%` }} /></div><small>{list.filter((item) => item.qualifies && !item.claimed).length} nagród gotowych do odebrania</small></div></section>
      <div className="mob-achievement-groups">
        {groups.map(([category, items]) => {
          const open = openGroups.has(category);
          const groupClaimed = items.filter((item) => item.claimed).length;
          const ready = items.filter((item) => item.qualifies && !item.claimed).length;
          return (
            <section className={`mob-ach-group mob-panel ${open ? 'open' : ''}`} key={category}>
              <button type="button" className="mob-ach-group-head" onClick={() => toggleGroup(category)}>
                <div><Sparkles size={16} /><span>{category.toUpperCase()}</span></div>
                <div><small>{groupClaimed}/{items.length}{ready ? ` · ${ready} DO ODEBRANIA` : ''}</small><ChevronDown size={17} /></div>
              </button>
              {open ? <div className="mob-ach-group-body">{items.map((item, index) => {
                const icon = item.claimed ? achOdebrane : item.qualifies ? achDoOdebrania : achZablokowane;
                const status = item.claimed ? 'ZDOBYTE' : item.qualifies ? 'DO ODEBRANIA' : 'ZABLOKOWANE';
                return (
                  <div className={`mob-ach-row ${item.claimed ? 'claimed' : item.qualifies ? 'ready' : 'locked'}`} key={item.id || index}>
                    <img src={icon} alt="" />
                    <div><strong>{item.name || item.title || 'Osiągnięcie'}</strong><span>{item.desc || item.description || ''}</span><small>+{item.xp || 0} XP · {status}</small></div>
                    {item.qualifies && !item.claimed ? <button type="button" onClick={() => props.onClaimAchievement?.(item)}>ODBIERZ</button> : null}
                  </div>
                );
              })}</div> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MobileRankingView(props) {
  useEffect(() => {
    if (!props.leaderboard) props.onLoadLeaderboard?.(props.leaderboardSort || 'gamesWon');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = props.leaderboard || [];
  return (
    <div className="mob-stack mob-inner-view mob-ranking-view">
      <MobileSectionHeader title="RANKING" subtitle="Najlepsi gracze Hitsteriady." icon={<Crown size={24} />} onBack={() => props.onNavigate('home')} />
      <div className="mob-ranking-tabs">
        <button type="button" className={props.leaderboardSort === 'gamesWon' ? 'active' : ''} onClick={() => props.onLoadLeaderboard?.('gamesWon')}>WYGRANE</button>
        <button type="button" className={props.leaderboardSort === 'guessesCorrect' ? 'active' : ''} onClick={() => props.onLoadLeaderboard?.('guessesCorrect')}>ZGADYWANIE</button>
      </div>
      <section className="mob-panel mob-ranking-list">
        {!props.leaderboard ? <div className="mob-empty">Ładowanie rankingu…</div> : rows.length ? rows.map((player, index) => (
          <button type="button" className={`mob-rank-row place-${index + 1}`} key={player.uid || index} onClick={() => props.onViewProfile?.(player)}>
            <span className="mob-rank-place">{index < 3 ? ['🥇','🥈','🥉'][index] : `#${index + 1}`}</span>
            <div className="mob-player-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.username || player.name) : null}</div>
            <div className="mob-rank-copy"><strong>{player.username || player.name || 'Gracz'}</strong><span>{props.leaderboardSort === 'gamesWon' ? `${player.gamesWon || 0} wygranych` : `${player.guessesCorrect || 0} trafień`}</span></div>
            <ChevronRight size={16} />
          </button>
        )) : <div className="mob-empty">Brak wyników.</div>}
      </section>
    </div>
  );
}

function MobileShopView(props) {
  const packs = [
    { key: '50', title: 'PODSTAWOWA', img: packPodstawowa, color: '#54e4ff' },
    { key: '75', title: 'ROZSZERZONA', img: packRozszerzona, color: '#a96cff' },
    { key: '100', title: 'PREMIUM', img: packPremium, color: '#ffd04f' },
  ];
  const [revealed, setRevealed] = useState(() => new Set());
  const [zoomedSong, setZoomedSong] = useState(null);
  const [revealFx, setRevealFx] = useState(null);

  useEffect(() => {
    setRevealed(new Set());
    setZoomedSong(null);
    setRevealFx(null);
  }, [props.packOpenResult]);

  useEffect(() => {
    if (!revealFx) return undefined;
    const durations = { winyl: 520, srebrna: 720, zlota: 930, platynowa: 1180, diamentowa: 1550 };
    const timer = window.setTimeout(() => setRevealFx(null), durations[revealFx.rarity] || 760);
    return () => window.clearTimeout(timer);
  }, [revealFx]);

  const revealCard = (index) => {
    if (revealed.has(index)) return;
    const item = props.packOpenResult?.[index];
    const rarity = item?.song ? effectiveRarity(item.song) : 'winyl';
    setRevealed((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
    setRevealFx({ index, rarity, nonce: Date.now() });
  };

  const allRevealed = Boolean(props.packOpenResult?.length) && revealed.size >= props.packOpenResult.length;

  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="SKLEP" subtitle={`Saldo: ${compact(props.hitcoin)} HITCOIN`} icon={<ShoppingCart size={24} />} onBack={() => props.onNavigate('home')} />
      {props.packOpenResult?.length ? (
        <section className="mob-panel mob-pack-reveal">
          <div className="mob-pack-reveal-head">
            <Sparkles size={20} />
            <div><span>PACZKA OTWARTA</span><h2>ODKRYJ SWOJE KARTY</h2><p>Klikaj rewersy po kolei i sprawdź, co wylosowałeś.</p></div>
          </div>
          <div className="mob-pack-reveal-grid">
            {props.packOpenResult.map((item, index) => {
              const isRevealed = revealed.has(index);
              const rarityInfo = RARITIES.find((entry) => entry.key === effectiveRarity(item.song)) || RARITIES[1];
              const rarityKey = effectiveRarity(item.song) || 'winyl';
              const isActiveReveal = revealFx?.index === index;
              return (
                <div className={`mob-pack-reveal-slot rarity-${rarityKey} ${isRevealed ? 'revealed' : ''} ${isActiveReveal ? 'reveal-active' : ''}`} key={item.song?.id || index} style={{ '--reveal-accent': rarityInfo.color }}>
                  {isRevealed ? (
                    <>
                      <div className="mob-pack-card-reveal-stage">
                        <MobileCollectibleCard song={item.song} count={1} onClick={() => setZoomedSong(item.song)} />
                        <span className="mob-pack-card-aura" aria-hidden="true" />
                      </div>
                      <div className="mob-pack-reveal-meta"><strong>{rarityInfo.label}</strong>{item.isDuplicate ? <span>DUPLIKAT</span> : <span>NOWA KARTA</span>}</div>
                    </>
                  ) : (
                    <MobileCardBack onClick={() => revealCard(index)} accent="#7765ff" />
                  )}
                </div>
              );
            })}
          </div>
          {revealFx ? (
            <div className={`mob-rarity-reveal-fx rarity-${revealFx.rarity}`} key={revealFx.nonce} aria-hidden="true">
              <span className="mob-rarity-flash" />
              <span className="mob-rarity-ring ring-one" />
              <span className="mob-rarity-ring ring-two" />
              <span className="mob-rarity-rays" />
              <span className="mob-rarity-particle p1" /><span className="mob-rarity-particle p2" /><span className="mob-rarity-particle p3" />
              <span className="mob-rarity-particle p4" /><span className="mob-rarity-particle p5" /><span className="mob-rarity-particle p6" />
            </div>
          ) : null}
          <div className="mob-pack-reveal-progress"><span>{revealed.size} / {props.packOpenResult.length} odkrytych</span><i><em style={{ width: `${props.packOpenResult.length ? (revealed.size / props.packOpenResult.length) * 100 : 0}%` }} /></i></div>
          {allRevealed ? <button className="mob-main-cta" onClick={props.onClearPackResult} type="button">GOTOWE — WRÓĆ DO PACZEK</button> : <div className="mob-pack-reveal-hint">ODKRYJ WSZYSTKIE KARTY, ABY KONTYNUOWAĆ</div>}
        </section>
      ) : (
        <div className="mob-pack-stack">
          {packs.map((pack) => {
            const cfg = props.packConfigs?.[pack.key] || {};
            const canBuy = Number(props.hitcoin || 0) >= Number(cfg.price || 0);
            return <section className="mob-pack-card mob-panel" key={pack.key} style={{ '--pack-accent': pack.color }}><img src={pack.img} alt={pack.title} /><div><span>PACZKA</span><h2>{pack.title}</h2><p>{cfg.cards || '?'} kart · szansa na rzadkie karty</p><strong><img src={iconHitcoin} alt="" /> {cfg.price || 0}</strong></div><button type="button" disabled={props.packBusy || !canBuy} onClick={() => props.onBuyPack?.(pack.key)}>{canBuy ? 'KUP' : 'BRAK ŚRODKÓW'}</button></section>;
          })}
        </div>
      )}
      <MobileCardZoom song={zoomedSong} count={1} onClose={() => setZoomedSong(null)} />
    </div>
  );
}

function MobileCommunityView(props) {
  const players = props.onlinePlayers || [];
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="SPOŁECZNOŚĆ" subtitle={`${players.length} graczy online`} icon={<Users size={24} />} onBack={() => props.onNavigate('home')} />
      <section className="mob-panel mob-community-list">
        {players.length ? players.map((player, index) => {
          const pending = props.challengeSentTo?.uid === player.uid;
          return <div className="mob-community-row" key={player.playerId || player.uid || index}><button type="button" className="mob-community-profile" onClick={() => player.uid && props.onViewProfile?.(player)}><div className="mob-player-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name || player.username) : null}</div><div><strong>{player.name || player.username || 'Gracz'}</strong><span>{player.uid ? '🟢 online · zobacz profil' : 'gość'}</span></div></button>{player.uid ? <button className="mob-duel-btn" type="button" disabled={props.challengeBusy || pending} onClick={() => props.onChallenge?.(player)}>{pending ? 'WYSŁANO' : 'WYZWIJ'}</button> : null}</div>;
        }) : <div className="mob-empty">Nikt inny nie jest teraz online.</div>}
      </section>
    </div>
  );
}

function MobileProposeView(props) {
  const draft = props.proposeDraft || { artist: '', title: '', url: '', year: '', categories: [] };
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="ZAPROPONUJ UTWÓR" subtitle="Dodaj hit, którego brakuje w bazie." icon={<Music2 size={24} />} onBack={() => props.onNavigate('menu')} />
      <section className="mob-panel mob-propose-card">
        {props.proposeSuccess ? <div className="mob-propose-success"><CheckCircle2 size={42} /><strong>DZIĘKI!</strong><span>Propozycja czeka na zatwierdzenie.</span></div> : (
          <div className="mob-propose-form">
            <label><span>WYKONAWCA</span><input value={draft.artist || ''} onChange={(e) => props.setProposeDraft?.({ ...draft, artist: e.target.value })} placeholder="np. Queen" /></label>
            <label><span>TYTUŁ</span><input value={draft.title || ''} onChange={(e) => props.setProposeDraft?.({ ...draft, title: e.target.value })} placeholder="np. Don't Stop Me Now" /></label>
            <label><span>LINK YOUTUBE</span><input value={draft.url || ''} onChange={(e) => props.setProposeDraft?.({ ...draft, url: e.target.value })} placeholder="https://youtube.com/..." /></label>
            <label><span>ROK</span><input type="number" value={draft.year || ''} onChange={(e) => props.setProposeDraft?.({ ...draft, year: e.target.value })} placeholder="1978" /></label>
            <div className="mob-category-chips">{(props.categories || []).map((cat) => <button type="button" key={cat.slug} className={draft.categories?.includes(cat.slug) ? 'active' : ''} onClick={() => props.onToggleProposeCategory?.(cat.slug)}>{cat.label}</button>)}</div>
            {props.proposeError ? <div className="mob-auth-error">{props.proposeError}</div> : null}
            <button className="mob-main-cta" type="button" disabled={props.proposeBusy} onClick={props.onSubmitProposal}><Send size={17} /> {props.proposeBusy ? 'WYSYŁANIE…' : 'WYŚLIJ PROPOZYCJĘ'}</button>
          </div>
        )}
      </section>
    </div>
  );
}

function MobileGuideView({ onNavigate }) {
  const modes = [
    ['TRENING', 'Ćwicz układanie utworów na osi czasu bez presji.'],
    ['HIT RUSH', 'Szybko decyduj, czy utwór jest wcześniejszy czy późniejszy.'],
    ['PIOSENKA DNIA', 'Jedno codzienne wyzwanie wspólne dla wszystkich graczy.'],
    ['PLAYLISTA DNIA', 'Codzienna seria utworów i rankingi wyników.'],
    ['TURNIEJ', 'Rywalizacja o wysokie miejsca i specjalne nagrody.'],
  ];
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="JAK DZIAŁA HITSTERIADA?" subtitle="Wszystko, czego potrzebujesz przed pierwszą grą." icon={<Info size={24} />} onBack={() => onNavigate('home')} />
      <section className="mob-guide-intro mob-panel"><img src={heroMobile} alt="" /><div><span className="mob-eyebrow">PODSTAWOWA ZASADA</span><h2>POSŁUCHAJ. UŁÓŻ. ZDOBYWAJ.</h2><p>Rozpoznawaj muzykę, umieszczaj utwory na osi czasu, zdobywaj XP, karty i HITCOIN.</p></div></section>
      <section className="mob-panel mob-guide-steps"><div><b>1</b><strong>ODSŁUCHAJ</strong><span>Uruchom fragment utworu.</span></div><div><b>2</b><strong>UMIEŚĆ</strong><span>Wybierz właściwe miejsce na osi.</span></div><div><b>3</b><strong>ROZWIJAJ KONTO</strong><span>Zbieraj karty, XP i nagrody.</span></div></section>
      <section className="mob-panel mob-guide-mode-list"><div className="mob-panel-title"><Gamepad2 size={17} /> TRYBY GRY</div>{modes.map(([title, desc]) => <div key={title}><strong>{title}</strong><span>{desc}</span></div>)}</section>
      <section className="mob-guide-system-grid"><div className="mob-panel"><Disc3 size={22} /><strong>KOLEKCJA</strong><span>Pięć rzadkości kart. Odkrywaj utwory i buduj album.</span></div><div className="mob-panel"><ShoppingCart size={22} /><strong>SKLEP</strong><span>Wydawaj HITCOIN na paczki z kartami.</span></div><div className="mob-panel"><Medal size={22} /><strong>OSIĄGNIĘCIA</strong><span>Realizuj cele i odbieraj XP.</span></div><div className="mob-panel"><Crown size={22} /><strong>RANKINGI</strong><span>Porównuj wyniki z innymi graczami.</span></div></section>
    </div>
  );
}

function MobileMoreView(props) {
  const items = [
    ['achievements', 'OSIĄGNIĘCIA', glMedal, 'Cele, nagrody i XP'],
    ['shop', 'SKLEP', glKoszyk, 'Paczki i kolekcja'],
    ['community', 'SPOŁECZNOŚĆ', glOsoba, 'Gracze online i 1v1'],
    ['propose', 'ZAPROPONUJ UTWÓR', glPiosenka, 'Pomóż rozwijać bazę'],
    ['guide', 'JAK GRAĆ?', glTrening, 'Zasady i tryby gry'],
  ];
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="WIĘCEJ" subtitle="Wszystkie funkcje Hitsteriady." icon={<Menu size={24} />} onBack={() => props.onNavigate('home')} />
      <div className="mob-more-grid">{items.map(([id, title, icon, desc]) => { const locked = !props.user && id !== 'guide'; return <button type="button" key={id} className={locked ? 'locked' : ''} onClick={() => locked ? props.onRequireLogin?.() : props.onNavigate(id)}><img src={icon} alt="" /><div><strong>{title}</strong><span>{locked ? 'Zaloguj się, aby odblokować' : desc}</span></div>{locked ? <Lock size={15} /> : <ChevronRight size={17} />}</button>; })}</div>
      {props.onAdmin ? (
        <section className="mob-admin-section">
          <span className="mob-admin-section-label">NARZĘDZIA</span>
          <button type="button" className={`mob-admin-entry ${props.adminUnlocked ? 'unlocked' : ''}`} onClick={props.onAdmin}>
            <Settings size={22} />
            <div><strong>{props.adminUnlocked ? 'PANEL ADMINA' : 'TRYB ADMINA'}</strong><span>{props.adminUnlocked ? 'Otwórz narzędzia administratora' : 'Dostęp chroniony hasłem'}</span></div>
            <ChevronRight size={17} />
          </button>
        </section>
      ) : null}
    </div>
  );
}

function MobileProfileSheet({ profile, onClose, levelFromXp }) {
  if (!profile) return null;
  const data = profile.stats || profile;
  const username = profile.username || profile.name || data.username || 'Gracz';
  const level = levelFromXp ? levelFromXp(data.xp || 0) : { level: 1, currentLevelXp: 0, xpForNextLevel: 1 };
  const winRate = data.gamesPlayed ? pct(data.gamesWon || 0, data.gamesPlayed) : 0;
  const accuracy = data.cardsTotal ? pct(data.cardsCorrect || 0, data.cardsTotal) : 0;
  const collectionSummary = profile.collectionSummary || {};
  const raritySummary = collectionSummary.byRarity || {};
  const totalCards = collectionSummary.totalCopies ?? Object.values(data.cardCollection || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const uniqueCards = collectionSummary.uniqueOwned ?? Object.keys(data.cardCollection || {}).filter((id) => Number(data.cardCollection[id] || 0) > 0).length;
  const totalAvailable = collectionSummary.totalAvailable ?? null;
  const xpPct = pct(level.currentLevelXp || 0, level.xpForNextLevel || 1);

  return (
    <div className="mob-sheet-backdrop" onClick={onClose} role="presentation">
      <section className="mob-profile-sheet expanded" onClick={(e) => e.stopPropagation()}>
        <button className="mob-sheet-close" type="button" onClick={onClose}><X size={20} /></button>
        <div className="mob-profile-head"><div className="mob-profile-avatar" style={data.avatarUrl ? { backgroundImage: `url(${data.avatarUrl})` } : undefined}>{!data.avatarUrl ? initials(username) : null}</div><div><span>PROFIL GRACZA</span><h2>{username}</h2><small>LVL {level.level || 1} · {compact(data.xp || 0)} XP</small></div></div>
        <div className="mob-profile-xp"><div><span>POSTĘP POZIOMU</span><b>{compact(level.currentLevelXp || 0)} / {compact(level.xpForNextLevel || 0)} XP</b></div><i><em style={{ width: `${Math.min(100, xpPct)}%` }} /></i></div>

        <div className="mob-profile-metrics full">
          <div><strong>{compact(data.gamesPlayed || 0)}</strong><span>Rozegrane</span></div>
          <div><strong>{compact(data.gamesWon || 0)}</strong><span>Wygrane</span></div>
          <div><strong>{winRate}%</strong><span>% wygranych</span></div>
          <div><strong>{accuracy}%</strong><span>Trafność kart</span></div>
          <div><strong>{compact(data.longestStreak || data.longestGuessStreak || 0)}</strong><span>Rekordowa seria</span></div>
          <div><strong>{compact(data.guessesCorrect || 0)}</strong><span>Zgadnięte</span></div>
        </div>

        <div className="mob-profile-secondary">
          <div><span>PLAYLISTA DNIA</span><strong>{compact(data.playlistTotalScore || 0)} pkt</strong></div>
          <div><span>HIT RUSH</span><strong>{compact(data.hitRushBestScore || 0)} pkt</strong></div>
          <div><span>DODANE DO BAZY</span><strong>{compact(data.songsAdded || 0)}</strong></div>
        </div>

        <div className="mob-profile-collection">
          <div className="mob-profile-collection-head"><div><span>KOLEKCJA KART</span><strong>{compact(uniqueCards)}{totalAvailable !== null ? ` / ${compact(totalAvailable)}` : ''} unikalnych</strong></div><div><span>ŁĄCZNIE KART</span><strong>{compact(totalCards)}</strong></div></div>
          <div className="mob-profile-rarity">
            {RARITIES.slice(1).map((item) => {
              const summary = raritySummary[item.key] || { owned: Number(data.cardsByRarity?.[item.key] || 0), total: 0 };
              return <span key={item.key} style={{ '--rarity': item.color }}><i />{item.label}<b>{compact(summary.owned)} / {summary.total ? compact(summary.total) : '—'}</b></span>;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export function MobileDailyRewardModal({ claimed, spinning, busy, result, rewards = [], wheel, onClaim, onClose }) {
  const alreadyClaimed = claimed || result?.type === 'claimed';
  const won = result && result.type !== 'claimed' ? result : null;
  const previewRewards = rewards.filter((reward, index) => index < 6);

  return (
    <div className="mob-reward-overlay" role="dialog" aria-modal="true" aria-label="Codzienna nagroda">
      <div className="mob-reward-screen">
        <div className="mob-reward-topline">
          <div>
            <span className="mob-reward-eyebrow"><Sparkles size={12} /> BONUS DZIENNY</span>
            <h2>CODZIENNA <span>NAGRODA</span></h2>
          </div>
          <button type="button" className="mob-reward-close" onClick={onClose} disabled={spinning} aria-label="Zamknij"><X size={20} /></button>
        </div>

        <div className={`mob-reward-status ${alreadyClaimed ? 'done' : 'ready'}`}>
          {alreadyClaimed ? <CheckCircle2 size={16} /> : <Gift size={16} />}
          <div>
            <strong>{alreadyClaimed ? 'DZISIEJSZA NAGRODA ODEBRANA' : 'NAGRODA GOTOWA DO ODBIORU'}</strong>
            <span>{alreadyClaimed ? 'Kolejne losowanie odblokuje się jutro.' : 'Jedno losowanie dziennie. Nagroda trafia od razu na konto.'}</span>
          </div>
        </div>

        <section className="mob-reward-wheel-card">
          <div className="mob-reward-orbit" />
          <div className="mob-reward-wheel-wrap">{wheel}</div>
          {spinning ? <div className="mob-reward-spin-label"><span /> LOSOWANIE NAGRODY...</div> : null}
        </section>

        {won ? (
          <section className="mob-reward-won">
            <span>WYGRAŁEŚ</span>
            <strong>{won.label}</strong>
            {won.sublabel ? <small>{won.sublabel}</small> : null}
            {won.song ? <p>{won.song.artist} — {won.song.title}</p> : null}
            <button type="button" onClick={onClose}>SUPER!</button>
          </section>
        ) : alreadyClaimed ? (
          <section className="mob-reward-done-card">
            <CheckCircle2 size={28} />
            <div><strong>NA DZIŚ GOTOWE</strong><span>Wróć jutro po kolejną szansę na HITCOIN, XP, kartę lub 2× XP.</span></div>
          </section>
        ) : (
          <button type="button" className="mob-reward-claim" onClick={onClaim} disabled={busy || spinning}>
            <Gift size={18} />
            <span>{spinning ? 'LOSOWANIE...' : busy ? 'PRZYGOTOWYWANIE...' : 'ODBIERZ NAGRODĘ'}</span>
          </button>
        )}

        {!won ? (
          <section className="mob-reward-preview">
            <div className="mob-reward-preview-title"><span>W KOLE MOŻESZ TRAFIĆ</span><small>szanse pozostają niespodzianką</small></div>
            <div className="mob-reward-preview-grid">
              {previewRewards.map((reward) => (
                <div key={reward.id} style={{ '--reward-tone': reward.color }}>
                  <i>{reward.type === 'hitcoin' ? '🪙' : reward.type === 'xp' ? '★' : reward.type === 'card' ? '◆' : '×2'}</i>
                  <strong>{reward.label}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mob-reward-footnote"><span>RESET</span><strong>CODZIENNIE O 00:00</strong></div>
      </div>
    </div>
  );
}

function MobileBottomNav({ section, onNavigate, user, onRequireLogin }) {
  const items = [
    ['home', Home, 'GRAJ'],
    ['collection', Disc3, 'KOLEKCJA'],
    ['stats', BarChart3, 'STATYSTYKI'],
    ['ranking', Crown, 'RANKING'],
    ['menu', Menu, 'WIĘCEJ'],
  ];
  return (
    <nav className="mob-bottom-nav">
      {items.map(([id, Icon, label]) => {
        const locked = !user && id !== 'home' && id !== 'menu';
        return <button key={id} type="button" className={section === id ? 'active' : ''} onClick={() => locked ? onRequireLogin?.() : onNavigate(id)}><span><Icon size={19} />{locked ? <i><Lock size={8} /></i> : null}</span><small>{label}</small></button>;
      })}
    </nav>
  );
}

export function MobileAppView(props) {
  const [section, setSection] = useState('home');

  const requestLogin = () => {
    setSection('home');
    props.setAuthMode?.('login');
    window.setTimeout(() => document.querySelector('.mob-auth-form input')?.focus(), 50);
  };

  useEffect(() => {
    if (!props.user && !['home', 'guide', 'menu'].includes(section)) setSection('home');
  }, [props.user, section]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [section]);

  const common = {
    ...props,
    section,
    onNavigate: setSection,
    onRequireLogin: requestLogin,
  };

  let content;
  if (section === 'stats') content = <MobileStatsView {...common} />;
  else if (section === 'collection') content = <MobileCollectionView {...common} />;
  else if (section === 'achievements') content = <MobileAchievementsView {...common} />;
  else if (section === 'ranking') content = <MobileRankingView {...common} />;
  else if (section === 'shop') content = <MobileShopView {...common} />;
  else if (section === 'community') content = <MobileCommunityView {...common} />;
  else if (section === 'propose') content = <MobileProposeView {...common} />;
  else if (section === 'guide') content = <MobileGuideView onNavigate={setSection} />;
  else if (section === 'menu') content = <MobileMoreView {...common} />;
  else content = <MobileHomeView {...common} />;

  return (
    <div className="mob-root" style={{ '--mob-bg-image': `url(${homeBg})` }}>
      <div className="mob-background" />
      <MobileHeader
        user={props.user}
        stats={props.stats}
        levelInfo={props.levelInfo}
        hitcoin={props.hitcoin}
        playerName={props.playerName}
        onLogin={requestLogin}
        onStats={() => props.user ? setSection('stats') : requestLogin()}
        onAvatarUpload={props.onAvatarUpload}
        avatarUploadBusy={props.avatarUploadBusy}
      />
      <main className="mob-main">{content}</main>
      <MobileBottomNav section={section} onNavigate={setSection} user={props.user} onRequireLogin={requestLogin} />
      <MobileProfileSheet profile={props.viewingPlayer} onClose={props.onCloseProfile} levelFromXp={props.levelFromXp} />
    </div>
  );
}
