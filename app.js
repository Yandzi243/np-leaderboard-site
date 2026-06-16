import { initializeApp } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBs10LVUQTKtvBt3im0W5Pp_XgKqmnmU-w",
  authDomain: "night-prowlers.firebaseapp.com",
  projectId: "night-prowlers",
  storageBucket: "night-prowlers.firebasestorage.app",
  messagingSenderId: "192565490320",
  appId: "1:192565490320:web:99b9a3c3efce481c689e15"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const LISTS = ["demonlist_pc","demonlist_mobile","challengelist_pc","challengelist_mobile","top_pc","top_mobile"];
const DIFF_CLASS = { 'Hard Demon':'diff-hard', 'Insane Demon':'diff-insane', 'Extreme Demon':'diff-extreme' };

const dataCache = {};

// ── REAL-TIME LISTENERS ──────────────────────────────────────
LISTS.forEach(listName => {
  const ref = doc(db, "lists", listName);
  onSnapshot(ref, snap => {
    const items = snap.exists() ? (snap.data().items || []) : [];
    dataCache[listName] = items;
    renderList(listName);
  }, error => {
    console.error("Ошибка загрузки данных:", error);
  });
});

// ── RENDER WITH FILTER ───────────────────────────────────────
function renderList(listName) {
  const [section, platform] = listName.split('_');
  const el = document.getElementById(`${section}-${platform}`);
  if (!el) return;

  let rawItems = dataCache[listName] || [];
  let items = [];

  if (section === 'top') {
    const sorted = [...rawItems].sort((a,b) => (parseFloat(b.points)||0) - (parseFloat(a.points)||0));
    items = sorted.map((item, idx) => ({ ...item, initialRank: idx + 1 }));
  } else {
    items = rawItems.map((item, idx) => ({ ...item, initialRank: idx + 1 }));
  }

  const searchInput = document.getElementById(`search-${section}`);
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  if (query) {
    items = items.filter(item => {
      const name = (item.name || '').toLowerCase();
      const player = (item.player || '').toLowerCase();
      return name.includes(query) || player.includes(query);
    });
  }

  if (!items.length) {
    el.innerHTML = '<div class="empty-state">Ничего не найдено</div>';
    return;
  }

  if (section === 'top') {
    el.innerHTML = items.map((item, i) => `
      <div class="list-item top-item rank-${item.initialRank}" style="animation-delay:${i*0.02}s">
        <div class="rank">${item.initialRank}</div>
        <div class="item-info">
          <div class="item-name">${esc(item.player)}</div>
          <div class="item-meta">${item.demons||0} демонов</div>
        </div>
        <div class="item-points">${fmtPts(item.points)}<span>очков</span></div>
      </div>`).join('');
  } else if (section === 'challengelist') {
    el.innerHTML = items.map((item, i) => `
      <div class="list-item rank-${item.initialRank}" style="animation-delay:${i*0.02}s">
        <div class="rank">${item.initialRank}</div>
        <div class="item-info">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-meta">${esc(item.player||'—')}</div>
        </div>
      </div>`).join('');
  } else {
    el.innerHTML = items.map((item, i) => `
      <div class="list-item rank-${item.initialRank}" style="animation-delay:${i*0.02}s">
        <div class="rank">${item.initialRank}</div>
        <div class="item-info">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-meta">${esc(item.player||'—')}</div>
        </div>
        <div class="difficulty-badge ${DIFF_CLASS[item.difficulty]||'diff-hard'}">${esc(item.difficulty||'')}</div>
        <div class="item-points">${fmtPts(item.points)}<span>очков</span></div>
      </div>`).join('');
  }
}

window.applySearch = function(section) {
  renderList(`${section}_pc`);
  renderList(`${section}_mobile`);
}

