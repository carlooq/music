export const HIT_MATCH_REWARD_PER_STAR = Object.freeze({ xp: 20, hitcoin: 10 });

// ENCORE ma premiować szybkie kończenie, ale nie może sam gwarantować 3★.
// Progi są ustawiane osobno dla każdego levelu, bo cele i geometria planszy
// nie są porównywalne między rozdziałami.
const route1 = [
  { id:"level_1", number:1, title:"Pierwszy Drop", subtitle:"Rozgrzewka", moves:18, goals:{ vinyl:12, microphone:10 }, starScoreThresholds:{2:15500,3:20000}, endgameMoveBonus:750 },
  { id:"level_2", number:2, title:"Kasetowa Fala", subtitle:"Retro mix", moves:20, goals:{ cassette:18, note:10 }, starScoreThresholds:{2:19000,3:23000}, endgameMoveBonus:750 },
  { id:"level_3", number:3, title:"Słuchawkowy Set", subtitle:"Pełne brzmienie", moves:20, goals:{ headphones:18, speaker:12 }, starScoreThresholds:{2:19000,3:22500}, endgameMoveBonus:750 },
  { id:"level_4", number:4, title:"Neonowy Mix", subtitle:"Trzy symbole", moves:18, goals:{ vinyl:8, microphone:8, cassette:8 }, starScoreThresholds:{2:14500,3:19500}, endgameMoveBonus:750 },
  { id:"level_5", number:5, title:"Głośniej!", subtitle:"Podkręć scenę", moves:20, goals:{ speaker:16, note:16 }, starScoreThresholds:{2:19500,3:23500}, endgameMoveBonus:750 },
  { id:"level_6", number:6, title:"Kolorowa Scena", subtitle:"Potrójny cel", moves:18, goals:{ headphones:8, cassette:8, speaker:8 }, starScoreThresholds:{2:15500,3:19500}, endgameMoveBonus:750 },
  { id:"level_7", number:7, title:"Szybki Set", subtitle:"Mniej ruchów", moves:16, goals:{ vinyl:12, note:12 }, starScoreThresholds:{2:14500,3:19000}, endgameMoveBonus:800 },
  { id:"level_8", number:8, title:"Pełne Pasmo", subtitle:"Wszystko gra", moves:18, goals:{ vinyl:5, microphone:5, headphones:5, cassette:5, speaker:5, note:5 }, starScoreThresholds:{2:16000,3:19500}, endgameMoveBonus:800 },
  { id:"level_9", number:9, title:"Punkt Zapalny", subtitle:"Graj na wynik", moves:17, goals:{}, scoreGoal:14000, starScoreThresholds:{2:17500,3:21500}, endgameMoveBonus:800 },
  { id:"level_10", number:10, title:"Nocny Finał", subtitle:"Finał Neonowej Sceny", moves:20, goals:{ microphone:10, headphones:10, speaker:10 }, scoreGoal:14000, starScoreThresholds:{2:19500,3:23500}, endgameMoveBonus:800, finale:true },
];

const C = {
  corners:[0,7,56,63],
  deepCorners:[0,1,6,7,8,15,48,55,56,57,62,63],
  sideNotches:[24,31,32,39],
  plusCorners:[0,1,6,7,8,9,14,15,48,49,54,55,56,57,62,63],
  hourglass:[0,7,8,15,16,23,40,47,48,55,56,63],
};

const rectIndices = (rowStart, rowEnd, colStart, colEnd) => {
  const values = [];
  for (let row = rowStart; row <= rowEnd; row += 1) {
    for (let col = colStart; col <= colEnd; col += 1) values.push(row * 8 + col);
  }
  return values;
};
const REMIX_PAIR_MAP = Object.freeze({
  vinyl:"microphone",
  microphone:"vinyl",
  headphones:"note",
  note:"headphones",
  cassette:"speaker",
  speaker:"cassette",
});

// REMIX DECKS: geometria jest stała w obrębie levelu, zmieniają się WYŁĄCZNIE symbole.
const remixZone = (id, label, indices, extra = {}) => ({
  id,
  label,
  every:1,
  indices,
  ...extra,
});

const REMIX_LAYOUTS = Object.freeze({
  center4:rectIndices(2,5,2,5),
  row1:rectIndices(3,3,0,7),
  col1:rectIndices(0,7,4,4),
  bandH2:rectIndices(3,4,0,7),
  bandV2:rectIndices(0,7,3,4),
  diagonalA:rectIndices(1,2,0,3),
  diagonalB:rectIndices(5,6,4,7),
  sideA:rectIndices(2,5,0,1),
  sideB:rectIndices(2,5,6,7),
  padTL:rectIndices(0,1,0,1),
  padTR:rectIndices(0,1,6,7),
  padBR:rectIndices(6,7,6,7),
  padBL:rectIndices(6,7,0,1),
  crossRow:rectIndices(3,3,0,7),
  crossCol:rectIndices(0,7,4,4),
  finaleTop:rectIndices(0,1,0,7),
  finaleBottom:rectIndices(6,7,0,7),
});

