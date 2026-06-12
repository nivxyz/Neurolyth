
// ── ONBOARDING ──────────────────────────────────────────────
const nameInput = document.getElementById('name-input');
const nameBtn   = document.getElementById('name-btn');
nameInput.addEventListener('input', () => nameBtn.disabled = !nameInput.value.trim());
nameInput.addEventListener('keydown', e => { if(e.key==='Enter' && !nameBtn.disabled) launch(); });
nameBtn.addEventListener('click', launch);

function launch(){
  const name = nameInput.value.trim(); if(!name)return;
  const wel = document.getElementById('screen-welcome');
  wel.style.transition='opacity 0.4s ease, transform 0.4s ease';
  wel.style.opacity='0'; wel.style.transform='translateY(-20px)';
  setTimeout(()=>{
    wel.style.display='none';
    const app = document.getElementById('screen-app');
    app.style.display = 'block';
    requestAnimationFrame(()=>requestAnimationFrame(()=>app.classList.add('show')));
    renderTasks(); updateTodoStats();
  },400);
}

// ── LANDING PAGE ────────────────────────────────────────────
let landingInit = false;
function initLandingScroll(){
  if(landingInit) return;
  landingInit = true;

  const landing     = document.getElementById('screen-landing');
  const svg         = document.getElementById('scroll-path');
  const bgPath      = document.getElementById('scroll-path-bg');
  const fillPath    = document.getElementById('scroll-path-fill');
  const dot         = document.getElementById('scroll-path-dot');
  const parallaxEls = [...document.querySelectorAll('#screen-landing [data-parallax]')];
  let pathLen = 0;

  // Build a winding path that weaves down the centre of the page.
  function buildPath(){
    const W = landing.clientWidth;
    const H = landing.scrollHeight;
    if(!W || !H) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.height = H + 'px';

    const cx   = W / 2;
    const amp  = Math.min(W * 0.30, 300);   // how far it swings left/right
    const waves = Math.max(2.5, H / 620);   // roughly one bend per section
    const freq = waves * Math.PI * 2 / H;
    const step = 14;

    let d = '';
    for(let y = 0; y <= H; y += step){
      const x = cx + amp * Math.sin(y * freq);
      d += (y === 0 ? `M ${x.toFixed(1)} 0` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    bgPath.setAttribute('d', d);
    fillPath.setAttribute('d', d);
    pathLen = fillPath.getTotalLength();
    fillPath.style.strokeDasharray = pathLen;
    fillPath.style.strokeDashoffset = pathLen;
  }

  function onScroll(){
    if(landing.style.display === 'none') return;
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const prog = Math.min(1, Math.max(0, window.scrollY / scrollable));
    if(pathLen){
      fillPath.style.strokeDashoffset = pathLen * (1 - prog);
      const pt = fillPath.getPointAtLength(pathLen * prog);
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
    }
    parallaxEls.forEach(el => {
      const factor = parseFloat(el.dataset.parallax) || 0;
      el.style.transform = `translateY(${window.scrollY*factor}px)`;
    });
  }

  function rebuild(){ buildPath(); onScroll(); }

  // Layout/fonts may not be settled when this first runs — retry until the
  // page has a real height and the path actually has length.
  function ensureBuilt(tries){
    rebuild();
    if((pathLen < 50 || landing.scrollHeight < 300) && tries > 0){
      setTimeout(() => ensureBuilt(tries - 1), 120);
    }
  }

  let resizeT;
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(rebuild, 150); });
  window.addEventListener('load', rebuild);

  requestAnimationFrame(() => ensureBuilt(10));
  setTimeout(rebuild, 500); // final recompute once fonts/layout settle

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold:0.12 });
  document.querySelectorAll('#screen-landing .reveal').forEach(el => obs.observe(el));
}

function showAuth(){
  document.getElementById('screen-landing').style.display = 'none';
  const a = document.getElementById('screen-auth');
  a.style.display = 'flex';
  a.style.opacity = '0';
  requestAnimationFrame(() => { a.style.transition = 'opacity 0.35s ease'; a.style.opacity = '1'; });
  window.scrollTo(0,0);
}

function showLanding(){
  document.getElementById('screen-auth').style.display = 'none';
  document.getElementById('screen-landing').style.display = 'block';
  window.scrollTo(0,0);
  initLandingScroll();
}

document.addEventListener('click', (e) => {
  if(e.target.closest('[data-goauth]')){ showAuth(); return; }
  if(e.target.closest('[data-goland]')){ showLanding(); return; }
  const sc = e.target.closest('[data-scroll]');
  if(sc){ document.getElementById(sc.dataset.scroll)?.scrollIntoView({ behavior:'smooth' }); }
});

// TEMP: font tester — try each signature font live; choice persists locally
(function(){
  const tester = document.getElementById('font-tester');
  if(!tester) return;
  const KEY = 'neurolyth_test_font';
  const btns = [...tester.querySelectorAll('button[data-font]')];
  btns.forEach(b => { b.style.fontFamily = b.dataset.font; }); // preview each in its own font
  function apply(font){
    document.documentElement.style.setProperty('--font-display', font);
    btns.forEach(b => b.classList.toggle('active', b.dataset.font === font));
    try { localStorage.setItem(KEY, font); } catch {}
  }
  btns.forEach(b => b.addEventListener('click', () => apply(b.dataset.font)));
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  if(saved){ apply(saved); } else { btns[0].classList.add('active'); }
})();

// ── TABS ────────────────────────────────────────────────────
document.querySelectorAll('.tnav-btn').forEach(t => {
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tnav-btn').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('panel-'+t.dataset.tab).classList.add('active');
    if(t.dataset.tab==='progress') renderProgress();
  });
});

// ── TODO ────────────────────────────────────────────────────
let tasks=[], selectedPriority='high';

document.querySelectorAll('.pri-btn').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.pri-btn').forEach(x=>x.classList.remove('selected'));
    b.classList.add('selected');
    selectedPriority=b.dataset.pri;
  });
});

document.getElementById('add-btn').addEventListener('click',addTask);
document.getElementById('task-input').addEventListener('keydown',e=>{ if(e.key==='Enter')addTask(); });

function addTask(){
  const text=document.getElementById('task-input').value.trim(); if(!text)return;
  const subject=document.getElementById('task-subject').value;
  const deadline=document.getElementById('task-deadline').value;
  tasks.push({id:Date.now(),text,priority:selectedPriority,subject,deadline,done:false});
  saveTaskToFirestore(tasks[tasks.length-1]);
  document.getElementById('task-input').value='';
  document.getElementById('task-deadline').value='';
  document.getElementById('task-subject').value='';
  renderTasks(); updateTodoStats();
  document.getElementById('task-input').focus();
}

function toggleTask(id){
  const t=tasks.find(t=>t.id===id);
  if(t){
    t.done=!t.done;
    saveTaskToFirestore(t);
    renderTasks();
    updateTodoStats();
  }
}

function removeTask(id){
  const el=document.querySelector(`[data-id="${id}"]`);
  if(el){ el.classList.add('removing'); setTimeout(()=>{tasks=tasks.filter(t=>t.id!==id); deleteTaskFromFirestore(id); renderTasks();updateTodoStats();},260); }
}

