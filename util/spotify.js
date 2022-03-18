import SpotifyWebApi from "spotify-web-api-node";

export const guestSpotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export const serverSpotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: "http://localhost:4000/api/auth/callback/spotify/",
});

export const guestToken = {};

export const serverToken = {};

const setupGuestAccess = async () => {
  const response = await guestSpotifyApi.clientCredentialsGrant();

  if (response.statusCode !== 200) {
    return console.error("Error with getting access token for spotify");
  }

  guestToken.access_token = response.body.access_token;
  guestToken.expires_at = Date.now() / 1000 + response.body.expires_in;

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

export const spotifyInit = async () => {
  setupGuestAccess();
  setupServerAccess();
};