// Poziomy 11–20: Shield blokuje RUCH kafla, ale nie jego udział w matchu.
// Warstwę można zdjąć matchem zawierającym osłonięty symbol albo matchem
// bezpośrednio obok (góra/dół/lewo/prawo).
const route2 = [
  { id:"level_11", number:11, title:"Wejście do Labu", subtitle:"Nowy układ · Neon Shield", moves:18, goals:{ cassette:12, note:12 }, layout:{ inactive:C.corners }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:17000,3:22000}, endgameMoveBonus:800 },
  { id:"level_12", number:12, title:"Światło Pod Napięciem", subtitle:"Więcej osłon", moves:19, goals:{ vinyl:12, microphone:10 }, layout:{ inactive:C.corners }, shields:[{index:17,hp:1},{index:18,hp:1},{index:21,hp:1},{index:22,hp:1},{index:41,hp:1},{index:46,hp:1}], starScoreThresholds:{2:18500,3:23000}, endgameMoveBonus:800 },
  { id:"level_13", number:13, title:"Ścięte Rogi", subtitle:"Mniej miejsca", moves:19, goals:{ headphones:12, speaker:12 }, layout:{ inactive:C.deepCorners }, shields:[{index:19,hp:1},{index:20,hp:1},{index:27,hp:1},{index:28,hp:1},{index:35,hp:1},{index:36,hp:1}], starScoreThresholds:{2:16500,3:21000}, endgameMoveBonus:800 },
  { id:"level_14", number:14, title:"Boczne Zakłócenia", subtitle:"Przerwany przepływ", moves:19, goals:{ cassette:10, note:10, microphone:8 }, layout:{ inactive:C.sideNotches }, shields:[{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1}], starScoreThresholds:{2:18000,3:21500}, endgameMoveBonus:850 },
  { id:"level_15", number:15, title:"Podwójna Warstwa", subtitle:"Shield x2", moves:20, goals:{ vinyl:10, speaker:10 }, layout:{ inactive:C.deepCorners }, shields:[{index:26,hp:2},{index:29,hp:2},{index:34,hp:2},{index:37,hp:2}], starScoreThresholds:{2:18500,3:23500}, endgameMoveBonus:850 },
  { id:"level_16", number:16, title:"Krzyżowy Remix", subtitle:"Węższa scena", moves:20, goals:{ headphones:10, cassette:10, note:10 }, layout:{ inactive:C.plusCorners }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:18000,3:22000}, endgameMoveBonus:850 },
  { id:"level_17", number:17, title:"Przebicie", subtitle:"Dużo osłon", moves:21, goals:{ microphone:10, speaker:10 }, scoreGoal:14000, layout:{ inactive:C.corners }, shields:[{index:10,hp:1},{index:13,hp:1},{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1},{index:50,hp:1},{index:53,hp:1}], starScoreThresholds:{2:20500,3:24500}, endgameMoveBonus:850 },
  { id:"level_18", number:18, title:"Klepsydra", subtitle:"Nietypowy przepływ", moves:20, goals:{ vinyl:8, headphones:8, cassette:8 }, layout:{ inactive:C.hourglass }, shields:[{index:27,hp:2},{index:28,hp:1},{index:35,hp:1},{index:36,hp:2}], starScoreThresholds:{2:19000,3:23500}, endgameMoveBonus:900 },
  { id:"level_19", number:19, title:"Ostatni Set", subtitle:"Ciasny limit", moves:21, goals:{ vinyl:8, microphone:8, headphones:8, speaker:8 }, layout:{ inactive:C.deepCorners }, shields:[{index:19,hp:1},{index:20,hp:1},{index:27,hp:2},{index:28,hp:2},{index:35,hp:2},{index:36,hp:2},{index:43,hp:1},{index:44,hp:1}], starScoreThresholds:{2:19000,3:23000}, endgameMoveBonus:900 },
  { id:"level_20", number:20, title:"Neon Lab: Finał", subtitle:"Finał Neon Lab", moves:26, goals:{ vinyl:6, microphone:6, headphones:6, cassette:6, speaker:6, note:6 }, scoreGoal:22000, layout:{ inactive:C.plusCorners }, shields:[{index:18,hp:2},{index:21,hp:2},{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1},{index:42,hp:2},{index:45,hp:2}], starScoreThresholds:{2:26000,3:32500}, endgameMoveBonus:900, finale:true },
];

