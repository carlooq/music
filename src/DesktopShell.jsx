import React from 'react';
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

function DesktopTopPill({ icon, children, accent = 'cyan', wide = false }) {
  return <div className={`desk-pill ${accent} ${wide ? 'wide' : ''}`}>{icon}<span>{children}</span></div>;
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
  return (
    <button className={`desk-mode-card ${accent}`} onClick={onClick}>
      {badge ? <div className="desk-mode-badge">{badge}</div> : null}
      <img src={icon} alt="" className="desk-mode-icon" />
      <div className="desk-mode-title">{title}</div>
      <div className="desk-mode-desc">{desc}</div>
      <div className="desk-mode-footer">
        <span>{footer}</span>
        <div className="desk-mode-arrow"><ChevronRight size={18} /></div>
      </div>
    </button>
  );
}

function DesktopRailCard({ icon, title, value, desc, accent = 'violet', actionLabel, onClick, children }) {
  return (
    <button className={`desk-rail-card ${accent}`} onClick={onClick}>
      <div className="desk-rail-icon-wrap">{typeof icon === 'string' ? <img src={icon} alt="" /> : icon}</div>
      <div className="desk-rail-copy">
        <div className="desk-rail-title">{title}</div>
        {value ? <div className="desk-rail-value">{value}</div> : null}
        {desc ? <div className="desk-rail-desc">{desc}</div> : null}
        {children}
      </div>
      {actionLabel ? <div className="desk-rail-action">{actionLabel}</div> : null}
    </button>
  );
}

