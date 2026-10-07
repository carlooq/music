// KONFIGURACJA KAMPANII — jedyne miejsce, w którym zmienia się balans.
// Liczby utworów, progi gwiazdek, czasy i nagrody poprawiasz TUTAJ,
// bez dotykania logiki ani komponentów.
//
// Zasada: okres definiuje muzykę (decadeStart–decadeEnd; null = brak granicy),
// etap definiuje sposób grania (type + params). Wynik etapu to jedna liczba `score`
// porównywana z `starThresholds` = [próg 1★, próg 2★, próg 3★].
//
// score dla poszczególnych typów:
//   timeline  – liczba poprawnie ułożonych utworów (karta startowa się nie liczy)
//   quiz      – liczba poprawnych odpowiedzi
//   yearGuess – suma punktów (10/8/6/4/2/0 za rundę), max = rounds × 10
//   rush      – najlepsze combo poprawnych odpowiedzi z rzędu
//   finale    – liczba trafionych prób ze wszystkich części (max = suma prób)

export const DEFAULT_PER_STAR_REWARD = { xp: 25, hitcoin: 20 };

const STANDARD = {
  timeline: { scoredCount: 6, decisionSeconds: 60, stars: [3, 5, 6] },
  quiz: { questionCount: 10, stars: [5, 7, 9] },
  yearGuess: { rounds: 8, roundSeconds: 60, stars: [40, 55, 70] },
  rush: { roundSeconds: 30, comboGoal: 10, stars: [5, 7, 10] },
  quiz2: { questionCount: 12, stars: [6, 9, 11] },
  pressure: { scoredCount: 7, decisionSeconds: 30, stars: [4, 6, 7] },
  finale: { stars: [6, 9, 11], perfectScore: 12 },
};

function buildStages(prefix, copy, tuning = {}) {
  const cfg = {
    timeline: { ...STANDARD.timeline, ...(tuning.timeline || {}) },
    quiz: { ...STANDARD.quiz, ...(tuning.quiz || {}) },
    yearGuess: { ...STANDARD.yearGuess, ...(tuning.yearGuess || {}) },
    rush: { ...STANDARD.rush, ...(tuning.rush || {}) },
    quiz2: { ...STANDARD.quiz2, ...(tuning.quiz2 || {}) },
    pressure: { ...STANDARD.pressure, ...(tuning.pressure || {}) },
    finale: { ...STANDARD.finale, ...(tuning.finale || {}) },
  };

  return [
    {
      id: `${prefix}_1`, title: copy.timelineTitle, type: "timeline",
      description: copy.timelineDescription,
      params: { scoredCount: cfg.timeline.scoredCount, decisionSeconds: cfg.timeline.decisionSeconds },
      starThresholds: cfg.timeline.stars, maxScore: cfg.timeline.scoredCount, unlockAfter: null,
    },
    {
      id: `${prefix}_2`, title: copy.quizTitle, type: "quiz",
      description: copy.quizDescription,
      params: { questionCount: cfg.quiz.questionCount, questionTypes: ["artist", "title", "year"], yearOptionSpread: "decade" },
      starThresholds: cfg.quiz.stars, maxScore: cfg.quiz.questionCount, unlockAfter: `${prefix}_1`,
    },
    {
      id: `${prefix}_3`, title: copy.yearTitle || "Który to rok?", type: "yearGuess",
      description: copy.yearDescription || "Zgadnij rok wydania. Im bliżej, tym więcej punktów.",
      params: { rounds: cfg.yearGuess.rounds, roundSeconds: cfg.yearGuess.roundSeconds },
      starThresholds: cfg.yearGuess.stars, maxScore: cfg.yearGuess.rounds * 10, unlockAfter: `${prefix}_2`,
    },
    {
      id: `${prefix}_4`, title: copy.rushTitle, type: "rush",
      description: copy.rushDescription,
      params: { roundSeconds: cfg.rush.roundSeconds, comboGoal: cfg.rush.comboGoal },
      starThresholds: cfg.rush.stars, maxScore: cfg.rush.comboGoal, unlockAfter: `${prefix}_3`,
    },
    {
      id: `${prefix}_5`, title: copy.quiz2Title || "Quiz Dekady", type: "quiz",
      description: copy.quiz2Description,
      params: { questionCount: cfg.quiz2.questionCount, questionTypes: ["artist", "title", "year"], yearOptionSpread: "tight" },
      starThresholds: cfg.quiz2.stars, maxScore: cfg.quiz2.questionCount, unlockAfter: `${prefix}_4`,
    },
    {
      id: `${prefix}_6`, title: copy.pressureTitle || "Oś pod presją", type: "timeline",
      description: copy.pressureDescription || "Oś czasu na czas — krócej na decyzję i więcej kart do ułożenia.",
      params: { scoredCount: cfg.pressure.scoredCount, decisionSeconds: cfg.pressure.decisionSeconds },
      starThresholds: cfg.pressure.stars, maxScore: cfg.pressure.scoredCount, unlockAfter: `${prefix}_5`,
    },
    {
      id: `${prefix}_finale`, title: copy.finaleTitle, type: "finale", isFinale: true,
      description: copy.finaleDescription || "Trzy rundy: oś czasu, quiz i Zgadnij Rok. Liczy się łączny wynik.",
      params: {
        parts: [
          { type: "timeline", scoredCount: 4, decisionSeconds: 60 },
          { type: "quiz", questionCount: 4, questionTypes: ["artist", "title", "year"], yearOptionSpread: "tight" },
          { type: "yearGuess", rounds: 4, roundSeconds: 60, maxYearDiff: 2 },
        ],
      },
      starThresholds: cfg.finale.stars, maxScore: 12,
      perfectScore: cfg.finale.perfectScore,
      unlockAfter: `${prefix}_6`,
    },
  ];
}