const PRIORITY_ORDER={high:0,medium:1,low:2};

function deadlineInfo(dl){
  if(!dl)return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const d=new Date(dl+'T00:00:00');
  const diff=Math.round((d-today)/(1000*60*60*24));
  if(diff<0) return {label:`Overdue by ${Math.abs(diff)}d`,cls:'overdue'};
  if(diff===0) return {label:'Due today',cls:'soon'};
  if(diff<=3) return {label:`Due in ${diff}d`,cls:'soon'};
  return {label:`Due ${d.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`,cls:''};
}

function renderTasks(){
  const tl=document.getElementById('task-list');
  [...tl.querySelectorAll('.task-item,.tasks-loading')].forEach(e=>e.remove());
  document.getElementById('empty-msg').style.display=tasks.length?'none':'block';

  const sorted=[...tasks].sort((a,b)=>{
    if(a.done!==b.done) return a.done?1:-1;
    return PRIORITY_ORDER[a.priority]-PRIORITY_ORDER[b.priority];
  });

  sorted.forEach(t=>{
    const item=document.createElement('div');
    item.className=`task-item pri-${t.priority}${t.done?' done':''}`;
    item.dataset.id=t.id;

    const check=document.createElement('button');
    check.className='check-btn'; check.textContent=t.done?'✓':'';
    check.addEventListener('click',()=>toggleTask(t.id));

    const body=document.createElement('div'); body.className='task-body';
    const txt=document.createElement('div'); txt.className='task-text'; txt.textContent=t.text;
    body.appendChild(txt);

    const meta=document.createElement('div'); meta.className='task-meta';
    const priLabel={high:'High',medium:'Medium',low:'Low'};
    const priChip=document.createElement('span');
    priChip.className=`meta-chip chip-pri ${t.priority}`; priChip.textContent=priLabel[t.priority];
    meta.appendChild(priChip);
    if(t.subject){ const sc=document.createElement('span'); sc.className='meta-chip chip-subject'; sc.textContent=t.subject; meta.appendChild(sc); }
    if(t.deadline){
      const di=deadlineInfo(t.deadline);
      const dc=document.createElement('span');
      dc.className=`meta-chip chip-deadline${di?' '+di.cls:''}`; dc.textContent=di?di.label:t.deadline;
      meta.appendChild(dc);
    }
    body.appendChild(meta);

    const del=document.createElement('button'); del.className='del-btn'; del.textContent='×';
    del.addEventListener('click',()=>removeTask(t.id));

    item.append(check,body,del); tl.appendChild(item);
  });
}

function updateTodoStats(){
  const done=tasks.filter(t=>t.done).length;
  const high=tasks.filter(t=>t.priority==='high'&&!t.done).length;
  const med=tasks.filter(t=>t.priority==='medium'&&!t.done).length;
  const low=tasks.filter(t=>t.priority==='low'&&!t.done).length;
  const s=document.getElementById('todo-stats'); s.innerHTML='';
  if(!tasks.length)return;
  s.innerHTML=`<span>${done}/${tasks.length} done</span>`
    +(high?`<span><span class="stat-dot" style="background:var(--green)"></span>${high} high</span>`:'')
    +(med?`<span><span class="stat-dot" style="background:var(--yellow)"></span>${med} medium</span>`:'')
    +(low?`<span><span class="stat-dot" style="background:var(--red)"></span>${low} low</span>`:'');
}

// ── MARKS (DYNAMIC) ─────────────────────────────────────────
let userExams = []; // [{ id, label, subjects:[{ id, name, max }] }]
let userMarks = {}; // { examId: { subjectId: value|null } }
let activeExamIdx = 0;
let setupDirty = false;
let setupOpen = true;

function genId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

// ── SETUP PANEL ──────────────────────────────────────────────
function renderSetup(){
  const list = document.getElementById('setup-exams-list');
  if(!list) return;
  list.innerHTML = '';
  userExams.forEach((exam, ei) => {
    const card = document.createElement('div');
    card.className = 'setup-exam-card';

    const hdr = document.createElement('div');
    hdr.className = 'setup-exam-hdr';
    const nameInp = document.createElement('input');
    nameInp.className = 'setup-exam-name'; nameInp.value = exam.label;
    nameInp.placeholder = 'Exam name (e.g. SA-1)';
    nameInp.addEventListener('input', () => { userExams[ei].label = nameInp.value; markDirty(); });
    const delExamBtn = document.createElement('button');
    delExamBtn.className = 'setup-del-exam'; delExamBtn.textContent = 'Remove';
    delExamBtn.addEventListener('click', () => { userExams.splice(ei,1); renderSetup(); renderMarks(); markDirty(); });
    hdr.append(nameInp, delExamBtn);

    const subjsEl = document.createElement('div');
    subjsEl.className = 'setup-subjects';
    exam.subjects.forEach((s, si) => {
      const row = document.createElement('div');
      row.className = 'setup-subj-row';
      const sNameInp = document.createElement('input');
      sNameInp.className = 'setup-subj-name'; sNameInp.value = s.name; sNameInp.placeholder = 'Subject';
      sNameInp.addEventListener('input', () => { userExams[ei].subjects[si].name = sNameInp.value; markDirty(); });
      const sep = document.createElement('span');
      sep.className = 'setup-sep'; sep.textContent = 'out of';
      const maxInp = document.createElement('input');
      maxInp.className = 'setup-subj-max'; maxInp.type = 'number';
      maxInp.min = '1'; maxInp.max = '1000'; maxInp.value = s.max; maxInp.placeholder = '100';
      maxInp.addEventListener('input', () => {
        const v = parseInt(maxInp.value);
        if(!isNaN(v) && v > 0){ userExams[ei].subjects[si].max = v; markDirty(); }
      });
      const delBtn = document.createElement('button');
      delBtn.className = 'setup-del-subj'; delBtn.textContent = '×';
      delBtn.addEventListener('click', () => { userExams[ei].subjects.splice(si,1); renderSetup(); renderMarks(); markDirty(); });
      row.append(sNameInp, sep, maxInp, delBtn);
      subjsEl.appendChild(row);
    });

    const addSubjBtn = document.createElement('button');
    addSubjBtn.className = 'setup-add-subj'; addSubjBtn.textContent = '+ Add Subject';
    addSubjBtn.addEventListener('click', () => {
      userExams[ei].subjects.push({ id: genId(), name: '', max: 100 });
      renderSetup();
      const inputs = card.querySelectorAll('.setup-subj-name');
      if(inputs.length) inputs[inputs.length-1].focus();
      markDirty();
    });

    card.append(hdr, subjsEl, addSubjBtn);
    list.appendChild(card);
  });
  const saveBtn = document.getElementById('setup-save-btn');
  if(saveBtn) saveBtn.style.display = setupDirty ? 'inline-flex' : 'none';
}

function markDirty(){
  setupDirty = true;
  const saveBtn = document.getElementById('setup-save-btn');
  if(saveBtn) saveBtn.style.display = 'inline-flex';
}

