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

export function randomStartSeconds() {
  return Math.floor(Math.random() * 106) + 15; // 15–120s
}
