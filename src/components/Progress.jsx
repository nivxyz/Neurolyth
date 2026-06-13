import { useEffect, useRef } from 'react';
import { pctColor, grade } from '../utils/misc';

const CHART_COLORS = ['#7c6aff', '#4fa8f7', '#00e5a0', '#f7c948', '#f06070', '#fb923c'];

export default function Progress({ userExams, userMarks }) {
  const overallCanvasRef = useRef(null);
  const subjectCanvasRef = useRef(null);

  // Compute per-exam overall %
  const examSummaries = userExams.map(exam => {
    const marks = userMarks[exam.id] || {};
    const entered = exam.subjects.filter(s => marks[s.id] !== '' && marks[s.id] !== undefined && !isNaN(parseFloat(marks[s.id])));
    const totalGot = entered.reduce((a, s) => a + parseFloat(marks[s.id]), 0);
    const totalMax = entered.reduce((a, s) => a + s.max, 0);
    const pct = totalMax > 0 ? Math.round((totalGot / totalMax) * 100) : null;
    return { name: exam.name, pct };
  }).filter(e => e.pct !== null);

  // Collect all unique subjects across all exams
  const allSubjects = [];
  userExams.forEach(exam => {
    exam.subjects.forEach(s => {
      if (!allSubjects.find(x => x.name === s.name)) allSubjects.push(s);
    });
  });

  // Per-subject data: array of { exam, pct } per subject
  const subjectData = allSubjects.map(subj => {
    const points = userExams.map(exam => {
      const matchedSubj = exam.subjects.find(s => s.name === subj.name);
      if (!matchedSubj) return null;
      const marks = userMarks[exam.id] || {};
      const raw = marks[matchedSubj.id];
      if (raw === '' || raw === undefined || isNaN(parseFloat(raw))) return null;
      return Math.round((parseFloat(raw) / matchedSubj.max) * 100);
    });
    return { name: subj.name, points };
  }).filter(s => s.points.some(p => p !== null));

  // Draw overall % chart
  useEffect(() => {
    const canvas = overallCanvasRef.current;
    if (!canvas || examSummaries.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.offsetWidth;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 36, left: 44 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const n = examSummaries.length;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(v => {
      const y = pad.top + cH - (v / 100) * cH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `10px DM Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`${v}%`, pad.left - 6, y + 4);
    });

    // Line
    const pts = examSummaries.map((e, i) => ({
      x: pad.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
      y: pad.top + cH - (e.pct / 100) * cH,
    }));

    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, 'rgba(124,106,255,0.28)');
    grad.addColorStop(1, 'rgba(124,106,255,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pad.top + cH);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, pad.top + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#7c6aff';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Dots + labels
    pts.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#7c6aff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(7,9,18,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.font = '11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(examSummaries[i].name.slice(0, 10), p.x, H - 8);
    });
  }, [examSummaries]);

  // Draw per-subject chart
  useEffect(() => {
    const canvas = subjectCanvasRef.current;
    if (!canvas || subjectData.length === 0 || userExams.length < 2) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.parentElement.offsetWidth;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const pad = { top: 20, right: 20, bottom: 36, left: 44 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;
    const n = userExams.length;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    [0, 25, 50, 75, 100].forEach(v => {
      const y = pad.top + cH - (v / 100) * cH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = `10px DM Mono, monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`${v}%`, pad.left - 6, y + 4);
    });

    subjectData.forEach((subj, si) => {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      const pts = subj.points.map((pct, i) => ({
        x: pad.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
        y: pct !== null ? pad.top + cH - (pct / 100) * cH : null,
      })).filter(p => p.y !== null);
      if (pts.length < 1) return;

      ctx.beginPath();
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();

      pts.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(7,9,18,0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    });

    // X-axis labels
    userExams.forEach((exam, i) => {
      const x = pad.left + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '11px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(exam.name.slice(0, 10), x, H - 8);
    });
  }, [subjectData, userExams]);

  if (userExams.length === 0) {
    return (
      <>
        <div className="page-hero">
          <h2><em>Progress</em> Charts</h2>
          <p>Visual tracking of your performance over time.</p>
        </div>
        <div className="prog-empty">
          No exams set up yet. Add exams in the Marks tab to see your progress charts.
        </div>
      </>
    );
  }

  const allPcts = examSummaries.map(e => e.pct).filter(p => p !== null);
  const best = allPcts.length ? Math.max(...allPcts) : null;
  const avg = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : null;

  // Exam countdowns
  const countdowns = userExams
    .filter(e => e.examDate)
    .map(e => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(e.examDate + 'T00:00:00');
      const diff = Math.round((d - today) / (1000 * 60 * 60 * 24));
      return { name: e.name, diff };
    })
    .filter(c => c.diff >= 0)
    .sort((a, b) => a.diff - b.diff);

  return (
    <>
      <div className="page-hero">
        <h2><em>Progress</em> Charts</h2>
        <p>Visual tracking of your performance over time.</p>
      </div>

      {countdowns.length > 0 && (
        <div className="countdown-strip">
          {countdowns.map(c => (
            <div key={c.name} className={`countdown-chip${c.diff <= 7 ? ' urgent' : ''}`}>
              <span className="countdown-name">{c.name}</span>
              <span className="countdown-days">{c.diff === 0 ? 'Today!' : `${c.diff}d`}</span>
            </div>
          ))}
        </div>
      )}

      <div className="prog-chips-row">
        <div className="prog-chip">
          <strong>{userExams.length}</strong> Exams
        </div>
        {best !== null && (
          <div className="prog-chip">
            <strong style={{ color: pctColor(best) }}>{best}%</strong> Best overall
          </div>
        )}
        {avg !== null && (
          <div className="prog-chip">
            <strong style={{ color: pctColor(avg) }}>{avg}%</strong> Average
          </div>
        )}
        {avg !== null && (
          <div className="prog-chip">
            <strong style={{ color: grade(avg).col }}>{grade(avg).g}</strong> Current grade
          </div>
        )}
      </div>

      {examSummaries.length >= 2 ? (
        <div className="chart-card">
          <div className="chart-card-title">Overall % across exams</div>
          <div className="chart-area">
            <canvas ref={overallCanvasRef} />
          </div>
        </div>
      ) : (
        <div className="prog-empty" style={{ marginBottom: 20 }}>
          Enter marks for at least 2 exams to see the overall trend chart.
        </div>
      )}

      {subjectData.length > 0 && userExams.length >= 2 ? (
        <div className="chart-card">
          <div className="chart-card-title">Per-subject progression</div>
          <div className="chart-area">
            <canvas ref={subjectCanvasRef} />
          </div>
          <div className="legend">
            {subjectData.map((s, i) => (
              <div className="legend-item" key={s.name}>
                <div className="legend-dot" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {s.name}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
