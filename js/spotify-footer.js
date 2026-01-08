// ============================================
// Spotify Visualizer Footer Integration
// ============================================

(function() {
    // API base URL
    const API_BASE = window.location.hostname === 'localhost'
        ? ''
        : 'https://vidyut-19-github-io.vercel.app';

    const visualizerIframe = document.getElementById('spotify-visualizer');
    const fallback = document.getElementById('visualizer-fallback');
    const connectBtn = document.getElementById('spotify-connect-btn');

    if (!visualizerIframe || !fallback) return;

    let pollInterval;

    // Check authentication status
    async function checkSpotifyAuth() {
        try {
            const res = await fetch(`${API_BASE}/api/spotify/token`, {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.authenticated) {
                fallback.classList.add('hidden');
                startPollingNowPlaying();
            } else {
                fallback.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to check Spotify auth:', error);
            fallback.classList.remove('hidden');
        }
    }

    // Handle connect button click
    if (connectBtn) {
        connectBtn.addEventListener('click', () => {
            window.location.href = `${API_BASE}/api/spotify/login`;
        });
    }

    // Poll for currently playing track
    function startPollingNowPlaying() {
        pollNowPlaying();
        pollInterval = setInterval(pollNowPlaying, 30000); // Poll every 30 seconds
    }

    async function pollNowPlaying() {
        try {
            const res = await fetch(`${API_BASE}/api/spotify/now-playing`, {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.isPlaying && data.track?.albumArt) {
                // Send album art to visualizer iframe
                visualizerIframe.contentWindow?.postMessage({
                    type: 'SPOTIFY_NOW_PLAYING',
                    track: data.track
                }, '*');
            }
        } catch (error) {
            console.error('Failed to fetch now playing:', error);
        }
    }

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('spotify') === 'connected') {
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
        checkSpotifyAuth();
    } else if (urlParams.get('error')) {
        console.error('Spotify auth error:', urlParams.get('error'));
        window.history.replaceState({}, '', window.location.pathname);
        fallback.classList.remove('hidden');
    } else {
        checkSpotifyAuth();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (pollInterval) clearInterval(pollInterval);
    });
})();