const CHAPTERS = [
  {
    id: "roots",
    title: "DO 1969 — KORZENIE HITÓW",
    menuTitle: "Korzenie hitów",
    subtitle: "Do 1969 roku",
    description: "Najstarsze nagrania w bazie, narodziny rock'n'rolla i klasyki sprzed ery wielkich dekad.",
    decadeStart: null,
    decadeEnd: 1969,
    unlockAfterChapter: null,
    accent: "#f6cb62",
    accent2: "#ff8f70",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_roots" },
    stages: buildStages("roots", {
      timelineTitle: "U źródeł hitów",
      timelineDescription: "Ułóż najstarsze utwory HITSTERIADY w kolejności chronologicznej.",
      quizTitle: "Pierwsze przeboje",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata klasycznych nagrań sprzed 1970 roku.",
      yearTitle: "Który to rok?",
      rushTitle: "Retro Sprint",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Title: "Quiz klasyków",
      quiz2Description: "Sprawdź, jak dobrze pamiętasz najstarsze utwory, wykonawców i lata.",
      pressureTitle: "Oś pionierów",
      pressureDescription: "Ułóż kolejne klasyki na osi czasu przy krótszym limicie decyzji.",
      finaleTitle: "WIELKI FINAŁ — DO 1969",
    }, {
      // starsze utwory są mniej rozpoznawalne — pierwszy rozdział ma łagodniejszy próg wejścia
      timeline: { stars: [2, 4, 6] },
      quiz: { stars: [4, 6, 8] },
      yearGuess: { stars: [24, 40, 56] },
      quiz2: { stars: [5, 8, 10] },
      pressure: { stars: [3, 5, 7] },
      finale: { stars: [5, 8, 11] },
    }),
  },
  {
    id: "70s",
    title: "LATA 70. — ERA WINYLI",
    menuTitle: "Lata 70.",
    subtitle: "1970–1979",
    description: "Rock, disco, funk i wielkie albumy. Dziesięć lat, które rozkręciły muzykę na dobre.",
    decadeStart: 1970, decadeEnd: 1979,
    unlockAfterChapter: "roots",
    accent: "#ffb65a", accent2: "#ff6a88",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_70s" },
    stages: buildStages("70s", {
      timelineTitle: "Powrót do lat 70.",
      timelineDescription: "Ułóż utwory z lat 70. w kolejności chronologicznej.",
      quizTitle: "Gorączka hitów",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata muzyki lat 70.",
      rushTitle: "Winylowy Sprint",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Description: "Sprawdź, jak dobrze pamiętasz muzykę lat 70. — wykonawców, tytuły i lata.",
      finaleTitle: "WIELKI FINAŁ — LATA 70.",
    }),
  },
  {
    id: "80s",
    title: "LATA 80. — NEONOWA ERA",
    menuTitle: "Lata 80.",
    subtitle: "1980–1989",
    description: "Syntezatory, MTV, wielkie refreny i neon. Rozdział, od którego zaczęła się Kampania.",
    decadeStart: 1980, decadeEnd: 1989,
    unlockAfterChapter: "70s",
    accent: "#58e6ff", accent2: "#ff5fca",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_80s" },
    stages: buildStages("80s", {
      timelineTitle: "Powrót do lat 80.",
      timelineDescription: "Ułóż utwory z lat 80. w kolejności chronologicznej.",
      quizTitle: "Muzyczny Quiz",
      quizDescription: "Odpowiedz na pytania A/B/C/D o muzykę lat 80.",
      rushTitle: "Neonowy Sprint",
      rushDescription: "Masz 30 sekund na serię trafień! Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Description: "Sprawdź, jak dobrze pamiętasz muzykę lat 80. — wykonawców, tytuły i lata w jednym quizie.",
      finaleTitle: "WIELKI FINAŁ — LATA 80.",
    }),
  },
  {
    id: "90s",
    title: "LATA 90. — KASETOWY BOOM",
    menuTitle: "Lata 90.",
    subtitle: "1990–1999",
    description: "Kasety, CD, grunge, eurodance i pop. Dekada, w której wszystko mogło zostać hitem.",
    decadeStart: 1990, decadeEnd: 1999,
    unlockAfterChapter: "80s",
    accent: "#84ff9b", accent2: "#6fd7ff",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_90s" },
    stages: buildStages("90s", {
      timelineTitle: "Powrót do lat 90.",
      timelineDescription: "Ułóż utwory z lat 90. w kolejności chronologicznej.",
      quizTitle: "Kasetowy Quiz",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata muzyki lat 90.",
      rushTitle: "Turbo 90",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Description: "Sprawdź, jak dobrze pamiętasz muzykę lat 90. — wykonawców, tytuły i lata.",
      finaleTitle: "WIELKI FINAŁ — LATA 90.",
    }),
  },
  {
    id: "00s",
    title: "LATA 2000. — NOWE MILENIUM",
    menuTitle: "Lata 2000.",
    subtitle: "2000–2009",
    description: "MP3, teledyski, pop-punk, R&B i początki cyfrowej rewolucji.",
    decadeStart: 2000, decadeEnd: 2009,
    unlockAfterChapter: "90s",
    accent: "#8eb5ff", accent2: "#b56dff",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_00s" },
    stages: buildStages("00s", {
      timelineTitle: "Nowe milenium",
      timelineDescription: "Ułóż utwory z lat 2000. w kolejności chronologicznej.",
      quizTitle: "Cyfrowy Quiz",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata pierwszej cyfrowej dekady.",
      rushTitle: "Cyfrowy Sprint",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Description: "Przekrój przez muzykę lat 2000. — wykonawcy, tytuły i lata.",
      finaleTitle: "WIELKI FINAŁ — LATA 2000.",
    }),
  },
  {
    id: "10s",
    title: "LATA 2010. — ERA STREAMINGU",
    menuTitle: "Lata 2010.",
    subtitle: "2010–2019",
    description: "Streaming, EDM, nowe gwiazdy popu i hity, które podbijały playlisty całego świata.",
    decadeStart: 2010, decadeEnd: 2019,
    unlockAfterChapter: "00s",
    accent: "#8f7cff", accent2: "#ff72d5",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_10s" },
    stages: buildStages("10s", {
      timelineTitle: "Era streamingu",
      timelineDescription: "Ułóż utwory z lat 2010. w kolejności chronologicznej.",
      quizTitle: "Playlistowy Quiz",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata muzyki lat 2010.",
      rushTitle: "Streaming Sprint",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Description: "Sprawdź swoją pamięć do hitów, wykonawców i lat dekady streamingu.",
      finaleTitle: "WIELKI FINAŁ — LATA 2010.",
    }),
  },
  {
    id: "20s",
    title: "LATA 2020+ — TU I TERAZ",
    menuTitle: "Lata 2020+",
    subtitle: "2020–teraz",
    description: "Najnowsze hity, viralowe refreny i muzyka, która właśnie tworzy swoją historię.",
    decadeStart: 2020, decadeEnd: null,
    unlockAfterChapter: "10s",
    accent: "#62f4d1", accent2: "#ff5fca",
    completionReward: { xp: 250, hitcoin: 100, special: "campaign_edition_20s" },
    stages: buildStages("20s", {
      timelineTitle: "Tu i teraz",
      timelineDescription: "Ułóż najnowsze utwory w kolejności chronologicznej.",
      quizTitle: "Quiz współczesności",
      quizDescription: "Rozpoznaj wykonawców, tytuły i lata najnowszych hitów.",
      rushTitle: "Viral Sprint",
      rushDescription: "Masz 30 sekund na serię trafień. Zdobądź 10 combo, aby zakończyć etap zwycięstwem.",
      quiz2Title: "Co teraz gra?",
      quiz2Description: "Sprawdź, jak dobrze pamiętasz muzykę lat 2020+ — wykonawców, tytuły i lata.",
      finaleTitle: "WIELKI FINAŁ — LATA 2020+",
    }),
  },
];

export const CAMPAIGN = {
  id: "tour",
  title: "Trasa koncertowa",
  description: "Przemierzaj kolejne epoki muzyki, zdobywaj gwiazdki i odblokowuj następne rozdziały.",
  chapters: CHAPTERS,
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
