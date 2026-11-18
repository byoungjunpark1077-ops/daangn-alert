/* 보면대 — 악보 보관함 + 악보 보기 */
(() => {
  'use strict';

  const CFG = Object.assign(
    { artifact: false, workerSrc: 'vendor/pdf.worker.min.js', samples: 'samples/' },
    window.BMD_CONFIG || {}
  );
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = CFG.workerSrc;

  /* ───────── 작은 도구들 ───────── */
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const ICON = {
    staff: '<svg viewBox="0 0 26 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 2h24M1 6h24M1 10h24M1 14h24M1 18h24"/><ellipse cx="17" cy="14" rx="3.2" ry="2.4" fill="currentColor" stroke="none" transform="rotate(-20 17 14)"/><path d="M19.8 13V3" stroke-width="1.8"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  };
  const icon = (name) => h('span', { html: ICON[name], style: 'display:contents' });

  const prefs = {
    get(k, d) { try { const v = localStorage.getItem('bmd:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('bmd:' + k, JSON.stringify(v)); } catch { /* 저장 못 해도 동작은 함 */ } },
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const ko = (a, b) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function dateOf(name) {
    const m = /^(\d{4})(\d{2})(\d{2})(?!\d)/.exec(name.trim());
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    if (d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[3]) return null;
    return { key: m[1] + m[2] + m[3], md: `${+m[2]}.${+m[3]}`, label: `${m[1]}.${m[2]}.${m[3]} (${WEEK[d.getDay()]})` };
  }
  const cleanTitle = (n) => (n || '악보').replace(/\.pdf$/i, '').trim() || '악보';
  const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || '악보';

  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = h('div', { class: 'toast', role: 'status' }); document.body.append(t); }
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2200);
  }

  /* ───────── 상태 ───────── */
  const state = {
    scores: new Map(),
    folders: [],
    tab: prefs.get('tab', 'folders'),
    view: { name: 'home' },
    query: '',
  };
  const settings = {
    mode: prefs.get('mode', 'half'), // single | half | two
    tap: prefs.get('tap', 'sides'), // sides | wide
  };
  const folderById = (id) => state.folders.find((f) => f.id === id);
  const foldersOf = (scoreId) => state.folders.filter((f) => f.items.includes(scoreId));

  async function loadAll() {
    const [scores, folders] = await Promise.all([DB.getAll('scores'), DB.getAll('folders')]);
    state.scores = new Map(scores.map((s) => [s.id, s]));
    state.folders = folders;
  }

  function groupFolders(list) {
    const t = todayKey();
    const g = { today: [], upcoming: [], other: [], past: [] };
    for (const f of list) {
      const d = dateOf(f.name);
      if (!d) g.other.push(f);
      else if (d.key === t) g.today.push(f);
      else if (d.key > t) g.upcoming.push(f);
      else g.past.push(f);
    }
    g.today.sort((a, b) => ko(a.name, b.name));
    g.upcoming.sort((a, b) => ko(a.name, b.name));
    g.other.sort((a, b) => ko(a.name, b.name));
    g.past.sort((a, b) => ko(b.name, a.name));
    return g;
  }

  /* ───────── 저장 동작 ───────── */
  async function saveFolder(f) { await DB.put('folders', f); }

  async function createFolder(name, items = []) {
    const f = { id: uid(), name: name.trim(), items, createdAt: Date.now() };
    state.folders.push(f);
    await saveFolder(f);
    return f;
  }

  async function addToFolder(f, ids) {
    let added = 0;
    for (const id of ids) if (!f.items.includes(id)) { f.items.push(id); added++; }
    await saveFolder(f);
    return added;
  }

  async function importFiles(files) {
    const pdfs = [...files].filter((f) => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')));
    if (!pdfs.length) { toast('PDF 파일만 넣을 수 있어요'); return []; }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { /* 선택 사항 */ }
    const ids = [];
    for (const f of pdfs) {
      const title = cleanTitle(f.name);
      const dup = [...state.scores.values()].find((s) => s.title === title && s.size === f.size);
      if (dup) { ids.push(dup.id); continue; }
      const blob = new Blob([await f.arrayBuffer()], { type: 'application/pdf' });
      const meta = { id: uid(), title, size: f.size, pages: 0, addedAt: Date.now() };
      await DB.addScore(meta, blob);
      state.scores.set(meta.id, meta);
      ids.push(meta.id);
    }
    return ids;
  }

  async function handleImport(files, folderId) {
    let ids;
    try { ids = await importFiles(files); }
    catch (e) { console.error(e); toast('저장 공간이 부족하거나 파일을 읽지 못했어요'); return; }
    if (!ids.length) return;
    const f = folderId && folderById(folderId);
    if (f) {
      await addToFolder(f, ids);
      toast(`${ids.length}개 악보를 '${f.name}'에 넣었어요`);
      render();
    } else {
      render();
      await sortIntoFolders(ids);
    }
  }

  function pickFiles(folderId) {
    const inp = h('input', { type: 'file', accept: 'application/pdf,.pdf', multiple: true, style: 'position:fixed;left:-9999px' });
    inp.addEventListener('change', () => { const files = [...inp.files]; inp.remove(); if (files.length) handleImport(files, folderId); });
    document.body.append(inp);
    inp.click();
  }

  /* ───────── 시트(대화상자) ───────── */
  function sheet(build) {
    return new Promise((resolve) => {
      const scrim = h('div', { class: 'scrim' });
      const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
      const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
      function close(v) { scrim.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); }
      box.append(...build(close));
      scrim.append(box);
      scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(null); });
      document.addEventListener('keydown', onKey, true);
      document.body.append(scrim);
      const inp = box.querySelector('input[type="text"]');
      if (inp) setTimeout(() => { inp.focus(); const n = inp.value.length; inp.setSelectionRange(n, n); }, 40);
    });
  }

  function askText(title, value = '', { ok = '저장', presets = [], hint } = {}) {
    return sheet((close) => {
      const inp = h('input', { type: 'text', id: 'ask-text', value, autocomplete: 'off', enterkeyhint: 'done' });
      const form = h('form', { onsubmit: (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) close(v); else inp.focus(); } },
        inp);
      const chips = presets.length ? h('div', { class: 'presets' }, presets.map((p) =>
        h('button', { type: 'button', onclick: () => { inp.value = p.value; inp.focus(); const n = inp.value.length; inp.setSelectionRange(n, n); } }, p.label))) : null;
      return [
        h('h3', null, title),
        form,
        chips,
        hint ? h('p', { class: 'hint' }, hint) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => close(null) }, '취소'),
          h('button', { class: 'btn primary', type: 'button', onclick: () => form.requestSubmit() }, ok)),
      ];
    });
  }

  function confirmBox(title, msg, ok, danger = true) {
    return sheet((close) => [
      h('h3', null, title),
      msg ? h('p', null, msg) : null,
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', onclick: () => close(false) }, '취소'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => close(true) }, ok)),
    ]);
  }

  function menu(title, items) {
    return sheet((close) => [
      h('h3', null, title),
      h('div', { class: 'menu' }, items.filter(Boolean).map((it) =>
        h('button', { class: it.danger ? 'danger' : null, onclick: () => { close(null); it.run(); } }, it.label))),
      h('div', { class: 'actions' }, h('button', { class: 'btn ghost', onclick: () => close(null) }, '닫기')),
    ]);
  }

  const folderPresets = () => [
    { label: `오늘 날짜 (${todayKey()})`, value: `${todayKey()} ` },
    { label: '솔로곡', value: '솔로곡' },
    { label: '실내악', value: '실내악' },
    { label: '오케스트라', value: '오케스트라' },
  ];
  const folderHint = '이름을 20261118 처럼 날짜로 시작하면 연주 날짜로 정리돼요. 그날이 되면 맨 위에 "오늘 연주"로 떠요.';

  async function newFolderFlow(initial = '') {
    const name = await askText('새 폴더', initial, { ok: '만들기', presets: folderPresets(), hint: folderHint });
    if (!name) return null;
    const f = await createFolder(name);
    render();
    return f;
  }

  /* 가져온 악보를 폴더에 넣기 */
  function sortIntoFolders(ids) {
    return sheet((close) => {
      const g = groupFolders(state.folders);
      const ordered = [...g.today, ...g.upcoming, ...g.other, ...g.past];
      const list = h('div', { class: 'checklist' });
      const addRow = (f, checked) => {
        const d = dateOf(f.name);
        list.append(h('label', null,
          h('input', { type: 'checkbox', value: f.id, checked }),
          h('span', null, f.name, d && d.key === todayKey() ? '  · 오늘' : '')));
      };
      ordered.forEach((f) => addRow(f, false));
      const newBtn = h('button', { class: 'btn', type: 'button', onclick: async () => {
        const name = await askText('새 폴더', '', { ok: '만들기', presets: folderPresets(), hint: folderHint });
        if (!name) return;
        const f = await createFolder(name);
        addRow(f, true);
        list.lastChild.scrollIntoView({ block: 'nearest' });
      } }, '+ 새 폴더');
      const names = ids.map((id) => state.scores.get(id)?.title).filter(Boolean);
      return [
        h('h3', null, `악보 ${ids.length}개를 넣었어요`),
        h('p', null, names.slice(0, 3).join(', ') + (names.length > 3 ? ` 외 ${names.length - 3}개` : '')),
        h('p', null, '어느 폴더에 넣을까요? 여러 곳을 골라도 파일은 하나만 저장돼요.'),
        list,
        h('div', { class: 'actions', style: 'justify-content:space-between' },
          newBtn,
          h('div', { style: 'display:flex;gap:8px' },
            h('button', { class: 'btn ghost', onclick: () => { close(null); toast('"전체 악보"에 넣어 두었어요'); } }, '나중에'),
            h('button', { class: 'btn primary', onclick: async () => {
              const picked = [...list.querySelectorAll('input:checked')].map((i) => folderById(i.value)).filter(Boolean);
              for (const f of picked) await addToFolder(f, ids);
              close(null);
              toast(picked.length ? `${picked.map((f) => f.name).join(', ')}에 넣었어요` : '"전체 악보"에 넣어 두었어요');
              render();
            } }, '넣기'))),
      ];
    });
  }

  /* 보관함에서 골라 폴더에 넣기 */
  function pickFromLibrary(f) {
    const all = [...state.scores.values()].sort((a, b) => ko(a.title, b.title));
    if (!all.length) { toast('아직 넣어 둔 악보가 없어요'); return; }
    return sheet((close) => {
      const filter = h('input', { class: 'search', type: 'search', id: 'pick-q', placeholder: '제목으로 찾기' });
      const list = h('div', { class: 'checklist' }, all.map((s) =>
        h('label', { 'data-t': s.title.toLowerCase() },
          h('input', { type: 'checkbox', value: s.id, checked: f.items.includes(s.id) }),
          h('span', null, s.title))));
      filter.addEventListener('input', () => {
        const q = filter.value.trim().toLowerCase();
        for (const l of list.children) l.hidden = q && !l.dataset.t.includes(q);
      });
      return [
        h('h3', null, `'${f.name}'에 넣을 악보`),
        filter,
        list,
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', onclick: () => close(null) }, '취소'),
          h('button', { class: 'btn primary', onclick: async () => {
            const checked = new Set([...list.querySelectorAll('input:checked')].map((i) => i.value));
            const kept = f.items.filter((id) => checked.has(id));
            const added = all.filter((s) => checked.has(s.id) && !f.items.includes(s.id)).map((s) => s.id);
            f.items = [...kept, ...added];
            await saveFolder(f);
            close(null);
            render();
          } }, '확인')),
      ];
    });
  }

  /* 다른 앱으로 보내기 (카카오톡 등) / 내려받기 */
  async function shareOrDownload(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: file.name }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: file.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function sendScore(s) {
    const blob = await DB.get('files', s.id);
    if (!blob) return toast('파일을 찾지 못했어요');
    await shareOrDownload(new File([blob], safeName(s.title) + '.pdf', { type: 'application/pdf' }));
  }

  async function exportFolder(f) {
    if (!f.items.length) return toast('폴더에 악보가 없어요');
    if (!window.JSZip) return toast('내보내기 도구를 불러오지 못했어요');
    toast('묶는 중…');
    const zip = new JSZip();
    const dir = zip.folder(safeName(f.name));
    let i = 1;
    for (const id of f.items) {
      const s = state.scores.get(id);
      const blob = await DB.get('files', id);
      if (s && blob) dir.file(`${pad(i++)}_${safeName(s.title)}.pdf`, blob);
    }
    const out = await zip.generateAsync({ type: 'blob' });
    await shareOrDownload(new File([out], safeName(f.name) + '.zip', { type: 'application/zip' }));
  }

  /* 메뉴들 */
  function folderMenu(f) {
    return menu(f.name, [
      { label: '이름 바꾸기', run: async () => {
        const n = await askText('폴더 이름 바꾸기', f.name, { presets: folderPresets(), hint: folderHint });
        if (n) { f.name = n; await saveFolder(f); render(); }
      } },
      !CFG.artifact && { label: 'PDF 묶음으로 보내기 (zip)', run: () => exportFolder(f) },
      { label: '폴더 삭제', danger: true, run: async () => {
        if (await confirmBox(`'${f.name}' 폴더를 지울까요?`, '안에 있던 악보 파일은 "전체 악보"에 그대로 남아요.', '폴더 삭제')) {
          await DB.del('folders', f.id);
          state.folders = state.folders.filter((x) => x !== f);
          if (state.view.name === 'folder' && state.view.id === f.id) goHome();
          else render();
        }
      } },
    ]);
  }

  function scoreMenu(s, inFolder) {
    return menu(s.title, [
      { label: '이름 바꾸기', run: async () => {
        const n = await askText('악보 이름 바꾸기', s.title);
        if (n) { s.title = n; await DB.put('scores', s); render(); }
      } },
      { label: '다른 폴더에도 넣기', run: () => chooseFoldersFor(s) },
      !CFG.artifact && { label: '다른 앱으로 보내기', run: () => sendScore(s) },
      inFolder && { label: `'${inFolder.name}'에서 빼기`, run: async () => {
        inFolder.items = inFolder.items.filter((x) => x !== s.id);
        await saveFolder(inFolder); render();
      } },
      { label: '악보 완전히 삭제', danger: true, run: async () => {
        const fs = foldersOf(s.id);
        if (await confirmBox(`'${s.title}'을(를) 지울까요?`, fs.length ? `${fs.map((f) => f.name).join(', ')} 폴더에서도 빠져요. 되돌릴 수 없어요.` : '되돌릴 수 없어요.', '삭제')) {
          await DB.deleteScore(s.id);
          state.scores.delete(s.id);
          for (const f of fs) f.items = f.items.filter((x) => x !== s.id);
          render();
        }
      } },
    ]);
  }

  function chooseFoldersFor(s) {
    if (!state.folders.length) return newFolderFlow().then((f) => f && addToFolder(f, [s.id]).then(render));
    return sheet((close) => {
      const g = groupFolders(state.folders);
      const list = h('div', { class: 'checklist' }, [...g.today, ...g.upcoming, ...g.other, ...g.past].map((f) =>
        h('label', null, h('input', { type: 'checkbox', value: f.id, checked: f.items.includes(s.id) }), h('span', null, f.name))));
      return [
        h('h3', null, `'${s.title}' 넣을 폴더`),
        list,
        h('div', { class: 'actions' },
          h('button', { class: 'btn ghost', onclick: () => close(null) }, '취소'),
          h('button', { class: 'btn primary', onclick: async () => {
            for (const inp of list.querySelectorAll('input')) {
              const f = folderById(inp.value);
              const has = f.items.includes(s.id);
              if (inp.checked && !has) { f.items.push(s.id); await saveFolder(f); }
              if (!inp.checked && has) { f.items = f.items.filter((x) => x !== s.id); await saveFolder(f); }
            }
            close(null); render();
          } }, '확인')),
      ];
    });
  }

  /* ───────── 설정 ───────── */
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function seg(options, current, onPick) {
    const wrap = h('div', { class: 'seg', role: 'group' });
    for (const [val, label] of options) {
      wrap.append(h('button', { type: 'button', 'aria-pressed': String(val === current), onclick: (e) => {
        for (const b of wrap.children) b.setAttribute('aria-pressed', 'false');
        e.currentTarget.setAttribute('aria-pressed', 'true');
        onPick(val);
      } }, label));
    }
    return wrap;
  }

  async function openSettings() {
    let usage = '';
    try { const e = await navigator.storage.estimate(); usage = `악보 ${state.scores.size}개 · 약 ${(e.usage / 1048576).toFixed(1)}MB 사용 중`; }
    catch { usage = `악보 ${state.scores.size}개`; }
    let shareHelp;
    if (isIOS()) shareHelp = '아이패드·아이폰: 카카오톡에서 PDF를 열고 공유 → "파일에 저장"을 누른 뒤, 여기서 "+ 악보 넣기"로 고르면 돼요.';
    else if (isAndroid()) shareHelp = standalone() ? '카카오톡에서 PDF를 길게 눌러 공유 → "보면대"를 고르면 바로 들어와요.' : '먼저 크롬 메뉴(⋮) → "앱 설치" 또는 "홈 화면에 추가"를 해 주세요. 그러면 카카오톡 공유 목록에 "보면대"가 나타나요.';
    else shareHelp = '노트북: PDF 파일을 이 창에 끌어다 놓거나 "+ 악보 넣기"를 누르세요.';
    let installHelp = null;
    if (!standalone() && !CFG.artifact) {
      installHelp = isIOS() ? 'Safari 공유 버튼 → "홈 화면에 추가"를 하면 앱처럼 열리고, 악보도 오래 안전하게 보관돼요.'
        : '브라우저 메뉴에서 "앱 설치"를 누르면 앱처럼 쓸 수 있어요.';
    }
    sheet((close) => [
      h('h3', null, '설정'),
      h('div', null, h('b', null, '페이지 넘기기'),
        seg([['single', '한 쪽씩'], ['half', '반 쪽씩'], ['two', '두 쪽 펼침']], settings.mode, (v) => { settings.mode = v; prefs.set('mode', v); })),
      h('p', { class: 'hint' }, '반 쪽씩: 한 번 넘기면 위쪽 절반에 다음 쪽이 먼저 나타나요. 아래 절반을 연주하는 동안 다음 쪽을 미리 볼 수 있어요. 두 쪽 펼침은 화면이 가로일 때만 적용돼요.'),
      h('div', null, h('b', null, '화면 터치'),
        seg([['sides', '왼쪽 이전 · 가운데 메뉴 · 오른쪽 다음'], ['wide', '왼쪽 ¼ 이전 · 나머지 다음']], settings.tap, (v) => { settings.tap = v; prefs.set('tap', v); })),
      h('p', { class: 'hint' }, '블루투스 페달은 따로 설정할 필요 없어요. 방향키, Page Up/Down, 스페이스 신호를 모두 받아요. 페달 없이 화면을 터치하거나 옆으로 밀어도 넘어가요.'),
      h('div', null, h('b', null, '카카오톡에서 받은 PDF 넣기'), h('p', { class: 'hint' }, shareHelp)),
      installHelp && h('div', null, h('b', null, '앱으로 설치'), h('p', { class: 'hint' }, installHelp)),
      h('p', { class: 'hint' }, usage + ' · 악보는 이 기기 안에만 저장돼요.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn primary', onclick: () => close(null) }, '닫기')),
    ]);
  }

  /* ───────── 화면 그리기 ───────── */
  let navDepth = 0;
  const canNav = !CFG.artifact;
  function pushNav() { if (canNav) { try { history.pushState({ bmd: ++navDepth }, ''); } catch { /* 무시 */ } } }

  function goFolder(id) { state.view = { name: 'folder', id }; state.query = ''; pushNav(); render(); window.scrollTo(0, 0); }
  function goHome() {
    if (canNav && navDepth > 0) { history.back(); return; }
    state.view = { name: 'home' }; render();
  }

  function render() {
    if (V.el) return; // 악보 보는 중에는 목록을 다시 그리지 않음
    const app = $('#app');
    if (state.view.name === 'folder' && folderById(state.view.id)) app.replaceChildren(...folderView(folderById(state.view.id)));
    else { state.view = { name: 'home' }; app.replaceChildren(...homeView()); }
  }

  function homeView() {
    const top = h('header', { class: 'topbar' },
      h('h1', null, h('span', { class: 'staff', html: ICON.staff }), '보면대'),
      h('button', { class: 'btn primary', onclick: () => pickFiles() }, '+ 악보 넣기'),
      h('button', { class: 'icon-btn', 'aria-label': '설정', onclick: openSettings }, icon('gear')));
    const tabs = h('div', { class: 'tabs', role: 'tablist' },
      h('button', { role: 'tab', 'aria-selected': String(state.tab === 'folders'), onclick: () => { state.tab = 'folders'; prefs.set('tab', 'folders'); state.query = ''; render(); } }, `폴더 ${state.folders.length}`),
      h('button', { role: 'tab', 'aria-selected': String(state.tab === 'all'), onclick: () => { state.tab = 'all'; prefs.set('tab', 'all'); state.query = ''; render(); } }, `전체 악보 ${state.scores.size}`));
    const body = h('div', { style: 'display:flex;flex-direction:column;gap:16px' });
    const search = h('input', {
      class: 'search', type: 'search', id: 'q', value: state.query, autocomplete: 'off',
      placeholder: state.tab === 'folders' ? '폴더 이름으로 찾기 (예: 빛고을, 실내악)' : '악보 제목으로 찾기',
      oninput: (e) => { state.query = e.target.value; fill(); },
    });
    const fill = () => body.replaceChildren(...(state.tab === 'folders' ? folderList() : scoreList()));
    fill();
    const showSearch = state.tab === 'folders' ? state.folders.length > 0 : state.scores.size > 0;
    return [top, tabs, showSearch ? search : null, body];
  }

  function emptyStart() {
    return h('div', { class: 'empty' },
      h('strong', null, '악보를 넣어 시작하세요'),
      h('span', null, '가지고 있는 PDF 악보를 넣고, "20261118 빛고을"이나 "실내악" 같은 폴더로 정리할 수 있어요.'),
      h('div', { class: 'btns' },
        h('button', { class: 'btn primary', onclick: () => pickFiles() }, '+ PDF 악보 넣기'),
        h('button', { class: 'btn', onclick: loadSamples }, '예시 악보로 둘러보기')));
  }

  function folderRow(f) {
    const d = dateOf(f.name);
    const sub = [`${f.items.length}곡`, d && d.label].filter(Boolean).join(' · ');
    return h('li', null,
      h('button', { class: 'row-main', onclick: () => goFolder(f.id) },
        h('span', { class: 'ficon', html: d ? d.md : ICON.folder }),
        h('span', { class: 'row-text' }, h('div', { class: 'row-title' }, f.name), h('div', { class: 'row-sub' }, sub))),
      h('button', { class: 'icon-btn', 'aria-label': `${f.name} 메뉴`, onclick: () => folderMenu(f) }, icon('more')));
  }

  function section(title, rows, action) {
    return [
      h('div', { class: 'section-h' }, h('h2', null, title), action || null),
      h('ul', { class: 'list' }, rows),
    ];
  }

  function folderList() {
    if (!state.folders.length && !state.scores.size) return [emptyStart()];
    const q = state.query.trim().toLowerCase();
    const g = groupFolders(q ? state.folders.filter((f) => f.name.toLowerCase().includes(q)) : state.folders);
    const out = [];
    for (const f of g.today) {
      out.push(h('button', { class: 'today', onclick: () => goFolder(f.id) },
        h('span', null,
          h('div', { class: 'lbl' }, '오늘 연주'),
          h('div', { class: 'nm' }, f.name),
          h('div', { class: 'meta' }, `${f.items.length}곡 · ${dateOf(f.name).label}`)),
        h('span', { class: 'go' }, '열기 →')));
    }
    if (!g.today.length && !q) {
      out.push(h('button', { class: 'btn', style: 'justify-content:flex-start', onclick: () => newFolderFlow(`${todayKey()} `) },
        `+ 오늘 연주 폴더 만들기 (${todayKey()} …)`));
    }
    const addBtn = h('button', { class: 'btn ghost', onclick: () => newFolderFlow() }, '+ 새 폴더');
    if (g.upcoming.length) out.push(...section('다가오는 연주', g.upcoming.map(folderRow)));
    out.push(...section('내 폴더', g.other.length ? g.other.map(folderRow)
      : [h('li', null, h('span', { class: 'row-sub' }, q ? '찾는 폴더가 없어요' : '솔로곡, 실내악, 오케스트라처럼 분류용 폴더를 만들어 보세요'))], addBtn));
    if (g.past.length) out.push(...section('지난 연주', g.past.map(folderRow)));
    return out;
  }

  function scoreRow(s, i, f) {
    const fs = f ? [] : foldersOf(s.id);
    const sub = h('div', { class: 'row-sub' },
      s.pages ? `${s.pages}쪽` : 'PDF', fs.length ? ' · ' : '', fs.slice(0, 3).map((x) => h('span', { class: 'chip' }, x.name)));
    const open = () => openViewer(f ? f.items.slice() : [s.id], f ? i : 0, f ? f.name : null);
    const li = h('li', null,
      h('button', { class: 'row-main', onclick: open },
        f ? h('span', { class: 'num' }, i + 1) : h('span', { class: 'ficon' }, 'PDF'),
        h('span', { class: 'row-text' }, h('div', { class: 'row-title' }, s.title), sub)));
    if (f) {
      li.append(h('span', { class: 'order-btns' },
        h('button', { class: 'icon-btn', 'aria-label': '위로', disabled: i === 0 || null, onclick: () => move(f, i, -1) }, '▲'),
        h('button', { class: 'icon-btn', 'aria-label': '아래로', disabled: i === f.items.length - 1 || null, onclick: () => move(f, i, 1) }, '▼')));
    }
    li.append(h('button', { class: 'icon-btn', 'aria-label': `${s.title} 메뉴`, onclick: () => scoreMenu(s, f) }, icon('more')));
    return li;
  }

  async function move(f, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= f.items.length) return;
    [f.items[i], f.items[j]] = [f.items[j], f.items[i]];
    await saveFolder(f);
    render();
  }

  function scoreList() {
    if (!state.scores.size) return [emptyStart()];
    const q = state.query.trim().toLowerCase();
    const list = [...state.scores.values()].filter((s) => !q || s.title.toLowerCase().includes(q)).sort((a, b) => ko(a.title, b.title));
    if (!list.length) return [h('div', { class: 'empty' }, '찾는 악보가 없어요')];
    return [h('ul', { class: 'list' }, list.map((s, i) => scoreRow(s, i, null))),
      h('p', { class: 'hint' }, '같은 악보를 여러 폴더에 넣어도 파일은 하나만 저장돼요.')];
  }

  function folderView(f) {
    const d = dateOf(f.name);
    const items = f.items.map((id) => state.scores.get(id)).filter(Boolean);
    const addMenu = () => menu('악보 추가', [
      { label: '기기에서 PDF 파일 넣기', run: () => pickFiles(f.id) },
      { label: '"전체 악보"에서 고르기', run: () => pickFromLibrary(f) },
    ]);
    const out = [
      h('header', { class: 'topbar' },
        h('button', { class: 'icon-btn', 'aria-label': '뒤로', onclick: goHome }, icon('back')),
        h('button', { class: 'crumb', title: '이름 바꾸기', onclick: async () => {
          const n = await askText('폴더 이름 바꾸기', f.name, { presets: folderPresets(), hint: folderHint });
          if (n) { f.name = n; await saveFolder(f); render(); }
        } }, f.name),
        h('button', { class: 'icon-btn', 'aria-label': '폴더 메뉴', onclick: () => folderMenu(f) }, icon('more'))),
      d ? h('p', { class: 'hint' }, `연주일 ${d.label}${d.key === todayKey() ? ' · 오늘' : ''}`) : null,
      h('div', { class: 'folder-actions' },
        h('button', { class: 'btn primary', disabled: !items.length || null, onclick: () => openViewer(items.map((s) => s.id), 0, f.name) }, '▶ 처음부터 보기'),
        h('button', { class: 'btn', onclick: addMenu }, '+ 악보 추가')),
    ];
    if (!items.length) {
      out.push(h('div', { class: 'empty' },
        h('strong', null, '아직 악보가 없어요'),
        h('span', null, '이 폴더에 연주할 곡을 순서대로 넣어 두세요.'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn primary', onclick: () => pickFiles(f.id) }, '기기에서 PDF 넣기'),
          state.scores.size ? h('button', { class: 'btn', onclick: () => pickFromLibrary(f) }, '"전체 악보"에서 고르기') : null)));
    } else {
      f.items = items.map((s) => s.id);
      out.push(h('ul', { class: 'list' }, items.map((s, i) => scoreRow(s, i, f))));
      out.push(h('p', { class: 'hint' }, '▲▼로 연주 순서를 바꿀 수 있어요. 한 곡이 끝나면 다음 곡으로 바로 넘어가요.'));
    }
    return out;
  }

  /* ───────── 예시 악보 ───────── */
  async function loadSamples() {
    const samples = [
      ['sample-1.pdf', '예시) 봄의 노래 – 바이올린 솔로'],
      ['sample-2.pdf', '예시) 현악 사중주 1악장'],
      ['sample-3.pdf', '예시) 축전 서곡 – 1st Violin'],
    ];
    try {
      toast('예시 악보를 넣는 중…');
      const files = [];
      for (const [file, title] of samples) {
        const r = await fetch(CFG.samples + file);
        if (!r.ok) throw new Error(file);
        files.push(new File([await r.blob()], title + '.pdf', { type: 'application/pdf' }));
      }
      const ids = await importFiles(files);
      await createFolder(`${todayKey()} 빛고을 (예시)`, ids.slice());
      await createFolder('솔로곡 (예시)', [ids[0]]);
      await createFolder('실내악 (예시)', [ids[1]]);
      await createFolder('오케스트라 (예시)', [ids[2]]);
      toast('예시를 넣었어요. 필요 없으면 폴더 메뉴에서 지우세요');
      render();
    } catch (e) {
      console.error(e);
      toast('예시 악보를 불러오지 못했어요');
    }
  }

  /* ───────── 악보 보기 ───────── */
  const V = {
    el: null, canvas: null, ctx: null, list: [], idx: 0, setName: null,
    doc: null, docs: new Map(), pages: 0, page: 1, half: 0,
    W: 0, H: 0, dpr: 1, cache: new Map(), token: 0, wake: null, hideTimer: null, pushed: false,
  };
  const CACHE_MAX = 6;

  function effMode() {
    if (settings.mode === 'two' && V.W < V.H * 1.1) return 'single';
    return settings.mode;
  }

  function openViewer(list, idx, setName) {
    if (V.el) return;
    if (!window.pdfjsLib) return toast('악보 보기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요');
    V.list = list; V.idx = idx; V.setName = setName;
    const el = h('div', { class: 'viewer', role: 'application', 'aria-label': '악보 보기' });
    V.canvas = h('canvas');
    V.ctx = V.canvas.getContext('2d');
    const top = h('div', { class: 'v-bar v-top' },
      h('button', { class: 'icon-btn', 'aria-label': '닫기', onclick: closeViewer }, icon('close')),
      h('div', { class: 'v-title' }, h('b', { id: 'v-name' }), h('small', { id: 'v-info' })),
      h('button', { class: 'v-mode', id: 'v-mode', onclick: cycleMode }),
      document.fullscreenEnabled ? h('button', { class: 'icon-btn', 'aria-label': '전체 화면', onclick: toggleFull }, icon('full')) : null);
    const range = h('input', { type: 'range', id: 'v-range', min: 1, max: 1, value: 1, step: 1, 'aria-label': '쪽 이동' });
    range.addEventListener('input', () => { $('#v-page').textContent = `${range.value} / ${V.pages}`; });
    range.addEventListener('change', () => { goPage(+range.value); range.blur(); });
    const bottom = h('div', { class: 'v-bar v-bottom' },
      h('button', { class: 'icon-btn', 'aria-label': '이전', onclick: () => prev() }, icon('left')),
      range,
      h('span', { class: 'v-page', id: 'v-page' }),
      h('button', { class: 'icon-btn', 'aria-label': '다음', onclick: () => next() }, icon('right')));
    el.append(V.canvas,
      h('div', { class: 'v-flash l' }), h('div', { class: 'v-flash r' }),
      h('div', { class: 'v-loading', id: 'v-loading' }, '악보를 여는 중…'),
      h('div', { class: 'v-next', id: 'v-next', hidden: true }),
      top, bottom);
    document.body.append(el);
    document.body.style.overflow = 'hidden';
    V.el = el;

    let sx = null, sy = 0, pointers = 0;
    el.addEventListener('pointerdown', (e) => {
      pointers++;
      if (e.target.closest('.v-bar')) return;
      sx = pointers === 1 ? e.clientX : null; sy = e.clientY;
    });
    const end = (e) => {
      pointers = Math.max(0, pointers - 1);
      if (sx == null || e.type === 'pointercancel') { sx = null; return; }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) { dx < 0 ? next() : prev(); return; }
      if (Math.hypot(dx, dy) < 14) onTap(e.clientX, e.clientY);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    lockScreen();
    if (canNav) { try { history.pushState({ bmd: ++navDepth, viewer: 1 }, ''); V.pushed = true; } catch { V.pushed = false; } }

    layout();
    showChrome(true);
    loadScore(idx, 1);
  }

  function closeViewer() {
    if (!V.el) return;
    if (V.pushed) { V.pushed = false; history.back(); return; } // popstate가 teardown 호출
    teardownViewer();
  }

  function teardownViewer() {
    if (!V.el) return;
    V.el.remove(); V.el = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    clearTimeout(V.hideTimer);
    try { V.wake && V.wake.release(); } catch { /* 무시 */ }
    V.wake = null; V.pushed = false;
    for (const p of V.docs.values()) p.then((d) => d.destroy()).catch(() => {});
    V.docs.clear(); V.cache.clear(); V.doc = null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    render();
  }

  async function lockScreen() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') V.wake = await navigator.wakeLock.request('screen'); }
    catch { /* 화면 꺼짐 방지를 못 해도 계속 */ }
  }
  document.addEventListener('visibilitychange', () => { if (V.el && document.visibilityState === 'visible') lockScreen(); });

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => toast('전체 화면을 쓸 수 없는 환경이에요'));
  }

  function showChrome(autoHide) {
    if (!V.el) return;
    V.el.classList.remove('chrome-off');
    clearTimeout(V.hideTimer);
    if (autoHide) V.hideTimer = setTimeout(hideChrome, 2600);
  }
  function hideChrome() { if (V.el) { clearTimeout(V.hideTimer); V.el.classList.add('chrome-off'); } }
  function toggleChrome() { V.el.classList.contains('chrome-off') ? showChrome(false) : hideChrome(); }

  function onTap(x, y) {
    const r = x / V.W;
    if (settings.tap === 'wide') {
      if (y / V.H < 0.14) return toggleChrome();
      return r < 0.25 ? prev() : next();
    }
    if (r < 1 / 3) prev();
    else if (r > 2 / 3) next();
    else toggleChrome();
  }

  const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Spacebar', 'Enter']);
  const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
  function onKey(e) {
    if (!V.el || $('.scrim')) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    let handled = true;
    if (NEXT_KEYS.has(e.key)) { if (!e.repeat) next(); }
    else if (PREV_KEYS.has(e.key)) { if (!e.repeat) prev(); }
    else if (e.key === 'Escape') closeViewer();
    else if (e.key === 'Home') goPage(1);
    else if (e.key === 'End') goPage(V.pages);
    else handled = false;
    if (handled) e.preventDefault();
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (!V.el) return; layout(); V.cache.clear(); normalize(); draw(); }, 150);
  }

  function layout() {
    V.W = V.el.clientWidth; V.H = V.el.clientHeight;
    V.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    V.canvas.width = Math.round(V.W * V.dpr);
    V.canvas.height = Math.round(V.H * V.dpr);
  }

  function getDoc(id) {
    if (V.docs.has(id)) return V.docs.get(id);
    const p = (async () => {
      const blob = await DB.get('files', id);
      if (!blob) throw new Error('파일 없음');
      const data = new Uint8Array(await blob.arrayBuffer());
      return pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    })();
    V.docs.set(id, p);
    p.catch(() => V.docs.delete(id));
    // 문서는 최대 3개(이전·현재·다음 곡)만 열어 둠
    while (V.docs.size > 3) {
      const [k, old] = V.docs.entries().next().value;
      V.docs.delete(k); old.then((d) => d.destroy()).catch(() => {});
    }
    return p;
  }

  async function loadScore(i, page, fromEnd) {
    V.idx = i;
    const id = V.list[i];
    const meta = state.scores.get(id);
    const loading = $('#v-loading');
    loading.hidden = false; loading.textContent = '악보를 여는 중…';
    let doc;
    try { doc = await getDoc(id); }
    catch (e) { console.error(e); loading.textContent = '이 악보를 열지 못했어요. 손상된 PDF일 수 있어요.'; return; }
    if (!V.el || V.list[V.idx] !== id) return;
    V.doc = doc; V.pages = doc.numPages; V.half = 0;
    if (meta && meta.pages !== V.pages) { meta.pages = V.pages; DB.put('scores', meta).catch(() => {}); }
    V.page = fromEnd ? lastStart() : Math.min(Math.max(1, page || 1), V.pages);
    normalize();
    $('#v-name').textContent = meta ? meta.title : '악보';
    const range = $('#v-range'); range.max = V.pages; range.disabled = V.pages < 2;
    await draw();
    loading.hidden = true;
    if (i + 1 < V.list.length) getDoc(V.list[i + 1]).catch(() => {}); // 다음 곡 미리 열기
  }

  function lastStart() {
    if (effMode() === 'two') return V.pages - ((V.pages - 1) % 2);
    return V.pages;
  }
  function normalize() {
    V.page = Math.min(Math.max(1, V.page), V.pages || 1);
    const m = effMode();
    if (m === 'two') V.page -= (V.page - 1) % 2;
    if (m !== 'half' || V.page >= V.pages) V.half = 0;
  }

  function pageCanvas(doc, id, n, bw, bh) {
    const key = `${id}|${n}|${bw}x${bh}|${V.dpr}`;
    if (V.cache.has(key)) { const v = V.cache.get(key); V.cache.delete(key); V.cache.set(key, v); return v; }
    const p = (async () => {
      const page = await doc.getPage(n);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = Math.min(bw / vp1.width, bh / vp1.height) * V.dpr;
      const vp = page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      return c;
    })();
    V.cache.set(key, p);
    p.catch(() => V.cache.delete(key));
    while (V.cache.size > CACHE_MAX) V.cache.delete(V.cache.keys().next().value);
    return p;
  }

  async function draw() {
    if (!V.el || !V.doc) return;
    const my = ++V.token;
    const doc = V.doc, id = V.list[V.idx], m = effMode(), n = V.pages, p = V.page;
    const W = V.W, H = V.H;
    let parts;
    try {
      if (m === 'two') {
        parts = await Promise.all([pageCanvas(doc, id, p, W / 2, H), p + 1 <= n ? pageCanvas(doc, id, p + 1, W / 2, H) : null]);
      } else if (m === 'half' && V.half === 1) {
        parts = await Promise.all([pageCanvas(doc, id, p, W, H), pageCanvas(doc, id, p + 1, W, H)]);
      } else {
        parts = [await pageCanvas(doc, id, p, W, H)];
      }
    } catch (e) { console.error(e); return; }
    if (my !== V.token || !V.el) return;

    const ctx = V.ctx, cw = V.canvas.width, ch = V.canvas.height;
    ctx.fillStyle = getComputedStyle(V.el).backgroundColor || '#26292f';
    ctx.fillRect(0, 0, cw, ch);
    if (m === 'two') {
      const [a, b] = parts;
      if (b) {
        ctx.drawImage(a, Math.round(cw / 2 - a.width), Math.round((ch - a.height) / 2));
        ctx.drawImage(b, Math.round(cw / 2), Math.round((ch - b.height) / 2));
      } else ctx.drawImage(a, Math.round((cw - a.width) / 2), Math.round((ch - a.height) / 2));
    } else {
      const a = parts[0];
      const x = Math.round((cw - a.width) / 2), y = Math.round((ch - a.height) / 2);
      ctx.drawImage(a, x, y);
      if (parts[1]) {
        // 반 쪽 넘김: 위 절반에는 다음 쪽 윗부분, 아래 절반에는 지금 쪽 아랫부분
        const b = parts[1];
        const split = Math.round(y + a.height / 2);
        const bx = Math.round((cw - b.width) / 2), by = Math.round((ch - b.height) / 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(Math.min(x, bx), 0, Math.max(a.width, b.width), split);
        ctx.fillStyle = getComputedStyle(V.el).backgroundColor || '#26292f';
        ctx.fillRect(0, 0, Math.min(x, bx), split);
        ctx.fillRect(Math.min(x, bx) + Math.max(a.width, b.width), 0, cw, split);
        const srcH = Math.max(0, Math.min(b.height, split - by));
        if (srcH > 0) ctx.drawImage(b, 0, 0, b.width, srcH, bx, by, b.width, srcH);
        const lw = Math.max(2, Math.round(2 * V.dpr));
        ctx.fillStyle = 'rgba(23,105,90,.85)';
        ctx.fillRect(Math.min(x, bx), split - lw / 2, Math.max(a.width, b.width), lw);
        ctx.font = `600 ${Math.round(12 * V.dpr)}px system-ui, sans-serif`;
        const label = `▲ ${p + 1}쪽   ▼ ${p}쪽`;
        const tw = ctx.measureText(label).width + 16 * V.dpr;
        const lx = Math.min(x, bx) + Math.max(a.width, b.width) - tw - 8 * V.dpr;
        ctx.fillRect(lx, split - 11 * V.dpr, tw, 22 * V.dpr);
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + 8 * V.dpr, split);
      }
    }
    updateChrome();
    prefetch();
  }

  function prefetch() {
    const doc = V.doc, id = V.list[V.idx], m = effMode(), n = V.pages, p = V.page;
    const want = m === 'two' ? [p + 2, p + 3] : [p + 1];
    const bw = m === 'two' ? V.W / 2 : V.W;
    for (const k of want) if (k <= n) pageCanvas(doc, id, k, bw, V.H).catch(() => {});
  }

  function isLastView() {
    const m = effMode();
    if (m === 'two') return V.page + 1 >= V.pages;
    return V.page >= V.pages;
  }

  function updateChrome() {
    const m = effMode(), n = V.pages, p = V.page;
    let pg = `${p}`;
    if (m === 'two' && p + 1 <= n) pg = `${p}–${p + 1}`;
    if (m === 'half' && V.half === 1) pg = `${p}½`;
    const parts = [`${pg} / ${n}쪽`];
    if (V.list.length > 1) parts.push(`${V.idx + 1}/${V.list.length}곡`);
    if (V.setName) parts.push(V.setName);
    $('#v-info').textContent = parts.join(' · ');
    $('#v-page').textContent = `${p} / ${n}`;
    $('#v-range').value = p;
    $('#v-mode').textContent = { single: '한 쪽씩', half: '반 쪽씩', two: '두 쪽' }[settings.mode];
    const nx = $('#v-next');
    const nextMeta = state.scores.get(V.list[V.idx + 1]);
    if (isLastView() && nextMeta) { nx.hidden = false; nx.textContent = `다음 곡: ${nextMeta.title} →`; }
    else nx.hidden = true;
  }

  function flash(side) {
    const f = V.el && V.el.querySelector('.v-flash.' + side);
    if (!f) return;
    f.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
  }

  function next() {
    if (!V.doc) return;
    const m = effMode(), n = V.pages;
    if (m === 'single') { if (V.page < n) V.page++; else return nextScore(); }
    else if (m === 'half') {
      if (V.half === 0 && V.page < n) V.half = 1;
      else if (V.half === 1) { V.page++; V.half = 0; }
      else return nextScore();
    } else { if (V.page + 2 <= n) V.page += 2; else return nextScore(); }
    flash('r'); draw();
  }

  function prev() {
    if (!V.doc) return;
    const m = effMode();
    if (m === 'single') { if (V.page > 1) V.page--; else return prevScore(); }
    else if (m === 'half') {
      if (V.half === 1) V.half = 0;
      else if (V.page > 1) { V.page--; V.half = 1; }
      else return prevScore();
    } else { if (V.page > 1) V.page = Math.max(1, V.page - 2); else return prevScore(); }
    flash('l'); draw();
  }

  function nextScore() {
    if (V.idx + 1 < V.list.length) { flash('r'); loadScore(V.idx + 1, 1); }
    else toast(V.list.length > 1 ? '마지막 곡의 마지막 쪽이에요' : '마지막 쪽이에요');
  }
  function prevScore() {
    if (V.idx > 0) { flash('l'); loadScore(V.idx - 1, 0, true); }
    else toast('첫 쪽이에요');
  }

  function goPage(n) { V.page = n; V.half = 0; normalize(); draw(); }

  function cycleMode() {
    const order = ['single', 'half', 'two'];
    settings.mode = order[(order.indexOf(settings.mode) + 1) % 3];
    prefs.set('mode', settings.mode);
    normalize();
    toast({ single: '한 쪽씩 넘기기', half: '반 쪽씩 넘기기', two: V.W < V.H * 1.1 ? '두 쪽 펼침 (가로 화면에서 적용)' : '두 쪽 펼침' }[settings.mode]);
    draw();
    showChrome(true);
  }

  /* ───────── 뒤로 가기 버튼 (안드로이드 등) ───────── */
  window.addEventListener('popstate', () => {
    navDepth = Math.max(0, navDepth - 1);
    if (V.el) { V.pushed = false; teardownViewer(); return; }
    if ($('.scrim')) $('.scrim').remove();
    if (state.view.name === 'folder') { state.view = { name: 'home' }; render(); }
  });

  /* ───────── 끌어다 놓기 ───────── */
  let dragDepth = 0;
  const dz = () => $('.dropzone') || document.body.appendChild(h('div', { class: 'dropzone', hidden: true }, h('div', null, '여기에 놓으면 악보가 들어가요')));
  const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  document.addEventListener('dragenter', (e) => { if (!hasFiles(e) || V.el) return; e.preventDefault(); dragDepth++; dz().hidden = false; });
  document.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dz().hidden = true; });
  document.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; dz().hidden = true;
    if (V.el) return;
    handleImport([...e.dataTransfer.files], state.view.name === 'folder' ? state.view.id : null);
  });

  /* ───────── 시작 ───────── */
  async function takeShared() {
    let items = [];
    try { items = await DB.takeInbox(); } catch { /* 무시 */ }
    if (location.search.includes('shared')) { try { history.replaceState(null, '', location.pathname); } catch { /* 무시 */ } }
    if (items.length) {
      const files = items.map((it) => new File([it.blob], it.name || '악보.pdf', { type: 'application/pdf' }));
      await handleImport(files);
    }
  }

  async function start() {
    try { await loadAll(); }
    catch (e) {
      console.error(e);
      $('#app').replaceChildren(h('div', { class: 'empty' }, h('strong', null, '저장 공간을 열 수 없어요'),
        h('span', null, '사생활 보호(시크릿) 모드에서는 악보를 저장할 수 없어요. 일반 창에서 열어 주세요.')));
      return;
    }
    render();
    await takeShared();
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (params) => {
        if (!params.files || !params.files.length) return;
        const files = await Promise.all(params.files.map((fh) => fh.getFile()));
        handleImport(files);
      });
    }
    if (!CFG.artifact && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('서비스 워커 등록 실패', e));
      navigator.serviceWorker.addEventListener('message', (e) => { if (e.data === 'shared') takeShared(); });
    }
  }

  start();
})();
