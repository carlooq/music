export const HIT_MATCH_ROWS = 8;
export const HIT_MATCH_COLS = 8;

export const HIT_MATCH_TYPES = [
  "vinyl",
  "microphone",
  "headphones",
  "cassette",
  "speaker",
  "note",
];

let tileSequence = 0;

export function makeHitMatchTile(type = randomType(), extra = {}) {
  tileSequence += 1;
  return {
    id: `hm_${Date.now().toString(36)}_${tileSequence.toString(36)}`,
    type,
    special: null,
    ...extra,
  };
}

export function randomType(exclude = []) {
  const pool = HIT_MATCH_TYPES.filter((type) => !exclude.includes(type));
  return pool[Math.floor(Math.random() * pool.length)] || HIT_MATCH_TYPES[0];
}

export function rowOf(index) {
  return Math.floor(index / HIT_MATCH_COLS);
}

export function colOf(index) {
  return index % HIT_MATCH_COLS;
}

export function indexOf(row, col) {
  return row * HIT_MATCH_COLS + col;
}

export function areAdjacent(a, b) {
  if (a === null || b === null || a === undefined || b === undefined) return false;
  const ar = rowOf(a);
  const ac = colOf(a);
  const br = rowOf(b);
  const bc = colOf(b);
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}

export function swapBoardCells(board, a, b) {
  const next = board.slice();
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function createsImmediateTriple(board, index, type, blockedIndices = []) {
  // blockedIndices oznacza teraz wyłącznie pola NIERUCHOME (Shield): nie można
  // nimi swapować i zatrzymują grawitację, ale ich symbol nadal normalnie
  // uczestniczy w match-3+. Dlatego przy wykrywaniu gotowego matcha nie
  // traktujemy Shielda jak dziury w planszy. Parametr zostaje dla zgodności API.
  void blockedIndices;
  const row = rowOf(index);
  const col = colOf(index);
  if (col >= 2) {
    const a = board[index - 1];
    const b = board[index - 2];
    if (a?.type === type && b?.type === type) return true;
  }
  if (row >= 2) {
    const a = board[index - HIT_MATCH_COLS];
    const b = board[index - HIT_MATCH_COLS * 2];
    if (a?.type === type && b?.type === type) return true;
  }
  return false;
}

function inactiveSetOf(inactiveIndices = []) {
  return inactiveIndices instanceof Set ? inactiveIndices : new Set(inactiveIndices || []);
}

export function createPlayableBoard(inactiveIndices = [], blockedIndices = []) {
  const inactive = inactiveSetOf(inactiveIndices);
  const blocked = inactiveSetOf(blockedIndices);
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const board = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
    for (let i = 0; i < board.length; i += 1) {
      if (inactive.has(i)) continue;
      const disallowed = [];
      for (const type of HIT_MATCH_TYPES) {
        if (createsImmediateTriple(board, i, type, blocked)) disallowed.push(type);
      }
      board[i] = makeHitMatchTile(randomType(disallowed));
    }
    if (findMatches(board, blocked).length === 0 && hasPossibleMove(board, inactive, blocked)) return board;
  }

  const board = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
  for (let i = 0; i < board.length; i += 1) {
    if (inactive.has(i)) continue;
    const disallowed = [];
    for (const type of HIT_MATCH_TYPES) {
      if (createsImmediateTriple(board, i, type, blocked)) disallowed.push(type);
    }
    board[i] = makeHitMatchTile(randomType(disallowed));
  }
  return board;
}


export function createLevelBoard(inactiveIndices = [], blockedIndices = [], deliveryIndices = []) {
  const inactive = inactiveSetOf(inactiveIndices);
  const blocked = inactiveSetOf(blockedIndices);
  const deliveries = [...new Set((deliveryIndices || []).map(Number).filter((index) => Number.isInteger(index) && index >= 0 && index < HIT_MATCH_ROWS * HIT_MATCH_COLS && !inactive.has(index)))];

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const board = createPlayableBoard(inactive, blocked);
    deliveries.forEach((index, order) => {
      board[index] = makeHitMatchTile("delivery", { delivery:true, fresh:false, spawnOrder:0, deliveryOrder:order });
    });
    if (findMatches(board, blocked).length === 0 && hasPossibleMove(board, inactive, blocked)) return board;
  }

  const fallback = createPlayableBoard(inactive, blocked);
  deliveries.forEach((index, order) => {
    fallback[index] = makeHitMatchTile("delivery", { delivery:true, fresh:false, spawnOrder:0, deliveryOrder:order });
  });
  return fallback;
}

