// ============================================
// Common JavaScript - Shared across all pages
// ============================================

// ============================================
// Banner Animation
// ============================================
const updateBannerOffset = () => {
  const y = window.scrollY || window.pageYOffset;
  // Continuous scroll - moves left as you scroll down
  const x = -(y * 0.5);
  document.body.style.setProperty("--vb-banner-offset", (y % 120) + "px");
  document.body.style.setProperty("--vb-banner-x-offset", x + "px");
};
window.addEventListener("scroll", updateBannerOffset, { passive: true });
updateBannerOffset();

// ============================================
// Plane Runway Animation
// ============================================
(function initPlaneAnimation() {
  const plane = document.getElementById("plane");
  if (!plane) return;

  const updatePlanePosition = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const docHeight =
      document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? scrollY / docHeight : 0;
    const viewportWidth = window.innerWidth;
    const planeWidth = plane.offsetWidth || 200;
    // Move from right to left as user scrolls down
    const planeX = viewportWidth - scrollPercent * (viewportWidth + planeWidth);
    plane.style.transform = `translateX(${planeX}px)`;
  };

  // Wait for image to load before first position update
  if (plane.complete) {
    updatePlanePosition();
  } else {
    plane.addEventListener("load", updatePlanePosition);
  }

  window.addEventListener("scroll", updatePlanePosition, { passive: true });
  window.addEventListener("resize", updatePlanePosition, { passive: true });
})();

// ============================================
// Theme Toggle
// ============================================
(function initTheme() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  const body = document.body;

  const renderIcon = () => {
    const isDark = body.classList.contains("dark-theme");
    themeToggle.innerHTML = isDark
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="19" rx="5" ry="2"/><path d="M7 19v-3c0-1 1-2 2-3l1-2h4l1 2c1 1 2 2 2 3v3"/><path d="M10 11V7c0-1 1-2 2-2s2 1 2 2v4"/><path d="M12 5c0-1.5-1-3-1-3s2 0 2 2"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="10" width="6" height="11" rx="1"/><path d="M10 10V9a2 2 0 1 1 4 0v1"/><ellipse cx="12" cy="6" rx="2" ry="3"/><path d="M12 3c0-1 .5-2 .5-2s.5 1 .5 2"/></svg>';
  };

  // Apply saved theme (already applied via inline script, but ensure icon renders)
  renderIcon();

  themeToggle.addEventListener("click", () => {
    body.classList.toggle("dark-theme");
    document.documentElement.classList.toggle("dark-theme");
    const isDark = body.classList.contains("dark-theme");
    localStorage.setItem("theme", isDark ? "dark-theme" : "");
    renderIcon();
    // Update fixed menu background when theme changes
    const wrapper = document.getElementById("lens-scroller-wrapper");
    if (wrapper && wrapper.classList.contains("is-fixed")) {
      wrapper.style.backgroundColor = getComputedStyle(
        document.body,
      ).backgroundColor;
    }
  });
})();

