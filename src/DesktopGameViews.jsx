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
  return (
    <div className={`dgv-vinyl-wrap ${spinning ? 'spinning' : ''}`} style={{ '--listen-progress': `${Math.max(0, Math.min(100, progress * 100))}%` }}>
      <div className="dgv-vinyl-halo" />
      <div className="dgv-vinyl-disc">
        <div className="dgv-vinyl-label"><img src={logoImg} alt="" /></div>
      </div>
      <div className="dgv-tonearm"><span /></div>
    </div>
  );
}

function DesktopTimelineCard({ card, highlight, onClick }) {
  return (
    <button type="button" className={`dgv-timeline-card ${highlight || ''}`} onClick={onClick} title={`${card.artist || ''} — ${card.title || ''}`}>
      <div className="dgv-timeline-year">{card.year}</div>
      <div className="dgv-timeline-artist">{card.artist || '—'}</div>
    </button>
  );
}

function DesktopSlot({ index, chosen, onPick }) {
  return <button type="button" className={`dgv-slot ${chosen === index ? 'selected' : ''}`} onClick={() => onPick(index)}>+</button>;
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

  return (
    <div className="dgv-result-overlay">
      <div className="dgv-result-card">
        <div className="dgv-result-player">{ownerName}</div>
        <div className="dgv-result-checks">
          <div className={result.bought || result.correct ? 'good' : 'bad'}><span>OŚ CZASU</span>{result.bought || result.correct ? <Check /> : <X />}</div>
          {result.tokenAwarded !== undefined ? <div className={result.tokenAwarded ? 'good' : 'bad'}><span>TYTUŁ I WYKONAWCA</span>{result.tokenAwarded ? <Check /> : <X />}</div> : null}
        </div>
        <div className="dgv-result-reveal">
          <div className="artist">{result.card.artist}</div>
          <div className="year">{result.card.year}</div>
          <div className="title">„{result.card.title}”</div>
        </div>
        {displayCards.length ? (
          <div className="dgv-result-timeline">
            <div className="dgv-eyebrow">OŚ CZASU GRACZA {ownerName}</div>
            <div className="dgv-timeline-row compact">
              {displayCards.map((card, index) => {
                const placed = !card.__ghost && result.correct && card.videoId === result.card.videoId && card.year === result.card.year;
                return <DesktopTimelineCard key={card.__ghost ? 'ghost' : card.id || index} card={card} highlight={card.__ghost ? 'bad' : placed ? 'good' : ''} />;
              })}
            </div>
          </div>
        ) : null}
        <div className="dgv-next-player">Kolejny gracz za <strong>{advanceCountdown ?? 5}</strong>…</div>
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
  const turnName = isMyTurn ? 'TWOJA KOLEJ!' : turnPlayerName || 'TURA GRACZA';

  return (
    <SessionBackground className="dgv-game">
      <div className="dgv-shell dgv-game-shell">
        <SessionHeader
          eyebrow={modeLabel}
          title={turnName}
          onBack={onLeave}
          backLabel="Opuść"
          right={screen === 'playing' ? <div className={`dgv-timer ${decisionLeft <= 10 ? 'danger' : ''}`}><Clock3 size={18} /> {decisionLeft}s</div> : null}
        />

        <div className="dgv-game-grid">
          <section className="dgv-audio-panel dgv-panel">
            <div className="dgv-audio-topline">
              <div><span className="dgv-eyebrow">TURA GRACZA</span><strong>{turnName}</strong></div>
              <div className="dgv-listen-meter"><span style={{ width: `${Math.min(100, (playElapsed / playCapSeconds) * 100)}%` }} /></div>
            </div>
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
            <button type="button" className="dgv-audio-button" onClick={onTogglePlay}><Play size={20} fill="currentColor" /> {isPlaying ? `GRA… ${Math.ceil(playCapSeconds - playElapsed)}s` : playElapsed >= playCapSeconds ? 'ODTWÓRZ PONOWNIE' : 'ODTWÓRZ DŹWIĘK'}</button>
          </section>

          <aside className="dgv-game-side">
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

            <section className="dgv-panel dgv-score-panel">
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
          </aside>
        </div>

        <section className="dgv-timeline-panel dgv-panel">
          <div className="dgv-timeline-heading">
            <div>
              <div className="dgv-eyebrow">OŚ CZASU</div>
              <strong>{isMyTurn ? 'GDZIE UMIESZCZASZ TĘ PIOSENKĘ?' : `OŚ CZASU GRACZA ${displayedPlayerName}`}</strong>
            </div>
            <div className="dgv-target-progress">{(room.timelines?.[displayedPlayerId] || []).length} / {room.target}</div>
          </div>

          {screen === 'playing' && isMyTurn ? (
            <>
              <div className="dgv-timeline-row">
                <DesktopSlot index={0} chosen={chosenSlot} onPick={setChosenSlot} />
                {turnTimeline.map((card, index) => (
                  <React.Fragment key={card.id || `${card.videoId}-${index}`}>
                    <DesktopTimelineCard card={card} />
                    <DesktopSlot index={index + 1} chosen={chosenSlot} onPick={setChosenSlot} />
                  </React.Fragment>
                ))}
              </div>
              <button type="button" className="dgv-confirm-button" onClick={onConfirmPlacement} disabled={chosenSlot === null || busy}>ZATWIERDŹ MIEJSCE <ChevronRight size={22} /></button>
            </>
          ) : (
            <div className="dgv-timeline-row spectator">
              {viewedTimeline.map((card, index) => <DesktopTimelineCard key={card.id || `${card.videoId}-${index}`} card={card} />)}
            </div>
          )}
        </section>
      </div>

      {screen === 'roundResult' ? <ResultOverlay room={room} advanceCountdown={advanceCountdown} /> : null}
      <ChatDrawer open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} />
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