export function findMatches(board, blockedIndices = []) {
  // Shield blokuje RUCH, nie MATCH. Osłonięty kafel może być częścią
  // poziomego/pionowego match-3+, więc blockedIndices nie rozcina sekwencji.
  // Parametr zostaje, bo pozostałe wywołania przekazują listę Shieldów.
  void blockedIndices;
  const groups = [];

  for (let row = 0; row < HIT_MATCH_ROWS; row += 1) {
    let startCol = 0;
    while (startCol < HIT_MATCH_COLS) {
      const startIndex = indexOf(row, startCol);
      const type = board[startIndex]?.type;
      if (!type || type === "wild" || type === "delivery") {
        startCol += 1;
        continue;
      }
      let endCol = startCol + 1;
      while (endCol < HIT_MATCH_COLS) {
        const nextIndex = indexOf(row, endCol);
        if (board[nextIndex]?.type !== type) break;
        endCol += 1;
      }
      const length = endCol - startCol;
      if (length >= 3) {
        groups.push({
          direction: "row",
          type,
          indices: Array.from({ length }, (_, offset) => indexOf(row, startCol + offset)),
        });
      }
      startCol = endCol;
    }
  }

  for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
    let startRow = 0;
    while (startRow < HIT_MATCH_ROWS) {
      const startIndex = indexOf(startRow, col);
      const type = board[startIndex]?.type;
      if (!type || type === "wild" || type === "delivery") {
        startRow += 1;
        continue;
      }
      let endRow = startRow + 1;
      while (endRow < HIT_MATCH_ROWS) {
        const nextIndex = indexOf(endRow, col);
        if (board[nextIndex]?.type !== type) break;
        endRow += 1;
      }
      const length = endRow - startRow;
      if (length >= 3) {
        groups.push({
          direction: "col",
          type,
          indices: Array.from({ length }, (_, offset) => indexOf(startRow + offset, col)),
        });
      }
      startRow = endRow;
    }
  }

  return groups;
}

export function uniqueMatchedIndices(groups) {
  return [...new Set(groups.flatMap((group) => group.indices))];
}

export function hasPossibleMove(board, inactiveIndices = [], blockedIndices = []) {
  const inactive = inactiveSetOf(inactiveIndices);
  const blocked = inactiveSetOf(blockedIndices);
  for (let row = 0; row < HIT_MATCH_ROWS; row += 1) {
    for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
      const a = indexOf(row, col);
      const tile = board[a];
      if (!tile || tile.type === "delivery" || inactive.has(a) || blocked.has(a)) continue;
      const neighbours = [];
      if (col + 1 < HIT_MATCH_COLS) neighbours.push(indexOf(row, col + 1));
      if (row + 1 < HIT_MATCH_ROWS) neighbours.push(indexOf(row + 1, col));
      for (const b of neighbours) {
        if (inactive.has(b) || blocked.has(b) || !board[b]) continue;
        const other = board[b];
        if (other?.type === "delivery") continue;
        // Złoty Winyl zawsze może zostać zamieniony z sąsiadem. Dwa specjale
        // również są legalnym ruchem. Pojedynczy line/bomb musi wejść w match.
        if (tile.special === "color" || other?.special === "color") return true;
        if (tile.special === "bomb" || other?.special === "bomb") return true;
        if (tile.special && other?.special) return true;
        const swapped = swapBoardCells(board, a, b);
        if (findMatches(swapped, blocked).length > 0) return true;
      }
    }
  }
  return false;
}

