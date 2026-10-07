import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Crown,
  Disc3,
  Headphones,
  HelpCircle,
  LockKeyhole,
  MapPinned,
  Music2,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  TimerReset,
  Trophy,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { getStageStatus, chapterStars } from "./campaignEngine.js";
import { CAMPAIGN, maxStarsForChapter } from "./campaignConfig.js";
import "./campaign.css";

const TYPE_LABEL = {
  timeline: "Oś czasu",
  quiz: "Quiz A/B/C/D",
  yearGuess: "Zgadnij rok",
  rush: "Hit Rush",
  finale: "Wielki finał",
};
const LETTERS = ["A", "B", "C", "D"];

const TYPE_ICON = {
  timeline: Disc3,
  quiz: HelpCircle,
  yearGuess: CalendarDays,
  rush: Zap,
  finale: Crown,
};

function TypeIcon({ type, size = 20 }) {
  const Icon = TYPE_ICON[type] || Music2;
  return <Icon size={size} strokeWidth={1.9} />;
}

function chapterDisplayTitle(title = "") {
  const [era, name] = String(title).split("—").map((part) => part.trim());
  return { era: era || title, name: name || "Trasa koncertowa" };
}

export function Stars({ count = 0, total = 3, compact = false }) {
  return (
    <span className={`cmp-stars${compact ? " compact" : ""}`} aria-label={`${count} z ${total} gwiazdek`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < count ? "cmp-star on" : "cmp-star off"}>
          <Star size={compact ? 14 : 18} fill="currentColor" strokeWidth={1.6} />
        </span>
      ))}
    </span>
  );
}

function stageSummary(stage) {
  const p = stage.params;
  switch (stage.type) {
    case "timeline": return `${p.scoredCount} utworów · ${p.decisionSeconds}s na decyzję`;
    case "quiz": return `${p.questionCount} pytań`;
    case "yearGuess": return `${p.rounds} rund · ${p.roundSeconds}s na rundę`;
    case "rush": return `${p.roundSeconds}s`;
    case "finale": return p.parts.map((x) => `${TYPE_LABEL[x.type]} (${x.scoredCount || x.questionCount || x.rounds})`).join(" + ");
    default: return "";
  }
}

function thresholdLabel(stage, n) {
  const t = stage.starThresholds[n];
  switch (stage.type) {
    case "timeline": return `${t} poprawnych`;
    case "quiz": return `${t} poprawnych`;
    case "yearGuess": return `${t} pkt`;
    case "rush": return `${t} poprawnych`;
    case "finale": return `${t} z ${stage.maxScore}`;
    default: return String(t);
  }
}

function CampaignBackdrop() {
  return (
    <div className="cmp-backdrop" aria-hidden="true">
      <i className="cmp-glow cmp-glow-a" />
      <i className="cmp-glow cmp-glow-b" />
      <i className="cmp-grid" />
      <i className="cmp-scanlines" />
    </div>
  );
}

function CampaignBackButton({ children = "Wróć", onClick }) {
  return (
    <button className="cmp-back" onClick={onClick}>
      <ArrowLeft size={16} /> <span>{children}</span>
    </button>
  );
}

function StageStatusBadge({ status, current, perfect }) {
  if (perfect) return <span className="cmp-status-badge perfect"><Crown size={13} /> PERFECT</span>;
  if (current) return <span className="cmp-status-badge current"><Sparkles size={13} /> TERAZ</span>;
  if (status === "cleared") return <span className="cmp-status-badge cleared"><Check size={13} /> UKOŃCZONO</span>;
  if (status === "locked") return <span className="cmp-status-badge locked"><LockKeyhole size={12} /> ZABLOKOWANY</span>;
  return <span className="cmp-status-badge open">DOSTĘPNY</span>;
}

