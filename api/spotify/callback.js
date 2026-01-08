// Handles OAuth callback, exchanges code for tokens
export default async function handler(req, res) {
    const { code, state } = req.query;

    // Parse cookies manually
    const cookies = parseCookies(req.headers.cookie || '');
    const storedState = cookies.spotify_auth_state;

    if (!state || state !== storedState) {
        return res.redirect('/?error=state_mismatch');
    }

    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
    const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

    try {
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            throw new Error(tokens.error_description);
        }

        // Store tokens in secure HTTP-only cookies
        const cookieOptions = 'HttpOnly; Secure; SameSite=Lax; Path=/';
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        res.setHeader('Set-Cookie', [
            `spotify_access_token=${tokens.access_token}; ${cookieOptions}; Max-Age=${tokens.expires_in}`,
            `spotify_refresh_token=${tokens.refresh_token}; ${cookieOptions}; Max-Age=31536000`,
            `spotify_token_expires=${expiresAt}; ${cookieOptions}; Max-Age=${tokens.expires_in}`,
            `spotify_auth_state=; ${cookieOptions}; Max-Age=0` // Clear state cookie
        ]);

        // Redirect back to main site with success indicator
        res.redirect('/?spotify=connected');

    } catch (error) {
        console.error('Spotify auth error:', error);
        res.redirect('/?error=auth_failed');
    }
}

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.split('=');
        if (name && rest.length) {
            cookies[name.trim()] = rest.join('=').trim();
        }
    });

    return cookies;
}