export function chooseSpecialCreation(groups, board, swapA, swapB) {
  if (!groups.length) return null;
  const swapIndices = [swapB, swapA].filter((value) => Number.isInteger(value));
  const matched = uniqueMatchedIndices(groups);
  const candidate = swapIndices.find((index) => matched.includes(index)) ?? matched[0];

  // Jeżeli ruch aktywuje już istniejący special, priorytetem jest jego wybuch,
  // a nie tworzenie nowego w tym samym miejscu.
  if (matched.some((index) => board[index]?.special)) return null;

  const intersections = new Map();
  groups.forEach((group) => {
    group.indices.forEach((index) => {
      const value = intersections.get(index) || new Set();
      value.add(group.direction);
      intersections.set(index, value);
    });
  });
  const cross = [...intersections.entries()].find(([, directions]) => directions.size >= 2)?.[0];
  if (Number.isInteger(cross)) {
    return { index: cross, special: "bomb", type: board[cross]?.type || groups[0].type };
  }

  const five = groups.find((group) => group.indices.length >= 5 && group.indices.some((index) => swapIndices.includes(index)))
    || groups.find((group) => group.indices.length >= 5);
  if (five) {
    const index = swapIndices.find((value) => five.indices.includes(value)) ?? five.indices[Math.floor(five.indices.length / 2)];
    return { index, special: "color", type: "wild" };
  }

  const four = groups.find((group) => group.indices.length >= 4 && group.indices.some((index) => swapIndices.includes(index)))
    || groups.find((group) => group.indices.length >= 4);
  if (four) {
    const index = swapIndices.find((value) => four.indices.includes(value)) ?? four.indices[Math.floor(four.indices.length / 2)];
    return { index, special: four.direction === "row" ? "row" : "col", type: board[index]?.type || four.type };
  }

  return candidate !== undefined ? null : null;
}

function addArea(set, rowStart, rowEnd, colStart, colEnd) {
  for (let row = Math.max(0, rowStart); row <= Math.min(HIT_MATCH_ROWS - 1, rowEnd); row += 1) {
    for (let col = Math.max(0, colStart); col <= Math.min(HIT_MATCH_COLS - 1, colEnd); col += 1) {
      set.add(indexOf(row, col));
    }
  }
}

export function expandSpecialEffects(board, initialIndices) {
  const affected = new Set(initialIndices);
  const processed = new Set();
  const queue = [...initialIndices];

  while (queue.length) {
    const index = queue.shift();
    if (processed.has(index)) continue;
    processed.add(index);
    const tile = board[index];
    if (!tile?.special) continue;

    const before = new Set(affected);
    if (tile.special === "row") {
      const row = rowOf(index);
      for (let col = 0; col < HIT_MATCH_COLS; col += 1) affected.add(indexOf(row, col));
    } else if (tile.special === "col") {
      const col = colOf(index);
      for (let row = 0; row < HIT_MATCH_ROWS; row += 1) affected.add(indexOf(row, col));
    } else if (tile.special === "bomb") {
      addArea(affected, rowOf(index) - 1, rowOf(index) + 1, colOf(index) - 1, colOf(index) + 1);
    } else if (tile.special === "color") {
      // Color bomb trafiony przez inny special robi widowiskowy full clear.
      board.forEach((candidate, candidateIndex) => {
        if (candidate) affected.add(candidateIndex);
      });
    }

    affected.forEach((nextIndex) => {
      if (!before.has(nextIndex) && board[nextIndex]?.special && !processed.has(nextIndex)) queue.push(nextIndex);
    });
  }

  return [...affected];
}

export function resolveColorSwap(board, a, b) {
  const tileA = board[a];
  const tileB = board[b];
  const colorAtA = tileA?.special === "color";
  const colorAtB = tileB?.special === "color";
  if (!colorAtA && !colorAtB) return null;

  if (colorAtA && colorAtB) {
    return board.map((tile, index) => tile ? index : null).filter((value) => value !== null);
  }

  const colorIndex = colorAtA ? a : b;
  const partner = colorAtA ? tileB : tileA;
  const partnerType = partner?.type;
  const base = [];
  if (partnerType && partnerType !== "wild") {
    board.forEach((tile, index) => {
      if (tile?.type === partnerType) base.push(index);
    });
  } else {
    board.forEach((tile, index) => {
      if (tile && index !== colorIndex) base.push(index);
    });
  }
  // Nie przepuszczamy samego Złotego Winylu przez expandSpecialEffects,
  // bo jego efekt przy bezpośredniej zamianie ma dotyczyć koloru partnera,
  // a nie całej planszy. Specjale trafione w wybranym kolorze nadal chainują.
  const expanded = expandSpecialEffects(board, [...new Set(base)]);
  return [...new Set([colorIndex, ...expanded])];
}


