import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { PORT, CORSORIGIN } from "./config.js";

import { registerSpotifyHandlers } from "./socket/spotify/spotifySocket.js";

import { generateInviteToRoomKey } from "./socket/spotify/spotifyRooms.js";
const app = express();
const httpServer = createServer(app);

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

app.get("/", (req, res) => {
  res.send("successfull");
});

httpServer.listen(PORT, () => {
  console.log(`Server Listening ${PORT}`);
  generateInviteToRoomKey();
});
