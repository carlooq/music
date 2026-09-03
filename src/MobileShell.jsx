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
  const winRate = props.stats?.gamesPlayed ? `${pct(props.stats?.gamesWon, props.stats?.gamesPlayed)}%` : '—';
  const cardAccuracy = props.stats?.cardsTotal ? `${pct(props.stats?.cardsCorrect, props.stats?.cardsTotal)}%` : '—';
  const xpPct = pct(props.levelInfo?.currentLevelXp, props.levelInfo?.xpForNextLevel);
  const challenges = props.weeklyChallenges || [];

  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="STATYSTYKI" subtitle="Twój progres, skuteczność i wyzwania." icon={<BarChart3 size={24} />} onBack={() => props.onNavigate('home')} />
      <section className="mob-level-card mob-panel">
        <div className="mob-level-card-top"><span>POZIOM {props.levelInfo?.level || 1}</span><b>{compact(props.levelInfo?.currentLevelXp)} / {compact(props.levelInfo?.xpForNextLevel)} XP</b></div>
        <div className="mob-big-progress"><i style={{ width: `${Math.min(100, xpPct)}%` }} /></div>
        <small>Każda gra, osiągnięcie i wyzwanie przybliża Cię do kolejnego poziomu.</small>
      </section>
      <div className="mob-metric-grid">
        <div className="mob-metric"><Gamepad2 size={18} /><strong>{compact(props.stats?.gamesPlayed)}</strong><span>Rozegrane gry</span></div>
        <div className="mob-metric gold"><Trophy size={18} /><strong>{compact(props.stats?.gamesWon)}</strong><span>Wygrane</span></div>
        <div className="mob-metric pink"><BarChart3 size={18} /><strong>{winRate}</strong><span>% wygranych</span></div>
        <div className="mob-metric green"><Disc3 size={18} /><strong>{cardAccuracy}</strong><span>Trafność kart</span></div>
        <div className="mob-metric violet"><Flame size={18} /><strong>{compact(props.stats?.longestStreak || props.stats?.longestGuessStreak)}</strong><span>Rekordowa seria</span></div>
        <div className="mob-metric cyan"><Music2 size={18} /><strong>{compact(props.stats?.guessesCorrect)}</strong><span>Zgadnięte utwory</span></div>
      </div>

      <section className="mob-panel mob-list-panel">
        <div className="mob-panel-title"><Gift size={17} /> ZADANIA TYGODNIOWE</div>
        {challenges.length ? challenges.map((challenge, index) => {
          const progress = Number(challenge.progress || 0);
          const target = Number(challenge.target || 1);
          const progressPct = Math.min(100, pct(progress, target));
          const claimable = (challenge.done || challenge.completed) && !challenge.claimed;
          return (
            <div className="mob-challenge-row" key={challenge.id || index}>
              <div className="mob-challenge-copy"><strong>{challenge.title || challenge.name || 'Wyzwanie'}</strong><span>{challenge.progressLabel || `${Math.min(progress, target)} / ${target}`} · +{challenge.xp || 0} XP{challenge.hitcoin ? ` +${challenge.hitcoin} HITCOIN` : ''}</span></div>
              <div className="mob-challenge-track"><i style={{ width: `${progressPct}%` }} /></div>
              {claimable ? <button onClick={() => props.onClaimWeeklyChallenge?.(challenge.id)} type="button">ODBIERZ</button> : null}
            </div>
          );
        }) : <div className="mob-empty">Brak aktywnych zadań tygodniowych.</div>}
      </section>

      {props.h2hOpponents?.length ? (
        <section className="mob-panel mob-list-panel">
          <div className="mob-panel-title"><Users size={17} /> POJEDYNKI 1V1</div>
          {props.h2hOpponents.slice(0, 8).map((opponent, index) => (
            <button key={opponent.uid || opponent.id || index} className="mob-h2h-row" type="button" onClick={() => opponent.uid && props.onViewProfile?.(opponent)}>
              <div className="mob-player-avatar" style={opponent.avatarUrl ? { backgroundImage: `url(${opponent.avatarUrl})` } : undefined}>{!opponent.avatarUrl ? initials(opponent.username || opponent.name) : null}</div>
              <div><strong>{opponent.username || opponent.name || 'Gracz'}</strong><span>{opponent.games || opponent.total || 0} pojedynków</span></div>
              <b>{opponent.wins ?? opponent.myWins ?? 0} : {opponent.losses ?? opponent.opponentWins ?? 0}</b>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function MobileCollectionView(props) {
  const [rarity, setRarity] = useState('all');
  const [query, setQuery] = useState('');
  const [ownedOnly, setOwnedOnly] = useState(true);
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

  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="KOLEKCJA" subtitle={`${Object.keys(collection).filter((id) => Number(collection[id] || 0) > 0).length} / ${props.songPoolSize || songs.length} unikalnych kart`} icon={<Disc3 size={24} />} onBack={() => props.onNavigate('home')} />
      <section className="mob-collection-tools mob-panel">
        <div className="mob-search"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj karty…" /></div>
        <button className={ownedOnly ? 'active' : ''} type="button" onClick={() => setOwnedOnly((v) => !v)}>{ownedOnly ? 'TYLKO MOJE' : 'POKAŻ WSZYSTKIE'}</button>
      </section>
      <div className="mob-rarity-tabs">
        {RARITIES.map((item) => {
          const info = rarityCounts[item.key];
          return <button type="button" key={item.key} className={rarity === item.key ? 'active' : ''} style={{ '--rarity': item.color }} onClick={() => setRarity(item.key)}><span>{item.label}</span>{item.key !== 'all' && info ? <small>{info.owned}/{info.total}</small> : null}</button>;
        })}
      </div>
      {props.libraryLoading ? <div className="mob-empty mob-panel">Ładowanie biblioteki…</div> : filtered.length ? (
        <div className="mob-card-grid">
          {filtered.map((song) => {
            const count = Number(collection[song.id] || 0);
            const r = effectiveRarity(song);
            const info = RARITIES.find((item) => item.key === r) || RARITIES[1];
            const thumb = song.videoId ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg` : null;
            return (
              <div className={`mob-song-card ${count < 1 ? 'locked' : ''}`} key={song.id} style={{ '--rarity': info.color }}>
                <div className="mob-song-thumb">{thumb ? <img src={thumb} alt="" /> : <Disc3 size={30} />}{count < 1 ? <div className="mob-song-lock"><Lock size={18} /></div> : null}</div>
                <div className="mob-song-year">{count > 0 ? song.year || '—' : '????'}</div>
                <strong>{count > 0 ? song.title || '—' : 'Nieodkryta karta'}</strong>
                <span>{count > 0 ? song.artist || '—' : info.label}</span>
                {count > 1 ? <b className="mob-song-count">×{count}</b> : null}
              </div>
            );
          })}
        </div>
      ) : <div className="mob-empty mob-panel">Brak kart dla wybranego filtra.</div>}
    </div>
  );
}

function MobileAchievementsView(props) {
  const list = props.achievementProgress || [];
  const claimed = list.filter((item) => item.claimed).length;
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="OSIĄGNIĘCIA" subtitle={`${claimed} / ${list.length} zdobytych`} icon={<Medal size={24} />} onBack={() => props.onNavigate('home')} />
      <section className="mob-achievement-summary mob-panel"><img src={glMedal} alt="" /><div><span>TWÓJ POSTĘP</span><strong>{list.length ? `${pct(claimed, list.length)}%` : '0%'}</strong><div className="mob-big-progress"><i style={{ width: `${list.length ? pct(claimed, list.length) : 0}%` }} /></div></div></section>
      <section className="mob-panel mob-list-panel">
        {list.map((item, index) => {
          const icon = item.claimed ? achOdebrane : item.qualifies ? achDoOdebrania : achZablokowane;
          return (
            <div className={`mob-ach-row ${item.claimed ? 'claimed' : item.qualifies ? 'ready' : 'locked'}`} key={item.id || index}>
              <img src={icon} alt="" />
              <div><strong>{item.name || item.title || 'Osiągnięcie'}</strong><span>{item.desc || item.description || ''}</span></div>
              {item.qualifies && !item.claimed ? <button type="button" onClick={() => props.onClaimAchievement?.(item)}>ODBIERZ</button> : <small>{item.claimed ? 'ZDOBYTE' : item.xp ? `+${item.xp} XP` : ''}</small>}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function MobileRankingView(props) {
  useEffect(() => {
    if (!props.leaderboard) props.onLoadLeaderboard?.(props.leaderboardSort || 'gamesWon');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = props.leaderboard || [];
  return (
    <div className="mob-stack mob-inner-view">
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
  return (
    <div className="mob-stack mob-inner-view">
      <MobileSectionHeader title="SKLEP" subtitle={`Saldo: ${compact(props.hitcoin)} HITCOIN`} icon={<ShoppingCart size={24} />} onBack={() => props.onNavigate('home')} />
      {props.packOpenResult?.length ? (
        <section className="mob-panel mob-pack-result">
          <div className="mob-panel-title"><Sparkles size={17} /> OTWARTA PACZKA</div>
          <div className="mob-pack-result-grid">{props.packOpenResult.map((item, index) => <div key={item.song?.id || index}><strong>{item.song?.year || '—'}</strong><span>{item.song?.title || 'Karta'}</span><small>{item.song?.artist || ''}</small></div>)}</div>
          <button className="mob-main-cta" onClick={props.onClearPackResult} type="button">WRÓĆ DO PACZEK</button>
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
    </div>
  );
}

function MobileProfileSheet({ profile, onClose, levelFromXp }) {
  if (!profile) return null;
  const data = profile.stats || profile;
  const username = profile.username || profile.name || data.username || 'Gracz';
  const level = levelFromXp ? levelFromXp(data.xp || 0) : { level: 1 };
  const rarity = data.cardsByRarity || {};
  const totalCards = Object.values(data.cardCollection || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const uniqueCards = Object.keys(data.cardCollection || {}).filter((id) => Number(data.cardCollection[id] || 0) > 0).length;
  return (
    <div className="mob-sheet-backdrop" onClick={onClose} role="presentation">
      <section className="mob-profile-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="mob-sheet-close" type="button" onClick={onClose}><X size={20} /></button>
        <div className="mob-profile-head"><div className="mob-profile-avatar" style={data.avatarUrl ? { backgroundImage: `url(${data.avatarUrl})` } : undefined}>{!data.avatarUrl ? initials(username) : null}</div><div><span>PROFIL GRACZA</span><h2>{username}</h2><small>LVL {level.level || 1}</small></div></div>
        <div className="mob-profile-metrics"><div><strong>{data.gamesPlayed || 0}</strong><span>Gry</span></div><div><strong>{data.gamesWon || 0}</strong><span>Wygrane</span></div><div><strong>{data.longestStreak || data.longestGuessStreak || 0}</strong><span>Seria</span></div><div><strong>{uniqueCards}</strong><span>Unikalne</span></div></div>
        <div className="mob-profile-collection"><div className="mob-panel-title"><Disc3 size={17} /> KOLEKCJA</div><div className="mob-profile-rarity"><span>Winyl <b>{rarity.winyl || 0}</b></span><span>Srebro <b>{rarity.srebrna || 0}</b></span><span>Złoto <b>{rarity.zlota || 0}</b></span><span>Platyna <b>{rarity.platynowa || 0}</b></span><span>Diament <b>{rarity.diamentowa || 0}</b></span></div><div className="mob-profile-total"><span>ŁĄCZNIE KART</span><strong>{totalCards}</strong></div></div>
      </section>
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
