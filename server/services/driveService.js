// Google Drive backup integration using the OAuth2 Authorization Code flow and
// Drive v3 REST API. Uses Node 18+ global fetch only — NO googleapis dependency.
//
// Required env vars (admin must set these to enable Drive backup):
//   GOOGLE_CLIENT_ID      - OAuth 2.0 client id
//   GOOGLE_CLIENT_SECRET  - OAuth 2.0 client secret
//   GOOGLE_REDIRECT_URI   - (optional) override redirect URI; defaults to
//                           (CLIENT_URL || http://localhost:3000) + '/backup/drive'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const USERINFO_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

const getRedirectUri = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  ((process.env.CLIENT_URL || 'http://localhost:3000') + '/backup/drive');

const isConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

// Build the Google OAuth consent URL. offline access + consent prompt so we
// always receive a refresh_token.
const getAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: `${DRIVE_SCOPE} ${USERINFO_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });
  return `${AUTH_URL}?${params.toString()}`;
};

// Exchange an authorization code for tokens + the user's email.
const exchangeCode = async (code) => {
  if (!code) {
    const err = new Error('Authorization code is required');
    err.statusCode = 400;
    throw err;
  }
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${data.error_description || data.error || res.status}`);
  }
  if (!data.refresh_token) {
    throw new Error('Google did not return a refresh token. Revoke prior access and reconnect with consent.');
  }

  let email = null;
  try {
    email = await getUserEmail(data.access_token);
  } catch (_) {
    // Email is best-effort; token exchange already succeeded.
  }

  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    email,
  };
};

const getUserEmail = async (accessToken) => {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Failed to fetch Google user info: ${data.error_description || data.error || res.status}`);
  }
  return data.email || null;
};

// Obtain a fresh access token from a stored refresh token.
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    const err = new Error('No refresh token available');
    err.statusCode = 400;
    throw err;
  }
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${data.error_description || data.error || res.status}`);
  }
  return data.access_token;
};

// Multipart upload of a JSON string to Drive. Returns the created file id.
const uploadBackup = async (accessToken, filename, jsonString) => {
  if (!accessToken) throw new Error('Access token is required for upload');
  const boundary = `vyapar_backup_${Date.now()}`;
  const metadata = {
    name: filename,
    mimeType: 'application/json',
  };

  const multipartBody =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    `${jsonString}\r\n` +
    `--${boundary}--`;

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Google Drive upload failed: ${(data.error && data.error.message) || res.status}`);
  }
  return data.id;
};

module.exports = {
  isConfigured,
  getRedirectUri,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  uploadBackup,
  getUserEmail,
};