// ── ADD ENTRY ─────────────────────────────────────────────────
window.addEntry = async function() {
  const section = document.getElementById('add-section').value;
  const platform = document.getElementById('add-platform').value;
  const name = document.getElementById('add-name').value.trim();
  const player = document.getElementById('add-player').value.trim();
  const difficulty = document.getElementById('add-difficulty').value;
  const points = parseFloat(document.getElementById('add-points').value) || 0;
  const demons = parseInt(document.getElementById('add-demons').value) || 0;

  if (!name) { showToast('⚠️ Введите название / ник'); return; }

  const listName = `${section}_${platform}`;
  const ref = doc(db, "lists", listName);
  const snap = await getDoc(ref);
  const items = snap.exists() ? (snap.data().items || []) : [];

  let newItem;
  if (section === 'top') {
    newItem = { player: name, points, demons };
  } else if (section === 'challengelist') {
    newItem = { name, player };
  } else {
    newItem = { name, player, difficulty, points };
  }

  items.push(newItem);
  await setDoc(ref, { items });

  document.getElementById('add-name').value = '';
  document.getElementById('add-player').value = '';
  document.getElementById('add-points').value = '';
  document.getElementById('add-demons').value = '';
  showToast('✅ Добавлено!');
  window.renderManageList();
}

// ── DELETE ENTRY ──────────────────────────────────────────────
window.deleteEntry = async function(listName, index) {
  if (!confirm('Удалить запись?')) return;
  const ref = doc(db, "lists", listName);
  const snap = await getDoc(ref);
  const items = snap.exists() ? (snap.data().items || []) : [];
  items.splice(index, 1);
  await setDoc(ref, { items });
  showToast('🗑️ Удалено');
  window.renderManageList();
}

// ── MANAGE LIST ───────────────────────────────────────────────
window.renderManageList = async function() {
  const section = document.getElementById('manage-section').value;
  const platform = document.getElementById('manage-platform').value;
  const listName = `${section}_${platform}`;
  const el = document.getElementById('manage-list');
  if(!el) return;
  el.innerHTML = '<div style="color:#555;font-family:DM Mono,monospace;font-size:11px;padding:8px">Загрузка...</div>';

  const ref = doc(db, "lists", listName);
  const snap = await getDoc(ref);
  const items = snap.exists() ? (snap.data().items || []) : [];

  if (!items.length) {
    el.innerHTML = '<div style="color:#555;font-family:DM Mono,monospace;font-size:11px;padding:8px">Список пуст</div>';
    return;
  }

  el.innerHTML = items.map((item, i) => `
    <div class="manage-item">
      <div class="manage-item-info">
        <div class="manage-item-name">${esc(item.name || item.player)}</div>
        <div class="manage-item-meta">
          ${section === 'top' ? `${fmtPts(item.points||0)} очков · ${item.demons||0} дем.`
            : section === 'challengelist' ? esc(item.player||'—')
            : `${esc(item.player||'—')} · ${esc(item.difficulty||'')} · ${fmtPts(item.points||0)} очк.`}
        </div>
      </div>
      <button class="delete-btn" onclick="deleteEntry('${listName}',${i})">✕</button>
    </div>`).join('');
}

// ── SECURITY ──────────────────────────────────────────────────
window.checkPassword = async function() {
  const password = document.getElementById('pw-input').value;
  const adminEmail = "admin@nightprowlers.com"; 

  try {
    await signInWithEmailAndPassword(auth, adminEmail, password);
    document.getElementById('pw-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = '';
    window.renderManageList();
  } catch (error) {
    console.error("Ошибка входа:", error);
    document.getElementById('pw-error').style.display = 'block';
    document.getElementById('pw-input').value = '';
  }
}

// ── NAVIGATION & UI ───────────────────────────────────────────
window.showPage = function(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
}

window.switchPlatform = function(section, platform, btn) {
  btn.closest('.platform-tabs').querySelectorAll('.platform-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ['pc','mobile'].forEach(p => {
    const el = document.getElementById(`${section}-${p}`);
    if (el) el.style.display = p === platform ? '' : 'none';
  });
}

window.openAdmin = function() {
  document.getElementById('adminModal').classList.add('open');
  document.getElementById('pw-screen').style.display = '';
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('pw-input').value = '';
  document.getElementById('pw-error').style.display = 'none';
  setTimeout(() => document.getElementById('pw-input').focus(), 100);
}

window.closeAdmin = function() { 
  document.getElementById('adminModal').classList.remove('open'); 
}

