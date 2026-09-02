import React from "react";
import { Settings, ChevronRight, Users, Gift, Flame } from "lucide-react";
import { levelFromXp, currentDayKey } from "./stats.js";
import { getAchievementProgress, ACHIEVEMENTS } from "./achievements.js";

import logoImg from "./assets/logo-v2.png";
import iconHitcoin from "./assets/icons/icon-hitcoin.png";
import glTrening from "./assets/icons/gl-trening.png";
import glHitRush from "./assets/icons/gl-hitrush.png";
import glPiosenka from "./assets/icons/gl-piosenka.png";
import glPlaylista from "./assets/icons/gl-playlista.png";
import glTurniej from "./assets/icons/gl-turniej.png";
import glKolekcja from "./assets/icons/gl-kolekcja.png";
import glMedal from "./assets/icons/gl-medal.png";
import glStatystyki from "./assets/icons/gl-statystyki.png";
import glKorona from "./assets/icons/gl-korona.png";
import glKoszyk from "./assets/icons/gl-koszyk.png";
import glOsoba from "./assets/icons/gl-osoba.png";
import glPrezent from "./assets/icons/gl-prezent.png";
import iconZaproponuj from "./assets/icons/zaproponuj.png";
import heroBanner from "./assets/home/hero-banner.webp";
import footerStrip from "./assets/home/footer-strip.webp";
import "./desktop-home.css";

function ModeCard({ tone, icon, title, description, onClick, disabled, badge }) {
  return (
    <div className={`dh-mode-card dh-tone-${tone}`}>
      {badge && <span className="dh-mode-badge">{badge}</span>}
      <button onClick={onClick} disabled={disabled} className="dh-mode-button">
        <img src={icon} alt="" className="dh-mode-icon" />
        <div className="dh-mode-copy">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
        <span className="dh-round-arrow"><ChevronRight size={17} /></span>
      </button>
    </div>
  );
}

function ProgressCard({ icon, label, value, detail, tone, onClick }) {
  return (
    <button className={`dh-progress-card dh-progress-${tone}`} onClick={onClick}>
      <img src={icon} alt="" />
      <div className="dh-progress-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
      <ChevronRight size={15} className="dh-progress-chevron" />
    </button>
  );
}