// Poziomy 21–30: DROP THE MIC. Mikrofon wpada do DWUPOLowej strefy wyjścia
// na dole swojej kolumny — nie trzeba już wymuszać jednego, bardzo losowego
// ostatniego zbicia. Trudność rośnie przez liczbę celów, layout i Shieldy,
// a nie przez pech na ostatnim polu.
const route3 = [
  { id:"level_21", number:21, title:"Drop the Mic", subtitle:"Nowy cel · sprowadź mikrofon", moves:19, goals:{ note:8 }, deliveries:[{index:10}], deliveryGoal:1, starScoreThresholds:{2:15500,3:20500}, endgameMoveBonus:800 },
  { id:"level_22", number:22, title:"Podwójne Zejście", subtitle:"Dwa mikrofony", moves:21, goals:{ microphone:8 }, deliveries:[{index:10},{index:13}], deliveryGoal:2, starScoreThresholds:{2:18000,3:23000}, endgameMoveBonus:800 },
  { id:"level_23", number:23, title:"Ścięty Drop", subtitle:"Mniej miejsca", moves:21, goals:{ cassette:8, note:8 }, layout:{ inactive:C.corners }, deliveries:[{index:18},{index:21}], deliveryGoal:2, starScoreThresholds:{2:19000,3:24000}, endgameMoveBonus:825 },
  { id:"level_24", number:24, title:"Drop pod Presją", subtitle:"Delivery + wynik", moves:23, goals:{ vinyl:8 }, scoreGoal:13500, layout:{ inactive:C.sideNotches }, deliveries:[{index:11},{index:13}], deliveryGoal:2, starScoreThresholds:{2:21000,3:26500}, endgameMoveBonus:825 },
  { id:"level_25", number:25, title:"Zamknięta Droga", subtitle:"Drop Mic + Shield", moves:25, goals:{ speaker:8 }, layout:{ inactive:C.corners }, deliveries:[{index:10},{index:13}], deliveryGoal:2, shields:[{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1}], starScoreThresholds:{2:22000,3:28000}, endgameMoveBonus:850 },
  { id:"level_26", number:26, title:"Crossfade", subtitle:"Wąska scena", moves:23, goals:{ headphones:8, cassette:8 }, layout:{ inactive:C.plusCorners }, deliveries:[{index:19},{index:20}], deliveryGoal:2, starScoreThresholds:{2:20500,3:26000}, endgameMoveBonus:850 },
  { id:"level_27", number:27, title:"Backstage Rush", subtitle:"Trzy mikrofony", moves:25, goals:{}, scoreGoal:15500, layout:{ inactive:C.deepCorners }, deliveries:[{index:10},{index:12},{index:13}], deliveryGoal:3, starScoreThresholds:{2:23500,3:29500}, endgameMoveBonus:850 },
  { id:"level_28", number:28, title:"Blokada Basu", subtitle:"Drop + Shield x2", moves:26, goals:{ vinyl:7, note:7 }, layout:{ inactive:C.hourglass }, deliveries:[{index:27},{index:28}], deliveryGoal:2, shields:[{index:26,hp:1},{index:29,hp:1},{index:35,hp:2},{index:36,hp:2}], starScoreThresholds:{2:23000,3:29000}, endgameMoveBonus:875 },
  { id:"level_29", number:29, title:"Próba Generalna", subtitle:"Wszystko naraz", moves:27, goals:{ microphone:6, headphones:6, speaker:6 }, scoreGoal:17500, layout:{ inactive:C.sideNotches }, deliveries:[{index:10},{index:12},{index:21}], deliveryGoal:3, starScoreThresholds:{2:26500,3:32500}, endgameMoveBonus:875 },
  { id:"level_30", number:30, title:"Drop Zone: Finał", subtitle:"Finał Drop Zone", moves:30, goals:{ vinyl:3, microphone:3, headphones:3, cassette:3, speaker:3, note:3 }, scoreGoal:21000, layout:{ inactive:C.plusCorners }, deliveries:[{index:10},{index:11},{index:13},{index:20}], deliveryGoal:4, shields:[{index:26,hp:1},{index:29,hp:1},{index:35,hp:2},{index:36,hp:2},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:30500,3:37500}, endgameMoveBonus:900, finale:true },
];

// Poziomy 31–40: SETLIST. Cele wykonujemy po kolei — nic nie liczy się
// "na zapas". Po zakończeniu tracku aktywuje się kolejny na tej samej planszy.
const route4 = [
  { id:"level_31", number:31, title:"Pierwsza Setlista", subtitle:"Cele po kolei", moves:18, goals:{}, setlist:[
    { label:"INTRO", kind:"collect", type:"vinyl", target:6 },
    { label:"VERSE", kind:"collect", type:"microphone", target:6 },
  ], starScoreThresholds:{2:15000,3:20000}, endgameMoveBonus:800 },
  { id:"level_32", number:32, title:"Trzy Tracki", subtitle:"Dłuższy set", moves:20, goals:{}, setlist:[
    { label:"INTRO", kind:"collect", type:"note", target:6 },
    { label:"VERSE", kind:"collect", type:"cassette", target:6 },
    { label:"DROP", kind:"collect", type:"headphones", target:6 },
  ], starScoreThresholds:{2:17500,3:22500}, endgameMoveBonus:800 },
  { id:"level_33", number:33, title:"Set pod Napięciem", subtitle:"Ścięte rogi", moves:21, goals:{}, layout:{ inactive:C.corners }, setlist:[
    { label:"INTRO", kind:"collect", type:"speaker", target:7 },
    { label:"VERSE", kind:"collect", type:"vinyl", target:7 },
    { label:"DROP", kind:"collect", type:"note", target:7 },
  ], starScoreThresholds:{2:18500,3:23500}, endgameMoveBonus:825 },
  { id:"level_34", number:34, title:"Basowy Refren", subtitle:"Pierwsze zadanie specjalne", moves:22, goals:{}, setlist:[
    { label:"INTRO", kind:"collect", type:"microphone", target:7 },
    { label:"REFREN", kind:"special", special:"line", target:1 },
    { label:"OUTRO", kind:"collect", type:"cassette", target:7 },
  ], starScoreThresholds:{2:20500,3:25500}, endgameMoveBonus:825 },
  { id:"level_35", number:35, title:"Linia Basu", subtitle:"Set + Bass Line", moves:23, goals:{}, setlist:[
    { label:"INTRO", kind:"collect", type:"headphones", target:8 },
    { label:"DROP", kind:"special", special:"line", target:1 },
    { label:"OUTRO", kind:"collect", type:"speaker", target:8 },
  ], starScoreThresholds:{2:21500,3:27000}, endgameMoveBonus:850 },
  { id:"level_36", number:36, title:"Set za Osłoną", subtitle:"Setlist + Neon Shield", moves:24, goals:{}, layout:{ inactive:C.corners }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], setlist:[
    { label:"INTRO", kind:"collect", type:"note", target:7 },
    { label:"VERSE", kind:"collect", type:"vinyl", target:7 },
    { label:"DROP", kind:"special", special:"line", target:1 },
  ], starScoreThresholds:{2:22500,3:28000}, endgameMoveBonus:850 },
  { id:"level_37", number:37, title:"Mic w Setliście", subtitle:"Setlist + Drop Mic", moves:24, goals:{}, layout:{ inactive:C.sideNotches }, deliveries:[{index:11}], deliveryGoal:1, setlist:[
    { label:"INTRO", kind:"collect", type:"cassette", target:7 },
    { label:"VERSE", kind:"collect", type:"microphone", target:7 },
    { label:"OUTRO", kind:"collect", type:"speaker", target:7 },
  ], starScoreThresholds:{2:22500,3:28500}, endgameMoveBonus:850 },
  { id:"level_38", number:38, title:"Cztery Części", subtitle:"Pełny koncert", moves:25, goals:{}, layout:{ inactive:C.deepCorners }, setlist:[
    { label:"INTRO", kind:"collect", type:"vinyl", target:6 },
    { label:"VERSE", kind:"collect", type:"headphones", target:6 },
    { label:"DROP", kind:"collect", type:"note", target:6 },
    { label:"OUTRO", kind:"collect", type:"speaker", target:6 },
  ], starScoreThresholds:{2:23500,3:29500}, endgameMoveBonus:875 },
  { id:"level_39", number:39, title:"Techniczny Set", subtitle:"Bass Line + zbieranie", moves:26, goals:{}, setlist:[
    { label:"INTRO", kind:"special", special:"line", target:1 },
    { label:"VERSE", kind:"collect", type:"microphone", target:8 },
    { label:"DROP", kind:"collect", type:"cassette", target:8 },
    { label:"OUTRO", kind:"collect", type:"note", target:8 },
  ], starScoreThresholds:{2:25000,3:31500}, endgameMoveBonus:875 },
  { id:"level_40", number:40, title:"Setlist: Finał", subtitle:"Finał Setlist", moves:29, goals:{}, layout:{ inactive:C.plusCorners }, shields:[{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1}], setlist:[
    { label:"INTRO", kind:"collect", type:"vinyl", target:6 },
    { label:"VERSE", kind:"collect", type:"headphones", target:6 },
    { label:"DROP", kind:"collect", type:"speaker", target:6 },
    { label:"ENCORE", kind:"special", special:"line", target:1 },
  ], starScoreThresholds:{2:28500,3:35000}, endgameMoveBonus:900, finale:true },
];

