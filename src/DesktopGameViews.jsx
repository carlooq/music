import React, { useEffect, useMemo, useState } from 'react';
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
import heroBanner from './assets/home/hero-banner.webp';
import iconToken from './assets/icons/icon-token.png';
import iconHitcoin from './assets/icons/icon-hitcoin.png';
import glPlaylista from './assets/icons/gl-playlista.png';
import glTrening from './assets/icons/gl-trening.png';
import glZgadnijRok from './assets/icons/gl-zgadnij-rok.png';
import glHitRush from './assets/icons/gl-hitrush.png';
import glKorona from './assets/icons/gl-korona.png';
import glPrezent from './assets/icons/gl-prezent.png';
import glTurniej from './assets/icons/gl-turniej.png';
import { getTournamentUserState, tournamentTimeLeftLabel } from './tournaments.js';
import { WEEKLY_RANKING_REWARDS } from './stats.js';
import { DesktopPlayerProfileModal } from './DesktopShell.jsx';

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
      <div className="dgv-player-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name) : null}</div>
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


function DesktopTournamentPlayer({ player, me, winner, result }) {
  if (!player) return <div className="dgv-tournament-player bye"><span className="dgv-player-avatar">—</span><div><strong>WOLNY LOS</strong><small>automatyczny awans</small></div></div>;
  return (
    <div className={`dgv-tournament-player ${me ? 'me' : ''} ${winner ? 'winner' : ''}`}>
      <div className="dgv-player-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name || player.username) : null}</div>
      <div className="dgv-tournament-player-copy"><strong>{player.name || player.username || 'Gracz'}</strong><small>{me ? 'TY' : winner ? 'ZWYCIĘZCA MECZU' : 'GRACZ'}</small></div>
      {result ? <b className="dgv-tournament-score">{result.score}/10</b> : null}
    </div>
  );
}

export function DesktopTournamentHubView({ tournament, lastCompleted, user, busy, tournamentBusy, notificationPermission, onEnableNotifications, onSignUp, onStartMatch, onHome, onRefresh }) {
  const currentUid = user?.uid;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);
  const signups = tournament?.signups || [];
  const alreadyIn = !!currentUid && signups.some((player) => player.uid === currentUid);
  const status = tournament?.status || 'none';
  const entryFee = Number(tournament?.entryFee || 0);
  const pot = Math.max(0, (signups.length - 1) * entryFee);
  const state = getTournamentUserState(tournament, currentUid, now);
  const notificationReady = notificationPermission === 'granted';
  const winner = tournament?.winnerUid ? signups.find((player) => player.uid === tournament.winnerUid) : null;

  if (!tournament) {
    const previousWinner = lastCompleted?.winnerUid ? (lastCompleted.signups || []).find((player) => player.uid === lastCompleted.winnerUid) : null;
    return (
      <SessionBackground className="dgv-tournament-page">
        <div className="dgv-shell dgv-tournament-shell">
          <SessionHeader eyebrow="TRYB PREMIUM" title="TURNIEJ" onBack={onHome} />
          <section className="dgv-tournament-hero empty">
            <img src={glTurniej} alt="" />
            <div><span>TURNIEJ HITSTERIADY</span><h1>CZEKAJ NA KOLEJNY START</h1><p>Aktualnie nie ma aktywnego turnieju. Gdy pojawi się nowy, zapiszesz się tutaj i rozpoczniesz walkę w drabince.</p></div>
          </section>
          {previousWinner ? <section className="dgv-panel dgv-tournament-last"><Trophy size={28}/><div><span>OSTATNI ZWYCIĘZCA</span><strong>{previousWinner.name || 'Gracz'}</strong></div></section> : null}
          <div className="dgv-tournament-actions"><button className="dgv-primary-button gold" onClick={onRefresh}>ODŚWIEŻ TURNIEJ</button><button className="dgv-ghost-button" onClick={onHome}>STRONA GŁÓWNA</button></div>
        </div>
      </SessionBackground>
    );
  }

  return (
    <SessionBackground className="dgv-tournament-page">
      <div className="dgv-shell dgv-tournament-shell">
        <SessionHeader eyebrow="TRYB PREMIUM" title="TURNIEJ" onBack={onHome} right={<div className="dgv-tournament-entry"><Trophy size={17}/>{entryFee} XP WPISOWEGO</div>} />

        <section className={`dgv-tournament-hero status-${status}`}>
          <img src={glTurniej} alt="" />
          <div className="dgv-tournament-hero-copy">
            <span>{status === 'signup' ? 'TRWAJĄ ZAPISY' : status === 'active' ? 'DRABINKA AKTYWNA' : 'TURNIEJ ZAKOŃCZONY'}</span>
            <h1>{status === 'signup' ? 'WEJDŹ DO GRY' : status === 'active' ? 'WALCZ O FINAŁ' : 'MAMY ZWYCIĘZCĘ'}</h1>
            <p>{status === 'signup' ? 'Zapisz się, zarezerwuj miejsce w drabince i walcz o pulę XP.' : status === 'active' ? 'Każdy mecz to ta sama playlista dla obu zawodników. Wygrywa lepszy wynik, a przy remisie — szybszy czas.' : 'Drabinka została rozstrzygnięta. Zobacz wynik i zwycięzcę.'}</p>
            <div className="dgv-tournament-hero-chips"><span><Users size={16}/>{signups.length}/{tournament.maxPlayers || '—'} graczy</span><span><Zap size={16}/>{pot} XP puli</span><span><Music2 size={16}/>10 ocenianych utworów</span></div>
          </div>
          <div className="dgv-tournament-premium-mark"><Crown size={22}/><strong>PREMIUM</strong><span>BRACKET MODE</span></div>
        </section>

        <section className={`dgv-panel dgv-tournament-my-status ${state.urgent ? 'urgent' : ''}`}>
          <div className="dgv-tournament-status-copy">
            <span>TWÓJ STATUS</span>
            <strong>{status === 'signup' ? (alreadyIn ? 'ZAPISANY · CZEKASZ NA START' : 'MOŻESZ DOŁĄCZYĆ') : state.canPlay ? 'TWÓJ MECZ JEST GOTOWY' : state.waiting ? 'WYNIK ZAPISANY · CZEKASZ' : state.wonMatch ? 'AWANSUJESZ DO KOLEJNEJ RUNDY' : state.eliminated ? 'TWÓJ UDZIAŁ SIĘ ZAKOŃCZYŁ' : 'ŚLEDŹ DRABINKĘ'}</strong>
            <small>{state.opponent ? `Przeciwnik: ${state.opponent.name || 'Gracz'} · Runda ${state.roundNumber || '—'}` : status === 'signup' ? 'Turniej rusza automatycznie po zapełnieniu listy.' : 'Otwórz drabinkę, aby śledzić kolejne mecze.'}</small>
          </div>
          {status === 'active' && state.deadline ? <div className={`dgv-tournament-deadline ${state.urgent ? 'urgent' : ''}`}><Clock3 size={18}/><span>CZAS NA MECZ</span><strong>{tournamentTimeLeftLabel(state.msLeft)}</strong></div> : null}
          <button type="button" className={`dgv-tournament-notify ${notificationReady ? 'enabled' : ''}`} onClick={onEnableNotifications} disabled={notificationPermission === 'unsupported'}>{notificationReady ? <BellRing size={18}/> : <Bell size={18}/>}<span>{notificationPermission === 'unsupported' ? 'POWIADOMIENIA NIEDOSTĘPNE' : notificationPermission === 'denied' ? 'POWIADOMIENIA ZABLOKOWANE' : notificationReady ? 'POWIADOMIENIA WŁĄCZONE' : 'WŁĄCZ POWIADOMIENIA'}</span></button>
        </section>

        {status === 'signup' ? (
          <div className="dgv-tournament-signup-grid">
            <section className="dgv-panel dgv-tournament-roster">
              <div className="dgv-section-heading"><Users size={18}/> LISTA GRACZY <span>{signups.length}/{tournament.maxPlayers || '—'}</span></div>
              <div className="dgv-tournament-player-grid">{signups.length ? signups.map((player)=><DesktopTournamentPlayer key={player.uid} player={player} me={player.uid===currentUid}/>) : <div className="dgv-tournament-empty">Jeszcze nikt się nie zapisał.</div>}</div>
            </section>
            <section className="dgv-panel dgv-tournament-rules">
              <div className="dgv-section-heading"><Shield size={18}/> ZASADY PREMIUM</div>
              <div><Trophy size={20}/><span><strong>WPISOWE</strong><small>{entryFee} XP ryzyka</small></span></div>
              <div><Zap size={20}/><span><strong>PULA</strong><small>Zwycięzca przejmuje XP przegranych</small></span></div>
              <div><Music2 size={20}/><span><strong>MECZ</strong><small>10 utworów, identyczna playlista dla pary</small></span></div>
              {alreadyIn ? <div className="dgv-tournament-ready"><Check size={18}/> JESTEŚ ZAPISANY</div> : <button type="button" className="dgv-primary-button gold" disabled={tournamentBusy} onClick={onSignUp}>{tournamentBusy ? 'ZAPISUJĘ…' : `ZAPISZ SIĘ · ${entryFee} XP`}</button>}
            </section>
          </div>
        ) : null}

        {status === 'active' ? <div className="dgv-tournament-round-list">{(tournament.rounds || []).map((round)=><section key={round.roundNumber} className="dgv-panel dgv-tournament-round"><div className="dgv-section-heading"><Trophy size={18}/>{round.matches?.length===1?'FINAŁ':`RUNDA ${round.roundNumber}`}<span>{round.matches?.length || 0} mecz.</span></div><div className="dgv-tournament-match-grid">{(round.matches||[]).map((match)=>{ const p1=match.player1,p2=match.player2; const mine=!!currentUid&&(p1?.uid===currentUid||p2?.uid===currentUid); const myResult=p1?.uid===currentUid?match.player1Result:match.player2Result; const canPlay=mine&&!match.winnerUid&&!myResult&&!!p2; const waiting=mine&&!!myResult&&!match.winnerUid; return <article key={match.matchId} className={`dgv-tournament-match ${mine?'mine':''} ${match.winnerUid?'done':''}`}><DesktopTournamentPlayer player={p1} me={p1?.uid===currentUid} winner={match.winnerUid===p1?.uid} result={match.player1Result}/><div className="dgv-tournament-vs">VS</div><DesktopTournamentPlayer player={p2} me={p2?.uid===currentUid} winner={match.winnerUid===p2?.uid} result={match.player2Result}/>{canPlay?<button className="dgv-primary-button gold compact" disabled={busy} onClick={()=>onStartMatch(match,round.roundNumber)}><Play size={17} fill="currentColor"/> ZAGRAJ SWÓJ MECZ</button>:null}{waiting?<div className="dgv-tournament-wait"><Clock3 size={16}/>Twój wynik zapisany — czekamy na przeciwnika.</div>:null}{mine&&match.winnerUid?<div className={`dgv-tournament-verdict ${match.winnerUid===currentUid?'good':'bad'}`}>{match.winnerUid===currentUid?'AWANSUJESZ':'KONIEC UDZIAŁU'}</div>:null}</article>; })}</div></section>)}</div> : null}

        {status === 'completed' ? <section className="dgv-panel dgv-tournament-winner"><Trophy size={58}/><span>ZWYCIĘZCA TURNIEJU</span><h1>{winner?.name || 'GRACZ'}</h1><p>{winner?.uid===currentUid?`Wygrywasz turniej i pulę ${pot} XP!`:`Turniej zakończony. Wpisowe wynosiło ${entryFee} XP.`}</p></section> : null}

        {status !== 'completed' ? <div className="dgv-tournament-footer-actions"><button className="dgv-ghost-button" onClick={onRefresh} disabled={tournamentBusy}>ODŚWIEŻ DANE TURNIEJU</button></div> : <div className="dgv-tournament-footer-actions"><button className="dgv-primary-button gold" onClick={onHome}>STRONA GŁÓWNA</button></div>}
      </div>
    </SessionBackground>
  );
}

