// EduTrack — shared utilities v4 (full real-time + validation)
if(typeof Chart!=='undefined'){
  Chart.defaults.font.family="'DM Sans',sans-serif";
  Chart.defaults.font.size=12;
  Chart.defaults.color='#6b7280';
  Chart.defaults.plugins.tooltip.backgroundColor='#0d0f1a';
  Chart.defaults.plugins.tooltip.titleColor='#fff';
  Chart.defaults.plugins.tooltip.bodyColor='rgba(255,255,255,.75)';
  Chart.defaults.plugins.tooltip.padding=10;
  Chart.defaults.plugins.tooltip.cornerRadius=8;
  Chart.defaults.plugins.legend.labels.usePointStyle=true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth=8;
}

const PALETTE  = ['#3b5bdb','#f76707','#2f9e44','#ae3ec9','#1098ad','#e03131','#f59f00'];
const CLASSES  = ['CS1','CS2','CS3','CS4'];
const SUBJECTS = ['Mathematics','Science','English','History','Computer Science'];
const EXAMS    = ['Unit Test 1','Mid Term','Unit Test 2','Final'];

const _charts = {};
function mkChart(id, cfg) {
  if (_charts[id]) _charts[id].destroy();
  _charts[id] = new Chart(document.getElementById(id), cfg);
  return _charts[id];
}

function gradeColor(g) {
  return {'A+':'#2f9e44','A':'#40c057','B':'#3b5bdb','C':'#f76707','D':'#fd7e14','F':'#e03131'}[g] || '#868e96';
}
function calcGrade(avg) {
  if(avg>=90)return'A+'; if(avg>=80)return'A'; if(avg>=70)return'B';
  if(avg>=60)return'C';  if(avg>=50)return'D'; return'F';
}
function fmtTime(ts) {
  return new Date(ts||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function fmtAgo(ts) {
  const s=Math.floor((Date.now()-new Date(ts))/1000);
  if(s<60)return'just now'; if(s<3600)return Math.floor(s/60)+'m ago';
  if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago';
}
function logout() { localStorage.clear(); window.location.href='/'; }

async function api(url, opts={}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type':'application/json',
      'Authorization':'Bearer '+localStorage.getItem('token'),
      ...(opts.headers||{})
    }
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error||'API error');
  return d;
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type='ok', duration=3000) {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div'); t.id='_toast';
    Object.assign(t.style,{position:'fixed',bottom:'24px',right:'24px',
      padding:'13px 20px',borderRadius:'12px',fontSize:'14px',zIndex:'9999',
      transition:'all .35s cubic-bezier(.16,1,.3,1)',transform:'translateY(90px)',
      opacity:'0',pointerEvents:'none',fontFamily:"'DM Sans',sans-serif",
      fontWeight:'500',maxWidth:'360px',lineHeight:'1.5',
      boxShadow:'0 8px 28px rgba(0,0,0,.2)'});
    document.body.appendChild(t);
  }
  t.innerHTML = msg;
  t.style.background = {ok:'#0d0f1a',err:'#e03131',warn:'#f76707',info:'#3b5bdb'}[type]||'#0d0f1a';
  t.style.color = '#fff';
  t.style.transform = 'translateY(0)'; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>{ t.style.transform='translateY(90px)'; t.style.opacity='0'; }, duration);
}

// ── Live status badge ─────────────────────────────────────────────
function setLiveStatus(on) {
  let el = document.getElementById('_live');
  if (!el) {
    el = document.createElement('div'); el.id='_live';
    Object.assign(el.style,{position:'fixed',bottom:'24px',left:'calc(252px + 20px)',
      zIndex:'9999',display:'flex',alignItems:'center',gap:'6px',padding:'5px 13px',
      borderRadius:'100px',fontFamily:"'DM Sans',sans-serif",fontSize:'12px',fontWeight:'600',
      boxShadow:'0 2px 10px rgba(0,0,0,.12)',transition:'all .3s'});
    document.body.appendChild(el);
  }
  if (on) {
    el.style.background='rgba(47,158,68,.12)'; el.style.color='#2f9e44';
    el.style.border='1px solid rgba(47,158,68,.25)';
    el.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#2f9e44;display:inline-block;animation:pulse 1.4s infinite"></span> Live';
  } else {
    el.style.background='rgba(224,49,49,.1)'; el.style.color='#e03131';
    el.style.border='1px solid rgba(224,49,49,.2)';
    el.innerHTML='<span style="width:7px;height:7px;border-radius:50%;background:#e03131;display:inline-block"></span> Reconnecting…';
  }
}

// ── fmtAgo helper (used by notification panels in each dashboard) ─
// Each dashboard manages its own notification panel/list.

// ════════════════════════════════════════════════════════════════
//  INPUT VALIDATION
//  Rules: whole integers 0–100 ONLY. No decimals, no negatives,
//         no special characters (-, +, e, E, ., etc.)
// ════════════════════════════════════════════════════════════════

// ── Key blocker — FIRST LINE of defence ──────────────────────────
// Attached via onkeydown="blockBadKeys(event)" on every number input
// Blocks: - + e E . and any non-digit key before it enters the field
function blockBadKeys(e) {
  const blocked = ['-', '+', 'e', 'E', '.', ',', ' ', '/', '*', '#', '!', '@', '='];
  if (blocked.includes(e.key)) {
    e.preventDefault();
    showToast('❌ Only whole numbers 0–100 allowed', 'err', 2000);
    return;
  }
  // Also block if pasting would make it non-numeric
  if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
    // Allow — paste guard below handles cleanup
    return;
  }
}