// Poziomy 41–50: MYSTERY TRACK. Nieruchomy kafel uruchamia quiz po trafieniu
// matchem/efektem na nim lub bezpośrednio obok. Dobra odpowiedź usuwa kafel,
// zła zostawia go w miejscu. Maksymalnie jeden quiz Mystery Track na ruch.
const route5 = [
  { id:"level_41", number:41, title:"Pierwszy Mystery Track", subtitle:"Match → quiz → unlock", moves:15, goals:{ note:8 }, mysteries:[{index:27},{index:36}], mysteryGoal:2, starScoreThresholds:{2:17500,3:22500}, endgameMoveBonus:800 },
  { id:"level_42", number:42, title:"Trzy Zagadki", subtitle:"Więcej Mystery Tracków", moves:16, goals:{ vinyl:8 }, layout:{ inactive:C.corners }, mysteries:[{index:18},{index:29},{index:42}], mysteryGoal:3, starScoreThresholds:{2:19500,3:24500}, endgameMoveBonus:825 },
  { id:"level_43", number:43, title:"Ukryty Refren", subtitle:"Quiz + zbieranie", moves:16, goals:{ headphones:8, vinyl:6 }, mysteries:[{index:19},{index:28},{index:35}], mysteryGoal:3, starScoreThresholds:{2:21000,3:26500}, endgameMoveBonus:825 },
  { id:"level_44", number:44, title:"Punkt Tajemnicy", subtitle:"Quiz + wynik", moves:17, goals:{ cassette:8 }, scoreGoal:13000, mysteries:[{index:10},{index:21},{index:42},{index:53}], mysteryGoal:4, starScoreThresholds:{2:22500,3:28000}, endgameMoveBonus:850 },
  { id:"level_45", number:45, title:"Zablokowany Track", subtitle:"Mystery + Shield", moves:18, goals:{ speaker:8 }, layout:{ inactive:C.corners }, mysteries:[{index:18},{index:21},{index:42}], mysteryGoal:3, shields:[{index:27,hp:1},{index:36,hp:1}], starScoreThresholds:{2:23000,3:29000}, endgameMoveBonus:850 },
  { id:"level_46", number:46, title:"Cztery Odpowiedzi", subtitle:"Cztery Mystery Tracki", moves:18, goals:{ microphone:8, note:8 }, mysteries:[{index:19},{index:28},{index:35},{index:44}], mysteryGoal:4, starScoreThresholds:{2:24000,3:30000}, endgameMoveBonus:850 },
  { id:"level_47", number:47, title:"Backstage Quiz", subtitle:"Ciasna scena", moves:19, goals:{ vinyl:8 }, layout:{ inactive:C.deepCorners }, mysteries:[{index:18},{index:21},{index:42},{index:45}], mysteryGoal:4, starScoreThresholds:{2:24000,3:30500}, endgameMoveBonus:875 },
  { id:"level_48", number:48, title:"Pięć Tracków", subtitle:"Mystery + przeszkody", moves:20, goals:{ headphones:7, cassette:7 }, layout:{ inactive:C.sideNotches }, mysteries:[{index:10},{index:13},{index:26},{index:37},{index:50}], mysteryGoal:5, shields:[{index:27,hp:1},{index:36,hp:1}], starScoreThresholds:{2:26000,3:32500}, endgameMoveBonus:875 },
  { id:"level_49", number:49, title:"Próba Wiedzy", subtitle:"Duży quizowy set", moves:21, goals:{ microphone:6, speaker:6, note:6 }, layout:{ inactive:C.hourglass }, mysteries:[{index:18},{index:21},{index:27},{index:36},{index:45}], mysteryGoal:5, starScoreThresholds:{2:27500,3:34000}, endgameMoveBonus:900 },
  { id:"level_50", number:50, title:"Mystery Show: Finał", subtitle:"Finał Mystery Track", moves:23, goals:{ vinyl:3, microphone:3, headphones:3, cassette:3, speaker:3, note:3 }, scoreGoal:22000, layout:{ inactive:C.plusCorners }, mysteries:[{index:18},{index:21},{index:27},{index:36},{index:45}], mysteryGoal:5, shields:[{index:26,hp:1},{index:29,hp:1},{index:34,hp:1},{index:37,hp:1}], starScoreThresholds:{2:31500,3:38500}, endgameMoveBonus:900, finale:true },
];