document.getElementById('setup-add-exam-btn').addEventListener('click', () => {
  userExams.push({ id: genId(), label: '', subjects: [] });
  renderSetup();
  const inputs = document.querySelectorAll('.setup-exam-name');
  if(inputs.length) inputs[inputs.length-1].focus();
  markDirty();
});

document.getElementById('setup-save-btn').addEventListener('click', async () => {
  const saveBtn = document.getElementById('setup-save-btn');
  const statusEl = document.getElementById('setup-status');
  if(!currentUser){
    if(statusEl){ statusEl.textContent = 'Not signed in — cannot save.'; statusEl.className = 'setup-status err'; }
    return;
  }
  saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
  if(statusEl){ statusEl.textContent = ''; statusEl.className = 'setup-status'; }
  try {
    await saveExamConfig();
    setupDirty = false;
    saveBtn.style.display = 'none';
    if(statusEl){ statusEl.textContent = 'Saved'; statusEl.className = 'setup-status ok'; setTimeout(()=>{ if(statusEl.textContent==='Saved') statusEl.textContent=''; }, 2500); }
    renderMarks();
  } catch(e){
    if(statusEl){ statusEl.textContent = 'Save failed: ' + (e?.message || e); statusEl.className = 'setup-status err'; }
  } finally {
    saveBtn.disabled = false; saveBtn.textContent = 'Save';
  }
});

document.getElementById('setup-toggle-btn').addEventListener('click', () => {
  setupOpen = !setupOpen;
  document.getElementById('marks-setup-body').style.display = setupOpen ? 'block' : 'none';
  document.getElementById('setup-toggle-btn').textContent = setupOpen ? 'Hide' : 'Show';
});

// ── MARKS ENTRY ──────────────────────────────────────────────
function renderMarks(){
  const tabsEl = document.getElementById('exam-tabs');
  const panelsEl = document.getElementById('exam-panels');
  const entryWrap = document.getElementById('marks-entry-wrap');
  document.getElementById('results-section').style.display = 'none';

  if(!userExams.some(e => e.subjects.length > 0)){ entryWrap.style.display = 'none'; return; }
  entryWrap.style.display = 'block';
  if(activeExamIdx >= userExams.length) activeExamIdx = 0;

  tabsEl.innerHTML = '';
  panelsEl.innerHTML = '';

  userExams.forEach((exam, ei) => {
    if(!exam.subjects.length) return;
    const btn = document.createElement('button');
    btn.className = 'etab' + (ei === activeExamIdx ? ' active' : '');
    btn.dataset.ei = ei;
    btn.innerHTML = `${exam.label||'Untitled'}<span class="etab-sub">${exam.subjects.length} subject${exam.subjects.length!==1?'s':''}</span>`;
    btn.addEventListener('click', () => {
      activeExamIdx = ei;
      document.querySelectorAll('.etab').forEach(t=>t.classList.remove('active'));
      document.querySelectorAll('.epanel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`epanel-${ei}`)?.classList.add('active');
    });
    tabsEl.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'epanel' + (ei === activeExamIdx ? ' active' : '');
    panel.id = `epanel-${ei}`;
    const grid = document.createElement('div');
    grid.className = 'subjects-grid';

    exam.subjects.forEach(s => {
      const mv = userMarks[exam.id]?.[s.id];
      const row = document.createElement('div'); row.className = 'subject-row';
      const icon = document.createElement('div'); icon.className = 's-icon';
      icon.textContent = (s.name.trim()||'?').substring(0,2);
      const sname = document.createElement('div'); sname.className = 's-name';
      sname.textContent = s.name || 'Unnamed';
      const inp = document.createElement('input');
      inp.className = 'mark-input'; inp.id = `inp-${exam.id}-${s.id}`;
      inp.type = 'number'; inp.min = '0'; inp.max = s.max;
      inp.placeholder = '—'; inp.autocomplete = 'off';
      if(mv !== null && mv !== undefined) inp.value = mv;
      const outOf = document.createElement('span'); outOf.className = 'out-of';
      outOf.textContent = `/${s.max}`;
      const badge = document.createElement('span'); badge.className = 'pct-badge';
      badge.id = `badge-${exam.id}-${s.id}`;
      if(mv !== null && mv !== undefined){ badge.textContent=(mv/s.max*100).toFixed(1)+'%'; badge.style.color=pctColor(mv/s.max*100); }
      else badge.textContent = '—';
      inp.addEventListener('input', () => {
        let v = parseFloat(inp.value);
        if(!isNaN(v)&&v>s.max){ v=s.max; inp.value=s.max; }
        if(!userMarks[exam.id]) userMarks[exam.id]={};
        userMarks[exam.id][s.id] = isNaN(v)?null:v;
        if(!isNaN(v)&&v>=0){ badge.textContent=(v/s.max*100).toFixed(1)+'%'; badge.style.color=pctColor(v/s.max*100); inp.classList.remove('error'); }
        else{ badge.textContent='—'; badge.style.color=''; }
      });
      row.append(icon,sname,inp,outOf,badge);
      grid.appendChild(row);
    });
    panel.appendChild(grid); panelsEl.appendChild(panel);
  });
}

function showResults(scored,maxTotal,pct,examCards,barData){
  const g=grade(pct);
  const rs=document.getElementById('results-section'); rs.style.display='block';
  document.getElementById('res-total').textContent=`${scored} / ${maxTotal}`;
  document.getElementById('res-pct').textContent=pct.toFixed(2)+'%';
  const pill=document.getElementById('res-grade'); pill.textContent=g.g; pill.style.background=g.bg; pill.style.color=g.col;
  const sumEl=document.getElementById('exam-summary'); sumEl.innerHTML='';
  examCards.forEach(ec=>{
    const p=(ec.scored/ec.max*100).toFixed(1);
    const card=document.createElement('div'); card.className='escard';
    card.innerHTML=`<div class="escard-label">${ec.label}</div><div class="escard-val">${ec.scored}/${ec.max}</div><div class="escard-pct" style="color:${pctColor(p)}">${p}%</div>`;
    sumEl.appendChild(card);
  });
  const barsEl=document.getElementById('bars'); barsEl.innerHTML='';
  barData.forEach(b=>{
    const row=document.createElement('div'); row.className='bar-row';
    row.innerHTML=`<span class="bar-name">${b.name}</span><div class="bar-track"><div class="bar-fill" id="bf-${b.key}"></div></div><span class="bar-pct">${b.pct}%</span>`;
    barsEl.appendChild(row);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const bf=document.getElementById(`bf-${b.key}`);
      bf.style.width=b.pct+'%'; bf.style.background=`linear-gradient(90deg,${pctColor(b.pct)},${pctColor(b.pct)}99)`;
    }));
  });
  rs.scrollIntoView({behavior:'smooth',block:'nearest'});
}

