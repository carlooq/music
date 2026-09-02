import React, { useEffect, useMemo, useState } from 'react';
import {
  Gamepad2,
  DoorOpen,
  Disc3,
  BarChart3,
  Medal,
  Crown,
  ShoppingCart,
  Users,
  Settings,
  Star,
  Music2,
  Coins,
  Trophy,
  Gift,
  Flame,
  ChevronRight,
  Play,
  Search,
  Plus,
  CheckCircle2,
  CalendarDays,
  ListMusic,
  Sparkles,
  AudioWaveform,
} from 'lucide-react';

import logoImg from './assets/logo-v2.png';
import heroBanner from './assets/home/hero-banner.webp';
import homeBg from './assets/home/bg.jpg';
import footerStrip from './assets/home/footer-strip.webp';
import glTrening from './assets/icons/gl-trening.png';
import glHitRush from './assets/icons/gl-hitrush.png';
import glPiosenka from './assets/icons/gl-piosenka.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glTurniej from './assets/icons/gl-turniej.png';
import glKolekcja from './assets/icons/gl-kolekcja.png';
import glMedal from './assets/icons/gl-medal.png';
import glStatystyki from './assets/icons/gl-statystyki.png';
import glKorona from './assets/icons/gl-korona.png';
import glKoszyk from './assets/icons/gl-koszyk.png';
import glOsoba from './assets/icons/gl-osoba.png';
import glPrezent from './assets/icons/gl-prezent.png';
import iconToken from './assets/icons/icon-token.png';
import iconHitcoin from './assets/icons/icon-hitcoin.png';
import iconZaproponuj from './assets/icons/zaproponuj.png';
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
import { effectiveRarity } from './cards.js';

const DESKTOP_RARITY_ORDER = ['winyl', 'srebrna', 'zlota', 'platynowa', 'diamentowa'];
const DESKTOP_RARITY_INFO = {
  winyl: { label: 'Winyl', color: '#aab8c4', frame: cardWinylImg },
  srebrna: { label: 'Srebrna Płyta', color: '#dbe6ee', frame: cardSrebroImg },
  zlota: { label: 'Złota Płyta', color: '#ffd66b', frame: cardZlotoImg },
  platynowa: { label: 'Platynowa Płyta', color: '#c4b5fd', frame: cardPlatynaImg },
  diamentowa: { label: 'Diamentowa Płyta', color: '#7dffef', frame: cardDiamentImg },
};

function DesktopCollectibleCard({ song, ownedCount = 1, onOpen }) {
  const rarity = effectiveRarity(song);
  const info = DESKTOP_RARITY_INFO[rarity] || DESKTOP_RARITY_INFO.winyl;
  const thumbUrl = song.videoId ? `https://img.youtube.com/vi/${song.videoId}/hqdefault.jpg` : null;
  return (
    <button type="button" className={`desk-collectible-card rarity-${rarity}`} onClick={() => onOpen?.(song)} style={{ '--rarity-color': info.color }}>
      <img src={info.frame} alt="" className="desk-collectible-frame" />
      {thumbUrl ? <div className="desk-collectible-thumb"><img src={thumbUrl} alt="" /></div> : <div className="desk-collectible-thumb desk-collectible-thumb-empty">♪</div>}
      <div className="desk-collectible-copy">
        <div className="desk-collectible-year">{song.year || '—'}</div>
        <div className="desk-collectible-artist">{song.artist || '—'}</div>
        <div className="desk-collectible-title">{song.title || '—'}</div>
      </div>
      {ownedCount > 1 ? <span className="desk-collectible-count">×{ownedCount}</span> : null}
    </button>
  );
}

function DesktopLockedCard({ rarity }) {
  const info = DESKTOP_RARITY_INFO[rarity] || DESKTOP_RARITY_INFO.winyl;
  return (
    <div className="desk-collectible-locked" style={{ '--rarity-color': info.color }}>
      <div className="desk-collectible-lock-icon">🔒</div>
      <div>?</div>
    </div>
  );
}

function pct(correct, total) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

function formatCompact(num) {
  return new Intl.NumberFormat('pl-PL').format(Number(num || 0));
}

function initials(label) {
  const raw = String(label || 'G').trim();
  const parts = raw.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || raw.slice(0, 1).toUpperCase();
}

function sortDecades(entries = []) {
  return [...entries].sort((a, b) => {
    const an = parseInt(String(a.label).replace(/\D/g, ''), 10) || 0;
    const bn = parseInt(String(b.label).replace(/\D/g, ''), 10) || 0;
    return an - bn;
  });
}

function DesktopTopPill({ icon, children, accent = 'cyan', wide = false, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`desk-pill ${accent} ${wide ? 'wide' : ''} ${onClick ? 'clickable' : ''}`}>{icon}<span>{children}</span></Tag>;
}

function DesktopStatCard({ icon, label, value, note, accent = 'cyan', action, onClick }) {
  return (
    <button className={`desk-stat-card ${accent}`} onClick={onClick}>
      <div className="desk-stat-card-head">
        <img src={icon} alt="" />
        <span>{label}</span>
      </div>
      <div className="desk-stat-card-value">{value}</div>
      {note ? <div className="desk-stat-card-note">{note}</div> : null}
      {action ? <div className="desk-stat-card-action">{action} <ChevronRight size={16} /></div> : null}
    </button>
  );
}

