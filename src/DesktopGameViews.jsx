import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Disc3,
  Flame,
  Gamepad2,
  Gift,
  Headphones,
  LogOut,
  MessageCircle,
  Music2,
  Play,
  RotateCcw,
  Send,
  Shield,
  Sparkles,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';

import logoImg from './assets/logo-v2.png';
import homeBg from './assets/home/bg.jpg';
import heroBanner from './assets/home/hero-banner.webp';
import iconToken from './assets/icons/icon-token.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glTrening from './assets/icons/gl-trening.png';
import glKorona from './assets/icons/gl-korona.png';
import glPrezent from './assets/icons/gl-prezent.png';

function initials(label) {
  const raw = String(label || 'G').trim();
  return raw.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'G';
}

function SessionBackground({ children, className = '' }) {
  return (
    <div className={`dgv-root ${className}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(3,6,19,.78), rgba(3,6,19,.95)), url(${homeBg})` }}>
      {children}
    </div>
  );
}

function SessionHeader({ eyebrow, title, right, onBack, backLabel = 'Wróć' }) {
  return (
    <header className="dgv-header">
      <button type="button" className="dgv-logo" onClick={onBack} title="Strona główna">
        <img src={logoImg} alt="Hitsteriada" />
      </button>
      <div className="dgv-header-title">
        {eyebrow ? <div className="dgv-eyebrow">{eyebrow}</div> : null}
        <div className="dgv-title">{title}</div>
      </div>
      <div className="dgv-header-right">
        {right}
        {onBack ? <button type="button" className="dgv-ghost-button" onClick={onBack}><ArrowLeft size={17} /> {backLabel}</button> : null}
      </div>
    </header>
  );
}