document.getElementById('calc-btn-single').addEventListener('click',()=>{
  document.getElementById('err-msg').textContent='';
  const exam = userExams[activeExamIdx]; if(!exam) return;
  let valid = true;
  const vals = exam.subjects.map(s=>{
    const inp = document.getElementById(`inp-${exam.id}-${s.id}`); if(!inp){valid=false;return null;}
    const v=inp.value.trim(); const n=parseFloat(v);
    if(v===''||isNaN(n)||n<0||n>s.max){inp.classList.add('error');valid=false;return null;}
    inp.classList.remove('error'); return {val:n,max:s.max,name:s.name,key:s.id};
  });
  if(!valid){document.getElementById('err-msg').textContent=`Fill in all marks for ${exam.label||'this exam'}.`;return;}
  saveMarksToFirestore();
  const scored=vals.reduce((a,b)=>a+b.val,0), maxTotal=vals.reduce((a,b)=>a+b.max,0);
  showResults(scored,maxTotal,scored/maxTotal*100,[{label:exam.label||'Exam',scored,max:maxTotal}],vals.map(v=>({name:v.name,key:v.key,pct:(v.val/v.max*100).toFixed(1)})));
});

document.getElementById('calc-btn-all').addEventListener('click',()=>{
  document.getElementById('err-msg').textContent=''; let allValid=true;
  const examTotals=[]; const subjSums={};
  userExams.forEach(exam=>{
    if(!exam.subjects.length) return;
    let scored=0,max=0;
    exam.subjects.forEach(s=>{
      const inp=document.getElementById(`inp-${exam.id}-${s.id}`); if(!inp){allValid=false;return;}
      const v=inp.value.trim(); const n=parseFloat(v);
      if(v===''||isNaN(n)||n<0||n>s.max){inp.classList.add('error');allValid=false;return;}
      inp.classList.remove('error'); scored+=n; max+=s.max;
      if(!subjSums[s.name]) subjSums[s.name]={scored:0,max:0};
      subjSums[s.name].scored+=n; subjSums[s.name].max+=s.max;
    });
    if(max>0) examTotals.push({label:exam.label||'Exam',scored,max});
  });
  if(!allValid){document.getElementById('err-msg').textContent='Fill in all marks correctly across every exam.';return;}
  if(!examTotals.length) return;
  saveMarksToFirestore();
  const grandScored=examTotals.reduce((a,e)=>a+e.scored,0), grandMax=examTotals.reduce((a,e)=>a+e.max,0);
  const barData=Object.entries(subjSums).map(([name,d],i)=>({name,key:'s'+i,pct:(d.scored/d.max*100).toFixed(1)}));
  showResults(grandScored,grandMax,grandScored/grandMax*100,examTotals,barData);
});

// ── PROGRESS ────────────────────────────────────────────────
const SUBJ_COLORS=['#00e5ff','#3de8a0','#f7c948','#f76ab4','#4fa8f7'];

function renderProgress(){
  const examData = userExams
    .filter(e=>e.subjects.length>0)
    .map(e=>{
      const vals=e.subjects.map(s=>{ const v=userMarks[e.id]?.[s.id]; return (v!==null&&v!==undefined)?v:null; });
      return {label:e.label||'Untitled',exam:e,vals,hasData:vals.some(v=>v!==null)};
    })
    .filter(e=>e.hasData);

  if(!examData.length){
    document.getElementById('prog-empty').style.display='block';
    document.getElementById('prog-content').style.display='none';
    return;
  }
  document.getElementById('prog-empty').style.display='none';
  document.getElementById('prog-content').style.display='block';

  const labels=examData.map(e=>e.label);
  const overallPcts=examData.map(e=>{
    const pairs=e.exam.subjects.map((s,i)=>({max:s.max,val:e.vals[i]})).filter(p=>p.val!==null);
    if(!pairs.length) return 0;
    return parseFloat((pairs.reduce((a,p)=>a+p.val,0)/pairs.reduce((a,p)=>a+p.max,0)*100).toFixed(1));
  });

  const allSubjNames=[...new Set(examData.flatMap(e=>e.exam.subjects.map(s=>s.name)))].slice(0,5);
  const subjPcts=allSubjNames.map(name=>
    examData.map(e=>{
      const si=e.exam.subjects.findIndex(s=>s.name===name);
      if(si===-1||e.vals[si]===null) return null;
      return parseFloat((e.vals[si]/e.exam.subjects[si].max*100).toFixed(1));
    })
  );

  const legendEl=document.getElementById('subj-legend'); legendEl.innerHTML='';
  allSubjNames.forEach((name,i)=>{
    const li=document.createElement('div'); li.className='legend-item';
    li.innerHTML=`<div class="legend-dot" style="background:${SUBJ_COLORS[i%SUBJ_COLORS.length]}"></div>${name}`;
    legendEl.appendChild(li);
  });

  drawOverallChart(labels,overallPcts); drawSubjChart(labels,subjPcts); drawChips(examData,overallPcts);
}

function drawOverallChart(labels,data){
  const canvas=document.getElementById('chart-overall');
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||600,H=canvas.offsetHeight||200;
  canvas.width=W; canvas.height=H; ctx.clearRect(0,0,W,H);
  const pad={top:20,right:24,bottom:36,left:46};
  const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;

  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  [0,25,50,75,100].forEach(v=>{
    const y=pad.top+ch-(v/100)*ch;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+cw,y); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.2)'; ctx.font='10px DM Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(v+'%',pad.left-8,y+4);
  });

  if(data.length===1){
    const x=pad.left+cw/2, y=pad.top+ch-(data[0]/100)*ch;
    ctx.beginPath(); ctx.arc(x,y,7,0,Math.PI*2); ctx.fillStyle='#00e5ff'; ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='11px DM Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(data[0]+'%',x,y-14); ctx.fillText(labels[0],x,pad.top+ch+22);
    return;
  }

  const step=cw/(data.length-1);
  const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+ch);
  grad.addColorStop(0,'rgba(0,229,255,0.3)'); grad.addColorStop(1,'rgba(0,229,255,0)');
  ctx.beginPath();
  data.forEach((v,i)=>{ const x=pad.left+i*step,y=pad.top+ch-(v/100)*ch; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.lineTo(pad.left+(data.length-1)*step,pad.top+ch); ctx.lineTo(pad.left,pad.top+ch); ctx.closePath();
  ctx.fillStyle=grad; ctx.fill();

  ctx.beginPath(); ctx.strokeStyle='#00e5ff'; ctx.lineWidth=2.5; ctx.lineJoin='round';
  data.forEach((v,i)=>{ const x=pad.left+i*step,y=pad.top+ch-(v/100)*ch; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
  ctx.stroke();

  data.forEach((v,i)=>{
    const x=pad.left+i*step,y=pad.top+ch-(v/100)*ch;
    ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle='#00e5ff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.75)'; ctx.font='bold 11px DM Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(v+'%',x,y-13);
    ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='11px DM Mono,monospace'; ctx.fillText(labels[i],x,pad.top+ch+22);
  });
}

function drawSubjChart(labels,subjPcts){
  const canvas=document.getElementById('chart-subjects');
  const ctx=canvas.getContext('2d');
  const W=canvas.offsetWidth||600,H=canvas.offsetHeight||220;
  canvas.width=W; canvas.height=H; ctx.clearRect(0,0,W,H);
  const pad={top:20,right:24,bottom:36,left:46};
  const cw=W-pad.left-pad.right, ch=H-pad.top-pad.bottom;
  const n=labels.length, step=n>1?cw/(n-1):cw/2;

  ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
  [0,25,50,75,100].forEach(v=>{
    const y=pad.top+ch-(v/100)*ch;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+cw,y); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.2)'; ctx.font='10px DM Mono,monospace'; ctx.textAlign='right';
    ctx.fillText(v+'%',pad.left-8,y+4);
  });

  subjPcts.forEach((pts,si)=>{
    const color=SUBJ_COLORS[si%SUBJ_COLORS.length];
    const vp=pts.map((v,i)=>v!==null?{x:pad.left+(n>1?i*step:cw/2),y:pad.top+ch-(v/100)*ch}:null).filter(Boolean);
    if(!vp.length)return;
    if(vp.length===1){ ctx.beginPath(); ctx.arc(vp[0].x,vp[0].y,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); return; }
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round';
    vp.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();
    vp.forEach(p=>{ ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); });
  });

  labels.forEach((l,i)=>{
    const x=pad.left+(n>1?i*step:cw/2);
    ctx.fillStyle='rgba(255,255,255,.3)'; ctx.font='11px DM Mono,monospace'; ctx.textAlign='center';
    ctx.fillText(l,x,pad.top+ch+22);
  });
}

