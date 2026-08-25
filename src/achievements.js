// System osiągnięć — 41 pozycji w 7 kategoriach. Każde osiągnięcie ma
// funkcję `check(stats)` zwracającą true/false na podstawie już zebranych
// danych w dokumencie userStats (żadne dodatkowe odczyty nie są tu potrzebne).
// XP nie dolicza się automatycznie — gracz odbiera je ręcznie w podglądzie
// poziomu, stąd checki są tanie i mogą być liczone tylko na żądanie (przy
// otwarciu ekranu statystyk), a nie przy każdej akcji w grze.

function tierXp(index) {
  return 25 + index * 15; // 25, 40, 55, 70, 85...
}

export const ACHIEVEMENTS = [
  // --- Kamienie milowe: gry rozegrane ---
  { id: "games_1", name: "Pierwszy krok", category: "Kamienie milowe", desc: "Rozegraj 1 grę", xp: tierXp(0), check: (s) => (s.gamesPlayed || 0) >= 1 },
  { id: "games_10", name: "Wciągnąłeś się", category: "Kamienie milowe", desc: "Rozegraj 10 gier", xp: tierXp(1), check: (s) => (s.gamesPlayed || 0) >= 10 },
  { id: "games_50", name: "Weteran", category: "Kamienie milowe", desc: "Rozegraj 50 gier", xp: tierXp(2), check: (s) => (s.gamesPlayed || 0) >= 50 },
  { id: "games_100", name: "Legenda stołu", category: "Kamienie milowe", desc: "Rozegraj 100 gier", xp: tierXp(3), check: (s) => (s.gamesPlayed || 0) >= 100 },
  { id: "games_250", name: "HITSTER", category: "Kamienie milowe", desc: "Rozegraj 250 gier", xp: tierXp(4), check: (s) => (s.gamesPlayed || 0) >= 250 },

  // --- Kamienie milowe: wygrane ---
  { id: "wins_1", name: "Pierwsza krew", category: "Kamienie milowe", desc: "Wygraj 1 grę", xp: tierXp(0), check: (s) => (s.gamesWon || 0) >= 1 },
  { id: "wins_10", name: "Zabójca", category: "Kamienie milowe", desc: "Wygraj 10 gier", xp: tierXp(1), check: (s) => (s.gamesWon || 0) >= 10 },
  { id: "wins_25", name: "Niepokonany", category: "Kamienie milowe", desc: "Wygraj 25 gier", xp: tierXp(2), check: (s) => (s.gamesWon || 0) >= 25 },
  { id: "wins_50", name: "Egzekutor", category: "Kamienie milowe", desc: "Wygraj 50 gier", xp: tierXp(3), check: (s) => (s.gamesWon || 0) >= 50 },
  { id: "wins_100", name: "Władca Osi Czasu", category: "Kamienie milowe", desc: "Wygraj 100 gier", xp: tierXp(4), check: (s) => (s.gamesWon || 0) >= 100 },

  // --- Poziomy ---
  { id: "level_5", name: "Rozgrzewka", category: "Poziomy", desc: "Osiągnij poziom 5", xp: tierXp(0), check: (s, lvl) => lvl >= 5 },
  { id: "level_10", name: "Rozpędzony", category: "Poziomy", desc: "Osiągnij poziom 10", xp: tierXp(1), check: (s, lvl) => lvl >= 10 },
  { id: "level_20", name: "Ekspert", category: "Poziomy", desc: "Osiągnij poziom 20", xp: tierXp(2), check: (s, lvl) => lvl >= 20 },
  { id: "level_50", name: "Mistrz gry", category: "Poziomy", desc: "Osiągnij poziom 50", xp: tierXp(3), check: (s, lvl) => lvl >= 50 },
  { id: "level_100", name: "Może czas na przerwę?", category: "Poziomy", desc: "Osiągnij poziom 100", xp: tierXp(4), check: (s, lvl) => lvl >= 100 },

  // --- Umiejętności: zgadywanie ---
  { id: "guess_25", name: "Muzyczne ucho", category: "Umiejętności", desc: "Zgadnij poprawnie 25 razy", xp: tierXp(0), check: (s) => (s.guessesCorrect || 0) >= 25 },
  { id: "guess_50", name: "Melomaniak", category: "Umiejętności", desc: "Zgadnij poprawnie 50 razy", xp: tierXp(1), check: (s) => (s.guessesCorrect || 0) >= 50 },
  { id: "guess_100", name: "Wirtuoz", category: "Umiejętności", desc: "Zgadnij poprawnie 100 razy", xp: tierXp(2), check: (s) => (s.guessesCorrect || 0) >= 100 },
  { id: "guess_200", name: "Encyklopedia Muzyczna", category: "Umiejętności", desc: "Zgadnij poprawnie 200 razy", xp: tierXp(3), check: (s) => (s.guessesCorrect || 0) >= 200 },

  // --- Umiejętności: perfekcyjne gry i serie ---
  { id: "perfect_1", name: "Bezbłędny", category: "Umiejętności", desc: "Zagraj perfekcyjną grę (100% trafień)", xp: tierXp(0), check: (s) => (s.perfectGames || 0) >= 1 },
  { id: "perfect_3", name: "Nie do zatrzymania", category: "Umiejętności", desc: "3 perfekcyjne gry", xp: tierXp(1), check: (s) => (s.perfectGames || 0) >= 3 },
  { id: "streak_place_5", name: "Gorąca seria", category: "Umiejętności", desc: "5 poprawnych umieszczeń z rzędu", xp: tierXp(0), check: (s) => (s.longestStreak || 0) >= 5 },
  { id: "streak_place_10", name: "Płomień", category: "Umiejętności", desc: "10 poprawnych umieszczeń z rzędu", xp: tierXp(1), check: (s) => (s.longestStreak || 0) >= 10 },
  { id: "streak_guess_5", name: "Snajper", category: "Umiejętności", desc: "5 trafionych zgadnięć z rzędu", xp: tierXp(0), check: (s) => (s.longestGuessStreak || 0) >= 5 },
  { id: "streak_guess_10", name: "Wyrocznia", category: "Umiejętności", desc: "10 trafionych zgadnięć z rzędu", xp: tierXp(1), check: (s) => (s.longestGuessStreak || 0) >= 10 },

  // --- Społeczne ---
  { id: "duel_first_win", name: "Pierwszy pojedynek", category: "Społeczne", desc: "Wygraj swój pierwszy mecz 1v1", xp: tierXp(0), check: (s) => (s.duelWins || 0) >= 1 },
  { id: "duel_rematch_10", name: "Rewanżysta", category: "Społeczne", desc: "10 pojedynków 1v1 z tą samą osobą", xp: tierXp(1), check: (s) => (s.maxDuelsWithSamePerson || 0) >= 10 },
  { id: "social_5", name: "Towarzyski", category: "Społeczne", desc: "Zagraj z 5 różnymi osobami", xp: tierXp(1), check: (s) => (s.uniqueOpponents || []).length >= 5 },
  { id: "party_6", name: "Imprezowicz", category: "Społeczne", desc: "Zagraj w grze z co najmniej 6 graczami", xp: tierXp(1), check: (s) => (s.maxPlayersInGame || 0) >= 6 },

  // --- Piosenka dnia ---
  { id: "daily_7", name: "Codzienny rytuał", category: "Piosenka dnia", desc: "Seria 7 dni z rzędu", xp: tierXp(0), check: (s) => (s.dailyStreak || 0) >= 7 },
  { id: "daily_30", name: "Nałóg", category: "Piosenka dnia", desc: "Seria 30 dni z rzędu", xp: tierXp(2), check: (s) => (s.dailyStreak || 0) >= 30 },
  { id: "daily_perfect", name: "Perfekcyjny dzień", category: "Piosenka dnia", desc: "Zgadnij 3/3 w Piosence dnia", xp: 35, check: (s) => !!s.hadPerfectDaily },

  // --- Rozbudowa bazy ---
  { id: "songs_1", name: "Kurator", category: "Baza", desc: "1 zaakceptowana propozycja", xp: tierXp(0), check: (s) => (s.songsAdded || 0) >= 1 },
  { id: "songs_10", name: "Bibliotekarz", category: "Baza", desc: "10 zaakceptowanych propozycji", xp: tierXp(1), check: (s) => (s.songsAdded || 0) >= 10 },
  { id: "songs_25", name: "Archiwista", category: "Baza", desc: "25 zaakceptowanych propozycji", xp: tierXp(2), check: (s) => (s.songsAdded || 0) >= 25 },
  { id: "songs_50", name: "Strażnik Biblioteki", category: "Baza", desc: "50 zaakceptowanych propozycji", xp: tierXp(3), check: (s) => (s.songsAdded || 0) >= 50 },

  // --- Zabawne / nietypowe ---
  { id: "fun_night_owl", name: "Nocny marek", category: "Zabawne", desc: "Zagraj grę między 00:00 a 5:00", xp: 35, check: (s) => !!s.hadNightGame },
  { id: "fun_gambler", name: "Hazardzista", category: "Zabawne", desc: "Kup 10 kart za tokeny (łącznie)", xp: 35, check: (s) => (s.cardsBought || 0) >= 10 },
  { id: "fun_frugal", name: "Oszczędny", category: "Zabawne", desc: "Skończ grę z min. 5 niewykorzystanymi tokenami", xp: 35, check: (s) => !!s.hadFrugalFinish },
  { id: "fun_unlucky", name: "Pechowiec", category: "Zabawne", desc: "Przegraj 5 gier z rzędu", xp: 35, check: (s) => (s.maxLossStreak || 0) >= 5 },
  { id: "fun_comeback", name: "Powrót", category: "Zabawne", desc: "Zagraj ponownie w ciągu 10 minut od poprzedniej gry", xp: 35, check: (s) => !!s.hadQuickReturn },
];