export function DesktopTournamentMatchResultView({ room, playerId, onTournamentBack, onLeave }) {
  const played=(room.playedCards||[]).filter((card)=>card.playerId===playerId);
  const score=played.filter((card)=>card.correct).length;
  const wrong=Math.max(0,played.length-score);
  const times=room.decisionTimes?.[playerId]||[];
  const avg=times.length?Math.round(times.reduce((sum,value)=>sum+value,0)/times.length/1000):null;
  return <SessionBackground className="dgv-tournament-result-page"><div className="dgv-shell dgv-tournament-result-shell"><SessionHeader eyebrow="TURNIEJ PREMIUM" title="MECZ ZAKOŃCZONY" onBack={onLeave} backLabel="Opuść" right={<div className="dgv-tournament-entry"><Trophy size={17}/>RUNDA {room.tournamentRoundNumber||'—'}</div>}/><section className="dgv-tournament-result-hero"><img src={glTurniej} alt=""/><div><span>TWÓJ WYNIK</span><h1>{score}<em>/10</em></h1><p>Wynik został zapisany do drabinki. Przy remisie o awansie decyduje krótszy łączny czas odpowiedzi.</p></div></section><div className="dgv-tournament-result-metrics"><div><Check size={21}/><span>TRAFIENIA</span><strong>{score}</strong></div><div><X size={21}/><span>POMYŁKI</span><strong>{wrong}</strong></div><div><Clock3 size={21}/><span>ŚR. CZAS</span><strong>{avg!==null?`${avg}s`:'—'}</strong></div><div><Trophy size={21}/><span>RUNDA</span><strong>{room.tournamentRoundNumber||'—'}</strong></div></div><section className="dgv-panel dgv-tournament-result-note"><Trophy size={22}/><div><strong>WRÓĆ DO DRABINKI</strong><span>Jeśli przeciwnik jeszcze nie zagrał, zobaczysz oczekiwanie. Jeśli mecz jest już rozstrzygnięty, zobaczysz od razu awans lub zakończenie udziału.</span></div></section><div className="dgv-tournament-actions"><button className="dgv-primary-button gold" onClick={onTournamentBack}>WRÓĆ DO TURNIEJU</button><button className="dgv-ghost-button" onClick={onLeave}>OPUŚĆ</button></div></div></SessionBackground>;
}

function hitRushDifficultyMeta(key) {
  return {
    easy: { label: 'ŁATWO', className: 'easy' },
    normal: { label: 'NORMALNIE', className: 'normal' },
    hard: { label: 'TRUDNO', className: 'hard' },
    expert: { label: 'EKSPERT', className: 'expert' },
    insane: { label: 'SZALEŃSTWO', className: 'insane' },
  }[key] || { label: 'ŁATWO', className: 'easy' };
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
  return sorted.map((step, index) => `${step.minCombo}${index === sorted.length - 1 ? '+' : ''} trafień = +${step.seconds}s`).join(' · ');
}

function hitRushRankMeta(rank) {
  return {
    bronze: { label: 'BRONZE', className: 'bronze' },
    silver: { label: 'SILVER', className: 'silver' },
    gold: { label: 'GOLD', className: 'gold' },
    platinum: { label: 'PLATINUM', className: 'platinum' },
    diamond: { label: 'DIAMOND', className: 'diamond' },
  }[rank] || { label: 'BEZ RANGI', className: 'none' };
}

function DesktopHitRushHowTo({ onClose, bonusEvery = 5, bonusSchedule = [], wrongPenalty = 2 }) {
  const bonusSummary = hitRushBonusSummary(bonusSchedule);
  return (
    <div className="dgv-hr-help-backdrop" role="dialog" aria-modal="true" aria-label="Jak grać w Hit Rush" onClick={onClose}>
      <div className="dgv-hr-help" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="dgv-hr-help-close" onClick={onClose}><X size={20} /></button>
        <div className="dgv-eyebrow">SZYBKI TRYB SOLO</div>
        <h2>JAK GRAĆ W <span>HIT RUSH?</span></h2>
        <p className="lead">Masz 60 sekund. Przy każdym utworze decydujesz tylko, czy został wydany wcześniej czy później od aktualnej karty referencyjnej.</p>
        <div className="dgv-hr-help-grid">
          <div><strong>01</strong><span>POSŁUCHAJ</span><p>Fragment nowego utworu odtwarza się automatycznie. Możesz uruchomić go ponownie.</p></div>
          <div><strong>02</strong><span>PORÓWNAJ</span><p>Spójrz na rok karty referencyjnej i wybierz WCZEŚNIEJ albo PÓŹNIEJ.</p></div>
          <div><strong>03</strong><span>BUDUJ COMBO</span><p>Seria trafień zwiększa mnożnik punktów i stopniowo zmniejsza różnicę lat między utworami.</p></div>
          <div><strong>04</strong><span>WALCZ O CZAS</span><p>{bonusSummary || `Bonus co ${bonusEvery} trafień`}. Błąd kosztuje −{wrongPenalty}s.</p></div>
        </div>
        <div className="dgv-hr-help-note"><Zap size={18} /> Mnożniki punktów zostają bez zmian. Zegar czeka, gdy fragment jeszcze się uruchamia i podczas krótkiego wyniku odpowiedzi.</div>
        <button type="button" className="dgv-start-button dgv-hr-help-done" onClick={onClose}>WSZYSTKO JASNE <ChevronRight size={20} /></button>
      </div>
    </div>
  );
}

