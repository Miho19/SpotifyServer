import SpotifyWebApi from "spotify-web-api-node";

import { connection } from "./mysql.js";

export const guestSpotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

const redirectURI =
  process.env.NODE_ENV === "production"
    ? `https://spotifyserver1.herokuapp.com/api/auth/callback/spotify/`
    : "http://localhost:4000/api/auth/callback/spotify/";

export const serverSpotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: redirectURI,
});

export const guestToken = {};

export const serverToken = {};

const setupGuestAccess = async (time) => {
  const response = await guestSpotifyApi.clientCredentialsGrant();

  if (response.statusCode !== 200) {
    return console.error("Error with getting access token for spotify");
  }

  guestToken.access_token = response.body.access_token;
  guestToken.expires_at = time.setHours(
    time.getHours() + response.body.expires_in / 3600
  );

  guestSpotifyApi.setAccessToken(response.body.access_token);
};

const setupServerAccess = async () => {
  /** permissions */
  const scopes = [
    "user-read-email",
    "user-read-playback-state",
    "user-read-currently-playing",
    "user-modify-playback-state",
    "user-read-recently-played",
    "user-follow-read",
    "user-read-private",
    "user-library-read",
    "user-top-read",
    "user-read-playback-position",
    "playlist-read-private",
    "playlist-read-collaborative",
    "playlist-modify-public",
    "playlist-modify-private",
    "streaming",
  ];

  const LOGIN_URL = serverSpotifyApi.createAuthorizeURL(
    scopes,
    process.env.SPOTIFY_STATE
  );

  console.log(LOGIN_URL);
};

const refreshServer = async (rows, time) => {
  const { id, name, refreshToken, expires_at } = rows[0];

  serverSpotifyApi.setRefreshToken(refreshToken);
  const refreshResponse = await serverSpotifyApi.refreshAccessToken();

  if (refreshResponse.statusCode !== 200)
    return console.log("Error getting refresh token");

  const { access_token, expires_in } = refreshResponse.body;

  serverToken.accessToken = access_token;
  time.setHours(time.getHours() + expires_in / 3600);
  serverToken.expires_at = time;

  serverSpotifyApi.setAccessToken(access_token);
};

export const spotifyInit = async () => {
  const [rows, fields] = await connection.query(
    "SELECT * from token WHERE name=?",
    ["serverRefreshToken"]
  );

  const time = new Date();

  setupGuestAccess(time);
  !rows.length ? setupServerAccess() : refreshServer(rows, time);
};
