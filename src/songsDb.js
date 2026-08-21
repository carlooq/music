import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { REAL_SONGS } from "./songs.js";
import { CATEGORY_PATCH } from "./categoryPatch.js";

const COLLECTION = "songs";
const PROPOSALS_COLLECTION = "songProposals";

export async function fetchAllSongsFromDb() {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addSongToDb(song) {
  const ref = doc(collection(db, COLLECTION));
  const data = {
    videoId: song.videoId,
    artist: song.artist,
    title: song.title,
    year: song.year,
    categories: song.categories || [],
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
    toAdd.push({ videoId, artist: r.artist, title: r.title, year: r.year, categories: r.categories });
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