function PlayerBadge({ player, hostId, myId, level, active, score, tokenCount, onClick, onKick, canKick }) {
  return (
    <button type="button" className={`dgv-player-badge ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="dgv-player-avatar">{initials(player.name)}</div>
      <div className="dgv-player-copy">
        <div className="dgv-player-name">
          {player.name}
          {player.id === hostId ? <span className="host">HOST</span> : null}
          {player.id === myId ? <span className="you">TY</span> : null}
        </div>
        <div className="dgv-player-meta">
          {level ? <span>LVL {level}</span> : null}
          {Number.isFinite(score) ? <span>{score} kart</span> : null}
          {Number.isFinite(tokenCount) ? <span className="token"><img src={iconToken} alt="" /> {tokenCount}</span> : null}
        </div>
      </div>
      {canKick ? (
        <span
          role="button"
          tabIndex={0}
          className="dgv-kick"
          onClick={(e) => { e.stopPropagation(); onKick?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onKick?.(); } }}
        >WYRZUĆ</span>
      ) : null}
    </button>
  );
}


export function DesktopPracticeSetupView({
  practiceTarget,
  setPracticeTarget,
  selectedCategories,
  categories,
  onToggleCategory,
  songPool,
  busy,
  onStart,
  onHome,
}) {
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const normalized = (values) => (values || []).map((v) => String(v || '').trim().toLowerCase());
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((c) => selectedCategories.includes(c))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;

  return (
    <SessionBackground className="dgv-practice-setup">
      <div className="dgv-shell">
        <SessionHeader eyebrow="TRYB SOLO" title="TRENING" onBack={onHome} backLabel="Strona główna" />

        <section className="dgv-practice-hero dgv-panel">
          <div className="dgv-practice-hero-copy">
            <img src={glTrening} alt="" />
            <div>
              <div className="dgv-eyebrow">TRENING BEZ PRESJI</div>
              <h1>ĆWICZ OŚ CZASU.<br /><span>BIJ WŁASNY WYNIK.</span></h1>
              <p>Grasz solo. Słuchasz utworu, wybierasz jego miejsce na osi czasu i od razu przechodzisz do kolejnej karty.</p>
            </div>
          </div>
          <div className="dgv-practice-hero-stats">
            <div><strong>{playableCount}</strong><span>utworów w puli</span></div>
            <div><strong>{practiceTarget || 15}</strong><span>kart do zebrania</span></div>
          </div>
        </section>

        <div className="dgv-practice-grid">
          <section className="dgv-panel dgv-practice-target-panel">
            <div className="dgv-section-heading"><Gamepad2 size={19} /> CEL TRENINGU</div>
            <p className="dgv-practice-lead">Ile poprawnie ułożonych kart chcesz zebrać, aby zakończyć sesję?</p>
            <div className="dgv-practice-target-value">{practiceTarget || 15}</div>
            <div className="dgv-stepper large">
              <button type="button" onClick={() => setPracticeTarget(Math.max(1, Number(practiceTarget || 1) - 1))}>−</button>
              <input type="number" min="1" value={practiceTarget} onChange={(e) => setPracticeTarget(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
              <button type="button" onClick={() => setPracticeTarget(Number(practiceTarget || 0) + 1)}>+</button>
            </div>
            <div className="dgv-practice-tip"><Sparkles size={16} /> Na start polecam 10–15 kart. Dłuższy trening daje większą oś czasu i trudniejsze decyzje.</div>
          </section>

          <section className="dgv-panel dgv-practice-categories-panel">
            <div className="dgv-section-heading"><Music2 size={19} /> KATEGORIE</div>
            <p className="dgv-practice-lead">Wybierz repertuar. „Wszystkie” pomija kategorię Religijne — możesz ją włączyć ręcznie.</p>
            <div className="dgv-category-grid practice">
              {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => {
                const active = selectedCategories.includes(category.slug);
                return <button type="button" key={category.slug} className={active ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>;
              })}
            </div>
            <div className="dgv-library-info"><Music2 size={17} /> Do treningu pasuje teraz <strong>{playableCount}</strong> utworów.</div>
          </section>
        </div>

        <section className="dgv-practice-startbar dgv-panel">
          <div><span className="dgv-eyebrow">GOTOWY?</span><strong>{practiceTarget || 15} kart · {playableCount} utworów w puli</strong></div>
          <button type="button" className="dgv-start-button practice" disabled={busy || !practiceTarget || playableCount < Number(practiceTarget || 15) + 7} onClick={onStart}>
            <Play size={22} fill="currentColor" /> ROZPOCZNIJ TRENING <ChevronRight size={22} />
          </button>
        </section>
      </div>
    </SessionBackground>
  );
}

export function DesktopLobbyView({
  room,
  roomId,
  playerId,
  isHost,
  copied,
  onCopy,
  onLeave,
  target,
  setTarget,
  selectedCategories,
  categories,
  onToggleCategory,
  songPool,
  busy,
  onStart,
  onKick,
  playerLevels,
  levelFromXp,
}) {
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const normalized = (values) => (values || []).map((v) => String(v || '').trim().toLowerCase());
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((c) => selectedCategories.includes(c))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;

  return (
    <SessionBackground className="dgv-lobby">
      <div className="dgv-shell">
        <SessionHeader
          eyebrow="POKÓJ GRY"
          title="LOBBY"
          onBack={onLeave}
          backLabel="Opuść pokój"
          right={<div className="dgv-status-pill"><span className="dot" /> {room.players.length} graczy</div>}
        />

        <section className="dgv-room-hero">
          <div className="dgv-room-code-panel">
            <div className="dgv-eyebrow">KOD POKOJU</div>
            <div className="dgv-room-code-row">
              <div className="dgv-room-code">{roomId}</div>
              <button type="button" className={`dgv-copy-button ${copied ? 'copied' : ''}`} onClick={onCopy}>
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            <p>Wyślij kod znajomym. Pokój aktualizuje się automatycznie po dołączeniu nowych graczy.</p>
          </div>
          <div className="dgv-room-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(6,8,22,.86), rgba(6,8,22,.18)), url(${heroBanner})` }}>
            <div>
              <div className="dgv-eyebrow">GOTOWI?</div>
              <h2>{isHost ? 'USTAW ZASADY I RUSZAJCIE' : 'CZEKAMY NA HOSTA'}</h2>
              <p>{isHost ? 'Wybierz liczbę kart i kategorie, a następnie rozpocznij rozgrywkę.' : `Host: ${room.players.find((p) => p.id === room.hostId)?.name || 'Gracz'}`}</p>
            </div>
          </div>
        </section>

        <div className="dgv-lobby-grid">
          <section className="dgv-panel dgv-players-panel">
            <div className="dgv-section-heading"><Users size={19} /> GRACZE <span>{room.players.length}</span></div>
            <div className="dgv-player-list">
              {room.players.map((player) => (
                <PlayerBadge
                  key={player.id}
                  player={player}
                  hostId={room.hostId}
                  myId={playerId}
                  level={player.authed && playerLevels[player.id] !== undefined ? levelFromXp(playerLevels[player.id]).level : null}
                  canKick={isHost && player.id !== playerId}
                  onKick={() => onKick(player)}
                />
              ))}
            </div>
            <div className="dgv-player-tip"><Sparkles size={16} /> Minimum 2 graczy do zwykłej rozgrywki.</div>
          </section>

          <section className="dgv-panel dgv-settings-panel">
            <div className="dgv-section-heading"><Gamepad2 size={19} /> ZASADY GRY</div>
            {isHost ? (
              <>
                <div className="dgv-setting-row">
                  <div>
                    <div className="dgv-setting-label">KART DO WYGRANIA</div>
                    <div className="dgv-setting-desc">Pierwszy gracz, który osiągnie ten wynik, wygrywa.</div>
                  </div>
                  <div className="dgv-stepper">
                    <button type="button" onClick={() => setTarget(Math.max(1, Number(target || 1) - 1))}>−</button>
                    <input type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
                    <button type="button" onClick={() => setTarget(Number(target || 0) + 1)}>+</button>
                  </div>
                </div>

                <div className="dgv-category-block">
                  <div className="dgv-setting-label">KATEGORIE</div>
                  <div className="dgv-category-grid">
                    {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => {
                      const active = selectedCategories.includes(category.slug);
                      return <button type="button" key={category.slug} className={active ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>;
                    })}
                  </div>
                </div>

                <div className="dgv-library-info"><Music2 size={17} /> <strong>{playableCount}</strong> utworów pasuje do obecnych zasad.</div>
                <button type="button" className="dgv-start-button" disabled={busy || !target || room.players.length < 2} onClick={onStart}>
                  <Play size={22} fill="currentColor" /> ROZPOCZNIJ GRĘ <ChevronRight size={22} />
                </button>
                {room.players.length < 2 ? <div className="dgv-warning">Czekamy na co najmniej jednego dodatkowego gracza.</div> : null}
              </>
            ) : (
              <div className="dgv-waiting-host">
                <div className="dgv-pulse-ring"><Crown size={34} /></div>
                <h3>HOST USTAWIA ZASADY</h3>
                <p>Gdy wszystko będzie gotowe, gra rozpocznie się automatycznie.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </SessionBackground>
  );
}

function DesktopVinyl({ spinning, progress = 0 }) {
  const safeProgress = Math.max(0, Math.min(100, progress * 100));
  return (
    <div className={`dgv-v3-turntable ${spinning ? 'spinning' : ''}`} style={{ '--listen-progress': `${safeProgress}%` }}>
      <div className="dgv-v3-deck-lines" />
      <div className="dgv-v3-record-wrap">
        <div className="dgv-v3-record">
          <div className="dgv-v3-record-grooves" />
          <div className="dgv-v3-record-label"><Music2 size={30} /></div>
          <div className="dgv-v3-record-hole" />
        </div>
      </div>
      <div className="dgv-v3-tonearm-base"><span /></div>
      <div className="dgv-v3-tonearm"><span /></div>
      <div className="dgv-v3-deck-mark"><small>HITSTERIADA</small><strong>AUDIO DECK 01</strong></div>
      <div className="dgv-v3-deck-progress"><span /></div>
    </div>
  );
}

function DesktopTimelineCard({ card, highlight, onClick }) {
  return (
    <button
      type="button"
      className={`dgv-timeline-card ${highlight || ''}`}
      onClick={onClick}
      title={`${card.title || ''} — ${card.artist || ''}`}
    >
      <span className="dgv-timeline-corner tl" />
      <span className="dgv-timeline-corner br" />
      <div className="dgv-timeline-year">{card.year}</div>
      <div className="dgv-timeline-title">{card.title || '—'}</div>
      <div className="dgv-timeline-artist">{card.artist || '—'}</div>
    </button>
  );
}

function DesktopSlot({ index, chosen, onPick }) {
  return (
    <button
      type="button"
      className={`dgv-slot ${chosen === index ? 'selected' : ''}`}
      onClick={() => onPick(index)}
      aria-label={`Umieść kartę w pozycji ${index + 1}`}
    >
      <span>+</span>
    </button>
  );
}

function GuessPanel({ guessArtist, setGuessArtist, guessTitle, setGuessTitle, tokens, onSwap, onBuy, busy, swapCost, buyCost }) {
  return (
    <section className="dgv-panel dgv-guess-panel">
      <div className="dgv-section-heading"><Headphones size={18} /> BONUS: TYTUŁ I WYKONAWCA <span className="dgv-token-count"><img src={iconToken} alt="" /> {tokens}</span></div>
      <p>Opcjonalnie. Jeśli inni gracze zaakceptują odpowiedź, zdobywasz token.</p>
      <div className="dgv-guess-inputs">
        <input value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} placeholder="Wykonawca" />
        <input value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} placeholder="Tytuł" />
      </div>
      <div className="dgv-utility-row">
        <button type="button" onClick={onSwap} disabled={busy || tokens < swapCost}><RotateCcw size={15} /> WYMIEŃ ({swapCost})</button>
        <button type="button" onClick={onBuy} disabled={busy || tokens < buyCost}><Gift size={15} /> KUP KARTĘ ({buyCost})</button>
      </div>
    </section>
  );
}

