import { useEffect, useRef } from "react";
import { doc, increment, updateDoc } from "firebase/firestore";
import { db } from "./firebase-config.js";

// Łączny czas AKTYWNEJ rozgrywki, nie czas otwarcia strony.
export function isActiveGameplay(screen, { hitMatchPlaying = false, hitRushRunning = false, showDailySong = false, dailySong = false, dailyResult = false } = {}) {
  if (["opener", "playing", "voting", "roundResult", "yearGuess", "yearGuessResult", "campaignPlay"].includes(screen)) return true;
  if (screen === "hitRush") return !!hitRushRunning;
  if (screen === "hitMatch") return !!hitMatchPlaying;
  if (screen === "home" && showDailySong && dailySong && !dailyResult) return true;
  return false;
}

export function formatPlayDuration(seconds) {
  if (!Number.isFinite(Number(seconds))) return "Brak danych";
  const totalMinutes = Math.floor(Math.max(0, Number(seconds)) / 60);
  if (totalMinutes < 1) return "< 1 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} godz. ${minutes} min` : `${hours} godz.`;
}

async function savePlaytime(uid, seconds) {
  if (!uid || !Number.isSafeInteger(seconds) || seconds <= 0) return;
  await updateDoc(doc(db, "userStats", uid), {
    activePlaySeconds: increment(seconds),
  });
}

// Przy dwóch otwartych kartach tego samego konta czas nie może liczyć się 2x.
// Krótka dzierżawa w localStorage jest odnawiana tylko przez aktywną kartę.
function createTabLease(uid) {
  const key = `hitsteriada:active-play:${uid}`;
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const claim = () => {
    try {
      const now = Date.now();
      const existing = JSON.parse(localStorage.getItem(key) || "null");
      if (existing?.owner !== owner && Number(existing?.expires || 0) > now) return false;
      localStorage.setItem(key, JSON.stringify({ owner, expires: now + 9000 }));
      return true;
    } catch {
      // Niedostępny localStorage nie może wyłączać licznika całkowicie.
      return true;
    }
  };
  const release = () => {
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "null");
      if (existing?.owner === owner) localStorage.removeItem(key);
    } catch {}
  };
  return { claim, release };
}

/**
 * Jedno miejsce zapisu dla wszystkich trybów. Rejestruje tylko widoczną,
 * aktywną grę, z limitem 2 min bez interakcji (mysz, dotyk, klawiatura).
 * Firestore dostaje paczki po 5 minutach aktywnego grania albo przy
 * zakończeniu rozgrywki / ukryciu karty; delta jest atomowa i nie nadpisuje XP.
 */
export function usePlayTimeTracking(uid, gameplayActive, onSaved) {
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!uid || !gameplayActive || typeof document === "undefined") return;
    let lastTick = Date.now();
    let lastInput = lastTick;
    let pending = 0;
    let inFlight = Promise.resolve();
    const lease = createTabLease(uid);

    const flush = () => {
      const seconds = Math.floor(pending);
      if (!seconds) return;
      pending -= seconds;
      inFlight = inFlight.then(() => savePlaytime(uid, seconds))
        .then(() => onSavedRef.current?.(seconds))
        .catch(() => { pending += seconds; });
    };

    const input = () => { lastInput = Date.now(); };
    const tick = () => {
      const now = Date.now();
      // Nigdy nie zaliczamy długiej przerwy od uśpienia urządzenia.
      const dt = Math.max(0, Math.min(2500, now - lastTick));
      lastTick = now;
      if (document.visibilityState !== "visible" || now - lastInput >= 120000) {
        lease.release();
        flush();
        return;
      }
      if (lease.claim()) pending += dt / 1000;
      if (pending >= 5 * 60) flush();
    };

    const visibility = () => {
      if (document.visibilityState !== "visible") {
        flush();
        lease.release();
      } else {
        lastTick = Date.now();
        lastInput = lastTick;
      }
    };
    const pageHide = () => { flush(); lease.release(); };
    const interval = setInterval(tick, 2000);
    for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) window.addEventListener(event, input, { passive:true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pageHide);
    return () => {
      clearInterval(interval);
      for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) window.removeEventListener(event, input);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pageHide);
      flush();
      lease.release();
    };
  }, [uid, gameplayActive]);
}