export default function DesktopHome({
  user,
  stats,
  myXp,
  myHitcoin,
  onlinePlayers,
  totalSongCount,
  effectivePoolCount,
  activeTournament,
  lastCompletedTournament,
  joinCode,
  setJoinCode,
  busy,
  dailyBusy,
  dailyPlaylistBusy,
  tournamentBusy,
  createRoom,
  joinRoom,
  openStats,
  openAlbum,
  openLeaderboard,
  openDailySong,
  openDailyPlaylistHub,
  openTournamentHub,
  setScreen,
  setShowAchievements,
  setShowOnlineList,
  setShowDailyWheel,
  setShowProposeForm,
  setShowAuthForm,
}) {
  const level = myXp !== null && myXp !== undefined ? levelFromXp(myXp) : null;
  const xpPercent = level ? Math.min(100, Math.round((level.currentLevelXp / level.xpForNextLevel) * 100)) : 0;
  const achievementCount = user && stats
    ? getAchievementProgress(stats, levelFromXp(stats.xp || 0).level).filter((a) => a.qualifies).length
    : 0;
  const collectionCount = Object.keys(stats?.cardCollection || {}).length;
  const totalCards = totalSongCount ?? effectivePoolCount ?? 0;
  const accuracy = stats?.gamesPlayed ? `${Math.round(((stats.gamesWon || 0) / stats.gamesPlayed) * 100)}%` : "—";
  const streak = stats?.longestGuessStreak || 0;
  const dailyClaimed = stats?.lastDailyHitcoinDate === currentDayKey();

  const requireLogin = (action) => {
    if (user) action?.();
    else setShowAuthForm?.(true);
  };

  return (
    <div className="dh-root">
      <header className="dh-header">
        <button className="dh-brand" type="button">
          <img src={logoImg} alt="" />
          <span>HITSTERIADA</span>
        </button>

        <div className="dh-header-actions">
          <button className="dh-top-pill dh-online" onClick={() => setShowOnlineList((v) => !v)}>
            <i /> <span>{onlinePlayers.length} graczy online</span>
          </button>

          {level && (
            <button className="dh-top-pill dh-level" onClick={openStats}>
              <span className="dh-star">★</span>
              <b>LVL {level.level}</b>
              <span className="dh-xp-track"><span style={{ width: `${xpPercent}%` }} /></span>
            </button>
          )}

          {user && stats && (
            <button className="dh-top-pill dh-music" onClick={openStats}>
              <span>♫</span><b>{stats.guessesCorrect || 0}</b>
            </button>
          )}

          {user && myHitcoin !== null && myHitcoin !== undefined && (
            <button className="dh-top-pill dh-coin" onClick={() => setScreen("packShop")}>
              <img src={iconHitcoin} alt="" /><b>{myHitcoin}</b>
            </button>
          )}

          {user ? (
            <button className="dh-profile" onClick={openStats} title={user.displayName}>
              <span className="dh-avatar" style={{ backgroundImage: stats?.avatarUrl ? `url(${stats.avatarUrl})` : undefined }} />
              <span className="dh-profile-dot" />
            </button>
          ) : (
            <button className="dh-login" onClick={() => setShowAuthForm(true)}>Zaloguj</button>
          )}

          <button className="dh-settings" onClick={openStats} title="Profil i ustawienia"><Settings size={18} /></button>
        </div>
      </header>

      <div className="dh-dashboard">
        <main className="dh-main">
          <div className="dh-hero-row">
            <section className="dh-create-panel">
              <div className="dh-kicker">◉ GRAJ TERAZ</div>
              <h1>Twój utwór. <span>Twoja zasada.</span></h1>
              <p>Stwórz pokój lub dołącz do gry i baw się muzyką!</p>

              <div className="dh-room-box">
                <div className="dh-create-side">
                  <div className="dh-label">STWÓRZ POKÓJ</div>
                  <button className="dh-create-button" onClick={createRoom} disabled={busy}>
                    <span>STWÓRZ POKÓJ</span>
                    <span className="dh-create-icon">＋</span>
                  </button>
                  <small>Ty wybierasz zasady. Zaproś znajomych!</small>
                </div>

                <div className="dh-room-divider"><span>LUB</span></div>

                <div className="dh-join-side">
                  <div className="dh-label">DOŁĄCZ DO POKOJU</div>
                  <div className="dh-join-controls">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      placeholder="Wpisz kod pokoju"
                      maxLength={4}
                    />
                    <button onClick={() => joinRoom()} disabled={busy}>DOŁĄCZ</button>
                  </div>
                </div>
              </div>
            </section>

            <section className="dh-hero-panel" style={{ backgroundImage: `url(${heroBanner})` }}>
              <div className="dh-hero-copy">
                <h2>Muzyka łączy.<br /><span>Hity zostają.</span></h2>
                <p>Rywalizuj, odkrywaj, zdobywaj i wspinaj się na szczyt rankingu!</p>
                <span className="dh-hero-cta">DOWIEDZ SIĘ WIĘCEJ <ChevronRight size={15} /></span>
              </div>
              <div className="dh-eq-mini" aria-hidden="true">
                {Array.from({ length: 19 }).map((_, i) => <i key={i} style={{ height: `${14 + ((i * 17) % 42)}px` }} />)}
              </div>
              <div className="dh-dots"><i className="active" /><i /><i /><i /></div>
            </section>
          </div>

          <section className="dh-section">
            <div className="dh-section-title"><span>♬</span> TRYBY GRY</div>
            <div className="dh-mode-grid">
              <ModeCard tone="cyan" icon={glTrening} title="TRENING" description="Ćwicz i poznawaj kategorie" onClick={() => setScreen("practiceSetup")} />
              <ModeCard tone="green" icon={glHitRush} title="HIT RUSH" description="Szybki tryb solo" onClick={() => setScreen("hitRushMenu")} />
              <ModeCard tone="pink" icon={glPiosenka} title="PIOSENKA DNIA" description="Jedna piosenka dla wszystkich" onClick={() => requireLogin(openDailySong)} disabled={user ? dailyBusy : false} />
              <ModeCard tone="violet" icon={glPlaylista} title="PLAYLISTA DNIA" description="Codziennie nowa playlista" onClick={() => requireLogin(openDailyPlaylistHub)} disabled={user ? dailyPlaylistBusy : false} />
              <ModeCard
                tone="gold"
                icon={glTurniej}
                title="TURNIEJ"
                description={activeTournament ? (activeTournament.status === "signup" ? `${activeTournament.signups.length}/${activeTournament.maxPlayers} zapisanych` : "Turniej trwa!") : (lastCompletedTournament ? "Wkrótce kolejny turniej" : "Rywalizacja o najwyższe miejsca")}
                onClick={activeTournament ? openTournamentHub : undefined}
                disabled={tournamentBusy}
                badge="★ PREMIUM"
              />
            </div>
          </section>

          {user && stats && (
            <section className="dh-section dh-progress-section">
              <div className="dh-section-title"><span>▣</span> TWÓJ POSTĘP</div>
              <div className="dh-progress-grid">
                <ProgressCard tone="cyan" icon={glKolekcja} label="KOLEKCJA" value={`${collectionCount}/${totalCards}`} detail="Utworów odblokowanych" onClick={openAlbum} />
                <ProgressCard tone="purple" icon={glMedal} label="OSIĄGNIĘCIA" value={`${achievementCount}/${ACHIEVEMENTS.length}`} detail="Odblokowanych" onClick={() => setShowAchievements(true)} />
                <ProgressCard tone="blue" icon={glStatystyki} label="STATYSTYKI" value={accuracy} detail="Śr. dokładność" onClick={openStats} />
                <ProgressCard tone="gold" icon={glKorona} label="RANKING" value="TOP 10" detail="Twoja pozycja" onClick={openLeaderboard} />
                <ProgressCard tone="cyan" icon={glKoszyk} label="SKLEP" value="NOWE" detail="Sprawdź ofertę" onClick={() => setScreen("packShop")} />
                <ProgressCard tone="pink" icon={glOsoba} label="SPOŁECZNOŚĆ" value={onlinePlayers.length} detail="Graczy online" onClick={() => setShowOnlineList((v) => !v)} />
              </div>
            </section>
          )}

          <div className="dh-footer-strip" style={{ backgroundImage: `url(${footerStrip})` }} />
        </main>

        <aside className="dh-sidebar">
          <div className="dh-sidebar-spacer" />

          <section className="dh-side-card dh-streak-card">
            <div className="dh-side-icon"><Flame size={19} /></div>
            <div>
              <span>PASSA</span>
              <strong>{streak}</strong>
              <small>najlepsza seria trafień</small>
            </div>
          </section>

          {user && stats && (
            <button
              className="dh-side-card dh-reward-card"
              onClick={() => !dailyClaimed && setShowDailyWheel(true)}
              disabled={dailyClaimed}
            >
              <img src={glPrezent} alt="" />
              <div>
                <span>NAGRODA DNIA</span>
                <strong>{dailyClaimed ? "ODEBRANA" : "ODBIERZ"}</strong>
                <small>{dailyClaimed ? "Wróć jutro po następną" : "Darmowa nagroda czeka"}</small>
              </div>
              {!dailyClaimed && <em>ODBIERZ</em>}
            </button>
          )}

          <button className="dh-side-card dh-propose-card" onClick={() => user ? setShowProposeForm((v) => !v) : setShowAuthForm(true)}>
            <img src={iconZaproponuj} alt="" />
            <div>
              <span>ZAPROPONUJ UTWÓR</span>
              <strong>Masz pomysł na hit?</strong>
              <small>Zgłoś utwór społeczności</small>
            </div>
            <ChevronRight size={17} />
          </button>

          <section className="dh-side-card dh-friends-card">
            <Users size={20} />
            <div className="dh-friends-copy">
              <span>ZNAJOMI ONLINE</span>
              <strong>{onlinePlayers.length} aktywnych</strong>
              <div className="dh-friend-row">
                {onlinePlayers.slice(0, 5).map((p) => (
                  <i key={p.playerId} title={p.name}>{(p.name || "?").slice(0, 1).toUpperCase()}</i>
                ))}
                {onlinePlayers.length > 5 && <i>+{onlinePlayers.length - 5}</i>}
                {onlinePlayers.length === 0 && <small>Nikt poza Tobą nie gra teraz.</small>}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