function DesktopModeCard({ icon, title, desc, accent = 'cyan', badge, footer, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`desk-mode-card ${accent} ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
      {badge ? <div className="desk-mode-badge">{badge}</div> : null}
      <img src={icon} alt="" className="desk-mode-icon" />
      <div className="desk-mode-title">{title}</div>
      <div className="desk-mode-desc">{desc}</div>
      <div className="desk-mode-footer">
        <span>{footer}</span>
        {onClick ? <div className="desk-mode-arrow"><ChevronRight size={18} /></div> : null}
      </div>
    </Tag>
  );
}

function DesktopRailCard({ icon, title, value, desc, accent = 'violet', actionLabel, onClick, children }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`desk-rail-card ${accent} ${onClick ? 'is-clickable' : ''}`} onClick={onClick}>
      <div className="desk-rail-icon-wrap">{typeof icon === 'string' ? <img src={icon} alt="" /> : icon}</div>
      <div className="desk-rail-copy">
        <div className="desk-rail-title">{title}</div>
        {value ? <div className="desk-rail-value">{value}</div> : null}
        {desc ? <div className="desk-rail-desc">{desc}</div> : null}
        {children}
      </div>
      {actionLabel && onClick ? <div className="desk-rail-action">{actionLabel}</div> : null}
    </Tag>
  );
}

function ProgressBar({ value = 0 }) {
  return (
    <div className="desk-progress-bar">
      <div className="desk-progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function SidebarNav({ active = 'home', onHome, onRooms, onAlbum, onStats, onAchievements, onLeaderboard, onShop, onCommunity, onAdmin, adminUnlocked = false }) {
  const items = [
    { key: 'home', label: 'GRAJ TERAZ', icon: <Gamepad2 size={20} />, onClick: onHome },
    { key: 'rooms', label: 'POKÓJ', icon: <DoorOpen size={20} />, onClick: onRooms || onHome },
    { key: 'collection', label: 'KOLEKCJA', icon: <Disc3 size={20} />, onClick: onAlbum },
    { key: 'stats', label: 'STATYSTYKI', icon: <BarChart3 size={20} />, onClick: onStats },
    { key: 'achievements', label: 'OSIĄGNIĘCIA', icon: <Medal size={20} />, onClick: onAchievements },
    { key: 'ranking', label: 'RANKING', icon: <Crown size={20} />, onClick: onLeaderboard },
    { key: 'shop', label: 'SKLEP', icon: <ShoppingCart size={20} />, onClick: onShop },
    { key: 'community', label: 'SPOŁECZNOŚĆ', icon: <Users size={20} />, onClick: onCommunity },
  ];
  return (
    <aside className="desk-sidebar">
      <button type="button" className="desk-brand" onClick={onHome} title="Strona główna">
        <img src={logoImg} alt="Hitsteriada" />
      </button>
      <div className="desk-sidebar-nav">
        {items.map((item) => (
          <button key={item.key} className={`desk-nav-item ${active === item.key ? 'active' : ''}`} onClick={item.onClick}>
            <span className="desk-nav-icon">{item.icon}</span>
            <span className="desk-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className={`desk-admin-entry ${adminUnlocked ? 'unlocked' : ''}`} onClick={onAdmin}>
        <Settings size={18} />
        <span>{adminUnlocked ? 'PANEL ADMINA' : 'TRYB ADMINA'}</span>
      </button>
      <div className="desk-mini-player">
        <div className="desk-mini-wave" style={{ backgroundImage: `url(${footerStrip})` }} />
        <div className="desk-mini-meta">
          <div className="desk-mini-title">Hitsteriada Mix</div>
          <div className="desk-mini-artist">Game soundtrack</div>
        </div>
        <div className="desk-mini-play"><Play size={18} /></div>
      </div>
    </aside>
  );
}

function DesktopLayout({ active, topRight, onHome, onRooms, onAlbum, onStats, onAchievements, onLeaderboard, onShop, onCommunity, onAdmin, adminUnlocked = false, children }) {
  return (
    <div className="desk-root" style={{ backgroundImage: `linear-gradient(180deg, rgba(3,6,19,0.70), rgba(3,6,19,0.94)), url(${homeBg})` }}>
      <div className="desk-shell">
        <SidebarNav active={active} onHome={onHome} onRooms={onRooms} onAlbum={onAlbum} onStats={onStats} onAchievements={onAchievements} onLeaderboard={onLeaderboard} onShop={onShop} onCommunity={onCommunity} onAdmin={onAdmin} adminUnlocked={adminUnlocked} />
        <div className="desk-content">{children}</div>
      </div>
      {topRight}
    </div>
  );
}

function HeaderBar({ onlineCount, level, xpText, musicCount, hitcoin, avatarUrl, username, onCommunity, onStats, onShop, onAvatarUpload, avatarUploadBusy }) {
  return (
    <div className="desk-header-bar">
      <DesktopTopPill icon={<span className="desk-dot" />} accent="green" onClick={onCommunity}>{onlineCount} graczy online</DesktopTopPill>
      <DesktopTopPill icon={<Star size={16} />} accent="cyan" wide onClick={onStats}>LVL {level} <span className="desk-pill-sub">{xpText}</span></DesktopTopPill>
      <DesktopTopPill icon={<Music2 size={16} />} accent="pink" onClick={onStats}>{musicCount}</DesktopTopPill>
      <DesktopTopPill icon={<img src={iconHitcoin} alt="" className="desk-pill-coin" />} accent="gold" onClick={onShop}>{hitcoin}</DesktopTopPill>
      {onAvatarUpload ? (
        <label className={`desk-user-pill desk-avatar-uploader ${avatarUploadBusy ? 'busy' : ''}`} title="Kliknij, aby zmienić avatar">
          <input type="file" accept="image/*" disabled={avatarUploadBusy} onChange={(e) => e.target.files?.[0] && onAvatarUpload(e.target.files[0])} />
          <div className="desk-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>
            {!avatarUrl ? initials(username) : null}
            <span className="desk-avatar-edit">✎</span>
          </div>
          <span>{username}</span>
        </label>
      ) : (
        <button type="button" className="desk-user-pill" onClick={onStats}>
          <div className="desk-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{!avatarUrl ? initials(username) : null}</div>
          <span>{username}</span>
        </button>
      )}
      <button type="button" className="desk-gear-btn" onClick={onStats} title="Profil i statystyki"><Settings size={18} /></button>
    </div>
  );
}

export function DesktopPlayerProfileModal({ profile, onClose, levelFromXp }) {
  if (!profile) return null;
  const playerStats = profile.stats || {};
  const levelInfo = levelFromXp ? levelFromXp(playerStats.xp || 0) : null;
  const winRate = playerStats.gamesPlayed ? Math.round(((playerStats.gamesWon || 0) / playerStats.gamesPlayed) * 100) : 0;
  const accuracy = playerStats.cardsTotal ? Math.round(((playerStats.cardsCorrect || 0) / playerStats.cardsTotal) * 100) : 0;
  const collectionCount = Object.keys(playerStats.cardCollection || {}).length;
  return (
    <div className="desk-profile-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="desk-profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="desk-profile-close" onClick={onClose}>×</button>
        <div className="desk-profile-head">
          <div className="desk-profile-avatar" style={playerStats.avatarUrl ? { backgroundImage: `url(${playerStats.avatarUrl})` } : undefined}>{!playerStats.avatarUrl ? initials(profile.username || 'G') : null}</div>
          <div>
            <span>PROFIL GRACZA</span>
            <h2>{profile.username || playerStats.username || 'Gracz'}</h2>
            <p>{levelInfo ? `LVL ${levelInfo.level} · ${playerStats.xp || 0} XP` : `${playerStats.xp || 0} XP`}</p>
          </div>
        </div>
        <div className="desk-profile-metrics">
          <div><span>ROZEGRANE</span><strong>{formatCompact(playerStats.gamesPlayed || 0)}</strong></div>
          <div><span>WYGRANE</span><strong>{formatCompact(playerStats.gamesWon || 0)}</strong></div>
          <div><span>% WYGRANYCH</span><strong>{winRate}%</strong></div>
          <div><span>TRAFNOŚĆ KART</span><strong>{accuracy}%</strong></div>
          <div><span>REKORDOWA SERIA</span><strong>{formatCompact(playerStats.longestStreak || 0)}</strong></div>
          <div><span>KOLEKCJA</span><strong>{formatCompact(collectionCount)}</strong></div>
        </div>
        <div className="desk-profile-secondary">
          <div><span>ZGADNIĘTE TYTUŁY / WYKONAWCY</span><strong>{formatCompact(playerStats.guessesCorrect || 0)}</strong></div>
          <div><span>PLAYLISTA DNIA</span><strong>{formatCompact(playerStats.playlistTotalScore || 0)} pkt</strong></div>
          <div><span>HIT RUSH</span><strong>{formatCompact(playerStats.hitRushBestScore || 0)} pkt</strong></div>
        </div>
      </section>
    </div>
  );
}

export function DesktopHomeView(props) {
  const {
    user,
    stats,
    onlinePlayers,
    levelInfo,
    songPoolSize,
    joinCode,
    setJoinCode,
    onCreateRoom,
    onJoinRoom,
    onPractice,
    onHitRush,
    onDailySong,
    onDailyPlaylist,
    onTournament,
    onAlbum,
    onStats,
    onAchievements,
    onLeaderboard,
    onShop,
    onCommunity,
    onHome,
    onPropose,
    activeTournament,
    lastCompletedTournament,
    weeklySummary,
    totalAchievements,
  } = props;

  const username = props.playerName || user?.displayName || user?.username || 'Gracz';
  const collectionCount = Object.keys(stats?.cardCollection || {}).length;
  const winRate = stats?.gamesPlayed ? `${pct(stats.gamesWon || 0, stats.gamesPlayed)}%` : '0%';
  const accuracy = stats?.cardsTotal ? `${pct(stats.cardsCorrect || 0, stats.cardsTotal)}%` : '0%';
  const currentWeek = weeklySummary?.current || { title: 'Zagraj 3 gry', progressLabel: '0 / 3', progressPct: 0, reward: '+50 XP' };
  const todayClaimed = stats?.lastDailyHitcoinDate === props.todayKey;

  return (
    <DesktopLayout
      active="home"
      onHome={onHome}
      onAlbum={onAlbum}
      onStats={onStats}
      onAchievements={onAchievements}
      onLeaderboard={onLeaderboard}
      onShop={onShop}
      onCommunity={onCommunity}
      onAdmin={props.onAdmin}
      adminUnlocked={props.adminUnlocked}
    >
      <HeaderBar
        onlineCount={onlinePlayers.length}
        level={levelInfo.level}
        xpText={`${levelInfo.currentLevelXp} / ${levelInfo.xpForNextLevel} XP`}
        musicCount={formatCompact(stats?.heardSongs?.length || 0)}
        hitcoin={formatCompact(props.hitcoin ?? stats?.hitcoin ?? 0)}
        avatarUrl={stats?.avatarUrl}
        username={username}
        onCommunity={onCommunity}
        onStats={onStats}
        onShop={onShop}
        onAvatarUpload={props.onAvatarUpload}
        avatarUploadBusy={props.avatarUploadBusy}
      />

      <div className="desk-main-stack">
        <div className="desk-hero-grid">
          <section className="desk-hero-left desk-panel cyan-glow">
            <div className="desk-panel-tag">GRAJ TERAZ</div>
            <h1 className="desk-hero-title">Twój utwór. <span>Twoja zasada.</span></h1>
            <p className="desk-hero-subtitle">Stwórz pokój lub dołącz do gry i baw się muzyką!</p>
            <div className="desk-room-card">
              <div className="desk-room-create">
                <div className="desk-room-eyebrow">STWÓRZ POKÓJ</div>
                <button className="desk-primary-cta" onClick={onCreateRoom}>STWÓRZ POKÓJ <Plus size={24} /></button>
                <div className="desk-room-note">Ty wybierasz zasady. Zaproś znajomych!</div>
              </div>
              <div className="desk-room-divider">LUB</div>
              <div className="desk-room-join">
                <div className="desk-room-eyebrow">DOŁĄCZ DO POKOJU</div>
                <div className="desk-join-row">
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Wpisz kod pokoju"
                    maxLength={6}
                  />
                  <button className="desk-secondary-cta" onClick={() => onJoinRoom()}>DOŁĄCZ</button>
                </div>
                <div className="desk-room-note">Masz kod od znajomego? Wskakuj od razu do rozgrywki.</div>
              </div>
            </div>
          </section>

          <section className="desk-hero-right desk-panel pink-glow" style={{ backgroundImage: `linear-gradient(180deg, rgba(8,8,20,0.2), rgba(8,8,20,0.6)), url(${heroBanner})` }}>
            <div className="desk-hero-right-copy">
              <div className="desk-panel-tag">NOWOŚCI I WYDARZENIA</div>
              <h2>Muzyka łączy.<br /><span>Hity zostają.</span></h2>
              <p>Rywalizuj, odkrywaj, zdobywaj nagrody i wspinaj się na szczyt rankingu!</p>
              <button type="button" className="desk-outline-btn" onClick={() => document.querySelector('.desk-modes-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>DOWIEDZ SIĘ WIĘCEJ <ChevronRight size={18} /></button>
            </div>
            <div className="desk-hero-dots">
              <span className="active" />
              <span />
              <span />
              <span />
            </div>
          </section>
        </div>

        <div className="desk-section-grid">
          <div className="desk-left-column">
            <div className="desk-section-label"><Sparkles size={16} /> TRYBY GRY</div>
            <div className="desk-modes-grid">
              <DesktopModeCard icon={glTrening} title="TRENING" desc="Ćwicz i poznawaj kategorie" accent="cyan" footer="Ćwicz w swoim tempie" onClick={onPractice} />
              <DesktopModeCard icon={glHitRush} title="HIT RUSH" desc="Szybki tryb solo z presją czasu" accent="green" footer="Nowy rekord czeka" onClick={onHitRush} />
              <DesktopModeCard icon={glPiosenka} title="PIOSENKA DNIA" desc="Jedna piosenka dla wszystkich" accent="pink" footer="Codzienna szansa" onClick={onDailySong} />
              <DesktopModeCard icon={glPlaylista} title="PLAYLISTA DNIA" desc="Codzienna nowa playlista" accent="violet" footer="Porównaj się z innymi" onClick={onDailyPlaylist} />
              <DesktopModeCard icon={glTurniej} title="TURNIEJ" desc="Rywalizuj o najwyższe miejsca" accent="gold" badge="PREMIUM" footer={activeTournament ? `${activeTournament.signups?.length || 0}/${activeTournament.maxPlayers || 0} zapisanych` : lastCompletedTournament ? `Wygrał: ${lastCompletedTournament.signups?.find((p) => p.uid === lastCompletedTournament.winnerUid)?.name || '?'}` : 'Wkrótce kolejny'} onClick={onTournament} />
            </div>

            <div className="desk-section-label"><BarChart3 size={16} /> TWÓJ POSTĘP</div>
            <div className="desk-progress-grid">
              <DesktopStatCard icon={glKolekcja} label="KOLEKCJA" value={`${collectionCount}/${songPoolSize}`} note="Utworów odblokowanych" action="ZOBACZ KOLEKCJĘ" onClick={onAlbum} />
              <DesktopStatCard icon={glMedal} label="OSIĄGNIĘCIA" value={`${weeklySummary?.achievementClaimed || 0}/${totalAchievements}`} note="Odblokowanych" action="ZOBACZ OSIĄGNIĘCIA" onClick={onAchievements} />
              <DesktopStatCard icon={glStatystyki} label="STATYSTYKI" value={winRate} note="Śr. dokładność" action="ZOBACZ STATYSTYKI" onClick={onStats} />
              <DesktopStatCard icon={glKorona} label="RANKING" value={props.leaderboardPosition ? `#${formatCompact(props.leaderboardPosition)}` : "—"} note="Twoja pozycja" accent="gold" action="ZOBACZ RANKING" onClick={onLeaderboard} />
              <DesktopStatCard icon={glKoszyk} label="SKLEP" value="Nowe przedmioty!" note="Sprawdź oferty i odblokuj" accent="cyan" action="PRZEJDŹ DO SKLEPU" onClick={onShop} />
              <DesktopStatCard icon={glOsoba} label="SPOŁECZNOŚĆ" value={`${onlinePlayers.length}`} note="Graczy online" accent="pink" action="ZOBACZ SPOŁECZNOŚĆ" onClick={onCommunity} />
            </div>
          </div>

          <div className="desk-right-rail">
            <DesktopRailCard icon={<Flame size={20} />} title="PASSA" value={`${stats?.longestStreak || 0}`} desc="najlepsza seria trafień" accent="pink" />
            <DesktopRailCard icon={glPrezent} title="NAGRODA DNIA" value={todayClaimed ? 'ODEBRANA' : 'GOTOWA'} desc={todayClaimed ? 'Wróć jutro po następną próbę.' : 'Nagroda czeka w panelu statystyk.'} accent="cyan" />
            <DesktopRailCard icon={iconZaproponuj} title="ZAPROPONUJ UTWÓR" value="Masz pomysł na hit?" desc="Zgłoś utwór społeczności!" accent="violet" onClick={onPropose} />
            <DesktopRailCard icon={<Users size={20} />} title="ZNAJOMI ONLINE" value={`${onlinePlayers.length} aktywnych`} desc={onlinePlayers.length ? 'Dołącz do społeczności' : 'Nikt poza Tobą nie gra w tej chwili.'} accent="cyan">
              <div className="desk-online-row">
                {onlinePlayers.slice(0, 5).map((player, index) => (
                  <button
                    type="button"
                    key={player.id || player.uid || index}
                    className="desk-online-avatar"
                    style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}
                    onClick={() => player.uid && props.onViewProfile?.(player)}
                    title={player.uid ? `Profil: ${player.name || player.username || 'Gracz'}` : (player.name || 'Gracz')}
                  >
                    {!player.avatarUrl ? initials(player.username || player.name || 'G') : null}
                  </button>
                ))}
                {onlinePlayers.length > 5 ? <div className="desk-online-avatar more">+{onlinePlayers.length - 5}</div> : null}
              </div>
            </DesktopRailCard>
          </div>
        </div>

      </div>
    </DesktopLayout>
  );
}

