// Redirects user to Spotify authorization page
export default function handler(req, res) {
    const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
    const SCOPES = [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-read-recently-played'
    ].join(' ');

    const state = generateRandomString(16);

    // Set state cookie for CSRF protection
    res.setHeader('Set-Cookie', `spotify_auth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/`);

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('state', state);

    res.redirect(authUrl.toString());
}

function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