// --- Dekady: zgadywanie wykonawcy+tytułu podzielone latami utworu ---
// Lata 30-60 połączone w jedną grupę (mniej utworów, mniej znane), potem
// osobno każda kolejna dekada. 5 progów × 7 grup = 35 osiągnięć.
const DECADE_GROUPS = [
  { key: "60s_earlier", label: "utworów do lat 60." },
  { key: "70s", label: "utworów z lat 70." },
  { key: "80s", label: "utworów z lat 80." },
  { key: "90s", label: "utworów z lat 90." },
  { key: "00s", label: "utworów z lat 2000." },
  { key: "10s", label: "utworów z lat 2010." },
  { key: "20s", label: "utworów z lat 2020." },
];
const DECADE_TIERS = [5, 10, 20, 50, 100];

DECADE_GROUPS.forEach((g) => {
  DECADE_TIERS.forEach((tier, i) => {
    ACHIEVEMENTS.push({
      id: `decade_${g.key}_${tier}`,
      name: `Znawca — ${g.label} (${tier})`,
      category: "Dekady",
      desc: `Odgadnij poprawnie ${tier} ${g.label}`,
      xp: tierXp(i),
      check: (s) => (s.guessesByDecadeGroup?.[g.key] || 0) >= tier,
    });
  });
});

export function getAchievementProgress(stats, level) {
  const claimed = new Set(stats?.claimedAchievements || []);
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    qualifies: a.check(stats || {}, level || 1),
    claimed: claimed.has(a.id),
  }));
}