function StatMetric({ icon, value, label, accent = 'cyan' }) {
  return (
    <div className={`desk-metric-card ${accent}`}>
      <div className="desk-metric-icon">{icon}</div>
      <div className="desk-metric-value">{value}</div>
      <div className="desk-metric-label">{label}</div>
    </div>
  );
}

function DecadeBar({ item }) {
  return (
    <div className="desk-decade-row">
      <span>{item.label}</span>
      <span>{item.correct}/{item.total}</span>
      <div className="desk-decade-track"><div className="desk-decade-fill" style={{ width: `${item.pct}%` }} /></div>
      <span className="pct">{item.pct}%</span>
    </div>
  );
}

function DecadeCircle({ item, accent = 'green' }) {
  const dash = 251.2;
  const offset = dash * (1 - (item.pct || 0) / 100);
  return (
    <div className={`desk-decade-circle-card ${accent}`}>
      <svg viewBox="0 0 100 100">
        <circle className="bg" cx="50" cy="50" r="40" />
        <circle className="fg" cx="50" cy="50" r="40" style={{ strokeDasharray: dash, strokeDashoffset: offset }} />
      </svg>
      <div className="desk-decade-circle-copy">
        <div className="decade">{item.label}</div>
        <div className="score">{item.correct} / {item.total}</div>
        <div className="percent">{item.pct}%</div>
      </div>
    </div>
  );
}

