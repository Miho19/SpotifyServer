import EVENTS from "./spotifyEvents.js";
import { rooms } from "./spotifyRooms.js";

export const newHostInit = (newHostSocket, roomID) => {
  if (!newHostSocket || !roomID) return;

  const errorCheckStartPlayer = (error = null) => {
    if (error === "PLAYER_FAILED") {
      rooms[roomID].playlist.snapshotID = "";
      rooms[roomID].host.socket_id = "";
      newHostSocket.data.user.host = false;
      return;
    }
  };

  const setRoomPlaylist = ({ playlistID, snapshotID }, error = null) => {
    if (error === "free") return;
    rooms[roomID].playlist.snapshotID = snapshotID;
    rooms[roomID].host.socket_id = newHostSocket.id;
    newHostSocket.data.user.host = true;
    newHostSocket.emit(
      EVENTS.SERVER.HOST_START_PLAYER,
      playlistID,
      errorCheckStartPlayer
    );
  };

  const playlistID = rooms[String(roomID)].playlist.playlistID;

  newHostSocket.emit(EVENTS.SERVER.HOST_INIT, { playlistID }, setRoomPlaylist);
};

export const removeMember = async (currentRoomID, userName, socket_id, io) => {
  if (!userName) return;
  if (!rooms[currentRoomID]) return;

  rooms[String(currentRoomID)].totalMembers -= 1;

  const newRoomMembers = [...rooms[String(currentRoomID)].members].filter(
    (member) => member.socketID !== socket_id
  );

  rooms[String(currentRoomID)].members = newRoomMembers
    ? new Set(newRoomMembers)
    : new Set();

  const hostID = rooms[currentRoomID].host.socket_id;

  if (socket_id !== hostID) return;
  const currentHost = io.sockets.sockets.get(socket_id);

  currentHost.emit(EVENTS.SERVER.CLIENT_SET_HOST, { host: false });
  rooms[currentRoomID].host.socket_id = "";
  console.log("removing host:", rooms[currentRoomID].host.socket_id);

  if (rooms[String(currentRoomID)].members.length < 1) return;

  const ids = await io.in(currentRoomID).allSockets();

  let newHostID = "";

  [...ids].forEach((id) => {
    if (newHostID === "" && socket_id !== id) {
      newHostID = id;
    }
  });

  rooms[currentRoomID].host.socket_id = newHostID;
  const newHost = io.sockets.sockets.get(newHostID);

  newHostInit(newHost, currentRoomID);
};

export const addMember = async (socket, roomID, user) => {
  rooms[roomID].totalMembers += 1;
  rooms[roomID].members.add({ ...user });

  if (rooms[roomID].host.socket_id === "") {
    newHostInit(socket, roomID);
  }

  socket.join(roomID);
};