function drawChips(filledExams,overallPcts){
  const chips=document.getElementById('prog-chips'); chips.innerHTML='';
  if(overallPcts.length<2){
    const chip=document.createElement('div'); chip.className='prog-chip';
    chip.innerHTML=`<strong>${overallPcts[0]}%</strong>${filledExams[0].label} average`;
    chips.appendChild(chip); return;
  }
  const best=overallPcts.indexOf(Math.max(...overallPcts));
  const worst=overallPcts.indexOf(Math.min(...overallPcts));
  const trend=overallPcts[overallPcts.length-1]-overallPcts[0];
  [
    {html:`<strong style="color:${trend>=0?'var(--green)':'var(--red)'}"> ${trend>=0?'↑':'↓'} ${Math.abs(trend).toFixed(1)}%</strong>Overall trend`},
    {html:`<strong style="color:var(--green)">${overallPcts[best]}%</strong>Best: ${filledExams[best].label}`},
    {html:`<strong style="color:#fb923c">${overallPcts[worst]}%</strong>Lowest: ${filledExams[worst].label}`}
  ].forEach(c=>{
    const el=document.createElement('div'); el.className='prog-chip'; el.innerHTML=c.html; chips.appendChild(el);
  });
}

// ── FIREBASE ────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, deleteDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPyHj2MMziyOI-FVdr2yUZfMomYbSs1_s",
  authDomain: "neurolythlabs.firebaseapp.com",
  projectId: "neurolythlabs",
  storageBucket: "neurolythlabs.firebasestorage.app",
  messagingSenderId: "759272141118",
  appId: "1:759272141118:web:691a6fab3e951522bdbc6f"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser = null;

// ── AUTH TABS ───────────────────────────────────────────────
function switchAuthTab(tab){
  document.getElementById('tab-login').classList.toggle('active', tab==='login');
  document.getElementById('tab-signup').classList.toggle('active', tab==='signup');
  document.getElementById('auth-login').style.display  = tab==='login'  ? 'block' : 'none';
  document.getElementById('auth-signup').style.display = tab==='signup' ? 'block' : 'none';
  document.getElementById('login-err').textContent  = '';
  document.getElementById('signup-err').textContent = '';
}

// ── SIGN UP ─────────────────────────────────────────────────
async function doSignup(){
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pass  = document.getElementById('signup-pass').value;
  const pass2 = document.getElementById('signup-pass2').value;
  const errEl = document.getElementById('signup-err');
  errEl.textContent = '';
  if(!name||!email||!pass||!pass2){ errEl.textContent='Please fill in all fields.'; return; }
  if(pass.length < 6){ errEl.textContent='Password must be at least 6 characters.'; return; }
  if(pass !== pass2){ errEl.textContent='Passwords do not match.'; return; }
  const btn = document.querySelector('#auth-signup .auth-btn');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    // Save display name to Firestore
    await setDoc(doc(db, 'users', cred.user.uid), { name, email });
  } catch(e) {
    errEl.textContent = firebaseErrMsg(e.code);
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
}

// ── SIGN IN ─────────────────────────────────────────────────
async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err');
  errEl.textContent = '';
  if(!email||!pass){ errEl.textContent='Please fill in all fields.'; return; }
  const btn = document.querySelector('#auth-login .auth-btn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    errEl.textContent = firebaseErrMsg(e.code);
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

// ── SIGN OUT ────────────────────────────────────────────────
async function doLogout(){
  await signOut(auth);
  location.reload();
}

// ── AUTH STATE LISTENER ─────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const name = user.displayName || user.email.split('@')[0];
    enterApp(name);
    loadUserData()
      .then(() => loadExamConfig())
      .then(() => loadMarksFromFirestore())
      .catch(e => { console.log('User data load failed:', e); });
  } else {
    currentUser = null;
    document.body.classList.remove('auth-loading');
    document.body.classList.add('auth-ready');
    document.getElementById('screen-landing').style.display = 'block';
    document.getElementById('screen-auth').style.display = 'none';
    document.getElementById('screen-app').style.display  = 'none';
    document.getElementById('screen-app').classList.remove('show');
    initLandingScroll();
  }
});

// ── ENTER APP ───────────────────────────────────────────────
function enterApp(name){
  document.getElementById('screen-landing').style.display = 'none';
  const authEl = document.getElementById('screen-auth');
  authEl.style.transition = 'opacity 0.35s ease';
  authEl.style.opacity = '0';
  setTimeout(() => {
    authEl.style.display = 'none';
    const app = document.getElementById('screen-app');
    app.style.display = 'block';
    document.body.classList.remove('auth-loading');
    document.body.classList.add('auth-ready');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      app.classList.add('show');
      const greetEl  = document.getElementById('greeting-tw');
      const greetCur = document.getElementById('greeting-cursor');
      greetEl.textContent = '';
      greetCur.style.display = 'inline-block';
      let j = 0;
      const iv = setInterval(() => {
        greetEl.textContent += name[j];
        if (++j >= name.length) { clearInterval(iv); setTimeout(() => { greetCur.style.display = 'none'; }, 1200); }
      }, 60);
    }));
  }, 360);
}

// ── FIRESTORE: TASKS ────────────────────────────────────────
async function saveTaskToFirestore(task){
  if(!currentUser) return;
  await setDoc(doc(db, 'users', currentUser.uid, 'tasks', String(task.id)), task);
}

async function deleteTaskFromFirestore(id){
  if(!currentUser) return;
  await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', String(id)));
}

async function loadUserData(){
  if(!currentUser) return;
  tasks = [];
  const tl = document.getElementById('task-list');
  if(tl) tl.innerHTML = '<div class="tasks-loading">Syncing tasks…</div>';
  try {
    const snap = await getDocs(collection(db, 'users', currentUser.uid, 'tasks'));
    const remoteTasks = [];
    snap.forEach(d => remoteTasks.push(d.data()));
    remoteTasks.sort((a,b) => a.id - b.id);
    tasks = remoteTasks;
  } catch(e) {
    console.log('Could not load tasks from Firestore:', e);
  }
  renderTasks();
  updateTodoStats();
}