// ------------------------------------------------------------ MAPA
export function CampaignMapView({ chapter, progress, onSelectStage, onLeaderboard, onBack }) {
  const max = maxStarsForChapter(chapter);
  const have = chapterStars(progress, chapter.id);
  const chProg = progress?.chapters?.[chapter.id] || {};
  const nextId = chapter.stages.find((s) => getStageStatus(CAMPAIGN, progress, chapter.id, s.id) === "unlocked")?.id;
  const completion = max ? Math.round((have / max) * 100) : 0;
  const heading = chapterDisplayTitle(chapter.title);

  return (
    <div className="cmp-page cmp-map-page">
      <CampaignBackdrop />

      <header className="cmp-map-hero">
        <div className="cmp-top-actions">
          <CampaignBackButton onClick={onBack}>Strona główna</CampaignBackButton>
          <button className="cmp-ranking-link" onClick={onLeaderboard}><Trophy size={15} /> Ranking gwiazdek</button>
        </div>

        <div className="cmp-hero-kicker"><MapPinned size={14} /> {CAMPAIGN.title}</div>
        <div className="cmp-hero-copy">
          <p>{heading.era}</p>
          <h1>{heading.name}</h1>
          <span>Przejdź muzyczną trasę dekady, zdobywaj gwiazdki i odblokuj wielki finał.</span>
        </div>

        <div className="cmp-chapter-progress">
          <div className="cmp-progress-copy">
            <div>
              <span>POSTĘP ROZDZIAŁU</span>
              <strong>{have}<small> / {max}</small></strong>
            </div>
            <span className="cmp-total-stars"><Star size={15} fill="currentColor" /> {have} GWIAZDEK</span>
          </div>
          <div className="cmp-progress-track"><i style={{ width: `${completion}%` }} /></div>
          <div className="cmp-progress-foot">
            <span><Star size={12} fill="currentColor" /> {completion}% gwiazdek</span>
            {chProg.perfectShow ? <b><Crown size={13} /> PERFECT SHOW</b> : <span>Finał czeka na końcu trasy</span>}
          </div>
        </div>
      </header>

      <section className="cmp-route-wrap">
        <div className="cmp-route-heading">
          <span>TRASA DEKADY</span>
          <small>{chapter.stages.filter((s) => chProg.stages?.[s.id]?.cleared).length} / {chapter.stages.length} etapów ukończonych</small>
        </div>

        <ol className="cmp-map">
          {chapter.stages.map((stage, i) => {
            const status = getStageStatus(CAMPAIGN, progress, chapter.id, stage.id);
            const entry = chProg.stages?.[stage.id] || { stars: 0, best: 0 };
            const current = stage.id === nextId;
            const last = i === chapter.stages.length - 1;
            return (
              <li
                key={stage.id}
                className={`cmp-node ${status}${current ? " current" : ""}${stage.isFinale ? " finale" : ""}${i % 2 ? " right" : " left"}${last ? " last" : ""}`}
              >
                <span className="cmp-route-dot" aria-hidden="true">
                  {status === "locked" ? <LockKeyhole size={16} /> : status === "cleared" ? <Check size={17} /> : <TypeIcon type={stage.type} size={17} />}
                </span>
                <button className="cmp-card" disabled={status === "locked"} onClick={() => onSelectStage(stage.id)}>
                  <span className="cmp-card-shine" aria-hidden="true" />
                  <span className="cmp-card-icon"><TypeIcon type={stage.type} size={22} /></span>
                  <span className="cmp-card-copy">
                    <span className="cmp-card-no">{stage.isFinale ? "FINAŁ ROZDZIAŁU" : `ETAP ${String(i + 1).padStart(2, "0")}`}</span>
                    <span className="cmp-card-name">{stage.title}</span>
                    <span className="cmp-card-type">{TYPE_LABEL[stage.type]} · {stageSummary(stage)}</span>
                    <span className="cmp-card-bottom">
                      {status === "locked" ? <span className="cmp-lock-copy">Ukończ poprzedni etap</span> : <Stars count={entry.stars} compact />}
                      <StageStatusBadge status={status} current={current} perfect={entry.perfect} />
                    </span>
                  </span>
                  {status !== "locked" ? <ChevronRight className="cmp-card-arrow" size={18} /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="cmp-map-footer">
        <button className="cmp-btn secondary" onClick={onLeaderboard}><Trophy size={16} /> ZOBACZ RANKING GWIAZDEK</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ SZCZEGÓŁY ETAPU
export function CampaignStageView({ chapter, stage, progress, busy, onStart, onBack }) {
  const entry = progress?.chapters?.[chapter.id]?.stages?.[stage.id] || { stars: 0, best: 0 };
  const perStar = stage.reward?.perStar || { xp: 25, hitcoin: 20 };
  return (
    <div className="cmp-page cmp-stage-page">
      <CampaignBackdrop />
      <div className="cmp-top-actions"><CampaignBackButton onClick={onBack}>Mapa trasy</CampaignBackButton></div>

      <header className="cmp-stage-hero">
        <div className={`cmp-stage-emblem${stage.isFinale ? " finale" : ""}`}><TypeIcon type={stage.type} size={30} /></div>
        <div className="cmp-stage-heading">
          <p className="cmp-eyebrow">{chapter.title} · {TYPE_LABEL[stage.type]}</p>
          <h1 className="cmp-title">{stage.title}</h1>
          <Stars count={entry.stars} />
        </div>
      </header>

      <div className="cmp-stage-grid">
        <section className="cmp-panel cmp-briefing">
          <span className="cmp-panel-label">BRIEFING ETAPU</span>
          <p className="cmp-stage-description">{stage.description}</p>
          <div className="cmp-facts">
            <div><TypeIcon type={stage.type} size={17} /><span>TRYB</span><strong>{TYPE_LABEL[stage.type]}</strong></div>
            <div><Headphones size={17} /><span>ZAWARTOŚĆ</span><strong>{stageSummary(stage)}</strong></div>
            <div><Target size={17} /><span>TWÓJ REKORD</span><strong>{entry.best || 0} / {stage.maxScore}</strong></div>
          </div>
        </section>

        <section className="cmp-panel cmp-threshold-panel">
          <div className="cmp-panel-head">
            <div>
              <span className="cmp-panel-label">CEL</span>
              <h2 className="cmp-h2">Progi gwiazdek</h2>
            </div>
            <span className="cmp-mini-total"><Star size={13} fill="currentColor" /> {entry.stars}/3</span>
          </div>
          <ul className="cmp-thresholds">
            {[0, 1, 2].map((n) => (
              <li key={n} className={entry.stars > n ? "done" : ""}>
                <span className="cmp-threshold-star"><Star size={18} fill="currentColor" /></span>
                <div><strong>{n + 1} {n === 0 ? "GWIAZDKA" : "GWIAZDKI"}</strong><span>{thresholdLabel(stage, n)}</span></div>
                {entry.stars > n ? <CheckCircle2 size={18} className="cmp-threshold-check" /> : null}
              </li>
            ))}
          </ul>
          {stage.perfectScore ? <p className="cmp-perfect-note"><Crown size={15} /> PERFECT SHOW: {stage.perfectScore}/{stage.maxScore}</p> : null}
        </section>
      </div>

      <section className="cmp-reward-strip">
        <Sparkles size={18} />
        <div><span>NAGRODA ZA NOWĄ GWIAZDKĘ</span><strong>+{perStar.xp} XP <i>·</i> +{perStar.hitcoin} HITCOIN</strong></div>
        <small>Nagrody dostajesz tylko za gwiazdki, których wcześniej nie miałeś.</small>
      </section>

      <div className="cmp-stage-actions">
        <button className="cmp-btn primary cmp-start-btn" disabled={busy} onClick={onStart}>
          {busy ? <><span className="cmp-spinner" /> ŁADUJĘ…</> : <><Play size={18} fill="currentColor" /> ROZPOCZNIJ ETAP</>}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ ODTWARZACZ (ukryty iframe)
function CampaignAudio({ card, startSeconds }) {
  const ref = useRef(null);
  const send = (func, args = []) => ref.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  const unlock = () => { send("unMute"); send("setVolume", [100]); send("playVideo"); };
  useEffect(() => {
    const timers = [180, 650, 1250].map((d) => setTimeout(unlock, d));
    return () => timers.forEach(clearTimeout);
  }, [card.videoId]);
  return (
    <div className="cmp-audio-console">
      <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none", position: "absolute" }}>
        <iframe
          key={card.videoId}
          ref={ref}
          title="campaign-audio"
          width="280"
          height="158"
          src={`https://www.youtube.com/embed/${card.videoId}?enablejsapi=1&autoplay=1&mute=0&start=${startSeconds}&controls=0&modestbranding=1&rel=0&playsinline=1`}
          allow="autoplay; encrypted-media"
          style={{ border: "none" }}
          onLoad={unlock}
        />
      </div>
      <div className="cmp-audio-icon"><Headphones size={23} /></div>
      <div className="cmp-audio-copy"><span>FRAGMENT UTWORU</span><strong>Słuchaj uważnie</strong></div>
      <div className="cmp-wave" aria-hidden="true">{Array.from({ length: 18 }).map((_, i) => <i key={i} style={{ height: `${22 + ((i * 17) % 68)}%` }} />)}</div>
      <button className="cmp-replay" onClick={() => { send("seekTo", [startSeconds, true]); unlock(); }}><Volume2 size={15} /> Odtwórz ponownie</button>
    </div>
  );
}

function useNow(active, ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

// ------------------------------------------------------------ QUIZ + ZGADNIJ ROK
export function CampaignPlayView({ stage, run, play, onAnswerQuiz, onSubmitYear, onNext, onExit }) {
  const item = play.items[play.index];
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [play.index, item?.id]);
  const now = useNow(play.kind === "yearGuess" && play.ready && !play.feedback);
  if (!item) return null;
  const total = play.items.length;
  const partLabel = run.parts.length > 1 ? `Część ${run.partIndex + 1}/${run.parts.length}` : null;
  const correctSoFar = play.results.filter((r) => r.correct).length;
  const secondsLeft = play.kind === "yearGuess" && play.ready && !play.feedback
    ? Math.max(0, Math.ceil((play.readyAt + play.roundSeconds * 1000 - now) / 1000)) : null;
  const progressPct = Math.min(100, ((play.index + (play.feedback ? 1 : 0)) / total) * 100);

  return (
    <div className="cmp-page cmp-play-page">
      <CampaignBackdrop />
      <header className="cmp-play-header">
        <button className="cmp-exit" onClick={onExit}><X size={16} /> Przerwij</button>
        <div className="cmp-play-meta">
          <span>{partLabel ? `${partLabel} · ` : ""}{stage.title}</span>
          <strong>{play.kind === "quiz" ? "Pytanie" : "Runda"} {Math.min(play.index + 1, total)} <i>/ {total}</i></strong>
        </div>
        {secondsLeft != null ? <div className={`cmp-timer${secondsLeft <= 10 ? " danger" : ""}`}><TimerReset size={17} /> {secondsLeft}s</div> : <div className="cmp-live-dot"><i /> LIVE</div>}
      </header>
      <div className="cmp-play-track"><i style={{ width: `${progressPct}%` }} /></div>

      <CampaignAudio card={item} startSeconds={item.startSeconds} />
      <div className={`cmp-listen-status${play.ready ? " ready" : ""}`}><i /> {play.ready ? "Możesz odpowiadać" : "Uruchamiam fragment…"}{play.kind === "quiz" ? ` · ${correctSoFar} poprawnych` : ""}</div>

      {play.kind === "quiz" ? (
        <section className="cmp-question-card">
          <span className="cmp-question-kicker">MUZYCZNY QUIZ</span>
          <h2 className="cmp-question">{item.prompt}</h2>
          <div className="cmp-options">
            {item.options.map((opt, i) => {
              let cls = "cmp-option";
              if (play.feedback) {
                if (i === item.correctIndex) cls += " correct";
                else if (i === play.feedback.chosen) cls += " wrong";
              }
              return (
                <button key={i} className={cls} disabled={!!play.feedback || !play.ready} onClick={() => onAnswerQuiz(i)}>
                  <span className="cmp-letter">{LETTERS[i]}</span><span>{opt}</span>
                  {play.feedback && i === item.correctIndex ? <Check size={17} /> : null}
                  {play.feedback && i === play.feedback.chosen && i !== item.correctIndex ? <X size={17} /> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="cmp-question-card cmp-year-card">
          <span className="cmp-question-kicker">ZGADNIJ ROK</span>
          <h2 className="cmp-question">Który to rok?</h2>
          <p className="cmp-question-help">Wybierz rok wydania utworu.</p>
          <div className="cmp-years">
            {Array.from({ length: play.yearMax - play.yearMin + 1 }, (_, i) => play.yearMin + i).map((y) => {
              let cls = "cmp-year";
              if (play.feedback) {
                if (y === play.feedback.actual) cls += " correct";
                else if (y === play.feedback.guess) cls += " wrong";
              } else if (y === picked) cls += " picked";
              return <button key={y} className={cls} disabled={!!play.feedback || !play.ready} onClick={() => setPicked(y)}>{y}</button>;
            })}
          </div>
          {!play.feedback ? (
            <button className="cmp-btn primary" disabled={picked == null || !play.ready} onClick={() => onSubmitYear(picked)}>ZATWIERDŹ ROK <ChevronRight size={17} /></button>
          ) : null}
        </section>
      )}

      {play.feedback ? (
        <section className={`cmp-feedback-card ${play.kind === "quiz" ? (play.feedback.correct ? "good" : "bad") : (play.feedback.points >= 8 ? "good" : "bad")}`}>
          <div className="cmp-feedback-icon">{play.kind === "quiz" ? (play.feedback.correct ? <CheckCircle2 size={26} /> : <X size={26} />) : <Target size={25} />}</div>
          <div className="cmp-feedback-copy">
            {play.kind === "quiz" ? (
              <strong>{play.feedback.correct ? "Dobra odpowiedź!" : "Nie tym razem"}</strong>
            ) : (
              <strong>{play.feedback.guess == null ? "Czas minął" : `Twój typ: ${play.feedback.guess}`} <em>+{play.feedback.points} pkt</em></strong>
            )}
            <span>{item.artist} — {item.title} ({item.year})</span>
          </div>
          <button className="cmp-feedback-next" onClick={onNext}>{play.index + 1 >= total ? "ZAKOŃCZ" : "DALEJ"} <ChevronRight size={17} /></button>
        </section>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ PRZERWA MIĘDZY CZĘŚCIAMI FINAŁU
export function CampaignIntermissionView({ stage, run, busy, onContinue, onExit }) {
  const last = run.partResults[run.partResults.length - 1];
  const next = run.parts[run.partIndex + 1];
  const totalHits = run.partResults.reduce((s, r) => s + (r.hits || 0), 0);
  return (
    <div className="cmp-page cmp-center-page">
      <CampaignBackdrop />
      <section className="cmp-intermission-card">
        <div className="cmp-stage-emblem finale"><Crown size={32} /></div>
        <span className="cmp-eyebrow">{stage.title}</span>
        <h1 className="cmp-title">Część {run.partIndex + 1} zakończona</h1>
        <div className="cmp-intermission-score"><strong>{last.hits}</strong><span>/ {last.total}</span></div>
        <p>{TYPE_LABEL[last.type]} ukończone. Łącznie masz <b>{totalHits} / {stage.maxScore}</b>.</p>
        {next ? <div className="cmp-next-mode"><span>NASTĘPNIE</span><TypeIcon type={next.type} size={20} /><strong>{TYPE_LABEL[next.type]}</strong></div> : null}
        <button className="cmp-btn primary" disabled={busy} onClick={onContinue}>{busy ? "ŁADUJĘ…" : <>DALEJ <ChevronRight size={18} /></>}</button>
        <button className="cmp-text-btn" onClick={onExit}>Przerwij etap</button>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ WYNIK ETAPU
export function CampaignResultView({ stage, outcome, nextStage, onRetry, onNext, onMap, onRetrySave }) {
  if (!outcome) return null;
  const r = outcome.result;
  const title = outcome.pending ? "Zapisuję wynik…" : outcome.saveError ? "Nie udało się zapisać" : r.stars > 0 ? "Etap zaliczony!" : "Spróbuj jeszcze raz";
  return (
    <div className="cmp-page cmp-center-page cmp-result-page">
      <CampaignBackdrop />
      <section className={`cmp-result-card${r?.perfect ? " perfect" : ""}`}>
        <div className="cmp-result-mark">{r?.perfect ? <Crown size={31} /> : r?.stars > 0 ? <CheckCircle2 size={31} /> : <Target size={31} />}</div>
        <span className="cmp-eyebrow">{stage.title}</span>
        <h1 className="cmp-title">{title}</h1>

        <div className="cmp-result-score"><strong>{outcome.score}</strong><span>/ {stage.maxScore}</span></div>
        {!outcome.pending && !outcome.saveError ? <Stars count={r.stars} /> : null}

        {outcome.partResults?.length > 1 ? (
          <div className="cmp-parts">{outcome.partResults.map((p, i) => <div key={i}><TypeIcon type={p.type} size={16} /><span>{TYPE_LABEL[p.type]}</span><strong>{p.hits}/{p.total}</strong></div>)}</div>
        ) : null}

        {!outcome.pending && !outcome.saveError ? (
          <div className="cmp-result-details">
            {r.perfect && stage.perfectScore ? <p className="cmp-crown-line"><Crown size={16} /> PERFECT SHOW!</p> : null}
            <p>{r.newBest ? <>Nowy rekord <b>{r.score}</b> <small>(wcześniej {r.previousBest})</small></> : <>Twój rekord: <b>{Math.max(r.previousBest, r.score)}</b></>}</p>
            <p>{r.gainedStars > 0 ? <>Nowe gwiazdki: <b>+{r.gainedStars}</b></> : "Brak nowych gwiazdek w tej próbie."}</p>
            {(outcome.rewards.xp || outcome.rewards.hitcoin) ? <p className="cmp-reward"><Sparkles size={15} /> +{outcome.rewards.xp} XP · +{outcome.rewards.hitcoin} HITCOIN</p> : null}
            {outcome.rewards.completion ? <p className="cmp-reward"><Trophy size={15} /> Komplet gwiazdek w rozdziale — bonus wypłacony!</p> : null}
            {r.newlyUnlockedStageId && nextStage ? <p className="cmp-unlocked"><LockKeyhole size={14} /> Odblokowano: <b>{nextStage.title}</b></p> : null}
          </div>
        ) : null}
        {outcome.saveError ? <p className="cmp-error">{outcome.saveError}</p> : null}

        <div className="cmp-result-actions">
          {outcome.saveError ? <button className="cmp-btn primary" onClick={onRetrySave}>Spróbuj zapisać ponownie</button> : null}
          {!outcome.pending && !outcome.saveError && r.stars > 0 && nextStage ? <button className="cmp-btn primary" onClick={onNext}>NASTĘPNY ETAP <ChevronRight size={17} /></button> : null}
          {!outcome.pending && !outcome.saveError ? <button className="cmp-btn secondary" onClick={onRetry}><RotateCcw size={16} /> ZAGRAJ PONOWNIE</button> : null}
          <button className="cmp-text-btn" disabled={outcome.pending} onClick={onMap}><MapPinned size={14} /> Mapa kampanii</button>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ RANKING
export function CampaignLeaderboardView({ rows, myUid, onBack }) {
  return (
    <div className="cmp-page cmp-board-page">
      <CampaignBackdrop />
      <div className="cmp-top-actions"><CampaignBackButton onClick={onBack}>Mapa trasy</CampaignBackButton></div>
      <header className="cmp-board-hero">
        <div className="cmp-stage-emblem"><Trophy size={29} /></div>
        <div><p className="cmp-eyebrow">TRASA KONCERTOWA</p><h1 className="cmp-title">Ranking gwiazdek</h1><p>Liczy się wyłącznie liczba zdobytych gwiazdek w kampanii.</p></div>
      </header>
      {rows == null ? <div className="cmp-loading"><span className="cmp-spinner" /> Ładuję ranking…</div> : rows.length === 0 ? <div className="cmp-empty">Jeszcze nikt nie zdobył gwiazdek.</div> : (
        <ol className="cmp-board">
          {rows.map((r, i) => {
            const previous = i > 0 ? rows[i - 1] : null;
            const displayRank = previous && previous.totalStars === r.totalStars
              ? rows.findIndex((x) => x.totalStars === r.totalStars) + 1
              : i + 1;
            return (
              <li key={r.uid} className={`${r.uid === myUid ? "me " : ""}${displayRank <= 3 ? `top top-${displayRank}` : ""}`.trim()}>
                <span className="cmp-rank">{displayRank <= 3 ? <Crown size={18} /> : displayRank}</span>
                <span className="cmp-player-avatar">{String(r.username || "G").trim().slice(0, 1).toUpperCase()}</span>
                <span className="cmp-name"><strong>{r.username || "Gracz"}</strong>{r.uid === myUid ? <small>TY</small> : null}</span>
                <span className="cmp-val"><Star size={16} fill="currentColor" /> {r.totalStars}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