// LAB 51–60 — REMIX DECKS. Poziomy wyłącznie do panelu admina.
// Nie są częścią publicznego progresu, rankingu ani systemu nagród.
const routeLabRemix = [
  { id:"lab_level_51", number:51, title:"Remix 101", subtitle:"Centralny deck 4×4", moves:12, goals:{ vinyl:20, microphone:20 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 4×4",REMIX_LAYOUTS.center4)] }, starScoreThresholds:{2:17000,3:23000}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_52", number:52, title:"Wave Rider", subtitle:"Stały poziomy pas 8×1", moves:13, goals:{ headphones:22, note:22 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 8×1",REMIX_LAYOUTS.row1)] }, shields:[{index:18,hp:1},{index:21,hp:1},{index:42,hp:1},{index:45,hp:1}], starScoreThresholds:{2:19500,3:25500}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_53", number:53, title:"Vertical Mix", subtitle:"Stała pionowa kolumna 1×8", moves:14, goals:{ cassette:22, speaker:22 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 1×8",REMIX_LAYOUTS.col1)] }, starScoreThresholds:{2:20000,3:26500}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_54", number:54, title:"Wide Band", subtitle:"Środkowy poziomy pas 8×2", moves:14, goals:{ vinyl:18, headphones:18, cassette:18 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 8×2",REMIX_LAYOUTS.bandH2)] }, starScoreThresholds:{2:21500,3:28000}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_55", number:55, title:"Sidechain", subtitle:"Środkowy pionowy pas 2×8 + Shield", moves:14, goals:{ microphone:18, note:18, speaker:18 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 2×8",REMIX_LAYOUTS.bandV2)] }, shields:[{index:9,hp:1},{index:18,hp:1},{index:45,hp:1},{index:54,hp:1}], starScoreThresholds:{2:22500,3:29000}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_56", number:56, title:"Dual Slide", subtitle:"Dwa stałe decki 4×2 po przekątnej", moves:15, goals:{ vinyl:22, speaker:22 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 4×2",REMIX_LAYOUTS.diagonalA),remixZone("B","DECK B · 4×2",REMIX_LAYOUTS.diagonalB)] }, shields:[{index:27,hp:2},{index:28,hp:2},{index:35,hp:2},{index:36,hp:2}], starScoreThresholds:{2:23500,3:30500}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_57", number:57, title:"Split Set", subtitle:"Dwa stałe decki 2×4 po bokach + Setlist", moves:19, goals:{}, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · 2×4",REMIX_LAYOUTS.sideA),remixZone("B","DECK B · 2×4",REMIX_LAYOUTS.sideB)] }, setlist:[{label:"INTRO",kind:"collect",type:"vinyl",target:18},{label:"DROP",kind:"collect",type:"headphones",target:18},{label:"OUTRO",kind:"special",special:"line",target:1}], starScoreThresholds:{2:24500,3:31500}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_58", number:58, title:"Four Pads", subtitle:"Cztery stałe narożne pola 2×2", moves:15, goals:{ note:20 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","PAD A · 2×2",REMIX_LAYOUTS.padTL),remixZone("B","PAD B · 2×2",REMIX_LAYOUTS.padTR),remixZone("C","PAD C · 2×2",REMIX_LAYOUTS.padBR),remixZone("D","PAD D · 2×2",REMIX_LAYOUTS.padBL)] }, mysteries:[{index:18},{index:45},{index:53}], mysteryGoal:3, starScoreThresholds:{2:25000,3:32000}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_59", number:59, title:"Cross Mix", subtitle:"Stały krzyż 8×1 + 1×8", moves:16, goals:{ vinyl:16, microphone:16, headphones:16, note:16 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","HORIZONTAL · 8×1",REMIX_LAYOUTS.crossRow),remixZone("B","VERTICAL · 1×8",REMIX_LAYOUTS.crossCol)] }, starScoreThresholds:{2:26500,3:34000}, endgameMoveBonus:0, testOnly:true, noRewards:true },
  { id:"lab_level_60", number:60, title:"Remix: Finał", subtitle:"Dwa pasy u góry i na dole · jednoczesny flip", moves:17, goals:{ vinyl:10, microphone:10, headphones:10, cassette:10, speaker:10, note:10 }, remix:{ pairMap:REMIX_PAIR_MAP, zones:[remixZone("A","DECK A · GÓRA 8×2",REMIX_LAYOUTS.finaleTop),remixZone("B","DECK B · DÓŁ 8×2",REMIX_LAYOUTS.finaleBottom)] }, shields:[{index:18,hp:1},{index:26,hp:1},{index:45,hp:1},{index:53,hp:1}], starScoreThresholds:{2:28500,3:36000}, endgameMoveBonus:0, testOnly:true, noRewards:true, finale:true },
]


const SWAP_LAYOUTS = Object.freeze({
  miniA:rectIndices(1,2,1,2),miniB:rectIndices(5,6,5,6),
  colsA:rectIndices(2,5,1,1),colsB:rectIndices(2,5,6,6),
  bandsA:rectIndices(1,2,1,4),bandsB:rectIndices(5,6,3,6),
  sidesA:rectIndices(2,5,0,1),sidesB:rectIndices(2,5,6,7),
  diagonalA:rectIndices(1,2,0,3),diagonalB:rectIndices(5,6,4,7),
  tallA:rectIndices(0,7,2,2),tallB:rectIndices(0,7,5,5),
  innerA:rectIndices(2,5,1,2),innerB:rectIndices(2,5,5,6),
  quadA:rectIndices(1,2,1,2),quadB:rectIndices(1,2,5,6),
  quadC:rectIndices(5,6,1,2),quadD:rectIndices(5,6,5,6),
});
const swapZone = (id,indices) => ({id,label:`DECK ${id}`,indices});
const pairDecks = (a,b) => ({zones:[swapZone("A",a),swapZone("B",b)],pairs:[["A","B"]]});
const fourDecks = () => ({
  zones:[swapZone("A",SWAP_LAYOUTS.quadA),swapZone("B",SWAP_LAYOUTS.quadB),swapZone("C",SWAP_LAYOUTS.quadC),swapZone("D",SWAP_LAYOUTS.quadD)],
  pairs:[["A","B"],["C","D"]],
});
const roadCase = (index,hp=1) => ({index,hp,kind:"case"});
const stageSwapLevel = (number,title,subtitle,moves,goals,deckSwap,shields,extra={}) => ({
  id:`lab_level_${number}`,number,title,subtitle,moves,goals,deckSwap,shields,
  starScoreThresholds:{2:19500+(number-61)*1300,3:25500+(number-61)*1600},
  endgameMoveBonus:0,testOnly:true,noRewards:true,...extra,
});
const routeLabDeckSwap = [
  stageSwapLevel(61,"Pierwsza Zamiana","Dwa decki 2×2 + Road Case",15,{vinyl:12,microphone:12},pairDecks(SWAP_LAYOUTS.miniA,SWAP_LAYOUTS.miniB),[roadCase(27),roadCase(36)]),
  stageSwapLevel(62,"Side to Side","Dwie kolumny 1×4",16,{headphones:14,note:14},pairDecks(SWAP_LAYOUTS.colsA,SWAP_LAYOUTS.colsB),[roadCase(18),roadCase(45)]),
  stageSwapLevel(63,"Heavy Rotation","Dwa decki 4×2 + Case HP2",17,{cassette:15,speaker:15},pairDecks(SWAP_LAYOUTS.bandsA,SWAP_LAYOUTS.bandsB),[roadCase(10,2),roadCase(44,2),roadCase(28)]),
  stageSwapLevel(64,"Split Stage","Rozdzielone boki i blokady",18,{vinyl:13,note:13},pairDecks(SWAP_LAYOUTS.sidesA,SWAP_LAYOUTS.sidesB),[roadCase(18),roadCase(45,2),roadCase(28)],{layout:{inactive:C.corners}}),
  stageSwapLevel(65,"Cross Cargo","Ukośne pasy + Case HP2",19,{microphone:17,speaker:17},pairDecks(SWAP_LAYOUTS.diagonalA,SWAP_LAYOUTS.diagonalB),[roadCase(9,2),roadCase(54,2),roadCase(27)]),
  stageSwapLevel(66,"Column Shift","Dwa pionowe decki 1×8",19,{headphones:18,cassette:18},pairDecks(SWAP_LAYOUTS.tallA,SWAP_LAYOUTS.tallB),[roadCase(18),roadCase(21,2),roadCase(42),roadCase(45,2)],{layout:{inactive:C.corners}}),
  stageSwapLevel(67,"Double Trouble","Road Case + Neon Shield",20,{vinyl:15,headphones:15,speaker:15},pairDecks(SWAP_LAYOUTS.innerA,SWAP_LAYOUTS.innerB),[roadCase(18,2),roadCase(45,2),{index:27,hp:1},{index:36,hp:1}]),
  stageSwapLevel(68,"Four Stations","Cztery decki 2×2 parami",20,{vinyl:14,microphone:14,note:14},fourDecks(),[roadCase(18),roadCase(21),roadCase(42,2),roadCase(45,2)]),
  stageSwapLevel(69,"Set Swap","Deck Swap + Setlist + Road Case",24,{},pairDecks(SWAP_LAYOUTS.innerA,SWAP_LAYOUTS.innerB),[roadCase(11),roadCase(52,2)],{setlist:[{label:"INTRO",kind:"collect",type:"vinyl",target:12},{label:"DROP",kind:"collect",type:"headphones",target:12},{label:"OUTRO",kind:"special",special:"line",target:1}]}),
  stageSwapLevel(70,"Deck Swap: Finał","Dwa duże decki + Case HP2",25,{vinyl:8,microphone:8,headphones:8,cassette:8,speaker:8,note:8},pairDecks(SWAP_LAYOUTS.bandsA,SWAP_LAYOUTS.bandsB),[roadCase(18,2),roadCase(19),roadCase(44,2),roadCase(45),{index:27,hp:1},{index:36,hp:1}],{finale:true}),
];

export const HIT_MATCH_LEVELS = Object.freeze([...route1, ...route2, ...route3, ...route4, ...route5].map((level) => ({ ...level, rewardPerStar:HIT_MATCH_REWARD_PER_STAR })));

export const HIT_MATCH_LAB_LEVELS = Object.freeze([...routeLabRemix,...routeLabDeckSwap].map((level) => ({ ...level, rewardPerStar:{ xp:0, hitcoin:0 } })));
export const HIT_MATCH_LAB_STAGE = Object.freeze({ id:"lab_route_6", number:6, title:"REMIX DECKS · LAB", subtitle:"Testy 51–60", from:51, to:60, mechanic:"Stałe decki · jednoczesny flip symboli", testOnly:true });
export const HIT_MATCH_SWAP_LAB_STAGE = Object.freeze({ id:"lab_route_7", number:7, title:"DECK SWAP · LAB", subtitle:"Testy 61–70", from:61, to:70, mechanic:"Zamiana zawartości decków + Road Case", testOnly:true });

export const HIT_MATCH_STAGES = Object.freeze([
  { id:"route_1", number:1, title:"NEONOWA SCENA", subtitle:"Poziomy 1–10", from:1, to:10, mechanic:"Klasyczna plansza" },
  { id:"route_2", number:2, title:"NEON LAB", subtitle:"Poziomy 11–20", from:11, to:20, mechanic:"Wycięte pola + Neon Shield" },
  { id:"route_3", number:3, title:"DROP ZONE", subtitle:"Poziomy 21–30", from:21, to:30, mechanic:"Drop the Mic + przeszkody" },
  { id:"route_4", number:4, title:"SETLIST", subtitle:"Poziomy 31–40", from:31, to:40, mechanic:"Cele wykonywane po kolei" },
  { id:"route_5", number:5, title:"MYSTERY TRACK", subtitle:"Poziomy 41–50", from:41, to:50, mechanic:"Match aktywuje muzyczny quiz" },
]);

export const HIT_MATCH_TOTAL_STARS = HIT_MATCH_LEVELS.length * 3;
export const HIT_MATCH_LEVEL_1 = HIT_MATCH_LEVELS[0];

export function getHitMatchLevel(levelId) {
  return HIT_MATCH_LEVELS.find((level) => level.id === levelId) || HIT_MATCH_LEVEL_1;
}

export function getHitMatchStage(levelNumber) {
  return HIT_MATCH_STAGES.find((stage) => levelNumber >= stage.from && levelNumber <= stage.to) || HIT_MATCH_STAGES[0];
}

export function createShieldState(level) {
  return Object.fromEntries((level?.shields || []).map(({ index, hp = 1 }) => [Number(index), Math.max(1, Number(hp || 1))]));
}

export function countShieldHp(shields = {}) {
  return Object.values(shields || {}).reduce((sum, hp) => sum + Math.max(0, Number(hp || 0)), 0);
}

export function countShieldCells(shields = {}) {
  return Object.values(shields || {}).filter((hp) => Number(hp || 0) > 0).length;
}

export function createMysteryState(level) {
  return Object.fromEntries((level?.mysteries || []).map(({ index }) => [Number(index), true]));
}

function neighbours4(index) {
  const row = Math.floor(index / 8);
  const col = index % 8;
  const values = [];
  if (row > 0) values.push(index - 8);
  if (row < 7) values.push(index + 8);
  if (col > 0) values.push(index - 1);
  if (col < 7) values.push(index + 1);
  return values;
}

function deliveryExitIndices(col, inactive = new Set(), depth = 2) {
  const exits = [];
  for (let row = 7; row >= 0 && exits.length < depth; row -= 1) {
    const index = row * 8 + col;
    if (!inactive.has(index)) exits.push(index);
  }
  return exits;
}

export function validateHitMatchLevelDefinitions(levels = HIT_MATCH_LEVELS) {
  const issues = [];
  for (const level of levels) {
    const inactive = new Set(level?.layout?.inactive || []);
    const seen = new Set();
    const shieldSet = new Set();
    for (const shield of level?.shields || []) {
      const index = Number(shield?.index);
      const hp = Number(shield?.hp ?? 1);
      if (!Number.isInteger(index) || index < 0 || index >= 64) issues.push(`Level ${level.number}: nieprawidłowy indeks Shield ${shield?.index}`);
      if (inactive.has(index)) issues.push(`Level ${level.number}: Shield ${index} leży na wyciętym polu`);
      if (seen.has(index)) issues.push(`Level ${level.number}: zduplikowany Shield ${index}`);
      if (!Number.isFinite(hp) || hp < 1) issues.push(`Level ${level.number}: Shield ${index} ma nieprawidłowe HP ${shield?.hp}`);
      seen.add(index);
      shieldSet.add(index);
    }

    const remaining = new Set(shieldSet);
    let changed = true;
    while (remaining.size && changed) {
      changed = false;
      for (const index of [...remaining]) {
        const hasOpenSide = neighbours4(index).some((n) => !inactive.has(n) && !remaining.has(n));
        if (hasOpenSide) {
          remaining.delete(index);
          changed = true;
        }
      }
    }
    if (remaining.size) issues.push(`Level ${level.number}: nierozbijalny układ Shield (${[...remaining].join(", ")})`);

    const deliverySeen = new Set();
    for (const item of level?.deliveries || []) {
      const index = Number(item?.index);
      if (!Number.isInteger(index) || index < 0 || index >= 64) issues.push(`Level ${level.number}: nieprawidłowy indeks Drop Mic ${item?.index}`);
      if (inactive.has(index)) issues.push(`Level ${level.number}: Drop Mic ${index} leży na wyciętym polu`);
      if (shieldSet.has(index)) issues.push(`Level ${level.number}: Drop Mic ${index} koliduje z Shieldem`);
      if (deliverySeen.has(index)) issues.push(`Level ${level.number}: zduplikowany Drop Mic ${index}`);
      deliverySeen.add(index);
      const col = index % 8;
      const exits = deliveryExitIndices(col, inactive, 2);
      if (exits.includes(index)) issues.push(`Level ${level.number}: Drop Mic ${index} startuje już w strefie wyjścia`);
      const hasPath = Array.from({ length: 8 - Math.floor(index / 8) - 1 }, (_, offset) => index + (offset + 1) * 8)
        .some((candidate) => !inactive.has(candidate));
      if (!hasPath) issues.push(`Level ${level.number}: Drop Mic ${index} nie ma drogi w dół`);
    }
    if ((level?.deliveries || []).length && Number(level.deliveryGoal || 0) !== (level.deliveries || []).length) {
      issues.push(`Level ${level.number}: deliveryGoal nie zgadza się z liczbą Drop Mic`);
    }

    for (const [trackIndex, track] of (level?.setlist || []).entries()) {
      if (!["collect","special"].includes(track?.kind)) issues.push(`Level ${level.number}: SETLIST track ${trackIndex + 1} ma nieznany typ ${track?.kind}`);
      if (!Number.isFinite(Number(track?.target)) || Number(track?.target) < 1) issues.push(`Level ${level.number}: SETLIST track ${trackIndex + 1} ma błędny target`);
      if (track?.kind === "collect" && !["vinyl","microphone","headphones","cassette","speaker","note"].includes(track?.type)) issues.push(`Level ${level.number}: SETLIST track ${trackIndex + 1} ma błędny symbol`);
      if (track?.kind === "special" && track?.special !== "line") issues.push(`Level ${level.number}: SETLIST track ${trackIndex + 1} może wymagać tylko match-4 / Bass Line`);
    }

    const mysterySeen = new Set();
    for (const mystery of level?.mysteries || []) {
      const index = Number(mystery?.index);
      if (!Number.isInteger(index) || index < 0 || index >= 64) issues.push(`Level ${level.number}: nieprawidłowy indeks Mystery Track ${mystery?.index}`);
      if (inactive.has(index)) issues.push(`Level ${level.number}: Mystery Track ${index} leży na wyciętym polu`);
      if (shieldSet.has(index)) issues.push(`Level ${level.number}: Mystery Track ${index} koliduje z Shieldem`);
      if (deliverySeen.has(index)) issues.push(`Level ${level.number}: Mystery Track ${index} koliduje z Drop Mic`);
      if (mysterySeen.has(index)) issues.push(`Level ${level.number}: zduplikowany Mystery Track ${index}`);
      mysterySeen.add(index);
      const hasOpenSide = neighbours4(index).some((n) => !inactive.has(n) && !shieldSet.has(n) && !mysterySeen.has(n));
      if (!hasOpenSide) issues.push(`Level ${level.number}: Mystery Track ${index} nie ma aktywnego sąsiada`);
    }
    if ((level?.mysteries || []).length && Number(level.mysteryGoal || 0) !== (level.mysteries || []).length) {
      issues.push(`Level ${level.number}: mysteryGoal nie zgadza się z liczbą Mystery Tracków`);
    }

    if (level.deckSwap) {
      const decks = new Map((level.deckSwap.zones || []).map((zone) => [zone.id,zone.indices || []]));
      const occupied = new Set();
      (level.deckSwap.zones || []).forEach((zone) => (zone.indices || []).forEach((raw) => {
        const idx=Number(raw);
        if (!Number.isInteger(idx) || idx<0 || idx>=64 || inactive.has(idx)) issues.push(`Level ${level.number}: błędne pole decku ${zone.id} (${raw})`);
        if (occupied.has(idx)) issues.push(`Level ${level.number}: nakładające się decki na ${idx}`);
        occupied.add(idx);
      }));
      (level.deckSwap.pairs || []).forEach(([a,b]) => {
        if (!decks.has(a) || !decks.has(b)) issues.push(`Level ${level.number}: nieznane decki ${a}/${b}`);
        else if (decks.get(a).length!==decks.get(b).length) issues.push(`Level ${level.number}: różny rozmiar decków ${a}/${b}`);
      });
    }
    if (Number(level.endgameMoveBonus || 0) > 1000) issues.push(`Level ${level.number}: bonus ENCORE zbyt wysoki (${level.endgameMoveBonus})`);
    const two = Number(level?.starScoreThresholds?.[2] || 0);
    const three = Number(level?.starScoreThresholds?.[3] || 0);
    if (!two || !three || three <= two) issues.push(`Level ${level.number}: błędne progi gwiazdek`);
  }
  return issues;
}

export function isHitMatchLevelCompleted(level, stats = {}) {
  const collected = stats.collected || {};
  const collectOk = Object.entries(level?.goals || {}).every(([type, target]) => Number(collected[type] || 0) >= Number(target || 0));
  const scoreOk = !level?.scoreGoal || Number(stats.score || 0) >= Number(level.scoreGoal || 0);
  const shieldsOk = !(level?.shields || []).length || Number(stats.shieldsRemaining || 0) <= 0;
  const deliveryOk = !(level?.deliveries || []).length || Number(stats.delivered || 0) >= Number(level.deliveryGoal || level.deliveries.length);
  const setlistOk = !(level?.setlist || []).length || Number(stats.setlistStep || 0) >= Number(level.setlist.length);
  const mysteryOk = !(level?.mysteries || []).length || Number(stats.mysteryRemaining || 0) <= 0;
  return collectOk && scoreOk && shieldsOk && deliveryOk && setlistOk && mysteryOk;
}

export function starsForHitMatchLevel(level, score, completed) {
  if (!completed) return 0;
  let stars = 1;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[2] || Infinity)) stars = 2;
  if (Number(score || 0) >= Number(level?.starScoreThresholds?.[3] || Infinity)) stars = 3;
  return stars;
}

// Deploy sync: SETLIST uses match-4/Bass Line objectives only; no bomb objectives.
