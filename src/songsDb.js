import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, increment, getCountFromServer } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { REAL_SONGS } from "./songs.js";
import { CATEGORY_PATCH } from "./categoryPatch.js";

const COLLECTION = "songs";
const PROPOSALS_COLLECTION = "songProposals";

// 4 poziomy losowane automatycznie przy dodaniu utworu (Diamentowa Płyta to
// piąty poziom, ustawiany WYŁĄCZNIE ręcznie przez admina — flaga isDiamond).
// Rzadkość jest przypisywana RAZ, NA STAŁE, w momencie dodania utworu do
// bazy — nie przy każdym losowaniu karty — żeby ta sama piosenka miała
// zawsze ten sam poziom dla wszystkich graczy.
const RARITY_WEIGHTS = [
  ["winyl", 56],
  ["srebrna", 26],
  ["zlota", 12],
  ["platynowa", 6],
];

export function rollRarity() {
  const total = RARITY_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of RARITY_WEIGHTS) {
    if (r < w) return key;
    r -= w;
  }
  return RARITY_WEIGHTS[0][0];
}

export async function fetchAllSongsFromDb() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Tanie zapytanie liczące — Firestore rozlicza to jako ok. 1 odczyt na każde
// 1000 dokumentów, nie 1 na każdy utwór, więc jest praktycznie darmowe nawet
// dla dużej biblioteki. Do miejsc, gdzie potrzebny jest tylko CAŁKOWITY
// rozmiar bazy (np. "X/Y przesłuchanych piosenek" w statystykach), bez
// pobierania treści wszystkich dokumentów.
export async function getSongCount() {
  try {
    const snap = await getCountFromServer(collection(db, COLLECTION));
    return snap.data().count;
  } catch (e) {
    return null;
  }
}

// Zwiększa licznik "ile razy ta karta faktycznie padła w grze" — wywoływane
// tylko wtedy, gdy karta rzeczywiście trafiła do rozgrywki (nie przy samym
// wylosowaniu, które mogło zostać zaraz zastąpione np. przy zepsutym linku).
// Ciche niepowodzenie — to tylko statystyka poglądowa, nie coś krytycznego.
export async function incrementSongPlayCount(songId) {
  if (!songId) return;
  try {
    const ref = doc(db, COLLECTION, songId);
    await updateDoc(ref, { timesPlayed: increment(1) });
  } catch (e) {
    // ciche niepowodzenie
  }
}

