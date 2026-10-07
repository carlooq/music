// KONFIGURACJA KAMPANII — jedyne miejsce, w którym zmienia się balans.
// Liczby utworów, progi gwiazdek, czasy i nagrody poprawiasz TUTAJ,
// bez dotykania logiki ani komponentów.
//
// Zasada: dekada definiuje muzykę (decadeStart–decadeEnd), etap definiuje
// sposób grania (type + params). Wynik etapu to jedna liczba `score`
// porównywana z `starThresholds` = [próg 1★, próg 2★, próg 3★].
//
// score dla poszczególnych typów:
//   timeline  – liczba poprawnie ułożonych utworów (karta startowa się nie liczy)
//   quiz      – liczba poprawnych odpowiedzi
//   yearGuess – suma punktów (10/8/6/4/2/0 za rundę), max = rounds × 10
//   rush      – liczba poprawnych odpowiedzi do upływu czasu
//   finale    – liczba trafionych prób ze wszystkich części (max = suma prób)

// Nagroda za KAŻDĄ zdobytą gwiazdkę. Wypłacana tylko za gwiazdki, których
// gracz jeszcze nie miał (poprawa 2★ → 3★ daje nagrodę za jedną brakującą).
export const DEFAULT_PER_STAR_REWARD = { xp: 25, hitcoin: 20 };

const STAGES_80S = [
  {
    id: "80s_1", title: "Powrót do lat 80.", type: "timeline",
    description: "Ułóż utwory z lat 80. w kolejności chronologicznej.",
    params: { scoredCount: 6, decisionSeconds: 60 },
    starThresholds: [3, 5, 6], maxScore: 6, unlockAfter: null,
  },
  {
    id: "80s_2", title: "Muzyczny Quiz", type: "quiz",
    description: "Odpowiedz na pytania A/B/C/D o muzykę lat 80.",
    params: { questionCount: 10, questionTypes: ["artist", "title", "year"], yearOptionSpread: "decade" },
    starThresholds: [5, 7, 9], maxScore: 10, unlockAfter: "80s_1",
  },
  {
    id: "80s_3", title: "Który to rok?", type: "yearGuess",
    description: "Zgadnij rok wydania. Im bliżej, tym więcej punktów.",
    params: { rounds: 8, roundSeconds: 60 },
    // orientacyjne — w jednej dekadzie losowy strzał też punktuje, więc progi są wysokie
    starThresholds: [40, 55, 70], maxScore: 80, unlockAfter: "80s_2",
  },
  {
    id: "80s_4", title: "Neonowy Sprint", type: "rush",
    description: "Hit Rush na utworach z lat 80. Błąd zeruje combo i kosztuje czas.",
    params: { roundSeconds: 60 },
    starThresholds: [6, 9, 12], maxScore: 60, unlockAfter: "80s_3",
  },
  {
    id: "80s_5", title: "Quiz Dekady", type: "quiz",
    description: "Trudniejszy quiz — więcej pytań i ciaśniejsze lata.",
    params: { questionCount: 12, questionTypes: ["artist", "title", "year"], yearOptionSpread: "tight" },
    starThresholds: [6, 9, 11], maxScore: 12, unlockAfter: "80s_4",
  },
  {
    id: "80s_6", title: "Oś pod presją", type: "timeline",
    description: "Oś czasu na czas — mniej sekund na decyzję i więcej kart.",
    params: { scoredCount: 7, decisionSeconds: 30 },
    starThresholds: [4, 6, 7], maxScore: 7, unlockAfter: "80s_5",
  },
  {
    id: "80s_finale", title: "WIELKI FINAŁ — LATA 80.", type: "finale", isFinale: true,
    description: "Trzy rundy: oś czasu, quiz i Zgadnij Rok. Liczy się łączny wynik.",
    params: {
      parts: [
        { type: "timeline", scoredCount: 4, decisionSeconds: 60 },
        { type: "quiz", questionCount: 4, questionTypes: ["artist", "title", "year"], yearOptionSpread: "tight" },
        // próba w Zgadnij Rok liczy się jako trafiona przy błędzie ≤ maxYearDiff lat
        { type: "yearGuess", rounds: 4, roundSeconds: 60, maxYearDiff: 2 },
      ],
    },
    starThresholds: [6, 9, 11], maxScore: 12,
    perfectScore: 12, // 12/12 = PERFECT SHOW (osobne oznaczenie, nie czwarta gwiazdka)
    unlockAfter: "80s_6",
  },
];

export const CAMPAIGN = {
  id: "tour",
  title: "Trasa koncertowa",
  chapters: [
    {
      id: "80s",
      title: "LATA 80. — NEONOWA ERA",
      decadeStart: 1980,
      decadeEnd: 1989,
      unlockAfterChapter: null, // pierwszy rozdział jest od razu dostępny
      // nagroda za komplet gwiazdek w rozdziale (wypłacana raz);
      // `special` to na razie tylko znacznik — karta Campaign Edition dojdzie później
      completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_80s" },
      stages: STAGES_80S,
    },
  ],
};

export function getChapter(campaign, chapterId) {
  return campaign.chapters.find((c) => c.id === chapterId) || null;
}
export function getStage(chapter, stageId) {
  return chapter?.stages.find((s) => s.id === stageId) || null;
}
export function maxStarsForChapter(chapter) {
  return chapter.stages.length * 3;
}
export function maxStarsForCampaign(campaign) {
  return campaign.chapters.reduce((sum, c) => sum + maxStarsForChapter(c), 0);
}
