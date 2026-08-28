import type { Slide } from "@/lib/ppt-types";
import type { Template } from "@/lib/ppt-themes";
import { MotifBackground } from "@/components/MotifBackground";
import type { Motif } from "@/lib/ppt-themes";

const ANIM: Record<string, string> = {
  fade: "ppt-anim-fade",
  zoom: "ppt-anim-zoom",
  slide: "ppt-anim-slide",
  morph: "ppt-anim-morph",
  appear: "",
};

function Chart({ chart, t }: { chart: NonNullable<Slide["chart"]>; t: Template }) {
  const vals = chart.values ?? [];
  const max = Math.max(1, ...vals);
  if (chart.type === "pie") {
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return (
      <div className="flex items-center gap-10">
        <svg viewBox="0 0 100 100" className="h-[260px] w-[260px]">
          {vals.map((v, i) => {
            const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
            acc += v;
            const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
            const large = end - start > Math.PI ? 1 : 0;
            const p = (ang: number) => `${50 + 46 * Math.cos(ang)} ${50 + 46 * Math.sin(ang)}`;
            return (
              <path key={i} d={`M50 50 L ${p(start)} A46 46 0 ${large} 1 ${p(end)} Z`}
                fill={i % 2 ? t.accent2 : t.accent} opacity={1 - i * 0.13} />
            );
          })}
        </svg>
        <ul className="space-y-3 text-[22px]" style={{ color: t.muted }}>
          {chart.labels?.map((l, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 rounded" style={{ background: i % 2 ? t.accent2 : t.accent, opacity: 1 - i * 0.13 }} />
              {l} — <b style={{ color: t.text }}>{vals[i]}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="flex h-[300px] items-end gap-6">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-3">
          <span className="text-[20px] font-semibold" style={{ color: t.text }}>{v}</span>
          <div className="w-full rounded-t-xl" style={{ height: `${(v / max) * 220}px`, background: `linear-gradient(180deg, ${t.accent}, ${t.accent2})` }} />
          <span className="text-center text-[18px]" style={{ color: t.muted }}>{chart.labels?.[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function SlideView({
  slide, t, motif, index, total, animation = "fade", animations = true, deckTitle,
}: {
  slide: Slide; t: Template; motif: Motif; index: number; total: number;
  animation?: string; animations?: boolean; deckTitle?: string;
}) {
  const anim = animations ? (ANIM[animation] ?? "ppt-anim-fade") : "";
  const bullets = slide.bullets ?? [];

  const Bullets = ({ items, size = 30 }: { items: string[]; size?: number }) => (
    <ul className="space-y-4">
      {items.map((b, i) => (
        <li key={i} className="flex gap-4" style={{ fontSize: size, lineHeight: 1.35, color: t.text }}>
          <span className="mt-[10px] inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ background: i % 2 ? t.accent2 : t.accent }} />
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );

  const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div className={`rounded-3xl border p-10 ${className}`}
      style={{ background: t.surface, borderColor: t.border, boxShadow: t.dark ? "0 24px 60px rgba(0,0,0,.35)" : "0 18px 40px rgba(16,23,53,.10)", backdropFilter: "blur(14px)" }}>
      {children}
    </div>
  );

  return (
    <div className="relative h-[720px] w-[1280px] overflow-hidden" style={{ background: t.bg, fontFamily: t.body, color: t.text }}>
      <MotifBackground motif={motif} t={t} seed={index} />

      {/* top accent bar */}
      <div className="absolute left-0 right-0 top-0 h-[6px]" style={{ background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />

      <div className={`relative flex h-full flex-col px-20 py-16 ${anim}`} key={`${slide.id}-${animation}-${animations}`}>
        {slide.layout === "title" ? (
          <div className="flex h-full flex-col justify-center">
            <div className="mb-6 inline-flex w-fit items-center rounded-full border px-5 py-2 text-[18px] uppercase tracking-[0.25em]"
              style={{ borderColor: t.border, color: t.accent }}>
              {deckTitle ? deckTitle : "Presentation"}
            </div>
            <h1 className="max-w-[900px] text-[76px] font-bold leading-[1.05]" style={{ fontFamily: t.heading }}>
              {slide.title}
            </h1>
            {slide.subtitle && <p className="mt-6 max-w-[860px] text-[30px]" style={{ color: t.muted }}>{slide.subtitle}</p>}
            <div className="mt-10 h-[6px] w-[220px] rounded-full" style={{ background: `linear-gradient(90deg, ${t.accent}, ${t.accent2})` }} />
          </div>
        ) : slide.layout === "section" ? (
          <div className="flex h-full flex-col justify-center">
            <div className="text-[24px] uppercase tracking-[0.3em]" style={{ color: t.accent }}>Section {index + 1}</div>
            <h2 className="mt-4 text-[64px] font-bold" style={{ fontFamily: t.heading }}>{slide.title}</h2>
            {slide.body && <p className="mt-6 max-w-[900px] text-[28px]" style={{ color: t.muted }}>{slide.body}</p>}
          </div>
        ) : slide.layout === "quote" ? (
          <div className="flex h-full flex-col justify-center">
            <div className="text-[110px] leading-none" style={{ color: t.accent }}>&ldquo;</div>
            <p className="max-w-[1000px] text-[42px] font-medium leading-[1.3]" style={{ fontFamily: t.heading }}>{slide.quote ?? slide.body}</p>
            {slide.author && <p className="mt-6 text-[26px]" style={{ color: t.muted }}>— {slide.author}</p>}
          </div>
        ) : (
          <>
            <div className="mb-2 text-[20px] uppercase tracking-[0.25em]" style={{ color: t.accent }}>
              {slide.subtitle || (deckTitle ?? "")}
            </div>
            <h2 className="mb-8 text-[46px] font-bold leading-tight" style={{ fontFamily: t.heading }}>{slide.title}</h2>

            <div className="min-h-0 flex-1">
              {slide.layout === "two-column" ? (
                <div className="grid h-full grid-cols-2 gap-8">
                  {[slide.left, slide.right].map((col, i) => (
                    <Panel key={i}>
                      <h3 className="mb-5 text-[30px] font-semibold" style={{ color: i ? t.accent2 : t.accent, fontFamily: t.heading }}>
                        {col?.heading ?? (i ? "Column B" : "Column A")}
                      </h3>
                      <Bullets items={col?.bullets ?? []} size={25} />
                    </Panel>
                  ))}
                </div>
              ) : slide.layout === "table" && slide.table ? (
                <Panel className="p-6">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        {slide.table.headers?.map((h, i) => (
                          <th key={i} className="border-b-2 px-5 py-4 text-[24px] font-semibold"
                            style={{ borderColor: t.accent, color: t.accent }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slide.table.rows?.map((r, i) => (
                        <tr key={i}>
                          {r.map((c, j) => (
                            <td key={j} className="border-b px-5 py-4 text-[22px]" style={{ borderColor: t.border, color: t.text }}>{c}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              ) : slide.layout === "chart" && slide.chart ? (
                <Panel>
                  <Chart chart={slide.chart} t={t} />
                  {slide.chart.caption && <p className="mt-5 text-[20px]" style={{ color: t.muted }}>{slide.chart.caption}</p>}
                </Panel>
              ) : slide.layout === "process" ? (
                <div className="flex items-stretch gap-4">
                  {(slide.steps ?? []).map((s, i, arr) => (
                    <div key={i} className="flex flex-1 items-center gap-3">
                      <div className="flex-1 rounded-2xl border p-6" style={{ background: t.surface, borderColor: t.border }}>
                        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl text-[24px] font-bold"
                          style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`, color: t.dark ? "#0b1020" : "#fff" }}>{i + 1}</div>
                        <div className="text-[22px] leading-snug">{s}</div>
                      </div>
                      {i < arr.length - 1 && <div className="text-[34px]" style={{ color: t.accent }}>→</div>}
                    </div>
                  ))}
                </div>
              ) : slide.layout === "stats" ? (
                <div className="grid grid-cols-3 gap-6">
                  {(slide.stats ?? []).map((s, i) => (
                    <Panel key={i} className="text-center">
                      <div className="text-[62px] font-bold" style={{ color: i % 2 ? t.accent2 : t.accent, fontFamily: t.heading }}>{s.value}</div>
                      <div className="mt-3 text-[22px]" style={{ color: t.muted }}>{s.label}</div>
                    </Panel>
                  ))}
                </div>
              ) : slide.layout === "qa" ? (
                <div className="space-y-4">
                  {(slide.qa ?? []).map((x, i) => (
                    <Panel key={i} className="p-6">
                      <div className="text-[24px] font-semibold" style={{ color: t.accent }}>Q{i + 1}. {x.q}</div>
                      <div className="mt-2 text-[21px]" style={{ color: t.muted }}>{x.a}</div>
                    </Panel>
                  ))}
                </div>
              ) : slide.layout === "code" ? (
                <Panel className="p-6">
                  <div className="mb-3 text-[18px] uppercase tracking-widest" style={{ color: t.accent2 }}>{slide.language ?? "code"}</div>
                  <pre className="overflow-hidden rounded-xl p-6 text-[20px] leading-[1.5]"
                    style={{ background: t.dark ? "rgba(0,0,0,.45)" : "#0f1530", color: "#e6ecff", fontFamily: "'JetBrains Mono', Consolas, monospace" }}>
                    <code>{slide.code}</code>
                  </pre>
                </Panel>
              ) : (
                <div className="grid h-full grid-cols-[1.25fr_.75fr] gap-8">
                  <div>
                    {slide.body && <p className="mb-6 text-[26px] leading-relaxed" style={{ color: t.muted }}>{slide.body}</p>}
                    <Bullets items={bullets} />
                  </div>
                  <Panel className="flex items-center justify-center">
                    <MiniIllustration motif={motif} t={t} seed={index} />
                  </Panel>
                </div>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex items-center justify-between text-[16px]" style={{ color: t.muted }}>
          <span>{deckTitle}</span>
          <span>{index + 1} / {total}</span>
        </div>
      </div>
    </div>
  );
}

/** Topic-aware inline illustration used as the "AI image" on content slides. */
export function MiniIllustration({ motif, t, seed }: { motif: Motif; t: Template; seed: number }) {
  const a = t.accent, b = t.accent2;
  const shapes: Record<string, React.ReactNode> = {
    circuit: (<g fill="none" stroke={a} strokeWidth={4}><rect x={60} y={60} width={160} height={140} rx={12} /><rect x={100} y={100} width={80} height={60} rx={6} stroke={b} /><path d="M60 100 H20 M60 160 H20 M220 100 H260 M220 160 H260" /></g>),
    code: (<g fill="none" stroke={a} strokeWidth={6} strokeLinecap="round"><path d="M90 80 L40 130 L90 180" /><path d="M190 80 L240 130 L190 180" /><path d="M150 70 L130 190" stroke={b} /></g>),
    network: (<g><circle cx={140} cy={70} r={16} fill={a} /><circle cx={60} cy={180} r={16} fill={b} /><circle cx={220} cy={180} r={16} fill={b} /><g stroke={a} strokeWidth={3}><line x1={140} y1={70} x2={60} y2={180} /><line x1={140} y1={70} x2={220} y2={180} /><line x1={60} y1={180} x2={220} y2={180} /></g></g>),
    database: (<g fill="none" stroke={a} strokeWidth={5}><ellipse cx={140} cy={70} rx={80} ry={24} /><path d="M60 70 V180 A80 24 0 0 0 220 180 V70" /><ellipse cx={140} cy={130} rx={80} ry={24} stroke={b} /></g>),
    security: (<g fill="none" stroke={a} strokeWidth={5}><path d="M140 40 l80 30 v70 c0 55 -40 85 -80 100 c-40 -15 -80 -45 -80 -100 v-70 z" /><path d="M110 130 l22 24 l50 -56" stroke={b} strokeWidth={9} strokeLinecap="round" /></g>),
    ai: (<g><g stroke={a} strokeWidth={3}><line x1={70} y1={80} x2={150} y2={130} /><line x1={70} y1={180} x2={150} y2={130} /><line x1={150} y1={130} x2={230} y2={80} /><line x1={150} y1={130} x2={230} y2={180} /></g><circle cx={70} cy={80} r={14} fill={b} /><circle cx={70} cy={180} r={14} fill={b} /><circle cx={150} cy={130} r={20} fill={a} /><circle cx={230} cy={80} r={14} fill={b} /><circle cx={230} cy={180} r={14} fill={b} /></g>),
    medical: (<g><path d="M110 60 h60 v50 h50 v60 h-50 v50 h-60 v-50 h-50 v-60 h50 z" fill={a} opacity={0.7} /></g>),
    business: (<g>{[0, 1, 2].map((i) => (<rect key={i} x={70 + i * 60} y={180 - i * 45} width={40} height={40 + i * 45} rx={6} fill={i % 2 ? b : a} />))}<path d="M60 180 L230 60" stroke={b} strokeWidth={5} fill="none" /></g>),
    science: (<g fill="none" stroke={a} strokeWidth={4}><ellipse cx={140} cy={130} rx={100} ry={40} /><ellipse cx={140} cy={130} rx={100} ry={40} transform="rotate(60 140 130)" /><ellipse cx={140} cy={130} rx={100} ry={40} transform="rotate(120 140 130)" /><circle cx={140} cy={130} r={16} fill={b} stroke="none" /></g>),
    education: (<g><path d="M40 110 l100 -50 l100 50 l-100 50 z" fill={a} /><path d="M80 130 v50 c0 20 120 20 120 0 v-50" fill="none" stroke={b} strokeWidth={6} /></g>),
    generic: (<g fill="none" stroke={a} strokeWidth={4}>{[0, 1, 2].map((i) => (<circle key={i} cx={140} cy={130} r={40 + i * 35} opacity={0.8 - i * 0.2} />))}<circle cx={140} cy={130} r={14} fill={b} stroke="none" /></g>),
  };
  return (
    <svg viewBox="0 0 280 240" className="h-[300px] w-full" style={{ opacity: 0.95 }} key={seed}>
      {shapes[motif] ?? shapes.generic}
    </svg>
  );
}
