import EVENTS from "./spotifyEvents.js";
import { rooms } from "./spotifyRooms.js";

export const newHostInit = (newHostSocket, roomID) => {
  if (!newHostSocket || !roomID) return;

  const setRoomPlaylist = ({ playlistID, snapshotID }) => {
    rooms[roomID].playlist.snapshotID = snapshotID;
  };

  const playlistID = rooms[String(roomID)].playlist.playlistID;

  newHostSocket.emit(EVENTS.SERVER.HOST_INIT, { playlistID }, setRoomPlaylist);

  rooms[roomID].host.socket_id = newHostSocket.id;
  newHostSocket.data.user.host = true;
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
