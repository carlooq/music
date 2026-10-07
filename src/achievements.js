// System osiągnięć — wiele kategorii (w tym tryby: Hit Rush, Playlista dnia, Zgadnij Rok, Turniej, Liga). Każde osiągnięcie ma
// funkcję `check(stats)` zwracającą true/false na podstawie już zebranych
// danych w dokumencie userStats (żadne dodatkowe odczyty nie są tu potrzebne).
// XP nie dolicza się automatycznie — gracz odbiera je ręcznie w podglądzie
// poziomu, stąd checki są tanie i mogą być liczone tylko na żądanie (przy
// otwarciu ekranu statystyk), a nie przy każdej akcji w grze.

function tierXp(index) {
  return 25 + index * 15; // 25, 40, 55, 70, 85...
}

const RARITY_ORDER_ACH = ["winyl", "srebrna", "zlota", "platynowa", "diamentowa"];

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

// --- Kolekcja kart ---
function totalCardsOwned(s) {
  return Object.keys(s.cardCollection || {}).length;
}

const CARD_TOTAL_TIERS = [50, 100, 250, 500, 1000];
CARD_TOTAL_TIERS.forEach((tier, i) => {
  ACHIEVEMENTS.push({
    id: `cards_total_${tier}`,
    name: `Kolekcjoner (${tier})`,
    category: "Kolekcja",
    desc: `Zbierz ${tier} różnych kart`,
    xp: tierXp(i),
    check: (s) => totalCardsOwned(s) >= tier,
  });
});

const RARITY_CARD_TIERS = {
  winyl: [25, 50, 100],
  srebrna: [15, 30, 60],
  zlota: [10, 20, 40],
  platynowa: [5, 10, 20],
};
Object.entries(RARITY_CARD_TIERS).forEach(([rarity, tiers]) => {
  const rarityLabels = { winyl: "Winyli", srebrna: "Srebrnych Płyt", zlota: "Złotych Płyt", platynowa: "Platynowych Płyt" };
  tiers.forEach((tier, i) => {
    ACHIEVEMENTS.push({
      id: `cards_${rarity}_${tier}`,
      name: `${tier} ${rarityLabels[rarity]}`,
      category: "Kolekcja",
      desc: `Zbierz ${tier} kart poziomu ${rarityLabels[rarity]}`,
      xp: tierXp(i),
      check: (s) => (s.cardsByRarity?.[rarity] || 0) >= tier,
    });
  });
});

ACHIEVEMENTS.push(
  { id: "cards_first", name: "Pierwszy krążek", category: "Kolekcja", desc: "Zdobądź swoją pierwszą kartę", xp: 25, check: (s) => totalCardsOwned(s) >= 1 },
  {
    id: "cards_first_diamond",
    name: "Szczęściarz",
    category: "Kolekcja",
    desc: "Zdobądź swoją pierwszą Diamentową Płytę",
    xp: 85,
    check: (s) => (s.cardsByRarity?.diamentowa || 0) >= 1,
  },
  {
    id: "cards_full_spread",
    name: "Pełny przekrój",
    category: "Kolekcja",
    desc: "Miej co najmniej 1 kartę z każdego z 5 poziomów rzadkości",
    xp: 55,
    check: (s) => RARITY_ORDER_ACH.every((r) => (s.cardsByRarity?.[r] || 0) >= 1),
  },
  { id: "cards_trader", name: "Handlarz", category: "Kolekcja", desc: "Sprzedaj łącznie 50 duplikatów", xp: 55, check: (s) => (s.duplicatesSold || 0) >= 50 }
);

// --- Tryby rywalizacji i dodatkowe tryby gry ---
// Wszystkie warunki opierają się na danych, które już zapisujemy w userStats
// (żadnych nowych liczników) — więc część graczy odblokuje je od razu.
function countClaims(obj, key) {
  return Object.values(obj || {}).filter((c) => c && (key ? c[key] : true)).length;
}
function tiered(list, build) {
  list.forEach((tier, i) => ACHIEVEMENTS.push(build(tier, i)));
}

// Hit Rush
tiered([10, 50, 200], (n, i) => ({
  id: `hr_runs_${n}`, name: ["Rozgrzewka rushu", "Biegacz", "Maratończyk"][i], category: "Hit Rush",
  desc: `Ukończ ${n} podejść w Hit Rush`, xp: tierXp(i), check: (s) => (s.hitRushRunsTotal || 0) >= n,
}));
tiered([500, 1500, 3000, 5000, 8000], (n, i) => ({
  id: `hr_score_${n}`, name: ["Rush: Brąz", "Rush: Srebro", "Rush: Złoto", "Rush: Platyna", "Rush: Diament"][i], category: "Hit Rush",
  desc: `Zdobądź ${n} pkt w jednym podejściu`, xp: tierXp(i), check: (s) => (s.hitRushBestScore || 0) >= n,
}));
tiered([10, 20, 30], (n, i) => ({
  id: `hr_combo_${n}`, name: ["Kombinator", "Mistrz combo", "Nieśmiertelny"][i], category: "Hit Rush",
  desc: `Osiągnij combo ${n} w Hit Rush`, xp: tierXp(i + 1), check: (s) => (s.hitRushBestCombo || 0) >= n,
}));