export function DesktopHitRushMenuView({ stats, onStart, onLeaderboard, onHome, bonusEvery = 5, bonusSchedule = [], wrongPenalty = 2 }) {
  const [showHelp, setShowHelp] = useState(false);
  const bonusSummary = hitRushBonusSummary(bonusSchedule);
  const bestScore = Number(stats?.hitRushBestScore || 0);
  const bestCombo = Number(stats?.hitRushBestCombo || 0);
  const totalRuns = Number(stats?.hitRushRunsTotal || 0);

  return (
    <SessionBackground className="dgv-hr-page dgv-hr-menu-page">
      <div className="dgv-shell">
        <SessionHeader
          eyebrow="TRYB SOLO NA CZAS"
          title="HIT RUSH"
          onBack={onHome}
          backLabel="Strona główna"
          right={<div className="dgv-status-pill dgv-hr-status"><Zap size={16} /> 60 SEKUND</div>}
        />

        <section className="dgv-panel dgv-hr-menu-hero">
          <div className="dgv-hr-menu-copy">
            <div className="dgv-hr-brandline"><img src={glHitRush} alt="" /><span>REFLEKS · WIEDZA · COMBO</span></div>
            <div className="dgv-eyebrow">JEDNA DECYZJA. CORAZ MNIEJ CZASU.</div>
            <h1>WCZEŚNIEJ<br /><span>CZY PÓŹNIEJ?</span></h1>
            <p>Porównuj kolejne utwory z kartą referencyjną. Każde trafienie buduje combo, zwiększa wynik i podnosi poziom trudności.</p>
            <div className="dgv-hr-menu-actions">
              <button type="button" className="dgv-start-button dgv-hr-start" onClick={onStart}><Zap size={22} fill="currentColor" /> START HIT RUSH <ChevronRight size={22} /></button>
              <button type="button" className="dgv-ghost-button large" onClick={() => setShowHelp(true)}><Sparkles size={18} /> JAK GRAĆ?</button>
            </div>
          </div>

          <div className="dgv-hr-demo" aria-hidden="true">
            <div className="dgv-hr-demo-card reference">
              <span>KARTA REFERENCYJNA</span><strong>1998</strong><small>Massive Attack</small>
            </div>
            <div className="dgv-hr-demo-center"><Zap size={38} fill="currentColor" /><span>VS</span></div>
            <div className="dgv-hr-demo-card mystery">
              <span>NOWY UTWÓR</span><strong>?</strong><small>WCZEŚNIEJ / PÓŹNIEJ</small>
            </div>
            <div className="dgv-hr-demo-arrows"><span>← WCZEŚNIEJ</span><span>PÓŹNIEJ →</span></div>
          </div>
        </section>

        <section className="dgv-panel dgv-hr-weekly-prizes dgv-hr-menu-prizes">
          {WEEKLY_RANKING_REWARDS.map((reward) => (
            <div key={reward.place}>
              <span>{reward.place === 1 ? '🥇' : reward.place === 2 ? '🥈' : '🥉'} {reward.place}. MIEJSCE · TYDZIEŃ</span>
              <strong>+{reward.xp} XP</strong>
              <b className="dgv-weekly-hitcoin">+{reward.hitcoin} <img src={iconHitcoin} alt="HITCOIN" /></b>
            </div>
          ))}
          <p>TOP 3 tygodnia zdobywa XP + HITCOIN. Po zamknięciu rankingu nagrodę odbierasz ręcznie.</p>
        </section>

        <div className="dgv-hr-menu-bottom">
          <section className="dgv-panel dgv-hr-records">
            <div className="dgv-section-heading"><Trophy size={18} /> TWOJE REKORDY</div>
            <div className="dgv-hr-record-grid">
              <div><span>NAJLEPSZY WYNIK</span><strong>{bestScore.toLocaleString('pl-PL')}</strong><small>PKT</small></div>
              <div><span>NAJLEPSZE COMBO</span><strong>{bestCombo}</strong><small>TRAFIEŃ</small></div>
              <div><span>ROZEGRANE RUNY</span><strong>{totalRuns}</strong><small>ŁĄCZNIE</small></div>
            </div>
          </section>

          <section className="dgv-panel dgv-hr-rules-card">
            <div className="dgv-section-heading"><Flame size={18} /> CO NAPĘDZA WYNIK?</div>
            <div className="dgv-hr-rule"><span>COMBO</span><strong>większy mnożnik punktów</strong></div>
            <div className="dgv-hr-rule"><span>BONUSY CZASU</span><strong>{bonusSummary || `co ${bonusEvery} trafień`}</strong></div>
            <div className="dgv-hr-rule"><span>BŁĄD</span><strong>−{wrongPenalty}s + reset combo</strong></div>
            <div className="dgv-hr-rule"><span>TRUDNOŚĆ</span><strong>coraz bliższe lata</strong></div>
            <button type="button" className="dgv-hr-ranking-button" onClick={onLeaderboard}><Trophy size={18} /> RANKING HIT RUSH <ChevronRight size={18} /></button>
          </section>
        </div>
      </div>
      {showHelp ? <DesktopHitRushHowTo onClose={() => setShowHelp(false)} bonusEvery={bonusEvery} bonusSchedule={bonusSchedule} wrongPenalty={wrongPenalty} /> : null}
    </SessionBackground>
  );
}

export function DesktopHitRushGameView({ hitRush, iframeRef, onReplay, onAnswer, onExit, roundSeconds = 60, bonusEvery = 5, bonusSchedule = [], wrongPenalty = 2, difficulty = 'easy' }) {
  if (!hitRush?.referenceCard || !hitRush?.currentCard) return null;
  const feedback = hitRush.feedback;
  const difficultyMeta = hitRushDifficultyMeta(difficulty);
  const nextBonus = hitRushNextBonusMeta(hitRush.combo, bonusEvery, bonusSchedule);
  const currentComboProgress = bonusEvery > 0 ? hitRush.combo % bonusEvery : 0;
  const untilBonus = nextBonus.remaining;
  const bonusProgress = bonusEvery > 0 ? (currentComboProgress / bonusEvery) * 100 : 0;
  const answerLocked = !hitRush.answerReady || !!feedback;
  const timeProgress = Math.max(0, Math.min(100, (Number(hitRush.timeLeft || 0) / roundSeconds) * 100));
  const answeredCount = Number(hitRush.correct || 0) + Number(hitRush.wrong || 0);

  return (
    <SessionBackground className="dgv-hr-page dgv-hr-game-page">
      <div className="dgv-shell dgv-hr-game-shell">
        <SessionHeader
          eyebrow={`RUN · PYTANIE ${answeredCount + 1}`}
          title="HIT RUSH"
          onBack={onExit}
          backLabel="Zakończ run"
          right={<div className={`dgv-timer dgv-hr-timer ${hitRush.timeLeft <= 10 ? 'danger' : ''}`}><Clock3 size={18} /><strong>{hitRush.timeLeft}s</strong></div>}
        />

        <div className="dgv-hr-timebar"><span style={{ width: `${timeProgress}%` }} /></div>

        <div className="dgv-hr-live-grid">
          <main className="dgv-panel dgv-hr-live-main">
            <div className="dgv-hr-question-head">
              <div><div className="dgv-eyebrow">PORÓWNAJ Z KARTĄ REFERENCYJNĄ</div><h1>CZY TEN UTWÓR JEST...</h1></div>
              <span className={`dgv-hr-difficulty ${difficultyMeta.className}`}>{difficultyMeta.label}</span>
            </div>

            <div className={`dgv-hr-versus ${feedback ? (feedback.correct ? 'correct' : 'wrong') : ''}`}>
              <article className="dgv-hr-live-card reference">
                <div className="dgv-hr-card-label"><Disc3 size={16} /> KARTA REFERENCYJNA</div>
                <div className="dgv-hr-card-year">{hitRush.referenceCard.year}</div>
                <h2>{hitRush.referenceCard.title}</h2>
                <p>{hitRush.referenceCard.artist}</p>
              </article>

              <div className="dgv-hr-vs-mark"><Zap size={30} fill="currentColor" /><span>VS</span></div>

              <article className={`dgv-hr-live-card current ${feedback ? 'revealed' : ''}`}>
                <div className="dgv-hr-card-label"><Headphones size={16} /> AKTUALNY UTWÓR</div>
                {feedback ? (
                  <>
                    <div className="dgv-hr-card-year">{feedback.year}</div>
                    <h2>{hitRush.currentCard.title}</h2>
                    <p>{hitRush.currentCard.artist}</p>
                  </>
                ) : (
                  <div className="dgv-hr-mystery">
                    <div className="dgv-hr-wave">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ '--h': `${25 + ((i * 23) % 70)}%` }} />)}</div>
                    <strong>?</strong>
                    <span>POSŁUCHAJ I ZDECYDUJ</span>
                  </div>
                )}
                <button type="button" className="dgv-hr-replay" onClick={onReplay}><Play size={17} fill="currentColor" /> ODTWÓRZ FRAGMENT</button>
              </article>
            </div>

            <div className="dgv-hidden-player">
              <iframe
                key={hitRush.currentCard.videoId}
                ref={iframeRef}
                title="hitrush-audio-desktop"
                src={`https://www.youtube.com/embed/${hitRush.currentCard.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${hitRush.currentStartSeconds}&controls=0&modestbranding=1&rel=0&playsinline=1`}
                allow="autoplay; encrypted-media"
                onLoad={onReplay}
              />
            </div>

            <div className="dgv-hr-choice-row">
              <button type="button" className="earlier" disabled={answerLocked} onClick={() => onAnswer('earlier')}><ArrowLeft size={25} /> <div><span>WYBIERAM</span><strong>WCZEŚNIEJ</strong></div></button>
              <button type="button" className="later" disabled={answerLocked} onClick={() => onAnswer('later')}><div><span>WYBIERAM</span><strong>PÓŹNIEJ</strong></div><ChevronRight size={28} /></button>
            </div>

            <div className={`dgv-hr-feedback ${feedback ? (feedback.correct ? 'good' : 'bad') : 'idle'}`}>
              {feedback ? (
                <>
                  <span className="icon">{feedback.correct ? <Check size={23} /> : <X size={23} />}</span>
                  <div><strong>{feedback.correct ? 'DOBRZE!' : 'NIE TYM RAZEM'}</strong><small>{feedback.correct ? `+${feedback.points} pkt${feedback.timeBonus ? ` · +${feedback.timeBonus}s` : ''}` : `Poprawny rok: ${feedback.year} · −${feedback.timePenalty || wrongPenalty}s · combo od zera`}</small></div>
                </>
              ) : hitRush.answerReady ? (
                <><Sparkles size={18} /><span>Wybierz wcześniej lub później. Odpowiedź zobaczysz od razu.</span></>
              ) : (
                <><Headphones size={18} /><span>Uruchamiam fragment… zegar czeka, a odpowiedzi odblokują się po krótkim odsłuchu.</span></>
              )}
            </div>
          </main>

          <aside className="dgv-hr-side">
            <section className="dgv-panel dgv-hr-score-card">
              <div className="dgv-eyebrow">AKTUALNY WYNIK</div>
              <strong>{Number(hitRush.score || 0).toLocaleString('pl-PL')}</strong>
              <span>PKT</span>
              <div className="dgv-hr-mini-stats"><div className="good"><Check size={16} /><b>{hitRush.correct}</b><small>trafień</small></div><div className="bad"><X size={16} /><b>{hitRush.wrong}</b><small>błędów</small></div></div>
            </section>

            <section className="dgv-panel dgv-hr-combo-card">
              <div className="dgv-section-heading"><Flame size={18} /> COMBO</div>
              <div className="dgv-hr-combo-value">{hitRush.combo}<span>x</span></div>
              <div className="dgv-hr-combo-track"><span style={{ width: `${bonusProgress}%` }} /></div>
              <p>Jeszcze {untilBonus} {untilBonus === 1 ? 'trafienie' : 'trafień'} do +{nextBonus.seconds}s (combo {nextBonus.combo})</p>
              <div className="dgv-hr-best-combo"><span>NAJLEPSZE W TYM RUNIE</span><strong>{hitRush.bestCombo}</strong></div>
            </section>

            <section className={`dgv-panel dgv-hr-difficulty-card ${difficultyMeta.className}`}>
              <div className="dgv-eyebrow">POZIOM TRUDNOŚCI</div>
              <strong>{difficultyMeta.label}</strong>
              <p>Im dłuższe combo, tym mniejsza różnica lat między porównywanymi utworami.</p>
            </section>
          </aside>
        </div>
      </div>
    </SessionBackground>
  );
}

