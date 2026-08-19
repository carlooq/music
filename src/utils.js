export function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines.map((line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });

  let start = 0;
  if (rows.length && !/^\d{4}$/.test((rows[0][3] || "").trim())) start = 1;

  const songs = [];
  for (let i = start; i < rows.length; i++) {
    const [url, artist, title, year, categories] = rows[i];
    const id = getYouTubeId(url);
    const y = parseInt(year, 10);
    if (id && artist && title && !isNaN(y)) {
      songs.push({
        id: `${id}-${i}`,
        videoId: id,
        artist: artist.replace(/^"|"$/g, ""),
        title: title.replace(/^"|"$/g, ""),
        year: y,
        categories: categories ? categories.replace(/^"|"$/g, "").split(";").map((c) => c.trim()).filter(Boolean) : [],
      });
    }
  }
  return songs;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function requiredApprovals(totalPlayers) {
  const voters = totalPlayers - 1; // wszyscy oprócz odgadującego
  if (voters <= 0) return 0;
  return Math.ceil((voters * 2) / 3);
}

export function randomStartSeconds() {
  return Math.floor(Math.random() * 106) + 15; // 15–120s
}

// --- fuzzy matching for artist/title guesses ---

function normalizeForMatch(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics (ę→e, ą→a, ó→o...)
    .replace(/['"`’‘“”.,!?()\-]/g, "") // strip punctuation/quotes
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Returns true if `guess` is close enough to `answer` to count as correct,
// tolerating case, Polish diacritics, punctuation, and small typos.
export function fuzzyMatch(guess, answer, threshold = 0.8) {
  const g = normalizeForMatch(guess);
  const a = normalizeForMatch(answer);
  if (!g || !a) return false;
  if (g === a) return true;
  const dist = levenshtein(g, a);
  const similarity = 1 - dist / Math.max(g.length, a.length);
  return similarity >= threshold;
}
