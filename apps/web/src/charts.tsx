// Gráficas SVG ligeras (sin dependencias), accesibles con role/aria-label.
const AZUL = '#4f46e5';
const PALETA = ['#4f46e5', '#0ea5e9', '#f59e0b', '#8b5cf6', '#14b8a6', '#ec4899'];
const REJILLA = '#eef1f6', EJE = '#5d6b80', TINTA = '#0f172a', PISTA = '#eef2ff';

interface Dato { k: string; v: number }

export function BarrasVertical({ datos, etiqueta }: { datos: Dato[]; etiqueta: string }) {
  const W = 460, H = 240, padL = 34, padR = 12, padT = 16, padB = 34;
  const max = Math.max(1, ...datos.map((d) => d.v));
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const plotH = H - padT - padB, plotW = W - padL - padR, bw = plotW / datos.length;
  const ticks = [];
  for (let i = 0; i <= niceMax; i += 5) ticks.push(i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etiqueta} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {ticks.map((i) => {
        const y = padT + plotH - (i / niceMax) * plotH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={REJILLA} />
            <text x={padL - 8} y={y + 4} fontSize="11" fill={EJE} textAnchor="end" fontFamily="monospace">{i}</text>
          </g>
        );
      })}
      {datos.map((d, i) => {
        const h = (d.v / niceMax) * plotH, x = padL + i * bw + bw * 0.2, w = bw * 0.6, y = padT + plotH - h;
        return (
          <g key={d.k}>
            <rect x={x} y={y} width={w} height={h} rx="5" fill={AZUL} />
            <text x={x + w / 2} y={y - 6} fontSize="11.5" fill={TINTA} textAnchor="middle" fontFamily="monospace" fontWeight="600">{d.v}</text>
            <text x={x + w / 2} y={H - 12} fontSize="12" fill="#556173" textAnchor="middle">{d.k}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function BarrasHorizontal({ datos, etiqueta }: { datos: Dato[]; etiqueta: string }) {
  const rowH = 30, padL = 150, padR = 34, padT = 6, W = 560;
  const H = padT + datos.length * rowH + 6;
  const max = Math.max(1, ...datos.map((d) => d.v)), plotW = W - padL - padR;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={etiqueta} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {datos.map((d, i) => {
        const y = padT + i * rowH, w = (d.v / max) * plotW;
        return (
          <g key={d.k}>
            <text x={padL - 10} y={y + rowH / 2 + 4} fontSize="12" fill="#556173" textAnchor="end">{d.k}</text>
            <rect x={padL} y={y + 5} width={plotW} height={rowH - 12} rx="5" fill={PISTA} />
            <rect x={padL} y={y + 5} width={Math.max(w, 2)} height={rowH - 12} rx="5" fill={AZUL} />
            <text x={padL + Math.max(w, 2) + 8} y={y + rowH / 2 + 4} fontSize="11.5" fill={TINTA} fontFamily="monospace" fontWeight="600">{d.v}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ datos, etiqueta, centro }: { datos: Dato[]; etiqueta: string; centro?: string }) {
  const size = 220, r = 78, cx = size / 2, cy = size / 2, sw = 30;
  const total = datos.reduce((s, d) => s + d.v, 0) || 1;
  const C = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={etiqueta} style={{ width: 200, maxWidth: '100%', height: 'auto' }}>
        {datos.map((d, i) => {
          const frac = d.v / total;
          const seg = (
            <circle key={d.k} cx={cx} cy={cy} r={r} fill="none" stroke={PALETA[i % PALETA.length]}
              strokeWidth={sw} strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-off}
              transform={`rotate(-90 ${cx} ${cy})`} />
          );
          off += frac * C;
          return seg;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fill={TINTA} fontFamily="monospace" fontWeight="600">{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fill={EJE} fontFamily="monospace">{centro ?? ''}</text>
      </svg>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {datos.map((d, i) => (
          <li key={d.k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: PALETA[i % PALETA.length], flex: 'none' }} />
            <span style={{ color: '#556173' }}>{d.k}</span>
            <b style={{ fontFamily: 'monospace' }}>{d.v}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Gauge({ ocupadas, total, etiqueta }: { ocupadas: number; total: number; etiqueta: string }) {
  const size = 220, cx = size / 2, cy = size / 2, r = 82, sw = 26;
  const C = 2 * Math.PI * r, frac = total ? ocupadas / total : 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={etiqueta} style={{ width: 210, maxWidth: '100%', height: 'auto', margin: '0 auto', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={PISTA} strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#16a34a" strokeWidth={sw} strokeLinecap="round"
        strokeDasharray={`${frac * C} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="34" fill={TINTA} fontFamily="monospace" fontWeight="600">{Math.round(frac * 100)}%</text>
      <text x={cx} y={cy + 20} textAnchor="middle" fontSize="11" fill={EJE} fontFamily="monospace">{ocupadas} de {total} plazas</text>
    </svg>
  );
}
