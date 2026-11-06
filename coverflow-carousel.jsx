// Ported from the shadcn/Tailwind "coverflow-carousel" component to plain React + inline styles.
// `React` is provided by the host loader.

const useIsoLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

function Chevron({ dir }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function Fade({ children, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    const id = requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "none";
    }));
    return () => cancelAnimationFrame(id);
  }, []);
  return <div ref={ref} style={{ transition: "opacity .35s ease, transform .35s ease", ...style }}>{children}</div>;
}

function CoverflowCarousel({
  slides = [],
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = "clamp(148px, 22vw, 260px)",
  cardRadius = 16,
  gap = 0.05,
  loop = true,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  cardScrim = false,
  activeTapOpens = false,
  captionMinHeight,
  label = "Cover carousel",
  textColor = "#111",
  mutedColor = "#777",
  buttonBg = "rgba(255,255,255,.7)",
  cardBg = "#222",
  fontFamily = "inherit",
  monoFamily = "ui-monospace, monospace",
  style,
}) {
  const count = slides.length;
  const frameRef = React.useRef(null);
  const cardRefs = React.useRef([]);
  const posRef = React.useRef(0);
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const [selected, setSelected] = React.useState(0);

  const indexAt = React.useCallback((pos) => ((Math.round(pos) % count) + count) % count, [count]);

  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }
      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, falloff);
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);
      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback((target) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    targetRef.current = target;
    setSelected(indexAt(target));
    const step = () => {
      const remaining = target - posRef.current;
      if (Math.abs(remaining) < 0.0004) {
        posRef.current = target;
        paint();
        rafRef.current = null;
        return;
      }
      posRef.current += remaining * 0.16;
      paint();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [indexAt, paint]);

  const clamp = React.useCallback((pos) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))), [count, loop]);

  const goTo = React.useCallback((index) => {
    const target = loop ? index + Math.round((targetRef.current - index) / count) * count : index;
    settle(clamp(target));
  }, [clamp, count, loop, settle]);

  const nudge = React.useCallback((by) => settle(clamp(Math.round(targetRef.current) + by)), [clamp, settle]);

  const onPointerDown = (event) => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    event.currentTarget.setPointerCapture(event.pointerId);
    targetRef.current = posRef.current;
    dragRef.current = { id: event.pointerId, x: event.clientX, startX: event.clientX, pos: posRef.current, v: 0, t: performance.now(), target: event.target };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;
    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;
    const index = indexAt(posRef.current);
    if (index !== selected) setSelected(index);
    paint();
  };

  const endDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    // A tap (no travel) on a side card brings it to the centre.
    if (Math.abs(event.clientX - drag.startX) < 4 && drag.target instanceof Element) {
      const card = drag.target.closest("[data-index]");
      if (card) {
        const index = Number(card.getAttribute("data-index"));
        if (index !== indexAt(posRef.current)) { goTo(index); return; }
        const slide = slides[index];
        if (activeTapOpens && slide && slide.href) {
          if (/^https?:/.test(slide.href)) window.open(slide.href, "_blank", "noopener"); else window.location.href = slide.href;
          return;
        }
      }
    }
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
  };

  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  React.useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  const active = slides[selected];
  const navBtn = (side) => ({
    position: "absolute", [side]: 12, top: "50%", zIndex: 200, transform: "translateY(-50%)",
    width: 40, height: 40, borderRadius: 999, background: buttonBg, color: textColor, border: 0,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
  });

  return (
    <div style={{ width: "100%", fontFamily, ...style }} role="region" aria-roledescription="carousel" aria-label={label}>
      <div style={{ position: "relative" }}>
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); nudge(-1); }
            else if (event.key === "ArrowRight") { event.preventDefault(); nudge(1); }
          }}
          style={{
            cursor: "grab", overflow: "hidden", padding: "40px 0", outline: "none",
            perspective: `calc(${cardWidth} * ${perspective})`, touchAction: "pan-y",
          }}
        >
          <div style={{ position: "relative", userSelect: "none", height: cardWidth, transformStyle: "preserve-3d" }}>
            {slides.map((slide, index) => (
              <div
                key={index}
                data-index={index}
                ref={(node) => { cardRefs.current[index] = node; }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                style={{
                  position: "absolute", left: "50%", top: 0, width: cardWidth, aspectRatio: "1 / 1",
                  overflow: "hidden", borderRadius: cardRadius, background: cardBg, cursor: activeTapOpens && index === selected && slide.href ? "pointer" : undefined,
                  boxShadow: "0 30px 60px rgba(0,0,0,.45)", willChange: "transform",
                }}
              >
                <img src={slide.src} alt={slide.alt || ""} draggable={false} loading="lazy" decoding="async"
                  onError={slide.fallback ? (event) => { const img = event.currentTarget; if (img.getAttribute("src") !== slide.fallback) img.setAttribute("src", slide.fallback); } : undefined}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", userSelect: "none", pointerEvents: "none" }} />
                {cardScrim && slide.tag && (
                  <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(11,14,13,.75), rgba(11,14,13,0) 32%)", pointerEvents: "none" }} />
                )}
                {slide.tag && (
                  <span style={{ position: "absolute", left: 14, top: 12, fontFamily: monoFamily, fontSize: 12, letterSpacing: ".08em", color: "#C9D0CC", pointerEvents: "none" }}>{slide.tag}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <>
            <button type="button" aria-label="Previous slide" onClick={() => nudge(-1)} style={navBtn("left")}><Chevron dir="left" /></button>
            <button type="button" aria-label="Next slide" onClick={() => nudge(1)} style={navBtn("right")}><Chevron dir="right" /></button>
          </>
        )}
      </div>

      {showCaption && active && active.title && (
        <Fade key={selected} style={{ marginTop: 8, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px", textAlign: "center", minHeight: captionMinHeight }}>
          {active.eyebrow && <span style={{ marginBottom: 10, fontFamily: monoFamily, fontSize: 12, letterSpacing: ".1em", color: "#00B384" }}>{active.eyebrow}</span>}
          <p style={{ margin: 0, maxWidth: 760, fontSize: 22, fontWeight: 500, letterSpacing: "-.02em", lineHeight: 1.25, textWrap: "balance", color: textColor }}>{active.title}</p>
          {active.subtitle && <p style={{ margin: "6px 0 0", fontSize: 14, color: mutedColor }}>{active.subtitle}</p>}
          {active.description && <p style={{ margin: "12px 0 0", maxWidth: 600, fontSize: 15, lineHeight: 1.55, color: mutedColor, textWrap: "pretty" }}>{active.description}</p>}
          {active.meta && active.meta.length > 0 && (
            <dl style={{ margin: "28px 0 0", width: "100%", maxWidth: 300, fontSize: 13 }}>
              {active.meta.map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "7px 0", borderTop: "1px solid " + mutedColor + "33" }}>
                  <dt style={{ margin: 0, color: mutedColor }}>{row.label}</dt>
                  <dd style={{ margin: 0, fontWeight: 500, color: textColor, textAlign: "right" }}>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {active.href && (
            <a href={active.href} target={/^https?:/.test(active.href) ? "_blank" : undefined} rel={/^https?:/.test(active.href) ? "noreferrer" : undefined}
              style={{ marginTop: 8, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 8, fontFamily: monoFamily, fontSize: 12, letterSpacing: ".02em", color: "#00B384" }}>
              {active.linkLabel || "Visit site"} {/^https?:/.test(active.href) ? "↗" : "→"}
            </a>
          )}
        </Fade>
      )}

      {showPagination && (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
          {slides.map((_, index) => (
            <button key={index} type="button" aria-label={`Go to slide ${index + 1}`} aria-current={index === selected}
              onClick={() => goTo(index)}
              style={{ width: 24, height: 44, padding: 0, border: 0, cursor: "pointer", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}><span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: textColor, opacity: index === selected ? 1 : 0.3, transition: "opacity .2s" }} /></button>
          ))}
        </div>
      )}
    </div>
  );
}

window.CoverflowCarousel = CoverflowCarousel;
if (typeof module !== "undefined") module.exports = { CoverflowCarousel };