// ============================================
// Lens Scroller
// ============================================
(function initLensScroller() {
  const wrapper = document.getElementById("lens-scroller-wrapper");
  const scroller = document.getElementById("lens-scroller");
  const track = document.getElementById("lens-track");
  const placeholder = document.getElementById("lens-placeholder");

  if (!wrapper || !scroller || !track) return;

  let items = track.querySelectorAll(".lens-item");
  const itemCount = 5;

  const currentPath = window.location.pathname;
  const pageMap = {
    projects: ["projects.html", "projects"],
    essays: ["essays.html", "essays"],
    hobbies: ["hobbies.html", "hobbies", "pastimes"],
    contact: ["contact.html", "contact", "social", "socials"],
    now: ["now.html", "now"],
  };

  // Check if path matches any of the page patterns
  function pathMatchesPage(path, patterns) {
    return patterns.some((pattern) => path.includes(pattern));
  }

  let currentPageIndex = 0;
  items.forEach((item, index) => {
    const page = item.dataset.page;
    if (pageMap[page] && pathMatchesPage(currentPath, pageMap[page])) {
      item.classList.add("current");
      if (index < itemCount) currentPageIndex = index;
    }
  });

  let currentX = 0;
  let targetX = 0;
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startScrollX = 0;
  let itemWidth = 0;
  let setWidth = 0;
  let scrollerCenter = 0;
  let initialized = false;
  let gap = 0;
  let itemOffsets = [];
  let itemWidths = [];
  let running = false;
  let wheelSnapTimer = null;

  function measure() {
    const firstItem = items[0];
    if (!firstItem) return;
    const style = getComputedStyle(track);
    gap = parseFloat(style.gap) || 40;
    itemWidth = firstItem.offsetWidth + gap;
    setWidth = itemWidth * itemCount;
    scrollerCenter = scroller.offsetWidth / 2;
  }

  // Clone the base item-set until the track is wide enough to fill any
  // viewport without the infinite-loop wrap exposing blank edges.
  function ensureEnoughSets() {
    if (setWidth <= 0) return;
    const needSets = Math.min(
      20,
      Math.max(3, Math.ceil(scroller.offsetWidth / setWidth) + 4),
    );
    const currentSets = Math.round(items.length / itemCount);
    if (currentSets >= needSets) return;
    const base = Array.from(items).slice(0, itemCount);
    const frag = document.createDocumentFragment();
    for (let s = currentSets; s < needSets; s++) {
      base.forEach((node) => frag.appendChild(node.cloneNode(true)));
    }
    track.appendChild(frag);
    items = track.querySelectorAll(".lens-item");
  }

  function cacheItemMetrics() {
    itemOffsets = [];
    itemWidths = [];
    items.forEach((item) => {
      itemOffsets.push(item.offsetLeft);
      itemWidths.push(item.offsetWidth);
    });
    // True period of the repeating set, from real offsets (items vary in width).
    if (itemOffsets.length > itemCount) {
      setWidth = itemOffsets[itemCount] - itemOffsets[0];
    }
  }

  // X translation that centers a specific physical item copy.
  function targetXForCopy(copyIndex) {
    return scrollerCenter - (itemOffsets[copyIndex] + itemWidths[copyIndex] / 2);
  }

  // Among every copy of a logical page index, the one closest to referenceX.
  function nearestCopyForLogical(logicalIndex, referenceX) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = logicalIndex; i < items.length; i += itemCount) {
      const dist = Math.abs(targetXForCopy(i) - referenceX);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function relayout() {
    measure();
    ensureEnoughSets();
    measure();
    cacheItemMetrics();
  }

  // Position-based, no per-frame getBoundingClientRect (avoids layout thrash).
  function updateDepthEffect() {
    if (!itemOffsets.length) return;
    const maxDistance = scrollerCenter || 1;
    for (let i = 0; i < items.length; i++) {
      const center = currentX + itemOffsets[i] + itemWidths[i] / 2;
      const normalizedDistance = Math.min(
        Math.abs(center - scrollerCenter) / maxDistance,
        1,
      );
      const blur = normalizedDistance * 1.5;
      items[i].style.opacity = Math.max(0.3, 1 - normalizedDistance * 0.7);
      items[i].style.filter = blur > 0.1 ? `blur(${blur}px)` : "none";
    }
  }

  function wrapPosition() {
    if (currentX < -setWidth * 2) {
      currentX += setWidth;
      targetX += setWidth;
    } else if (currentX > -setWidth * 0.5) {
      currentX -= setWidth;
      targetX -= setWidth;
    }
  }

  function snapToNearest() {
    if (!itemOffsets.length) return;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const center = currentX + itemOffsets[i] + itemWidths[i] / 2;
      const dist = Math.abs(center - scrollerCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    targetX = targetXForCopy(best);
    start();
  }

  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame() {
    if (!initialized) {
      relayout();
      if (itemOffsets.length && scrollerCenter > 0) {
        const setsCount = Math.round(items.length / itemCount);
        const copy = Math.floor(setsCount / 2) * itemCount + currentPageIndex;
        currentX = targetXForCopy(copy);
        targetX = currentX;
        initialized = true;
      } else {
        requestAnimationFrame(frame);
        return;
      }
    }

    if (!isDragging) {
      currentX += (targetX - currentX) * 0.15;
      if (Math.abs(targetX - currentX) < 0.5) currentX = targetX;
    }

    wrapPosition();
    track.style.transform = `translateX(${currentX}px)`;
    updateDepthEffect();

    if (!isDragging && currentX === targetX) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function onDragStart(e) {
    if (!initialized) return;
    isDragging = true;
    hasDragged = false;
    track.classList.add("grabbing");
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    startScrollX = currentX;
    e.preventDefault();
    start();
  }

  function onDragMove(e) {
    if (!isDragging) return;
    const x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const delta = x - startX;
    if (Math.abs(delta) > 5) hasDragged = true;
    currentX = startScrollX + delta;
    targetX = currentX;
  }

  function onDragEnd() {
    if (!isDragging) return;
    isDragging = false;
    track.classList.remove("grabbing");
    snapToNearest();
  }

  let wrapperTop = 0;
  let isFixed = false;

  function updateFixedState() {
    wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
  }

  function onScroll() {
    const shouldFix = window.scrollY > wrapperTop;
    if (shouldFix && !isFixed) {
      isFixed = true;
      wrapper.classList.add("is-fixed");
      if (placeholder) placeholder.classList.add("active");
      wrapper.style.backgroundColor = getComputedStyle(
        document.body,
      ).backgroundColor;
    } else if (!shouldFix && isFixed) {
      isFixed = false;
      wrapper.classList.remove("is-fixed");
      if (placeholder) placeholder.classList.remove("active");
      wrapper.style.backgroundColor = "";
    }
  }

  // Only hijack the wheel for horizontal-intent gestures, so vertical
  // page scrolling passes through; snap once the gesture settles.
  function onWheel(e) {
    if (!initialized) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    targetX -= e.deltaX * 0.5;
    start();
    clearTimeout(wheelSnapTimer);
    wheelSnapTimer = setTimeout(snapToNearest, 120);
  }

  // Swallow the click that follows a drag so the link doesn't navigate.
  track.addEventListener(
    "click",
    (e) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    },
    true,
  );

  track.addEventListener("mousedown", onDragStart);
  track.addEventListener("touchstart", onDragStart, { passive: false });
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("touchmove", onDragMove, { passive: true });
  window.addEventListener("mouseup", onDragEnd);
  window.addEventListener("touchend", onDragEnd);
  scroller.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    if (initialized) relayout();
    updateFixedState();
    start();
  });

  // Re-measure once the custom serif font loads, otherwise items are sized
  // with the fallback font and the active page sits off-center.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      if (!isDragging) {
        initialized = false;
        start();
      }
    });
  }

  updateFixedState();
  start();

  function scrollToPageIndex(pageIndex) {
    if (!initialized || !itemOffsets.length) return;
    const copy = nearestCopyForLogical(pageIndex, currentX);
    if (copy < 0) return;
    targetX = targetXForCopy(copy);
    start();
  }

  window.updateLensScrollerCurrent = function (url) {
    const filename = url.split("/").pop() || "index.html";
    let newCurrentIndex = 0;
    items.forEach((item, index) => {
      item.classList.remove("current");
      const itemPage = item.dataset.page;
      if (pageMap[itemPage] && pathMatchesPage(filename, pageMap[itemPage])) {
        item.classList.add("current");
        if (index < itemCount) newCurrentIndex = index;
      }
    });
    scrollToPageIndex(newCurrentIndex);
  };
})();
