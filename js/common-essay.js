
const updateBannerOffset = () => {
    const y = window.scrollY || window.pageYOffset;
    const x = Math.sin(y / 120) * 80;
    document.body.style.setProperty('--vb-banner-offset', (y % 120) + 'px');
    document.body.style.setProperty('--vb-banner-x-offset', x + 'px');
};
window.addEventListener('scroll', updateBannerOffset, { passive: true });
updateBannerOffset();

(function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const root = document.documentElement;

    const renderIcon = () => {
        const isDark = root.classList.contains('dark-theme');
        themeToggle.innerHTML = isDark
            ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="19" rx="5" ry="2"/><path d="M7 19v-3c0-1 1-2 2-3l1-2h4l1 2c1 1 2 2 2 3v3"/><path d="M10 11V7c0-1 1-2 2-2s2 1 2 2v4"/><path d="M12 5c0-1.5-1-3-1-3s2 0 2 2"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="10" width="6" height="11" rx="1"/><path d="M10 10V9a2 2 0 1 1 4 0v1"/><ellipse cx="12" cy="6" rx="2" ry="3"/><path d="M12 3c0-1 .5-2 .5-2s.5 1 .5 2"/></svg>';
    };

    // Apply saved theme (already applied via inline script, but ensure icon renders)
    renderIcon();

    themeToggle.addEventListener('click', () => {
        root.classList.toggle('dark-theme');
        const isDark = root.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark-theme' : '');
        renderIcon();
    });
})();
