import express from "express";

import { createServer } from "http";
import { Server } from "socket.io";

import { PORT, CORSORIGIN } from "./config.js";

import { registerSpotifyHandlers } from "./socket/spotify/spotifySocket.js";

import { generateInviteToRoomKey } from "./socket/spotify/spotifyRooms.js";

import { roomsRouter } from "./routes/api/v1/spotify/room.js";
import { guestRouter } from "./routes/api/v1/spotify/guest.js";
import { spotifyInit } from "./util/spotify.js";

import { callbackRouter } from "./routes/api/auth/callback/index.js";

import { connection } from "./util/mysql.js";

const app = express();
const httpServer = createServer(app);

app.use("/api/v1/spotify/room/", roomsRouter);
app.use("/api/v1/spotify/guest/", guestRouter);
app.use("/api/auth/callback/", callbackRouter);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: CORSORIGIN,
    credentials: true,
  },
});

const connectionHandler = (socket) => {
  registerSpotifyHandlers(io, socket);
};

io.on("connection", connectionHandler);

app.get("/", async (req, res) => {
  res.send("Home Page");
});

app.get("*", (req, res) => {
  const url = req.url;
  res.status(404).send(`"${url}" is not a valid path`);
});

httpServer.listen(PORT, () => {
  console.log(`Server Listening ${PORT}`);
  spotifyInit();
  generateInviteToRoomKey();
});
