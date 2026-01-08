// Returns current token status and refreshes if needed
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    const cookies = parseCookies(req.headers.cookie || '');
    const accessToken = cookies.spotify_access_token;
    const refreshToken = cookies.spotify_refresh_token;
    const expiresAt = parseInt(cookies.spotify_token_expires || '0');

    if (!refreshToken) {
        return res.status(200).json({ authenticated: false });
    }

    // Check if token needs refresh (5 minute buffer)
    if (!accessToken || Date.now() > expiresAt - 300000) {
        // Refresh the token
        const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
        const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

        try {
            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            });

            const tokens = await tokenResponse.json();

            if (tokens.error) {
                throw new Error(tokens.error_description);
            }

            const newExpiresAt = Date.now() + (tokens.expires_in * 1000);
            const cookieOptions = 'HttpOnly; Secure; SameSite=Lax; Path=/';

            res.setHeader('Set-Cookie', [
                `spotify_access_token=${tokens.access_token}; ${cookieOptions}; Max-Age=${tokens.expires_in}`,
                `spotify_token_expires=${newExpiresAt}; ${cookieOptions}; Max-Age=${tokens.expires_in}`,
                // Update refresh token if a new one was provided
                ...(tokens.refresh_token ? [`spotify_refresh_token=${tokens.refresh_token}; ${cookieOptions}; Max-Age=31536000`] : [])
            ]);

            return res.status(200).json({
                authenticated: true,
                token: tokens.access_token
            });

        } catch (error) {
            console.error('Token refresh error:', error);
            return res.status(200).json({ authenticated: false, error: 'refresh_failed' });
        }
    }

    return res.status(200).json({
        authenticated: true,
        token: accessToken
    });
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
