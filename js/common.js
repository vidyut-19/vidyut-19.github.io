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

  const items = track.querySelectorAll(".lens-item");
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
  let startX = 0;
  let startScrollX = 0;
  let itemWidth = 0;
  let setWidth = 0;
  let scrollerCenter = 0;
  let initialized = false;
  let gap = 0;

  function calculateDimensions() {
    const firstItem = items[0];
    if (!firstItem) return;
    const style = getComputedStyle(track);
    gap = parseFloat(style.gap) || 40;
    itemWidth = firstItem.offsetWidth + gap;
    setWidth = itemWidth * itemCount;
    scrollerCenter = scroller.offsetWidth / 2;
  }

  function updateDepthEffect() {
    const centerX = scrollerCenter;
    items.forEach((item) => {
      const itemRect = item.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const itemCenter = itemRect.left + itemRect.width / 2 - scrollerRect.left;
      const distance = Math.abs(itemCenter - centerX);
      const maxDistance = scrollerCenter;
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      const opacity = 1 - normalizedDistance * 0.7;
      const blur = normalizedDistance * 1.5;
      item.style.opacity = Math.max(0.3, opacity);
      item.style.filter = blur > 0.1 ? `blur(${blur}px)` : "none";
    });
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
    // From the formula: currentX = scrollerCenter - itemActualWidth/2 - index * itemWidth
    // Solving for index: index = (scrollerCenter - itemActualWidth/2 - currentX) / itemWidth
    const itemActualWidth = itemWidth - gap;
    const rawIndex =
      (scrollerCenter - itemActualWidth / 2 - currentX) / itemWidth;
    const nearestIndex = Math.round(rawIndex);
    targetX = scrollerCenter - itemActualWidth / 2 - nearestIndex * itemWidth;
  }

  function animate() {
    if (!initialized) {
      calculateDimensions();
      if (itemWidth > 0 && scrollerCenter > 0) {
        // To center item N of the middle set (items 5-9):
        // - Item N's left edge is at: (itemCount + currentPageIndex) * itemWidth = setWidth + currentPageIndex * itemWidth
        // - We want item N's center at scrollerCenter
        // - Item center = item left + (itemWidth - gap) / 2
        // - So: setWidth + currentPageIndex * itemWidth + currentX + (itemWidth - gap) / 2 = scrollerCenter
        // - Solving: currentX = scrollerCenter - (itemWidth - gap) / 2 - setWidth - currentPageIndex * itemWidth
        const itemActualWidth = itemWidth - gap;
        currentX =
          scrollerCenter -
          itemActualWidth / 2 -
          setWidth -
          currentPageIndex * itemWidth;
        targetX = currentX;
        initialized = true;
      }
    }

    if (!isDragging && initialized) {
      currentX += (targetX - currentX) * 0.15;
      if (Math.abs(targetX - currentX) < 0.5) currentX = targetX;
    }

    if (initialized) {
      wrapPosition();
      track.style.transform = `translateX(${currentX}px)`;
      updateDepthEffect();
    }

    requestAnimationFrame(animate);
  }

  function onDragStart(e) {
    if (!initialized) return;
    isDragging = true;
    track.classList.add("grabbing");
    startX = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    startScrollX = currentX;
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging) return;
    const x = e.type.includes("mouse") ? e.clientX : e.touches[0].clientX;
    const delta = x - startX;
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
    const scrollY = window.scrollY;
    const shouldFix = scrollY > wrapperTop;
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
      wrapper.style.backgroundColor = ""; // Clear inline style when unfixed
    }
  }

  function onWheel(e) {
    if (!initialized) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    targetX -= delta * 0.5;
    snapToNearest();
  }

  track.addEventListener("mousedown", onDragStart);
  track.addEventListener("touchstart", onDragStart, { passive: false });
  window.addEventListener("mousemove", onDragMove);
  window.addEventListener("touchmove", onDragMove, { passive: true });
  window.addEventListener("mouseup", onDragEnd);
  window.addEventListener("touchend", onDragEnd);
  scroller.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    calculateDimensions();
    updateFixedState();
  });

  updateFixedState();
  requestAnimationFrame(animate);

  // Scroll to center a specific page index
  function scrollToPageIndex(pageIndex) {
    if (!initialized || itemWidth <= 0) return;
    const itemActualWidth = itemWidth - gap;
    targetX =
      scrollerCenter - itemActualWidth / 2 - setWidth - pageIndex * itemWidth;
  }

  // Export function to update current page indicator (used by router)
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
    // Center the carousel on the new current page
    scrollToPageIndex(newCurrentIndex);
  };
})();
