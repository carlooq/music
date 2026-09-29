import { doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "./firebase-config.js";

const COLLECTION = "dailySongs";

// Prosty, deterministyczny hash łańcucha (DJB2) — to samo wejście zawsze daje
// to samo wyjście, niezależnie od urządzenia/przeglądarki/czasu wywołania.
function stableStringHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

// Wybiera piosenkę dnia W PEŁNI DETERMINISTYCZNIE z samej daty — bez żadnego
// losowania. Dzięki temu nie ma znaczenia, który gracz "pierwszy" wywoła tę
// funkcję: każdy, liczący niezależnie, dostanie dokładnie ten sam wynik.
// Sortujemy pulę po stałym ID PRZED wyborem, bo kolejność `pool` może się
// różnić między klientami (raz świeże pobranie z Firestore, raz z lokalnego
// cache) — bez tego sortowania sam hash z daty by nie wystarczył.
function pickDeterministicDailySong(dayKey, pool) {
  const sorted = [...pool].sort((a, b) => String(a.id || a.videoId).localeCompare(String(b.id || b.videoId)));
  const idx = stableStringHash(dayKey) % sorted.length;
  const song = sorted[idx];
  return {
    videoId: song.videoId,
    artist: song.artist,
    title: song.title,
    year: song.year,
    // Też deterministyczne (inny "kawałek" tego samego hashu) — 15-75s, żeby
    // nie trafić w sam koniec utworu.
    startSeconds: 15 + (stableStringHash(dayKey + "-start") % 61),
  };
}

// Pobiera (albo, jeśli jeszcze nie istnieje dzisiaj, wylicza i zapisuje)
// "piosenkę dnia" — tę samą dla wszystkich graczy danego dnia.
//
// WCZEŚNIEJ ten wybór był losowy (Math.random()) za każdym razem, gdy ktoś
// pierwszy tego dnia wywołał tę funkcję — co przy dwóch graczach otwierających
// appkę niemal jednocześnie mogło dać RÓŻNE piosenki: obaj losowali coś
// innego, a "przegrany" wyścigu o zapis w rzadkich przypadkach nie zdążał
// jeszcze zobaczyć cudzego zapisu przy ponownym odczycie i cicho wracał do
// swojego, lokalnie wylosowanego wyniku. Teraz wybór jest deterministyczny —
// nawet gdyby to się powtórzyło, obaj gracze i tak wyliczą ten sam utwór,
// więc to, kto "wygra" zapis, przestaje mieć znaczenie.
export async function getOrCreateDailySong(dayKey, pool) {
  const ref = doc(db, COLLECTION, dayKey);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();

  const data = pickDeterministicDailySong(dayKey, pool);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return; // ktoś inny już ustawił piosenkę dnia w międzyczasie
      tx.set(ref, data);
    });
  } catch (e) {
    // ciche niepowodzenie — poniżej i tak spróbujemy odczytać, co ostatecznie tam jest
  }

  const final = await getDoc(ref);
  // Nawet jeśli finalny odczyt jeszcze nie widzi cudzego zapisu, `data`
  // policzone tu jest DOKŁADNIE tym samym, co policzył każdy inny gracz —
  // więc ten fallback już nie prowadzi do rozjazdu.
  return final.exists() ? final.data() : data;
}
