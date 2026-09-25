import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarDays,
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
  Target,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';

import logoImg from './assets/logo-v2.png';
import homeBg from './assets/home/bg.jpg';
import iconToken from './assets/icons/icon-token.png';
import iconHitcoin from './assets/icons/icon-hitcoin.png';
import glTrening from './assets/icons/gl-trening.png';
import glZgadnijRok from './assets/icons/gl-zgadnij-rok.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glPiosenka from './assets/icons/gl-piosenka.png';
import glTurniej from './assets/icons/gl-turniej.png';
import glHitRush from './assets/icons/gl-hitrush.png';
import glKorona from './assets/icons/gl-korona.png';
import cardWinylImg from './assets/icons/card-winyl.webp';
import cardSrebroImg from './assets/icons/card-srebro.webp';
import cardZlotoImg from './assets/icons/card-zlota.webp';
import cardPlatynaImg from './assets/icons/card-platynowa.webp';
import cardDiamentImg from './assets/icons/card-diamentowa.webp';
import { effectiveRarity } from './cards.js';
import { getTournamentUserState, tournamentTimeLeftLabel, getLeagueUserState } from './tournaments.js';
import { WEEKLY_RANKING_REWARDS } from './stats.js';

const PRACTICE_DECADES = [
  { key: 'pre70', label: 'Do 1969', from: null, to: 1969 },
  { key: '70s', label: 'Lata 70.', from: 1970, to: 1979 },
  { key: '80s', label: 'Lata 80.', from: 1980, to: 1989 },
  { key: '90s', label: 'Lata 90.', from: 1990, to: 1999 },
  { key: '00s', label: 'Lata 00.', from: 2000, to: 2009 },
  { key: '2010plus', label: '2010+', from: 2010, to: null },
];

function practiceSongYear(song) {
  const year = Number.parseInt(String(song?.year ?? '').match(/\d{4}/)?.[0] || '', 10);
  return Number.isFinite(year) ? year : null;
}

function practiceDecadeMatch(song, selected = []) {
  if (!selected.length || selected.includes('wszystkie')) return true;
  const year = practiceSongYear(song);
  if (!year) return false;
  return PRACTICE_DECADES.some((decade) => selected.includes(decade.key) && (decade.from === null || year >= decade.from) && (decade.to === null || year <= decade.to));
}

function initials(label) {
  const raw = String(label || 'G').trim();
  return raw.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'G';
}

const GAMEOVER_CARD_FRAMES = {
  winyl: cardWinylImg,
  srebrna: cardSrebroImg,
  zlota: cardZlotoImg,
  platynowa: cardPlatynaImg,
  diamentowa: cardDiamentImg,
};

const GAMEOVER_RARITY_LABELS = {
  winyl: 'WINYL',
  srebrna: 'SREBRNA',
  zlota: 'ZŁOTA',
  platynowa: 'PLATYNOWA',
  diamentowa: 'DIAMENTOWA',
};

function normalizeYouTubeVideoId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const bareId = raw.match(/^([A-Za-z0-9_-]{11})(?:[?&#].*)?$/);
  if (bareId) return bareId[1];
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (url.hostname.includes('youtu.be')) return url.pathname.split('/').filter(Boolean)[0] || '';
    const fromQuery = url.searchParams.get('v');
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split('/').filter(Boolean);
    const marker = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
    if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  } catch {}
  const match = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] || raw;
}

function YouTubeThumbnail({ song, className = '' }) {
  const videoId = normalizeYouTubeVideoId(song?.videoId || song?.youtubeId || song?.youtubeUrl || song?.url);
  const sources = useMemo(() => videoId ? [
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/0.jpg`,
    `https://i.ytimg.com/vi/${videoId}/default.jpg`,
  ] : [], [videoId]);
  const [sourceIndex, setSourceIndex] = useState(0);
  useEffect(() => setSourceIndex(0), [videoId]);

  if (!sources.length || sourceIndex >= sources.length) {
    return <span className={`mgv-thumb-fallback ${className}`} aria-hidden="true"><Music2 size={28} /></span>;
  }
  return <img className={className} src={sources[sourceIndex]} alt="" onError={() => setSourceIndex((index) => index + 1)} />;
}

function GameOverCollectibleCard({ song, large = false, onClick }) {
  if (!song) return null;
  const rarity = effectiveRarity(song);
  const frame = GAMEOVER_CARD_FRAMES[rarity] || GAMEOVER_CARD_FRAMES.winyl;
  const content = (
    <>
      <img className="mgv-gameover-card-frame" src={frame} alt="" />
      <div className="mgv-gameover-card-thumb"><YouTubeThumbnail song={song} /></div>
      <div className="mgv-gameover-card-copy">
        <strong>{song.year || '—'}</strong>
        <span>{song.artist || '—'}</span>
        <b>{song.title || '—'}</b>
      </div>
    </>
  );
  return onClick ? (
    <button type="button" className={`mgv-gameover-card ${large ? 'large' : ''}`} onClick={onClick} aria-label={`Pokaż kartę ${song.artist || ''} ${song.title || ''}`}>{content}</button>
  ) : <div className={`mgv-gameover-card ${large ? 'large' : ''}`}>{content}</div>;
}

function MobileCardPreview({ song, onClose }) {
  if (!song) return null;
  return (
    <div className="mgv-card-preview-backdrop" onClick={onClose}>
      <div className="mgv-card-preview" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="mgv-card-preview-close" onClick={onClose} aria-label="Zamknij podgląd karty"><X size={21} /></button>
        <span className="mgv-eyebrow">PODGLĄD KARTY</span>
        <GameOverCollectibleCard song={song} large />
        <div className="mgv-card-preview-copy"><strong>{song.artist || '—'}</strong><span>{song.title || '—'} · {song.year || '—'}</span></div>
      </div>
    </div>
  );
}

function rewardTypeIcon(label, kind = 'xp') {
  const raw = String(label || '').toLowerCase();
  if (raw.includes('wygran')) return <Trophy size={16} />;
  if (raw.includes('miejsce')) return <Crown size={16} />;
  if (kind === 'hitcoin') return <Gift size={16} />;
  return <Gamepad2 size={16} />;
}

function resetMobileScrollPosition() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function blurActiveMobileControl() {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') active.blur();
}

function useStableMobileViewport(resetKey) {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    blurActiveMobileControl();
    const reset = () => resetMobileScrollPosition();
    reset();

    const firstFrame = window.requestAnimationFrame(() => {
      reset();
      window.requestAnimationFrame(reset);
    });
    const shortTimer = window.setTimeout(reset, 90);
    const keyboardTimer = window.setTimeout(reset, 320);
    // UWAGA: celowo NIE nasłuchujemy tu window.visualViewport 'resize' —
    // to zdarzenie odpala się też wtedy, gdy na telefonie pojawia/znika
    // klawiatura (np. przy wpisywaniu roku w Zgadnij Rok), a wymuszony
    // wtedy reset scrolla "wyrywał" pole spod palca w trakcie pisania.
    // Reset przy starcie nowej rundy (zmiana resetKey) w zupełności
    // wystarcza, żeby naprawić oryginalny problem z białym ekranem.

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(keyboardTimer);
    };
  }, [resetKey]);
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

function TimelineCard({ card, highlight = '', compact = false, onClick }) {
  const content = (
    <>
      <span className="mgv-card-line" />
      <strong>{card?.year ?? '—'}</strong>
      <span className="mgv-card-title">{card?.title || '—'}</span>
      <span className="mgv-card-artist">{card?.artist || '—'}</span>
    </>
  );
  const className = `mgv-timeline-card ${highlight} ${compact ? 'compact' : ''} ${onClick ? 'clickable' : ''}`;
  return onClick ? (
    <button type="button" className={className} title={`${card?.title || ''} — ${card?.artist || ''}`} onClick={() => onClick(card)} aria-label={`Pokaż kartę ${card?.artist || ''} ${card?.title || ''}`}>{content}</button>
  ) : <div className={className} title={`${card?.title || ''} — ${card?.artist || ''}`}>{content}</div>;
}

function TimelineSlot({ index, selected, onPick }) {
  return (
    <button type="button" className={`mgv-slot ${selected === index ? 'selected' : ''}`} onClick={() => onPick(index)} aria-label={`Pozycja ${index + 1}`}>
      <span>+</span>
    </button>
  );
}

