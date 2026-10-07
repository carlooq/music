// Widoki kampanii — celowo proste (szkielet strukturalny). Warstwa graficzna
// ma być dopracowana osobno: wszystkie elementy mają klasy `cmp-*`,
// logika jest w useCampaign.js, więc zmiana wyglądu niczego nie psuje.
import { useEffect, useRef, useState } from "react";
import { getStageStatus, chapterStars } from "./campaignEngine.js";
import { CAMPAIGN, maxStarsForChapter } from "./campaignConfig.js";
import "./campaign.css";

const TYPE_LABEL = { timeline: "Oś czasu", quiz: "Quiz A/B/C/D", yearGuess: "Zgadnij Rok", rush: "Hit Rush", finale: "Finał" };
const LETTERS = ["A", "B", "C", "D"];

export function Stars({ count = 0, total = 3 }) {
  return (
    <span className="cmp-stars" aria-label={`${count} z ${total} gwiazdek`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < count ? "cmp-star on" : "cmp-star off"}>{i < count ? "★" : "☆"}</span>
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

// ------------------------------------------------------------ MAPA
export function CampaignMapView({ chapter, progress, onSelectStage, onLeaderboard, onBack }) {
  const max = maxStarsForChapter(chapter);
  const have = chapterStars(progress, chapter.id);
  const chProg = progress?.chapters?.[chapter.id] || {};
  const nextId = chapter.stages.find((s) => getStageStatus(CAMPAIGN, progress, chapter.id, s.id) === "unlocked")?.id;
  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <button className="cmp-back" onClick={onBack}>← Wróć</button>
        <p className="cmp-eyebrow">{CAMPAIGN.title}</p>
        <h1 className="cmp-title">{chapter.title}</h1>
        <p className="cmp-total">{have} / {max} ★{chProg.perfectShow ? " · 👑 PERFECT SHOW" : ""}</p>
      </header>
      <ol className="cmp-map">
        {chapter.stages.map((stage, i) => {
          const status = getStageStatus(CAMPAIGN, progress, chapter.id, stage.id);
          const entry = chProg.stages?.[stage.id] || { stars: 0, best: 0 };
          const current = stage.id === nextId;
          return (
            <li key={stage.id} className={`cmp-node ${status}${current ? " current" : ""}${stage.isFinale ? " finale" : ""}${i % 2 ? " right" : " left"}`}>
              <button className="cmp-card" disabled={status === "locked"} onClick={() => onSelectStage(stage.id)}>
                <span className="cmp-card-no">{stage.isFinale ? "FINAŁ" : `Etap ${i + 1}`}</span>
                <span className="cmp-card-name">{stage.title}</span>
                <span className="cmp-card-type">{TYPE_LABEL[stage.type]}</span>
                {status === "locked" ? <span className="cmp-lock">🔒 Zablokowany</span> : <Stars count={entry.stars} />}
                {entry.perfect ? <span className="cmp-crown">👑</span> : null}
                {current ? <span className="cmp-here">TU JESTEŚ</span> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <button className="cmp-btn secondary" onClick={onLeaderboard}>🏆 Ranking kampanii</button>
    </div>
  );
}

// ------------------------------------------------------------ SZCZEGÓŁY ETAPU
export function CampaignStageView({ chapter, stage, progress, busy, onStart, onBack }) {
  const entry = progress?.chapters?.[chapter.id]?.stages?.[stage.id] || { stars: 0, best: 0 };
  const perStar = stage.reward?.perStar || { xp: 25, hitcoin: 20 };
  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <button className="cmp-back" onClick={onBack}>← Mapa</button>
        <p className="cmp-eyebrow">{chapter.title}</p>
        <h1 className="cmp-title">{stage.title}</h1>
        <Stars count={entry.stars} />
      </header>
      <section className="cmp-panel">
        <p>{stage.description}</p>
        <dl className="cmp-facts">
          <dt>Tryb</dt><dd>{TYPE_LABEL[stage.type]}</dd>
          <dt>Zawartość</dt><dd>{stageSummary(stage)}</dd>
          <dt>Twój rekord</dt><dd>{entry.best || 0} / {stage.maxScore}</dd>
        </dl>
      </section>
      <section className="cmp-panel">
        <h2 className="cmp-h2">Progi gwiazdek</h2>
        <ul className="cmp-thresholds">
          {[0, 1, 2].map((n) => (
            <li key={n} className={entry.stars > n ? "done" : ""}><Stars count={n + 1} total={n + 1} /> {thresholdLabel(stage, n)}</li>
          ))}
        </ul>
        {stage.perfectScore ? <p className="cmp-note">👑 PERFECT SHOW: {stage.perfectScore}/{stage.maxScore}</p> : null}
        <p className="cmp-note">Nagroda za każdą nową gwiazdkę: +{perStar.xp} XP, +{perStar.hitcoin} HITCOIN. Poprawa wyniku nagradza tylko brakujące gwiazdki.</p>
      </section>
      <button className="cmp-btn primary" disabled={busy} onClick={onStart}>{busy ? "Ładuję…" : "ROZPOCZNIJ"}</button>
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
    <div className="cmp-audio">
      <div style={{ width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" }}>
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
      <button className="cmp-btn secondary small" onClick={() => { send("seekTo", [startSeconds, true]); unlock(); }}>▶ Odtwórz ponownie</button>
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
  const partLabel = run.parts.length > 1 ? `Część ${run.partIndex + 1}/${run.parts.length} · ` : "";
  const correctSoFar = play.results.filter((r) => r.correct).length;
  const secondsLeft = play.kind === "yearGuess" && play.ready && !play.feedback
    ? Math.max(0, Math.ceil((play.readyAt + play.roundSeconds * 1000 - now) / 1000)) : null;

  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <button className="cmp-back" onClick={onExit}>✕ Przerwij</button>
        <p className="cmp-eyebrow">{stage.title}</p>
        <p className="cmp-progress">{partLabel}{play.kind === "quiz" ? "Pytanie" : "Runda"} {Math.min(play.index + 1, total)} / {total}{play.kind === "quiz" ? ` · poprawne: ${correctSoFar}` : ""}</p>
        {secondsLeft != null ? <p className={`cmp-timer${secondsLeft <= 10 ? " danger" : ""}`}>⏱ {secondsLeft}s</p> : null}
      </header>

      <CampaignAudio card={item} startSeconds={item.startSeconds} />
      <p className="cmp-status">{play.ready ? "Możesz odpowiadać." : "Uruchamiam fragment…"}</p>

      {play.kind === "quiz" ? (
        <section className="cmp-panel">
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
                  <span className="cmp-letter">{LETTERS[i]}</span> {opt}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="cmp-panel">
          <h2 className="cmp-question">Który to rok?</h2>
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
            <button className="cmp-btn primary" disabled={picked == null || !play.ready} onClick={() => onSubmitYear(picked)}>ZATWIERDŹ</button>
          ) : null}
        </section>
      )}

      {play.feedback ? (
        <section className="cmp-panel cmp-feedback">
          {play.kind === "quiz" ? (
            <p className={play.feedback.correct ? "good" : "bad"}>{play.feedback.correct ? "✓ Dobrze!" : "✕ Niestety nie."}</p>
          ) : (
            <p className={play.feedback.points >= 8 ? "good" : "bad"}>
              {play.feedback.guess == null ? "⏱ Czas minął" : `Twój typ: ${play.feedback.guess}`} · +{play.feedback.points} pkt
            </p>
          )}
          <p className="cmp-song">{item.artist} — {item.title} ({item.year})</p>
          <button className="cmp-btn primary" onClick={onNext}>{play.index + 1 >= total ? "ZAKOŃCZ" : "DALEJ"}</button>
        </section>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ PRZERWA MIĘDZY CZĘŚCIAMI FINAŁU
export function CampaignIntermissionView({ stage, run, busy, onContinue, onExit }) {
  const last = run.partResults[run.partResults.length - 1];
  const next = run.parts[run.partIndex + 1];
  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <p className="cmp-eyebrow">{stage.title}</p>
        <h1 className="cmp-title">Część {run.partIndex + 1} z {run.parts.length} zakończona</h1>
      </header>
      <section className="cmp-panel">
        <p>{TYPE_LABEL[last.type]}: trafione <strong>{last.hits}</strong> / {last.total}</p>
        <p className="cmp-note">Łącznie dotąd: {run.partResults.reduce((s, r) => s + (r.hits || 0), 0)} / {stage.maxScore}</p>
        {next ? <p>Następnie: <strong>{TYPE_LABEL[next.type]}</strong></p> : null}
      </section>
      <button className="cmp-btn primary" disabled={busy} onClick={onContinue}>{busy ? "Ładuję…" : "DALEJ"}</button>
      <button className="cmp-btn secondary" onClick={onExit}>Przerwij etap</button>
    </div>
  );
}

// ------------------------------------------------------------ WYNIK ETAPU
export function CampaignResultView({ stage, outcome, nextStage, onRetry, onNext, onMap, onRetrySave }) {
  if (!outcome) return null;
  const r = outcome.result;
  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <p className="cmp-eyebrow">{stage.title}</p>
        <h1 className="cmp-title">{outcome.pending ? "Zapisuję wynik…" : outcome.saveError ? "Nie udało się zapisać" : r.stars > 0 ? "Etap zaliczony!" : "Spróbuj jeszcze raz"}</h1>
      </header>
      <section className="cmp-panel cmp-score">
        <p className="cmp-big">{outcome.score} / {stage.maxScore}</p>
        {!outcome.pending && !outcome.saveError ? <Stars count={r.stars} /> : null}
        {outcome.partResults?.length > 1 ? (
          <ul className="cmp-parts">{outcome.partResults.map((p, i) => <li key={i}>{TYPE_LABEL[p.type]}: {p.hits} / {p.total}</li>)}</ul>
        ) : null}
        {!outcome.pending && !outcome.saveError ? (
          <>
            {r.perfect && stage.perfectScore ? <p className="cmp-crown-line">👑 PERFECT SHOW!</p> : null}
            {r.newBest ? <p className="cmp-note">Nowy rekord! (poprzedni: {r.previousBest})</p> : <p className="cmp-note">Twój rekord: {Math.max(r.previousBest, r.score)}</p>}
            {r.gainedStars > 0 ? <p className="cmp-note">Nowe gwiazdki: +{r.gainedStars}</p> : <p className="cmp-note">Brak nowych gwiazdek — nagroda tylko za nowe.</p>}
            {(outcome.rewards.xp || outcome.rewards.hitcoin) ? <p className="cmp-reward">+{outcome.rewards.xp} XP · +{outcome.rewards.hitcoin} HITCOIN</p> : null}
            {outcome.rewards.completion ? <p className="cmp-reward">🎉 Komplet gwiazdek w rozdziale! Bonus za ukończenie rozdziału wypłacony.</p> : null}
            {r.newlyUnlockedStageId && nextStage ? <p className="cmp-note">Odblokowano: {nextStage.title}</p> : null}
          </>
        ) : null}
        {outcome.saveError ? <p className="cmp-error">{outcome.saveError}</p> : null}
      </section>
      {outcome.saveError ? <button className="cmp-btn primary" onClick={onRetrySave}>Spróbuj zapisać ponownie</button> : null}
      {!outcome.pending && !outcome.saveError ? (
        <>
          {r.stars > 0 && nextStage ? <button className="cmp-btn primary" onClick={onNext}>Następny etap</button> : null}
          <button className="cmp-btn secondary" onClick={onRetry}>Zagraj ponownie</button>
        </>
      ) : null}
      <button className="cmp-btn secondary" disabled={outcome.pending} onClick={onMap}>Mapa kampanii</button>
    </div>
  );
}

// ------------------------------------------------------------ RANKING
export function CampaignLeaderboardView({ rows, myUid, onBack }) {
  return (
    <div className="cmp-page">
      <header className="cmp-header">
        <button className="cmp-back" onClick={onBack}>← Mapa</button>
        <h1 className="cmp-title">Ranking kampanii</h1>
        <p className="cmp-note">Kolejność: liczba zdobytych gwiazdek (przy remisie — suma rekordów).</p>
      </header>
      {rows == null ? <p>Ładuję…</p> : rows.length === 0 ? <p>Brak wyników.</p> : (
        <ol className="cmp-board">
          {rows.map((r, i) => (
            <li key={r.uid} className={r.uid === myUid ? "me" : ""}>
              <span className="cmp-rank">{i + 1}</span>
              <span className="cmp-name">{r.username || "Gracz"}</span>
              <span className="cmp-val">{r.totalStars} ★</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