export function resolveSpecialSwap(board, a, b) {
  const tileA = board[a];
  const tileB = board[b];
  if (!tileA?.special && !tileB?.special) return null;
  if (tileA?.special === "color" || tileB?.special === "color") return null;

  const specialA = tileA?.special || null;
  const specialB = tileB?.special || null;
  const affected = new Set();

  // Bass Line z match-4 nie odpala się już od zwykłej zamiany — musi ponownie
  // wejść w match. Bomba zachowuje dotychczasowe zachowanie, a dwa specjale
  // nadal można łączyć bezpośrednio.
  if (specialA && !specialB) {
    if (specialA === "row" || specialA === "col") return null;
    return expandSpecialEffects(board, [a]);
  }
  if (specialB && !specialA) {
    if (specialB === "row" || specialB === "col") return null;
    return expandSpecialEffects(board, [b]);
  }

  if (specialA === "bomb" && specialB === "bomb") {
    addArea(affected, rowOf(b) - 2, rowOf(b) + 2, colOf(b) - 2, colOf(b) + 2);
  } else if (specialA === "bomb" || specialB === "bomb") {
    const lineSpecial = specialA === "bomb" ? specialB : specialA;
    const center = specialA === "bomb" ? b : a;
    if (lineSpecial === "row") {
      for (let row = rowOf(center) - 1; row <= rowOf(center) + 1; row += 1) {
        if (row < 0 || row >= HIT_MATCH_ROWS) continue;
        for (let col = 0; col < HIT_MATCH_COLS; col += 1) affected.add(indexOf(row, col));
      }
    } else if (lineSpecial === "col") {
      for (let col = colOf(center) - 1; col <= colOf(center) + 1; col += 1) {
        if (col < 0 || col >= HIT_MATCH_COLS) continue;
        for (let row = 0; row < HIT_MATCH_ROWS; row += 1) affected.add(indexOf(row, col));
      }
    } else {
      addArea(affected, rowOf(center) - 1, rowOf(center) + 1, colOf(center) - 1, colOf(center) + 1);
    }
  } else {
    [a, b].forEach((index) => {
      const tile = board[index];
      if (tile?.special === "row") {
        const row = rowOf(index);
        for (let col = 0; col < HIT_MATCH_COLS; col += 1) affected.add(indexOf(row, col));
      }
      if (tile?.special === "col") {
        const col = colOf(index);
        for (let row = 0; row < HIT_MATCH_ROWS; row += 1) affected.add(indexOf(row, col));
      }
    });
    const crossRow = rowOf(b);
    const crossCol = colOf(b);
    for (let col = 0; col < HIT_MATCH_COLS; col += 1) affected.add(indexOf(crossRow, col));
    for (let row = 0; row < HIT_MATCH_ROWS; row += 1) affected.add(indexOf(row, crossCol));
  }

  const expanded = expandSpecialEffects(board, [...affected]);
  return [...new Set(expanded)];
}

export function removeIndices(board, indices, specialCreation = null) {
  const removeSet = new Set(indices);
  if (specialCreation) removeSet.delete(specialCreation.index);
  const next = board.slice();
  removeSet.forEach((index) => { next[index] = null; });

  if (specialCreation) {
    const existing = next[specialCreation.index] || makeHitMatchTile(specialCreation.type);
    next[specialCreation.index] = {
      ...existing,
      type: specialCreation.type,
      special: specialCreation.special,
      freshSpecial: true,
    };
  }

  return next;
}