// ── FIRESTORE: MARKS ────────────────────────────────────────
async function saveExamConfig(){
  if(!currentUser) throw new Error('Not signed in');
  await setDoc(doc(db,'users',currentUser.uid,'data','examConfig'),{exams:userExams});
}

async function loadExamConfig(){
  if(!currentUser) return;
  try {
    const snap = await getDoc(doc(db,'users',currentUser.uid,'data','examConfig'));
    if(snap.exists()) userExams = snap.data().exams || [];
  } catch(e){ console.log('No exam config:',e); }
}

async function saveMarksToFirestore(){
  if(!currentUser) return;
  try { await setDoc(doc(db,'users',currentUser.uid,'data','marks'),{marks:userMarks}); }
  catch(e){ console.log('Failed to save marks:',e); }
}

async function loadMarksFromFirestore(){
  if(!currentUser) return;
  try {
    const snap = await getDoc(doc(db,'users',currentUser.uid,'data','marks'));
    if(snap.exists()) userMarks = snap.data().marks || {};
  } catch(e){ console.log('No marks yet:',e); }
  renderSetup();
  renderMarks();
}

// ── FIREBASE ERROR MESSAGES ─────────────────────────────────
function firebaseErrMsg(code){
  const map = {
    'auth/email-already-in-use':   'An account with this email already exists.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/wrong-password':         'Incorrect password.',
    'auth/invalid-credential':     'Incorrect email or password.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/unauthorized-domain':    'This site is not authorized for sign-in. Add this domain in Firebase → Authentication → Settings → Authorized domains.',
    'auth/popup-blocked':          'Sign-in popup was blocked. Allow popups for this site and try again.',
    'auth/popup-closed-by-user':   'Sign-in was cancelled.',
    'auth/operation-not-allowed':  'Google sign-in is not enabled. Enable it in Firebase → Authentication → Sign-in method.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

// ── GOOGLE SIGN IN ───────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();

async function doGoogleSignIn(){
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    // Save to Firestore if new user
    const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
    if(!userDoc.exists()){
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: cred.user.displayName || cred.user.email.split('@')[0],
        email: cred.user.email
      });
    }
  } catch(e) {
    const errEl = document.getElementById('login-err');
    if(e.code !== 'auth/popup-closed-by-user'){
      errEl.textContent = firebaseErrMsg(e.code);
    }
  }
}

// ── WIRE UP ALL BUTTONS ──────────────────────────────────────
document.getElementById('tab-login').addEventListener('click', ()=>switchAuthTab('login'));
document.getElementById('tab-signup').addEventListener('click', ()=>switchAuthTab('signup'));
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('signup-btn').addEventListener('click', doSignup);
document.getElementById('logout-btn').addEventListener('click', doLogout);
document.getElementById('google-login-btn').addEventListener('click', doGoogleSignIn);
document.getElementById('google-signup-btn').addEventListener('click', doGoogleSignIn);
document.getElementById('gen-quiz-btn').addEventListener('click', generateQuiz);
document.getElementById('ai-send-btn').addEventListener('click', sendAiMessage);

document.getElementById('login-pass').addEventListener('keydown',  e=>{ if(e.key==='Enter') doLogin(); });
document.getElementById('login-email').addEventListener('keydown', e=>{ if(e.key==='Enter') document.getElementById('login-pass').focus(); });
document.getElementById('signup-pass2').addEventListener('keydown',e=>{ if(e.key==='Enter') doSignup(); });

// quiz inline onclick handlers (rendered dynamically, keep on window)
window.answerQuiz=answerQuiz;
window.quizNav=quizNav;
window.finishQuiz=finishQuiz;
window.retryQuiz=retryQuiz;
window.newQuiz=newQuiz;
window.clearQuizFile=clearQuizFile;

function clearQuizFile(){ quizFile=null; document.getElementById('quiz-file-preview').style.display='none'; document.getElementById('quiz-file-preview').innerHTML=''; qFile.value=''; }

// ── HELPERS ─────────────────────────────────────────────────
function pctColor(p){ if(p>=90)return'#3de8a0';if(p>=75)return'#00e5ff';if(p>=60)return'#f7c948';if(p>=35)return'#fb923c';return'#f75a5a'; }
function grade(p){ if(p>=90)return{g:'A+',bg:'rgba(61,232,160,0.15)',col:'#3de8a0'};if(p>=75)return{g:'A',bg:'rgba(0,229,255,0.18)',col:'#7dd8f0'};if(p>=60)return{g:'B',bg:'rgba(247,201,72,0.12)',col:'#f7c948'};if(p>=50)return{g:'C',bg:'rgba(251,146,60,0.12)',col:'#fb923c'};if(p>=35)return{g:'D',bg:'rgba(247,90,90,0.12)',col:'#f87171'};return{g:'F',bg:'rgba(239,68,68,0.18)',col:'#ef4444'}; }

// Lazy-load PDF.js only when a PDF is actually uploaded.
let _pdfjs = null;
async function getPdfjs(){
  if(!_pdfjs){
    _pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.min.mjs');
    _pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/build/pdf.worker.min.mjs';
  }
  return _pdfjs;
}

// Extract selectable text from a PDF in the browser (text-based PDFs only).
async function readPdfText(file){
  const pdfjsLib = await getPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, 30);
  let text = '';
  for(let p=1; p<=maxPages; p++){
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.trim();
}

// Cloudflare Worker that proxies Gemini (keeps the API key secret).
// Deploy cloudflare/worker.js, then paste its URL here to enable the AI.
const GEMINI_PROXY_URL = 'https://neurolyth-ai.lighningcraftpro.workers.dev';
const AI_ENABLED = !!GEMINI_PROXY_URL;

// Show the real AI/Quiz UI when the proxy is configured; otherwise the
// "offline" notices stay and the chat/builder stay hidden.
function applyAiAvailability(){
  document.querySelectorAll('#panel-ai .feature-offline, #panel-quiz .feature-offline')
    .forEach(el => { el.style.display = AI_ENABLED ? 'none' : ''; });
  const chat = document.querySelector('#panel-ai .ai-chat-wrap');
  if(chat) chat.style.display = AI_ENABLED ? 'flex' : 'none';
  const builder = document.querySelector('#panel-quiz .quiz-builder');
  if(builder) builder.style.display = AI_ENABLED ? 'block' : 'none';
}
applyAiAvailability();