function MobileTimeline({ timeline = [], selectedSlot, onPick, interactive = true, compact = false, highlights = {}, onCardClick }) {
  return (
    <div className={`mgv-timeline-scroll ${compact ? 'compact' : ''}`}>
      <div className="mgv-timeline-row">
        {interactive ? <TimelineSlot index={0} selected={selectedSlot} onPick={onPick} /> : null}
        {timeline.map((card, index) => (
          <React.Fragment key={card?.id || `${card?.videoId || 'card'}-${index}`}>
            <TimelineCard card={card} compact={compact} highlight={highlights[index] || ''} onClick={onCardClick} />
            {interactive ? <TimelineSlot index={index + 1} selected={selectedSlot} onPick={onPick} /> : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function MobileChat({ open, setOpen, messages = [], playerId, chatInput, setChatInput, onSend, raised = false, hidden = false }) {
  const [seenCount, setSeenCount] = useState(() => messages.length);
  const [visualViewport, setVisualViewport] = useState(null);
  const messagesEndRef = useRef(null);
  const unreadCount = Math.max(0, messages.slice(Math.min(seenCount, messages.length)).filter((msg) => msg.playerId !== playerId).length);

  useEffect(() => {
    if (open) setSeenCount(messages.length);
    else if (seenCount > messages.length) setSeenCount(messages.length);
  }, [open, messages.length, seenCount]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const updateViewport = () => {
      if (!viewport) {
        setVisualViewport(null);
        return;
      }
      setVisualViewport({ height: viewport.height, offsetTop: viewport.offsetTop });
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ block: 'end' }));
  }, [open, messages.length]);

  const toggleChat = () => {
    if (!open) setSeenCount(messages.length);
    setOpen((value) => !value);
  };

  const viewportStyle = visualViewport
    ? { top: `${visualViewport.offsetTop}px`, bottom: 'auto', height: `${visualViewport.height}px` }
    : undefined;

  const submitMessage = (event) => {
    event?.preventDefault?.();
    if (!chatInput.trim()) return;
    onSend();
  };

  return (
    <>
      <button type="button" className={`mgv-chat-fab ${raised ? 'raised' : ''} ${unreadCount ? 'has-unread' : ''} ${hidden ? 'kb-hidden' : ''}`} onClick={toggleChat} aria-label={unreadCount ? `Czat, ${unreadCount} nowych wiadomości` : 'Czat'}>
        <MessageCircle size={23} />
        {unreadCount ? <span className="mgv-chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="mgv-sheet-backdrop mgv-chat-backdrop" style={viewportStyle} onClick={() => setOpen(false)}>
          <aside className="mgv-chat-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mgv-sheet-handle" />
            <div className="mgv-sheet-head"><strong>CZAT POKOJU</strong><button type="button" onClick={() => setOpen(false)}><X size={19} /></button></div>
            <div className="mgv-chat-messages">
              {messages.length === 0 ? <div className="mgv-empty">Napisz pierwszą wiadomość.</div> : messages.slice(-30).map((msg, index) => (
                <div key={`${msg.ts || index}-${index}`} className={`mgv-chat-message ${msg.playerId === playerId ? 'mine' : ''}`}>
                  <span>{msg.name}</span><p>{msg.text}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form className="mgv-chat-compose" onSubmit={submitMessage}>
              <input autoComplete="off" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Napisz wiadomość…" enterKeyHint="send" maxLength={300} />
              <button type="submit" disabled={!chatInput.trim()} aria-label="Wyślij wiadomość"><Send size={18} /></button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function MobilePracticeSetupView({
  practiceTarget,
  setPracticeTarget,
  practiceVariant = 'classic',
  setPracticeVariant,
  practiceFilterMode = 'categories',
  setPracticeFilterMode,
  selectedPracticeDecades = ['wszystkie'],
  onTogglePracticeDecade,
  selectedCategories,
  categories = [],
  onToggleCategory,
  songPool = [],
  busy,
  onStart,
  onHome,
}) {
  const normalized = (values) => (values || []).map((value) => String(value || '').trim().toLowerCase());
  const nonReligiousPool = songPool.filter((song) => !normalized(song.categories).includes('religijne'));
  const categoryFilterActive = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const decadeFilterActive = !selectedPracticeDecades.includes('wszystkie') && selectedPracticeDecades.length > 0;
  const playableCount = practiceFilterMode === 'decades'
    ? (decadeFilterActive ? nonReligiousPool.filter((song) => practiceDecadeMatch(song, selectedPracticeDecades)).length : nonReligiousPool.length)
    : (categoryFilterActive ? songPool.filter((song) => normalized(song.categories).some((category) => selectedCategories.includes(category))).length : nonReligiousPool.length);
  const decadeCounts = Object.fromEntries(PRACTICE_DECADES.map((decade) => [
    decade.key,
    nonReligiousPool.filter((song) => practiceDecadeMatch(song, [decade.key])).length,
  ]));
  const target = Number(practiceTarget || 15);
  const required = practiceVariant === 'yearGuess' ? target : target + 7;
  const yearGuess = practiceVariant === 'yearGuess';
  const selectionLabel = practiceFilterMode === 'decades'
    ? (decadeFilterActive ? selectedPracticeDecades.map((key) => PRACTICE_DECADES.find((d) => d.key === key)?.label).filter(Boolean).join(' + ') : 'Wszystkie dekady')
    : (categoryFilterActive ? selectedCategories.map((key) => categories.find((c) => c.slug === key)?.label || key).join(' + ') : 'Wszystkie kategorie');

  return (
    <MobileSession className="mgv-practice-setup">
      <MobileHeader eyebrow="TRYB SOLO" title="TRENING" onBack={onHome} />
      <ModeHero
        icon={yearGuess ? glZgadnijRok : glTrening}
        eyebrow="BEZ RANKINGU · BEZ PRESJI"
        title={yearGuess ? 'TRENING · ZGADNIJ ROK' : 'TRENING KLASYCZNY'}
        description={yearGuess ? 'Ćwicz rozpoznawanie roku wydania. Wynik zobaczysz od razu po każdej odpowiedzi.' : 'Ćwicz ustawianie utworów na osi czasu. Bez rankingu, tokenów i innych graczy.'}
        accent={yearGuess ? 'pink' : 'cyan'}
      >
        <div className="mgv-hero-chips"><span><Music2 size={14} /> {playableCount} utworów</span><span><Zap size={14} /> wynik bez statystyk multiplayer</span></div>
      </ModeHero>

      <Panel className="mgv-settings-card mgv-practice-settings">
        <div className="mgv-section-title"><Gamepad2 size={18} /><span>USTAW TRENING</span></div>

        <div className="mgv-practice-choice-section">
          <strong>1. TRYB TRENINGU</strong>
          <div className="mgv-practice-segment two">
            <button type="button" className={practiceVariant === 'classic' ? 'active' : ''} onClick={() => setPracticeVariant?.('classic')}><Disc3 size={17} /><span>KLASYCZNY<small>Oś czasu</small></span></button>
            <button type="button" className={practiceVariant === 'yearGuess' ? 'active' : ''} onClick={() => setPracticeVariant?.('yearGuess')}><CalendarDays size={17} /><span>ZGADNIJ ROK<small>Typowanie dat</small></span></button>
          </div>
        </div>

        <div className="mgv-practice-choice-section">
          <strong>2. WYBIERZ UTWORY</strong>
          <div className="mgv-practice-segment two compact">
            <button type="button" className={practiceFilterMode === 'categories' ? 'active' : ''} onClick={() => setPracticeFilterMode?.('categories')}><Music2 size={16} /> KATEGORIE</button>
            <button type="button" className={practiceFilterMode === 'decades' ? 'active' : ''} onClick={() => setPracticeFilterMode?.('decades')}><CalendarDays size={16} /> DEKADY</button>
          </div>
        </div>

        {practiceFilterMode === 'categories' ? (
          <div className="mgv-category-section mgv-practice-filter-list">
            <div className="mgv-category-head"><strong>KATEGORIE</strong><span>{playableCount} utworów</span></div>
            <div className="mgv-category-grid">
              {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => (
                <button key={category.slug} type="button" className={selectedCategories.includes(category.slug) ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mgv-category-section mgv-practice-filter-list">
            <div className="mgv-category-head"><strong>DEKADY</strong><span>{playableCount} utworów</span></div>
            <div className="mgv-decade-grid">
              <button type="button" className={selectedPracticeDecades.includes('wszystkie') ? 'active' : ''} onClick={() => onTogglePracticeDecade?.('wszystkie')}><strong>WSZYSTKIE</strong><small>{nonReligiousPool.length} utw.</small></button>
              {PRACTICE_DECADES.map((decade) => (
                <button key={decade.key} type="button" className={selectedPracticeDecades.includes(decade.key) ? 'active' : ''} onClick={() => onTogglePracticeDecade?.(decade.key)}><strong>{decade.label}</strong><small>{decadeCounts[decade.key]} utw.</small></button>
              ))}
            </div>
          </div>
        )}

        <div className="mgv-practice-target-section">
          <div className="mgv-category-head"><strong>{yearGuess ? 'LICZBA UTWORÓW' : 'CEL TRENINGU'}</strong><span>{target}</span></div>
          <div className="mgv-practice-presets">
            {[10, 15, 20, 30].map((value) => <button type="button" key={value} className={target === value ? 'active' : ''} onClick={() => setPracticeTarget(value)}>{value}</button>)}
          </div>
          <div className="mgv-stepper mgv-practice-stepper">
            <button type="button" onClick={() => setPracticeTarget(Math.max(1, target - 1))}>−</button>
            <input autoComplete="one-time-code" type="number" min="1" value={practiceTarget} onChange={(event) => setPracticeTarget(event.target.value === '' ? '' : parseInt(event.target.value, 10))} />
            <button type="button" onClick={() => setPracticeTarget(target + 1)}>+</button>
          </div>
        </div>

        <div className="mgv-practice-ready-note">
          <span>{yearGuess ? 'ZGADNIJ ROK' : 'KLASYCZNY'}</span>
          <strong>{selectionLabel}</strong>
          <small>{target} {target === 1 ? 'utwór' : 'utworów'} · {playableCount} dostępnych</small>
        </div>

        <button type="button" className="mgv-main-cta" disabled={busy || !practiceTarget || playableCount < required} onClick={onStart}>
          <Play size={20} fill="currentColor" /> {yearGuess ? 'ROZPOCZNIJ ZGADNIJ ROK' : 'ROZPOCZNIJ TRENING'} <ChevronRight size={20} />
        </button>
      </Panel>
    </MobileSession>
  );
}

export function MobileLobbyView({ room, roomId, playerId, isHost, copied, onCopy, onLeave, target, setTarget, selectedCategories, categories = [], onToggleCategory, songPool = [], busy, onStart, onStartYearGuess, onKick, playerLevels = {}, levelFromXp, onlinePlayers = [], roomInviteSentTo = {}, roomInviteBusyUid = null, onInviteToRoom }) {
  const normalized = (values) => (values || []).map((value) => String(value || '').trim().toLowerCase());
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((category) => selectedCategories.includes(category))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;

  const roomUids = new Set((room.players || []).map((player) => player.uid).filter(Boolean));
  const myUid = (room.players || []).find((player) => player.id === playerId)?.uid || null;
  const inviteCandidates = [...new Map(
    (onlinePlayers || [])
      .filter((player) => player.uid && !player.roomId && player.uid !== myUid && !roomUids.has(player.uid))
      .map((player) => [player.uid, player])
  ).values()];

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

      {isHost ? (
        <Panel className="mgv-online-invite-panel" accent="cyan">
          <div className="mgv-section-title"><UserPlus size={18} /><span>ZAPROŚ GRACZA ONLINE</span><b>{inviteCandidates.length}</b></div>
          {inviteCandidates.length ? (
            <div className="mgv-online-invite-list">
              {inviteCandidates.map((player) => {
                const sent = !!roomInviteSentTo[player.uid];
                const loading = roomInviteBusyUid === player.uid;
                return (
                  <div className="mgv-online-invite-row" key={player.playerId || player.uid}>
                    <div className="mgv-online-invite-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name || player.username) : null}</div>
                    <div className="mgv-online-invite-copy"><strong>{player.name || player.username || 'Gracz'}</strong><span><i /> online</span></div>
                    <button type="button" disabled={loading || sent} onClick={() => onInviteToRoom?.(player)}>{loading ? '...' : sent ? 'WYSŁANO' : 'ZAPROŚ'}</button>
                  </div>
                );
              })}
            </div>
          ) : <div className="mgv-note">Brak wolnych zalogowanych graczy online.</div>}
        </Panel>
      ) : null}

      <Panel className="mgv-lobby-settings" accent="pink">
        <div className="mgv-section-title"><Gamepad2 size={18} /><span>ZASADY GRY</span></div>
        {isHost ? (
          <>
            {room.yearGuessMode ? (
              <div className="mgv-setting-block">
                <div><strong>ZGADNIJ ROK</strong><small>Wszyscy słuchają tego samego utworu i typują rok wydania. Gra trwa 15 rund, punkty liczą się automatycznie.</small></div>
              </div>
            ) : (
              <div className="mgv-setting-block">
                <div><strong>KART DO WYGRANIA</strong><small>Pierwszy gracz, który zbierze tyle poprawnych kart, wygrywa.</small></div>
                <div className="mgv-stepper">
                  <button type="button" onClick={() => setTarget(Math.max(1, Number(target || 1) - 1))}>−</button>
                  <input autoComplete="one-time-code" type="number" min="1" value={target} onChange={(event) => setTarget(event.target.value === '' ? '' : parseInt(event.target.value, 10))} />
                  <button type="button" onClick={() => setTarget(Number(target || 0) + 1)}>+</button>
                </div>
              </div>
            )}
            <div className="mgv-category-section">
              <div className="mgv-category-head"><strong>KATEGORIE</strong><span>{playableCount} utworów</span></div>
              <div className="mgv-category-grid">
                {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => (
                  <button key={category.slug} type="button" className={selectedCategories.includes(category.slug) ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>
                ))}
              </div>
            </div>
            {room.yearGuessMode ? (
              <button type="button" className="mgv-main-cta" disabled={busy || room.players.length < 2} onClick={onStartYearGuess}><Play size={20} fill="currentColor" /> ROZPOCZNIJ ZGADNIJ ROK <ChevronRight size={20} /></button>
            ) : (
              <button type="button" className="mgv-main-cta" disabled={busy || !target || room.players.length < 2} onClick={onStart}><Play size={20} fill="currentColor" /> ROZPOCZNIJ GRĘ <ChevronRight size={20} /></button>
            )}
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

// ============================================================
// TRYB "ZGADNIJ ROK" — aktywna runda i wynik rundy
// ============================================================
export function MobileYearGuessView({ room, playerId, isPlaying, playElapsed, playCapSeconds, iframeRef, onTogglePlay, onSubmit, onLeave, chatInput, setChatInput, onSendChat }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [yearInput, setYearInput] = useState('');
  useStableMobileViewport(`yearguess-${room.yearGuessRoundIndex}`);
  const song = room.yearGuessSongs?.[room.yearGuessRoundIndex];
  const myAnswer = room.yearGuessAnswers?.[playerId];
  const answeredCount = Object.keys(room.yearGuessAnswers || {}).length;
  const totalPlayers = room.players.length;
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    setYearInput('');
  }, [room.yearGuessRoundIndex]);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(60 - (Date.now() - (room.yearGuessRoundStartedAtMs || Date.now())) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [room.yearGuessRoundStartedAtMs]);

  if (!song) return null;
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  const currentYear = new Date().getFullYear();
  const parsedYear = Number(yearInput);
  const validYear = /^\d{4}$/.test(yearInput) && parsedYear >= 1900 && parsedYear <= currentYear;
  const handleYearChange = (event) => {
    const next = String(event.target.value || '').replace(/\D/g, '').slice(0, 4);
    setYearInput(next);
  };
  const nudgeYear = (amount) => {
    const base = validYear ? parsedYear : Math.min(currentYear, Math.max(1900, Number(yearInput) || 2000));
    setYearInput(String(Math.min(currentYear, Math.max(1900, base + amount))));
  };
  const submitYearGuess = () => {
    blurActiveMobileControl();
    resetMobileScrollPosition();
    window.setTimeout(resetMobileScrollPosition, 120);
    onSubmit(parsedYear);
  };

  return (
    <MobileSession className="mgv-yearguess-page">
      <MobileHeader eyebrow={`${room.practiceYearGuessMode ? 'TRENING SOLO · ' : ''}RUNDA ${room.yearGuessRoundIndex + 1} / ${room.yearGuessSongs.length}`} title="ZGADNIJ ROK" onBack={onLeave} right={<span className={`mgv-live-pill ${secondsLeft <= 10 ? 'danger' : ''}`}><Clock3 size={13} />{secondsLeft}s</span>} />

      <Panel className="mgv-audio-panel mgv-yearguess-audio">
        <MobileVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
        <div className="mgv-hidden-player"><iframe key={`yg-${room.yearGuessRoundIndex}`} ref={iframeRef} title="yearguess-player" src={`https://www.youtube.com/embed/${song.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.yearGuessStartSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
        <button type="button" className="mgv-audio-cta" onClick={onTogglePlay}><Play size={19} fill="currentColor" />{isPlaying ? 'ODTWARZANIE' : 'ODTWÓRZ PONOWNIE'}<span>{audioLeft}s</span></button>
      </Panel>

      <Panel accent="pink" className="mgv-yearguess-answer-panel">
        <div className="mgv-yearguess-question">
          <span className="mgv-yearguess-question-icon"><CalendarDays size={21} /></span>
          <div><span className="mgv-eyebrow">TWÓJ TYP</span><h2>W KTÓRYM ROKU WYSZEDŁ TEN UTWÓR?</h2></div>
        </div>

        {myAnswer ? (
          <div className="mgv-yearguess-locked">
            <span className="mgv-yearguess-lock-check"><Check size={27} /></span>
            <span>ODPOWIEDŹ ZABLOKOWANA</span>
            <strong>{myAnswer.year}</strong>
            <p>Czekamy na pozostałych graczy <b>{answeredCount}/{totalPlayers}</b></p>
            <div className="mgv-yearguess-wait-track"><i style={{ width: `${Math.min(100, (answeredCount / Math.max(1, totalPlayers)) * 100)}%` }} /></div>
          </div>
        ) : (
          <>
            <div className={`mgv-yearguess-console ${validYear ? 'valid' : ''}`}>
              <span className="mgv-yearguess-console-label">ROK WYDANIA</span>
              <div className="mgv-yearguess-console-row">
                <button type="button" className="mgv-yearguess-step" onClick={() => nudgeYear(-1)} aria-label="Rok wcześniej">−</button>
                <input autoComplete="one-time-code" name="yearguess-year-mob"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  className="mgv-year-input"
                  placeholder="1994"
                  value={yearInput}
                  onChange={handleYearChange}
                  aria-label="Wpisz rok wydania"
                />
                <button type="button" className="mgv-yearguess-step" onClick={() => nudgeYear(1)} aria-label="Rok później">+</button>
              </div>
              <small>{yearInput && !validYear ? `Podaj rok 1900–${currentYear}` : 'Wpisz 4 cyfry i zatwierdź swój typ'}</small>
            </div>

            <div className="mgv-yearguess-scoring">
              <div><strong>+10</strong><span>dokładnie</span></div>
              <div><strong>+8</strong><span>± 1–3 lata</span></div>
              <div><strong>+6</strong><span>± 4–5 lat</span></div>
              <div><strong>+4</strong><span>± 6–8 lat</span></div>
              <div><strong>+2</strong><span>± 9–10 lat</span></div>
            </div>

            <button
              type="button"
              className="mgv-main-cta mgv-yearguess-submit"
              disabled={!validYear}
              onClick={submitYearGuess}
            >
              <Check size={20} /> ZATWIERDŹ {validYear ? parsedYear : 'ROK'}
            </button>
            <p className="mgv-note">Po zatwierdzeniu odpowiedzi nie można już zmienić.</p>
          </>
        )}
      </Panel>
      {!room.practiceYearGuessMode ? <MobileChat open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </MobileSession>
  );
}

export function MobileYearGuessResultView({ room, playerId, onLeave, resultDurationSeconds = 10, chatInput, setChatInput, onSendChat }) {
  const [chatOpen, setChatOpen] = useState(false);
  const last = room.yearGuessLastRound;
  useStableMobileViewport(`yearguess-result-${room.yearGuessRoundIndex}-${room.yearGuessResultStartedAtMs || 0}`);
  const [secondsLeft, setSecondsLeft] = useState(resultDurationSeconds);
  const [localResultStartedAt] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const startedAt = room.yearGuessResultStartedAtMs || localResultStartedAt;
      const left = Math.max(0, Math.ceil(resultDurationSeconds - (Date.now() - startedAt) / 1000));
      setSecondsLeft(left);
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [room.yearGuessResultStartedAtMs, room.yearGuessRoundIndex, resultDurationSeconds, localResultStartedAt]);

  if (!last) return null;
  const isLastRound = room.yearGuessRoundIndex >= room.yearGuessSongs.length - 1;
  const actualYear = Number(last.song.year);
  const sorted = [...last.results].sort((a, b) => {
    if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
    const aDiff = a.diff === null ? Number.POSITIVE_INFINITY : a.diff;
    const bDiff = b.diff === null ? Number.POSITIVE_INFINITY : b.diff;
    if (aDiff !== bDiff) return aDiff - bDiff;
    return (room.yearGuessScores?.[b.playerId] || 0) - (room.yearGuessScores?.[a.playerId] || 0);
  });
  const myResult = last.results.find((result) => result.playerId === playerId);
  const yearWord = (value) => value === 1 ? 'ROK' : (value >= 2 && value <= 4 ? 'LATA' : 'LAT');
  const yearWordLower = (value) => value === 1 ? 'rok' : (value >= 2 && value <= 4 ? 'lata' : 'lat');
  const answerText = (result) => {
    if (result.year === null) return 'BRAK ODPOWIEDZI';
    if (result.diff === 0) return 'IDEALNIE!';
    return result.year < actualYear ? `${result.diff} ${yearWord(result.diff)} ZA WCZEŚNIE` : `${result.diff} ${yearWord(result.diff)} ZA PÓŹNO`;
  };

  return (
    <MobileSession className="mgv-yearguess-page mgv-yearguess-result-page">
      <MobileHeader eyebrow={`${room.practiceYearGuessMode ? 'TRENING SOLO · ' : ''}RUNDA ${room.yearGuessRoundIndex + 1} / ${room.yearGuessSongs.length}`} title="WYNIK RUNDY" onBack={onLeave} right={<span className="mgv-live-pill result"><Clock3 size={13} />{secondsLeft}s</span>} />

      <Panel className="mgv-yearguess-reveal" accent="gold">
        <span className="mgv-yearguess-reveal-kicker">PRAWIDŁOWY ROK</span>
        <strong className="mgv-yearguess-correct-year">{actualYear}</strong>
        <div className="mgv-yearguess-song-copy"><Music2 size={18} /><div><strong>{last.song.title}</strong><span>{last.song.artist}</span></div></div>
      </Panel>

      {myResult ? (
        <Panel className={`mgv-yearguess-my-result ${myResult.points >= 3 ? 'great' : myResult.points > 0 ? 'close' : 'miss'}`}>
          <div><span>TWÓJ TYP</span><strong>{myResult.year ?? '—'}</strong></div>
          <div><span>RÓŻNICA</span><strong>{myResult.diff === null ? '—' : myResult.diff === 0 ? '0' : `${myResult.diff} ${yearWordLower(myResult.diff)}`}</strong></div>
          <div><span>PUNKTY</span><strong>+{myResult.points || 0}</strong></div>
          <p>{answerText(myResult)}</p>
        </Panel>
      ) : null}

      {!room.practiceYearGuessMode ? (
      <Panel className="mgv-yearguess-round-board">
        <div className="mgv-section-title"><Users size={18} /><span>ODPOWIEDZI GRACZY</span><b>{last.results.length}</b></div>
        <div className="mgv-yearguess-result-list">
          {sorted.map((result, index) => {
            const player = room.players.find((item) => item.id === result.playerId);
            const totalNow = room.yearGuessScores?.[result.playerId] || 0;
            const rowTone = result.diff === 0 ? 'exact' : result.points >= 3 ? 'great' : result.points > 0 ? 'close' : 'miss';
            return (
              <div key={result.playerId} className={`mgv-yearguess-result-row ${rowTone} ${result.playerId === playerId ? 'is-me' : ''}`} style={{ '--yg-row': index }}>
                <span className="mgv-yearguess-result-place">{index + 1}</span>
                <span className="mgv-avatar" style={player?.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player?.avatarUrl ? initials(result.name) : null}</span>
                <div className="mgv-yearguess-result-player"><strong>{result.name}{result.playerId === playerId ? ' · TY' : ''}</strong><small>{answerText(result)}</small></div>
                <div className="mgv-yearguess-result-guess"><span>TYP</span><strong>{result.year ?? '—'}</strong></div>
                <div className="mgv-yearguess-result-points"><strong>+{result.points || 0}</strong><span>{totalNow} pkt</span></div>
              </div>
            );
          })}
        </div>
      </Panel>
      ) : null}

      <div className="mgv-yearguess-next-round">
        <div><span>{isLastRound ? 'PODSUMOWANIE GRY' : 'KOLEJNA RUNDA'}</span><strong>{secondsLeft}s</strong></div>
        <i><b style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / resultDurationSeconds) * 100))}%` }} /></i>
      </div>
      {!room.practiceYearGuessMode ? <MobileChat open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </MobileSession>
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
        <div className="mgv-result-countdown"><Clock3 size={18} /><span>{room.leagueMode ? 'KOLEJNY UTWÓR LIGI' : room.tournamentMode ? 'KOLEJNY UTWÓR MECZU' : room.practiceMode ? 'KOLEJNY UTWÓR' : 'KOLEJNA TURA'}</span><strong>{advanceCountdown ?? 5}</strong><em>sek.</em></div>
        {displayCards.length ? (
          <div className="mgv-result-timeline">
            <div className="mgv-subhead"><span>{room.leagueMode ? 'TWOJA OŚ LIGOWA' : room.tournamentMode ? 'TWOJA OŚ TURNIEJOWA' : room.practiceMode ? 'TWOJA OŚ' : `OŚ · ${ownerName}`}</span><b>{ownerTimeline.length}/{room.target}</b></div>
            <div className="mgv-timeline-scroll compact"><div className="mgv-timeline-row">{displayCards.map((card, index) => <TimelineCard key={card.__ghost ? 'ghost' : card.id || index} card={card} compact highlight={card.__ghost ? 'bad' : ''} />)}</div></div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MobilePlayingView({ screen, room, playerId, isMyTurn, turnPlayerName, decisionLeft, playElapsed, playCapSeconds, isPlaying, iframeRef, onTogglePlay, guessArtist, setGuessArtist, guessTitle, setGuessTitle, onSwapSong, onBuyCard, swapCost, buyCost, chosenSlot, setChosenSlot, turnTimeline, viewedTimeline, displayedPlayerId, displayedPlayerName, setViewedPlayerId, onConfirmPlacement, busy, playerLevels = {}, levelFromXp, votingCountdown, onVote, advanceCountdown, onLeave, chatInput, setChatInput, onSendChat }) {
  const [timelinePreviewId, setTimelinePreviewId] = useState(null);
  const [cardPreview, setCardPreview] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [tokenToolsOpen, setTokenToolsOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - (viewport.height + viewport.offsetTop));
      setKeyboardInset(inset > 60 ? inset : 0);
    };
    updateInset();
    viewport.addEventListener('resize', updateInset);
    viewport.addEventListener('scroll', updateInset);
    return () => {
      viewport.removeEventListener('resize', updateInset);
      viewport.removeEventListener('scroll', updateInset);
    };
  }, []);
  const keyboardOpen = keyboardInset > 0;
  const modeLabel = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.leagueMode ? 'LIGA' : room.tournamentMode ? 'TURNIEJ' : room.practiceMode ? 'TRENING' : 'ROZGRYWKA';
  const currentTokens = room.tokens?.[playerId] || 0;
  const turnName = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.leagueMode ? 'MECZ LIGOWY' : room.tournamentMode ? 'MECZ TURNIEJOWY' : room.practiceMode ? 'TRENING SOLO' : isMyTurn ? 'TWOJA KOLEJ!' : turnPlayerName || 'TURA GRACZA';
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  const practicePlayed = room.practiceMode ? (room.playedCards || []).filter((card) => card.playerId === playerId) : [];
  const practiceCorrect = practicePlayed.filter((card) => card.correct).length;
  const practiceWrong = practicePlayed.filter((card) => !card.correct).length;
  const activeTimelineLength = (room.timelines?.[displayedPlayerId] || []).length;
  const timelinePreviewPlayer = timelinePreviewId ? room.players.find((player) => player.id === timelinePreviewId) : null;
  const timelinePreviewCards = timelinePreviewId
    ? [...(room.timelines?.[timelinePreviewId] || [])].sort((a, b) => a.year - b.year)
    : [];

  useEffect(() => {
    setTokenToolsOpen(false);
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }, [room.currentCard?.id]);

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
                <MobileTimeline timeline={turnTimeline} selectedSlot={chosenSlot} onPick={setChosenSlot} onCardClick={setCardPreview} />
                {!room.practiceMode ? (
                  <div className="mgv-inline-guess compact">
                    <div className="mgv-inline-guess-fields">
                      <input autoComplete="off"
                        aria-label="Wykonawca"
                        value={guessArtist}
                        onChange={(event) => setGuessArtist(event.target.value)}
                        placeholder="Wpisz wykonawcę"
                        autoComplete="off"
                        enterKeyHint="next"
                      />
                      <input autoComplete="off"
                        aria-label="Tytuł"
                        value={guessTitle}
                        onChange={(event) => setGuessTitle(event.target.value)}
                        placeholder="Wpisz tytuł"
                        autoComplete="off"
                        enterKeyHint="done"
                      />
                    </div>
                    <button type="button" className="mgv-token-tools-toggle" aria-expanded={tokenToolsOpen} onClick={() => setTokenToolsOpen((value) => !value)}>
                      <span><img src={iconToken} alt="" /> OPCJE ZA TOKENY · {currentTokens}</span>
                      <ChevronRight size={17} className={tokenToolsOpen ? 'open' : ''} />
                    </button>
                    {tokenToolsOpen ? (
                      <div className="mgv-token-actions">
                        <button type="button" onClick={onSwapSong} disabled={busy || currentTokens < swapCost}>
                          <RotateCcw size={17} />
                          <span><strong>WYMIEŃ UTWÓR</strong><small>Losuje inny utwór do tej tury</small></span>
                          <b><img src={iconToken} alt="" />{swapCost}</b>
                        </button>
                        <button type="button" onClick={onBuyCard} disabled={busy || currentTokens < buyCost}>
                          <Gift size={17} />
                          <span><strong>KUP KARTĘ W CIEMNO</strong><small>Dodaje kartę od razu do Twojej osi</small></span>
                          <b><img src={iconToken} alt="" />{buyCost}</b>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <MobileTimeline timeline={viewedTimeline} interactive={false} onCardClick={setCardPreview} />
            )}
          </Panel>
        </>
      )}

      {room.practiceMode ? (
        <Panel className={`mgv-practice-live ${room.tournamentMode ? 'tournament' : room.leagueMode ? 'league' : ''}`} accent={room.tournamentMode ? 'gold' : room.leagueMode ? 'cyan' : 'green'}>
          <div className="mgv-section-title"><Zap size={17} /><span>{room.leagueMode ? 'WYNIK MECZU LIGOWEGO' : room.tournamentMode ? 'WYNIK MECZU TURNIEJOWEGO' : room.dailyPlaylistMode ? 'POSTĘP PLAYLISTY' : 'POSTĘP TRENINGU'}</span><b>{(room.tournamentMode || room.leagueMode) ? `${practicePlayed.length}/10` : `${(room.timelines?.[playerId] || []).length}/${room.target}`}</b></div>
          <div className="mgv-progress"><span style={{ width: `${Math.min(100, (room.tournamentMode || room.leagueMode) ? (practicePlayed.length / 10) * 100 : ((room.timelines?.[playerId] || []).length / Math.max(1, room.target)) * 100)}%` }} /></div>
          <div className="mgv-mini-stats"><div className="good"><Check size={17} /><span>Trafienia</span><b>{practiceCorrect}</b></div><div className="bad"><X size={17} /><span>Pomyłki</span><b>{practiceWrong}</b></div></div>
          {room.tournamentMode ? <small className="mgv-tournament-match-hint">10 utworów · przy remisie liczy się łączny czas</small> : room.leagueMode ? <small className="mgv-tournament-match-hint">10 utworów · równy wynik oznacza remis</small> : null}
        </Panel>
      ) : null}

      {screen === 'playing' && isMyTurn ? (
        <div className="mgv-round-dock" role="group" aria-label="Sterowanie turą" style={keyboardOpen ? { bottom: keyboardInset + 12 } : undefined}>
          <div className="mgv-round-dock-status">
            <span className={decisionLeft <= 10 ? 'danger' : ''}><Clock3 size={15} /> {decisionLeft}s</span>
            <small>{chosenSlot !== null ? `MIEJSCE ${chosenSlot + 1}` : 'WYBIERZ + NA OSI'}</small>
          </div>
          <button type="button" onClick={onConfirmPlacement} disabled={chosenSlot === null || busy}>ZATWIERDŹ <ChevronRight size={19} /></button>
        </div>
      ) : null}

      {!room.practiceMode ? <MobileChat open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} raised={screen === 'playing' && isMyTurn} hidden={keyboardOpen} /> : null}

      {!room.practiceMode ? (
        <Panel className="mgv-live-players" accent="cyan">
          <div className="mgv-live-players-head">
            <div><span className="mgv-eyebrow">GRACZE</span><strong>PODGLĄD OSI CZASU</strong></div>
            <small>Kliknij gracza</small>
          </div>
          <div className="mgv-player-table-head"><span>NICK</span><span>KARTY</span><span>TOKENY</span></div>
          <div className="mgv-live-player-list">
            {room.players.map((player) => {
              const cardsCount = (room.timelines?.[player.id] || []).length;
              const tokenCount = room.tokens?.[player.id] || 0;
              const active = player.id === room.currentPlayerId;
              return (
                <button type="button" key={player.id} className={`mgv-live-player-row ${active ? 'turn' : ''} ${player.id === playerId ? 'me' : ''}`} onClick={() => { setViewedPlayerId(player.id); setTimelinePreviewId(player.id); }}>
                  <span className="mgv-live-player-name">
                    <span className="mgv-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name) : null}</span>
                    <span><strong>{player.name}</strong><small>{player.id === playerId ? 'TY' : active ? 'TERAZ GRA' : 'GRACZ'}</small></span>
                  </span>
                  <b className="mgv-live-player-cards">{cardsCount}<i>/</i>{room.target}</b>
                  <b className="mgv-live-player-tokens"><img src={iconToken} alt="" />{tokenCount}</b>
                </button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {timelinePreviewPlayer ? (
        <div className="mgv-sheet-backdrop" onClick={() => setTimelinePreviewId(null)}>
          <aside className="mgv-bottom-sheet mgv-timeline-preview-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="mgv-sheet-handle" />
            <div className="mgv-sheet-head"><strong>OŚ CZASU · {timelinePreviewPlayer.name}</strong><button type="button" onClick={() => setTimelinePreviewId(null)}><X size={19} /></button></div>
            <div className="mgv-timeline-preview-meta"><span><Music2 size={15} /> {timelinePreviewCards.length}/{room.target} KART</span><span><img src={iconToken} alt="" /> {room.tokens?.[timelinePreviewPlayer.id] || 0} TOKENÓW</span></div>
            {timelinePreviewCards.length ? <MobileTimeline timeline={timelinePreviewCards} interactive={false} onCardClick={setCardPreview} /> : <div className="mgv-empty-timeline">Ten gracz nie ma jeszcze kart na osi.</div>}
          </aside>
        </div>
      ) : null}

      {cardPreview ? <MobileCardPreview song={cardPreview} onClose={() => setCardPreview(null)} /> : null}
      {screen === 'roundResult' ? <MobileRoundResult room={room} advanceCountdown={advanceCountdown} /> : null}
    </MobileSession>
  );
}

export function MobilePracticeResultView({ room, playerId, onAgain, onHome }) {
  const isYearGuess = !!room.practiceYearGuessMode;
  const timeline = [...(room.timelines?.[playerId] || [])].sort((a, b) => a.year - b.year);
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const correct = played.filter((card) => card.correct).length;
  const wrong = played.filter((card) => !card.correct).length;
  const accuracy = played.length ? Math.round((correct / played.length) * 100) : 0;
  const ygScore = Number(room.yearGuessScores?.[playerId] || 0);
  const ygExact = Number(room.yearGuessExactCounts?.[playerId] || 0);
  const ygRounds = room.yearGuessSongs?.length || room.target || 0;
  const ygMax = ygRounds * 5;
  const ygAccuracy = ygMax ? Math.round((ygScore / ygMax) * 100) : 0;

  return (
    <MobileSession className="mgv-finish-page">
      <MobileHeader eyebrow="TRENING" title="GOTOWE!" onBack={onHome} />
      <div className="mgv-final-mark cyan"><Check size={18} /><span>SESJA ZAKOŃCZONA</span></div>
      <ModeHero
        icon={isYearGuess ? glZgadnijRok : glTrening}
        eyebrow="PODSUMOWANIE"
        title={isYearGuess ? 'ZGADNIJ ROK UKOŃCZONE' : 'TRENING UKOŃCZONY'}
        description={isYearGuess ? 'To był trening — wynik nie trafia do rankingu. Sprawdź rezultat i spróbuj ponownie.' : 'Twoja oś jest gotowa. Zobacz wynik i spróbuj ponownie, kiedy chcesz.'}
        accent={isYearGuess ? 'pink' : 'cyan'}
      />
      {isYearGuess ? (
        <>
          <div className="mgv-result-stat-grid"><div><CalendarDays size={18} /><strong>{ygScore}</strong><span>punktów</span></div><div><Target size={18} /><strong>{ygExact}</strong><span>idealnych lat</span></div><div><Zap size={18} /><strong>{ygAccuracy}%</strong><span>maks. wyniku</span></div></div>
          <Panel><div className="mgv-section-title"><Music2 size={18} /><span>WYNIK TRENINGU</span><b>{ygRounds} rund</b></div><div className="mgv-practice-year-summary"><strong>{ygScore} / {ygMax}</strong><span>punktów · bez wpływu na ranking Zgadnij Rok</span></div></Panel>
        </>
      ) : (
        <>
          <div className="mgv-result-stat-grid"><div><Check size={18} /><strong>{correct}</strong><span>trafień</span></div><div><X size={18} /><strong>{wrong}</strong><span>pomyłek</span></div><div><Zap size={18} /><strong>{accuracy}%</strong><span>skuteczność</span></div></div>
          <Panel><div className="mgv-section-title"><Music2 size={18} /><span>TWOJA OŚ CZASU</span><b>{timeline.length}/{room.target}</b></div><MobileTimeline timeline={timeline} interactive={false} compact /></Panel>
        </>
      )}
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

function MobileWeeklyRankingRewards({ modeLabel }) {
  return (
    <Panel className="mgv-weekly-ranking-rewards" accent="gold">
      <div className="mgv-section-title"><Gift size={18} /><span>NAGRODY TYGODNIOWE</span><b>TOP 3</b></div>
      <div className="mgv-weekly-reward-grid">
        {WEEKLY_RANKING_REWARDS.map((reward) => (
          <div key={reward.place} className={`place-${reward.place}`}>
            <span>{reward.place === 1 ? '🥇' : reward.place === 2 ? '🥈' : '🥉'} {reward.place}. MIEJSCE</span>
            <strong>+{reward.xp} XP</strong>
            <b>+{reward.hitcoin} <img src={iconHitcoin} alt="HITCOIN" /></b>
          </div>
        ))}
      </div>
      <p>Ranking tygodniowy {modeLabel ? `· ${modeLabel}` : ''}. Po zakończeniu tygodnia nagroda czeka na koncie — <b>odbierasz ją ręcznie</b>.</p>
    </Panel>
  );
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
      <MobileWeeklyRankingRewards modeLabel="Playlista dnia" />
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
              <label><span>WYKONAWCA</span><input autoComplete="off" value={guessArtist} onChange={(event) => setGuessArtist(event.target.value)} placeholder="Np. Maanam" /></label>
              <label><span>TYTUŁ</span><input autoComplete="off" value={guessTitle} onChange={(event) => setGuessTitle(event.target.value)} placeholder="Np. Kocham Cię, kochanie moje" /></label>
              <label className="year"><span>ROK WYDANIA</span><input autoComplete="one-time-code" name="classic-guess-year" type="number" inputMode="numeric" value={guessYear} onChange={(event) => setGuessYear(event.target.value)} placeholder="1984" /></label>
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

function CompetitionStatus({ item, kind }) {
  const status = item?.status || 'none';
  const text = status === 'signup' ? 'ZAPISY' : status === 'active' ? 'TRWA' : status === 'completed' ? 'ZAKOŃCZONY' : 'BRAK';
  return <span className={`mgv-competition-status ${status}`}>{kind} · {text}</span>;
}

function LeagueForm({ form = [] }) {
  const items = form.slice(-5);
  return (
    <span className="mgv-league-form" aria-label={`Forma: ${items.join(', ') || 'brak meczów'}`}>
      {items.length ? items.map((value, index) => <i key={`${value}-${index}`} className={value === 'W' ? 'win' : value === 'R' ? 'draw' : 'loss'}>{value}</i>) : <em>—</em>}
    </span>
  );
}

export function MobileCompetitionHubView({ tournament, league, busy, onCup, onLeague, onHome }) {
  const cupPlayers = tournament?.signups?.length || 0;
  const leaguePlayers = league?.signups?.length || 0;
  const cupWinner = tournament?.status === 'completed' && tournament?.winnerUid ? (tournament.signups || []).find((p) => p.uid === tournament.winnerUid) : null;
  const leagueLeader = league?.status === 'completed' ? (league.standings?.[0] || getLeagueUserState(league, '__preview__').standings?.[0]) : null;
  return (
    <MobileSession className="mgv-competition-hub">
      <MobileHeader eyebrow="RYWALIZACJA" title="TURNIEJ" onBack={onHome} />
      <ModeHero icon={glTurniej} eyebrow="CENTRUM RYWALIZACJI" title="WYBIERZ FORMAT" description="Puchar to szybka drabinka eliminacyjna. Liga to dłuższa rywalizacja każdy z każdym, tabela i kolejki." accent="gold" />
      <div className="mgv-competition-mode-grid">
        <button type="button" className="mgv-competition-mode cup" onClick={onCup} disabled={busy}>
          <div className="mgv-competition-mode-icon"><Trophy size={30} /></div>
          <CompetitionStatus item={tournament} kind="PUCHAR" />
          <strong>PUCHAR</strong>
          <p>Drabinka, eliminacja po porażce i finał o pulę XP.</p>
          <div className="mgv-competition-mode-meta"><span><Users size={14}/>{cupPlayers} graczy</span>{cupWinner ? <span><Crown size={14}/>{cupWinner.name || 'Zwycięzca'}</span> : null}</div>
          <span className="mgv-competition-open">OTWÓRZ <ChevronRight size={17}/></span>
        </button>
        <button type="button" className="mgv-competition-mode league" onClick={onLeague} disabled={busy}>
          <div className="mgv-competition-mode-icon"><Crown size={30} /></div>
          <CompetitionStatus item={league} kind="LIGA" />
          <strong>LIGA</strong>
          <p>Każdy z każdym, 3/1/0 pkt, terminarz i końcowe podium.</p>
          <div className="mgv-competition-mode-meta"><span><Users size={14}/>{leaguePlayers} graczy</span>{leagueLeader ? <span><Trophy size={14}/>{leagueLeader.name || 'Lider'}</span> : null}</div>
          <span className="mgv-competition-open">OTWÓRZ <ChevronRight size={17}/></span>
        </button>
      </div>
      <Panel className="mgv-competition-note" accent="violet"><Sparkles size={18}/><div><strong>WYNIKI ZOSTAJĄ W GRZE</strong><small>Po zakończeniu Pucharu i Ligi nadal możesz wejść do wydarzenia, sprawdzić drabinkę, tabelę i rozegrane mecze.</small></div></Panel>
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
  notificationPermission,
  onEnableNotifications,
  onSignUp,
  onStartMatch,
  onHome,
  onRefresh,
  onOpenLeague,
}) {
  const currentUid = user?.uid;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const signups = tournament?.signups || [];
  const alreadyIn = !!currentUid && signups.some((player) => player.uid === currentUid);
  const winner = tournament?.winnerUid ? signups.find((player) => player.uid === tournament.winnerUid) : null;
  const status = tournament?.status || 'none';
  const entryFee = Number(tournament?.entryFee || 0);
  const pot = Math.max(0, (signups.length - 1) * entryFee);
  const myTournamentState = getTournamentUserState(tournament, currentUid, now);
  const notificationReady = notificationPermission === 'granted';

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
      <div className="mgv-competition-switch"><button className="active">PUCHAR</button><button onClick={onOpenLeague}>LIGA</button></div>

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

      <Panel className={`mgv-tournament-premium-status ${myTournamentState.urgent ? 'urgent' : ''}`} accent={myTournamentState.urgent ? 'pink' : 'gold'}>
        <div className="mgv-tournament-premium-top">
          <div>
            <span className="mgv-eyebrow">STATUS PREMIUM</span>
            <strong>{status === 'signup' ? (alreadyIn ? 'CZEKASZ NA START' : 'ZAPISY OTWARTE') : myTournamentState.canPlay ? 'TWÓJ MECZ JEST GOTOWY' : myTournamentState.waiting ? 'WYNIK ZAPISANY' : myTournamentState.wonMatch ? 'AWANSUJESZ DALEJ' : myTournamentState.eliminated ? 'UDZIAŁ ZAKOŃCZONY' : 'ŚLEDŹ DRABINKĘ'}</strong>
          </div>
          {status === 'active' && myTournamentState.deadline ? <b className={myTournamentState.urgent ? 'urgent' : ''}><Clock3 size={15} /> {tournamentTimeLeftLabel(myTournamentState.msLeft)}</b> : null}
        </div>
        {status === 'active' && myTournamentState.opponent ? <small>Przeciwnik: <strong>{myTournamentState.opponent.name || 'Gracz'}</strong>{myTournamentState.roundNumber ? ` · Runda ${myTournamentState.roundNumber}` : ''}</small> : status === 'signup' ? <small>Turniej ruszy automatycznie po zapełnieniu listy.</small> : <small>Wynik meczu zapisuje się w drabince po zakończeniu playlisty.</small>}
        <button type="button" className={`mgv-tournament-notify-toggle ${notificationReady ? 'enabled' : ''}`} onClick={onEnableNotifications} disabled={notificationPermission === 'unsupported'}>
          {notificationReady ? <BellRing size={16} /> : <Bell size={16} />}
          <span>{notificationPermission === 'unsupported' ? 'POWIADOMIENIA NIEDOSTĘPNE' : notificationPermission === 'denied' ? 'POWIADOMIENIA ZABLOKOWANE' : notificationReady ? 'POWIADOMIENIA WŁĄCZONE' : 'WŁĄCZ POWIADOMIENIA O TURNIEJU'}</span>
        </button>
      </Panel>

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

      {(status === 'active' || status === 'completed') ? (
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

export function MobileLeagueHubView({ league, user, busy, onSignUp, onStartMatch, onHome, onRefresh, onOpenSchedule, onOpenTournament, notificationPermission, onEnableNotifications }) {
  const currentUid = user?.uid;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const state = getLeagueUserState(league, currentUid, now);
  const status = league?.status || 'none';
  const totalRounds = league?.pairingSchedule?.length || league?.rounds?.length || 0;
  const currentRound = league?.rounds?.length || 0;
  const myStandingIndex = state.standings.findIndex((row) => row.uid === currentUid);
  const myStanding = myStandingIndex >= 0 ? state.standings[myStandingIndex] : null;
  const match = state.match;
  const me = (league?.signups || []).find((player) => player.uid === currentUid);
  const myScore = Number(match?.myResult?.score ?? 0);
  const opponentScore = match?.opponentResult?.score;
  const revealOpponentScore = !!match?.myResult && !!match?.opponentResult;

  if (!league) {
    return (
      <MobileSession className="mgv-tournament-page">
        <MobileHeader eyebrow="RYWALIZACJA" title="LIGA" onBack={onHome} />
        <div className="mgv-competition-switch"><button onClick={onOpenTournament}>PUCHAR</button><button className="active">LIGA</button></div>
        <ModeHero icon={glTurniej} eyebrow="LIGA" title="BRAK AKTYWNEJ LIGI" description="Aktualnie nie ma otwartej ani zakończonej ligi do pokazania." accent="cyan" />
        <div className="mgv-action-stack"><button type="button" className="mgv-secondary-cta" onClick={onRefresh}>ODŚWIEŻ</button><button type="button" className="mgv-ghost-cta" onClick={onHome}>STRONA GŁÓWNA</button></div>
      </MobileSession>
    );
  }

  return (
    <MobileSession className={`mgv-tournament-page mgv-league-page status-${status}`}>
      <MobileHeader eyebrow="RYWALIZACJA" title="LIGA" onBack={onHome} />
      <div className="mgv-competition-switch"><button onClick={onOpenTournament}>PUCHAR</button><button className="active">LIGA</button></div>

      <ModeHero
        icon={glTurniej}
        eyebrow={status === 'signup' ? 'TRWAJĄ ZAPISY' : status === 'active' ? 'SEZON LIGOWY' : 'LIGA ZAKOŃCZONA'}
        title={status === 'signup' ? 'ZAPISZ SIĘ DO LIGI' : status === 'active' ? `KOLEJKA ${currentRound} / ${totalRounds || '?'}` : 'TABELA KOŃCOWA'}
        description={status === 'signup'
          ? 'Każdy z każdym, bez odpadania. Admin zamyka zapisy i uruchamia sezon.'
          : status === 'active'
            ? 'Rozegraj swój mecz w 48 godzin. 3 pkt za wygraną, 1 za remis, 0 za porażkę.'
            : 'Sezon dobiegł końca. Pełna tabela i terminarz pozostają dostępne.'}
        accent="cyan"
      >
        <div className="mgv-hero-chips">
          <span><Users size={14} /> {league.signups.length} graczy</span>
          {status !== 'signup' ? <span><CalendarDays size={14}/> {totalRounds} kolejek</span> : null}
          {myStanding ? <span><Crown size={14}/> Twoje miejsce #{myStandingIndex + 1}</span> : null}
        </div>
      </ModeHero>

      {status === 'active' && match ? (
        <Panel className={`mgv-league-match-card ${state.urgent ? 'urgent' : ''}`} accent="cyan">
          <div className="mgv-league-match-head">
            <div><span className="mgv-eyebrow">TWÓJ MECZ · KOLEJKA {match.roundNumber}</span><strong>{match.resolved ? 'MECZ ROZSTRZYGNIĘTY' : match.waitingForOpponent ? 'WYNIK ZAPISANY' : state.canPlay ? 'GOTOWY DO GRY' : 'OCZEKIWANIE'}</strong></div>
            {state.deadline && !match.resolved ? <b className={state.urgent ? 'urgent' : ''}><Clock3 size={15}/> {tournamentTimeLeftLabel(state.msLeft)}</b> : null}
          </div>
          <div className="mgv-league-versus">
            <div className="me"><span className="mgv-avatar" style={me?.avatarUrl ? { backgroundImage: `url(${me.avatarUrl})` } : undefined}>{!me?.avatarUrl ? initials(me?.name || user?.displayName || 'Ty') : null}</span><small>TY</small><strong>{match.myResult ? `${myScore}/10` : '—'}</strong></div>
            <div className="vs">VS</div>
            <div><span className="mgv-avatar" style={match.opponent?.avatarUrl ? { backgroundImage: `url(${match.opponent.avatarUrl})` } : undefined}>{!match.opponent?.avatarUrl ? initials(match.opponent?.name) : null}</span><small>{match.opponent?.name || 'Gracz'}</small><strong>{revealOpponentScore ? `${opponentScore}/10` : match.opponentPlayed ? '✓' : '—'}</strong></div>
          </div>
          {!match.myResult && match.opponentPlayed ? <div className="mgv-league-hidden-score"><Shield size={15}/><span>Przeciwnik już zagrał. Jego wynik odsłoni się dopiero po Twoim meczu.</span></div> : null}
          {match.waitingForOpponent ? <div className="mgv-league-hidden-score"><Clock3 size={15}/><span>Twój wynik zapisany. Czekamy na przeciwnika — jego wynik pojawi się po rozegraniu meczu.</span></div> : null}
          {state.canPlay ? <button type="button" className="mgv-main-cta" disabled={busy} onClick={() => onStartMatch(match, match.roundNumber)}><Play size={19} fill="currentColor"/> ROZEGRAJ MECZ</button> : null}
          {match.resolved ? <button type="button" className="mgv-secondary-cta" onClick={onOpenSchedule}>ZOBACZ WYNIK MECZU</button> : null}
        </Panel>
      ) : status === 'active' ? (
        <div className="mgv-tournament-ready"><Check size={20}/><div><strong>KOLEJKA ROZEGRANA</strong><small>Czekasz na zamknięcie kolejki i następnego przeciwnika.</small></div></div>
      ) : null}

      <Panel className="mgv-league-notify" accent="gold"><button type="button" className={`mgv-tournament-notify-toggle ${notificationPermission === 'granted' ? 'enabled' : ''}`} onClick={onEnableNotifications} disabled={notificationPermission === 'unsupported'}>{notificationPermission === 'granted' ? <BellRing size={16}/> : <Bell size={16}/>}<span>{notificationPermission === 'unsupported' ? 'POWIADOMIENIA NIEDOSTĘPNE' : notificationPermission === 'denied' ? 'POWIADOMIENIA ZABLOKOWANE' : notificationPermission === 'granted' ? 'POWIADOMIENIA LIGOWE WŁĄCZONE' : 'WŁĄCZ POWIADOMIENIA O LIDZE'}</span></button></Panel>

      {status === 'signup' ? (
        <>
          <Panel className="mgv-tournament-signup" accent="cyan">
            <div className="mgv-section-title"><Users size={18}/><span>ZAPISANI</span><b>{league.signups.length}</b></div>
            <div className="mgv-tournament-signups">{league.signups.length ? league.signups.map((player) => <TournamentPlayer key={player.uid} player={player} me={player.uid === currentUid}/>) : <div className="mgv-empty">Jeszcze nikt się nie zapisał.</div>}</div>
          </Panel>
          <Panel className="mgv-tournament-rules" accent="violet">
            <div className="mgv-tournament-rule"><span><Trophy size={18}/></span><div><strong>PUNKTY</strong><small>Wygrana 3 · remis 1 · porażka 0</small></div></div>
            <div className="mgv-tournament-rule"><span><CalendarDays size={18}/></span><div><strong>KOLEJKI</strong><small>48 godzin na rozegranie meczu każdej kolejki</small></div></div>
            <div className="mgv-tournament-rule"><span><Music2 size={18}/></span><div><strong>MECZ</strong><small>10 ocenianych utworów · identyczna playlista dla obu graczy</small></div></div>
          </Panel>
          {state.signedUp ? <div className="mgv-tournament-ready"><Check size={20}/><div><strong>JESTEŚ ZAPISANY</strong><small>Czekamy aż admin wystartuje ligę.</small></div></div> : <button type="button" className="mgv-main-cta" disabled={busy} onClick={onSignUp}><Trophy size={19}/> {busy ? 'ZAPISUJĘ…' : 'ZAPISZ SIĘ ZA DARMO'}</button>}
        </>
      ) : null}

      {(status === 'active' || status === 'completed') ? (
        <Panel className="mgv-league-table-panel" accent="cyan">
          <div className="mgv-section-title"><Crown size={18}/><span>{status === 'completed' ? 'TABELA KOŃCOWA' : 'TABELA'}</span><b>{state.standings.length}</b></div>
          <div className="mgv-league-table-head"><span>#</span><span>GRACZ</span><span>M</span><span>BILANS</span><span>FORMA</span><span>PKT</span></div>
          <div className="mgv-league-table">
            {state.standings.map((row, i) => (
              <div key={row.uid} className={`mgv-league-row ${i < 3 ? `podium p${i + 1}` : ''} ${row.uid === currentUid ? 'me' : ''}`}>
                <span className="place">#{i + 1}</span>
                <span className="player"><i className="mgv-avatar" style={row.avatarUrl ? { backgroundImage: `url(${row.avatarUrl})` } : undefined}>{!row.avatarUrl ? initials(row.name) : null}</i><strong>{row.name}</strong><small>{row.wins}W {row.draws}R {row.losses}P</small></span>
                <span>{row.played}</span>
                <span className="balance">{row.totalScore}:{row.totalAgainst}</span>
                <LeagueForm form={row.form}/>
                <b>{row.points}</b>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="mgv-action-stack">
        {status !== 'signup' ? <button type="button" className="mgv-secondary-cta" onClick={onOpenSchedule}><CalendarDays size={17}/> TERMINARZ I WYNIKI</button> : null}
        <button type="button" className="mgv-ghost-cta mgv-tournament-refresh" onClick={onRefresh} disabled={busy}>ODŚWIEŻ DANE LIGI</button>
      </div>
    </MobileSession>
  );
}

export function MobileLeagueScheduleView({ league, user, onBack }) {
  const [expanded, setExpanded] = useState(null);
  const currentUid = user?.uid;
  const byUid = {};
  (league.signups || []).forEach((p) => { byUid[p.uid] = p; });
  const totalRounds = league.pairingSchedule?.length || league.rounds.length;
  const fmtDate = (value) => value ? new Date(value).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const avgSec = (result) => result?.timeMs ? `${(Number(result.timeMs) / 1000 / Math.max(1, result.playedCards?.length || 10)).toFixed(1)} s` : '—';

  return (
    <MobileSession className="mgv-tournament-page mgv-league-schedule-page">
      <MobileHeader eyebrow="LIGA" title="TERMINARZ" onBack={onBack} />
      <div className="mgv-league-schedule-intro"><CalendarDays size={18}/><div><strong>PEŁNY SEZON</strong><span>Wyniki i statystyki meczu widzą wszyscy. Szczegółowe odpowiedzi z utworów są dostępne tylko dla uczestników danego spotkania.</span></div></div>
      {Array.from({ length: totalRounds }).map((_, idx) => {
        const roundNum = idx + 1;
        const builtRound = league.rounds.find((r) => r.roundNumber === roundNum);
        const pairing = league.pairingSchedule?.[idx]?.pairs || [];
        const matches = builtRound ? builtRound.matches : pairing.map(({ a, b }, i) => ({ matchId: `future-${roundNum}-${i}`, player1: byUid[a], player2: b ? byUid[b] : null, outcome: null }));
        return (
          <Panel key={roundNum} className="mgv-league-schedule-round" accent={builtRound ? 'cyan' : undefined}>
            <div className="mgv-section-title"><Trophy size={16}/><span>KOLEJKA {roundNum}</span>{!builtRound ? <b>JESZCZE NIEROZEGRANA</b> : null}</div>
            <div className="mgv-league-schedule-list">
              {matches.map((m) => {
                if (!m.player2) return <div key={m.matchId} className="mgv-empty">{m.player1?.name || 'Gracz'} — wolny los</div>;
                const mine = !!currentUid && (m.player1?.uid === currentUid || m.player2?.uid === currentUid);
                const iAmP1 = m.player1?.uid === currentUid;
                const myResult = mine ? (iAmP1 ? m.player1Result : m.player2Result) : null;
                const opponentResult = mine ? (iAmP1 ? m.player2Result : m.player1Result) : null;
                const done = !!m.outcome && m.outcome !== 'bye';
                const isExpanded = expanded === m.matchId;
                const onePlayed = !!m.player1Result || !!m.player2Result;
                let scoreLabel = 'jeszcze nie rozegrano';
                if (done) scoreLabel = `${m.player1Result?.score ?? '—'} : ${m.player2Result?.score ?? '—'}`;
                else if (mine && myResult) scoreLabel = `${myResult.score}/10 · czekamy`;
                else if (mine && opponentResult) scoreLabel = 'rywal zagrał · wynik ukryty';
                else if (onePlayed) scoreLabel = '1/2 wyników zapisany';
                return (
                  <div key={m.matchId} className={`mgv-league-schedule-match ${mine ? 'mine' : ''} ${done ? 'done' : ''}`}>
                    <button type="button" onClick={() => done && setExpanded(isExpanded ? null : m.matchId)}>
                      <span className="teams"><strong>{m.player1?.name || '—'}</strong><i>VS</i><strong>{m.player2?.name || '—'}</strong></span>
                      <span className="score">{scoreLabel}</span>
                      {done ? <ChevronRight size={16} className={isExpanded ? 'open' : ''}/> : null}
                    </button>
                    {isExpanded && done ? (
                      <div className="mgv-league-match-detail">
                        <div className="mgv-league-detail-stats">
                          <div><span>WYNIK</span><strong>{m.player1Result?.score ?? '—'} : {m.player2Result?.score ?? '—'}</strong></div>
                          <div><span>CZAS 1</span><strong>{avgSec(m.player1Result)}</strong></div>
                          <div><span>CZAS 2</span><strong>{avgSec(m.player2Result)}</strong></div>
                          <div><span>DATA</span><strong>{fmtDate(Math.max(Number(m.player1Result?.playedAt || 0), Number(m.player2Result?.playedAt || 0)))}</strong></div>
                        </div>
                        {mine && m.player1Result?.playedCards && m.player2Result?.playedCards ? (
                          <div className="mgv-league-song-detail">
                            <span className="mgv-eyebrow">ODPOWIEDZI · TYLKO DLA UCZESTNIKÓW</span>
                            {m.player1Result.playedCards.map((c, i) => {
                              const c2 = m.player2Result.playedCards[i];
                              return <div key={i}><span>{c.artist} — {c.title} ({c.year})</span><b className={c.correct ? 'good' : 'bad'}>{c.correct ? '✓' : '✗'}</b><b className={c2?.correct ? 'good' : 'bad'}>{c2?.correct ? '✓' : '✗'}</b></div>;
                            })}
                          </div>
                        ) : <div className="mgv-league-private-note"><Shield size={15}/><span>Szczegółowe odpowiedzi do utworów widzą wyłącznie uczestnicy tego meczu.</span></div>}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </MobileSession>
  );
}

export function MobileTournamentMatchResultView({ room, playerId, onTournamentBack, onLeave }) {
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const score = played.filter((card) => card.correct).length;
  const wrong = Math.max(0, played.length - score);
  const times = room.decisionTimes?.[playerId] || [];
  const avgSeconds = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length / 1000) : null;
  return (
    <MobileSession className="mgv-tournament-result-page">
      <MobileHeader eyebrow="TURNIEJ PREMIUM" title="MECZ ZAKOŃCZONY" onBack={onLeave} backLabel="Opuść" right={<span className="mgv-tournament-fee"><Trophy size={14} /> RUNDA {room.tournamentRoundNumber || '—'}</span>} />
      <ModeHero icon={glTurniej} eyebrow="WYNIK ZAPISANY" title={`${score} / 10`} description="Twój rezultat trafia do drabinki. Przy remisie o awansie decyduje krótszy łączny czas odpowiedzi." accent="gold">
        <div className="mgv-hero-chips"><span><Check size={14} /> {score} trafień</span><span><X size={14} /> {wrong} błędów</span>{avgSeconds !== null ? <span><Clock3 size={14} /> śr. {avgSeconds}s</span> : null}</div>
      </ModeHero>
      <Panel className="mgv-tournament-result-summary" accent="gold">
        <div><span>WYNIK MECZU</span><strong>{score}/10</strong></div>
        <div><span>TRAFIENIA</span><strong>{score}</strong></div>
        <div><span>POMYŁKI</span><strong>{wrong}</strong></div>
        <div><span>ŚR. CZAS</span><strong>{avgSeconds !== null ? `${avgSeconds}s` : '—'}</strong></div>
      </Panel>
      <div className="mgv-tournament-result-note"><Trophy size={18} /><div><strong>CO DALEJ?</strong><span>Wróć do drabinki. Jeśli przeciwnik jeszcze nie zagrał, zobaczysz status oczekiwania; jeśli wynik jest już rozstrzygnięty — od razu zobaczysz awans.</span></div></div>
      <div className="mgv-action-stack"><button type="button" className="mgv-main-cta" onClick={onTournamentBack}><Trophy size={18} /> WRÓĆ DO TURNIEJU</button><button type="button" className="mgv-secondary-cta" onClick={onLeave}><LogOut size={17} /> OPUŚĆ</button></div>
    </MobileSession>
  );
}

function hitRushDifficultyMeta(key) {
  return { easy: ['ŁATWO', 'easy'], normal: ['NORMALNIE', 'normal'], hard: ['TRUDNO', 'hard'], expert: ['EKSPERT', 'expert'], insane: ['SZALEŃSTWO', 'insane'] }[key] || ['ŁATWO', 'easy'];
}

function hitRushNextBonusMeta(combo = 0, bonusEvery = 5, bonusSchedule = []) {
  const every = Math.max(1, Number(bonusEvery) || 5);
  const safeCombo = Math.max(0, Number(combo) || 0);
  const nextCombo = (Math.floor(safeCombo / every) + 1) * every;
  const sorted = [...bonusSchedule].sort((a, b) => Number(b.minCombo || 0) - Number(a.minCombo || 0));
  const seconds = Number(sorted.find((step) => nextCombo >= Number(step.minCombo || 0))?.seconds || 0);
  return { combo: nextCombo, seconds, remaining: Math.max(0, nextCombo - safeCombo) };
}

function hitRushBonusSummary(bonusSchedule = []) {
  const sorted = [...bonusSchedule].sort((a, b) => Number(a.minCombo || 0) - Number(b.minCombo || 0));
  return sorted.map((step, index) => `${step.minCombo}${index === sorted.length - 1 ? '+' : ''}: +${step.seconds}s`).join(' · ');
}

export function MobileHitRushMenuView({ stats, onStart, onLeaderboard, onHome, bonusEvery = 5, bonusSchedule = [], wrongPenalty = 2 }) {
  const bonusSummary = hitRushBonusSummary(bonusSchedule);
  return (
    <MobileSession className="mgv-hitrush-menu">
      <MobileHeader eyebrow="TRYB SOLO NA CZAS" title="HIT RUSH" onBack={onHome} right={<span className="mgv-timer"><Zap size={15} />60s</span>} />
      <ModeHero icon={glHitRush} eyebrow="REFLEKS · WIEDZA · COMBO" title="WCZEŚNIEJ CZY PÓŹNIEJ?" description="Porównuj lata wydania, buduj combo i wyciśnij jak najwięcej punktów z 60 sekund." accent="green">
        <div className="mgv-hero-chips"><span><Flame size={14} /> {bonusSummary || `bonus co ${bonusEvery}`}</span><span><Zap size={14} /> błąd −{wrongPenalty}s</span></div>
      </ModeHero>
      <div className="mgv-result-stat-grid hitrush"><div><Trophy size={18} /><strong>{stats?.hitRushBestScore || 0}</strong><span>rekord</span></div><div><Flame size={18} /><strong>{stats?.hitRushBestCombo || 0}</strong><span>best combo</span></div><div><Gamepad2 size={18} /><strong>{stats?.hitRushRunsTotal || 0}</strong><span>runów</span></div></div>
      <div className="mgv-action-stack mgv-hitrush-menu-actions">
        <button type="button" className="mgv-main-cta huge" onClick={onStart}><Play size={23} fill="currentColor" /> START HIT RUSH <ChevronRight size={22} /></button>
        <button type="button" className="mgv-secondary-cta" onClick={onLeaderboard}><Trophy size={18} /> RANKING HIT RUSH</button>
      </div>
      <MobileWeeklyRankingRewards modeLabel="Hit Rush" />
      <Panel className="mgv-howto-mini"><div className="mgv-section-title"><Sparkles size={18} /><span>JAK TO DZIAŁA?</span></div><div className="mgv-howto-steps"><div><b>1</b><span>Posłuchaj</span></div><div><b>2</b><span>Porównaj</span></div><div><b>3</b><span>Wcześniej / później</span></div><div><b>4</b><span>Buduj combo</span></div></div><small className="mgv-hr-rules-note">Mnożniki bez zmian · zła odpowiedź: −{wrongPenalty}s · bonusy czasu rosną z combo.</small></Panel>
    </MobileSession>
  );
}

export function MobileHitRushGameView({ hitRush, iframeRef, onReplay, onAnswer, onExit, roundSeconds = 60, bonusEvery = 5, bonusSchedule = [], wrongPenalty = 2, difficulty = 'easy' }) {
  const [difficultyLabel, difficultyClass] = hitRushDifficultyMeta(difficulty);
  const nextBonus = hitRushNextBonusMeta(hitRush.combo, bonusEvery, bonusSchedule);
  const comboStep = Math.max(0, Number(hitRush.combo || 0)) % Math.max(1, bonusEvery);
  const comboPct = Math.min(100, (comboStep / Math.max(1, bonusEvery)) * 100);
  const answerLocked = !hitRush.answerReady || !!hitRush.feedback;
  return (
    <MobileSession className={`mgv-hitrush-game ${difficultyClass}`}>
      <MobileHeader eyebrow="HIT RUSH" title="WCZEŚNIEJ / PÓŹNIEJ" onBack={onExit} right={<span className={`mgv-timer ${hitRush.timeLeft <= 10 ? 'danger' : ''}`}><Clock3 size={15} />{hitRush.timeLeft}s</span>} />
      <div className="mgv-hr-scorebar"><div><span>WYNIK</span><strong>{hitRush.score}</strong></div><div><span>COMBO</span><strong>🔥 {hitRush.combo}</strong></div><div className={`difficulty ${difficultyClass}`}><span>POZIOM</span><strong>{difficultyLabel}</strong></div></div>
      <div className="mgv-combo-track"><span style={{ width: `${comboPct}%` }} /><small>Jeszcze {nextBonus.remaining} do +{nextBonus.seconds}s (combo {nextBonus.combo})</small></div>
      <Panel className="mgv-hr-audio-card" accent="green">
        <div className="mgv-hidden-player"><iframe key={hitRush.currentCard.videoId} ref={iframeRef} title="hit-rush-player" src={`https://www.youtube.com/embed/${hitRush.currentCard.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${hitRush.currentStartSeconds}&controls=0&modestbranding=1&rel=0&playsinline=1`} allow="autoplay; encrypted-media" onLoad={onReplay} /></div>
        <div className="mgv-unknown-song"><Disc3 size={38} /><span>NOWY UTWÓR</span><strong>???</strong><small>Porównaj z kartą referencyjną</small></div>
        <button type="button" className="mgv-audio-cta" onClick={onReplay}><Play size={18} fill="currentColor" /> ODTWÓRZ PONOWNIE</button>
      </Panel>
      <div className="mgv-vs-divider"><span>PORÓWNAJ Z</span></div>
      <Panel className="mgv-reference-card" accent="violet"><span className="mgv-eyebrow">KARTA REFERENCYJNA</span><strong>{hitRush.referenceCard.year}</strong><h2>{hitRush.referenceCard.title}</h2><p>{hitRush.referenceCard.artist}</p></Panel>
      {hitRush.feedback ? (
        <div className={`mgv-hr-feedback ${hitRush.feedback.correct ? 'good' : 'bad'}`}><span>{hitRush.feedback.correct ? <Check size={22} /> : <X size={22} />}</span><strong>{hitRush.feedback.correct ? 'DOBRZE!' : 'NIE TYM RAZEM'}</strong><b>{hitRush.feedback.year}</b><small>{hitRush.feedback.correct ? `+${hitRush.feedback.points} pkt${hitRush.feedback.timeBonus > 0 ? ` · +${hitRush.feedback.timeBonus}s` : ''}` : `−${hitRush.feedback.timePenalty || wrongPenalty}s · combo od zera`}</small></div>
      ) : (
        <div className={`mgv-hr-feedback idle ${hitRush.answerReady ? 'ready' : 'locked'}`}><span><Headphones size={20} /></span><strong>{hitRush.answerReady ? 'MOŻESZ ODPOWIADAĆ' : 'URUCHAMIAM FRAGMENT…'}</strong><small>{hitRush.answerReady ? 'Wybierz wcześniej lub później.' : 'Zegar czeka. Przyciski odblokują się po krótkim odsłuchu.'}</small></div>
      )}
      <div className="mgv-hr-answer-grid"><button type="button" className="earlier" onClick={() => onAnswer('earlier')} disabled={answerLocked}><ArrowLeft size={21} /><span>WCZEŚNIEJ</span></button><button type="button" className="later" onClick={() => onAnswer('later')} disabled={answerLocked}><span>PÓŹNIEJ</span><ChevronRight size={21} /></button></div>
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
      <MobileWeeklyRankingRewards modeLabel="Hit Rush" />
      <button type="button" className="mgv-secondary-cta" onClick={onHome}>STRONA GŁÓWNA</button>
    </MobileSession>
  );
}


export function MobileLeagueMatchResultView({ room, playerId, league, user, onLeagueBack, onLeave }) {
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const score = played.filter((card) => card.correct).length;
  const wrong = Math.max(0, played.length - score);
  const times = room.decisionTimes?.[playerId] || [];
  const avg = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length / 1000) : null;
  const currentUid = user?.uid;
  const match = (league?.rounds || []).flatMap((round) => round.matches || []).find((item) => item.matchId === room.leagueMatchId);
  const iAmP1 = match?.player1?.uid === currentUid;
  const opponent = match ? (iAmP1 ? match.player2 : match.player1) : null;
  const opponentResult = match ? (iAmP1 ? match.player2Result : match.player1Result) : null;
  const persistedOutcome = match?.outcome;
  const outcome = persistedOutcome || (opponentResult ? (score > Number(opponentResult.score || 0) ? (iAmP1 ? 'p1' : 'p2') : score < Number(opponentResult.score || 0) ? (iAmP1 ? 'p2' : 'p1') : 'draw') : null);
  const won = outcome && ((iAmP1 && ['p1','walkover_p1'].includes(outcome)) || (!iAmP1 && ['p2','walkover_p2'].includes(outcome)));
  const drawn = outcome === 'draw';
  const pointsGain = outcome ? (won ? 3 : drawn ? 1 : 0) : null;
  const standings = league ? getLeagueUserState(league, currentUid).standings : [];
  const placeAfterIndex = standings.findIndex((row) => row.uid === currentUid);
  const placeAfter = persistedOutcome && placeAfterIndex >= 0 ? placeAfterIndex + 1 : null;
  const placeBefore = Number(room.leagueStandingBefore || 0) || null;
  const verdict = !outcome ? 'WYNIK ZAPISANY' : won ? 'WYGRANA' : drawn ? 'REMIS' : 'PORAŻKA';
  const title = opponentResult ? `${score} : ${opponentResult.score}` : `${score} / 10`;
  const description = !outcome
    ? `Czekamy na ${opponent?.name || 'przeciwnika'}. Jego wynik pozostaje ukryty do czasu rozegrania Twojego meczu — teraz pojawi się automatycznie po jego zakończeniu.`
    : `${verdict}. ${pointsGain > 0 ? `Do tabeli wpada +${pointsGain} pkt.` : 'W tym meczu nie zdobywasz punktów.'}`;
  return (
    <MobileSession className="mgv-tournament-result-page mgv-league-result-page">
      <MobileHeader eyebrow="LIGA" title="MECZ ZAKOŃCZONY" onBack={onLeave} />
      <ModeHero icon={glTurniej} eyebrow={`KOLEJKA ${room.leagueRoundNumber || '—'} · ${verdict}`} title={title} description={description} accent={won ? 'green' : drawn ? 'cyan' : 'gold'}>
        <div className="mgv-hero-chips"><span><Check size={14}/>{score} trafień</span><span><X size={14}/>{wrong} błędów</span>{avg !== null ? <span><Clock3 size={14}/>śr. {avg}s</span> : null}</div>
      </ModeHero>
      <Panel className="mgv-tournament-result-summary" accent="cyan">
        <div><span>TRAFIENIA</span><strong>{score}</strong></div>
        <div><span>POMYŁKI</span><strong>{wrong}</strong></div>
        <div><span>PUNKTY</span><strong>{pointsGain === null ? '—' : `+${pointsGain}`}</strong></div>
        <div><span>MIEJSCE</span><strong>{placeAfter ? (placeBefore && placeBefore !== placeAfter ? `#${placeBefore}→#${placeAfter}` : `#${placeAfter}`) : '—'}</strong></div>
      </Panel>
      <div className={`mgv-league-result-verdict ${outcome ? (won ? 'win' : drawn ? 'draw' : 'loss') : 'waiting'}`}><Trophy size={20}/><div><strong>{!outcome ? 'CZEKAMY NA RYWALA' : verdict}</strong><span>{!outcome ? 'Tabela zmieni się dopiero po rozstrzygnięciu spotkania. Nie naliczamy tymczasowych walkowerów.' : `Mecz z ${opponent?.name || 'przeciwnikiem'} został rozstrzygnięty i zapisany w terminarzu.`}</span></div></div>
      <div className="mgv-action-stack"><button className="mgv-main-cta" onClick={onLeagueBack}>WRÓĆ DO LIGI</button><button className="mgv-ghost-cta" onClick={onLeave}>OPUŚĆ</button></div>
    </MobileSession>
  );
}

export function MobileGameOverView({ room, playerId, isHost, onPlayAgain, onLeave, onTournamentBack, chatInput, setChatInput, onSendChat, gameEndReveal }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [playlistScope, setPlaylistScope] = useState('all');
  const winners = (room.winnerIds || []).map((id) => room.players.find((player) => player.id === id)).filter(Boolean);
  const standings = room.yearGuessMode
    ? [...room.players].sort((a, b) => (room.yearGuessScores?.[b.id] || 0) - (room.yearGuessScores?.[a.id] || 0))
    : [...room.players].sort((a, b) => (room.timelines?.[b.id]?.length || 0) - (room.timelines?.[a.id]?.length || 0));
  const playedCards = Array.isArray(room.playedCards) ? room.playedCards : [];
  const visiblePlaylist = playlistScope === 'mine' ? playedCards.filter((card) => card.playerId === playerId) : playedCards;
  const myStandingIndex = standings.findIndex((player) => player.id === playerId);
  const myPlace = (room.winnerIds || []).includes(playerId) ? 1 : Math.max(1, myStandingIndex + 1);
  const myScore = room.yearGuessMode ? (room.yearGuessScores?.[playerId] || 0) : (room.timelines?.[playerId]?.length || 0);
  const myScoreLabel = room.yearGuessMode ? 'pkt' : 'kart';
  const myGuesses = room.gameGuesses?.[playerId] || 0;
  const myBestStreak = room.gameBestStreaks?.[playerId] || 0;
  const myDecisionTimes = room.decisionTimes?.[playerId] || [];
  const myAvgDecision = myDecisionTimes.length ? myDecisionTimes.reduce((sum, value) => sum + value, 0) / myDecisionTimes.length / 1000 : 0;
  const rewardXpTotal = gameEndReveal?.xpItems?.reduce((sum, item) => sum + item.amount, 0) || 0;
  return (
    <MobileSession className="mgv-gameover-page">
      <MobileHeader eyebrow="KONIEC GRY" title="WYNIKI" onBack={onLeave} />
      <div className="mgv-final-mark gold"><Trophy size={18} /><span>ROZGRYWKA ZAKOŃCZONA</span></div>
      <Panel className="mgv-winner-panel" accent="gold"><Trophy size={50} /><span className="mgv-eyebrow">ZWYCIĘZCA</span><h1>{winners.length > 1 ? 'REMIS!' : `${winners[0]?.name || 'GRACZ'} WYGRYWA!`}</h1>{winners.length > 1 ? <p>{winners.map((winner) => winner.name).join(' · ')}</p> : null}</Panel>
      <Panel><div className="mgv-section-title"><Crown size={18} /><span>KLASYFIKACJA</span></div><div className="mgv-final-standing">{standings.map((player, index) => <div key={player.id} className={`${index < 3 ? `podium p${index + 1}` : ''}${player.id === playerId ? ' is-me' : ''}`}><span>#{index + 1}</span><span className="mgv-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name) : null}</span><strong>{player.name}</strong><b>{room.yearGuessMode ? `${room.yearGuessScores?.[player.id] || 0} pkt` : `${room.timelines?.[player.id]?.length || 0} kart`}</b></div>)}</div></Panel>
      <Panel className="mgv-gameover-summary" accent="cyan">
        <div className="mgv-section-title"><Sparkles size={18} /><span>TWOJE PODSUMOWANIE</span></div>
        <div className="mgv-gameover-summary-grid">
          <div className="place"><Crown size={17} /><span>MIEJSCE</span><strong>#{myPlace}</strong><small>z {room.players.length}</small></div>
          <div><Disc3 size={17} /><span>WYNIK</span><strong>{myScore}</strong><small>{myScoreLabel}</small></div>
          <div><Music2 size={17} /><span>ZGADNIĘTE</span><strong>{myGuesses}</strong><small>utworów</small></div>
          <div><Flame size={17} /><span>BEST SERIA</span><strong>{myBestStreak}</strong><small>z rzędu</small></div>
          <div className="wide"><Clock3 size={17} /><span>ŚREDNI CZAS DECYZJI</span><strong>{myAvgDecision ? `${myAvgDecision.toFixed(1)} s` : '—'}</strong><small>{myDecisionTimes.length ? `${myDecisionTimes.length} decyzji` : 'brak danych'}</small></div>
        </div>
      </Panel>
      {gameEndReveal ? (
        <Panel className="mgv-reward-panel mgv-gameover-persistent-rewards" accent="violet">
          <div className="mgv-section-title"><Gift size={18} /><span>TWOJE NAGRODY</span></div>
          <div className="mgv-gameover-reward-totals">
            <div className="xp">
              <span>ZDOBYTE XP</span>
              <strong>+{rewardXpTotal}</strong>
              <small>łącznie +{rewardXpTotal}</small>
            </div>
            <div className="hitcoin">
              <span><img src={iconHitcoin} alt="" /> HITCOIN</span>
              <strong>+{gameEndReveal.hitcoinTotal || 0}</strong>
              <small>łącznie +{gameEndReveal.hitcoinTotal || 0}</small>
            </div>
          </div>
          <div className="mgv-gameover-reward-details">
            {gameEndReveal.xpItems.map((item, index) => (
              <div className="mgv-reward-row xp" key={`xp-${index}`}>
                <span className="mgv-reward-row-label">
                  <i className="mgv-reward-row-icon">{rewardTypeIcon(item.label, 'xp')}</i>
                  <span>{item.label}</span>
                </span>
                <strong className="mgv-reward-row-value">+{item.amount} XP</strong>
              </div>
            ))}
            {gameEndReveal.hitcoinItems.map((item, index) => (
              <div className="mgv-reward-row hitcoin" key={`hc-${index}`}>
                <span className="mgv-reward-row-label">
                  <i className="mgv-reward-row-icon">{rewardTypeIcon(item.label, 'hitcoin')}</i>
                  <span>{item.label}</span>
                </span>
                <strong className="mgv-reward-row-value with-hitcoin">
                  +{item.amount} <img src={iconHitcoin} alt="" />
                </strong>
              </div>
            ))}
          </div>
          {gameEndReveal.card ? (
            <div className="mgv-gameover-earned-card">
              <GameOverCollectibleCard song={gameEndReveal.card.song} />
              <div>
                <span className="mgv-eyebrow">{gameEndReveal.card.isDuplicate ? 'DUPLIKAT W KOLEKCJI' : 'NOWA KARTA'}</span>
                <strong>{gameEndReveal.card.song?.artist}</strong>
                <p>{gameEndReveal.card.song?.title}</p>
                <small>{gameEndReveal.card.isDuplicate ? 'Masz już tę kartę w kolekcji.' : 'Karta została dodana do Twojej kolekcji.'}</small>
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
      {playedCards.length > 0 ? (
        <Panel className="mgv-evening-playlist" accent="pink">
          <div className="mgv-playlist-head">
            <div>
              <span className="mgv-eyebrow">MUZYKA Z TEJ GRY</span>
              <h2>PLAYLISTA WIECZORU</h2>
            </div>
            <b>{visiblePlaylist.length} utw.</b>
          </div>
          <div className="mgv-playlist-tabs">
            <button type="button" className={playlistScope === 'all' ? 'active' : ''} onClick={() => setPlaylistScope('all')}>WSZYSCY</button>
            <button type="button" className={playlistScope === 'mine' ? 'active' : ''} onClick={() => setPlaylistScope('mine')}>TYLKO MOJE</button>
          </div>
          <div className="mgv-evening-list">
            {visiblePlaylist.length ? visiblePlaylist.map((card, index) => {
              const owner = room.players.find((player) => player.id === card.playerId);
              const href = card.videoId ? `https://www.youtube.com/watch?v=${card.videoId}` : null;
              const row = (
                <>
                  <span className={`mgv-playlist-result ${card.correct ? 'good' : 'bad'}`}>{card.correct ? <Check size={15} /> : <X size={15} />}</span>
                  <span className="mgv-playlist-copy"><strong>{card.artist} — {card.title}</strong><small>{owner?.name || 'Gracz'}{card.guessedCorrect === true ? ' · tytuł/wykonawca trafiony' : card.guessedCorrect === false ? ' · tytuł/wykonawca nietrafiony' : ''}</small></span>
                  <b>{card.year}</b>
                </>
              );
              return href ? <a key={`${card.videoId}-${index}`} className="mgv-evening-row" href={href} target="_blank" rel="noreferrer">{row}</a> : <div key={`song-${index}`} className="mgv-evening-row">{row}</div>;
            }) : <div className="mgv-empty">Brak utworów do wyświetlenia.</div>}
          </div>
          <p className="mgv-playlist-note">Kliknij utwór, aby otworzyć go w YouTube. ✓ oznacza poprawne umieszczenie na osi.</p>
        </Panel>
      ) : null}
      <div className="mgv-action-stack">{isHost && !room.tournamentMode ? <button type="button" className="mgv-main-cta" onClick={onPlayAgain}><RotateCcw size={19} /> ZAGRAJ PONOWNIE</button> : null}{room.tournamentMode && onTournamentBack ? <button type="button" className="mgv-main-cta" onClick={onTournamentBack}><Trophy size={18} /> WRÓĆ DO TURNIEJU</button> : null}<button type="button" className="mgv-secondary-cta" onClick={onLeave}><LogOut size={18} /> OPUŚĆ POKÓJ</button></div>
      {!room.practiceMode ? <MobileChat open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </MobileSession>
  );
}
