// ============================================
// SPA-like Router with Prefetching
// ============================================

(function () {
  // Cache for prefetched pages
  const pageCache = new Map();

  // Pages to prefetch
  const PAGES = [
    "index.html",
    "projects.html",
    "essays.html",
    "hobbies.html",
    "contact.html",
    "javelin.html",
  ];

  // ============================================
  // Prefetching
  // ============================================

  function prefetchPage(url) {
    // Normalize URL to just the filename
    const filename = url.split("/").pop() || "index.html";
    const normalizedUrl = new URL(filename, location.href).href;

    if (pageCache.has(normalizedUrl)) return Promise.resolve();

    return fetch(normalizedUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Fetch failed");
        return res.text();
      })
      .then((html) => {
        pageCache.set(normalizedUrl, html);
      })
      .catch(() => {
        // Silent fail for prefetch
      });
  }

  // Prefetch all pages after initial load
  function prefetchAllPages() {
    const schedule =
      window.requestIdleCallback || ((fn) => setTimeout(fn, 200));

    schedule(() => {
      PAGES.forEach((page, index) => {
        // Stagger prefetch to avoid network congestion
        setTimeout(() => {
          const url = new URL(page, location.href).href;
          prefetchPage(url);
        }, index * 100);
      });
    });
  }

  // ============================================
  // Content Extraction & DOM Update
  // ============================================

  function extractContent(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    return {
      title: doc.querySelector("title")?.textContent || document.title,
      main:
        doc.querySelector("main")?.innerHTML ||
        doc.querySelector("#content")?.innerHTML ||
        "",
      footer: doc.querySelector("footer")?.innerHTML || "",
      slashTitle: doc.querySelector(".slash-title")?.textContent || "",
      hasProfilePic: !!doc.querySelector(".profile-pic"),
    };
  }

  function updateDOM(content, url) {
    // Update title
    document.title = content.title;

    // Update slash title in header
    const slashTitle = document.querySelector(".slash-title");
    if (slashTitle && content.slashTitle) {
      slashTitle.textContent = content.slashTitle;
    }

    // Handle profile pic visibility (only on index)
    const profilePic = document.querySelector(".profile-pic");
    if (profilePic) {
      profilePic.style.display = content.hasProfilePic ? "" : "none";
    }

    // Update main content
    const main =
      document.querySelector("main") || document.querySelector("#content");
    if (main && content.main) {
      main.innerHTML = content.main;
    }

    // NOTE: Footer is preserved during SPA navigation to keep the Spotify visualizer iframe alive
    // The footer is identical across all pages, so no need to update it

    // Update URL without reload
    history.pushState({ url }, "", url);

    // Scroll to top
    window.scrollTo(0, 0);

    // Update lens scroller current indicator
    if (typeof window.updateLensScrollerCurrent === "function") {
      window.updateLensScrollerCurrent(url);
    }
  }

  // ============================================
  // Navigation
  // ============================================

  async function navigate(url) {
    // Normalize URL
    const normalizedUrl = new URL(url, location.href).href;

    // Get cached or fetch fresh
    let html = pageCache.get(normalizedUrl);
    if (!html) {
      try {
        const res = await fetch(normalizedUrl);
        if (!res.ok) throw new Error("Fetch failed");
        html = await res.text();
        pageCache.set(normalizedUrl, html);
      } catch (err) {
        // Fallback to traditional navigation
        window.location.href = url;
        return;
      }
    }

    const content = extractContent(html);

    // Use View Transitions API if available
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        updateDOM(content, normalizedUrl);
      });
    } else {
      updateDOM(content, normalizedUrl);
    }
  }

  // ============================================
  // Link Detection
  // ============================================

  function isLocalLink(link) {
    // Must be same origin
    if (link.origin !== location.origin) return false;

    // Must be an HTML page (not essay subdirectory for now)
    const pathname = link.pathname;
    if (
      !pathname.endsWith(".html") &&
      pathname !== "/" &&
      !pathname.endsWith("/")
    )
      return false;

    // Skip essay pages (they have different structure)
    if (pathname.includes("/essay/")) return false;

    // Must not have target attribute
    if (link.hasAttribute("target")) return false;

    return true;
  }

  // ============================================
  // Event Listeners
  // ============================================

  // Intercept link clicks
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || !isLocalLink(link)) return;

    // Don't intercept if modifier keys are pressed
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    navigate(link.href);
  });

  // Handle browser back/forward
  window.addEventListener("popstate", (e) => {
    if (e.state?.url) {
      navigate(e.state.url);
    } else {
      // Fallback: reload the page
      navigate(location.href);
    }
  });

  // Prefetch on link hover
  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (link && isLocalLink(link)) {
      prefetchPage(link.href);
    }
  });

  // Also prefetch on touch start (mobile)
  document.addEventListener(
    "touchstart",
    (e) => {
      const link = e.target.closest("a");
      if (link && isLocalLink(link)) {
        prefetchPage(link.href);
      }
    },
    { passive: true },
  );

  // ============================================
  // Initialize
  // ============================================

  // Set initial state
  history.replaceState({ url: location.href }, "", location.href);

  // Start prefetching after page load
  if (document.readyState === "complete") {
    prefetchAllPages();
  } else {
    window.addEventListener("load", prefetchAllPages);
  }
})();
