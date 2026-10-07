let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// Wywołaj to raz, w reakcji na PRAWDZIWY dotyk/klik użytkownika (np. pierwsza
// interakcja ze stroną) — na iOS/Androidzie dźwięk stworzony poza takim
// gestem zwykle w ogóle nie zabrzmi, nawet jeśli kod działa poprawnie.
export function unlockAudio() {
  try {
    const ctx = getCtx();
    // cichy "ping" żeby faktycznie odblokować silnik audio na iOS
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch (e) {
    // brak wsparcia — nic nie robimy
  }
}

function tone(freq, startOffset, duration, type = "sine", gain = 0.2) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(ctx.destination);
    const t0 = ctx.currentTime + startOffset;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch (e) {
    // brak wsparcia Web Audio / zablokowane przez przeglądarkę — cicho pomijamy
  }
}

// Wesoły, wznoszący akord — poprawne umieszczenie karty.
export function playCorrectSound() {
  tone(523.25, 0, 0.12); // C5
  tone(659.25, 0.1, 0.18); // E5
  tone(783.99, 0.2, 0.3); // G5
}

// Krótki, opadający "buzz" — pudło.
export function playWrongSound() {
  tone(200, 0, 0.22, "sawtooth", 0.15);
  tone(150, 0.12, 0.28, "sawtooth", 0.15);
}

// Krótkie brawa (seria szumowych "klaśnięć") — trafione zgadywanie tytułu/wykonawcy.
export function playApplause() {
  try {
    const ctx = getCtx();
    for (let i = 0; i < 10; i++) {
      const t = i * 0.05 + Math.random() * 0.02;
      const size = Math.floor(ctx.sampleRate * 0.05);
      const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < size; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / size);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const g = ctx.createGain();
      g.gain.value = 0.15;
      src.connect(g);
      g.connect(ctx.destination);
      src.start(ctx.currentTime + t);
    }
  } catch (e) {
    // cicho pomijamy
  }
}

// Krótka fanfara — koniec gry.
export function playVictorySound() {
  tone(523.25, 0, 0.15, "sine", 0.22); // C5
  tone(659.25, 0.12, 0.15, "sine", 0.22); // E5
  tone(783.99, 0.24, 0.15, "sine", 0.22); // G5
  tone(1046.5, 0.38, 0.4, "sine", 0.25); // C6
}

// ===== HIT MATCH — adaptacyjny podkład i polish audio =====
// Lekki, syntetyczny groove generowany w Web Audio. Nie korzysta z zewnętrznych
// plików, więc startuje od razu po pierwszym geście użytkownika i może reagować
// na kolejne kaskady bez przeładowywania assetów.
let hitMatchMusic = {
  timer: null,
  ctx: null,
  master: null,
  step: 0,
  intensity: 0,
};

