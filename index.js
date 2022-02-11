import express from "express";

import { createServer } from "http";
import { Server } from "socket.io";

import { PORT, CORSORIGIN } from "./config.js";

import { registerSpotifyHandlers } from "./socket/spotify/spotifySocket.js";

import { generateInviteToRoomKey } from "./socket/spotify/spotifyRooms.js";

import { roomsRouter } from "./routes/api/spotify/room.js";

const app = express();
const httpServer = createServer(app);

app.use("/api/spotify/room/", roomsRouter);
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

app.get("/", (req, res) => {
  res.send("Home Page");
});

app.get("*", (req, res) => {
  const url = req.url;
  res.status(404).send(`"${url}" is not a valid path`);
});

httpServer.listen(PORT, () => {
  console.log(`Server Listening ${PORT}`);
  generateInviteToRoomKey();
});
