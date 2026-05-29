const CHARS = [
  { id: 'ninja',  name: 'Ninja'  },
  { id: 'mage',   name: 'Mage'   },
  { id: 'gunner', name: 'Gunner' },
  { id: 'robot',  name: 'Robot'  },
  { id: 'dragon', name: 'Dragon' },
  { id: 'archer', name: 'Archer' },
];

let myCharIdx = 0; // Chỉ số nhân vật được người chơi chọn ban đầu

function buildCharGrid() {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = CHARS.map((c, i) => `
    <button class="char-card${i === 0 ? ' selected' : ''}" onclick="selectChar(${i})" aria-label="${c.name}">
      <img src="/img/${c.id}.png" alt="${c.name}" width="80" height="100">
      <span class="cname">${c.name}</span>
    </button>`).join('');
}

function selectChar(idx) {
  if (typeof SFX !== 'undefined') SFX.charSelect();
  myCharIdx = idx;
  document.querySelectorAll('.char-card').forEach((c, i) => c.classList.toggle('selected', i === idx));
}

function setAvatarSVG(elId, charIdx) {
  const el = document.getElementById(elId);
  if (el && CHARS[charIdx]) {
    el.innerHTML = `<img src="/img/${CHARS[charIdx].id}.png" alt="${CHARS[charIdx].name}" width="80" height="100">`;
  }
}

// Khởi chạy vẽ danh sách nhân vật khi tải mã nguồn
buildCharGrid();