function VotingPanel({ isMyTurn, turnPlayerName, correctCard, pendingGuess, requiredApprovals, votesCount, votersCount, countdown, myVote, onVote, busy }) {
  return (
    <section className="dgv-panel dgv-voting-panel">
      <div className="dgv-section-heading"><Shield size={18} /> GŁOSOWANIE</div>
      <h3>{isMyTurn ? 'CZEKASZ NA GŁOSY…' : `CZY ${turnPlayerName} ZGADŁ(A)?`}</h3>
      <div className="dgv-vote-compare">
        <div><span>PRAWIDŁOWO</span><strong>{correctCard?.artist} — „{correctCard?.title}”</strong></div>
        <div><span>ODPOWIEDŹ GRACZA</span><strong>{pendingGuess?.artist || '—'} — „{pendingGuess?.title || '—'}”</strong></div>
      </div>
      <div className="dgv-vote-meta">Potrzeba {requiredApprovals} głosów TAK · oddano {votesCount}/{votersCount} · {countdown ?? '—'}s</div>
      {!isMyTurn && myVote === undefined ? (
        <div className="dgv-vote-actions">
          <button className="yes" onClick={() => onVote(true)} disabled={busy}><Check size={19} /> TAK, ZALICZA SIĘ</button>
          <button className="no" onClick={() => onVote(false)} disabled={busy}><X size={19} /> NIE</button>
        </div>
      ) : !isMyTurn ? <div className="dgv-voted">Twój głos: <strong>{myVote ? 'TAK' : 'NIE'}</strong></div> : null}
    </section>
  );
}