export async function addSongToDb(song) {
  const ref = doc(collection(db, COLLECTION));
  const data = {
    videoId: song.videoId,
    artist: song.artist,
    title: song.title,
    year: song.year,
    categories: song.categories || [],
    rarity: rollRarity(),
    isDiamond: false,
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

export async function updateSongInDb(id, fields) {
  await updateDoc(doc(db, COLLECTION, id), fields);
}

export async function deleteSongFromDb(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}

// Jednorazowe uzupełnienie rzadkości dla utworów, które trafiły do bazy
// ZANIM istniał system kart (nie mają jeszcze pola `rarity`). Wywoływane
// ręcznie z panelu admina — dla nowych utworów dzieje się to już automatycznie.
export async function migrateRarityForExistingSongs(songs, onProgress) {
  const missing = songs.filter((s) => !s.rarity);
  const chunkSize = 450;
  let written = 0;
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((s) => batch.update(doc(db, COLLECTION, s.id), { rarity: rollRarity(), isDiamond: s.isDiamond ?? false }));
    await batch.commit();
    written += chunk.length;
    if (onProgress) onProgress(written, missing.length);
  }
  return { updated: written, total: missing.length };
}

// Jednorazowa migracja: wgrywa obecną, wbudowaną bibliotekę (songs.js) do
// Firestore, żeby dało się ją dalej edytować na żywo z poziomu appki.
// Firestore batch ma limit 500 operacji, więc dzielimy na kawałki.
export async function migrateBundledLibraryToDb(onProgress) {
  const chunkSize = 450;
  let written = 0;
  for (let i = 0; i < REAL_SONGS.length; i += chunkSize) {
    const chunk = REAL_SONGS.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((song) => {
      const ref = doc(collection(db, COLLECTION));
      batch.set(ref, {
        videoId: song.videoId,
        artist: song.artist,
        title: song.title,
        year: song.year,
        categories: song.categories || [],
      });
    });
    await batch.commit();
    written += chunk.length;
    if (onProgress) onProgress(written, REAL_SONGS.length);
  }
  return written;
}

// Dogrywa kategorie do utworów, które już są w Firestore, dopasowując po
// videoId — na podstawie jednorazowej łatki wygenerowanej z tagged.csv.
export async function applyCategoryPatchToDb(onProgress) {
  const songs = await fetchAllSongsFromDb();
  const toUpdate = songs.filter((s) => CATEGORY_PATCH[s.videoId] && CATEGORY_PATCH[s.videoId].length);
  const chunkSize = 450;
  let written = 0;
  for (let i = 0; i < toUpdate.length; i += chunkSize) {
    const chunk = toUpdate.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    chunk.forEach((s) => {
      batch.update(doc(db, COLLECTION, s.id), { categories: CATEGORY_PATCH[s.videoId] });
    });
    await batch.commit();
    written += chunk.length;
    if (onProgress) onProgress(written, toUpdate.length);
  }
  return written;
}

// --- propozycje utworów od graczy ---

export async function submitSongProposal(proposal) {
  const ref = doc(collection(db, PROPOSALS_COLLECTION));
  const data = {
    videoId: proposal.videoId,
    artist: proposal.artist,
    title: proposal.title,
    year: proposal.year,
    categories: proposal.categories || [],
    submittedBy: proposal.submittedBy || "nieznany",
    submittedByUid: proposal.submittedByUid || null,
    status: "pending",
    createdAt: Date.now(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
}

export async function fetchPendingProposals() {
  const snap = await getDocs(collection(db, PROPOSALS_COLLECTION));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.status === "pending")
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export async function updateProposal(id, fields) {
  await updateDoc(doc(db, PROPOSALS_COLLECTION, id), fields);
}

// Akceptacja: kopiuje propozycję do głównej biblioteki i usuwa ją z listy oczekujących.
export async function acceptProposal(proposal) {
  const added = await addSongToDb({
    videoId: proposal.videoId,
    artist: proposal.artist,
    title: proposal.title,
    year: proposal.year,
    categories: proposal.categories || [],
  });
  await deleteDoc(doc(db, PROPOSALS_COLLECTION, proposal.id));
  return added;
}

export async function rejectProposal(id) {
  await deleteDoc(doc(db, PROPOSALS_COLLECTION, id));
}

// --- import CSV wklejonego prosto w panelu admina (bez terminala) ---

function getYouTubeIdFromUrl(url) {
  const m = (url || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// Parser CSV z ";" jako separatorem (obsługuje cudzysłowy wokół kategorii).
function parseImportCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map((line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ";" && !inQuotes) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  });
  const start = /^\d{4}$/.test((rows[0]?.[3] || "").trim()) ? 0 : 1;
  return rows.slice(start).map((r) => ({
    url: (r[0] || "").trim(),
    artist: (r[1] || "").trim(),
    title: (r[2] || "").trim(),
    year: parseInt((r[3] || "").trim(), 10),
    categories: (r[4] || "").trim().split(";").map((c) => c.trim()).filter(Boolean),
  }));
}

// Dedupuje po videoId względem przekazanego zbioru (np. aktualnie wczytanej
// biblioteki) i zapisuje nowe utwory w Firestore, partiami.
export async function importSongsFromCsv(csvText, existingVideoIds, onProgress) {
  const rows = parseImportCsv(csvText);
  const seen = new Set(existingVideoIds);
  const toAdd = [];
  let skippedDup = 0;
  let skippedBad = 0;

  for (const r of rows) {
    const videoId = getYouTubeIdFromUrl(r.url);
    if (!videoId || !r.artist || !r.title || isNaN(r.year)) {
      skippedBad++;
      continue;
    }
    if (seen.has(videoId)) {
      skippedDup++;
      continue;
    }
    seen.add(videoId);
    toAdd.push({ videoId, artist: r.artist, title: r.title, year: r.year, categories: r.categories, rarity: rollRarity(), isDiamond: false });
  }

  const chunkSize = 450;
  let written = 0;
  const addedSongs = [];
  for (let i = 0; i < toAdd.length; i += chunkSize) {
    const chunk = toAdd.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    const refs = chunk.map((song) => {
      const ref = doc(collection(db, COLLECTION));
      batch.set(ref, song);
      return { id: ref.id, ...song };
    });
    await batch.commit();
    addedSongs.push(...refs);
    written += chunk.length;
    if (onProgress) onProgress(written, toAdd.length);
  }

  return { totalRows: rows.length, added: written, addedSongs, skippedDup, skippedBad };
}

// --- zgłoszenia uszkodzonych linków (wykryte automatycznie w grze) ---

const BROKEN_LINKS_COLLECTION = "brokenLinks";

export async function logBrokenLink({ videoId, artist, title, year }) {
  const ref = doc(collection(db, BROKEN_LINKS_COLLECTION));
  await setDoc(ref, { videoId, artist, title, year: year || null, reportedAt: serverTimestamp() });
}

export async function fetchBrokenLinkReports() {
  const snap = await getDocs(collection(db, BROKEN_LINKS_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function dismissBrokenLinkReport(id) {
  await deleteDoc(doc(db, BROKEN_LINKS_COLLECTION, id));
}

// Usuwa piosenkę z głównej biblioteki po videoId (znajduje pierwsze dopasowanie) i odrzuca zgłoszenie.
export async function deleteBrokenSongAndDismiss(reportId, videoId) {
  const snap = await getDocs(collection(db, COLLECTION));
  const match = snap.docs.find((d) => d.data().videoId === videoId);
  if (match) await deleteDoc(doc(db, COLLECTION, match.id));
  await deleteDoc(doc(db, BROKEN_LINKS_COLLECTION, reportId));
  return !!match;
}

// Aktualizuje piosenkę w bibliotece (znalezioną po starym videoId z zgłoszenia) i odrzuca zgłoszenie.
export async function updateBrokenSongAndDismiss(reportId, oldVideoId, fields) {
  const snap = await getDocs(collection(db, COLLECTION));
  const match = snap.docs.find((d) => d.data().videoId === oldVideoId);
  let updated = null;
  if (match) {
    await updateDoc(doc(db, COLLECTION, match.id), fields);
    updated = { id: match.id, ...match.data(), ...fields };
  }
  await deleteDoc(doc(db, BROKEN_LINKS_COLLECTION, reportId));
  return updated;
}
