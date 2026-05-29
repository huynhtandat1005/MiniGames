// ── lobby.js ──────────────────────────────────────────────────────────────────
// Lobby screen: create/join room, panel toggling, waiting state.
// Depends on: state.js (socket, myName, myChar, myRoomId, notify)

// ── Panel helpers ─────────────────────────────────────────────────────────────
function _showJoinPanel() {
  document.getElementById('lobby-room-badge').style.display = 'none';
  document.getElementById('lobby-join-panel').style.display = 'block';
  document.getElementById('lobby-btn-row').style.display = 'none';
  document.getElementById('btn-leave-wait').style.display = 'none';
  document.getElementById('lobby-join-err').textContent = '';
  setTimeout(() => document.getElementById('lobby-join-input').focus(), 50);
}

function _showWaitingPanel(roomId) {
  document.getElementById('lobby-join-panel').style.display = 'none';
  document.getElementById('lobby-room-badge').style.display = 'block';
  document.getElementById('lobby-room-id').textContent = roomId;
  document.getElementById('lobby-btn-row').style.display = 'none';
  document.getElementById('btn-leave-wait').style.display = 'block';
}

function _resetLobbyPanels() {
  document.getElementById('lobby-room-badge').style.display = 'none';
  document.getElementById('lobby-join-panel').style.display = 'none';
  document.getElementById('lobby-btn-row').style.display = 'grid';
  document.getElementById('btn-leave-wait').style.display = 'none';
  document.getElementById('lobby-join-err').textContent = '';
  document.getElementById('lobby-join-input').value = '';
  document.getElementById('lobby-room-id').textContent = '—';
}

function _showJoinErr(msg) {
  if (typeof SFX !== 'undefined') SFX.error();
  const err = document.getElementById('lobby-join-err');
  err.textContent = msg;
  const inp = document.getElementById('lobby-join-input');
  inp.classList.remove('shake'); void inp.offsetWidth; inp.classList.add('shake');
}

// ── Join panel toggle ─────────────────────────────────────────────────────────
function toggleJoinPanel() {
  if (typeof SFX !== 'undefined') SFX.click();
  const panel = document.getElementById('lobby-join-panel');
  const isOpen = panel.style.display !== 'none';
  if (isOpen) _resetLobbyPanels();
  else        _showJoinPanel();
}

// ── Copy room ID ──────────────────────────────────────────────────────────────
function copyRoomId() {
  const id = document.getElementById('lobby-room-id').textContent;
  if (!id || id === '—') return;
  navigator.clipboard.writeText(id).then(() => {
    const btn = document.getElementById('btn-copy-room');
    btn.textContent = '✓ Đã sao chép!';
    setTimeout(() => { btn.textContent = '📋 Sao chép mã'; }, 2000);
    notify('📋 Đã sao chép mã phòng!', 'success', 2000);
  }).catch(() => notify('Không thể sao chép', 'error'));
}

// ── Create room ───────────────────────────────────────────────────────────────
function createRoom() {
  if (typeof SFX !== 'undefined') SFX.click();
  const name = document.getElementById('inp-name').value.trim();
  if (!name) { document.getElementById('inp-name').focus(); return; }
  myName = name;
  myChar = myCharIdx;
  socket.emit('joinRoom', { name, roomId: '', charIdx: myChar });
}

// ── Confirm join room ─────────────────────────────────────────────────────────
function confirmJoinRoom() {
  const roomId = document.getElementById('lobby-join-input').value.trim().toUpperCase();
  const name   = document.getElementById('inp-name').value.trim();
  if (!name)   { _showJoinErr('Hãy nhập tên trước!'); return; }
  if (!roomId) { _showJoinErr('Nhập mã phòng!'); return; }
  myName = name;
  myChar = myCharIdx;
  socket.emit('joinRoom', { name, roomId, charIdx: myChar });
}

// ── Leave room ────────────────────────────────────────────────────────────────
function leaveRoom(silent = false) {
  if (typeof SFX !== 'undefined') SFX.click();
  if (!silent) notify('Đã thoát phòng', 'info');
  hideResult();
  hideTimer();
  showScreen('screen-lobby');
  myRoomId = ''; oppId = null; oppName = ''; scores = {}; hasChosen = false;
  timerDone = false; pendingResult = null;
  _resetLobbyPanels();
  socket.disconnect().connect();
}

// ── Stubs for any legacy references ──────────────────────────────────────────
function openJoinPopup()   { toggleJoinPanel(); }
function closeJoinPopup()  { _resetLobbyPanels(); }
function clearPopupErr()   { document.getElementById('lobby-join-err').textContent = ''; }
function showPopupErr(msg) { _showJoinErr(msg); }

// ── Socket events ─────────────────────────────────────────────────────────────
// Khi server xác nhận đã vào phòng thành công
socket.on('joinedRoom', ({ roomId, name }) => {
  myRoomId = roomId;
  myName   = name;
  const el = document.getElementById('display-room-id');
  if (el) el.textContent = roomId;
  _showWaitingPanel(roomId);
  if (typeof SFX !== 'undefined') SFX.join();
});

// Khi server thông báo đang chờ đối thủ
socket.on('waiting', () => { /* panel already shown by joinedRoom */ });

// Khi server gửi lỗi (phòng đầy, trùng tên, mã không tồn tại…)
socket.on('error', (msg) => {
  const joinPanel = document.getElementById('lobby-join-panel');
  if (joinPanel && joinPanel.style.display !== 'none') _showJoinErr(msg);
  else notify(msg, 'error');
});

// ── Keyboard bindings ─────────────────────────────────────────────────────────
document.getElementById('inp-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') createRoom();
});
document.getElementById('lobby-join-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmJoinRoom();
  if (e.key === 'Escape') _resetLobbyPanels();
});
