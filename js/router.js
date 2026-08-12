
(function () {
  const pageCache = new Map();

  const PAGES = [
    "index.html",
    "projects.html",
    "essays.html",
    "hobbies.html",
    "contact.html",
    "now.html",
  ];

  function prefetchPage(url) {
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

  function updateDOM(content, url, push) {
    document.title = content.title;

    const slashTitle = document.querySelector(".slash-title");
    if (slashTitle && content.slashTitle) {
      slashTitle.textContent = content.slashTitle;
    }

    const profilePic = document.querySelector(".profile-pic");
    if (profilePic) {
      profilePic.style.display = content.hasProfilePic ? "" : "none";
    }

    const main =
      document.querySelector("main") || document.querySelector("#content");
    if (main && content.main) {
      main.innerHTML = content.main;
    }

    // Footer is identical across all pages, so it's preserved during SPA navigation

    // Update URL without reload (skip on popstate — the browser already
    // moved the history pointer, pushing again would destroy forward entries)
    if (push) history.pushState({ url }, "", url);

    window.scrollTo(0, 0);

    if (typeof window.updateLensScrollerCurrent === "function") {
      window.updateLensScrollerCurrent(url);
    }
  }

  async function navigate(url, push = true) {
    const normalizedUrl = new URL(url, location.href).href;

    let html = pageCache.get(normalizedUrl);
    if (!html) {
      try {
        const res = await fetch(normalizedUrl);
        if (!res.ok) throw new Error("Fetch failed");
        html = await res.text();
        pageCache.set(normalizedUrl, html);
      } catch (err) {
        window.location.href = url;
        return;
      }
    }

    const content = extractContent(html);

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        updateDOM(content, normalizedUrl, push);
      });
    } else {
      updateDOM(content, normalizedUrl, push);
    }
  }

  function isLocalLink(link) {
    if (link.origin !== location.origin) return false;

    const pathname = link.pathname;
    if (
      !pathname.endsWith(".html") &&
      pathname !== "/" &&
      !pathname.endsWith("/")
    )
      return false;

    // Skip essay pages (they have different structure)
    if (pathname.includes("/essay/")) return false;

    if (link.hasAttribute("target")) return false;

    return true;
  }

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link || !isLocalLink(link)) return;

    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    navigate(link.href);
  });

  window.addEventListener("popstate", (e) => {
    navigate(e.state?.url || location.href, false);
  });

  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (link && isLocalLink(link)) {
      prefetchPage(link.href);
    }
  });

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

  history.replaceState({ url: location.href }, "", location.href);

  if (document.readyState === "complete") {
    prefetchAllPages();
  } else {
    window.addEventListener("load", prefetchAllPages);
  }
})();
