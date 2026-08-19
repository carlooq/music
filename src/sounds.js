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