window.switchAdminTab = function(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('admin-' + tab).classList.add('active');
  if (tab === 'manage') window.renderManageList();
}

window.togglePointsField = function() {
  const section = document.getElementById('add-section').value;
  document.getElementById('player-group').style.display = section === 'top' ? 'none' : '';
  document.getElementById('diff-group').style.display = section !== 'demonlist' ? 'none' : '';
  document.getElementById('points-group').style.display = section === 'top' ? '' : section === 'demonlist' ? '' : 'none';
  document.getElementById('demons-group').style.display = section === 'top' ? '' : 'none';
  document.getElementById('name-label').textContent = section === 'top' ? 'Ник игрока' : 'Название уровня';
}

// ── CSV IMPORT ────────────────────────────────────────────────
window.importCSV = async function() {
  const file = document.getElementById('import-file').files[0];
  if (!file) { showToast('⚠️ Выберите файл'); return; }

  const section = document.getElementById('import-section').value;
  const platform = document.getElementById('import-platform').value;
  const listName = section + '_' + platform;
  const text = await file.text();

  const sep = text.includes(';') ? ';' : ',';
  const lines = text.split('\n').filter(l => l.trim());
  const dataLines = lines.slice(1); 

  const items = [];
  for (const line of dataLines) {
    const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (!cols[0]) continue;

    if (section === 'demonlist') {
      items.push({ name: cols[0], player: cols[1]||'', difficulty: cols[2]||'Hard Demon', points: parseFloat(cols[3])||0 });
    } else if (section === 'challengelist') {
      items.push({ name: cols[0], player: cols[1]||'' });
    } else if (section === 'top') {
      items.push({ player: cols[0], demons: parseInt(cols[1])||0, points: parseFloat(cols[2])||0 });
    }
  }

  if (!items.length) { showToast('❌ Нет данных в файле'); return; }

  const preview = document.getElementById('import-preview');
  preview.innerHTML = '<div style="font-family:DM Mono,monospace;font-size:11px;color:#888;margin-bottom:8px">Найдено записей: ' + items.length + '</div>' +
    items.slice(0,5).map(it => '<div style="font-family:DM Mono,monospace;font-size:10px;color:#aaa;padding:4px 0;border-bottom:1px solid #222">' +
      (it.name || it.player) + '</div>').join('') +
    (items.length > 5 ? '<div style="font-family:DM Mono,monospace;font-size:10px;color:#555;padding:4px 0">...и ещё ' + (items.length-5) + '</div>' : '') +
    '<button class="btn" id="confirm-import-btn">✅ ПОДТВЕРДИТЬ ИМПОРТ</button>';

  document.getElementById('confirm-import-btn').onclick = function() {
    window.confirmImport(listName, items);
  };
}

window.confirmImport = async function(listName, items) {
  try {
    const ref = doc(db, 'lists', listName);
    await setDoc(ref, { items });
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-file').value = '';
    showToast('✅ Импортировано ' + items.length + ' записей!');
    window.renderManageList();
  } catch (err) {
    console.error(err);
    showToast('❌ Ошибка Firebase. Проверьте консоль.');
  }
}

window.downloadTemplate = function() {
  const section = document.getElementById('import-section').value;
  let content, filename;

  if (section === 'demonlist') {
    content = 'Название;Игрок;Сложность;Очки\nBloodbath;YandziGMD;Extreme Demon;5\nTartarus;Someone;Insane Demon;2.5';
    filename = 'demonlist_template.csv';
  } else if (section === 'challengelist') {
    content = 'Название;Игрок\nSome Challenge;YandziGMD\nHard Challenge;Someone';
    filename = 'challengelist_template.csv';
  } else {
    content = 'Игрок;Демоны;Очки\nYandziGMD;5;12.5\nSomeone;3;7';
    filename = 'top_template.csv';
  }

  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── HELPERS ───────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtPts(p) { const n = parseFloat(p)||0; return n === Math.floor(n) ? n : n.toFixed(1); }
function showToast(msg) {
  const t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

document.getElementById('adminModal').addEventListener('click', function(e) {
  if (e.target === this) window.closeAdmin();
});
