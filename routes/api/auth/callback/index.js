import express from "express";
import { connection } from "../../../../util/mysql.js";
import { serverSpotifyApi, serverToken } from "../../../../util/spotify.js";

export const callbackRouter = express.Router();

const handleQuery = async ({ refreshToken, expires_at }) => {
  const [existRows, existfields] = await connection.query(
    "SELECT * FROM token WHERE name=?",
    ["serverRefreshToken"]
  );

  if (existRows.length !== 0) {
    const [updateRows, updateFields] = await connection.query(
      "UPDATE token SET refreshToken=?, expires_at=?",
      [refreshToken, expires_at]
    );
  } else {
    const [addRows, addFields] = await connection.query(
      "INSERT INTO token (name, refreshToken, expires_at) VALUES(?, ?, ?)",
      ["serverRefreshToken", refreshToken, expires_at]
    );
  }
};

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

  handleQuery({
    refreshToken: refresh_token,
    expires_at: serverToken.expires_at,
  });

  res.redirect("/");
};

callbackRouter.get("/spotify", spotifyHandler);