export function DesktopHitRushResultView({ result, onAgain, onLeaderboard, onHome }) {
  if (!result) return null;
  const rankMeta = hitRushRankMeta(result.rank);
  const difficultyMeta = hitRushDifficultyMeta(result.maxDifficulty);
  const total = Number(result.correct || 0) + Number(result.wrong || 0);
  const accuracy = total ? Math.round((Number(result.correct || 0) / total) * 100) : 0;

  return (
    <SessionBackground className="dgv-hr-page dgv-hr-result-page">
      <div className="dgv-shell">
        <SessionHeader eyebrow="RUN ZAKOŃCZONY" title="HIT RUSH" onBack={onHome} backLabel="Strona główna" />
        <section className="dgv-panel dgv-hr-result-hero">
          <div className="dgv-hr-result-icon"><img src={glHitRush} alt="" /></div>
          <div className="dgv-hr-result-score">
            <div className="dgv-eyebrow">TWÓJ WYNIK</div>
            <strong>{Number(result.score || 0).toLocaleString('pl-PL')}</strong><span>PKT</span>
            {result.isNewBest ? <div className="dgv-hr-new-best"><Trophy size={18} /> NOWY REKORD!</div> : null}
          </div>
          <div className={`dgv-hr-rank ${rankMeta.className}`}><span>RANGA RUNU</span><strong>{rankMeta.label}</strong><small>{difficultyMeta.label} · maks. trudność</small></div>
        </section>

        <div className="dgv-hr-result-grid">
          <section className="dgv-panel dgv-hr-result-stats">
            <div className="dgv-section-heading"><Zap size={18} /> PODSUMOWANIE</div>
            <div className="dgv-hr-result-metrics">
              <div className="good"><Check size={20} /><strong>{result.correct || 0}</strong><span>TRAFIENIA</span></div>
              <div className="bad"><X size={20} /><strong>{result.wrong || 0}</strong><span>POMYŁKI</span></div>
              <div><Flame size={20} /><strong>{result.bestCombo || 0}</strong><span>BEST COMBO</span></div>
              <div><Trophy size={20} /><strong>{accuracy}%</strong><span>SKUTECZNOŚĆ</span></div>
            </div>
          </section>

          <section className="dgv-panel dgv-hr-result-rewards">
            <div className="dgv-section-heading"><Gift size={18} /> NAGRODY ZA RUN</div>
            {result.pending ? <div className="dgv-hr-save-state">Zapisuję wynik…</div> : result.saveError ? <div className="dgv-hr-save-state bad">Nie udało się zapisać wyniku.</div> : result.guestNoSave ? <div className="dgv-hr-save-state">Zaloguj się, aby zapisywać wyniki i nagrody.</div> : (
              <div className="dgv-hr-reward-row">
                <div><span>XP</span><strong>+{result.xpGain || 0}</strong></div>
                <div><span>HITCOIN</span><strong>+{result.hitcoinGain || 0}</strong></div>
              </div>
            )}
            <p>Najlepszy wynik trafia do rankingu. Ranking tygodniowy nagradza trzy pierwsze miejsca.</p>
          </section>
        </div>

        <div className="dgv-hr-result-actions">
          <button type="button" className="dgv-start-button dgv-hr-start" onClick={onAgain}><RotateCcw size={21} /> ZAGRAJ PONOWNIE</button>
          <button type="button" className="dgv-hr-ranking-button large" onClick={onLeaderboard}><Trophy size={19} /> ZOBACZ RANKING</button>
          <button type="button" className="dgv-ghost-button large" onClick={onHome}><ArrowLeft size={18} /> STRONA GŁÓWNA</button>
        </div>
      </div>
    </SessionBackground>
  );
}

