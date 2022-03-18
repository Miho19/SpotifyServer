import express from "express";
import { rooms } from "../../../../socket/spotify/spotifyRooms.js";

export const roomsRouter = express.Router();

/**
 * Route for /api/spotify/room/
 *
 */

const getRooms = (req, res) => {
  let newRooms = [];

  Object.keys(rooms).forEach((roomID) => {
    const room = rooms[roomID];

    const memberList = [...room.members].map((member) => member.name);

    const roomData = {
      name: room.name,
      members: room.totalMembers,
      playlistID: room.playlist.playlistID,
      memberList: memberList,
    };

    newRooms.push(roomData);
  });

  res.status(200).json({ success: true, data: [{ roomList: newRooms }] });
};

const getRoom = (req, res) => {
  const { roomID } = req.params;

  if (!roomID) return res.status(400).json({ success: false, data: [] });

  const room = rooms[String(roomID)];

  if (!room) return res.status(404).json({ success: false, data: [] });

  const memberList = [...room.members].map((member) => {
    return {
      uesrName: member.name,
    };
  });

  const roomData = {
    name: room.name,
    members: room.totalMembers,
    playlist: room.playlist.playlistID,
    hostID: room.host.socket_id,
    links: room.inviteLinks.length,
    memberList: memberList,
  };

  res.status(202).json({ success: true, data: [roomData] });
};

const getMembers = (req, res) => {
  const { roomID } = req.params;
  if (!roomID) return res.status(400).json({ success: false, data: [] });

  const room = rooms[String(roomID)];

  if (!room) return res.status(404).json({ success: false, data: [] });

  const memberList = [...room.members].map((member) => {
    return {
      uesrName: member.name,
      id: member.socketID,
    };
  });

  return res.status(202).json({ success: true, data: memberList });
};

const getMember = (req, res) => {
  const { roomID, memberID } = req.params;

  if (!roomID || !memberID)
    return res.status(400).json({ success: false, data: [] });

  const room = rooms[String(roomID)];

  if (!room) return res.status(404).json({ success: false, data: [] });

  const memberList = [...room.members];

  const user = memberList.find(
    (member) => member.socketID === String(memberID)
  );

  if (!user) return res.status(404).json({ success: false, data: [] });

  res.status(200).json({ success: true, data: [user] });
};

roomsRouter.get("/", getRooms);
roomsRouter.get("/:roomID", getRoom);
roomsRouter.get("/:roomID/member", getMembers);
roomsRouter.get("/:roomID/member/:memberID", getMember);
