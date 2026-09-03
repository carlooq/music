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
import iconToken from './assets/icons/icon-token.png';
import glTrening from './assets/icons/gl-trening.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glPiosenka from './assets/icons/gl-piosenka.png';
import glTurniej from './assets/icons/gl-turniej.png';
import glHitRush from './assets/icons/gl-hitrush.png';
import glKorona from './assets/icons/gl-korona.png';

function initials(label) {
  const raw = String(label || 'G').trim();
  return raw.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'G';
}

function MobileSession({ children, className = '' }) {
  return (
    <div className={`mgv-root ${className}`} style={{ backgroundImage: `linear-gradient(180deg, rgba(3,5,17,.84), rgba(3,5,17,.97)), url(${homeBg})` }}>
      <div className="mgv-shell">{children}</div>
    </div>
  );
}

function MobileHeader({ eyebrow, title, onBack, right, backLabel = 'Wróć' }) {
  return (
    <header className="mgv-header">
      <button type="button" className="mgv-brand" onClick={onBack} aria-label={backLabel}>
        <img src={logoImg} alt="Hitsteriada" />
      </button>
      <div className="mgv-header-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
      </div>
      <div className="mgv-header-actions">
        {right}
        {onBack ? <button type="button" className="mgv-icon-btn" onClick={onBack} title={backLabel}><ArrowLeft size={18} /></button> : null}
      </div>
    </header>
  );
}

function Panel({ children, className = '', accent = 'cyan' }) {
  return <section className={`mgv-panel ${accent} ${className}`}>{children}</section>;
}

function ModeHero({ icon, eyebrow, title, description, accent = 'cyan', children }) {
  return (
    <Panel className="mgv-mode-hero" accent={accent}>
      <div className="mgv-mode-icon"><img src={icon} alt="" /></div>
      <div className="mgv-mode-copy">
        <span className="mgv-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </Panel>
  );
}

function PlayerRow({ player, hostId, myId, score, tokenCount, level, active, onClick, onKick, canKick }) {
  return (
    <button type="button" className={`mgv-player-row ${active ? 'active' : ''}`} onClick={onClick}>
      <span className="mgv-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>
        {!player.avatarUrl ? initials(player.name) : null}
      </span>
      <span className="mgv-player-info">
        <strong>{player.name}</strong>
        <small>
          {player.id === hostId ? 'HOST · ' : ''}
          {player.id === myId ? 'TY · ' : ''}
          {level ? `LVL ${level}` : 'GRACZ'}
        </small>
      </span>
      {Number.isFinite(score) ? <span className="mgv-player-score"><b>{score}</b><small>kart</small></span> : null}
      {Number.isFinite(tokenCount) ? <span className="mgv-player-token"><img src={iconToken} alt="" />{tokenCount}</span> : null}
      {canKick ? <span className="mgv-kick" role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); onKick?.(); }}>WYRZUĆ</span> : null}
    </button>
  );
}

function MobileVinyl({ spinning, progress = 0 }) {
  const safeProgress = Math.max(0, Math.min(100, Number(progress || 0) * 100));
  return (
    <div className={`mgv-turntable ${spinning ? 'spinning' : ''}`} style={{ '--listen-progress': `${safeProgress}%` }}>
      <div className="mgv-turntable-lines" />
      <div className="mgv-record-wrap">
        <div className="mgv-record">
          <div className="mgv-record-grooves" />
          <div className="mgv-record-label"><Music2 size={24} /></div>
          <div className="mgv-record-hole" />
        </div>
      </div>
      <div className="mgv-arm-base"><span /></div>
      <div className="mgv-arm"><span /></div>
      <div className="mgv-audio-progress"><span /></div>
    </div>
  );
}

function TimelineCard({ card, highlight = '', compact = false }) {
  return (
    <div className={`mgv-timeline-card ${highlight} ${compact ? 'compact' : ''}`} title={`${card?.title || ''} — ${card?.artist || ''}`}>
      <span className="mgv-card-line" />
      <strong>{card?.year ?? '—'}</strong>
      <span className="mgv-card-title">{card?.title || '—'}</span>
      <span className="mgv-card-artist">{card?.artist || '—'}</span>
    </div>
  );
}

function TimelineSlot({ index, selected, onPick }) {
  return (
    <button type="button" className={`mgv-slot ${selected === index ? 'selected' : ''}`} onClick={() => onPick(index)} aria-label={`Pozycja ${index + 1}`}>
      <span>+</span>
    </button>
  );
}