export function collapseAndRefill(board, inactiveIndices = [], blockedIndices = []) {
  const inactive = inactiveSetOf(inactiveIndices);
  const blocked = inactiveSetOf(blockedIndices);
  const next = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);

  // Zablokowany Shieldem kafel zostaje dokładnie na swoim polu i dzieli kolumnę
  // na niezależne segmenty grawitacji. Po zniszczeniu Shielda pole automatycznie
  // wraca do normalnego przepływu przy następnym resolve.
  blocked.forEach((index) => {
    if (inactive.has(index)) return;
    const tile = board[index];
    if (tile) next[index] = { ...tile, fresh:false, spawnOrder:0, freshSpecial:false };
  });

  const processSegment = (col, rows) => {
    if (!rows.length) return;
    const existing = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const tile = board[indexOf(rows[i], col)];
      if (tile) existing.push({ ...tile, fresh:false, spawnOrder:0, freshSpecial:false });
    }
    let cursor = 0;
    let spawnOrder = 0;
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const index = indexOf(rows[i], col);
      if (cursor < existing.length) {
        next[index] = existing[cursor];
        cursor += 1;
      } else {
        next[index] = makeHitMatchTile(randomType(), { fresh:true, spawnOrder });
        spawnOrder += 1;
      }
    }
  };

  for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
    let segment = [];
    for (let row = 0; row < HIT_MATCH_ROWS; row += 1) {
      const index = indexOf(row, col);
      if (inactive.has(index) || blocked.has(index)) {
        processSegment(col, segment);
        segment = [];
      } else {
        segment.push(row);
      }
    }
    processSegment(col, segment);
  }
  return next;
}

export function countRemovedByType(boardBefore, indices) {
  const counts = {};
  indices.forEach((index) => {
    const type = boardBefore[index]?.type;
    if (!type || type === "wild" || type === "delivery") return;
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
}


export function getDeliveryExitIndices(inactiveIndices = [], depth = 2) {
  const inactive = inactiveSetOf(inactiveIndices);
  const exits = new Set();
  const safeDepth = Math.max(1, Math.min(HIT_MATCH_ROWS, Number(depth) || 2));

  for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
    let found = 0;
    for (let row = HIT_MATCH_ROWS - 1; row >= 0 && found < safeDepth; row -= 1) {
      const index = indexOf(row, col);
      if (inactive.has(index)) continue;
      exits.add(index);
      found += 1;
    }
  }

  return [...exits];
}

export function collectDeliveredTiles(board, inactiveIndices = [], exitDepth = 2) {
  const next = board.slice();
  const exitSet = new Set(getDeliveryExitIndices(inactiveIndices, exitDepth));
  const deliveredIndices = [];

  exitSet.forEach((index) => {
    if (next[index]?.type === "delivery") {
      next[index] = null;
      deliveredIndices.push(index);
    }
  });

  return { board:next, deliveredIndices };
}

export function shufflePlayable(board, inactiveIndices = [], blockedIndices = []) {
  const inactive = inactiveSetOf(inactiveIndices);
  const blocked = inactiveSetOf(blockedIndices);
  const deliveryPositions = new Set(Array.from({ length: HIT_MATCH_ROWS * HIT_MATCH_COLS }, (_, index) => index).filter((index) => board[index]?.type === "delivery"));
  const positions = Array.from({ length: HIT_MATCH_ROWS * HIT_MATCH_COLS }, (_, index) => index).filter((index) => !inactive.has(index) && !blocked.has(index) && !deliveryPositions.has(index));
  const sourceTiles = positions.map((index) => board[index]).filter((tile) => tile && tile.type !== "delivery");
  while (sourceTiles.length < positions.length) sourceTiles.push(makeHitMatchTile(randomType()));
  const tiles = sourceTiles.map((tile) => ({ ...tile, fresh:false, spawnOrder:0, freshSpecial:false, special:null, type:tile.type === "wild" ? randomType() : tile.type }));

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const pool = tiles.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const candidate = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
    blocked.forEach((position) => { if (!inactive.has(position) && board[position]) candidate[position] = { ...board[position], fresh:false, spawnOrder:0, freshSpecial:false }; });
    deliveryPositions.forEach((position) => { if (!inactive.has(position) && board[position]) candidate[position] = { ...board[position], fresh:false, spawnOrder:0, freshSpecial:false }; });
    positions.forEach((position, index) => { candidate[position] = pool[index]; });
    if (findMatches(candidate, blocked).length === 0 && hasPossibleMove(candidate, inactive, blocked)) return candidate;
  }
  const fallback = createPlayableBoard(inactive, blocked);
  blocked.forEach((position) => { if (!inactive.has(position) && board[position]) fallback[position] = { ...board[position], fresh:false, spawnOrder:0, freshSpecial:false }; });
  deliveryPositions.forEach((position) => { if (!inactive.has(position) && board[position]) fallback[position] = { ...board[position], fresh:false, spawnOrder:0, freshSpecial:false }; });
  return fallback;
}