function ProgressBar({ value = 0 }) {
  return (
    <div className="desk-progress-bar">
      <div className="desk-progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function SidebarNav({ active = 'home', onHome, onAlbum, onStats, onAchievements, onLeaderboard, onShop, onCommunity }) {
  const items = [
    { key: 'home', label: 'GRAJ TERAZ', icon: <Gamepad2 size={20} />, onClick: onHome },
    { key: 'rooms', label: 'POKÓJ', icon: <DoorOpen size={20} />, onClick: onHome },
    { key: 'collection', label: 'KOLEKCJA', icon: <Disc3 size={20} />, onClick: onAlbum },
    { key: 'stats', label: 'STATYSTYKI', icon: <BarChart3 size={20} />, onClick: onStats },
    { key: 'achievements', label: 'OSIĄGNIĘCIA', icon: <Medal size={20} />, onClick: onAchievements },
    { key: 'ranking', label: 'RANKING', icon: <Crown size={20} />, onClick: onLeaderboard },
    { key: 'shop', label: 'SKLEP', icon: <ShoppingCart size={20} />, onClick: onShop },
    { key: 'community', label: 'SPOŁECZNOŚĆ', icon: <Users size={20} />, onClick: onCommunity },
  ];
  return (
    <aside className="desk-sidebar">
      <div className="desk-brand">
        <img src={logoImg} alt="Hitsteriada" />
      </div>
      <div className="desk-sidebar-nav">
        {items.map((item) => (
          <button key={item.key} className={`desk-nav-item ${active === item.key ? 'active' : ''}`} onClick={item.onClick}>
            <span className="desk-nav-icon">{item.icon}</span>
            <span className="desk-nav-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div className="desk-mini-player">
        <div className="desk-mini-wave" style={{ backgroundImage: `url(${footerStrip})` }} />
        <div className="desk-mini-meta">
          <div className="desk-mini-title">Hitsteriada Mix</div>
          <div className="desk-mini-artist">Game soundtrack</div>
        </div>
        <button className="desk-mini-play"><Play size={18} /></button>
      </div>
    </aside>
  );
}

function DesktopLayout({ active, topRight, onHome, onAlbum, onStats, onAchievements, onLeaderboard, onShop, onCommunity, children }) {
  return (
    <div className="desk-root" style={{ backgroundImage: `linear-gradient(180deg, rgba(3,6,19,0.70), rgba(3,6,19,0.94)), url(${homeBg})` }}>
      <div className="desk-shell">
        <SidebarNav active={active} onHome={onHome} onAlbum={onAlbum} onStats={onStats} onAchievements={onAchievements} onLeaderboard={onLeaderboard} onShop={onShop} onCommunity={onCommunity} />
        <div className="desk-content">{children}</div>
      </div>
      {topRight}
    </div>
  );
}

function HeaderBar({ onlineCount, level, xpText, musicCount, hitcoin, avatarUrl, username }) {
  return (
    <div className="desk-header-bar">
      <DesktopTopPill icon={<span className="desk-dot" />} accent="green">{onlineCount} graczy online</DesktopTopPill>
      <DesktopTopPill icon={<Star size={16} />} accent="cyan" wide>LVL {level} <span className="desk-pill-sub">{xpText}</span></DesktopTopPill>
      <DesktopTopPill icon={<Music2 size={16} />} accent="pink">{musicCount}</DesktopTopPill>
      <DesktopTopPill icon={<img src={iconHitcoin} alt="" className="desk-pill-coin" />} accent="gold">{hitcoin}</DesktopTopPill>
      <div className="desk-user-pill">
        <div className="desk-avatar" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{!avatarUrl ? initials(username) : null}</div>
        <span>{username}</span>
      </div>
      <button className="desk-gear-btn"><Settings size={18} /></button>
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

  const username = user?.username || 'Gracz';
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
    >
      <HeaderBar
        onlineCount={onlinePlayers.length}
        level={levelInfo.level}
        xpText={`${levelInfo.currentLevelXp} / ${levelInfo.xpForNextLevel} XP`}
        musicCount={formatCompact(stats?.heardSongs?.length || 0)}
        hitcoin={formatCompact(stats?.hitcoin ?? 0)}
        avatarUrl={stats?.avatarUrl}
        username={username}
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
              <button className="desk-outline-btn">DOWIEDZ SIĘ WIĘCEJ <ChevronRight size={18} /></button>
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
              <DesktopStatCard icon={glKorona} label="RANKING" value={`#${formatCompact(stats?.bestRank || 1248)}`} note="Twoja pozycja" accent="gold" action="ZOBACZ RANKING" onClick={onLeaderboard} />
              <DesktopStatCard icon={glKoszyk} label="SKLEP" value="Nowe przedmioty!" note="Sprawdź oferty i odblokuj" accent="cyan" action="PRZEJDŹ DO SKLEPU" onClick={onShop} />
              <DesktopStatCard icon={glOsoba} label="SPOŁECZNOŚĆ" value={`${onlinePlayers.length}`} note="Graczy online" accent="pink" action="ZOBACZ SPOŁECZNOŚĆ" onClick={onCommunity} />
            </div>
          </div>

          <div className="desk-right-rail">
            <DesktopRailCard icon={<Flame size={20} />} title="PASSA" value={`${stats?.longestStreak || 0}`} desc="najlepsza seria trafień" accent="pink" />
            <DesktopRailCard icon={glPrezent} title="NAGRODA DNIA" value={todayClaimed ? 'ODEBRANA' : 'GOTOWA'} desc={todayClaimed ? 'Wróć jutro po następną próbę.' : 'Odbierz darmową nagrodę'} accent="cyan" actionLabel={todayClaimed ? '' : 'ODBIERZ'} />
            <DesktopRailCard icon={iconZaproponuj} title="ZAPROPONUJ UTWÓR" value="Masz pomysł na hit?" desc="Zgłoś utwór społeczności!" accent="violet" actionLabel="OTWÓRZ" onClick={onPropose} />
            <DesktopRailCard icon={<Users size={20} />} title="ZNAJOMI ONLINE" value={`${onlinePlayers.length} aktywnych`} desc={onlinePlayers.length ? 'Dołącz do społeczności' : 'Nikt poza Tobą nie gra w tej chwili.'} accent="cyan">
              <div className="desk-online-row">
                {onlinePlayers.slice(0, 5).map((player, index) => (
                  <div key={player.id || player.uid || index} className="desk-online-avatar">{initials(player.username || player.name || 'G')}</div>
                ))}
                {onlinePlayers.length > 5 ? <div className="desk-online-avatar more">+{onlinePlayers.length - 5}</div> : null}
              </div>
            </DesktopRailCard>
          </div>
        </div>

        <div className="desk-footer-eq" style={{ backgroundImage: `url(${footerStrip})` }}>
          <div className="desk-footer-logo"><img src={logoImg} alt="" /></div>
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
    decadeEntries,
    bestDecades,
    worstDecades,
    onHome,
    onAlbum,
    onStats,
    onAchievements,
    onLeaderboard,
    onShop,
    onCommunity,
  } = props;

  const username = user?.username || 'Gracz';
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
    >
      <HeaderBar
        onlineCount={onlinePlayers.length}
        level={levelInfo.level}
        xpText={`${levelInfo.currentLevelXp} / ${levelInfo.xpForNextLevel} XP`}
        musicCount={formatCompact(stats?.heardSongs?.length || 0)}
        hitcoin={formatCompact(stats?.hitcoin ?? 0)}
        avatarUrl={stats?.avatarUrl}
        username={username}
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
          <div className="desk-feature-card cyan">
            <div className="desk-feature-head"><Gift size={22} /> CODZIENNA NAGRODA</div>
            <div className="desk-feature-copy">
              <div className="desk-feature-big">{stats?.lastDailyHitcoinDate === props.todayKey ? 'Odebrane' : 'Gotowa'}</div>
              <div className="desk-feature-small">{stats?.lastDailyHitcoinDate === props.todayKey ? 'Wróć jutro po kolejną próbę' : 'Sprawdź koło nagród'}</div>
            </div>
          </div>
          <div className="desk-feature-card gold">
            <div className="desk-feature-head"><Trophy size={22} /> OSIĄGNIĘCIA</div>
            <div className="desk-feature-copy">
              <div className="desk-feature-big">{achievementClaimed} / {totalAchievements}</div>
              <div className="desk-feature-small">Odblokowanych osiągnięć</div>
              <ProgressBar value={Math.round((achievementClaimed / Math.max(1, totalAchievements)) * 100)} />
            </div>
          </div>
          <div className="desk-feature-card cyan">
            <div className="desk-feature-head"><Disc3 size={22} /> ALBUM</div>
            <div className="desk-feature-copy feature-row-right">
              <div>
                <div className="desk-feature-big">{collectionCount}</div>
                <div className="desk-feature-small">unikalnych kart</div>
              </div>
              <img src={glKolekcja} alt="" className="desk-feature-art" />
            </div>
          </div>
          <div className="desk-feature-card green">
            <div className="desk-feature-head"><CheckCircle2 size={22} /> WYZWANIE TYGODNIA</div>
            <div className="desk-feature-copy">
              <div className="desk-feature-big">{currentWeekly.title}</div>
              <ProgressBar value={currentWeekly.progressPct || 0} />
              <div className="desk-feature-small">{currentWeekly.progressLabel} • {currentWeekly.reward}</div>
            </div>
          </div>
        </div>

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

        <div className="desk-bestworst-grid">
          <section className="desk-bestworst-panel green">
            <div className="desk-bestworst-title"><Crown size={20} /> NAJLEPIEJ ZGADUJESZ</div>
            <div className="desk-circle-row">
              {bestDecades.map((item) => <DecadeCircle key={item.label} item={item} accent="green" />)}
            </div>
          </section>
          <section className="desk-bestworst-panel pink">
            <div className="desk-bestworst-title"><Flame size={20} /> NAJGORZEJ ZGADUJESZ</div>
            <div className="desk-circle-row">
              {worstDecades.map((item) => <DecadeCircle key={item.label} item={item} accent="pink" />)}
            </div>
          </section>
        </div>
      </div>
    </DesktopLayout>
  );
}
