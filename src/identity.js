// A stable per-browser player id, persisted so refreshing the page
// doesn't turn you into a "new" player mid-game.
export function getOrCreatePlayerId() {
  const KEY = "hitster-player-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "p-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(KEY, id);
  }
  return id;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

export function generateRoomCode(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}