export function DesktopHitRushLeaderboardView({ rows = [], period, onPeriod, onBack, onHome, onViewProfile, viewingPlayer, onCloseProfile, levelFromXp }) {
  const periodLabels = { daily: 'DZIENNY', weekly: 'TYGODNIOWY', alltime: 'WSZECH CZASÓW' };
  const loading = rows === null;
  const safeRows = Array.isArray(rows) ? rows : [];
  const podium = safeRows.slice(0, 3);
  const rest = safeRows.slice(3);
  return (
    <SessionBackground className="dgv-hr-page dgv-hr-leaderboard-page">
      <div className="dgv-shell">
        <SessionHeader eyebrow="NAJLEPSI GRACZE" title="RANKING HIT RUSH" onBack={onBack} backLabel="Hit Rush" right={<button type="button" className="dgv-ghost-button" onClick={onHome}>STRONA GŁÓWNA</button>} />

        <section className="dgv-panel dgv-hr-leaderboard-head">
          <div><div className="dgv-eyebrow">RYWALIZACJA SOLO</div><h1>WALCZ O <span>NAJWYŻSZY WYNIK.</span></h1><p>Do rankingu trafia najlepszy wynik w wybranym okresie. TOP 3 tygodnia zdobywa XP i HITCOIN do ręcznego odebrania.</p></div>
          <div className="dgv-hr-period-tabs">{Object.entries(periodLabels).map(([key, label]) => <button type="button" key={key} className={period === key ? 'active' : ''} onClick={() => onPeriod(key)}>{label}</button>)}</div>
        </section>

        <section className="dgv-panel dgv-hr-weekly-prizes">
          {WEEKLY_RANKING_REWARDS.map((reward) => (
            <div key={reward.place}>
              <span>{reward.place === 1 ? '🥇' : reward.place === 2 ? '🥈' : '🥉'} {reward.place}. MIEJSCE</span>
              <strong>+{reward.xp} XP</strong>
              <b className="dgv-weekly-hitcoin">+{reward.hitcoin} <img src={iconHitcoin} alt="HITCOIN" /></b>
            </div>
          ))}
          <p>Nagrody dotyczą rankingu tygodniowego i po jego zakończeniu czekają na ręczne odebranie.</p>
        </section>

        {loading ? <section className="dgv-panel dgv-hr-leaderboard-empty">Ładowanie rankingu…</section> : safeRows.length === 0 ? <section className="dgv-panel dgv-hr-leaderboard-empty">Brak jeszcze wyników w tym okresie.</section> : (
          <>
            <div className="dgv-hr-podium">
              {podium.map((entry, index) => (
                <button type="button" key={entry.uid || index} className={`dgv-panel place-${index + 1}`} onClick={() => entry.uid && onViewProfile?.(entry)}>
                  <span className="place">#{index + 1}</span>
                  <span className="avatar" style={entry.avatarUrl ? { backgroundImage: `url(${entry.avatarUrl})` } : undefined}>{!entry.avatarUrl ? initials(entry.username || entry.name) : null}</span>
                  <strong>{entry.username || entry.name || 'Gracz'}</strong>
                  <b>{Number(entry.score || 0).toLocaleString('pl-PL')} <small>PKT</small></b>
                </button>
              ))}
            </div>
            {rest.length ? <section className="dgv-panel dgv-hr-ranking-list"><div className="dgv-section-heading"><Trophy size={18} /> {periodLabels[period]}</div>{rest.map((entry, index) => <button type="button" key={entry.uid || index} onClick={() => entry.uid && onViewProfile?.(entry)}><span className="place">#{index + 4}</span><span className="avatar" style={entry.avatarUrl ? { backgroundImage: `url(${entry.avatarUrl})` } : undefined}>{!entry.avatarUrl ? initials(entry.username || entry.name) : null}</span><span className="name">{entry.username || entry.name || 'Gracz'}</span><strong>{Number(entry.score || 0).toLocaleString('pl-PL')} pkt</strong></button>)}</section> : null}
          </>
        )}
      </div>
      <DesktopPlayerProfileModal profile={viewingPlayer} onClose={onCloseProfile} levelFromXp={levelFromXp} />
    </SessionBackground>
  );
}


export function DesktopPracticeSetupView({
  practiceTarget,
  setPracticeTarget,
  practiceVariant = 'classic',
  setPracticeVariant,
  practiceFilterMode = 'categories',
  setPracticeFilterMode,
  selectedPracticeDecades = ['wszystkie'],
  onTogglePracticeDecade,
  selectedCategories,
  categories,
  onToggleCategory,
  songPool,
  busy,
  onStart,
  onHome,
}) {
  const normalized = (values) => (values || []).map((v) => String(v || '').trim().toLowerCase());
  const nonReligiousPool = songPool.filter((song) => !normalized(song.categories).includes('religijne'));
  const categoryFilterActive = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const decadeFilterActive = !selectedPracticeDecades.includes('wszystkie') && selectedPracticeDecades.length > 0;
  const playableCount = practiceFilterMode === 'decades'
    ? (decadeFilterActive ? nonReligiousPool.filter((song) => practiceDecadeMatch(song, selectedPracticeDecades)).length : nonReligiousPool.length)
    : (categoryFilterActive ? songPool.filter((song) => normalized(song.categories).some((c) => selectedCategories.includes(c))).length : nonReligiousPool.length);
  const decadeCounts = Object.fromEntries(PRACTICE_DECADES.map((decade) => [decade.key, nonReligiousPool.filter((song) => practiceDecadeMatch(song, [decade.key])).length]));
  const target = Number(practiceTarget || 15);
  const yearGuess = practiceVariant === 'yearGuess';
  const required = yearGuess ? target : target + 7;
  const selectionLabel = practiceFilterMode === 'decades'
    ? (decadeFilterActive ? selectedPracticeDecades.map((key) => PRACTICE_DECADES.find((d) => d.key === key)?.label).filter(Boolean).join(' + ') : 'Wszystkie dekady')
    : (categoryFilterActive ? selectedCategories.map((key) => categories.find((c) => c.slug === key)?.label || key).join(' + ') : 'Wszystkie kategorie');

  return (
    <SessionBackground className="dgv-practice-setup">
      <div className="dgv-shell">
        <SessionHeader eyebrow="TRYB SOLO" title="TRENING" onBack={onHome} backLabel="Strona główna" />

        <section className={`dgv-practice-hero dgv-panel ${yearGuess ? 'year-guess' : ''}`}>
          <div className="dgv-practice-hero-copy">
            <img src={yearGuess ? glZgadnijRok : glTrening} alt="" />
            <div>
              <div className="dgv-eyebrow">TRENING BEZ PRESJI · BEZ RANKINGU</div>
              <h1>{yearGuess ? <>ZGADUJ ROK.<br /><span>ĆWICZ PAMIĘĆ.</span></> : <>ĆWICZ OŚ CZASU.<br /><span>BIJ WŁASNY WYNIK.</span></>}</h1>
              <p>{yearGuess ? 'Grasz solo. Wpisujesz rok wydania, od razu widzisz prawidłową odpowiedź i przechodzisz dalej. Wyniki treningu nie trafiają do rankingu Zgadnij Rok.' : 'Grasz solo. Słuchasz utworu, wybierasz jego miejsce na osi czasu i od razu przechodzisz do kolejnej karty.'}</p>
            </div>
          </div>
          <div className="dgv-practice-hero-stats">
            <div><strong>{playableCount}</strong><span>utworów w puli</span></div>
            <div><strong>{target}</strong><span>{yearGuess ? 'rund treningu' : 'kart do zebrania'}</span></div>
          </div>
        </section>

        <section className="dgv-panel dgv-practice-control-panel">
          <div className="dgv-practice-control-group">
            <div className="dgv-section-heading"><Gamepad2 size={19} /> 1. TRYB TRENINGU</div>
            <div className="dgv-practice-mode-switch">
              <button type="button" className={practiceVariant === 'classic' ? 'active' : ''} onClick={() => setPracticeVariant?.('classic')}><Disc3 size={20} /><span><strong>KLASYCZNY</strong><small>Układanie na osi czasu</small></span></button>
              <button type="button" className={practiceVariant === 'yearGuess' ? 'active' : ''} onClick={() => setPracticeVariant?.('yearGuess')}><CalendarDays size={20} /><span><strong>ZGADNIJ ROK</strong><small>Typowanie roku wydania</small></span></button>
            </div>
          </div>
          <div className="dgv-practice-control-group">
            <div className="dgv-section-heading"><Music2 size={19} /> 2. WYBIERZ UTWORY</div>
            <div className="dgv-practice-filter-switch">
              <button type="button" className={practiceFilterMode === 'categories' ? 'active' : ''} onClick={() => setPracticeFilterMode?.('categories')}><Music2 size={18} /> KATEGORIE</button>
              <button type="button" className={practiceFilterMode === 'decades' ? 'active' : ''} onClick={() => setPracticeFilterMode?.('decades')}><CalendarDays size={18} /> DEKADY</button>
            </div>
          </div>
        </section>

        <div className="dgv-practice-grid">
          <section className="dgv-panel dgv-practice-target-panel">
            <div className="dgv-section-heading"><Target size={19} /> {yearGuess ? 'LICZBA UTWORÓW' : 'CEL TRENINGU'}</div>
            <p className="dgv-practice-lead">{yearGuess ? 'Ile utworów chcesz rozpoznać w jednej sesji?' : 'Ile poprawnie ułożonych kart chcesz zebrać, aby zakończyć sesję?'}</p>
            <div className="dgv-practice-target-value">{target}</div>
            <div className="dgv-practice-presets">{[10, 15, 20, 30].map((value) => <button type="button" key={value} className={target === value ? 'active' : ''} onClick={() => setPracticeTarget(value)}>{value}</button>)}</div>
            <div className="dgv-stepper large">
              <button type="button" onClick={() => setPracticeTarget(Math.max(1, target - 1))}>−</button>
              <input autoComplete="off" type="number" min="1" value={practiceTarget} onChange={(e) => setPracticeTarget(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
              <button type="button" onClick={() => setPracticeTarget(target + 1)}>+</button>
            </div>
            <div className="dgv-practice-tip"><Sparkles size={16} /> {yearGuess ? 'Po każdej odpowiedzi wynik rundy zostaje na ekranie około 4 sekundy. Trening nie nalicza XP, HITCOIN ani rankingu.' : 'Na start polecam 10–15 kart. Dłuższy trening daje większą oś czasu i trudniejsze decyzje.'}</div>
          </section>

          <section className="dgv-panel dgv-practice-categories-panel">
            <div className="dgv-section-heading">{practiceFilterMode === 'decades' ? <CalendarDays size={19} /> : <Music2 size={19} />} {practiceFilterMode === 'decades' ? 'DEKADY' : 'KATEGORIE'}</div>
            <p className="dgv-practice-lead">{practiceFilterMode === 'decades' ? 'Możesz połączyć kilka dekad. „Wszystkie” obejmuje cały repertuar treningowy poza kategorią Religijne.' : 'Wybierz repertuar. „Wszystkie” pomija kategorię Religijne — możesz ją włączyć ręcznie.'}</p>
            {practiceFilterMode === 'categories' ? (
              <div className="dgv-category-grid practice">
                {[{ slug: 'wszystkie', label: 'Wszystkie' }, ...categories].map((category) => {
                  const active = selectedCategories.includes(category.slug);
                  return <button type="button" key={category.slug} className={active ? 'active' : ''} onClick={() => onToggleCategory(category.slug)}>{category.label}</button>;
                })}
              </div>
            ) : (
              <div className="dgv-practice-decade-grid">
                <button type="button" className={selectedPracticeDecades.includes('wszystkie') ? 'active' : ''} onClick={() => onTogglePracticeDecade?.('wszystkie')}><strong>WSZYSTKIE</strong><span>{nonReligiousPool.length} utworów</span></button>
                {PRACTICE_DECADES.map((decade) => <button type="button" key={decade.key} className={selectedPracticeDecades.includes(decade.key) ? 'active' : ''} onClick={() => onTogglePracticeDecade?.(decade.key)}><strong>{decade.label}</strong><span>{decadeCounts[decade.key]} utworów</span></button>)}
              </div>
            )}
            <div className="dgv-library-info"><Music2 size={17} /> Do treningu pasuje teraz <strong>{playableCount}</strong> utworów.</div>
          </section>
        </div>

        <section className="dgv-practice-startbar dgv-panel">
          <div><span className="dgv-eyebrow">GOTOWY?</span><strong>{yearGuess ? 'Zgadnij Rok' : 'Klasyczny'} · {selectionLabel} · {target} utworów</strong></div>
          <button type="button" className="dgv-start-button practice" disabled={busy || !practiceTarget || playableCount < required} onClick={onStart}>
            <Play size={22} fill="currentColor" /> {yearGuess ? 'ROZPOCZNIJ ZGADNIJ ROK' : 'ROZPOCZNIJ TRENING'} <ChevronRight size={22} />
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
  onStartYearGuess,
  onKick,
  playerLevels,
  levelFromXp,
  onlinePlayers = [],
  roomInviteSentTo = {},
  roomInviteBusyUid = null,
  onInviteToRoom,
}) {
  const activeFilter = !selectedCategories.includes('wszystkie') && selectedCategories.length > 0;
  const normalized = (values) => (values || []).map((v) => String(v || '').trim().toLowerCase());
  const playableCount = activeFilter
    ? songPool.filter((song) => normalized(song.categories).some((c) => selectedCategories.includes(c))).length
    : songPool.filter((song) => !normalized(song.categories).includes('religijne')).length;
  const roomUids = new Set((room.players || []).map((player) => player.uid).filter(Boolean));
  const myUid = (room.players || []).find((player) => player.id === playerId)?.uid || null;
  const inviteCandidates = [...new Map(
    (onlinePlayers || [])
      .filter((player) => player.uid && !player.roomId && player.uid !== myUid && !roomUids.has(player.uid))
      .map((player) => [player.uid, player])
  ).values()];

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
              <p>{isHost ? (room.yearGuessMode ? 'Wybierz kategorie i rozpocznij 15-rundowe Zgadnij Rok.' : 'Wybierz liczbę kart i kategorie, a następnie rozpocznij rozgrywkę.') : `Host: ${room.players.find((p) => p.id === room.hostId)?.name || 'Gracz'}`}</p>
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
            {isHost ? (
              <div className="dgv-online-invite-block">
                <div className="dgv-online-invite-title"><UserPlus size={16} /> ZAPROŚ ONLINE <span>{inviteCandidates.length}</span></div>
                {inviteCandidates.length ? (
                  <div className="dgv-online-invite-list">
                    {inviteCandidates.map((player) => {
                      const sent = !!roomInviteSentTo[player.uid];
                      const loading = roomInviteBusyUid === player.uid;
                      return (
                        <div className="dgv-online-invite-row" key={player.playerId || player.uid}>
                          <div className="dgv-online-invite-avatar" style={player.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player.avatarUrl ? initials(player.name || player.username) : null}</div>
                          <div><strong>{player.name || player.username || 'Gracz'}</strong><span>● online</span></div>
                          <button type="button" disabled={sent || loading} onClick={() => onInviteToRoom?.(player)}>{loading ? '...' : sent ? 'WYSŁANO' : 'ZAPROŚ'}</button>
                        </div>
                      );
                    })}
                  </div>
                ) : <div className="dgv-online-invite-empty">Brak wolnych zalogowanych graczy online.</div>}
              </div>
            ) : null}
          </section>

          <section className="dgv-panel dgv-settings-panel">
            <div className="dgv-section-heading"><Gamepad2 size={19} /> ZASADY GRY</div>
            {isHost ? (
              <>
                {room.yearGuessMode ? (
                  <div className="dgv-setting-row dgv-yearguess-lobby-mode">
                    <div>
                      <div className="dgv-setting-label">ZGADNIJ ROK</div>
                      <div className="dgv-setting-desc">15 rund. Wszyscy słuchają tego samego utworu i jednocześnie typują rok wydania.</div>
                    </div>
                    <div className="dgv-yearguess-lobby-badge"><CalendarDays size={18} /><strong>15</strong><span>RUND</span></div>
                  </div>
                ) : (
                  <div className="dgv-setting-row">
                    <div>
                      <div className="dgv-setting-label">KART DO WYGRANIA</div>
                      <div className="dgv-setting-desc">Pierwszy gracz, który osiągnie ten wynik, wygrywa.</div>
                    </div>
                    <div className="dgv-stepper">
                      <button type="button" onClick={() => setTarget(Math.max(1, Number(target || 1) - 1))}>−</button>
                      <input autoComplete="off" type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value === '' ? '' : parseInt(e.target.value, 10))} />
                      <button type="button" onClick={() => setTarget(Number(target || 0) + 1)}>+</button>
                    </div>
                  </div>
                )}

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
                {room.yearGuessMode ? (
                  <button type="button" className="dgv-start-button dgv-yearguess-lobby-start" disabled={busy || room.players.length < 2} onClick={onStartYearGuess}>
                    <Play size={22} fill="currentColor" /> ROZPOCZNIJ ZGADNIJ ROK <ChevronRight size={22} />
                  </button>
                ) : (
                  <button type="button" className="dgv-start-button" disabled={busy || !target || room.players.length < 2} onClick={onStart}>
                    <Play size={22} fill="currentColor" /> ROZPOCZNIJ GRĘ <ChevronRight size={22} />
                  </button>
                )}
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
        <input autoComplete="off" value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} placeholder="Wykonawca" />
        <input autoComplete="off" value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} placeholder="Tytuł" />
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
            {!room.practiceMode && !room.dailyPlaylistMode && result.tokenAwarded !== undefined ? (
              <div className={`dgv-result-v3-check ${result.tokenAwarded ? 'good' : 'bad'}`}>
                <div className="icon">{result.tokenAwarded ? <Check size={24} /> : <X size={24} />}</div>
                <div><span>TYTUŁ I WYKONAWCA</span><strong>{result.tokenAwarded ? '+1 TOKEN' : 'BRAK TOKENA'}</strong></div>
              </div>
            ) : null}
            <div className="dgv-result-v3-hint">
              <Sparkles size={17} />
              <span>{placementGood ? 'Dobra robota — utrzymaj serię w następnej rundzie.' : `Zapamiętaj: ${result.card.artist} — ${result.card.title} (${result.card.year}).`}</span>
            </div>
          </section>
        </div>

        <div className="dgv-result-v3-countdown">
          <div className="dgv-result-v3-countdown-label">
            <Clock3 size={19} />
            <span>{room.tournamentMode ? 'KOLEJNY UTWÓR MECZU ZA' : room.practiceMode ? 'KOLEJNY UTWÓR ZA' : 'KOLEJNA TURA ZA'}</span>
          </div>
          <strong>{advanceCountdown ?? 5}</strong>
          <em>SEK.</em>
        </div>

        {displayCards.length ? (
          <section className="dgv-result-timeline dgv-result-v3-timeline">
            <div className="dgv-result-timeline-head">
              <div>
                <div className="dgv-eyebrow">{room.tournamentMode ? 'TWOJA OŚ TURNIEJOWA' : room.practiceMode ? 'TWOJA OŚ CZASU' : `OŚ CZASU · ${ownerName}`}</div>
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
            <input autoComplete="off" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSend()} placeholder="Napisz wiadomość…" />
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
  const modeLabel = room.dailyPlaylistMode ? 'PLAYLISTA DNIA' : room.tournamentMode ? 'TURNIEJ' : room.practiceMode ? 'TRENING' : 'ROZGRYWKA';
  const currentTokens = room.tokens?.[playerId] || 0;
  const turnName = room.tournamentMode ? 'MECZ TURNIEJOWY' : room.practiceMode ? 'TRENING SOLO' : isMyTurn ? 'TWOJA KOLEJ!' : turnPlayerName || 'TURA GRACZA';
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
              <section className={`dgv-panel dgv-practice-progress-panel dgv-v3-progress-panel ${room.tournamentMode ? 'tournament' : ''}`}>
                <div className="dgv-section-heading"><Zap size={18} /> {room.tournamentMode ? 'WYNIK MECZU TURNIEJOWEGO' : 'POSTĘP TRENINGU'}</div>
                <div className="dgv-practice-progress-main">
                  <strong>{room.tournamentMode ? practicePlayed.length : (room.timelines?.[playerId] || []).length}</strong><span>/ {room.tournamentMode ? 10 : room.target} {room.tournamentMode ? 'utworów' : 'kart'}</span>
                </div>
                <div className="dgv-practice-progress-bar"><span style={{ width: `${Math.min(100, room.tournamentMode ? (practicePlayed.length / 10) * 100 : ((room.timelines?.[playerId] || []).length / Math.max(1, room.target)) * 100)}%` }} /></div>
                <div className="dgv-practice-mini-stats">
                  <div className="good"><Check size={18} /><span>Trafienia</span><strong>{practiceCorrect}</strong></div>
                  <div className="bad"><X size={18} /><span>Pomyłki</span><strong>{practiceWrong}</strong></div>
                </div>
                <div className="dgv-v3-tip"><Sparkles size={16} /> {room.tournamentMode ? '10 utworów · przy remisie liczy się łączny czas odpowiedzi.' : 'Liczy się tylko poprawne miejsce na osi czasu.'}</div>
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


export function DesktopYearGuessView({ room, playerId, isPlaying, playElapsed, playCapSeconds, iframeRef, onTogglePlay, onSubmit, onLeave, chatInput, setChatInput, onSendChat }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const song = room.yearGuessSongs?.[room.yearGuessRoundIndex];
  const myAnswer = room.yearGuessAnswers?.[playerId];
  const answeredCount = Object.keys(room.yearGuessAnswers || {}).length;
  const totalPlayers = room.players.length;
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setYearInput('');
  }, [room.yearGuessRoundIndex]);

  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil(60 - (Date.now() - (room.yearGuessRoundStartedAtMs || Date.now())) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [room.yearGuessRoundStartedAtMs]);

  if (!song) return null;
  const parsedYear = Number(yearInput);
  const validYear = /^\d{4}$/.test(yearInput) && parsedYear >= 1900 && parsedYear <= currentYear;
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  const setSanitizedYear = (value) => setYearInput(String(value || '').replace(/\D/g, '').slice(0, 4));
  const nudgeYear = (amount) => {
    const base = validYear ? parsedYear : Math.min(currentYear, Math.max(1900, Number(yearInput) || 2000));
    setYearInput(String(Math.min(currentYear, Math.max(1900, base + amount))));
  };

  return (
    <SessionBackground className="dgv-yearguess-page">
      <div className="dgv-shell">
        <SessionHeader
          eyebrow={`${room.practiceYearGuessMode ? 'TRENING SOLO · ' : ''}RUNDA ${room.yearGuessRoundIndex + 1} / ${room.yearGuessSongs.length}`}
          title="ZGADNIJ ROK"
          onBack={onLeave}
          backLabel="Opuść"
          right={<div className={`dgv-yearguess-timer ${secondsLeft <= 10 ? 'danger' : ''}`}><Clock3 size={16} /> {secondsLeft}s</div>}
        />

        <div className="dgv-yearguess-game-grid">
          <section className="dgv-panel dgv-yearguess-audio-panel">
            <div className="dgv-section-heading"><Headphones size={18} /> POSŁUCHAJ UTWORU</div>
            <DesktopVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
            <div className="dgv-hidden-player"><iframe key={`yg-${room.yearGuessRoundIndex}`} ref={iframeRef} title="yearguess-player" src={`https://www.youtube.com/embed/${song.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${room.yearGuessStartSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" /></div>
            <button type="button" className="dgv-audio-button dgv-yearguess-audio-cta" onClick={onTogglePlay}><Play size={20} fill="currentColor" /> {isPlaying ? 'ODTWARZANIE' : 'ODTWÓRZ PONOWNIE'} <span>{audioLeft}s</span></button>
            <div className="dgv-yearguess-answer-progress"><span>ODPOWIEDZIAŁO {answeredCount}/{totalPlayers}</span><i><b style={{ width: `${Math.min(100, (answeredCount / Math.max(1, totalPlayers)) * 100)}%` }} /></i></div>
          </section>

          <section className="dgv-panel dgv-yearguess-answer-panel">
            <div className="dgv-yearguess-question"><span><CalendarDays size={23} /></span><div><div className="dgv-eyebrow">TWÓJ TYP</div><h1>W KTÓRYM ROKU WYSZEDŁ TEN UTWÓR?</h1></div></div>

            {myAnswer ? (
              <div className="dgv-yearguess-locked">
                <div className="check"><Check size={30} /></div>
                <span>ODPOWIEDŹ ZABLOKOWANA</span>
                <strong>{myAnswer.year}</strong>
                <p>Czekamy na pozostałych graczy. Wynik rundy pojawi się, gdy wszyscy odpowiedzą albo minie czas.</p>
              </div>
            ) : (
              <>
                <div className={`dgv-yearguess-console ${validYear ? 'valid' : ''}`}>
                  <span>ROK WYDANIA</span>
                  <div className="dgv-yearguess-console-row">
                    <button type="button" onClick={() => nudgeYear(-1)}>−</button>
                    <input autoComplete="off" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="1994" value={yearInput} onChange={(e) => setSanitizedYear(e.target.value)} aria-label="Wpisz rok wydania" />
                    <button type="button" onClick={() => nudgeYear(1)}>+</button>
                  </div>
                  <small>{yearInput && !validYear ? `Podaj rok 1900–${currentYear}` : 'Wpisz cztery cyfry. Po zatwierdzeniu odpowiedzi nie można zmienić.'}</small>
                </div>
                <div className="dgv-yearguess-scoring"><div><strong>+5</strong><span>DOKŁADNIE</span></div><div><strong>+3</strong><span>± 1 ROK</span></div><div><strong>+1</strong><span>± 2–3 LATA</span></div></div>
                <button type="button" className="dgv-start-button dgv-yearguess-submit" disabled={!validYear} onClick={() => onSubmit(parsedYear)}><Check size={21} /> ZATWIERDŹ {validYear ? parsedYear : 'ROK'}</button>
              </>
            )}
          </section>
        </div>
      </div>
      {!room.practiceYearGuessMode ? <ChatDrawer open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </SessionBackground>
  );
}

export function DesktopYearGuessResultView({ room, playerId, onLeave, resultDurationSeconds = 10, chatInput, setChatInput, onSendChat }) {
  const [chatOpen, setChatOpen] = useState(false);
  const last = room.yearGuessLastRound;
  const [secondsLeft, setSecondsLeft] = useState(resultDurationSeconds);
  const [localResultStartedAt] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      const startedAt = room.yearGuessResultStartedAtMs || localResultStartedAt;
      setSecondsLeft(Math.max(0, Math.ceil(resultDurationSeconds - (Date.now() - startedAt) / 1000)));
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [room.yearGuessResultStartedAtMs, room.yearGuessRoundIndex, resultDurationSeconds, localResultStartedAt]);

  if (!last) return null;
  const actualYear = Number(last.song.year);
  const isLastRound = room.yearGuessRoundIndex >= room.yearGuessSongs.length - 1;
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
  const resultLabel = (result) => {
    if (result.year === null) return 'BRAK ODPOWIEDZI';
    if (result.diff === 0) return 'IDEALNIE';
    return result.year < actualYear ? `${result.diff} ${yearWord(result.diff)} ZA WCZEŚNIE` : `${result.diff} ${yearWord(result.diff)} ZA PÓŹNO`;
  };

  return (
    <SessionBackground className="dgv-yearguess-page dgv-yearguess-result-page">
      <div className="dgv-shell">
        <SessionHeader
          eyebrow={`${room.practiceYearGuessMode ? 'TRENING SOLO · ' : ''}RUNDA ${room.yearGuessRoundIndex + 1} / ${room.yearGuessSongs.length}`}
          title="WYNIK RUNDY"
          onBack={onLeave}
          backLabel="Opuść"
          right={<div className="dgv-yearguess-timer result"><Clock3 size={16} /> {secondsLeft}s</div>}
        />

        <section className="dgv-panel dgv-yearguess-reveal">
          <div className="dgv-yearguess-reveal-copy"><div className="dgv-eyebrow">PRAWIDŁOWY ROK</div><strong>{actualYear}</strong><h2>{last.song.title}</h2><p>{last.song.artist}</p></div>
          {myResult ? <div className={`dgv-yearguess-my-result ${myResult.points >= 3 ? 'great' : myResult.points > 0 ? 'close' : 'miss'}`}><div><span>TWÓJ TYP</span><strong>{myResult.year ?? '—'}</strong></div><div><span>RÓŻNICA</span><strong>{myResult.diff === null ? '—' : myResult.diff}</strong></div><div><span>PUNKTY</span><strong>+{myResult.points || 0}</strong></div><p>{resultLabel(myResult)}</p></div> : null}
        </section>

        {!room.practiceYearGuessMode ? (
        <section className="dgv-panel dgv-yearguess-round-board">
          <div className="dgv-section-heading"><Users size={18} /> ODPOWIEDZI GRACZY <span>{last.results.length}</span></div>
          <div className="dgv-yearguess-result-head"><span>#</span><span>GRACZ</span><span>ODPOWIEDŹ</span><span>RÓŻNICA</span><span>RUNDA</span><span>ŁĄCZNIE</span></div>
          <div className="dgv-yearguess-result-list">
            {sorted.map((result, index) => {
              const player = room.players.find((item) => item.id === result.playerId);
              const total = room.yearGuessScores?.[result.playerId] || 0;
              const tone = result.diff === 0 ? 'exact' : result.points >= 3 ? 'great' : result.points > 0 ? 'close' : 'miss';
              return (
                <div key={result.playerId} className={`dgv-yearguess-result-row ${tone} ${result.playerId === playerId ? 'is-me' : ''}`} style={{ '--yg-row': index }}>
                  <span className="place">{index + 1}</span>
                  <div className="player"><span className="avatar" style={player?.avatarUrl ? { backgroundImage: `url(${player.avatarUrl})` } : undefined}>{!player?.avatarUrl ? initials(result.name) : null}</span><div><strong>{result.name}{result.playerId === playerId ? ' · TY' : ''}</strong><small>{resultLabel(result)}</small></div></div>
                  <strong className="guess">{result.year ?? '—'}</strong>
                  <span className="diff">{result.diff === null ? '—' : result.diff === 0 ? '0' : `${result.diff} ${yearWordLower(result.diff)}`}</span>
                  <strong className="round">+{result.points || 0}</strong>
                  <strong className="total">{total} pkt</strong>
                </div>
              );
            })}
          </div>
        </section>
        ) : null}

        <div className="dgv-yearguess-next"><div><span>{isLastRound ? 'PODSUMOWANIE GRY' : 'KOLEJNA RUNDA'}</span><strong>{secondsLeft}s</strong></div><i><b style={{ width: `${Math.max(0, Math.min(100, (secondsLeft / resultDurationSeconds) * 100))}%` }} /></i></div>
      </div>
      {!room.practiceYearGuessMode ? <ChatDrawer open={chatOpen} setOpen={setChatOpen} messages={room.messages || []} playerId={playerId} chatInput={chatInput} setChatInput={setChatInput} onSend={onSendChat} /> : null}
    </SessionBackground>
  );
}

function RankingList({ title, icon, rows, value, empty, accent = 'cyan', onViewProfile }) {
  return (
    <section className={`dgv-panel dgv-ranking-card ${accent}`}>
      <div className="dgv-section-heading">{icon} {title}</div>
      {rows.length === 0 ? <div className="dgv-ranking-empty">{empty}</div> : (
        <div className="dgv-ranking-list">
          {rows.map((row, index) => (
            <button type="button" key={row.key || `${row.name}-${index}`} className={index < 3 ? `podium p${index + 1}` : ''} onClick={() => row.uid && onViewProfile?.(row)}>
              <span className="place">#{index + 1}</span>
              <span className="avatar" style={row.avatarUrl ? { backgroundImage: `url(${row.avatarUrl})` } : undefined}>{!row.avatarUrl ? initials(row.name) : null}</span>
              <span className="name">{row.name}</span>
              {row.note ? <span className="note">{row.note}</span> : null}
              <strong>{value(row)}</strong>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function DesktopDailyPlaylistHubView({ alreadyPlayed, dailyBoard, weeklyBoard, allTimeBoard, busy, onStart, onHome, onViewProfile, viewingPlayer, onCloseProfile, levelFromXp }) {
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
          <RankingList title="RANKING DNIA" icon={<Trophy size={18} />} rows={dailyRows} value={(row) => `${row.score} / 10`} empty="Nikt jeszcze dziś nie zagrał." accent="cyan" onViewProfile={onViewProfile} />
          <RankingList title="RANKING TYGODNIA" icon={<Crown size={18} />} rows={weeklyRows} value={(row) => `${row.score} pkt`} empty="Brak wyników w tym tygodniu." accent="gold" onViewProfile={onViewProfile} />
          <RankingList title="WSZECH CZASÓW" icon={<Flame size={18} />} rows={allRows} value={(row) => `${row.playlistTotalScore || 0} pkt`} empty="Brak wyników." accent="pink" onViewProfile={onViewProfile} />
        </div>

        <section className="dgv-daily-rewards dgv-panel">
          {WEEKLY_RANKING_REWARDS.map((reward) => (
            <div key={reward.place}>
              {reward.place === 1 ? <img src={glKorona} alt="" /> : reward.place === 2 ? <img src={glPrezent} alt="" /> : <Trophy size={30} />}
              <span>{reward.place}. MIEJSCE</span>
              <strong>+{reward.xp} XP</strong>
              <b className="dgv-weekly-hitcoin">+{reward.hitcoin} <img src={iconHitcoin} alt="HITCOIN" /></b>
            </div>
          ))}
          <p>TOP 3 rankingu tygodniowego otrzymuje XP + HITCOIN. Nagrodę odbierasz ręcznie po zakończeniu tygodnia.</p>
        </section>
      </div>
      <DesktopPlayerProfileModal profile={viewingPlayer} onClose={onCloseProfile} levelFromXp={levelFromXp} />
    </SessionBackground>
  );
}


export function DesktopDailySongView({
  song,
  alreadyPlayed,
  result,
  isPlaying,
  playElapsed,
  playCapSeconds,
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
  const audioLeft = Math.max(0, Math.ceil(playCapSeconds - playElapsed));
  const score = result?.score ?? 0;
  return (
    <SessionBackground className="dgv-daily-song-page">
      <div className="dgv-shell">
        <SessionHeader eyebrow="CODZIENNE WYZWANIE" title="PIOSENKA DNIA" onBack={onHome} backLabel="Strona główna" />
        {!alreadyPlayed ? (
          <div className="dgv-daily-song-grid">
            <section className="dgv-panel dgv-daily-song-audio">
              <div className="dgv-section-heading"><Disc3 size={18} /> DZISIEJSZY UTWÓR</div>
              <DesktopVinyl spinning={isPlaying} progress={playElapsed / playCapSeconds} />
              <div className="dgv-hidden-player">
                <iframe key={`daily-${song.videoId}`} ref={iframeRef} title="daily-player-desktop" src={`https://www.youtube.com/embed/${song.videoId}?enablejsapi=1&autoplay=1&mute=1&start=${song.startSeconds}&controls=0&modestbranding=1&rel=0`} allow="autoplay; encrypted-media" />
              </div>
              <div className="dgv-v3-audio-footer">
                <div className="dgv-v3-audio-time"><span>FRAGMENT</span><strong>{audioLeft}s</strong></div>
                <button type="button" className="dgv-audio-button dgv-daily-song-play" onClick={onTogglePlay}><Play size={20} fill="currentColor" /><span>{isPlaying ? 'ODTWARZANIE' : playElapsed >= playCapSeconds ? 'ODTWÓRZ PONOWNIE' : 'ODTWÓRZ TERAZ'}</span></button>
              </div>
            </section>
            <section className="dgv-panel dgv-daily-song-guess">
              <div className="dgv-eyebrow">JEDNA PRÓBA DZIENNIE</div>
              <h1>CO TO ZA UTWÓR?</h1>
              <p>Podaj wykonawcę, tytuł i rok wydania. Możesz zostawić puste pole, jeśli nie znasz odpowiedzi.</p>
              <div className="dgv-daily-song-fields">
                <label><span>WYKONAWCA</span><input autoComplete="off" value={guessArtist} onChange={(e) => setGuessArtist(e.target.value)} placeholder="np. Queen" /></label>
                <label><span>TYTUŁ</span><input autoComplete="off" value={guessTitle} onChange={(e) => setGuessTitle(e.target.value)} placeholder="np. The Show Must Go On" /></label>
                <label><span>ROK</span><input autoComplete="off" type="number" value={guessYear} onChange={(e) => setGuessYear(e.target.value)} placeholder="1991" /></label>
              </div>
              <div className="dgv-daily-song-scoring">
                <div><strong>+1</strong><span>wykonawca</span></div><div><strong>+1</strong><span>tytuł</span></div><div><strong>+1</strong><span>rok</span></div>
              </div>
              <button type="button" className="dgv-confirm-button daily-song" onClick={onSubmit} disabled={busy}><span>{busy ? 'SPRAWDZAM…' : 'ZATWIERDŹ ODPOWIEDŹ'}</span><ChevronRight size={22} /></button>
            </section>
          </div>
        ) : (
          <section className={`dgv-panel dgv-daily-song-result ${score === 3 ? 'perfect' : score > 0 ? 'partial' : 'miss'}`}>
            <div className="dgv-daily-song-result-head">
              <div className="dgv-result-status-icon">{score === 3 ? <Trophy size={34} /> : score > 0 ? <Check size={34} /> : <X size={34} />}</div>
              <div><span>TWÓJ DZISIEJSZY WYNIK</span><h1>{score} / 3</h1><p>{score === 3 ? 'KOMPLET! Wszystko trafione.' : score > 0 ? 'Część odpowiedzi była poprawna.' : 'Dziś bez punktu — jutro nowa szansa.'}</p></div>
            </div>
            <div className="dgv-daily-song-reveal">
              <span>POPRAWNA ODPOWIEDŹ</span><strong>{song.year}</strong><h2>{song.title}</h2><p>{song.artist}</p>
            </div>
            <div className="dgv-daily-song-checks">
              {[['WYKONAWCA', result?.guessArtist, result?.correctArtist], ['TYTUŁ', result?.guessTitle, result?.correctTitle], ['ROK', result?.guessYear, result?.correctYear]].map(([label, answer, ok]) => (
                <div key={label} className={ok ? 'good' : 'bad'}><span>{ok ? <Check size={20} /> : <X size={20} />}</span><div><small>{label}</small><strong>{answer || '—'}</strong></div></div>
              ))}
            </div>
            <div className="dgv-daily-song-rewards">
              <span>🔥 Seria: <strong>{result?.streak ?? 0}</strong></span><span>XP: <strong>+{result?.xpEarned ?? 0}</strong></span><span>Wróć jutro po kolejny utwór.</span>
            </div>
            <button type="button" className="dgv-ghost-button large" onClick={onHome}><ArrowLeft size={18} /> STRONA GŁÓWNA</button>
          </section>
        )}
      </div>
    </SessionBackground>
  );
}


export function DesktopPracticeResultView({ room, playerId, onAgain, onHome }) {
  const isYearGuess = !!room.practiceYearGuessMode;
  const timeline = [...(room.timelines?.[playerId] || [])].sort((a, b) => a.year - b.year);
  const played = (room.playedCards || []).filter((card) => card.playerId === playerId);
  const correct = played.filter((card) => card.correct).length;
  const wrong = played.filter((card) => !card.correct).length;
  const ygScore = Number(room.yearGuessScores?.[playerId] || 0);
  const ygExact = Number(room.yearGuessExactCounts?.[playerId] || 0);
  const ygRounds = room.yearGuessSongs?.length || room.target || 0;
  const ygMax = ygRounds * 5;
  const ygPct = ygMax ? Math.round((ygScore / ygMax) * 100) : 0;

  return (
    <SessionBackground className="dgv-practice-result-page">
      <div className="dgv-shell">
        <SessionHeader eyebrow="TRYB SOLO" title={isYearGuess ? 'ZGADNIJ ROK · TRENING UKOŃCZONY' : 'TRENING UKOŃCZONY'} onBack={onHome} backLabel="Strona główna" />
        <section className={`dgv-practice-result-hero dgv-panel ${isYearGuess ? 'year-guess' : ''}`}>
          <img src={isYearGuess ? glZgadnijRok : glTrening} alt="" />
          <div>
            <div className="dgv-eyebrow">{isYearGuess ? 'SESJA ZAKOŃCZONA · BEZ RANKINGU' : 'CEL OSIĄGNIĘTY'}</div>
            <h1>{isYearGuess ? ygScore : timeline.length} <span>{isYearGuess ? 'PKT' : 'KART'}</span></h1>
            <p>{isYearGuess ? `Rozpoznałeś ${ygRounds} utworów. Ten wynik jest tylko treningowy i nie wpływa na ranking Zgadnij Rok.` : 'Zbudowałeś pełną oś czasu. Sprawdź przebieg sesji albo rozpocznij kolejny trening z innymi kategoriami.'}</p>
          </div>
          <div className="dgv-practice-result-stats">
            {isYearGuess ? <><div className="good"><Target size={22} /><strong>{ygExact}</strong><span>idealnych lat</span></div><div className="info"><Zap size={22} /><strong>{ygPct}%</strong><span>maks. wyniku</span></div></> : <><div className="good"><Check size={22} /><strong>{correct}</strong><span>trafień</span></div><div className="bad"><X size={22} /><strong>{wrong}</strong><span>pomyłek</span></div></>}
          </div>
        </section>

        {isYearGuess ? (
          <section className="dgv-panel dgv-practice-year-result">
            <div className="dgv-section-heading"><CalendarDays size={18} /> PODSUMOWANIE ZGADNIJ ROK</div>
            <div className="dgv-practice-year-score"><strong>{ygScore} / {ygMax}</strong><span>punktów</span><small>{ygExact} idealnych trafień · {ygRounds} rund · wynik nie jest zapisywany w rankingu</small></div>
          </section>
        ) : (
          <>
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
          </>
        )}

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
