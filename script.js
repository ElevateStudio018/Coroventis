(() => {
  "use strict";

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  /* ---- nav background on scroll ---- */
  const nav = document.getElementById("nav");
  const onNavScroll = () => {
    nav.classList.toggle("is-scrolled", window.scrollY > 40);
  };
  window.addEventListener("scroll", onNavScroll, { passive: true });
  onNavScroll();

  /* ---- scroll-scrub hero controller ---- */
  const hero = document.getElementById("hero");
  if (!hero) return;

  const media = hero.querySelector(".scroll-scrub__media");
  const progressBar = document.getElementById("progressBar");
  const chapterIndexEl = document.getElementById("chapterIndex");
  const chapters = [...hero.querySelectorAll(".chapter")];
  const railItems = [...document.querySelectorAll("#railList li")];

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const smallViewport = window.matchMedia("(max-width: 860px)");
  const isMobile = () => coarsePointer || smallViewport.matches;

  // Served directly from Higgsfield's CDN for now: this sandbox's network
  // policy blocks outbound fetches to that CDN, so the clip can't be
  // downloaded here to re-encode into local desktop/mobile variants and a
  // poster (see references/scroll-scrub.md). Set video.src directly instead
  // of fetching to a Blob, since plain cross-origin <video> seeking works
  // without CORS (unlike fetch()/canvas access). Once this can be downloaded
  // from a network with normal internet access, run the ffmpeg helper in
  // that same reference doc and swap this for local self-hosted encodes.
  const HERO_SRC =
    "https://d8j0ntlcm91z4.cloudfront.net/user_3JMRCS5Gqr1i91oYJAjDfAzmWyZ/hf_20260917_184945_661a4ffa-b52b-43bf-8c55-3644b51ab13a.mp4";
  const sourceFor = () => HERO_SRC;

  let video = null;
  let loading = false;
  let ready = false;
  let failed = false;
  let loadedSource = null;
  let target = 0;
  let current = 0;
  let userReady = false;

  let rootTop = 0;
  let total = 1;
  let dirty = true;
  let activeChapter = 0;

  const loadClip = () => {
    const source = sourceFor();
    if (reduceMotion || loading || ready || failed || loadedSource === source) return;

    loading = true;
    loadedSource = source;

    const el = document.createElement("video");
    el.className = "scroll-scrub__video";
    el.muted = true;
    el.playsInline = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.setAttribute("muted", "");
    el.setAttribute("playsinline", "");
    el.src = source;

    el.addEventListener(
      "loadedmetadata",
      () => {
        if (video !== el) return;
        ready = true;
        loading = false;
        dirty = true;
      },
      { once: true }
    );
    el.addEventListener(
      "seeked",
      () => {
        if (video === el) media.dataset.videoPainted = "true";
      },
      { once: true }
    );
    el.addEventListener(
      "error",
      () => {
        if (video !== el) return;
        el.remove();
        video = null;
        failed = true;
        loading = false;
        ready = false;
      },
      { once: true }
    );

    media.appendChild(el);
    video = el;
  };

  const primeVideo = async () => {
    if (!video || !isMobile()) return;
    try {
      await video.play();
      video.pause();
    } catch {
      /* a later gesture/seek can retry naturally */
    }
  };

  const layout = () => {
    const pageY = window.scrollY || window.pageYOffset;
    rootTop = hero.getBoundingClientRect().top + pageY;
    let end = window.innerHeight;
    for (const chapter of chapters) {
      const rect = chapter.getBoundingClientRect();
      end = rect.top + pageY - rootTop + rect.height;
    }
    total = Math.max(end, window.innerHeight);
    dirty = true;
  };

  const readScroll = () => {
    const pageY = window.scrollY || window.pageYOffset;
    const y = clamp(pageY - rootTop, 0, total);
    target = y / total;

    progressBar.style.setProperty("transform", `scaleX(${target})`);
    hero.style.setProperty("--ss-progress", String(target));

    let nextActive = 0;
    for (const [index, chapter] of chapters.entries()) {
      const rect = chapter.getBoundingClientRect();
      const start = rect.top + pageY - rootTop;
      if (y >= start - window.innerHeight * 0.35) nextActive = index;
    }
    if (nextActive !== activeChapter) {
      activeChapter = nextActive;
      chapterIndexEl.textContent = String(activeChapter + 1).padStart(2, "0");
      railItems.forEach((li, i) => li.classList.toggle("is-active", i === activeChapter));
    }

    if (y > -window.innerHeight && y < total + window.innerHeight) {
      loadClip();
    }
  };

  const updateVideo = () => {
    if (!video || !ready || video.seeking) return;
    current += (target - current) * 0.2;
    const targetTime = clamp(current, 0, 0.999) * (video.duration || 1);
    const epsilon = isMobile() ? 0.02 : 0.008;
    if (Math.abs(video.currentTime - targetTime) > epsilon) {
      try {
        video.currentTime = targetTime;
      } catch {
        /* keep last painted frame while the browser catches up */
      }
    }
  };

  const tick = () => {
    if (dirty) {
      dirty = false;
      readScroll();
    }
    updateVideo();
    window.requestAnimationFrame(tick);
  };

  const onScroll = () => { dirty = true; };
  const onResize = () => {
    if (coarsePointer && window.innerWidth === layoutWidth) return;
    layoutWidth = window.innerWidth;
    layout();
  };
  let layoutWidth = window.innerWidth;

  const onFirstGesture = () => {
    if (userReady) return;
    userReady = true;
    void primeVideo();
  };

  if (!reduceMotion) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", layout);
    window.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });
    window.addEventListener("touchstart", onFirstGesture, { once: true, passive: true });

    layout();
    window.requestAnimationFrame(tick);
  }
})();
