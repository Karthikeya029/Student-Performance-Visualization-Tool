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

// Pastel-first palette for charts (soft but still readable on white)
const PALETTE  = ['#6B8FF0','#F2A865','#6CCF9B','#B991F2','#66C7D8','#F29AA2','#EBCB6B'];
const CLASSES  = ['CS1','CS2','CS3','CS4'];
const SUBJECTS = ['Mathematics','Physics','English','French','DSA'];
const SUBJECT_COLOR_MAP = {
  Mathematics: '#6B8FF0',
  Physics:     '#F2A865',
  English:     '#6CCF9B',
  French:      '#B991F2',
  DSA:         '#66C7D8'
};
const EXAMS    = ['Minor 1','Mid Term','Minor 2','Final'];
const EXAM_MAX_MARKS = [20, 30, 20, 100];
const EXAM_WEIGHTS = [10, 30, 10, 50];

const _charts = {};
function mkChart(id, cfg) {
  if (_charts[id]) _charts[id].destroy();
  _charts[id] = new Chart(document.getElementById(id), cfg);
  return _charts[id];
}

function gradeColor(g) {
  return {
    'A+':'#6CCF9B',
    'A':'#8FE0B3',
    'B':'#6B8FF0',
    'C':'#F2A865',
    'D':'#EBCB6B',
    'F':'#F29AA2'
  }[g] || '#A3A3B3';
}
function getExamMaxMark(examIndex) {
  return EXAM_MAX_MARKS[examIndex] ?? 100;
}
function getExamWeight(examIndex) {
  return EXAM_WEIGHTS[examIndex] ?? 0;
}
function getExamLabel(examIndex) {
  return EXAMS[examIndex] || ('Exam ' + (examIndex + 1));
}
function getExamIndexFromInput(el) {
  const match = (el && el.id ? el.id : '').match(/^m(\d)$/);
  return match ? Number(match[1]) : null;
}
function normalizeMark(mark, examIndex) {
  const value = Number(mark) || 0;
  const max = getExamMaxMark(examIndex);
  return max > 0 ? (value / max) * 100 : 0;
}
function weightedContribution(mark, examIndex) {
  return normalizeMark(mark, examIndex) * (getExamWeight(examIndex) / 100);
}
function averageMarks(marks) {
  if (!Array.isArray(marks) || !marks.length) return 0;
  const score = marks.reduce((sum, mark, index) => sum + weightedContribution(mark, index), 0);
  return Math.round(score * 10) / 10;
}
function markToneClass(mark, examIndex, highClass, okClass, lowClass) {
  const pct = normalizeMark(mark, examIndex);
  return pct >= 80 ? highClass : pct < 60 ? lowClass : okClass;
}
function syncMarkInputMeta() {
  for (let i = 0; i < EXAM_MAX_MARKS.length; i++) {
    const el = document.getElementById('m' + i);
    if (!el) continue;
    const max = getExamMaxMark(i);
    el.min = '0';
    el.max = String(max);
    el.placeholder = '0-' + max;
  }
}
function subjectColor(subject) {
  return SUBJECT_COLOR_MAP[subject] || '#868e96';
}
function subjectColorsFor(list) {
  return list.map(subjectColor);
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
//  Rules: whole integers only, within each exam's max mark.
//         no special characters (-, +, e, E, ., etc.)
// ════════════════════════════════════════════════════════════════

// ── Key blocker — FIRST LINE of defence ──────────────────────────
// Attached via onkeydown="blockBadKeys(event)" on every number input
// Blocks: - + e E . and any non-digit key before it enters the field
function blockBadKeys(e) {
  const blocked = ['-', '+', 'e', 'E', '.', ',', ' ', '/', '*', '#', '!', '@', '='];
  if (blocked.includes(e.key)) {
    e.preventDefault();
    showToast('❌ Only whole numbers are allowed', 'err', 2000);
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
  // Normalize (removes leading zeros like 0009 -> 9)
  el.value = String(v);
  el.style.borderColor = '#2f9e44'; // green = valid
  return { ok: true, value: v };
}

// ── Public: validate a single mark input ─────────────────────────
// Returns { ok, value }
function validateMarkInput(el) {
  const examIndex = getExamIndexFromInput(el);
  const max = examIndex === null ? 100 : getExamMaxMark(examIndex);
  const label = examIndex === null ? 'Mark' : getExamLabel(examIndex);
  return _validateNumber(el, label, 0, max);
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
    const max = getExamMaxMark(i);
    const result = _validateNumber(el, getExamLabel(i), 0, max);
    if (!result.ok) {
      errors.push(getExamLabel(i) + ': must be a whole number 0-' + max);
      ok = false;
    } else {
      values.push(result.value);
    }
  }

  if (!ok) showToast('❌ Fix the highlighted marks using each exam\'s allowed range', 'err', 3500);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', syncMarkInputMeta);
} else {
  syncMarkInputMeta();
}

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
