// ===== Storage =====
const KEY = 'plan90';
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const todayStr = () => fmt(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const fresh = () => ({ start: todayStr(), theme: 'light', tasks: [], done: {}, notes: [] });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch { S = fresh(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ===== Task logic =====
function tasksFor(date) {
  const wd = parse(date).getDay();
  return S.tasks.filter(t => {
    if (t.type === 'weekly') return t.days.includes(wd);
    if (t.type === 'once') return t.date === date;
    if (t.type === 'range') return date >= t.start && date <= t.end;
    if (t.type === 'habit') {
      if (date < t.from) return false;
      if (t.freq === 'daily') return true;
      if (t.freq === 'days') return t.days.includes(wd);
      if (t.freq === 'every') return diff(t.from, date) % Math.max(1, t.n) === 0;
    }
    return false;
  });
}
function stat(date) {
  const ts = tasksFor(date), d = S.done[date] || [];
  const done = ts.filter(t => d.includes(t.id)).length;
  return { total: ts.length, done, pct: ts.length ? Math.round(done / ts.length * 100) : 0 };
}
const dayNum = () => diff(S.start, todayStr()) + 1;
const dateOf = n => addDays(S.start, n - 1);
function toggle(date, id) {
  const d = S.done[date] = S.done[date] || [];
  const i = d.indexOf(id);
  i < 0 ? d.push(id) : d.splice(i, 1);
  save();
}
function describe(t) {
  if (t.type === 'weekly') return 'أسبوعي: ' + t.days.map(d => DAYS[d]).join('، ');
  if (t.type === 'once') return 'مرة واحدة: ' + t.date;
  if (t.type === 'range') return `من ${t.start} إلى ${t.end}`;
  if (t.freq === 'daily') return 'يومياً';
  if (t.freq === 'every') return `كل ${t.n} أيام`;
  return 'أيام: ' + t.days.map(d => DAYS[d]).join('، ');
}

// ===== Views =====
const view = document.getElementById('view');
const titles = { today: 'اليوم', plan: 'الخطة', notes: 'مذكراتي', progress: 'التقدم' };
let tab = 'today';

function taskList(date) {
  const ts = tasksFor(date), d = S.done[date] || [];
  if (!ts.length) return `<div class="empty">لا توجد مهام لهذا اليوم</div>`;
  return ts.map(t => `<label class="task ${d.includes(t.id) ? 'done' : ''}">
    <input type="checkbox" data-date="${date}" data-id="${t.id}" ${d.includes(t.id) ? 'checked' : ''}>
    <span>${esc(t.name)}</span>${t.cat ? `<em class="tag">${esc(t.cat)}</em>` : t.type === 'habit' ? '<em class="tag">عادة</em>' : ''}
  </label>`).join('');
}

function renderToday() {
  const n = dayNum(), t = todayStr(), s = stat(t);
  let head;
  if (n < 1) head = `<p class="big">لم تبدأ الخطة بعد</p><p class="muted">تبدأ بعد ${1 - n} يوم</p>`;
  else if (n > 90) head = `<p class="big">انتهت الخطة 🎉</p><p class="muted">أكملت 90 يوماً</p>`;
  else head = `<p class="big">اليوم ${n} / 90</p><p class="muted">متبقي ${90 - n} يوم</p>`;
  const pp = Math.min(100, Math.max(0, n / 90 * 100));
  view.innerHTML = `
  <div class="card">${head}<div class="bar"><div style="width:${pp}%"></div></div></div>
  <div class="card">
    <h2>مهام اليوم</h2>
    <p class="muted">تقدم اليوم: ${s.done} / ${s.total} — ${s.pct}%</p>
    <div class="bar"><div style="width:${s.pct}%;background:var(--ok)"></div></div>
    <div style="margin-top:8px">${taskList(t)}</div>
  </div>
  <button class="btn sec" style="width:100%" data-act="schedule">جدول المهام</button>`;
}

function renderPlan() {
  const n = dayNum(); let html = `<div class="card legend">
    <span><i style="background:var(--ok)"></i>مكتمل</span>
    <span><i style="border:2px solid var(--pri)"></i>اليوم</span>
    <span><i style="border:1px solid var(--bad)"></i>غير مكتمل</span>
    <span><i style="background:var(--line)"></i>قادم</span></div>`;
  for (let w = 0; w < 13; w++) {
    let cells = '';
    for (let i = 1; i <= 7; i++) {
      const d = w * 7 + i; if (d > 90) break;
      const s = stat(dateOf(d));
      let c = '';
      if (d < n) c = s.total && s.done === s.total ? 'ok' : s.total ? 'miss' : '';
      else if (d === n) c = 'cur' + (s.total && s.done === s.total ? ' ok' : '');
      cells += `<button class="day ${c}" data-day="${d}">${d}</button>`;
    }
    html += `<div class="card"><h2>الأسبوع ${w + 1}</h2><div class="grid">${cells}</div></div>`;
  }
  view.innerHTML = html;
}

function renderProgress() {
  const n = Math.min(90, dayNum());
  let completed = 0, sumD = 0, sumT = 0;
  for (let d = 1; d <= n; d++) {
    const s = stat(dateOf(d)); sumD += s.done; sumT += s.total;
    if (s.total && s.done === s.total) completed++;
  }
  // streak: consecutive successful days ending today (today counts if done, else start from yesterday)
  let streak = 0, cur = todayStr();
  const ok = dt => { const s = stat(dt); return s.total > 0 && s.done === s.total; };
  if (!ok(cur)) cur = addDays(cur, -1);
  while (cur >= S.start && ok(cur)) { streak++; cur = addDays(cur, -1); }
  let bars = '';
  for (let i = 6; i >= 0; i--) {
    const dt = addDays(todayStr(), -i), s = stat(dt);
    bars += `<div><span>${s.pct}%</span><b style="height:${s.pct}%"></b>${DAYS[parse(dt).getDay()].slice(0, 3)}</div>`;
  }
  view.innerHTML = `
  <div class="card"><h2>تقدم 90 يوم</h2>
  <div class="stats">
    <div class="card"><p class="big">${Math.max(0, n)}</p><p class="muted">اليوم الحالي</p></div>
    <div class="card"><p class="big">${completed}</p><p class="muted">أيام مكتملة</p></div>
    <div class="card"><p class="big">${sumT ? Math.round(sumD / sumT * 100) : 0}%</p><p class="muted">نسبة الإنجاز</p></div>
    <div class="card"><p class="big">${streak} 🔥</p><p class="muted">أيام متتالية</p></div>
  </div></div>
  <div class="card"><h2>آخر 7 أيام</h2><div class="chart">${bars}</div></div>`;
}

let openNote = null;
function renderNotes() {
  if (openNote) {
    const nt = S.notes.find(x => x.id === openNote);
    if (!nt) { openNote = null; return renderNotes(); }
    view.innerHTML = `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="link" data-act="back">→ رجوع</button>
      <button class="link red" data-act="delnote" data-id="${nt.id}">حذف</button></div>
    <div class="card">
      <input type="text" class="note-title" id="nTitle" value="${esc(nt.title)}" placeholder="العنوان">
      <textarea id="nBody" placeholder="اكتب هنا...">${esc(nt.content)}</textarea>
      <p class="muted">يتم الحفظ تلقائياً</p></div>`;
    const up = () => { nt.title = nTitle.value; nt.content = nBody.value; save(); };
    nTitle.oninput = up; nBody.oninput = up;
    return;
  }
  view.innerHTML = `<button class="btn" style="width:100%;margin-bottom:14px" data-act="newnote">+ صفحة جديدة</button>
  <div class="card">${S.notes.length ? S.notes.map(x => `<div class="item" data-note="${x.id}" style="cursor:pointer">
    <div><b>${esc(x.title || 'بدون عنوان')}</b><small>${esc(x.content.slice(0, 50))}</small></div><span>‹</span></div>`).join('')
    : '<div class="empty">لا توجد صفحات بعد</div>'}</div>`;
}

function render() {
  document.getElementById('title').textContent = titles[tab];
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ({ today: renderToday, plan: renderPlan, notes: renderNotes, progress: renderProgress })[tab]();
}

// ===== Modal =====
const modal = document.getElementById('modal'), sheet = document.getElementById('sheet');
const openModal = html => { sheet.innerHTML = html; modal.classList.remove('hidden'); };
const closeModal = () => { modal.classList.add('hidden'); render(); };
modal.onclick = e => { if (e.target === modal) closeModal(); };

function showSchedule() {
  const sec = (title, list) => `<h2 style="margin-top:14px">${title}</h2>${list.length ? list.map(t => `<div class="item">
    <div><b>${esc(t.name)}</b><small>${describe(t)}${t.cat ? ' · ' + esc(t.cat) : ''}</small></div>
    <div><button class="link" data-act="edit" data-id="${t.id}">تعديل</button><button class="link red" data-act="del" data-id="${t.id}">حذف</button></div>
  </div>`).join('') : '<p class="muted">لا يوجد</p>'}`;
  openModal(`<div class="row" style="justify-content:space-between"><h2>جدول المهام</h2><button class="link" data-act="close">إغلاق</button></div>
  <div class="row"><button class="btn" data-act="addtask">+ إضافة مهمة</button><button class="btn sec" data-act="addhabit">+ إضافة عادة</button></div>
  ${sec('مهام أسبوعية', S.tasks.filter(t => t.type === 'weekly'))}
  ${sec('عادات', S.tasks.filter(t => t.type === 'habit'))}
  ${sec('مهام مؤقتة / لمرة واحدة', S.tasks.filter(t => t.type === 'once' || t.type === 'range'))}`);
}

function dayPicker(sel) {
  return `<div class="days" id="dp">${DAYS.map((d, i) => `<button type="button" data-wd="${i}" class="${sel.includes(i) ? 'on' : ''}">${d}</button>`).join('')}</div>`;
}
const pickedDays = () => [...sheet.querySelectorAll('#dp .on')].map(b => +b.dataset.wd);

function taskForm(t) {
  const isHabit = t ? t.type === 'habit' : false;
  t = t || { type: 'weekly', name: '', days: [], cat: '', date: todayStr(), start: todayStr(), end: addDays(todayStr(), 4) };
  openModal(`<h2>${t.id ? 'تعديل مهمة' : 'إضافة مهمة'}</h2>
  <label>اسم المهمة</label><input type="text" id="fName" value="${esc(t.name)}">
  <label>النوع</label><select id="fType">
    <option value="weekly">أسبوعية متكررة</option><option value="once">مرة واحدة</option><option value="range">فترة زمنية</option></select>
  <div id="fWeekly"><label>أيام الأسبوع</label>${dayPicker(t.days || [])}<label>التصنيف (اختياري)</label><input type="text" id="fCat" value="${esc(t.cat || '')}"></div>
  <div id="fOnce"><label>التاريخ</label><input type="date" id="fDate" value="${t.date || todayStr()}"></div>
  <div id="fRange"><label>من</label><input type="date" id="fStart" value="${t.start || todayStr()}"><label>إلى</label><input type="date" id="fEnd" value="${t.end || todayStr()}"></div>
  <div class="row" style="margin-top:16px"><button class="btn" id="fSave">حفظ</button><button class="btn sec" data-act="schedule">إلغاء</button></div>`);
  fType.value = t.type;
  const sync = () => { fWeekly.hidden = fType.value !== 'weekly'; fOnce.hidden = fType.value !== 'once'; fRange.hidden = fType.value !== 'range'; };
  fType.onchange = sync; sync();
  fSave.onclick = () => {
    const name = fName.value.trim(); if (!name) return alert('اكتب اسم المهمة');
    const n = { id: t.id || uid(), name, type: fType.value };
    if (n.type === 'weekly') { n.days = pickedDays(); n.cat = fCat.value.trim(); if (!n.days.length) return alert('اختر يوماً واحداً على الأقل'); }
    if (n.type === 'once') n.date = fDate.value;
    if (n.type === 'range') { n.start = fStart.value; n.end = fEnd.value; if (n.end < n.start) return alert('تاريخ النهاية قبل البداية'); }
    upsert(n); showSchedule();
  };
}

function habitForm(t) {
  t = t || { name: '', freq: 'daily', n: 2, days: [], from: todayStr() };
  openModal(`<h2>${t.id ? 'تعديل عادة' : 'إضافة عادة'}</h2>
  <label>اسم العادة</label><input type="text" id="hName" value="${esc(t.name)}">
  <label>التكرار</label><select id="hFreq"><option value="daily">يومياً</option><option value="every">كل عدد أيام</option><option value="days">أيام محددة</option></select>
  <div id="hEvery"><label>كل كم يوم؟</label><input type="number" min="1" id="hN" value="${t.n || 2}"></div>
  <div id="hDays"><label>الأيام</label>${dayPicker(t.days || [])}</div>
  <div class="row" style="margin-top:16px"><button class="btn" id="hSave">حفظ</button><button class="btn sec" data-act="schedule">إلغاء</button></div>`);
  hFreq.value = t.freq;
  const sync = () => { hEvery.hidden = hFreq.value !== 'every'; hDays.hidden = hFreq.value !== 'days'; };
  hFreq.onchange = sync; sync();
  hSave.onclick = () => {
    const name = hName.value.trim(); if (!name) return alert('اكتب اسم العادة');
    const n = { id: t.id || uid(), type: 'habit', name, freq: hFreq.value, n: +hN.value || 1, days: pickedDays(), from: t.from || S.start };
    if (n.freq === 'days' && !n.days.length) return alert('اختر يوماً واحداً على الأقل');
    upsert(n); showSchedule();
  };
}
function upsert(n) { const i = S.tasks.findIndex(x => x.id === n.id); i < 0 ? S.tasks.push(n) : S.tasks[i] = n; save(); }

function showDay(d) {
  const dt = dateOf(d), s = stat(dt);
  openModal(`<div class="row" style="justify-content:space-between"><h2>اليوم ${d} — ${dt}</h2><button class="link" data-act="close">إغلاق</button></div>
  <p class="muted">${DAYS[parse(dt).getDay()]} · ${s.done} / ${s.total} — ${s.pct}%</p>${taskList(dt)}`);
}

// ===== PWA install =====
let deferred = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
async function install() {
  if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; return; }
  if (matchMedia('(display-mode: standalone)').matches) return alert('التطبيق مثبت بالفعل ✅');
  alert('لتثبيت التطبيق يدوياً:\n\n• على آيفون (Safari): اضغط زر المشاركة ثم "إضافة إلى الشاشة الرئيسية".\n• على أندرويد (Chrome): افتح القائمة ⋮ ثم "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".');
}

function showSettings() {
  openModal(`<div class="row" style="justify-content:space-between"><h2>الإعدادات</h2><button class="link" data-act="close">إغلاق</button></div>
  <label>تاريخ بداية الخطة</label><input type="date" id="sStart" value="${S.start}">
  <label>المظهر</label><select id="sTheme"><option value="light">فاتح</option><option value="dark">داكن</option></select>
  <div style="display:grid;gap:10px;margin-top:18px">
    <button class="btn" data-act="install">تثبيت التطبيق</button>
    <button class="btn danger" data-act="reset">حذف كل البيانات</button></div>`);
  sTheme.value = S.theme;
  sStart.onchange = () => { if (sStart.value) { S.start = sStart.value; save(); } };
  sTheme.onchange = () => { S.theme = sTheme.value; save(); applyTheme(); };
}
const applyTheme = () => document.documentElement.classList.toggle('dark', S.theme === 'dark');

// ===== Events =====
document.addEventListener('change', e => {
  const c = e.target;
  if (c.matches('input[type=checkbox][data-id]')) {
    toggle(c.dataset.date, c.dataset.id);
    if (modal.classList.contains('hidden')) render(); else showDay(diff(S.start, c.dataset.date) + 1);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tab],[data-act],[data-day],[data-note],#dp button');
  if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; openNote = null; return render(); }
  if (b.dataset.day) return showDay(+b.dataset.day);
  if (b.dataset.note) { openNote = b.dataset.note; return render(); }
  if (b.dataset.wd !== undefined) return b.classList.toggle('on');
  const id = b.dataset.id;
  switch (b.dataset.act) {
    case 'schedule': return showSchedule();
    case 'close': return closeModal();
    case 'addtask': return taskForm();
    case 'addhabit': return habitForm();
    case 'edit': { const t = S.tasks.find(x => x.id === id); return t.type === 'habit' ? habitForm(t) : taskForm(t); }
    case 'del': if (confirm('حذف هذه المهمة؟')) { S.tasks = S.tasks.filter(x => x.id !== id); save(); } return showSchedule();
    case 'newnote': { const n = { id: uid(), title: '', content: '' }; S.notes.unshift(n); save(); openNote = n.id; return render(); }
    case 'back': openNote = null; return render();
    case 'delnote': if (confirm('حذف هذه الصفحة؟')) { S.notes = S.notes.filter(x => x.id !== id); save(); openNote = null; render(); } return;
    case 'install': return install();
    case 'reset': if (confirm('سيتم حذف كل البيانات نهائياً. هل أنت متأكد؟')) { S = fresh(); save(); applyTheme(); closeModal(); } return;
  }
});
document.getElementById('settingsBtn').onclick = showSettings;

applyTheme();
render();
// refresh "today" when the date changes while app is open
let lastDay = todayStr();
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayStr() !== lastDay) { lastDay = todayStr(); render(); } });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