function MobileTimeline({ timeline = [], selectedSlot, onPick, interactive = true, compact = false, highlights = {} }) {
  return (
    <div className={`mgv-timeline-scroll ${compact ? 'compact' : ''}`}>
      <div className="mgv-timeline-row">
        {interactive ? <TimelineSlot index={0} selected={selectedSlot} onPick={onPick} /> : null}
        {timeline.map((card, index) => (
          <React.Fragment key={card?.id || `${card?.videoId || 'card'}-${index}`}>
            <TimelineCard card={card} compact={compact} highlight={highlights[index] || ''} />
            {interactive ? <TimelineSlot index={index + 1} selected={selectedSlot} onPick={onPick} /> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MobileChat({ open, setOpen, messages = [], playerId, chatInput, setChatInput, onSend }) {
  return (
    <>
      <button type="button" className="mgv-chat-fab" onClick={() => setOpen((v) => !v)}><MessageCircle size={23} /></button>
      {open ? (
        <div className="mgv-sheet-backdrop" onClick={() => setOpen(false)}>
          <aside className="mgv-chat-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mgv-sheet-handle" />
            <div className="mgv-sheet-head"><strong>CZAT POKOJU</strong><button type="button" onClick={() => setOpen(false)}><X size={19} /></button></div>
            <div className="mgv-chat-messages">
              {messages.length === 0 ? <div className="mgv-empty">Napisz pierwszą wiadomość.</div> : messages.slice(-30).map((msg, index) => (
                <div key={`${msg.ts || index}-${index}`} className={`mgv-chat-message ${msg.playerId === playerId ? 'mine' : ''}`}>
                  <span>{msg.name}</span><p>{msg.text}</p>
                </div>
              ))}
            </div>
            <div className="mgv-chat-compose">
              <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && onSend()} placeholder="Napisz wiadomość…" />
              <button type="button" onClick={onSend} disabled={!chatInput.trim()}><Send size={18} /></button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function MobilePracticeSetupView({ practiceTarget, setPracticeTarget, selectedCategories, categories = [], onToggleCategory, songPool = [], busy, onStart, onHome }) {
  const normalized = (values) => (values || []).map((value) => String(value || '').trim().toLowerCase());
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((category) => selectedCategories.includes(category))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;

  return (
    <MobileSession className="mgv-practice-setup">
      <MobileHeader eyebrow="TRYB SOLO" title="TRENING" onBack={onHome} />
      <ModeHero icon={glTrening} eyebrow="BEZ PRESJI" title="TRENING SOLO" description="Ćwicz ustawianie utworów na osi czasu. Bez rankingu, tokenów i innych graczy." accent="cyan">
        <div className="mgv-hero-chips"><span><Music2 size={14} /> {playableCount} utworów</span><span><Zap size={14} /> bez limitu prób</span></div>
      </ModeHero>

      <Panel className="mgv-settings-card">
        <div className="mgv-section-title"><Gamepad2 size={18} /><span>USTAW TRENING</span></div>
        <div className="mgv-setting-block">
          <div><strong>CEL TRENINGU</strong><small>Ile poprawnych kart chcesz umieścić na osi?</small></div>
          <div className="mgv-stepper">
            <button type="button" onClick={() => setPracticeTarget(Math.max(1, Number(practiceTarget || 1) - 1))}>−</button>
            <input type="number" min="1" value={practiceTarget} onChange={(event) => setPracticeTarget(event.target.value === '' ? '' : parseInt(event.target.value, 10))} />
            <button type="button" onClick={() => setPracticeTarget(Number(practiceTarget || 0) + 1)}>+</button>
          </div>
        </div>
        <div className="mgv-category-section">
          <strong>KATEGORIE</strong>
          <div className="mgv-category-grid">
            {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => (
              <button key={category.slug} type="button" className={selectedCategories.includes(category.slug) ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>
            ))}
          </div>
        </div>
        <button type="button" className="mgv-main-cta" disabled={busy || !practiceTarget || playableCount < 2} onClick={onStart}><Play size={20} fill="currentColor" /> ROZPOCZNIJ TRENING <ChevronRight size={20} /></button>
      </Panel>
    </MobileSession>
  );
}

export function MobileLobbyView({ room, roomId, playerId, isHost, copied, onCopy, onLeave, target, setTarget, selectedCategories, categories = [], onToggleCategory, songPool = [], busy, onStart, onKick, playerLevels = {}, levelFromXp }) {
  const normalized = (values) => (values || []).map((value) => String(value || '').trim().toLowerCase());
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((category) => selectedCategories.includes(category))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;

  return (
    <MobileSession className="mgv-lobby-page">
      <MobileHeader eyebrow="POKÓJ GRY" title="LOBBY" onBack={onLeave} backLabel="Opuść" right={<span className="mgv-live-pill"><i />{room.players.length}</span>} />

      <Panel className="mgv-room-code-panel" accent="violet">
        <span className="mgv-eyebrow">KOD POKOJU</span>
        <div className="mgv-room-code-row"><strong>{roomId}</strong><button type="button" onClick={onCopy}>{copied ? <Check size={20} /> : <Copy size={20} />}</button></div>
        <p>Wyślij kod znajomym i poczekaj, aż dołączą do pokoju.</p>
      </Panel>

      <Panel>
        <div className="mgv-section-title"><Users size={18} /><span>GRACZE</span><b>{room.players.length}</b></div>
        <div className="mgv-player-list">
          {room.players.map((player) => (
            <PlayerRow
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
      </Panel>

      <Panel className="mgv-lobby-settings" accent="pink">
        <div className="mgv-section-title"><Gamepad2 size={18} /><span>ZASADY GRY</span></div>
        {isHost ? (
          <>
            <div className="mgv-setting-block">
              <div><strong>KART DO WYGRANIA</strong><small>Pierwszy gracz, który zbierze tyle poprawnych kart, wygrywa.</small></div>
              <div className="mgv-stepper">
                <button type="button" onClick={() => setTarget(Math.max(1, Number(target || 1) - 1))}>−</button>
                <input type="number" min="1" value={target} onChange={(event) => setTarget(event.target.value === '' ? '' : parseInt(event.target.value, 10))} />
                <button type="button" onClick={() => setTarget(Number(target || 0) + 1)}>+</button>
              </div>
            </div>
            <div className="mgv-category-section">
              <div className="mgv-category-head"><strong>KATEGORIE</strong><span>{playableCount} utworów</span></div>
              <div className="mgv-category-grid">
                {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => (
                  <button key={category.slug} type="button" className={selectedCategories.includes(category.slug) ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>
                ))}
              </div>
            </div>
            <button type="button" className="mgv-main-cta" disabled={busy || !target || room.players.length < 2} onClick={onStart}><Play size={20} fill="currentColor" /> ROZPOCZNIJ GRĘ <ChevronRight size={20} /></button>
            {room.players.length < 2 ? <div className="mgv-note warning">Potrzebujesz co najmniej 2 graczy.</div> : null}
          </>
        ) : (
          <div className="mgv-waiting-host"><Crown size={42} /><strong>HOST USTAWIA ZASADY</strong><p>Gdy wszystko będzie gotowe, gra rozpocznie się automatycznie.</p></div>
        )}
      </Panel>
    </MobileSession>
  );
}

export function MobileOpenerView({ room, openerPhase, openerCountdownNum, isPlaying, playElapsed, playCapSeconds, iframeRef, onTogglePlay, openerLockedOut, setOpenerLockedOut, onAnswer, openerRevealCountdown, onLeave }) {
  if (openerPhase === 'countdown') {
    return (
      <MobileSession className="mgv-opener-countdown-page">
        <div className="mgv-countdown"><span>KTO ZACZYNA?</span><strong>{openerCountdownNum}</strong><small>PRZYGOTUJ SIĘ</small></div>
      </MobileSession>
    );
  }

  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  return (
    <MobileSession className="mgv-opener-page">
      <MobileHeader eyebrow="START ROZGRYWKI" title="KTO ZACZYNA?" onBack={onLeave} />
      <Panel className="mgv-audio-panel">
        <MobileVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
        <div className="mgv-hidden-player"><iframe key={`opener-${room.openerCard.id}`} ref={iframeRef} title="opener-player" src={`https://www.youtube.com/embed/${room.openerCard.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.openerStartSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
        <button type="button" className="mgv-audio-cta" onClick={onTogglePlay}><Play size={19} fill="currentColor" />{isPlaying ? 'ODTWARZANIE' : 'ODTWÓRZ DŹWIĘK'}<span>{audioLeft}s</span></button>
      </Panel>
      <Panel className="mgv-opener-answer" accent="violet">
        {room.openerWinnerId ? (
          <div className="mgv-opener-winner"><Trophy size={50} /><strong>{room.players.find((player) => player.id === room.openerWinnerId)?.name} ZACZYNA!</strong><span>{openerRevealCountdown ?? 5}</span></div>
        ) : (
          <>
            <div className="mgv-section-title"><Zap size={18} /><span>KTO PIERWSZY ZGADNIE?</span></div>
            <p className="mgv-copy">Wybierz poprawny tytuł i wykonawcę. Pierwsza poprawna odpowiedź rozpoczyna grę.</p>
            <div className="mgv-option-list">
              {room.openerOptions.map((option, index) => (
                <button type="button" key={`${option.artist}-${index}`} disabled={openerLockedOut} onClick={() => { setOpenerLockedOut(true); onAnswer(index); }}><span>{option.artist}</span><small>{option.title}</small><ChevronRight size={18} /></button>
              ))}
            </div>
            {openerLockedOut ? <div className="mgv-note">Odpowiedź wysłana — czekamy na wynik…</div> : null}
          </>
        )}
      </Panel>
    </MobileSession>
  );
}

function GuessSheet({ open, onClose, guessArtist, setGuessArtist, guessTitle, setGuessTitle, tokens, onSwap, onBuy, busy, swapCost, buyCost }) {
  if (!open) return null;
  return (
    <div className="mgv-sheet-backdrop" onClick={onClose}>
      <aside className="mgv-bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="mgv-sheet-handle" />
        <div className="mgv-sheet-head"><strong>BONUS: TYTUŁ I WYKONAWCA</strong><button type="button" onClick={onClose}><X size={19} /></button></div>
        <p>Opcjonalne. Za zaakceptowaną odpowiedź możesz zdobyć token.</p>
        <div className="mgv-sheet-token"><img src={iconToken} alt="" /> {tokens} TOKENÓW</div>
        <input value={guessArtist} onChange={(event) => setGuessArtist(event.target.value)} placeholder="Wykonawca" />
        <input value={guessTitle} onChange={(event) => setGuessTitle(event.target.value)} placeholder="Tytuł" />
        <div className="mgv-utility-grid">
          <button type="button" onClick={onSwap} disabled={busy || tokens < swapCost}><RotateCcw size={16} /> WYMIEŃ ({swapCost})</button>
          <button type="button" onClick={onBuy} disabled={busy || tokens < buyCost}><Gift size={16} /> KUP KARTĘ ({buyCost})</button>
        </div>
      </aside>
    </div>
  );
}

function VotingCard({ isMyTurn, turnPlayerName, correctCard, pendingGuess, requiredApprovals, votesCount, votersCount, countdown, myVote, onVote, busy }) {
  return (
    <Panel className="mgv-voting-card" accent="pink">
      <div className="mgv-section-title"><Shield size={18} /><span>GŁOSOWANIE</span><b>{countdown ?? '—'}s</b></div>
      <h2>{isMyTurn ? 'CZEKASZ NA GŁOSY…' : `CZY ${turnPlayerName} ZGADŁ(A)?`}</h2>
      <div className="mgv-vote-answer good"><span>PRAWIDŁOWO</span><strong>{correctCard?.artist} — {correctCard?.title}</strong></div>
      <div className="mgv-vote-answer"><span>ODPOWIEDŹ GRACZA</span><strong>{pendingGuess?.artist || '—'} — {pendingGuess?.title || '—'}</strong></div>
      <div className="mgv-vote-meta">Potrzeba {requiredApprovals} TAK · oddano {votesCount}/{votersCount}</div>
      {!isMyTurn && myVote === undefined ? (
        <div className="mgv-vote-actions"><button className="yes" onClick={() => onVote(true)} disabled={busy}><Check size={19} /> TAK</button><button className="no" onClick={() => onVote(false)} disabled={busy}><X size={19} /> NIE</button></div>
      ) : !isMyTurn ? <div className="mgv-note">Twój głos: <strong>{myVote ? 'TAK' : 'NIE'}</strong></div> : null}
    </Panel>
  );
}

function MobileRoundResult({ room, advanceCountdown }) {
  const result = room.lastResult;
  if (!result) return null;
  const ownerId = room.currentPlayerId;
  const ownerName = room.players.find((player) => player.id === ownerId)?.name || 'Gracz';
  const ownerTimeline = [...(room.timelines?.[ownerId] || [])].sort((a, b) => a.year - b.year);
  const placementGood = Boolean(result.bought || result.correct);
  const headline = result.timedOut ? 'CZAS MINĄŁ' : result.bought ? 'KARTA ZDOBYTA' : placementGood ? 'DOBRE MIEJSCE!' : 'NIE TYM RAZEM';
  const hasGhost = !result.timedOut && !result.correct && result.chosenSlot !== undefined && result.chosenSlot !== null;
  const displayCards = hasGhost ? (() => { const next = [...ownerTimeline]; next.splice(result.chosenSlot, 0, { ...result.card, __ghost: true }); return next; })() : ownerTimeline;

  return (
    <div className="mgv-result-overlay">
      <div className={`mgv-result-sheet ${placementGood ? 'success' : 'failure'}`}>
        <div className="mgv-sheet-handle" />
        <div className="mgv-result-status"><span>{placementGood ? <Check size={25} /> : <X size={25} />}</span><strong>{headline}</strong></div>
        <div className="mgv-reveal-card"><small>POPRAWNA ODPOWIEDŹ</small><b>{result.card.year}</b><strong>{result.card.title}</strong><span>{result.card.artist}</span></div>
        {!room.practiceMode && !room.dailyPlaylistMode && result.tokenAwarded !== undefined ? <div className={`mgv-token-result ${result.tokenAwarded ? 'good' : 'bad'}`}><Headphones size={17} /><span>{result.tokenAwarded ? '+1 TOKEN ZA TYTUŁ I WYKONAWCĘ' : 'BEZ TOKENA W TEJ RUNDZIE'}</span></div> : null}
        <div className="mgv-result-countdown"><Clock3 size={18} /><span>{room.practiceMode ? 'KOLEJNY UTWÓR' : 'KOLEJNA TURA'}</span><strong>{advanceCountdown ?? 5}</strong><em>sek.</em></div>
        {displayCards.length ? (
          <div className="mgv-result-timeline">
            <div className="mgv-subhead"><span>{room.practiceMode ? 'TWOJA OŚ' : `OŚ · ${ownerName}`}</span><b>{ownerTimeline.length}/{room.target}</b></div>
            <div className="mgv-timeline-scroll compact"><div className="mgv-timeline-row">{displayCards.map((card, index) => <TimelineCard key={card.__ghost ? 'ghost' : card.id || index} card={card} compact highlight={card.__ghost ? 'bad' : ''} />)}</div></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MobilePlayingView({ screen, room, playerId, isMyTurn, turnPlayerName, decisionLeft, playElapsed, playCapSeconds, isPlaying, iframeRef, onTogglePlay, guessArtist, setGuessArtist, guessTitle, setGuessTitle, onSwapSong, onBuyCard, swapCost, buyCost, chosenSlot, setChosenSlot, turnTimeline, viewedTimeline, displayedPlayerId, displayedPlayerName, setViewedPlayerId, onConfirmPlacement, busy, playerLevels = {}, levelFromXp, votingCountdown, onVote, advanceCountdown, onLeave, chatInput, setChatInput, onSendChat }) {
  const [guessOpen, setGuessOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const modeLabel = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.practiceMode ? 'TRENING' : room.tournamentMode ? 'TURNIEJ' : 'ROZGRYWKA';
  const currentTokens = room.tokens?.[playerId] || 0;
  const turnName = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.practiceMode ? 'TRENING SOLO' : isMyTurn ? 'TWOJA KOLEJ!' : turnPlayerName || 'TURA GRACZA';
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  const practicePlayed = room.practiceMode ? (room.playedCards || []).filter((card) => card.playerId === playerId) : [];
  const practiceCorrect = practicePlayed.filter((card) => card.correct).length;
  const practiceWrong = practicePlayed.filter((card) => !card.correct).length;
  const activeTimelineLength = (room.timelines?.[displayedPlayerId] || []).length;

  return (
    <MobileSession className="mgv-playing-page">
      <MobileHeader eyebrow={modeLabel} title={turnName} onBack={onLeave} backLabel="Opuść" right={screen === 'playing' ? <span className={`mgv-timer ${decisionLeft <= 10 ? 'danger' : ''}`}><Clock3 size={15} />{decisionLeft}s</span> : null} />

      {screen === 'voting' && room.pendingGuess ? (
        <VotingCard isMyTurn={isMyTurn} turnPlayerName={turnPlayerName} correctCard={room.lastResult?.card} pendingGuess={room.pendingGuess} requiredApprovals={room.requiredApprovals} votesCount={Object.keys(room.votes || {}).length} votersCount={Math.max(0, room.players.length - 1)} countdown={votingCountdown} myVote={room.votes?.[playerId]} onVote={onVote} busy={busy} />
      ) : (
        <>
          <Panel className="mgv-audio-panel">
            <div className="mgv-audio-topline"><span><Disc3 size={15} /> ODSŁUCH</span><b>{audioLeft}s</b></div>
            <MobileVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
            <div className="mgv-hidden-player"><iframe key={room.currentCard?.id} ref={iframeRef} title="player" src={`https://www.youtube.com/embed/${room.currentCard?.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.startSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
            <button type="button" className="mgv-audio-cta" onClick={onTogglePlay}><Play size={18} fill="currentColor" /><span>{isPlaying ? 'ODTWARZANIE' : playElapsed >= playCapSeconds ? 'ODTWÓRZ PONOWNIE' : 'ODTWÓRZ DŹWIĘK'}</span></button>
          </Panel>

          <Panel className="mgv-placement-panel" accent="violet">
            <div className="mgv-placement-head">
              <div><span className="mgv-eyebrow">OŚ CZASU</span><h2>{isMyTurn ? 'GDZIE PASUJE TEN UTWÓR?' : `OŚ · ${displayedPlayerName}`}</h2></div>
              <div className="mgv-target-badge"><strong>{activeTimelineLength}</strong><span>/{room.target}</span></div>
            </div>
            {screen === 'playing' && isMyTurn ? (
              <>
                <MobileTimeline timeline={turnTimeline} selectedSlot={chosenSlot} onPick={setChosenSlot} />
                {!room.practiceMode ? (
                  <div className="mgv-inline-guess">
                    <div className="mgv-inline-guess-head">
                      <div>
                        <span className="mgv-eyebrow">BONUS · OPCJONALNIE</span>
                        <strong>ZGADNIJ TYTUŁ I WYKONAWCĘ</strong>
                      </div>
                      <span className="mgv-inline-token"><img src={iconToken} alt="" /> {currentTokens}</span>
                    </div>
                    <p>Wpisz odpowiedź przed zatwierdzeniem miejsca. Jeśli zostanie zaakceptowana, zdobywasz token.</p>
                    <div className="mgv-inline-guess-fields">
                      <label>
                        <span>WYKONAWCA</span>
                        <input
                          value={guessArtist}
                          onChange={(event) => setGuessArtist(event.target.value)}
                          placeholder="Wpisz wykonawcę"
                          autoComplete="off"
                          enterKeyHint="next"
                        />
                      </label>
                      <label>
                        <span>TYTUŁ</span>
                        <input
                          value={guessTitle}
                          onChange={(event) => setGuessTitle(event.target.value)}
                          placeholder="Wpisz tytuł"
                          autoComplete="off"
                          enterKeyHint="done"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}
                <div className="mgv-selected-slot"><span>{chosenSlot !== null ? 'WYBRANO' : 'WYBIERZ + NA OSI'}</span><strong>{chosenSlot !== null ? `SLOT ${chosenSlot + 1}` : '—'}</strong></div>
                <button type="button" className="mgv-main-cta" onClick={onConfirmPlacement} disabled={chosenSlot === null || busy}>ZATWIERDŹ MIEJSCE <ChevronRight size={20} /></button>
              </>
            ) : (
              <MobileTimeline timeline={viewedTimeline} interactive={false} />
            )}
          </Panel>
        </>
      )}

      {room.practiceMode ? (
        <Panel className="mgv-practice-live" accent="green">
          <div className="mgv-section-title"><Zap size={17} /><span>{room.dailyPlaylistMode ? 'POSTĘP PLAYLISTY' : 'POSTĘP TRENINGU'}</span><b>{(room.timelines?.[playerId] || []).length}/{room.target}</b></div>
          <div className="mgv-progress"><span style={{ width: `${Math.min(100, ((room.timelines?.[playerId] || []).length / Math.max(1, room.target)) * 100)}%` }} /></div>
          <div className="mgv-mini-stats"><div className="good"><Check size={17} /><span>Trafienia</span><b>{practiceCorrect}</b></div><div className="bad"><X size={17} /><span>Pomyłki</span><b>{practiceWrong}</b></div></div>
        </Panel>
      ) : (
        <div className="mgv-game-tools">
          <button type="button" onClick={() => setPlayersOpen(true)}><Users size={18} /><span>GRACZE</span><b>{room.players.length}</b></button>
          {screen === 'playing' && isMyTurn ? <button type="button" onClick={() => setGuessOpen(true)}><Headphones size={18} /><span>BONUS</span><b><img src={iconToken} alt="" />{currentTokens}</b></button> : null}
        </div>
      )}

      {!room.practiceMode ? <MobileChat open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}

      <GuessSheet open={guessOpen} onClose={() => setGuessOpen(false)} guessArtist={guessArtist} setGuessArtist={setGuessArtist} guessTitle={guessTitle} setGuessTitle={setGuessTitle} tokens={currentTokens} onSwap={onSwapSong} onBuy={onBuyCard} busy={busy} swapCost={swapCost} buyCost={buyCost} />

      {playersOpen ? (
        <div className="mgv-sheet-backdrop" onClick={() => setPlayersOpen(false)}>
          <aside className="mgv-bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mgv-sheet-handle" />
            <div className="mgv-sheet-head"><strong>GRACZE</strong><button type="button" onClick={() => setPlayersOpen(false)}><X size={19} /></button></div>
            <div className="mgv-player-list">
              {room.players.map((player) => <PlayerRow key={player.id} player={player} hostId={room.hostId} myId={playerId} active={displayedPlayerId === player.id} score={(room.timelines?.[player.id] || []).length} tokenCount={room.tokens?.[player.id] || 0} level={player.authed && playerLevels[player.id] !== undefined ? levelFromXp(playerLevels[player.id]).level : null} onClick={() => { setViewedPlayerId(player.id); setPlayersOpen(false); }} />)}
            </div>
          </aside>
        </div>
      ) : null}

      {screen === 'roundResult' ? <MobileRoundResult room={room} advanceCountdown={advanceCountdown} /> : null}
    </MobileSession>
  );
}

export function MobilePracticeResultView({ room, playerId, onAgain, onHome }) {
  const timeline = [...(room.timelines?.[playerId] || [])].sort((a, b) => a.year - b.year);
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const correct = played.filter((card) => card.correct).length;
  const wrong = played.filter((card) => !card.correct).length;
  const accuracy = played.length ? Math.round((correct / played.length) * 100) : 0;
  return (
    <MobileSession className="mgv-finish-page">
      <MobileHeader eyebrow="TRENING" title="GOTOWE!" onBack={onHome} />
      <div className="mgv-final-mark cyan"><Check size={18} /><span>SESJA ZAKOŃCZONA</span></div>
      <ModeHero icon={glTrening} eyebrow="PODSUMOWANIE" title="TRENING UKOŃCZONY" description="Twoja oś jest gotowa. Zobacz wynik i spróbuj ponownie, kiedy chcesz." accent="cyan" />
      <div className="mgv-result-stat-grid"><div><Check size={18} /><strong>{correct}</strong><span>trafień</span></div><div><X size={18} /><strong>{wrong}</strong><span>pomyłek</span></div><div><Zap size={18} /><strong>{accuracy}%</strong><span>skuteczność</span></div></div>
      <Panel><div className="mgv-section-title"><Music2 size={18} /><span>TWOJA OŚ CZASU</span><b>{timeline.length}/{room.target}</b></div><MobileTimeline timeline={timeline} interactive={false} compact /></Panel>
      <div className="mgv-action-stack"><button type="button" className="mgv-main-cta" onClick={onAgain}><RotateCcw size={19} /> NOWY TRENING</button><button type="button" className="mgv-secondary-cta" onClick={onHome}>STRONA GŁÓWNA</button></div>
    </MobileSession>
  );
}

function RankTabs({ active, onChange }) {
  return <div className="mgv-tabs"><button className={active === 'daily' ? 'active' : ''} onClick={() => onChange('daily')}>DZISIAJ</button><button className={active === 'weekly' ? 'active' : ''} onClick={() => onChange('weekly')}>TYDZIEŃ</button><button className={active === 'all' ? 'active' : ''} onClick={() => onChange('all')}>WSZECH CZASÓW</button></div>;
}

function RankingRows({ rows = [], valueLabel = 'pkt', valueKey = 'score' }) {
  if (!rows?.length) return <div className="mgv-empty">Brak wyników. Zagraj jako pierwszy!</div>;
  return <div className="mgv-ranking-list">{rows.map((row, index) => <div key={row.uid || row.id || `${row.name}-${index}`} className={index < 3 ? `podium p${index + 1}` : ''}><span className="place">#{index + 1}</span><span className="mgv-avatar" style={row.avatarUrl ? { backgroundImage: `url(${row.avatarUrl})` } : undefined}>{!row.avatarUrl ? initials(row.name) : null}</span><span className="name"><strong>{row.name}</strong>{row.note ? <small>{row.note}</small> : null}</span><b>{row[valueKey] ?? 0} <small>{valueLabel}</small></b></div>)}</div>;
}

export function MobileDailyPlaylistHubView({ alreadyPlayed, dailyBoard = [], weeklyBoard = [], allTimeBoard = [], busy, onStart, onHome }) {
  const [tab, setTab] = useState('daily');
  const sourceRows = tab === 'daily' ? dailyBoard : tab === 'weekly' ? weeklyBoard : allTimeBoard;
  const rows = (sourceRows || []).map((row) => ({
    ...row,
    name: row.name || row.username || 'Gracz',
    score: tab === 'all'
      ? Number(row.playlistTotalScore ?? row.score ?? 0)
      : Number(row.score ?? row.playlistScore ?? 0),
    note: tab === 'all'
      ? `${Number(row.playlistGamesPlayed || 0)} gier`
      : row.note,
  }));
  return (
    <MobileSession className="mgv-playlist-hub">
      <MobileHeader eyebrow="CODZIENNE WYZWANIE" title="PLAYLISTA DNIA" onBack={onHome} />
      <ModeHero icon={glPlaylista} eyebrow="10 UTWORÓW · JEDNA PRÓBA" title="DZISIEJSZA PLAYLISTA" description="Ułóż 10 utworów na osi czasu i porównaj wynik z innymi graczami." accent="violet">
        <div className="mgv-hero-chips"><span><Music2 size={14} /> 10 utworów</span><span><Trophy size={14} /> ranking dnia</span></div>
      </ModeHero>
      <Panel className="mgv-daily-start-card">
        {alreadyPlayed ? <><span className="mgv-eyebrow">DZISIAJ JUŻ ZAGRANO</span><strong className="mgv-daily-score">{alreadyPlayed.score}<small>/10</small></strong><p>Wróć jutro po nową playlistę albo sprawdź ranking.</p></> : <><span className="mgv-eyebrow">GOTOWY?</span><h2>MASZ TYLKO JEDNĄ PRÓBĘ</h2><p>Po rozpoczęciu wynik zostanie zapisany na dzisiaj.</p><button className="mgv-main-cta" type="button" disabled={busy} onClick={onStart}><Play size={19} fill="currentColor" /> STARTUJ</button></>}
      </Panel>
      <Panel><div className="mgv-section-title"><Trophy size={18} /><span>RANKING</span></div><RankTabs active={tab} onChange={setTab} /><RankingRows rows={rows} /></Panel>
    </MobileSession>
  );
}

export function MobileDailyPlaylistResultView({ room, playerId, onBackToRankings, onLeave }) {
  const timeline = [...(room.timelines?.[playerId] || [])].sort((a, b) => a.year - b.year);
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const correct = played.filter((card) => card.correct).length;
  return (
    <MobileSession className="mgv-finish-page">
      <MobileHeader eyebrow="PLAYLISTA DNIA" title="WYNIK" onBack={onLeave} />
      <div className="mgv-final-mark violet"><Trophy size={18} /><span>WYNIK ZAPISANY</span></div>
      <ModeHero icon={glPlaylista} eyebrow="DZISIEJSZY WYNIK" title={`${correct} / 10`} description="Wynik został zapisany. Sprawdź, jak wypadasz na tle innych graczy." accent="violet" />
      <Panel><div className="mgv-section-title"><Music2 size={18} /><span>TWOJA PLAYLISTA</span><b>{timeline.length}/10</b></div><MobileTimeline timeline={timeline} interactive={false} compact /></Panel>
      <div className="mgv-action-stack"><button type="button" className="mgv-main-cta" onClick={onBackToRankings}><Trophy size={18} /> ZOBACZ RANKINGI</button><button type="button" className="mgv-secondary-cta" onClick={onLeave}>STRONA GŁÓWNA</button></div>
    </MobileSession>
  );
}

export function MobileDailySongView({
  song,
  alreadyPlayed,
  result,
  isPlaying,
  playElapsed,
  playCapSeconds = 15,
  iframeRef,
  onTogglePlay,
  guessArtist,
  setGuessArtist,
  guessTitle,
  setGuessTitle,
  guessYear,
  setGuessYear,
  busy,
  onSubmit,
  onHome,
}) {
  const score = Number(result?.score || 0);
  const remaining = Math.max(0, Math.ceil(Number(playCapSeconds || 0) - Number(playElapsed || 0)));
  const resultTitle = score === 3 ? 'PERFEKCYJNIE!' : score === 2 ? 'BARDZO DOBRZE!' : score === 1 ? 'JEST PUNKT!' : 'NIE TYM RAZEM';
  const resultAccent = score === 3 ? 'gold' : score > 0 ? 'cyan' : 'pink';

  return (
    <MobileSession className="mgv-daily-song-page">
      <MobileHeader
        eyebrow="CODZIENNE WYZWANIE"
        title="PIOSENKA DNIA"
        onBack={onHome}
        right={<span className="mgv-timer"><Headphones size={15} />{playCapSeconds}s</span>}
      />

      {!alreadyPlayed ? (
        <>
          <ModeHero
            icon={glPiosenka}
            eyebrow="JEDEN UTWÓR · TRZY PUNKTY"
            title="CO DZIŚ GRA?"
            description="Masz jeden fragment. Zgadnij wykonawcę, tytuł i rok wydania — każde trafienie to 1 punkt."
            accent="pink"
          >
            <div className="mgv-hero-chips">
              <span><Music2 size={14} /> 1 utwór dziennie</span>
              <span><Trophy size={14} /> maks. 3 pkt</span>
            </div>
          </ModeHero>

          <Panel className="mgv-daily-audio-card" accent="pink">
            <div className="mgv-hidden-player">
              <iframe
                key={`daily-mobile-${song?.videoId}`}
                ref={iframeRef}
                title="daily-mobile-player"
                src={`https://www.youtube.com/embed/${song?.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${song?.startSeconds || 0}&controls=0&modestbranding=1&rel=0`}
                allow="autoplay; encrypted-media"
              />
            </div>
            <MobileVinyl spinning={isPlaying} progress={Number(playElapsed || 0) / Math.max(1, Number(playCapSeconds || 1))} />
            <div className="mgv-daily-listen-copy">
              <span className="mgv-eyebrow">FRAGMENT DNIA</span>
              <strong>{isPlaying ? `ODTWARZANIE · ${remaining}s` : playElapsed > 0 ? 'POSŁUCHAJ PONOWNIE' : 'GOTOWY NA ODSŁUCH?'}</strong>
              <p>Skup się na charakterystycznym wokalu, brzmieniu i epoce utworu.</p>
            </div>
            <button type="button" className="mgv-audio-cta daily" onClick={onTogglePlay}>
              <Play size={19} fill="currentColor" />
              {isPlaying ? `ODTWARZANIE · ${remaining}s` : playElapsed > 0 ? 'ODTWÓRZ PONOWNIE' : 'ODTWÓRZ TERAZ'}
            </button>
          </Panel>

          <Panel className="mgv-daily-guess-card" accent="violet">
            <div className="mgv-section-title"><Sparkles size={18} /><span>TWOJA ODPOWIEDŹ</span><b>0–3 PKT</b></div>
            <div className="mgv-daily-fields">
              <label><span>WYKONAWCA</span><input value={guessArtist} onChange={(event) => setGuessArtist(event.target.value)} placeholder="Np. Maanam" autoComplete="off" /></label>
              <label><span>TYTUŁ</span><input value={guessTitle} onChange={(event) => setGuessTitle(event.target.value)} placeholder="Np. Kocham Cię, kochanie moje" autoComplete="off" /></label>
              <label className="year"><span>ROK WYDANIA</span><input type="number" inputMode="numeric" value={guessYear} onChange={(event) => setGuessYear(event.target.value)} placeholder="1984" /></label>
            </div>
            <p className="mgv-form-note">Nie wiesz? Możesz zostawić pole puste — pozostałe odpowiedzi nadal są punktowane.</p>
            <button type="button" className="mgv-main-cta" onClick={onSubmit} disabled={busy}>
              <Check size={19} /> {busy ? 'SPRAWDZAM…' : 'ZATWIERDŹ ODPOWIEDŹ'}
            </button>
          </Panel>
        </>
      ) : (
        <>
          <div className={`mgv-final-mark ${resultAccent}`}><Trophy size={18} /><span>{resultTitle}</span></div>
          <ModeHero
            icon={glPiosenka}
            eyebrow="TWÓJ WYNIK"
            title={`${score} / 3`}
            description={score === 3 ? 'Komplet! Dziś nic Cię nie zaskoczyło.' : 'Wynik zapisany. Jutro czeka kolejny utwór.'}
            accent={resultAccent}
          />

          <Panel className="mgv-daily-answer-reveal" accent={resultAccent}>
            <span className="mgv-eyebrow">POPRAWNA ODPOWIEDŹ</span>
            <strong className="year">{song?.year || '—'}</strong>
            <h2>{song?.title || '—'}</h2>
            <p>{song?.artist || '—'}</p>
            <button type="button" className="mgv-audio-cta daily" onClick={onTogglePlay}>
              <Play size={18} fill="currentColor" /> {isPlaying ? `ODTWARZANIE · ${remaining}s` : 'ODTWÓRZ UTWÓR'}
            </button>
          </Panel>

          <Panel className="mgv-daily-breakdown">
            <div className="mgv-section-title"><Check size={18} /><span>JAK POSZŁO?</span><b>{score}/3</b></div>
            <div className="mgv-daily-check-list">
              <div className={result?.correctArtist ? 'good' : 'bad'}><span>{result?.correctArtist ? <Check size={17} /> : <X size={17} />}</span><div><small>WYKONAWCA</small><strong>{result?.guessArtist || '—'}</strong></div></div>
              <div className={result?.correctTitle ? 'good' : 'bad'}><span>{result?.correctTitle ? <Check size={17} /> : <X size={17} />}</span><div><small>TYTUŁ</small><strong>{result?.guessTitle || '—'}</strong></div></div>
              <div className={result?.correctYear ? 'good' : 'bad'}><span>{result?.correctYear ? <Check size={17} /> : <X size={17} />}</span><div><small>ROK</small><strong>{result?.guessYear || '—'}</strong></div></div>
            </div>
          </Panel>

          <div className="mgv-result-stat-grid daily">
            <div><Trophy size={18} /><strong>{score}</strong><span>punkty</span></div>
            <div><Flame size={18} /><strong>{result?.streak || 0}</strong><span>seria dni</span></div>
            <div><Zap size={18} /><strong>+{result?.xpEarned || 0}</strong><span>XP</span></div>
          </div>

          <button type="button" className="mgv-main-cta" onClick={onHome}>WRÓĆ NA STRONĘ GŁÓWNĄ</button>
        </>
      )}
    </MobileSession>
  );
}

function TournamentPlayer({ player, me }) {
  if (!player) return <div className="mgv-tournament-player bye"><span className="mgv-avatar">—</span><div><strong>WOLNY LOS</strong><small>automatyczny awans</small></div></div>;
  return (
    <div className={`mgv-tournament-player ${me ? 'me' : ''}`}>
      <span className="mgv-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>
        {!player.avatarUrl ? initials(player.name || player.username) : null}
      </span>
      <div><strong>{player.name || player.username || 'Gracz'}</strong><small>{me ? 'TY' : 'GRACZ'}</small></div>
    </div>
  );
}

export function MobileTournamentHubView({
  tournament,
  lastCompleted,
  user,
  busy,
  tournamentBusy,
  onSignUp,
  onStartMatch,
  onHome,
  onRefresh,
}) {
  const currentUid = user?.uid;
  const signups = tournament?.signups || [];
  const alreadyIn = !!currentUid && signups.some((player) => player.uid === currentUid);
  const winner = tournament?.winnerUid ? signups.find((player) => player.uid === tournament.winnerUid) : null;
  const status = tournament?.status || 'none';
  const entryFee = Number(tournament?.entryFee || 0);
  const pot = Math.max(0, (signups.length - 1) * entryFee);

  if (!tournament) {
    const previousWinner = lastCompleted?.winnerUid
      ? (lastCompleted.signups || []).find((player) => player.uid === lastCompleted.winnerUid)
      : null;
    return (
      <MobileSession className="mgv-tournament-page">
        <MobileHeader eyebrow="RYWALIZACJA" title="TURNIEJ" onBack={onHome} />
        <ModeHero icon={glTurniej} eyebrow="TURNIEJ TYGODNIA" title="CZEKAJ NA START" description="Aktualnie nie ma aktywnego turnieju. Gdy pojawi się nowy, zapiszesz się właśnie tutaj." accent="gold" />
        {previousWinner ? <Panel className="mgv-tournament-last" accent="gold"><span className="mgv-eyebrow">OSTATNI ZWYCIĘZCA</span><Trophy size={34} /><strong>{previousWinner.name || 'Gracz'}</strong></Panel> : null}
        <div className="mgv-action-stack"><button type="button" className="mgv-secondary-cta" onClick={onRefresh}>ODŚWIEŻ</button><button type="button" className="mgv-ghost-cta" onClick={onHome}>STRONA GŁÓWNA</button></div>
      </MobileSession>
    );
  }

  return (
    <MobileSession className={`mgv-tournament-page status-${status}`}>
      <MobileHeader
        eyebrow="RYWALIZACJA"
        title="TURNIEJ"
        onBack={onHome}
        right={<span className="mgv-tournament-fee"><Trophy size={14} />{entryFee} XP</span>}
      />

      <ModeHero
        icon={glTurniej}
        eyebrow={status === 'signup' ? 'TRWAJĄ ZAPISY' : status === 'active' ? 'TURNIEJ W TOKU' : 'TURNIEJ ZAKOŃCZONY'}
        title={status === 'signup' ? 'WEJDŹ DO GRY' : status === 'active' ? 'DRABINKA TURNIEJOWA' : 'MAMY ZWYCIĘZCĘ'}
        description={status === 'signup'
          ? 'Zapisz się, opłać wpisowe XP i walcz o całą pulę.'
          : status === 'active'
            ? 'Rozgrywaj swój mecz, gdy tylko pojawi się przy nim przycisk START.'
            : 'Turniej dobiegł końca. Zobacz zwycięzcę i swój rezultat.'}
        accent="gold"
      >
        <div className="mgv-hero-chips">
          <span><Users size={14} /> {signups.length}/{tournament.maxPlayers || '—'} graczy</span>
          <span><Zap size={14} /> {pot} XP dla zwycięzcy</span>
        </div>
      </ModeHero>

      {status === 'signup' ? (
        <>
          <Panel className="mgv-tournament-signup" accent="gold">
            <div className="mgv-section-title"><Users size={18} /><span>LISTA GRACZY</span><b>{signups.length}/{tournament.maxPlayers || '—'}</b></div>
            <div className="mgv-tournament-signups">
              {signups.length ? signups.map((player) => <TournamentPlayer key={player.uid} player={player} me={player.uid === currentUid} />) : <div className="mgv-empty">Jeszcze nikt się nie zapisał.</div>}
            </div>
          </Panel>
          <Panel className="mgv-tournament-rules" accent="violet">
            <div className="mgv-tournament-rule"><span><Shield size={18} /></span><div><strong>WPISOWE</strong><small>{entryFee} XP — pobierane zgodnie z zasadami turnieju</small></div></div>
            <div className="mgv-tournament-rule"><span><Trophy size={18} /></span><div><strong>NAGRODA</strong><small>Zwycięzca zgarnia XP przegranych</small></div></div>
            <div className="mgv-tournament-rule"><span><Music2 size={18} /></span><div><strong>MECZE</strong><small>Każdy gracz układa tę samą playlistę meczową</small></div></div>
          </Panel>
          {alreadyIn
            ? <div className="mgv-tournament-ready"><Check size={20} /><div><strong>JESTEŚ ZAPISANY</strong><small>Czekamy na komplet graczy i start drabinki.</small></div></div>
            : <button type="button" className="mgv-main-cta" disabled={tournamentBusy} onClick={onSignUp}><Trophy size={19} /> {tournamentBusy ? 'ZAPISUJĘ…' : `ZAPISZ SIĘ · ${entryFee} XP`}</button>}
        </>
      ) : null}

      {status === 'active' ? (
        <div className="mgv-tournament-rounds">
          {(tournament.rounds || []).map((round) => (
            <Panel key={round.roundNumber} className="mgv-tournament-round" accent={round.matches?.length === 1 ? 'gold' : 'violet'}>
              <div className="mgv-section-title"><Trophy size={18} /><span>{round.matches?.length === 1 ? 'FINAŁ' : `RUNDA ${round.roundNumber}`}</span><b>{round.matches?.length || 0} mecz.</b></div>
              <div className="mgv-tournament-matches">
                {(round.matches || []).map((match) => {
                  const p1 = match.player1;
                  const p2 = match.player2;
                  const isMine = !!currentUid && (p1?.uid === currentUid || p2?.uid === currentUid);
                  const myResult = p1?.uid === currentUid ? match.player1Result : match.player2Result;
                  const canPlay = isMine && !match.winnerUid && !myResult && !!p2;
                  const waiting = isMine && !!myResult && !match.winnerUid;
                  return (
                    <div key={match.matchId} className={`mgv-tournament-match ${isMine ? 'mine' : ''} ${match.winnerUid ? 'done' : ''}`}>
                      <div className={`mgv-tournament-side ${match.winnerUid === p1?.uid ? 'winner' : ''}`}>
                        <TournamentPlayer player={p1} me={p1?.uid === currentUid} />
                        {match.player1Result ? <b>{match.player1Result.score}/10</b> : null}
                      </div>
                      <div className="mgv-tournament-vs"><span>VS</span></div>
                      <div className={`mgv-tournament-side ${match.winnerUid === p2?.uid ? 'winner' : ''}`}>
                        <TournamentPlayer player={p2} me={p2?.uid === currentUid} />
                        {match.player2Result ? <b>{match.player2Result.score}/10</b> : null}
                      </div>
                      {canPlay ? <button type="button" className="mgv-main-cta compact" disabled={busy} onClick={() => onStartMatch(match, round.roundNumber)}><Play size={17} fill="currentColor" /> ZAGRAJ SWÓJ MECZ</button> : null}
                      {waiting ? <div className="mgv-tournament-wait"><Clock3 size={16} /><span>Twój wynik zapisany — czekamy na przeciwnika.</span></div> : null}
                      {isMine && match.winnerUid ? <div className={`mgv-tournament-verdict ${match.winnerUid === currentUid ? 'good' : 'bad'}`}>{match.winnerUid === currentUid ? <Check size={16} /> : <X size={16} />}<span>{match.winnerUid === currentUid ? 'AWANSUJESZ' : 'KONIEC UDZIAŁU'}</span></div> : null}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {status === 'completed' ? (
        <>
          <div className="mgv-final-mark gold"><Trophy size={18} /><span>TURNIEJ ZAKOŃCZONY</span></div>
          <Panel className="mgv-tournament-winner" accent="gold">
            <Trophy size={54} />
            <span className="mgv-eyebrow">ZWYCIĘZCA TURNIEJU</span>
            <h1>{winner?.name || 'GRACZ'}</h1>
            {winner?.uid === currentUid
              ? <p className="good">Wygrywasz turniej i zgarniesz {pot} XP!</p>
              : <p>Twój udział dobiegł końca. Wpisowe: {entryFee} XP.</p>}
          </Panel>
          <Panel>
            <div className="mgv-section-title"><Crown size={18} /><span>UCZESTNICY</span><b>{signups.length}</b></div>
            <div className="mgv-tournament-signups">{signups.map((player) => <TournamentPlayer key={player.uid} player={player} me={player.uid === currentUid} />)}</div>
          </Panel>
          <button type="button" className="mgv-main-cta" onClick={onHome}>STRONA GŁÓWNA</button>
        </>
      ) : null}

      {status !== 'completed' ? <button type="button" className="mgv-ghost-cta mgv-tournament-refresh" onClick={onRefresh} disabled={tournamentBusy}>ODŚWIEŻ DANE TURNIEJU</button> : null}
    </MobileSession>
  );
}

function hitRushDifficultyMeta(key) {
  return { easy: ['ŁATWO', 'easy'], normal: ['NORMALNIE', 'normal'], hard: ['TRUDNO', 'hard'], expert: ['EKSPERT', 'expert'], insane: ['SZALEŃSTWO', 'insane'] }[key] || ['ŁATWO', 'easy'];
}

export function MobileHitRushMenuView({ stats, onStart, onLeaderboard, onHome, bonusEvery = 10, bonusSeconds = 5 }) {
  return (
    <MobileSession className="mgv-hitrush-menu">
      <MobileHeader eyebrow="TRYB SOLO NA CZAS" title="HIT RUSH" onBack={onHome} right={<span className="mgv-timer"><Zap size={15} />60s</span>} />
      <ModeHero icon={glHitRush} eyebrow="REFLEKS · WIEDZA · COMBO" title="WCZEŚNIEJ CZY PÓŹNIEJ?" description="Porównuj lata wydania, buduj combo i wyciśnij jak najwięcej punktów z 60 sekund." accent="green">
        <div className="mgv-hero-chips"><span><Flame size={14} /> +{bonusSeconds}s co {bonusEvery}</span><span><Zap size={14} /> tempo rośnie</span></div>
      </ModeHero>
      <div className="mgv-result-stat-grid hitrush"><div><Trophy size={18} /><strong>{stats?.hitRushBestScore || 0}</strong><span>rekord</span></div><div><Flame size={18} /><strong>{stats?.hitRushBestCombo || 0}</strong><span>best combo</span></div><div><Gamepad2 size={18} /><strong>{stats?.hitRushRunsTotal || 0}</strong><span>runów</span></div></div>
      <div className="mgv-action-stack mgv-hitrush-menu-actions">
        <button type="button" className="mgv-main-cta huge" onClick={onStart}><Play size={23} fill="currentColor" /> START HIT RUSH <ChevronRight size={22} /></button>
        <button type="button" className="mgv-secondary-cta" onClick={onLeaderboard}><Trophy size={18} /> RANKING HIT RUSH</button>
      </div>
      <Panel className="mgv-howto-mini"><div className="mgv-section-title"><Sparkles size={18} /><span>JAK TO DZIAŁA?</span></div><div className="mgv-howto-steps"><div><b>1</b><span>Posłuchaj</span></div><div><b>2</b><span>Porównaj</span></div><div><b>3</b><span>Wcześniej / później</span></div><div><b>4</b><span>Buduj combo</span></div></div></Panel>
    </MobileSession>
  );
}

export function MobileHitRushGameView({ hitRush, iframeRef, onReplay, onAnswer, onExit, roundSeconds = 60, bonusEvery = 10, bonusSeconds = 5, difficulty = 'easy' }) {
  const [difficultyLabel, difficultyClass] = hitRushDifficultyMeta(difficulty);
  const comboStep = hitRush.combo > 0 && hitRush.combo % bonusEvery === 0 ? bonusEvery : hitRush.combo % bonusEvery;
  const comboPct = Math.min(100, (comboStep / Math.max(1, bonusEvery)) * 100);
  return (
    <MobileSession className={`mgv-hitrush-game ${difficultyClass}`}>
      <MobileHeader eyebrow="HIT RUSH" title="WCZEŚNIEJ / PÓŹNIEJ" onBack={onExit} right={<span className={`mgv-timer ${hitRush.timeLeft <= 10 ? 'danger' : ''}`}><Clock3 size={15} />{hitRush.timeLeft}s</span>} />
      <div className="mgv-hr-scorebar"><div><span>WYNIK</span><strong>{hitRush.score}</strong></div><div><span>COMBO</span><strong>🔥 {hitRush.combo}</strong></div><div className={`difficulty ${difficultyClass}`}><span>POZIOM</span><strong>{difficultyLabel}</strong></div></div>
      <div className="mgv-combo-track"><span style={{ width: `${comboPct}%` }} /><small>+{bonusSeconds}s za combo {bonusEvery}</small></div>
      <Panel className="mgv-hr-audio-card" accent="green">
        <div className="mgv-hidden-player"><iframe key={hitRush.currentCard.videoId} ref={iframeRef} title="hit-rush-player" src={`https://www.youtube.com/embed/${hitRush.currentCard.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${hitRush.currentStartSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
        <div className="mgv-unknown-song"><Disc3 size={38} /><span>NOWY UTWÓR</span><strong>???</strong><small>Porównaj z kartą referencyjną</small></div>
        <button type="button" className="mgv-audio-cta" onClick={onReplay}><Play size={18} fill="currentColor" /> ODTWÓRZ PONOWNIE</button>
      </Panel>
      <div className="mgv-vs-divider"><span>PORÓWNAJ Z</span></div>
      <Panel className="mgv-reference-card" accent="violet"><span className="mgv-eyebrow">KARTA REFERENCYJNA</span><strong>{hitRush.referenceCard.year}</strong><h2>{hitRush.referenceCard.title}</h2><p>{hitRush.referenceCard.artist}</p></Panel>
      {hitRush.feedback ? <div className={`mgv-hr-feedback ${hitRush.feedback.correct ? 'good' : 'bad'}`}><span>{hitRush.feedback.correct ? <Check size={22} /> : <X size={22} />}</span><strong>{hitRush.feedback.correct ? 'DOBRZE!' : 'NIE TYM RAZEM'}</strong><b>{hitRush.feedback.year}</b>{hitRush.feedback.points > 0 ? <small>+{hitRush.feedback.points} pkt{hitRush.feedback.timeBonus > 0 ? ` · +${hitRush.feedback.timeBonus}s` : ''}</small> : null}</div> : null}
      <div className="mgv-hr-answer-grid"><button type="button" className="earlier" onClick={() => onAnswer('earlier')} disabled={!!hitRush.feedback}><ArrowLeft size={21} /><span>WCZEŚNIEJ</span></button><button type="button" className="later" onClick={() => onAnswer('later')} disabled={!!hitRush.feedback}><span>PÓŹNIEJ</span><ChevronRight size={21} /></button></div>
    </MobileSession>
  );
}

export function MobileHitRushResultView({ result, onAgain, onLeaderboard, onHome }) {
  const accuracy = (Number(result.correct || 0) + Number(result.wrong || 0)) ? Math.round((Number(result.correct || 0) / (Number(result.correct || 0) + Number(result.wrong || 0))) * 100) : 0;
  return (
    <MobileSession className="mgv-hitrush-result">
      <MobileHeader eyebrow="HIT RUSH" title="KONIEC RUNU" onBack={onHome} />
      <div className="mgv-final-mark green"><Zap size={18} /><span>RUN ZAKOŃCZONY</span></div>
      <ModeHero icon={glHitRush} eyebrow={result.isNewBest ? 'NOWY REKORD!' : 'TWÓJ WYNIK'} title={`${result.score} PKT`} description={result.rank ? `Ranga: ${String(result.rank).toUpperCase()}` : 'Każdy run przybliża Cię do lepszego wyniku.'} accent="green" />
      <div className="mgv-result-stat-grid"><div><Check size={18} /><strong>{result.correct || 0}</strong><span>trafień</span></div><div><X size={18} /><strong>{result.wrong || 0}</strong><span>błędów</span></div><div><Flame size={18} /><strong>{result.bestCombo || 0}</strong><span>best combo</span></div><div><Zap size={18} /><strong>{accuracy}%</strong><span>skuteczność</span></div></div>
      {(result.xpGain > 0 || result.hitcoinGain > 0) ? <Panel className="mgv-reward-panel" accent="gold"><span className="mgv-eyebrow">NAGRODY</span><div>{result.xpGain > 0 ? <strong>+{result.xpGain} XP</strong> : null}{result.hitcoinGain > 0 ? <strong>+{result.hitcoinGain} HITCOIN</strong> : null}</div></Panel> : null}
      <div className="mgv-action-stack"><button type="button" className="mgv-main-cta" onClick={onAgain}><RotateCcw size={19} /> JESZCZE RAZ</button><button type="button" className="mgv-secondary-cta" onClick={onLeaderboard}><Trophy size={18} /> RANKING</button><button type="button" className="mgv-ghost-cta" onClick={onHome}>STRONA GŁÓWNA</button></div>
    </MobileSession>
  );
}

export function MobileHitRushLeaderboardView({ rows = [], period, onPeriod, onBack, onHome }) {
  return (
    <MobileSession className="mgv-hitrush-ranking">
      <MobileHeader eyebrow="HIT RUSH" title="RANKING" onBack={onBack} />
      <ModeHero icon={glKorona} eyebrow="NAJLEPSI GRACZE" title="TABLICA WYNIKÓW" description="Porównaj wynik z innymi i wracaj po wyższe miejsce." accent="gold" />
      <Panel><div className="mgv-section-title"><Trophy size={18} /><span>RANKING</span></div><div className="mgv-tabs"><button className={period === 'daily' ? 'active' : ''} onClick={() => onPeriod('daily')}>DZISIAJ</button><button className={period === 'weekly' ? 'active' : ''} onClick={() => onPeriod('weekly')}>TYDZIEŃ</button><button className={period === 'alltime' ? 'active' : ''} onClick={() => onPeriod('alltime')}>ALL TIME</button></div>{rows === null ? <div className="mgv-empty">Ładowanie…</div> : <RankingRows rows={rows} />}</Panel>
      <button type="button" className="mgv-secondary-cta" onClick={onHome}>STRONA GŁÓWNA</button>
    </MobileSession>
  );
}

export function MobileGameOverView({ room, playerId, isHost, onPlayAgain, onLeave, onTournamentBack, xpSummary, gameEndReward }) {
  const winners = (room.winnerIds || []).map((id) => room.players.find((player) => player.id === id)).filter(Boolean);
  const standings = [...room.players].sort((a, b) => (room.timelines?.[b.id]?.length || 0) - (room.timelines?.[a.id]?.length || 0));
  return (
    <MobileSession className="mgv-gameover-page">
      <MobileHeader eyebrow="KONIEC GRY" title="WYNIKI" onBack={onLeave} />
      <div className="mgv-final-mark gold"><Trophy size={18} /><span>ROZGRYWKA ZAKOŃCZONA</span></div>
      <Panel className="mgv-winner-panel" accent="gold"><Trophy size={50} /><span className="mgv-eyebrow">ZWYCIĘZCA</span><h1>{winners.length > 1 ? 'REMIS!' : `${winners[0]?.name || 'GRACZ'} WYGRYWA!`}</h1>{winners.length > 1 ? <p>{winners.map((winner) => winner.name).join(' · ')}</p> : null}</Panel>
      <Panel><div className="mgv-section-title"><Crown size={18} /><span>KLASYFIKACJA</span></div><div className="mgv-final-standing">{standings.map((player, index) => <div key={player.id} className={index < 3 ? `podium p${index + 1}` : ''}><span>#{index + 1}</span><span className="mgv-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name) : null}</span><strong>{player.name}</strong><b>{room.timelines?.[player.id]?.length || 0} kart</b></div>)}</div></Panel>
      {xpSummary?.items?.length ? <Panel className="mgv-reward-panel" accent="violet"><span className="mgv-eyebrow">ZDOBYTE XP</span>{xpSummary.items.map((item, index) => <div className="mgv-reward-row" key={index}><span>{item.label}</span><strong>{item.amount >= 0 ? '+' : ''}{item.amount} XP</strong></div>)}<div className="mgv-reward-row total"><span>RAZEM</span><strong>{xpSummary.total >= 0 ? '+' : ''}{xpSummary.total} XP</strong></div></Panel> : null}
      {gameEndReward?.hitcoinTotal > 0 ? <Panel className="mgv-reward-panel" accent="gold"><span className="mgv-eyebrow">HITCOIN</span><div className="mgv-big-reward">+{gameEndReward.hitcoinTotal} HITCOIN</div></Panel> : null}
      <div className="mgv-action-stack">{isHost && !room.tournamentMode ? <button type="button" className="mgv-main-cta" onClick={onPlayAgain}><RotateCcw size={19} /> ZAGRAJ PONOWNIE</button> : null}{room.tournamentMode && onTournamentBack ? <button type="button" className="mgv-main-cta" onClick={onTournamentBack}><Trophy size={18} /> WRÓĆ DO TURNIEJU</button> : null}<button type="button" className="mgv-secondary-cta" onClick={onLeave}><LogOut size={18} /> OPUŚĆ POKÓJ</button></div>
    </MobileSession>
  );
}