function hmTone(freq, when, duration, type, gainValue, destination) {
  try {
    const ctx = hitMatchMusic.ctx || getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(Math.max(0.0001, gainValue), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(destination || ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.03);
  } catch (e) {
    // Audio jest dodatkiem — błąd nie może blokować rozgrywki.
  }
}

function hmNoise(when, duration, gainValue, destination) {
  try {
    const ctx = hitMatchMusic.ctx || getCtx();
    const size = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 4800;
    gain.gain.setValueAtTime(gainValue, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(destination || ctx.destination);
    src.start(when);
  } catch (e) {
    // cicho pomijamy
  }
}

function scheduleHitMatchBeat() {
  const { ctx, master } = hitMatchMusic;
  if (!ctx || !master || ctx.state !== "running") return;
  const step = hitMatchMusic.step % 16;
  const intensity = hitMatchMusic.intensity;
  const t = ctx.currentTime + 0.025;

  // Stały, delikatny puls — żeby plansza miała własny rytm nawet bez combo.
  if (step % 4 === 0) {
    hmTone(step % 8 === 0 ? 65.41 : 73.42, t, 0.16, "sine", 0.055, master);
    hmTone(130.81, t, 0.07, "triangle", 0.018, master);
  }

  // x2: pojawia się hi-hat / dodatkowy puls.
  if (intensity >= 2 && step % 2 === 0) hmNoise(t, 0.035, 0.018, master);

  // x3: krótki bas między głównymi uderzeniami.
  if (intensity >= 3 && step % 4 === 2) {
    const bass = [98.0, 110.0, 123.47, 110.0][Math.floor(step / 4) % 4];
    hmTone(bass, t, 0.12, "triangle", 0.035, master);
  }

  // x4: prosty synth-arp.
  if (intensity >= 4 && step % 2 === 1) {
    const arp = [392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0, 493.88];
    hmTone(arp[Math.floor(step / 2) % arp.length], t, 0.08, "sine", 0.018, master);
  }

  // x5+: pełny peak — gęstszy hat i wysoki akcent.
  if (intensity >= 5) {
    hmNoise(t, 0.022, step % 2 ? 0.014 : 0.008, master);
    if (step % 4 === 3) hmTone(783.99, t, 0.09, "triangle", 0.025, master);
  }

  hitMatchMusic.step = (hitMatchMusic.step + 1) % 16;
}

export function startHitMatchMusic() {
  try {
    const ctx = getCtx();
    if (hitMatchMusic.timer && hitMatchMusic.ctx === ctx) return;
    stopHitMatchMusic();
    const master = ctx.createGain();
    master.gain.value = 0.055;
    master.connect(ctx.destination);
    hitMatchMusic.ctx = ctx;
    hitMatchMusic.master = master;
    hitMatchMusic.step = 0;
    hitMatchMusic.intensity = 0;
    scheduleHitMatchBeat();
    hitMatchMusic.timer = window.setInterval(scheduleHitMatchBeat, 125);
  } catch (e) {
    // cicho pomijamy
  }
}

export function setHitMatchMusicIntensity(level = 0) {
  const next = Math.max(0, Math.min(5, Math.round(Number(level) || 0)));
  hitMatchMusic.intensity = next;
  try {
    if (hitMatchMusic.master && hitMatchMusic.ctx) {
      const target = 0.052 + next * 0.004;
      hitMatchMusic.master.gain.cancelScheduledValues(hitMatchMusic.ctx.currentTime);
      hitMatchMusic.master.gain.linearRampToValueAtTime(target, hitMatchMusic.ctx.currentTime + 0.12);
    }
  } catch (e) {
    // cicho pomijamy
  }
}

export function stopHitMatchMusic() {
  if (hitMatchMusic.timer) {
    window.clearInterval(hitMatchMusic.timer);
    hitMatchMusic.timer = null;
  }
  const oldMaster = hitMatchMusic.master;
  const oldCtx = hitMatchMusic.ctx;
  hitMatchMusic.master = null;
  hitMatchMusic.ctx = null;
  hitMatchMusic.step = 0;
  hitMatchMusic.intensity = 0;
  try {
    if (oldMaster && oldCtx) {
      oldMaster.gain.cancelScheduledValues(oldCtx.currentTime);
      oldMaster.gain.setValueAtTime(Math.max(0.0001, oldMaster.gain.value), oldCtx.currentTime);
      oldMaster.gain.exponentialRampToValueAtTime(0.0001, oldCtx.currentTime + 0.12);
      window.setTimeout(() => {
        try { oldMaster.disconnect(); } catch (e) { /* noop */ }
      }, 180);
    }
  } catch (e) {
    // cicho pomijamy
  }
}

export function playHitMatchComboSound(level = 2) {
  const combo = Math.max(2, Math.min(6, Number(level) || 2));
  const base = 329.63 * Math.pow(2, (combo - 2) / 12);
  tone(base, 0, 0.1, "triangle", 0.11);
  tone(base * 1.25, 0.055, 0.13, "sine", 0.1);
  if (combo >= 4) tone(base * 1.5, 0.12, 0.18, "sine", 0.11);
  if (combo >= 5) tone(base * 2, 0.2, 0.24, "triangle", 0.12);
}

export function playHitMatchStarSound(star = 1) {
  const notes = [659.25, 783.99, 1046.5];
  const freq = notes[Math.max(0, Math.min(2, Number(star || 1) - 1))];
  tone(freq, 0, 0.2, "sine", 0.16);
  tone(freq * 1.25, 0.08, 0.24, "triangle", 0.1);
}

export function playHitMatchRewardSound() {
  tone(523.25, 0, 0.1, "triangle", 0.12);
  tone(659.25, 0.07, 0.12, "triangle", 0.12);
  tone(880.0, 0.15, 0.24, "sine", 0.13);
}