// Playlista dnia
tiered([7, 30, 100], (n, i) => ({
  id: `pl_games_${n}`, name: ["Stały bywalec", "Playlistoman", "Playlista to mój dom"][i], category: "Playlista dnia",
  desc: `Zagraj w ${n} Playlist dnia`, xp: tierXp(i), check: (s) => (s.playlistGamesPlayed || 0) >= n,
}));
tiered([100, 500, 1500], (n, i) => ({
  id: `pl_points_${n}`, name: ["Playlistowy maniak", "Playlistowy mistrz", "Playlistowa legenda"][i], category: "Playlista dnia",
  desc: `Zbierz łącznie ${n} pkt w Playlistach dnia`, xp: tierXp(i + 1), check: (s) => (s.playlistTotalScore || 0) >= n,
}));

// Zgadnij Rok
tiered([10, 50, 150], (n, i) => ({
  id: `yg_games_${n}`, name: ["Podróżnik w czasie", "Kronikarz", "Strażnik epok"][i], category: "Zgadnij Rok",
  desc: `Rozegraj ${n} gier w Zgadnij Rok`, xp: tierXp(i), check: (s) => (s.yearGuessRanking?.gamesPlayed || 0) >= n,
}));
tiered([10, 50, 200], (n, i) => ({
  id: `yg_exact_${n}`, name: ["Trafiony rok", "Jasnowidz", "Zegarmistrz"][i], category: "Zgadnij Rok",
  desc: `Trafij dokładny rok ${n} razy`, xp: tierXp(i + 1), check: (s) => (s.yearGuessRanking?.exactYears || 0) >= n,
}));
tiered([5, 25], (n, i) => ({
  id: `yg_wins_${n}`, name: ["Zwycięzca lat", "Pan czasu"][i], category: "Zgadnij Rok",
  desc: `Wygraj ${n} gier w Zgadnij Rok`, xp: tierXp(i + 1), check: (s) => (s.yearGuessRanking?.gamesWon || 0) >= n,
}));

// Turniej (puchar)
ACHIEVEMENTS.push({
  id: "cup_debut", name: "Debiut w pucharze", category: "Turniej", desc: "Weź udział w turnieju pucharowym",
  xp: tierXp(0), check: (s) => countClaims(s.tournamentRewardClaims) >= 1,
});
tiered([1, 3, 10], (n, i) => ({
  id: `cup_wins_${n}`, name: ["Mistrz pucharu", "Pucharowy rekin", "Legenda pucharu"][i], category: "Turniej",
  desc: n === 1 ? "Wygraj turniej pucharowy" : `Wygraj ${n} turniejów pucharowych`, xp: [70, 100, 150][i], check: (s) => (s.tournamentsWon || 0) >= n,
}));

// Liga
tiered([10, 50], (n, i) => ({
  id: `lg_played_${n}`, name: ["Ligowiec", "Weteran ligi"][i], category: "Liga",
  desc: `Rozegraj ${n} meczów ligowych`, xp: tierXp(i), check: (s) => countClaims(s.leagueMatchStatClaims, "participation") >= n,
}));
tiered([5, 25], (n, i) => ({
  id: `lg_wins_${n}`, name: ["Pogromca ligi", "Postrach ligi"][i], category: "Liga",
  desc: `Wygraj ${n} meczów ligowych`, xp: tierXp(i + 1), check: (s) => countClaims(s.leagueMatchStatClaims, "win") >= n,
}));
tiered([1, 5], (n, i) => ({
  id: `lg_podium_${n}`, name: ["Na podium", "Stały bywalec podium"][i], category: "Liga",
  desc: n === 1 ? "Zajmij miejsce na podium ligi (1.–3.)" : `Zajmij miejsce na podium ligi ${n} razy`, xp: tierXp(i + 1), check: (s) => countClaims(s.leagueRewardClaims) >= n,
}));
tiered([1, 3], (n, i) => ({
  id: `lg_titles_${n}`, name: ["Mistrz ligi", "Dynastia"][i], category: "Liga",
  desc: n === 1 ? "Wygraj ligę" : `Wygraj ${n} lig`, xp: [100, 150][i], check: (s) => (s.leaguesWon || 0) >= n,
}));

export function getAchievementProgress(stats, level) {
  const claimed = new Set(stats?.claimedAchievements || []);
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    qualifies: a.check(stats || {}, level || 1),
    claimed: claimed.has(a.id),
  }));
}
