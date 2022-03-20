import express from "express";
import { connection } from "../../../../util/mysql.js";
import { serverSpotifyApi, serverToken } from "../../../../util/spotify.js";

export const callbackRouter = express.Router();

const spotifyHandler = async (req, res) => {
  const { state, code } = req.query;
  const time = new Date();

  if (state !== process.env.SPOTIFY_STATE) return res.status(500).redirect("/");

  const authResponse = await serverSpotifyApi.authorizationCodeGrant(code);

  if (authResponse.statusCode !== 200) return res.status(500).redirect("/");

  const { access_token, expires_in, refresh_token } = authResponse.body;

  serverSpotifyApi.setAccessToken(access_token);
  serverSpotifyApi.setRefreshToken(refresh_token);

  time.setHours(time.getHours() + expires_in / 3600);
  serverToken.accessToken = access_token;
  serverToken.expires_at = time;

  connection.query(
    "INSERT INTO token(name, refreshToken, expires_at) VALUES(?, ?, ?)",
    [
      "serverRefreshToken",
      serverSpotifyApi.getRefreshToken(),
      serverToken.expires_at,
    ]
  );

  res.redirect("/");
};

callbackRouter.get("/spotify", spotifyHandler);
