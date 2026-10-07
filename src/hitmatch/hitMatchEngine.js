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

function createsImmediateTriple(board, index, type) {
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

export function createPlayableBoard() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const board = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
    for (let i = 0; i < board.length; i += 1) {
      const disallowed = [];
      for (const type of HIT_MATCH_TYPES) {
        if (createsImmediateTriple(board, i, type)) disallowed.push(type);
      }
      board[i] = makeHitMatchTile(randomType(disallowed));
    }
    if (findMatches(board).length === 0 && hasPossibleMove(board)) return board;
  }

  // Awaryjnie zwracamy poprawną planszę bez startowych matchy;
  // view może ją przetasować, jeżeli akurat trafi się układ bez ruchów.
  const board = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
  for (let i = 0; i < board.length; i += 1) {
    const disallowed = [];
    for (const type of HIT_MATCH_TYPES) {
      if (createsImmediateTriple(board, i, type)) disallowed.push(type);
    }
    board[i] = makeHitMatchTile(randomType(disallowed));
  }
  return board;
}

export function findMatches(board) {
  const groups = [];

  for (let row = 0; row < HIT_MATCH_ROWS; row += 1) {
    let startCol = 0;
    while (startCol < HIT_MATCH_COLS) {
      const startIndex = indexOf(row, startCol);
      const type = board[startIndex]?.type;
      if (!type || type === "wild") {
        startCol += 1;
        continue;
      }
      let endCol = startCol + 1;
      while (endCol < HIT_MATCH_COLS && board[indexOf(row, endCol)]?.type === type) endCol += 1;
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
      if (!type || type === "wild") {
        startRow += 1;
        continue;
      }
      let endRow = startRow + 1;
      while (endRow < HIT_MATCH_ROWS && board[indexOf(endRow, col)]?.type === type) endRow += 1;
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

export function hasPossibleMove(board) {
  for (let row = 0; row < HIT_MATCH_ROWS; row += 1) {
    for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
      const a = indexOf(row, col);
      const tile = board[a];
      if (!tile) continue;
      if (tile.special === "color") return true;
      const neighbours = [];
      if (col + 1 < HIT_MATCH_COLS) neighbours.push(indexOf(row, col + 1));
      if (row + 1 < HIT_MATCH_ROWS) neighbours.push(indexOf(row + 1, col));
      for (const b of neighbours) {
        if (board[b]?.special === "color") return true;
        const swapped = swapBoardCells(board, a, b);
        if (findMatches(swapped).length > 0) return true;
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

export function collapseAndRefill(board) {
  const next = Array(HIT_MATCH_ROWS * HIT_MATCH_COLS).fill(null);
  for (let col = 0; col < HIT_MATCH_COLS; col += 1) {
    const existing = [];
    for (let row = HIT_MATCH_ROWS - 1; row >= 0; row -= 1) {
      const tile = board[indexOf(row, col)];
      if (tile) existing.push({ ...tile, freshSpecial: false });
    }

    let targetRow = HIT_MATCH_ROWS - 1;
    existing.forEach((tile) => {
      next[indexOf(targetRow, col)] = tile;
      targetRow -= 1;
    });

    let spawnOrder = 0;
    while (targetRow >= 0) {
      next[indexOf(targetRow, col)] = makeHitMatchTile(randomType(), {
        fresh: true,
        spawnOrder,
      });
      targetRow -= 1;
      spawnOrder += 1;
    }
  }
  return next;
}

export function countRemovedByType(boardBefore, indices) {
  const counts = {};
  indices.forEach((index) => {
    const type = boardBefore[index]?.type;
    if (!type || type === "wild") return;
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
}

export function shufflePlayable(board) {
  const tiles = board.filter(Boolean).map((tile) => ({ ...tile, special: null, type: tile.type === "wild" ? randomType() : tile.type }));
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const pool = tiles.slice();
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (findMatches(pool).length === 0 && hasPossibleMove(pool)) return pool;
  }
  return createPlayableBoard();
}