export function DesktopStatsView(props) {
  const {
    user,
    stats,
    onlinePlayers,
    levelInfo,
    songPoolSize,
    totalAchievements,
    achievementClaimed,
    currentWeekly,
    weeklyChallenges = [],
    onClaimWeeklyChallenge,
    decadeEntries,
    bestArtists = [],
    worstArtists = [],
    onHome,
    onAlbum,
    onStats,
    onAchievements,
    onLeaderboard,
    onShop,
    onCommunity,
  } = props;

  const username = props.playerName || user?.displayName || user?.username || 'Gracz';
  const progressPct = levelInfo.xpForNextLevel ? Math.round((levelInfo.currentLevelXp / levelInfo.xpForNextLevel) * 100) : 0;
  const collectionCount = Object.keys(stats?.cardCollection || {}).length;

  return (
    <DesktopLayout
      active="stats"
      onHome={onHome}
      onAlbum={onAlbum}
      onStats={onStats}
      onAchievements={onAchievements}
      onLeaderboard={onLeaderboard}
      onShop={onShop}
      onCommunity={onCommunity}
      onAdmin={props.onAdmin}
      adminUnlocked={props.adminUnlocked}
    >
      <HeaderBar
        onlineCount={onlinePlayers.length}
        level={levelInfo.level}
        xpText={`${levelInfo.currentLevelXp} / ${levelInfo.xpForNextLevel} XP`}
        musicCount={formatCompact(stats?.heardSongs?.length || 0)}
        hitcoin={formatCompact(props.hitcoin ?? stats?.hitcoin ?? 0)}
        avatarUrl={stats?.avatarUrl}
        username={username}
        onCommunity={onCommunity}
        onStats={onStats}
        onShop={onShop}
        onAvatarUpload={props.onAvatarUpload}
        avatarUploadBusy={props.avatarUploadBusy}
      />

      <div className="desk-main-stack">
        <section className="desk-stats-hero desk-panel cyan-glow">
          <div className="desk-stats-copy">
            <h1>TWOJE STATYSTYKI</h1>
            <div className="desk-level-card">
              <div className="desk-level-top">
                <span>POZIOM {levelInfo.level}</span>
                <span>{levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP</span>
              </div>
              <ProgressBar value={progressPct} />
              <div className="desk-level-note">Jeszcze {Math.max(0, levelInfo.xpForNextLevel - levelInfo.currentLevelXp)} XP do następnego poziomu</div>
            </div>
          </div>
          <div className="desk-stats-art" style={{ backgroundImage: `linear-gradient(180deg, rgba(5,8,20,0.1), rgba(5,8,20,0.5)), url(${heroBanner})` }} />
        </section>

        <div className="desk-stats-feature-grid">
          <button className="desk-feature-card cyan clickable" onClick={props.onOpenDailyReward}>
            <div className="desk-feature-head"><Gift size={22} /> CODZIENNA NAGRODA</div>
            <div className="desk-feature-copy">
              <div className="desk-feature-big">{stats?.lastDailyHitcoinDate === props.todayKey ? 'ODEBRANA' : 'GOTOWA'}</div>
              <div className="desk-feature-small">{stats?.lastDailyHitcoinDate === props.todayKey ? 'Wróć jutro po kolejną próbę' : 'Kliknij i odbierz dzienny bonus'}</div>
            </div>
          </button>
          <button className="desk-feature-card gold clickable" onClick={onAchievements}>
            <div className="desk-feature-head"><Trophy size={22} /> OSIĄGNIĘCIA</div>
            <div className="desk-feature-copy">
              <div className="desk-feature-big">{achievementClaimed} / {totalAchievements}</div>
              <div className="desk-feature-small">Odblokowanych osiągnięć</div>
              <ProgressBar value={Math.round((achievementClaimed / Math.max(1, totalAchievements)) * 100)} />
            </div>
          </button>
          <button className="desk-feature-card cyan clickable" onClick={onAlbum}>
            <div className="desk-feature-head"><Disc3 size={22} /> ALBUM</div>
            <div className="desk-feature-copy feature-row-right">
              <div>
                <div className="desk-feature-big">{collectionCount}</div>
                <div className="desk-feature-small">unikalnych kart</div>
              </div>
              <img src={glKolekcja} alt="" className="desk-feature-art" />
            </div>
          </button>
        </div>

        <section className="desk-weekly-panel desk-panel">
          <div className="desk-weekly-head">
            <div>
              <div className="desk-section-label solo"><CalendarDays size={18} /> WYZWANIA TYGODNIA</div>
              <p>Co tydzień losowanych jest dokładnie 5 zadań — każde z osobną nagrodą.</p>
            </div>
            <div className="desk-weekly-counter">{weeklyChallenges.filter((item) => item.claimed).length}/5 ODEBRANYCH</div>
          </div>
          <div className="desk-weekly-grid">
            {weeklyChallenges.map((challenge) => {
              const progressPct = challenge.target ? Math.min(100, Math.round(((challenge.progress || 0) / challenge.target) * 100)) : 0;
              return (
                <div key={challenge.id} className={`desk-weekly-card ${challenge.claimed ? 'claimed' : challenge.done ? 'ready' : ''}`}>
                  <div className="desk-weekly-card-top">
                    <span className="desk-weekly-index">#{weeklyChallenges.indexOf(challenge) + 1}</span>
                    <span>{challenge.claimed ? '✓ ODEBRANE' : challenge.done ? 'GOTOWE' : `${Math.min(challenge.progress || 0, challenge.target || 0)}/${challenge.target || 0}`}</span>
                  </div>
                  <div className="desk-weekly-title">{challenge.desc}</div>
                  <ProgressBar value={progressPct} />
                  <div className="desk-weekly-reward">+{challenge.xp || 0} XP{challenge.hitcoin ? ` · +${challenge.hitcoin} HITCOIN` : ''}</div>
                  {challenge.done && !challenge.claimed ? <button onClick={() => onClaimWeeklyChallenge?.(challenge.id)}>ODBIERZ NAGRODĘ</button> : null}
                </div>
              );
            })}
          </div>
        </section>

        <div className="desk-stats-mid-grid">
          <section className="desk-summary-panel desk-panel">
            <div className="desk-section-label solo">PODSUMOWANIE STATYSTYK</div>
            <div className="desk-metric-grid">
              <StatMetric icon={<Gamepad2 size={22} />} value={formatCompact(stats?.gamesPlayed || 0)} label="ROZEGRANE GRY" accent="cyan" />
              <StatMetric icon={<Trophy size={22} />} value={formatCompact(stats?.gamesWon || 0)} label="WYGRANE" accent="gold" />
              <StatMetric icon={<Coins size={22} />} value={`${pct(stats?.gamesWon || 0, stats?.gamesPlayed || 0)}%`} label="% WYGRANYCH" accent="violet" />
              <StatMetric icon={<Search size={22} />} value={`${pct(stats?.cardsCorrect || 0, stats?.cardsTotal || 0)}%`} label="TRAFNOŚĆ KART" accent="cyan" />
              <StatMetric icon={<Flame size={22} />} value={formatCompact(stats?.longestStreak || 0)} label="REKORDOWY STREAK" accent="pink" />
              <StatMetric icon={<Users size={22} />} value={formatCompact(stats?.guessesCorrect || 0)} label="ODGADNIĘTE WYKONAWCY" accent="violet" />
              <StatMetric icon={<AudioWaveform size={22} />} value={`${formatCompact(stats?.heardSongs?.length || 0)} / ${songPoolSize}`} label="PRZESŁUCHANE PIOSENKI" accent="cyan" />
              <StatMetric icon={<ListMusic size={22} />} value={`${formatCompact(stats?.guessedSongs?.length || 0)} / ${songPoolSize}`} label="ODGADNIĘTE PIOSENKI" accent="pink" />
              <StatMetric icon={<Coins size={22} />} value={formatCompact(stats?.songsAdded || 0)} label="DODANE DO BAZY" accent="violet" />
            </div>
          </section>

          <section className="desk-decade-panel desk-panel">
            <div className="desk-section-label solo">SKUTECZNOŚĆ WG DEKAD</div>
            <div className="desk-decade-table">
              <div className="desk-decade-head"><span>DEKADA</span><span>ODGADNIĘTE</span><span>SKUTECZNOŚĆ</span><span></span></div>
              {sortDecades(decadeEntries).map((item) => <DecadeBar key={item.label} item={item} />)}
            </div>
          </section>
        </div>

        <div className="desk-bestworst-grid artist-performance-grid">
          <section className="desk-bestworst-panel green">
            <div className="desk-bestworst-title"><Crown size={20} /> NAJLEPIEJ ZGADUJESZ — TOP 5 WYKONAWCÓW</div>
            <div className="desk-artist-performance-list">
              {bestArtists.length ? bestArtists.map((artist, index) => (
                <div key={`${artist.name}-${index}`} className="desk-artist-performance-row green">
                  <div className="desk-artist-rank">#{index + 1}</div>
                  <div className="desk-artist-copy">
                    <strong>{artist.name}</strong>
                    <span>{artist.correct}/{artist.total} poprawnych odpowiedzi</span>
                  </div>
                  <div className="desk-artist-meter"><div style={{ width: `${Math.round((artist.pct || 0) * 100)}%` }} /></div>
                  <div className="desk-artist-percent">{Math.round((artist.pct || 0) * 100)}%</div>
                </div>
              )) : <div className="desk-empty-performance">Za mało danych — wykonawca pojawi się po co najmniej 2 próbach.</div>}
            </div>
          </section>
          <section className="desk-bestworst-panel pink">
            <div className="desk-bestworst-title"><Flame size={20} /> NAJGORZEJ ZGADUJESZ — TOP 5 WYKONAWCÓW</div>
            <div className="desk-artist-performance-list">
              {worstArtists.length ? worstArtists.map((artist, index) => (
                <div key={`${artist.name}-${index}`} className="desk-artist-performance-row pink">
                  <div className="desk-artist-rank">#{index + 1}</div>
                  <div className="desk-artist-copy">
                    <strong>{artist.name}</strong>
                    <span>{artist.correct}/{artist.total} poprawnych odpowiedzi</span>
                  </div>
                  <div className="desk-artist-meter"><div style={{ width: `${Math.round((artist.pct || 0) * 100)}%` }} /></div>
                  <div className="desk-artist-percent">{Math.round((artist.pct || 0) * 100)}%</div>
                </div>
              )) : <div className="desk-empty-performance">Za mało danych — wykonawca pojawi się po co najmniej 2 próbach.</div>}
            </div>
          </section>
        </div>
      </div>
    </DesktopLayout>
  );
}

function DesktopSimpleHeader({ title, subtitle, icon }) {
  return (
    <div className="desk-page-heading">
      <div className="desk-page-heading-icon">{icon}</div>
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function DesktopAchievementsView({ common, progress, onClaim }) {
  const groups = useMemo(() => {
    const map = new Map();
    (progress || []).forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    });
    return Array.from(map.entries());
  }, [progress]);

  return (
    <DesktopLayout active="achievements" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader title="OSIĄGNIĘCIA" subtitle="Odblokowuj kolejne cele, odbieraj XP i rozwijaj swój profil gracza." icon={<Medal size={28} />} />
        <section className="desk-achievement-summary desk-panel">
          <div>
            <div className="desk-achievement-big">{progress.filter((x) => x.claimed).length} / {progress.length}</div>
            <div className="desk-achievement-caption">odebranych osiągnięć</div>
          </div>
          <ProgressBar value={Math.round((progress.filter((x) => x.claimed).length / Math.max(1, progress.length)) * 100)} />
        </section>
        <div className="desk-achievement-groups">
          {groups.map(([category, items]) => (
            <section key={category} className="desk-achievement-group desk-panel">
              <div className="desk-section-label solo"><Sparkles size={16} /> {category.toUpperCase()}</div>
              <div className="desk-achievement-grid">
                {items.map((item) => {
                  const icon = item.claimed ? achOdebrane : item.qualifies ? achDoOdebrania : achZablokowane;
                  const status = item.claimed ? 'ODEBRANE' : item.qualifies ? 'DO ODEBRANIA' : 'ZABLOKOWANE';
                  return (
                    <div key={item.id} className={`desk-achievement-card ${item.claimed ? 'claimed' : item.qualifies ? 'ready' : 'locked'}`}>
                      <img src={icon} alt="" />
                      <div className="desk-achievement-card-copy">
                        <div className="desk-achievement-card-title">{item.name}</div>
                        <div className="desk-achievement-card-desc">{item.desc}</div>
                        <div className="desk-achievement-card-meta">+{item.xp} XP • {status}</div>
                      </div>
                      {item.qualifies && !item.claimed ? (
                        <button className="desk-achievement-claim" onClick={() => onClaim(item)}>ODBIERZ</button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </DesktopLayout>
  );
}

function DesktopLeaderboardView({ common, leaderboard, sortBy, onSort, onViewProfile }) {
  useEffect(() => {
    if (!leaderboard) onSort(sortBy || 'gamesWon');
  }, []); // intentional: load once on entry

  return (
    <DesktopLayout active="ranking" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader title="RANKING" subtitle="Porównaj wyniki z innymi graczami i walcz o najwyższe miejsca." icon={<Crown size={28} />} />
        <section className="desk-ranking-panel desk-panel">
          <div className="desk-ranking-tabs">
            <button className={sortBy === 'gamesWon' ? 'active' : ''} onClick={() => onSort('gamesWon')}>WYGRANE</button>
            <button className={sortBy === 'guessesCorrect' ? 'active' : ''} onClick={() => onSort('guessesCorrect')}>ZGADYWANIE</button>
          </div>
          {!leaderboard ? (
            <div className="desk-loading">Wczytuję ranking…</div>
          ) : (
            <div className="desk-ranking-list">
              {leaderboard.map((player, index) => (
                <button type="button" key={player.uid || index} className={`desk-ranking-row rank-${index + 1}`} onClick={() => player.uid && onViewProfile?.(player)}>
                  <div className="desk-ranking-position">{index < 3 ? ['🥇','🥈','🥉'][index] : `#${index + 1}`}</div>
                  <div className="desk-ranking-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.username || 'G') : null}</div>
                  <div className="desk-ranking-user">
                    <strong>{player.username || 'Gracz'}</strong>
                    <span>LVL {player.xp ? Math.max(1, Math.floor(Math.sqrt(player.xp / 75)) + 1) : 1} · kliknij profil</span>
                  </div>
                  <div className="desk-ranking-score">
                    {sortBy === 'gamesWon' ? `${formatCompact(player.gamesWon || 0)} wygranych` : `${formatCompact(player.guessesCorrect || 0)} trafień`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </DesktopLayout>
  );
}

function DesktopCollectionView({ common, songs, stats, libraryLoading, songPoolSize }) {
  const [selectedRarity, setSelectedRarity] = useState('winyl');
  const [onlyOwned, setOnlyOwned] = useState(true);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(60);
  const [selectedCard, setSelectedCard] = useState(null);
  const collection = stats?.cardCollection || {};

  const rarityCounts = useMemo(() => {
    const counts = {};
    DESKTOP_RARITY_ORDER.forEach((rarity) => { counts[rarity] = { owned: 0, total: 0 }; });
    (songs || []).forEach((song) => {
      const rarity = effectiveRarity(song);
      if (!counts[rarity]) counts[rarity] = { owned: 0, total: 0 };
      counts[rarity].total += 1;
      if (collection[song.id]) counts[rarity].owned += 1;
    });
    return counts;
  }, [songs, collection]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (songs || []).filter((song) => {
      if (effectiveRarity(song) !== selectedRarity) return false;
      const owned = !!collection[song.id];
      if (onlyOwned && !owned) return false;
      if (!q) return true;
      return `${song.artist || ''} ${song.title || ''} ${song.year || ''}`.toLowerCase().includes(q);
    });
  }, [songs, collection, selectedRarity, onlyOwned, query]);

  useEffect(() => setVisibleCount(60), [selectedRarity, onlyOwned, query, songs?.length]);
  const shown = filtered.slice(0, visibleCount);
  const totalOwned = Object.keys(collection).length;
  const totalDuplicates = Object.values(collection).reduce((sum, count) => sum + Math.max(0, Number(count || 0) - 1), 0);

  return (
    <DesktopLayout active="collection" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader
          title="KOLEKCJA"
          subtitle={`Kolekcja: ${totalOwned}/${songPoolSize || songs?.length || 0} • Duplikaty: ${totalDuplicates}`}
          icon={<Disc3 size={28} />}
        />

        <section className="desk-album-summary desk-panel">
          <div className="desk-album-rarity-summary">
            {DESKTOP_RARITY_ORDER.map((rarity) => {
              const info = DESKTOP_RARITY_INFO[rarity];
              const count = rarityCounts[rarity] || { owned: 0, total: 0 };
              return (
                <button
                  type="button"
                  key={rarity}
                  className={`desk-rarity-summary-chip ${selectedRarity === rarity ? 'active' : ''}`}
                  onClick={() => setSelectedRarity(rarity)}
                  style={{ '--rarity-color': info.color }}
                >
                  <span className="desk-rarity-dot" />
                  <span>{info.label}</span>
                  <strong>{count.owned}/{count.total}</strong>
                </button>
              );
            })}
          </div>
        </section>

        <section className="desk-collection-tools desk-panel">
          <div className="desk-search-wrap"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj wykonawcy, tytułu lub roku" /></div>
          <button className={`desk-filter-chip ${onlyOwned ? 'active' : ''}`} onClick={() => setOnlyOwned((value) => !value)}>{onlyOwned ? 'TYLKO ZDOBYTE' : 'POKAŻ WSZYSTKIE'}</button>
        </section>

        {libraryLoading ? (
          <section className="desk-panel desk-library-loading"><Disc3 size={30} /> Ładuję aktualną bazę utworów z serwera…</section>
        ) : filtered.length === 0 ? (
          <section className="desk-panel desk-empty-state">Brak kart pasujących do tego filtra.</section>
        ) : (
          <>
            <div className="desk-album-card-grid">
              {shown.map((song) => {
                const ownedCount = Number(collection[song.id] || 0);
                return ownedCount > 0
                  ? <DesktopCollectibleCard key={song.id} song={song} ownedCount={ownedCount} onOpen={setSelectedCard} />
                  : <DesktopLockedCard key={song.id} rarity={effectiveRarity(song)} />;
              })}
            </div>
            {filtered.length > visibleCount ? (
              <button type="button" className="desk-album-more" onClick={() => setVisibleCount((value) => value + 60)}>
                POKAŻ WIĘCEJ ({filtered.length - visibleCount} POZOSTAŁO)
              </button>
            ) : null}
          </>
        )}
      </div>

      {selectedCard ? (
        <div className="desk-card-modal" onClick={() => setSelectedCard(null)}>
          <div className="desk-card-modal-inner" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="desk-card-modal-close" onClick={() => setSelectedCard(null)}>×</button>
            <DesktopCollectibleCard song={selectedCard} ownedCount={Number(collection[selectedCard.id] || 1)} />
            <div className="desk-card-modal-meta">
              <span style={{ color: DESKTOP_RARITY_INFO[effectiveRarity(selectedCard)]?.color }}>{DESKTOP_RARITY_INFO[effectiveRarity(selectedCard)]?.label}</span>
              <strong>{selectedCard.artist} — {selectedCard.title}</strong>
            </div>
          </div>
        </div>
      ) : null}
    </DesktopLayout>
  );
}
function DesktopShopView({ common, hitcoin, packConfigs, busy, openResult, onBuy, onClearResult }) {
  const packs = [
    { key: '50', title: 'PODSTAWOWA', img: packPodstawowa, accent: 'cyan' },
    { key: '75', title: 'ROZSZERZONA', img: packRozszerzona, accent: 'violet' },
    { key: '100', title: 'PREMIUM', img: packPremium, accent: 'gold' },
  ];

  return (
    <DesktopLayout active="shop" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader title="SKLEP" subtitle={`Saldo: ${formatCompact(hitcoin)} HITCOIN. Kupuj paczki i rozbudowuj album.`} icon={<ShoppingCart size={28} />} />
        {openResult?.length ? (
          <section className="desk-shop-result desk-panel">
            <div className="desk-section-label solo">OTWARTA PACZKA</div>
            <div className="desk-shop-result-grid">
              {openResult.map((item, index) => (
                <div key={`${item.song?.id || index}`} className="desk-shop-result-card">
                  <div className="desk-song-card-year">{item.song?.year || '—'}</div>
                  <div className="desk-song-card-title">{item.song?.title || 'Karta'}</div>
                  <div className="desk-song-card-artist">{item.song?.artist || ''}</div>
                </div>
              ))}
            </div>
            <button className="desk-primary-small" onClick={onClearResult}>WRÓĆ DO PACZEK</button>
          </section>
        ) : (
          <div className="desk-pack-grid">
            {packs.map((pack) => {
              const cfg = packConfigs?.[pack.key] || {};
              const canBuy = Number(hitcoin || 0) >= Number(cfg.price || 0);
              return (
                <div key={pack.key} className={`desk-pack-card ${pack.accent}`}>
                  <img src={pack.img} alt={pack.title} />
                  <div className="desk-pack-title">{pack.title}</div>
                  <div className="desk-pack-note">{cfg.cards || '?'} kart w paczce</div>
                  <div className="desk-pack-price"><img src={iconHitcoin} alt="" /> {cfg.price || 0}</div>
                  <button disabled={busy || !canBuy} onClick={() => onBuy(pack.key)}>{canBuy ? 'KUP PACZKĘ' : 'ZA MAŁO HITCOINÓW'}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DesktopLayout>
  );
}

function DesktopCommunityView({ common, onlinePlayers, challengeSentTo, challengeBusy, onChallenge, onViewProfile }) {
  return (
    <DesktopLayout active="community" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader title="SPOŁECZNOŚĆ" subtitle="Zobacz kto jest online i wyzwij znajomego na pojedynek 1v1." icon={<Users size={28} />} />
        <section className="desk-community-panel desk-panel">
          <div className="desk-section-label solo">GRACZE ONLINE</div>
          {onlinePlayers.length === 0 ? <div className="desk-empty-state">Nikt inny nie jest teraz online.</div> : (
            <div className="desk-community-grid">
              {onlinePlayers.map((player, index) => {
                const pending = challengeSentTo?.uid === player.uid;
                return (
                  <div key={player.playerId || player.uid || index} className="desk-community-card">
                    <button type="button" className="desk-community-profile" disabled={!player.uid} onClick={() => player.uid && onViewProfile?.(player)}>
                      <div className="desk-community-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name || player.username || 'G') : null}</div>
                      <div className="desk-community-copy"><strong>{player.name || player.username || 'Gracz'}</strong><span>🟢 online · {player.uid ? 'zobacz profil' : 'gość'}</span></div>
                    </button>
                    {player.uid ? <button disabled={challengeBusy || pending} onClick={() => onChallenge(player)}>{pending ? 'WYZWANIE WYSŁANE' : 'WYZWIJ 1V1'}</button> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DesktopLayout>
  );
}

function DesktopProposeView({ common, draft, setDraft, categories, onToggleCategory, onSubmit, busy, error, success }) {
  return (
    <DesktopLayout active="home" {...common}>
      <HeaderBar {...common.header} />
      <div className="desk-main-stack">
        <DesktopSimpleHeader title="ZAPROPONUJ UTWÓR" subtitle="Masz pomysł na hit, którego brakuje w bazie? Wyślij propozycję do akceptacji." icon={<Music2 size={28} />} />
        <section className="desk-propose-panel desk-panel">
          {success ? (
            <div className="desk-success-state"><CheckCircle2 size={44} /> Dzięki! Propozycja czeka na zatwierdzenie.</div>
          ) : (
            <div className="desk-propose-form">
              <label><span>WYKONAWCA</span><input value={draft.artist} onChange={(e) => setDraft({ ...draft, artist: e.target.value })} placeholder="np. Queen" /></label>
              <label><span>TYTUŁ</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="np. Don't Stop Me Now" /></label>
              <label className="wide"><span>LINK YOUTUBE</span><input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://youtube.com/..." /></label>
              <label><span>ROK</span><input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} placeholder="1978" /></label>
              <div className="desk-propose-categories wide">
                <span>KATEGORIE</span>
                <div>{categories.map((cat) => <button type="button" key={cat.slug} className={draft.categories.includes(cat.slug) ? 'active' : ''} onClick={() => onToggleCategory(cat.slug)}>{cat.label}</button>)}</div>
              </div>
              {error ? <div className="desk-form-error wide">{error}</div> : null}
              <div className="desk-propose-submit wide"><button disabled={busy} onClick={onSubmit}>{busy ? 'WYSYŁANIE…' : 'WYŚLIJ PROPOZYCJĘ'}</button></div>
            </div>
          )}
        </section>
      </div>
    </DesktopLayout>
  );
}

export function DesktopAppView(props) {
  const [section, setSection] = useState('home');

  const common = useMemo(() => ({
    onHome: () => setSection('home'),
    onRooms: () => {
      setSection('home');
      setTimeout(() => document.querySelector('.desk-room-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    },
    onAlbum: () => setSection('collection'),
    onStats: () => setSection('stats'),
    onAchievements: () => setSection('achievements'),
    onLeaderboard: () => setSection('ranking'),
    onShop: () => setSection('shop'),
    onCommunity: () => setSection('community'),
    onAdmin: props.onAdmin,
    adminUnlocked: props.adminUnlocked,
    header: {
      onlineCount: props.onlinePlayers.length,
      level: props.levelInfo.level,
      xpText: `${props.levelInfo.currentLevelXp} / ${props.levelInfo.xpForNextLevel} XP`,
      musicCount: formatCompact(props.stats?.heardSongs?.length || 0),
      hitcoin: formatCompact(props.hitcoin || 0),
      avatarUrl: props.stats?.avatarUrl,
      username: props.playerName || props.user?.displayName || props.user?.username || 'Gracz',
      onCommunity: () => setSection('community'),
      onStats: () => setSection('stats'),
      onShop: () => setSection('shop'),
      onAvatarUpload: props.onAvatarUpload,
      avatarUploadBusy: props.avatarUploadBusy,
    },
  }), [props.onlinePlayers.length, props.levelInfo.level, props.levelInfo.currentLevelXp, props.levelInfo.xpForNextLevel, props.stats, props.hitcoin, props.user, props.onAvatarUpload, props.avatarUploadBusy, props.onAdmin, props.adminUnlocked]);

  const localHomeProps = {
    ...props,
    onHome: common.onHome,
    onAlbum: common.onAlbum,
    onStats: common.onStats,
    onAchievements: common.onAchievements,
    onLeaderboard: common.onLeaderboard,
    onShop: common.onShop,
    onCommunity: common.onCommunity,
    onPropose: () => setSection('propose'),
  };

  let view;
  if (section === 'stats') view = <DesktopStatsView {...props} {...common} />;
  else if (section === 'achievements') view = <DesktopAchievementsView common={common} progress={props.achievementProgress || []} onClaim={props.onClaimAchievement} />;
  else if (section === 'ranking') view = <DesktopLeaderboardView common={common} leaderboard={props.leaderboard} sortBy={props.leaderboardSort} onSort={props.onLoadLeaderboard} onViewProfile={props.onViewProfile} />;
  else if (section === 'collection') view = <DesktopCollectionView common={common} songs={props.songs} stats={props.stats} libraryLoading={props.libraryLoading} songPoolSize={props.songPoolSize} />;
  else if (section === 'shop') view = <DesktopShopView common={common} hitcoin={props.hitcoin} packConfigs={props.packConfigs} busy={props.packBusy} openResult={props.packOpenResult} onBuy={props.onBuyPack} onClearResult={props.onClearPackResult} />;
  else if (section === 'community') view = <DesktopCommunityView common={common} onlinePlayers={props.onlinePlayers} challengeSentTo={props.challengeSentTo} challengeBusy={props.challengeBusy} onChallenge={props.onChallenge} onViewProfile={props.onViewProfile} />;
  else if (section === 'propose') view = <DesktopProposeView common={common} draft={props.proposeDraft} setDraft={props.setProposeDraft} categories={props.categories} onToggleCategory={props.onToggleProposeCategory} onSubmit={props.onSubmitProposal} busy={props.proposeBusy} error={props.proposeError} success={props.proposeSuccess} />;
  else view = <DesktopHomeView {...localHomeProps} />;

  return (
    <>
      {view}
      <DesktopPlayerProfileModal profile={props.viewingPlayer} onClose={props.onCloseProfile} levelFromXp={props.levelFromXp} />
    </>
  );
}