async function geminiGenerate(prompt, file, systemText=''){
  if(!AI_ENABLED){
    throw new Error('AI features are temporarily offline while we reconnect the service.');
  }
  let fullPrompt = prompt;
  if(file){
    const ext = file.name.split('.').pop().toLowerCase();
    let fileText = '';
    if(ext === 'pdf'){
      fileText = await readPdfText(file);
      if(!fileText){
        throw new Error('Could not read any text from this PDF — it looks like scanned images. Try a text-based PDF, or paste the text instead.');
      }
    } else if(['txt','doc','docx'].includes(ext)){
      fileText = await readText(file);
    } else if(['jpg','jpeg','png'].includes(ext)){
      throw new Error('Image files need a vision AI, which the current free model can\'t read. Please upload a PDF/TXT or paste the text instead.');
    }
    if(fileText){
      fullPrompt = `Use ONLY the following content from "${file.name}" to answer.\n"""\n${fileText.substring(0,16000)}\n"""\n\n${prompt}`;
    }
  }

  const payload = {
    contents: [{ parts: [{ text: fullPrompt }] }],
  };
  if (systemText) {
    payload.systemInstruction = { parts: [{ text: systemText }] };
  }

  const res = await fetch(GEMINI_PROXY_URL,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : { error: { message: `Empty response from the AI proxy (HTTP ${res.status}).` } };
  } catch {
    data = { error: { message: raw || `AI proxy returned HTTP ${res.status}.` } };
  }
  if (!res.ok && data?.error && data.error.status == null) {
    data.error.status = res.status;
  }
  if(data.error) throw new Error(data.error.message || 'Gemini request failed.');
  const text = data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')?.trim();
  if(!text) throw new Error('Empty response from Gemini.');
  return text;
}

// ── QUIZ ────────────────────────────────────────────────────
let quizData = null, quizQ = 0, quizAnswers = {}, quizAnswered = {};
let quizFile = null;

// File drop
const qDrop = document.getElementById('quiz-drop');
const qFile = document.getElementById('quiz-file');
qDrop.addEventListener('dragover', e=>{ e.preventDefault(); qDrop.classList.add('drag-over'); });
qDrop.addEventListener('dragleave', ()=>qDrop.classList.remove('drag-over'));
qDrop.addEventListener('drop', e=>{ e.preventDefault(); qDrop.classList.remove('drag-over'); if(e.dataTransfer.files[0]) handleQuizFile(e.dataTransfer.files[0]); });
qFile.addEventListener('change', e=>{ if(e.target.files[0]) handleQuizFile(e.target.files[0]); });

function handleQuizFile(file){
  const allowed=['pdf','txt','doc','docx'];
  const ext=file.name.split('.').pop().toLowerCase();
  if(!allowed.includes(ext)) return;
  quizFile=file;
  const prev=document.getElementById('quiz-file-preview');
  prev.style.display='flex';
  prev.innerHTML=`<span class="fc-ext">${ext.toUpperCase()}</span><span class="fc-name">${file.name}</span><button class="fc-remove" onclick="clearQuizFile()">×</button>`;
}

async function generateQuiz(){
  const text = document.getElementById('quiz-text').value.trim();
  if(!text && !quizFile){ alert('Please enter a topic, paste text, or upload a file.'); return; }

  const numQ = document.getElementById('quiz-num').value;
  const diff = document.getElementById('quiz-diff').value;
  const btn  = document.getElementById('gen-quiz-btn');
  btn.disabled=true;

  document.getElementById('quiz-loading').style.display='block';
  document.getElementById('quiz-play').style.display='none';
  document.getElementById('quiz-score').style.display='none';

  const prompt = `You are a quiz generator. Create exactly ${numQ} multiple-choice questions at ${diff} difficulty.
Base EVERY question strictly on the provided topic/content above. Do not invent unrelated questions.
Respond ONLY with valid JSON, no markdown, no extra text.
Format:
{"title":"Short quiz title","questions":[{"question":"Question text","options":["A","B","C","D"],"correct":0,"explanation":"Why this answer is correct"}]}
Rules: "correct" is 0-based index. Exactly 4 options per question. Make questions test genuine understanding.
For any math, write it in LaTeX inside $...$ (e.g. $x^2$, $\\\\frac{1}{2}$). Since this is JSON, escape every backslash as \\\\ (so a fraction becomes \\\\frac).`;

  try {
    const raw = await geminiGenerate(
      `Topic/Content:\n${text}\n\n${prompt}`,
      quizFile,
      'You are a quiz generator. Return only valid JSON. No markdown.'
    );
    quizData=parseQuizJson(raw);
    if(!quizData.questions?.length) throw new Error('No questions generated.');
    quizQ=0; quizAnswers={}; quizAnswered={};
    document.getElementById('quiz-loading').style.display='none';
    document.getElementById('quiz-play').style.display='block';
    renderQuizQuestion();
  } catch(e){
    document.getElementById('quiz-loading').style.display='none';
    alert('Error: '+e.message);
  }
  btn.disabled=false;
}

// Parse the quiz JSON, repairing lone LaTeX backslashes that break JSON.
function parseQuizJson(raw){
  const cleaned = raw.replace(/```json|```/g,'').trim();
  try { return JSON.parse(cleaned); }
  catch {
    const repaired = cleaned.replace(/\\(?!["\\/bfnru])/g, '\\\\');
    return JSON.parse(repaired);
  }
}

function renderQuizQuestion(){
  const q=quizData.questions[quizQ];
  const total=quizData.questions.length;
  const letters=['A','B','C','D'];
  const isAns=quizAnswered[quizQ]!==undefined;
  const pct=((quizQ+1)/total*100).toFixed(0);

  const opts=q.options.map((o,i)=>{
    let cls='q-opt';
    if(isAns){
      if(i===q.correct) cls += ' reveal';
      if(i===quizAnswered[quizQ] && i!==q.correct) cls+=' wrong';
      if(i===quizAnswered[quizQ] && i===q.correct) cls+=' correct';
    }
    return `<button class="${cls}" ${isAns?'disabled':''} onclick="answerQuiz(${i})">
      <span class="q-letter">${letters[i]}</span>${o}
    </button>`;
  }).join('');

  document.getElementById('quiz-play').innerHTML=`
    <div class="quiz-play-wrap">
      <div class="quiz-play-header">
        <div class="quiz-play-title">${quizData.title}</div>
        <div class="quiz-play-meta">${quizQ+1} / ${total}</div>
      </div>
      <div class="qprogress"><div class="qprogress-fill" style="width:${pct}%"></div></div>
      <div class="q-card">
        <div class="q-num">Question ${quizQ+1}</div>
        <div class="q-text">${q.question}</div>
        <div class="q-options">${opts}</div>
        ${isAns?`<div class="q-explanation">💡 ${q.explanation}</div>`:''}
      </div>
      <div class="q-nav">
        <button class="q-nav-btn" onclick="quizNav(-1)" ${quizQ===0?'disabled':''}>← Prev</button>
        <span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--muted)">${Object.keys(quizAnswered).length}/${total} answered</span>
        ${quizQ<total-1
          ?`<button class="q-nav-btn" onclick="quizNav(1)">Next →</button>`
          :`<button class="q-nav-btn finish" onclick="finishQuiz()">Finish Quiz</button>`}
      </div>
    </div>`;
  renderMath(document.getElementById('quiz-play'));
}

function answerQuiz(i){
  if(quizAnswered[quizQ]!==undefined) return;
  quizAnswered[quizQ]=i; quizAnswers[quizQ]=i;
  renderQuizQuestion();
}
window.answerQuiz=answerQuiz;

function quizNav(d){ quizQ=Math.max(0,Math.min(quizData.questions.length-1,quizQ+d)); renderQuizQuestion(); }
window.quizNav=quizNav;

function finishQuiz(){
  const total=quizData.questions.length;
  const correct=quizData.questions.filter((q,i)=>quizAnswers[i]===q.correct).length;
  const pct=Math.round(correct/total*100);
  const cls=pct>=80?'great':pct>=50?'ok':'poor';
  const desc=pct>=80?'Excellent work!':pct>=50?'Good effort!':'Keep studying!';
  document.getElementById('quiz-play').style.display='none';
  document.getElementById('quiz-score').style.display='block';
  document.getElementById('quiz-score').innerHTML=`
    <div class="score-wrap">
      <div class="score-label">Your Score</div>
      <div class="score-big ${cls}">${pct}%</div>
      <div class="score-desc">${desc}</div>
      <div class="score-sub">${correct} correct out of ${total} questions</div>
      <div class="score-actions">
        <button class="score-btn primary" onclick="retryQuiz()">Try Again</button>
        <button class="score-btn secondary" onclick="newQuiz()">New Quiz</button>
      </div>
    </div>`;
}
window.finishQuiz=finishQuiz;

function retryQuiz(){ quizQ=0;quizAnswers={};quizAnswered={};document.getElementById('quiz-score').style.display='none';document.getElementById('quiz-play').style.display='block';renderQuizQuestion(); }
function newQuiz(){ quizData=null;quizQ=0;quizAnswers={};quizAnswered={};document.getElementById('quiz-score').style.display='none';document.getElementById('quiz-play').style.display='none'; }
window.retryQuiz=retryQuiz; window.newQuiz=newQuiz;

function toB64(file){ return new Promise((r,j)=>{ const rd=new FileReader(); rd.onload=()=>r(rd.result.split(',')[1]); rd.onerror=()=>j(new Error('Read error')); rd.readAsDataURL(file); }); }
function readText(file){ return new Promise((r,j)=>{ const rd=new FileReader(); rd.onload=()=>r(rd.result); rd.onerror=()=>j(new Error('Read error')); rd.readAsText(file); }); }

// ── AI CHAT ──────────────────────────────────────────────────
let aiHistory=[];

const aiInput=document.getElementById('ai-input');
aiInput.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendAiMessage(); } });
aiInput.addEventListener('input',()=>{ aiInput.style.height='auto'; aiInput.style.height=Math.min(aiInput.scrollHeight,120)+'px'; });

