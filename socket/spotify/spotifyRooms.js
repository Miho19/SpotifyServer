import { v4 as uuid } from "uuid";
import Dayjs from "dayjs";

export const PLAYLISTID = "1qzGPv5E2rf7KIeE9wN27Y";

export const inviteLinkToRoomKey = {};

export const rooms = {
  1: {
    name: "Party House #1",
    totalMembers: 0,
    members: new Set(),
    playlist: {
      playlistID: PLAYLISTID,
      snapshotID: "",
    },

    host: {
      socket_id: "",
    },
    inviteLinks: [
      {
        linkID: uuid(),
        timeExpire: new Dayjs("2100-12-24T08:17:55+0000"),
      },
    ],
  },
};

export const generateInviteToRoomKey = () => {
  let numOfLinks = 0;

  Object.keys(rooms).forEach((roomID) => {
    rooms[roomID].inviteLinks.forEach((link) => {
      inviteLinkToRoomKey[link.linkID] = {
        roomID: roomID,
      };
      numOfLinks++;
    });
  });

  return numOfLinks;
};