function ResultOverlay({ room, advanceCountdown }) {
  const result = room.lastResult;
  if (!result) return null;
  const ownerId = room.currentPlayerId;
  const ownerName = room.players.find((p) => p.id === ownerId)?.name || 'Gracz';
  const ownerTimeline = [...(room.timelines?.[ownerId] || [])].sort((a, b) => a.year - b.year);
  const hasGhost = !result.timedOut && !result.correct && result.chosenSlot !== undefined && result.chosenSlot !== null;
  const displayCards = hasGhost ? (() => {
    const next = [...ownerTimeline];
    next.splice(result.chosenSlot, 0, { ...result.card, __ghost: true });
    return next;
  })() : ownerTimeline;
  const placementGood = Boolean(result.bought || result.correct);
  const headline = result.timedOut ? 'CZAS MINĄŁ' : result.bought ? 'KARTA ZDOBYTA' : placementGood ? 'DOBRE MIEJSCE!' : 'NIE TYM RAZEM';

  return (
    <div className="dgv-result-overlay">
      <div className={`dgv-result-card dgv-result-v3 ${placementGood ? 'success' : 'failure'}`}>
        <div className="dgv-result-v3-topline">
          <div className="dgv-result-v3-statusline">
            <div className="dgv-result-status-icon">{placementGood ? <Check size={30} /> : <X size={30} />}</div>
            <h2>{headline}</h2>
          </div>
        </div>

        <div className="dgv-result-v3-main">
          <section className="dgv-result-v3-song">
            <span className="dgv-eyebrow">POPRAWNA ODPOWIEDŹ</span>
            <div className="dgv-result-reveal">
              <span className="dgv-result-card-notch left" />
              <span className="dgv-result-card-notch right" />
              <div className="year">{result.card.year}</div>
              <div className="title">{result.card.title}</div>
              <div className="artist">{result.card.artist}</div>
            </div>
          </section>

          <section className="dgv-result-v3-summary">
            <div className={`dgv-result-v3-check ${placementGood ? 'good' : 'bad'}`}>
              <div className="icon">{placementGood ? <Check size={24} /> : <X size={24} />}</div>
              <div><span>OŚ CZASU</span><strong>{placementGood ? 'POPRAWNIE' : 'BŁĘDNE MIEJSCE'}</strong></div>
            </div>
            {result.tokenAwarded !== undefined ? (
              <div className={`dgv-result-v3-check ${result.tokenAwarded ? 'good' : 'bad'}`}>
                <div className="icon">{result.tokenAwarded ? <Check size={24} /> : <X size={24} />}</div>
                <div><span>TYTUŁ I WYKONAWCA</span><strong>{result.tokenAwarded ? '+1 TOKEN' : 'BRAK TOKENA'}</strong></div>
              </div>
            ) : (
              <div className="dgv-result-v3-check neutral">
                <div className="icon"><Music2 size={23} /></div>
                <div><span>TRYB SOLO</span><strong>LICZY SIĘ OŚ CZASU</strong></div>
              </div>
            )}
            <div className="dgv-result-v3-hint">
              <Sparkles size={17} />
              <span>{placementGood ? 'Dobra robota — utrzymaj serię w następnej rundzie.' : `Zapamiętaj: ${result.card.artist} — ${result.card.title} (${result.card.year}).`}</span>
            </div>
          </section>
        </div>

        <div className="dgv-result-v3-countdown">
          <div className="dgv-result-v3-countdown-label">
            <Clock3 size={19} />
            <span>{room.practiceMode ? 'KOLEJNY UTWÓR ZA' : 'KOLEJNA TURA ZA'}</span>
          </div>
          <strong>{advanceCountdown ?? 5}</strong>
          <em>SEK.</em>
        </div>

        {displayCards.length ? (
          <section className="dgv-result-timeline dgv-result-v3-timeline">
            <div className="dgv-result-timeline-head">
              <div>
                <div className="dgv-eyebrow">{room.practiceMode ? 'TWOJA OŚ CZASU' : `OŚ CZASU · ${ownerName}`}</div>
                <strong>PO TEJ RUNDZIE</strong>
              </div>
              <span>{ownerTimeline.length} / {room.target}</span>
            </div>
            <div className="dgv-timeline-row compact result-row">
              {displayCards.map((card, index) => {
                const placed = !card.__ghost && result.correct && card.videoId === result.card.videoId && card.year === result.card.year;
                return <DesktopTimelineCard key={card.__ghost ? 'ghost' : card.id || index} card={card} highlight={card.__ghost ? 'bad' : placed ? 'good' : ''} />;
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ChatDrawer({ open, setOpen, messages, playerId, chatInput, setChatInput, onSend }) {
  return (
    <>
      <button type="button" className="dgv-chat-fab" onClick={() => setOpen((v) => !v)}><MessageCircle size={24} /></button>
      {open ? (
        <aside className="dgv-chat-drawer">
          <div className="dgv-chat-head"><span>CZAT POKOJU</span><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
          <div className="dgv-chat-messages">
            {messages.length === 0 ? <div className="dgv-chat-empty">Napisz pierwszą wiadomość.</div> : messages.slice(-30).map((msg, i) => (
              <div key={`${msg.ts || i}-${i}`} className={`dgv-chat-message ${msg.playerId === playerId ? 'mine' : ''}`}>
                <span>{msg.name}</span><p>{msg.text}</p>
              </div>
            ))}
          </div>
          <div className="dgv-chat-compose">
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()} placeholder="Napisz wiadomość…" />
            <button type="button" disabled={!chatInput.trim()} onClick={onSend}><Send size={18} /></button>
          </div>
        </aside>
      ) : null}
    </>
  );
}

export function DesktopPlayingView({
  screen,
  room,
  playerId,
  isMyTurn,
  turnPlayerName,
  decisionLeft,
  playElapsed,
  playCapSeconds,
  isPlaying,
  iframeRef,
  onTogglePlay,
  guessArtist,
  setGuessArtist,
  guessTitle,
  setGuessTitle,
  onSwapSong,
  onBuyCard,
  swapCost,
  buyCost,
  chosenSlot,
  setChosenSlot,
  turnTimeline,
  viewedTimeline,
  displayedPlayerId,
  displayedPlayerName,
  setViewedPlayerId,
  onConfirmPlacement,
  busy,
  playerLevels,
  levelFromXp,
  votingCountdown,
  onVote,
  advanceCountdown,
  onLeave,
  chatInput,
  setChatInput,
  onSendChat,
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const modeLabel = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.practiceMode ? 'TRENING' : room.tournamentMode ? 'TURNIEJ' : 'ROZGRYWKA';
  const currentTokens = room.tokens?.[playerId] || 0;
  const turnName = room.practiceMode ? 'TRENING SOLO' : isMyTurn ? 'TWOJA KOLEJ!' : turnPlayerName || 'TURA GRACZA';
  const practicePlayed = room.practiceMode ? (room.playedCards || []).filter((card) => card.playerId === playerId) : [];
  const practiceCorrect = practicePlayed.filter((card) => card.correct).length;
  const practiceWrong = practicePlayed.filter((card) => !card.correct).length;
  const activeTimelineLength = (room.timelines?.[displayedPlayerId] || []).length;
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));

  return (
    <SessionBackground className="dgv-game dgv-game-v3">
      <div className="dgv-shell dgv-game-shell">
        <SessionHeader
          eyebrow={modeLabel}
          title={turnName}
          onBack={onLeave}
          backLabel="Opuść"
          right={screen === 'playing' ? <div className={`dgv-timer ${decisionLeft <= 10 ? 'danger' : ''}`}><Clock3 size={18} /> {decisionLeft}s</div> : null}
        />

        <div className="dgv-v3-game-grid">
          <section className="dgv-panel dgv-v3-audio-panel">
            <div className="dgv-v3-panel-label"><Disc3 size={16} /> ODSŁUCH UTWORU</div>
            <DesktopVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
            <div className="dgv-hidden-player">
              <iframe
                key={room.currentCard?.id}
                ref={iframeRef}
                title="player"
                src={`https://www.youtube.com/embed/${room.currentCard?.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.startSeconds}&controls=0&modestbranding=1&rel=0`}
                allow="autoplay; encrypted-media"
              />
            </div>
            <div className="dgv-v3-audio-footer">
              <div className="dgv-v3-audio-time"><span>FRAGMENT</span><strong>{audioLeft}s</strong></div>
              <button type="button" className="dgv-audio-button" onClick={onTogglePlay}>
                <Play size={20} fill="currentColor" />
                <span>{isPlaying ? 'ODTWARZANIE' : playElapsed >= playCapSeconds ? 'ODTWÓRZ PONOWNIE' : 'ODTWÓRZ DŹWIĘK'}</span>
              </button>
            </div>
          </section>

          <section className="dgv-panel dgv-v3-placement-panel">
            <div className="dgv-v3-placement-head">
              <div>
                <div className="dgv-eyebrow">OŚ CZASU</div>
                <h2>{isMyTurn ? 'GDZIE PASUJE TEN UTWÓR?' : `OŚ GRACZA ${displayedPlayerName}`}</h2>
                <p>{isMyTurn ? 'Kliknij + pomiędzy kartami. Rok poznasz dopiero po zatwierdzeniu.' : 'Podgląd aktualnie wybranej osi czasu.'}</p>
              </div>
              <div className="dgv-target-progress"><b>{activeTimelineLength}</b><span>/ {room.target}</span></div>
            </div>

            {screen === 'playing' && isMyTurn ? (
              <>
                <div className="dgv-v3-timeline-stage">
                  <div className="dgv-timeline-row">
                    <DesktopSlot index={0} chosen={chosenSlot} onPick={setChosenSlot} />
                    {turnTimeline.map((card, index) => (
                      <React.Fragment key={card.id || `${card.videoId}-${index}`}>
                        <DesktopTimelineCard card={card} />
                        <DesktopSlot index={index + 1} chosen={chosenSlot} onPick={setChosenSlot} />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <div className="dgv-v3-placement-footer">
                  <div className={`dgv-v3-slot-state ${chosenSlot !== null ? 'ready' : ''}`}>
                    <span>{chosenSlot !== null ? 'POZYCJA WYBRANA' : 'WYBIERZ POZYCJĘ'}</span>
                    <strong>{chosenSlot !== null ? `SLOT ${chosenSlot + 1}` : '—'}</strong>
                  </div>
                  <button type="button" className="dgv-confirm-button" onClick={onConfirmPlacement} disabled={chosenSlot === null || busy}>
                    <span>ZATWIERDŹ MIEJSCE</span><ChevronRight size={22} />
                  </button>
                </div>
              </>
            ) : (
              <div className="dgv-v3-timeline-stage spectator-stage">
                <div className="dgv-timeline-row spectator">
                  {viewedTimeline.map((card, index) => <DesktopTimelineCard key={card.id || `${card.videoId}-${index}`} card={card} />)}
                </div>
              </div>
            )}
          </section>

          <aside className="dgv-game-side dgv-v3-side">
            {screen === 'playing' && isMyTurn && !room.practiceMode ? (
              <GuessPanel
                guessArtist={guessArtist}
                setGuessArtist={setGuessArtist}
                guessTitle={guessTitle}
                setGuessTitle={setGuessTitle}
                tokens={currentTokens}
                onSwap={onSwapSong}
                onBuy={onBuyCard}
                busy={busy}
                swapCost={swapCost}
                buyCost={buyCost}
              />
            ) : null}

            {screen === 'voting' && room.pendingGuess ? (
              <VotingPanel
                isMyTurn={isMyTurn}
                turnPlayerName={turnPlayerName}
                correctCard={room.lastResult?.card}
                pendingGuess={room.pendingGuess}
                requiredApprovals={room.requiredApprovals}
                votesCount={Object.keys(room.votes || {}).length}
                votersCount={Math.max(0, room.players.length - 1)}
                countdown={votingCountdown}
                myVote={room.votes?.[playerId]}
                onVote={onVote}
                busy={busy}
              />
            ) : null}

            {room.practiceMode ? (
              <section className="dgv-panel dgv-practice-progress-panel dgv-v3-progress-panel">
                <div className="dgv-section-heading"><Zap size={18} /> POSTĘP TRENINGU</div>
                <div className="dgv-practice-progress-main">
                  <strong>{(room.timelines?.[playerId] || []).length}</strong><span>/ {room.target} kart</span>
                </div>
                <div className="dgv-practice-progress-bar"><span style={{ width: `${Math.min(100, ((room.timelines?.[playerId] || []).length / Math.max(1, room.target)) * 100)}%` }} /></div>
                <div className="dgv-practice-mini-stats">
                  <div className="good"><Check size={18} /><span>Trafienia</span><strong>{practiceCorrect}</strong></div>
                  <div className="bad"><X size={18} /><span>Pomyłki</span><strong>{practiceWrong}</strong></div>
                </div>
                <div className="dgv-v3-tip"><Sparkles size={16} /> Liczy się tylko poprawne miejsce na osi czasu.</div>
              </section>
            ) : (
              <section className="dgv-panel dgv-score-panel dgv-v3-score-panel">
                <div className="dgv-section-heading"><Users size={18} /> GRACZE</div>
                <div className="dgv-score-list">
                  {room.players.map((player) => (
                    <PlayerBadge
                      key={player.id}
                      player={player}
                      hostId={room.hostId}
                      myId={playerId}
                      active={displayedPlayerId === player.id}
                      score={(room.timelines?.[player.id] || []).length}
                      tokenCount={room.tokens?.[player.id] || 0}
                      level={player.authed && playerLevels[player.id] !== undefined ? levelFromXp(playerLevels[player.id]).level : null}
                      onClick={() => setViewedPlayerId(player.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>

      {screen === 'roundResult' ? <ResultOverlay room={room} advanceCountdown={advanceCountdown} /> : null}
      {!room.practiceMode ? <ChatDrawer open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </SessionBackground>
  );
}

export function DesktopOpenerView({
  room,
  openerPhase,
  openerCountdownNum,
  isPlaying,
  playElapsed,
  playCapSeconds,
  iframeRef,
  onTogglePlay,
  openerLockedOut,
  setOpenerLockedOut,
  onAnswer,
  openerRevealCountdown,
  onLeave,
}) {
  if (openerPhase === 'countdown') {
    return (
      <SessionBackground className="dgv-opener-countdown">
        <div className="dgv-countdown-copy"><div>KTO ZACZYNA?</div><strong>{openerCountdownNum}</strong><span>Przygotuj się</span></div>
      </SessionBackground>
    );
  }

  return (
    <SessionBackground className="dgv-opener">
      <div className="dgv-shell">
        <SessionHeader eyebrow="START ROZGRYWKI" title="KTO ZACZYNA?" onBack={onLeave} backLabel="Opuść" />
        <div className="dgv-opener-grid">
          <section className="dgv-panel dgv-opener-audio">
            <DesktopVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
            <div className="dgv-hidden-player"><iframe key={`opener-${room.openerCard.id}`} ref={iframeRef} title="opener-player" src={`https://www.youtube.com/embed/${room.openerCard.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.openerStartSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
            <button type="button" className="dgv-audio-button" onClick={onTogglePlay}><Play size={20} fill="currentColor" /> {isPlaying ? 'GRA…' : 'WŁĄCZ DŹWIĘK'}</button>
          </section>
          <section className="dgv-panel dgv-opener-answer">
            {room.openerWinnerId ? (
              <div className="dgv-opener-winner"><Trophy size={54} /><h2>{room.players.find((p) => p.id === room.openerWinnerId)?.name} ZACZYNA!</h2><strong>{openerRevealCountdown ?? 5}</strong></div>
            ) : (
              <>
                <div className="dgv-section-heading"><Zap size={18} /> KTO PIERWSZY ZGADNIE?</div>
                <p>Wybierz wykonawcę i tytuł. Pierwsza poprawna odpowiedź ustala gracza rozpoczynającego.</p>
                <div className="dgv-opener-options">
                  {room.openerOptions.map((option, index) => (
                    <button type="button" key={`${option.artist}-${index}`} disabled={openerLockedOut} onClick={() => { setOpenerLockedOut(true); onAnswer(index); }}>{option.artist} — {option.title}<ChevronRight size={18} /></button>
                  ))}
                </div>
                {openerLockedOut ? <div className="dgv-waiting-answer">Odpowiedź wysłana — czekamy na wynik…</div> : null}
              </>
            )}
          </section>
        </div>
      </div>
    </SessionBackground>
  );
}

function RankingList({ title, icon, rows, value, empty, accent = 'cyan' }) {
  return (
    <section className={`dgv-panel dgv-ranking-card ${accent}`}>
      <div className="dgv-section-heading">{icon} {title}</div>
      {rows.length === 0 ? <div className="dgv-ranking-empty">{empty}</div> : (
        <div className="dgv-ranking-list">
          {rows.map((row, index) => (
            <div key={row.key || `${row.name}-${index}`} className={index < 3 ? `podium p${index + 1}` : ''}>
              <span className="place">#{index + 1}</span>
              <span className="avatar">{initials(row.name)}</span>
              <span className="name">{row.name}</span>
              {row.note ? <span className="note">{row.note}</span> : null}
              <strong>{value(row)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function DesktopDailyPlaylistHubView({ alreadyPlayed, dailyBoard, weeklyBoard, allTimeBoard, busy, onStart, onHome }) {
  const dailyRows = dailyBoard.map((item) => ({ key: item.uid, name: item.name, ...item }));
  const weeklyRows = weeklyBoard.map((item) => ({ key: item.uid, name: item.name, note: `${item.gamesPlayed || 0} gier`, ...item }));
  const allRows = allTimeBoard.map((item) => ({ key: item.uid, name: item.username || item.name, note: `${item.playlistGamesPlayed || 0} gier`, ...item }));

  return (
    <SessionBackground className="dgv-daily-hub">
      <div className="dgv-shell">
        <SessionHeader eyebrow="CODZIENNE WYZWANIE" title="PLAYLISTA DNIA" onBack={onHome} />
        <section className="dgv-daily-hero dgv-panel">
          <div className="dgv-daily-copy">
            <img src={glPlaylista} alt="" />
            <div className="dgv-eyebrow">TA SAMA PLAYLISTA DLA WSZYSTKICH</div>
            <h1>10 UTWORÓW.<br /><span>JEDEN WYNIK.</span></h1>
            <p>Ułóż dzisiejszą playlistę chronologicznie. Przy remisie wyżej jest gracz, który ukończył wyzwanie szybciej.</p>
            {alreadyPlayed ? (
              <div className="dgv-daily-result"><Check size={26} /><div><span>TWÓJ DZISIEJSZY WYNIK</span><strong>{alreadyPlayed.score} / 10</strong></div></div>
            ) : (
              <button type="button" className="dgv-start-button daily" disabled={busy} onClick={onStart}><Play size={22} fill="currentColor" /> ZAGRAJ W PLAYLISTĘ DNIA</button>
            )}
          </div>
          <div className="dgv-daily-art" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,8,22,.38), rgba(5,8,22,.08)), url(${heroBanner})` }} />
        </section>

        <div className="dgv-rankings-grid">
          <RankingList title="RANKING DNIA" icon={<Trophy size={18} />} rows={dailyRows} value={(row) => `${row.score} / 10`} empty="Nikt jeszcze dziś nie zagrał." accent="cyan" />
          <RankingList title="RANKING TYGODNIA" icon={<Crown size={18} />} rows={weeklyRows} value={(row) => `${row.score} pkt`} empty="Brak wyników w tym tygodniu." accent="gold" />
          <RankingList title="WSZECH CZASÓW" icon={<Flame size={18} />} rows={allRows} value={(row) => `${row.playlistTotalScore || 0} pkt`} empty="Brak wyników." accent="pink" />
        </div>

        <section className="dgv-daily-rewards dgv-panel">
          <div><img src={glKorona} alt="" /><span>1. MIEJSCE</span><strong>+500 XP</strong></div>
          <div><img src={glPrezent} alt="" /><span>2. MIEJSCE</span><strong>+250 XP</strong></div>
          <div><Trophy size={30} /><span>3. MIEJSCE</span><strong>+100 XP</strong></div>
          <p>Nagrody tygodniowe są przyznawane automatycznie na początku kolejnego tygodnia.</p>
        </section>
      </div>
    </SessionBackground>
  );
}


export function DesktopPracticeResultView({ room, playerId, onAgain, onHome }) {
  const timeline = [...(room.timelines?.[playerId] || [])].sort((a, b) => a.year - b.year);
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const correct = played.filter((card) => card.correct).length;
  const wrong = played.filter((card) => !card.correct).length;

  return (
    <SessionBackground className="dgv-practice-result-page">
      <div className="dgv-shell">
        <SessionHeader eyebrow="TRYB SOLO" title="TRENING UKOŃCZONY" onBack={onHome} backLabel="Strona główna" />
        <section className="dgv-practice-result-hero dgv-panel">
          <img src={glTrening} alt="" />
          <div>
            <div className="dgv-eyebrow">CEL OSIĄGNIĘTY</div>
            <h1>{timeline.length} <span>KART</span></h1>
            <p>Zbudowałeś pełną oś czasu. Sprawdź przebieg sesji albo rozpocznij kolejny trening z innymi kategoriami.</p>
          </div>
          <div className="dgv-practice-result-stats">
            <div className="good"><Check size={22} /><strong>{correct}</strong><span>trafień</span></div>
            <div className="bad"><X size={22} /><strong>{wrong}</strong><span>pomyłek</span></div>
          </div>
        </section>

        <section className="dgv-panel dgv-practice-final-timeline">
          <div className="dgv-section-heading"><Music2 size={18} /> TWOJA OŚ CZASU</div>
          <div className="dgv-final-years">
            {timeline.map((card, index) => <span key={card.id || `${card.videoId}-${index}`}>{card.year}</span>)}
          </div>
        </section>

        {played.length ? (
          <section className="dgv-panel dgv-practice-history">
            <div className="dgv-section-heading"><Headphones size={18} /> OSTATNIE UTWORY</div>
            <div className="dgv-practice-history-list">
              {played.slice(-10).reverse().map((card, index) => (
                <div key={`${card.videoId || index}-${index}`} className={card.correct ? 'correct' : 'wrong'}>
                  <span>{card.correct ? <Check size={17} /> : <X size={17} />}</span>
                  <div><strong>{card.artist || '—'}</strong><small>{card.title || '—'}</small></div>
                  <b>{card.year}</b>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="dgv-practice-result-actions">
          <button type="button" className="dgv-start-button" onClick={onAgain}><RotateCcw size={20} /> NOWY TRENING</button>
          <button type="button" className="dgv-ghost-button large" onClick={onHome}><ArrowLeft size={18} /> STRONA GŁÓWNA</button>
        </div>
      </div>
    </SessionBackground>
  );
}

export function DesktopDailyPlaylistResultView({ room, playerId, onBackToRankings, onLeave }) {
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const score = played.filter((card) => card.correct).length;
  return (
    <SessionBackground className="dgv-daily-result-page">
      <div className="dgv-result-end">
        <img src={glPlaylista} alt="" />
        <div className="dgv-eyebrow">PLAYLISTA DNIA UKOŃCZONA</div>
        <h1>{score} / 10</h1>
        <p>{score === 10 ? 'PERFEKCYJNIE! Wszystkie pozycje poprawne.' : 'Wynik zapisany. Jutro czeka nowa playlista.'}</p>
        <div className="dgv-end-actions">
          <button type="button" className="dgv-start-button" onClick={onBackToRankings}><Trophy size={20} /> WRÓĆ DO RANKINGÓW</button>
          <button type="button" className="dgv-ghost-button large" onClick={onLeave}><LogOut size={18} /> STRONA GŁÓWNA</button>
        </div>
      </div>
    </SessionBackground>
  );
}