// ── Private error helpers ─────────────────────────────────────────
function _setErr(el, msg) {
  el.style.borderColor = '#e03131';
  el.style.background  = 'rgba(224,49,49,.06)';
  let tip = el._tip;
  if (!tip) {
    tip = document.createElement('div');
    tip.style.cssText =
      'position:absolute;bottom:calc(100% + 5px);left:50%;transform:translateX(-50%);' +
      'background:#e03131;color:#fff;font-size:11px;font-weight:600;padding:4px 10px;' +
      'border-radius:6px;white-space:nowrap;z-index:9999;pointer-events:none;' +
      "font-family:'DM Sans',sans-serif;box-shadow:0 2px 8px rgba(224,49,49,.35);";
    el._tip = tip;
    const p = el.parentElement;
    if (getComputedStyle(p).position === 'static') p.style.position = 'relative';
    p.appendChild(tip);
  }
  tip.textContent = msg;
  tip.style.display = 'block';
}

function _clearErr(el) {
  el.style.borderColor = '';
  el.style.background  = '';
  if (el._tip) el._tip.style.display = 'none';
}

// ── Core validator — used by both marks and attendance ────────────
// Returns { ok: bool, value: int } always
function _validateNumber(el, label, min, max) {
  const raw = el.value.trim();

  // Empty
  if (raw === '') {
    _setErr(el, label + ' cannot be empty');
    return { ok: false, value: null };
  }

  // Must be purely digits (no decimals, no signs, no letters)
  if (!/^\d+$/.test(raw)) {
    el.value = raw.replace(/[^\d]/g, ''); // strip non-digits
    _setErr(el, 'Only whole numbers allowed (0–' + max + ')');
    setTimeout(() => _clearErr(el), 2500);
    return { ok: false, value: null };
  }

  const v = parseInt(raw, 10);

  if (v < min) {
    el.value = min;
    _setErr(el, label + ' cannot be less than ' + min);
    setTimeout(() => _clearErr(el), 2500);
    return { ok: false, value: null };
  }

  if (v > max) {
    el.value = max;
    _setErr(el, label + ' cannot exceed ' + max);
    setTimeout(() => _clearErr(el), 2500);
    return { ok: false, value: null };
  }

  _clearErr(el);
  el.style.borderColor = '#2f9e44'; // green = valid
  return { ok: true, value: v };
}

// ── Public: validate a single mark input ─────────────────────────
// Returns { ok, value }
function validateMarkInput(el) {
  return _validateNumber(el, 'Mark', 0, 100);
}

// ── Public: validate attendance input ────────────────────────────
// Returns { ok, value }  ← FIXED: was returning boolean, now returns object
function validateAttendanceInput(el) {
  return _validateNumber(el, 'Attendance', 0, 100);
}

// ── Public: validate all 4 mark inputs before save ───────────────
// Returns { ok, values, errors }
function validateAllMarkInputs() {
  const values = [];
  const errors = [];
  let ok = true;

  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('m' + i);
    if (!el) continue;
    const result = _validateNumber(el, 'Exam ' + (i+1), 0, 100);
    if (!result.ok) {
      errors.push('Exam ' + (i+1) + ': must be a whole number 0–100');
      ok = false;
    } else {
      values.push(result.value);
    }
  }

  if (!ok) showToast('❌ Fix the highlighted marks (whole numbers 0–100 only)', 'err', 3500);
  return { ok, values, errors };
}

// Keep old names as aliases so existing code doesn't break
function blockInvalidMarkKeys(e) { blockBadKeys(e); }
function blockInvalidAttKeys(e)  { blockBadKeys(e); }
// Paste guard — strip non-numeric chars after paste
document.addEventListener('paste', function(e) {
  const el = e.target;
  if (el.tagName !== 'INPUT' || el.type !== 'number') return;
  setTimeout(() => {
    // Remove everything except digits
    const cleaned = el.value.replace(/[^0-9]/g, '');
    el.value = cleaned;
    const id = el.id || '';
    if (/^m[0-3]$/.test(id))      validateMarkInput(el);
    if (id.startsWith('att-'))     validateAttendanceInput(el);
    if (id === 'ns-att')           validateAttendanceInput(el);
  }, 0);
});

// Inject shared styles once
(function() {
  const s = document.createElement('style');
  s.textContent =
    '@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.85)}}' +
    '@keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}' +
    '.notif-badge{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;' +
    'background:#e03131;border-radius:100px;font-size:10px;font-weight:700;color:#fff;' +
    'display:none;align-items:center;justify-content:center;padding:0 4px;' +
    'animation:popIn .25s cubic-bezier(.16,1,.3,1)}' +
    '.notif-badge.show{display:flex}' +
    '@keyframes popIn{from{transform:scale(0)}to{transform:scale(1)}}' +
    '.row-flash td{animation:rflash .9s ease}' +
    '@keyframes rflash{0%,100%{background:transparent}35%{background:rgba(59,91,219,.07)}}';
  document.head.appendChild(s);
})();
