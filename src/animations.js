import gsap from 'gsap';

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs the initial above-the-fold hero choreography on mount.
 */
export function animateHeroEntrance(rootEl) {
  if (!rootEl || prefersReducedMotion()) return () => {};
  const ctx = gsap.context(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.from('.hero-eyebrow', { y: 12, opacity: 0, duration: 0.45 })
      .from('.hero-title__line', { y: 26, opacity: 0, duration: 0.65, stagger: 0.1 }, '-=0.25')
      .from('.hero-fade', { y: 14, opacity: 0, duration: 0.5, stagger: 0.08 }, '-=0.35')
      .from('.telemetry-panel', { y: 16, scale: 0.985, opacity: 0, duration: 0.55 }, '-=0.4');
  }, rootEl);
  return () => ctx.revert();
}

/**
 * Animates a view container entering when the user switches workspace tabs.
 */
export function animatePanelEnter(panelEl) {
  if (!panelEl || prefersReducedMotion()) return () => {};
  const ctx = gsap.context(() => {
    gsap.from(panelEl, {
      y: 16,
      opacity: 0,
      duration: 0.42,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    });
  }, panelEl);
  return () => ctx.revert();
}

/**
 * Staggers a set of newly loaded cards or timeline rows inside a container.
 */
export function animateStaggerItems(containerEl, selector = '.gsap-item') {
  if (!containerEl || prefersReducedMotion()) return () => {};
  const ctx = gsap.context(() => {
    const targets = containerEl.querySelectorAll(selector);
    if (!targets.length) return;
    gsap.from(targets, {
      y: 14,
      opacity: 0,
      duration: 0.38,
      stagger: 0.055,
      ease: 'power2.out',
      clearProps: 'transform,opacity',
    });
  }, containerEl);
  return () => ctx.revert();
}

/**
 * Drives the glowing route-progress indicator down a stop timeline track.
 */
export function animateTimelinePulse(trackContainerEl) {
  if (!trackContainerEl || prefersReducedMotion()) return () => {};
  const ctx = gsap.context(() => {
    const pulse = trackContainerEl.querySelector('.stop-timeline__pulse');
    const track = trackContainerEl.querySelector('.stop-timeline__track');
    if (!pulse || !track) return;
    const distance = Math.max(0, track.clientHeight - 10);
    if (distance <= 4) return;
    gsap.fromTo(
      pulse,
      { y: 0, opacity: 0.95 },
      {
        y: distance,
        opacity: 1,
        duration: 2.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      }
    );
  }, trackContainerEl);
  return () => ctx.revert();
}
