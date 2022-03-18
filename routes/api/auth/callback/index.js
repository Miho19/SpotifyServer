import express from "express";
import { serverSpotifyApi, serverToken } from "../../../../util/spotify.js";

export const callbackRouter = express.Router();

const spotifyHandler = async (req, res) => {
  const { state, code } = req.query;

  if (state !== process.env.SPOTIFY_STATE) return res.status(500).redirect("/");

  const authResponse = await serverSpotifyApi.authorizationCodeGrant(code);

  if (authResponse.statusCode !== 200) return res.status(500).redirect("/");

  const { access_token, expires_in, refresh_token } = authResponse.body;

  serverSpotifyApi.setAccessToken(access_token);
  serverSpotifyApi.setRefreshToken(refresh_token);

  serverToken.accessToken = access_token;
  serverToken.expires_in = expires_in;

  res.redirect("/");
};

callbackRouter.get("/spotify", spotifyHandler);
