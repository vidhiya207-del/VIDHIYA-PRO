import type { Motif, Template } from "@/lib/ppt-themes";

/** Decorative, topic-aware SVG background layer drawn behind every slide. */
export function MotifBackground({ motif, t, seed = 0 }: { motif: Motif; t: Template; seed?: number }) {
  const a = t.accent;
  const b = t.accent2;
  const o = t.dark ? 0.5 : 0.32;
  const shift = (seed % 4) * 60;

  const common = (
    <>
      <circle cx={1150 - shift} cy={90} r={190} fill={a} opacity={t.dark ? 0.16 : 0.09} />
      <circle cx={80} cy={660} r={150} fill={b} opacity={t.dark ? 0.14 : 0.08} />
    </>
  );

  let art: React.ReactNode = null;

  if (motif === "circuit" || motif === "code") {
    art = (
      <g stroke={a} strokeWidth={2} fill="none" opacity={o}>
        <rect x={950} y={430} width={230} height={200} rx={14} />
        <rect x={1000} y={480} width={130} height={100} rx={8} stroke={b} />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <path d={`M${950} ${470 + i * 40} H${840 - i * 40} V${700}`} />
            <path d={`M${1180} ${470 + i * 40} H${1260}`} stroke={b} />
            <circle cx={840 - i * 40} cy={470 + i * 40} r={5} fill={a} />
          </g>
        ))}
        <text x={60} y={690} fontFamily="monospace" fontSize={26} fill={b} opacity={0.5}>
          10110100 01001110 11010010
        </text>
      </g>
    );
  } else if (motif === "network") {
    const pts = [[980, 140], [1120, 240], [900, 300], [1180, 420], [1020, 470], [860, 470]];
    art = (
      <g opacity={o}>
        {pts.map((p, i) =>
          pts.slice(i + 1).map((q, j) => (
            <line key={`${i}-${j}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={a} strokeWidth={1.4} />
          )),
        )}
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i % 2 ? 9 : 14} fill={i % 2 ? b : a} />)}
        <path d="M120 620 q40 -60 100 -40 q20 -60 90 -40 q60 -20 80 40 q60 10 40 60 z" fill={b} opacity={0.35} />
      </g>
    );
  } else if (motif === "database") {
    art = (
      <g opacity={o} stroke={a} fill="none" strokeWidth={2.4}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(1000, ${180 + i * 90})`}>
            <ellipse cx={0} cy={0} rx={110} ry={30} />
            <path d="M-110 0 V60 A110 30 0 0 0 110 60 V0" />
          </g>
        ))}
        <g stroke={b} opacity={0.8}>
          <rect x={90} y={520} width={300} height={140} rx={8} />
          <line x1={90} y1={565} x2={390} y2={565} />
          <line x1={190} y1={520} x2={190} y2={660} />
          <line x1={290} y1={520} x2={290} y2={660} />
        </g>
      </g>
    );
  } else if (motif === "security") {
    art = (
      <g opacity={o}>
        <path d="M1060 120 l150 55 v130 c0 105 -75 165 -150 195 c-75 -30 -150 -90 -150 -195 v-130 z" fill="none" stroke={a} strokeWidth={3} />
        <path d="M1030 300 l25 30 l60 -70" fill="none" stroke={b} strokeWidth={8} strokeLinecap="round" />
        <g stroke={b} strokeWidth={2.5} fill="none">
          <rect x={120} y={560} width={90} height={70} rx={10} />
          <path d="M140 560 v-25 a25 25 0 0 1 50 0 v25" />
        </g>
      </g>
    );
  } else if (motif === "ai") {
    const layers = [[160, 3], [330, 4], [500, 4], [660, 2]];
    art = (
      <g opacity={o} transform="translate(830,120) scale(0.62)">
        {layers.map(([x, n], li) =>
          Array.from({ length: n! }).map((_, i) => {
            const y = 90 + i * 130;
            const next = layers[li + 1];
            return (
              <g key={`${li}-${i}`}>
                {next && Array.from({ length: next[1]! }).map((__, j) => (
                  <line key={j} x1={x} y1={y} x2={next[0]} y2={90 + j * 130} stroke={a} strokeWidth={1.4} opacity={0.6} />
                ))}
                <circle cx={x} cy={y} r={18} fill={li % 2 ? b : a} />
              </g>
            );
          }),
        )}
      </g>
    );
  } else if (motif === "medical") {
    art = (
      <g opacity={o}>
        <path d="M1010 200 h70 v-70 h80 v70 h70 v80 h-70 v70 h-80 v-70 h-70 z" fill={a} opacity={0.5} />
        <path d="M80 600 h120 l30 -60 l40 120 l30 -60 h150" fill="none" stroke={b} strokeWidth={4} />
      </g>
    );
  } else if (motif === "business") {
    art = (
      <g opacity={o}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={960 + i * 70} y={430 - i * 70} width={48} height={200 + i * 70} rx={8} fill={i % 2 ? b : a} opacity={0.55} />
        ))}
        <path d="M950 430 L1250 190" stroke={b} strokeWidth={4} fill="none" />
      </g>
    );
  } else if (motif === "science") {
    art = (
      <g opacity={o} fill="none" stroke={a} strokeWidth={2.4}>
        <ellipse cx={1080} cy={250} rx={170} ry={65} />
        <ellipse cx={1080} cy={250} rx={170} ry={65} transform="rotate(60 1080 250)" />
        <ellipse cx={1080} cy={250} rx={170} ry={65} transform="rotate(120 1080 250)" />
        <circle cx={1080} cy={250} r={20} fill={b} stroke="none" />
      </g>
    );
  } else if (motif === "education") {
    art = (
      <g opacity={o}>
        <path d="M960 220 l160 -70 l160 70 l-160 70 z" fill={a} opacity={0.6} />
        <path d="M1010 250 v70 c0 30 220 30 220 0 v-70" fill="none" stroke={b} strokeWidth={4} />
        <rect x={90} y={540} width={230} height={120} rx={10} fill="none" stroke={b} strokeWidth={3} />
      </g>
    );
  } else {
    art = (
      <g opacity={o} fill="none" stroke={a} strokeWidth={2}>
        {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={1090} cy={300} r={60 + i * 45} opacity={0.5 - i * 0.07} />)}
      </g>
    );
  }

  return (
    <svg viewBox="0 0 1280 720" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {common}
      {art}
    </svg>
  );
}
