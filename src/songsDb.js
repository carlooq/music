import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase-config.js";
import { REAL_SONGS } from "./songs.js";
import { CATEGORY_PATCH } from "./categoryPatch.js";

const COLLECTION = "songs";

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