async function sendAiMessage(){
  const msg=aiInput.value.trim();
  if(!msg) return;

  appendMsg('user',msg);
  aiHistory.push({role:'user',content:msg});
  aiInput.value=''; aiInput.style.height='auto';

  const typingEl=appendMsg('assistant','',true);
  document.getElementById('ai-send-btn').disabled=true;

  try {
    const reply = await geminiGenerate(
      aiHistory.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n'),
      null,
      'You are a helpful, friendly student study assistant called Neurolyth AI. Be concise and clear. Use simple language. You help with school subjects, homework, and studying. For ANY math or science notation (equations, fractions, powers, symbols), write it in LaTeX: inline math wrapped in $...$ and standalone equations in $$...$$. For example: $x^2 + 3x = 0$ or $$\\frac{a}{b}$$.'
    );
    typingEl.classList.remove('typing');
    aiHistory.push({role:'assistant',content:reply});
    await typeWriter(typingEl.querySelector('.ai-bubble'), reply);
  } catch(e){
    typingEl.classList.remove('typing');
    typingEl.querySelector('.ai-bubble').textContent='Error: '+e.message;
  }
  document.getElementById('ai-send-btn').disabled=false;
  scrollChat();
}

function appendMsg(role,text,typing=false){
  const wrap=document.getElementById('ai-messages');
  const div=document.createElement('div');
  div.className=`ai-msg ${role}${typing?' typing':''}`;
  const bubble=document.createElement('div');
  bubble.className='ai-bubble';
  if(typing){
    bubble.innerHTML='<span class="ai-typing"><span></span><span></span><span></span></span>';
  } else {
    bubble.textContent=text;
  }
  div.appendChild(bubble);
  wrap.appendChild(div);
  scrollChat();
  return div;
}

// Reveal text character-by-character, then swap in light markdown formatting.
function typeWriter(bubble, text){
  return new Promise(resolve => {
    bubble.classList.add('typing-caret');
    bubble.textContent='';
    const total=text.length;
    const perTick=Math.max(1, Math.round(total/180)); // long replies stay snappy
    let i=0;
    (function tick(){
      i=Math.min(total, i+perTick);
      bubble.textContent=text.slice(0,i);
      scrollChat();
      if(i<total){ setTimeout(tick, 16); }
      else {
        bubble.classList.remove('typing-caret');
        bubble.innerHTML=formatMarkdown(text);
        bubble.classList.add('formatted');
        renderMath(bubble);
        scrollChat();
        resolve();
      }
    })();
  });
}

// Render LaTeX math ($...$, $$...$$, \(...\), \[...\]) inside an element.
function renderMath(el){
  if(!el || !window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, {
      delimiters: [
        {left:'$$', right:'$$', display:true},
        {left:'$',  right:'$',  display:false},
        {left:'\\[', right:'\\]', display:true},
        {left:'\\(', right:'\\)', display:false},
      ],
      throwOnError: false,
    });
  } catch {}
}

// Minimal, safe markdown that also protects LaTeX math from being mangled.
function formatMarkdown(text){
  // 1) stash math spans so markdown/escaping don't touch them
  const math=[];
  const stashed = text.replace(/\$\$[\s\S]*?\$\$|\$[^\n$]*?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g,
    m => { math.push(m); return `${math.length-1}`; });
  const escHtml = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const esc = escHtml(stashed);
  const inline = s => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const lines = esc.split('\n');
  let out='', inUl=false, inOl=false;
  const closeLists = () => { if(inUl){out+='</ul>';inUl=false;} if(inOl){out+='</ol>';inOl=false;} };
  for(const line of lines){
    const ul=line.match(/^\s*[-*]\s+(.*)/);
    const ol=line.match(/^\s*\d+\.\s+(.*)/);
    if(ul){ if(inOl){out+='</ol>';inOl=false;} if(!inUl){out+='<ul>';inUl=true;} out+=`<li>${inline(ul[1])}</li>`; }
    else if(ol){ if(inUl){out+='</ul>';inUl=false;} if(!inOl){out+='<ol>';inOl=true;} out+=`<li>${inline(ol[1])}</li>`; }
    else { closeLists(); if(line.trim()) out+=`<p>${inline(line)}</p>`; }
  }
  closeLists();
  if(!out) out = `<p>${inline(esc)}</p>`;
  // 2) restore math spans (HTML-escaped, but left for KaTeX to render)
  return out.replace(/(\d+)/g, (m,i)=>escHtml(math[+i]));
}

function scrollChat(){ const m=document.getElementById('ai-messages'); m.scrollTop=m.scrollHeight; }

