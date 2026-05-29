const CHARS = [
  { id: 'ninja',   name: 'Ninja',   symbol: '#char-ninja'   },
  { id: 'mage',    name: 'Mage',    symbol: '#char-mage'    },
  { id: 'knight',  name: 'Knight',  symbol: '#char-knight'  },
  { id: 'robot',   name: 'Robot',   symbol: '#char-robot'   },
//   { id: 'dragon',  name: 'Dragon',  symbol: '#char-dragon'  },
//   { id: 'fox',     name: 'Fox',     symbol: '#char-fox'     },
];

let myCharIdx = 0; // Chỉ số nhân vật được người chơi chọn ban đầu

function buildCharGrid() {
  const grid = document.getElementById('char-grid');
  grid.innerHTML = CHARS.map((c, i) => `
    <button class="char-card${i === 0 ? ' selected' : ''}" onclick="selectChar(${i})" aria-label="${c.name}">
      <svg viewBox="0 0 80 100"><use href="${c.symbol}"/></svg>
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
    el.innerHTML = `<svg viewBox="0 0 80 100"><use href="${CHARS[charIdx].symbol}"/></svg>`;
  }
}

// Khởi chạy vẽ danh sách nhân vật khi tải mã nguồn
buildCharGrid();