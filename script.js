(() => {
  "use strict";

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smoothstep = (value) => {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const smallViewport = window.matchMedia("(max-width: 860px)");
  const isMobile = () => coarsePointer || smallViewport.matches;

  /* =================================================================
   * Nav background on scroll
   * ================================================================= */
  const nav = document.getElementById("nav");
  const navLinks = [...document.querySelectorAll(".nav__links a, .nav__contact")];

  /* =================================================================
   * Page-wide progress bar + section rail
   * One shared position system for the whole scroll journey, not just
   * the hero: a top progress bar plus a right-edge rail of every major
   * section, both driving and driven by the same scroll state.
   * ================================================================= */
  const pageProgressEl = document.querySelector("#pageProgress span");
  const railList = document.getElementById("railList");
  const railItems = railList ? [...railList.querySelectorAll("li")] : [];
  const railIndexEl = document.getElementById("railIndex");
  const railLabelEl = document.getElementById("railLabel");

  const SECTION_IDS = ["hero", "divide", "coroflow", "science", "about", "contact"];
  const SECTION_LABELS = ["OVERVIEW", "MICROVASCULAR", "COROFLOW", "PHYSIOLOGY", "COMPANY", "CONTACT"];
  const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  let activeSectionIndex = -1;
  let sectionTops = [];

  const layoutSections = () => {
    sectionTops = sections.map((el) => el.getBoundingClientRect().top + window.scrollY);
  };

  const updatePageProgress = () => {
    if (!pageProgressEl) return;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? clamp(window.scrollY / scrollable) : 0;
    pageProgressEl.style.transform = `scaleX(${progress})`;
  };

  const updateSectionRail = () => {
    if (!sectionTops.length) return;
    const marker = window.scrollY + window.innerHeight * 0.4;
    const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    let next = 0;
    for (let i = 0; i < sectionTops.length; i++) {
      if (marker >= sectionTops[i]) next = i;
    }
    if (atBottom) next = sectionTops.length - 1;
    if (next === activeSectionIndex) return;
    activeSectionIndex = next;
    railItems.forEach((li, i) => li.classList.toggle("is-active", i === next));
    if (railIndexEl) {
      railIndexEl.textContent = String(next + 1).padStart(2, "0");
    }
    if (railLabelEl) railLabelEl.textContent = SECTION_LABELS[next];
    const id = SECTION_IDS[next];
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${id}`));
  };

  railItems.forEach((li) => {
    li.addEventListener("click", () => {
      const target = document.getElementById(li.dataset.target);
      target?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  /* =================================================================
   * Generic [data-reveal] fade + rise, one shared easing for the whole
   * page outside the hero/divide (which get their own scroll-linked
   * treatments below).
   * ================================================================= */
  if (!reduceMotion) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));
  }

  /* =================================================================
   * Generative vessel network — a deterministic seeded branching model
   * shared by the divide section's scroll-linked reveal below. Kept
   * deterministic (no Math.random()) so the diagram doesn't reshuffle
   * on reload.
   * ================================================================= */
  const buildVesselSegments = () => {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const originX = 400;
    const originY = 248;
    const segments = [];

    const branch = (x, y, angle, length, depth, maxDepth, spread, group) => {
      const x2 = x + Math.cos(angle) * length;
      const y2 = y + Math.sin(angle) * length;
      segments.push({ x1: x, y1: y, x2, y2, depth, maxDepth, group });
      if (depth >= maxDepth) return;
      const count = depth < 1 ? 2 : rand() < 0.65 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const bias = count === 2 ? (i === 0 ? -1 : 1) : rand() < 0.5 ? -1 : 1;
        const da = bias * spread * (0.35 + rand() * 0.65);
        branch(x2, y2, angle + da, length * (0.66 + rand() * 0.12), depth + 1, maxDepth, spread, group);
      }
    };

    branch(originX, originY, -Math.PI / 2, 78, 0, 3, 0.62, "visible");

    const hiddenRoots = [-Math.PI / 2 - 0.9, -Math.PI / 2 - 0.35, -Math.PI / 2 + 0.35, -Math.PI / 2 + 0.9];
    for (const rootAngle of hiddenRoots) {
      branch(originX, originY, Math.PI + -rootAngle, 46, 0, 6, 0.75, "hidden");
    }

    return segments;
  };

  const mountVesselDiagram = (svg, segments) => {
    const ns = "http://www.w3.org/2000/svg";
    const frag = document.createDocumentFragment();
    const mounted = [];

    for (const seg of segments) {
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", seg.x1.toFixed(1));
      line.setAttribute("y1", seg.y1.toFixed(1));
      line.setAttribute("x2", seg.x2.toFixed(1));
      line.setAttribute("y2", seg.y2.toFixed(1));

      const t = seg.depth / seg.maxDepth;
      if (seg.group === "visible") {
        line.setAttribute("stroke", "color-mix(in srgb, var(--paper) 88%, transparent)");
        line.setAttribute("stroke-width", String(3.2 - t * 2));
      } else {
        const useRed = seg.depth % 3 === 0;
        line.setAttribute(
          "stroke",
          useRed
            ? "color-mix(in srgb, var(--red) 55%, transparent)"
            : "color-mix(in srgb, var(--cyan) 45%, transparent)"
        );
        line.setAttribute("stroke-width", String(1.6 - t * 1.1));
        line.setAttribute("opacity", String(0.9 - t * 0.35));
      }
      line.setAttribute("stroke-linecap", "round");

      const length = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
      line.style.strokeDasharray = String(length);
      line.style.strokeDashoffset = String(length);

      frag.appendChild(line);
      mounted.push({ el: line, seg, length });
    }

    svg.appendChild(frag);
    return mounted;
  };

  /* =================================================================
   * Divide section — scroll-linked progressive reveal. Pinned for an
   * extended scroll band; how far you've scrolled through that band
   * decides how deep into the hidden network you can see. Fully
   * reversible: scroll back up and the deeper layers retreat.
   * ================================================================= */
  const divideSection = document.getElementById("divide");
  const divideSvg = document.getElementById("vesselDiagram");
  const divideDepthEl = document.getElementById("divideDepth");
  let vesselLines = [];
  let divideRootTop = 0;
  let divideTotal = 1;

  if (divideSection && divideSvg) {
    vesselLines = mountVesselDiagram(divideSvg, buildVesselSegments());
  }

  const layoutDivide = () => {
    if (!divideSection) return;
    divideRootTop = divideSection.getBoundingClientRect().top + window.scrollY;
    divideTotal = Math.max(divideSection.offsetHeight - window.innerHeight, 1);
  };

  const updateDivideReveal = () => {
    if (reduceMotion || !divideSection || !vesselLines.length) return;
    const y = clamp(window.scrollY - divideRootTop, 0, divideTotal);
    const progress = y / divideTotal;
    let deepestRevealed = 0;

    for (const { el, seg, length } of vesselLines) {
      // Visible tree draws in fast, right as the section arrives — it's
      // "what's easy to see". The hidden network then reveals depth-by-depth
      // across almost the entire remaining scroll band: the more you scroll
      // (investigate), the deeper into the microvasculature you get.
      const revealAt = seg.group === "visible" ? (seg.depth / seg.maxDepth) * 0.06 : 0.06 + (seg.depth / seg.maxDepth) * 0.94;
      const band = seg.group === "visible" ? 0.08 : 0.14;
      const shown = smoothstep((progress - revealAt) / band + 1);
      el.style.strokeDashoffset = String((1 - shown) * length);
      if (seg.group === "hidden" && shown > 0.5) {
        deepestRevealed = Math.max(deepestRevealed, seg.depth);
      }
    }

    if (divideDepthEl) {
      divideDepthEl.textContent = `DEPTH ${String(deepestRevealed).padStart(2, "0")} / 06`;
    }
  };

  if (reduceMotion) {
    vesselLines.forEach(({ el }) => (el.style.strokeDashoffset = "0"));
    if (divideDepthEl) divideDepthEl.textContent = "DEPTH 06 / 06";
  }

  /* =================================================================
   * Hero scroll-scrub (video) + per-chapter crossfade
   * ================================================================= */
  const hero = document.getElementById("hero");
  const heroMedia = hero?.querySelector(".scroll-scrub__media");
  const chapters = hero ? [...hero.querySelectorAll(".chapter")] : [];

  // Self-hosted encodes produced by the deploy workflow's CI runner (which
  // has ordinary internet access, unlike the sandbox this site is edited
  // in) — see .github/workflows/deploy-pages.yml.
  const HERO_DESKTOP_SRC = "assets/hero/hero-desktop.mp4";
  const HERO_MOBILE_SRC = "assets/hero/hero-mobile.mp4";
  const heroSourceFor = () => (isMobile() ? HERO_MOBILE_SRC : HERO_DESKTOP_SRC);

  let heroVideo = null;
  let heroLoading = false;
  let heroReady = false;
  let heroFailed = false;
  let heroTarget = 0;
  let heroCurrent = 0;
  let heroUserReady = false;
  let heroRootTop = 0;
  let heroTotal = 1;

  const loadHeroClip = () => {
    if (!heroMedia || reduceMotion || heroLoading || heroReady || heroFailed) return;
    heroLoading = true;

    const el = document.createElement("video");
    el.className = "scroll-scrub__video";
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.src = heroSourceFor();

    el.addEventListener(
      "loadedmetadata",
      () => {
        if (heroVideo !== el) return;
        heroReady = true;
        heroLoading = false;
      },
      { once: true }
    );
    el.addEventListener(
      "seeked",
      () => {
        if (heroVideo === el) heroMedia.dataset.videoPainted = "true";
      },
      { once: true }
    );
    el.addEventListener(
      "error",
      () => {
        if (heroVideo !== el) return;
        el.remove();
        heroVideo = null;
        heroFailed = true;
        heroLoading = false;
        heroReady = false;
      },
      { once: true }
    );

    heroMedia.appendChild(el);
    heroVideo = el;
  };

  const primeHeroVideo = async () => {
    if (!heroVideo || !isMobile()) return;
    try {
      await heroVideo.play();
      heroVideo.pause();
    } catch {
      /* a later gesture/seek can retry naturally */
    }
  };

  const layoutHero = () => {
    if (!hero || !chapters.length) return;
    const pageY = window.scrollY;
    heroRootTop = hero.getBoundingClientRect().top + pageY;
    let end = window.innerHeight;
    for (const chapter of chapters) {
      const rect = chapter.getBoundingClientRect();
      end = rect.top + pageY - heroRootTop + rect.height;
    }
    heroTotal = Math.max(end, window.innerHeight);
  };

  const updateHeroScroll = () => {
    if (!hero || !chapters.length) return;
    const pageY = window.scrollY;
    const y = clamp(pageY - heroRootTop, 0, heroTotal);
    heroTarget = y / heroTotal;

    if (!reduceMotion) {
      // A subtle parallax drift on each chapter's own text while it's
      // pinned — never touches opacity, so it can't fight the natural
      // sticky "squeeze" transition as a chapter's block runs out of
      // room and the next section's sticky panel takes over.
      for (const chapter of chapters) {
        const rect = chapter.getBoundingClientRect();
        const start = rect.top + pageY - heroRootTop;
        const local = clamp((y - start) / Math.max(rect.height, 1));
        const pin = chapter.querySelector(".chapter__pin");
        if (!pin) continue;
        pin.style.transform = `translateY(${(local - 0.5) * -18}px)`;
      }
    }

    if (y > -window.innerHeight && y < heroTotal + window.innerHeight) {
      loadHeroClip();
    }
  };

  const updateHeroVideo = () => {
    if (!heroVideo || !heroReady || heroVideo.seeking) return;
    heroCurrent += (heroTarget - heroCurrent) * 0.2;
    const targetTime = clamp(heroCurrent, 0, 0.999) * (heroVideo.duration || 1);
    const epsilon = isMobile() ? 0.02 : 0.008;
    if (Math.abs(heroVideo.currentTime - targetTime) > epsilon) {
      try {
        heroVideo.currentTime = targetTime;
      } catch {
        /* keep last painted frame while the browser catches up */
      }
    }
  };

  /* =================================================================
   * Shared ticker — one scroll listener, one rAF loop driving every
   * scroll-linked effect on the page.
   * ================================================================= */
  let dirty = true;
  let layoutWidth = window.innerWidth;

  const layoutAll = () => {
    layoutSections();
    layoutHero();
    layoutDivide();
    dirty = true;
  };

  const onScroll = () => {
    dirty = true;
    nav?.classList.toggle("is-scrolled", window.scrollY > 40);
  };

  const onResize = () => {
    if (coarsePointer && window.innerWidth === layoutWidth) return;
    layoutWidth = window.innerWidth;
    layoutAll();
  };

  const onFirstGesture = () => {
    if (heroUserReady) return;
    heroUserReady = true;
    void primeHeroVideo();
  };

  const tick = () => {
    if (dirty) {
      dirty = false;
      updatePageProgress();
      updateSectionRail();
      updateHeroScroll();
      updateDivideReveal();
    }
    updateHeroVideo();
    window.requestAnimationFrame(tick);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", layoutAll);
  window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
  window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });

  onScroll();
  layoutAll();
  window.requestAnimationFrame(tick);
})();
