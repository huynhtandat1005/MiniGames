// ── state.js ──────────────────────────────────────────────────────────────────
// Shared state, Socket.IO instance, and global UI utilities.
// Must be loaded FIRST — all other files depend on these globals.

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const socket = io();

// ── Shared state ──────────────────────────────────────────────────────────────
let myId = null, myName = '', myRoomId = '', oppId = null, oppName = '';
let opponentHasChosen = false;
let myChar = 0, oppChar = 0;
let scores = {}, currentRound = 1, hasChosen = false, timerTotal = 10;
let timerDone = false;      // true khi timer đã về 0
let pendingResult = null;   // lưu roundResult nếu timer chưa xong

socket.on('connect', () => { myId = socket.id; });

// ── Quản lý hiển thị màn hình ─────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Thông báo toast ───────────────────────────────────────────────────────────
function notify(msg, type = 'info', duration = 3000) {
  const el = document.getElementById('notif');
  el.textContent = msg;
  el.className = `notif ${type} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

// ── Cơ chế Chặn Zoom trên thiết bị di động ───────────────────────────────────
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let _lt = 0;
document.addEventListener('touchend', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const now = Date.now(); if (now - _lt < 300) e.preventDefault(); _lt = now;
}, { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); }, { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
