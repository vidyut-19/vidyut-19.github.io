// Local development server for testing Spotify OAuth
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(__dirname));

// Helper to parse cookies
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

// Generate random string for state
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Login endpoint
app.get('/api/spotify/login', (req, res) => {
    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
    const SCOPES = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-read-recently-played'
    ].join(' ');

    const state = generateRandomString(16);
    res.cookie('spotify_auth_state', state, { httpOnly: true, maxAge: 3600000 });

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
});

// Callback endpoint
app.get('/api/spotify/callback', async (req, res) => {
    const { code, state } = req.query;
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

        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        res.cookie('spotify_access_token', tokens.access_token, { httpOnly: true, maxAge: tokens.expires_in * 1000 });
        res.cookie('spotify_refresh_token', tokens.refresh_token, { httpOnly: true, maxAge: 31536000000 });
        res.cookie('spotify_token_expires', expiresAt.toString(), { httpOnly: true, maxAge: tokens.expires_in * 1000 });

        res.redirect('/?spotify=connected');
    } catch (error) {
        console.error('Spotify auth error:', error);
        res.redirect('/?error=auth_failed');
    }
});

// Token endpoint
app.get('/api/spotify/token', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const accessToken = cookies.spotify_access_token;
    const refreshToken = cookies.spotify_refresh_token;
    const expiresAt = parseInt(cookies.spotify_token_expires || '0');

    if (!refreshToken) {
        return res.json({ authenticated: false });
    }

    if (!accessToken || Date.now() > expiresAt - 300000) {
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
            if (tokens.error) throw new Error(tokens.error_description);

            const newExpiresAt = Date.now() + (tokens.expires_in * 1000);
            res.cookie('spotify_access_token', tokens.access_token, { httpOnly: true, maxAge: tokens.expires_in * 1000 });
            res.cookie('spotify_token_expires', newExpiresAt.toString(), { httpOnly: true, maxAge: tokens.expires_in * 1000 });

            return res.json({ authenticated: true, token: tokens.access_token });
        } catch (error) {
            console.error('Token refresh error:', error);
            return res.json({ authenticated: false, error: 'refresh_failed' });
        }
    }

    return res.json({ authenticated: true, token: accessToken });
});

// Now playing endpoint
app.get('/api/spotify/now-playing', async (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    let accessToken = cookies.spotify_access_token;
    const refreshToken = cookies.spotify_refresh_token;

    if (!refreshToken) {
        return res.json({ authenticated: false });
    }

    try {
        const spotifyResponse = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (spotifyResponse.status === 204) {
            return res.json({ isPlaying: false, authenticated: true });
        }

        if (!spotifyResponse.ok) {
            throw new Error(`Spotify API error: ${spotifyResponse.status}`);
        }

        const data = await spotifyResponse.json();

        return res.json({
            authenticated: true,
            isPlaying: data.is_playing,
            track: {
                name: data.item?.name,
                artist: data.item?.artists?.map(a => a.name).join(', '),
                album: data.item?.album?.name,
                albumArt: data.item?.album?.images?.[0]?.url,
                duration: data.item?.duration_ms,
                progress: data.progress_ms
            }
        });
    } catch (error) {
        console.error('Now playing error:', error);
        return res.status(500).json({ error: 'Failed to fetch now playing' });
    }
});

app.listen(PORT, () => {
    console.log(`\n🎵 Local server running at http://localhost:${PORT}`);
    console.log(`\n📝 Make sure you've added this redirect URI to Spotify Dashboard:`);
    console.log(`   http://localhost:${PORT}/api/spotify/callback\n`);
});
