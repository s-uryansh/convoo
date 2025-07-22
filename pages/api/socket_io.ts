import { NextApiRequest, NextApiResponse } from "next";
import { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import Message from "@/lib/models/Message";
import type { IMessage } from "@/types";
import dbConnect from "@/lib/dbConnect";

const EMPTY_ROOM_TTL = 5 * 60 * 1000;
const emptyTimers = new Map<string, NodeJS.Timeout>();
const socketUserMap = new Map<string, string>();
const roomUsernames = new Map<string, Set<string>>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse & { socket: { server: HTTPServer & { io?: IOServer } } }
) {
  await dbConnect();

  if (!res.socket || !res.socket.server || !res.socket.server.io) {
    if (!res.socket || !res.socket.server) {
      res.status(500).end("Socket server not available");
      return;
    }

    const httpServer: HTTPServer = res.socket.server as any;
    const io = new IOServer(httpServer, {
      path: "/api/socket_io",
      addTrailingSlash: false,
    });
    res.socket.server.io = io;

    io.on("connection", async (socket) => {
      const { roomId, username } = socket.handshake.query as {
        roomId?: string;
        username?: string;
      };

      if (!roomId || !username) {
        socket.disconnect(true);
        return;
      }

      const socketsInRoom = await io.in(roomId).fetchSockets();

      if (!roomUsernames.has(roomId)) {
        roomUsernames.set(roomId, new Set());
      }

      const currentUsers = roomUsernames.get(roomId)!;
      if (currentUsers.has(username)) {
        socket.emit("duplicate-username");
        socket.disconnect(true);
        return;
      }

      if (socketsInRoom.length >= 5) {
        socket.emit("room-full");
        socket.disconnect(true);
        return;
      }

      if (emptyTimers.has(roomId)) {
        clearTimeout(emptyTimers.get(roomId)!);
        emptyTimers.delete(roomId);
      }

      async function broadcastMembers(io: IOServer, roomId: string) {
        const sockets = await io.in(roomId).fetchSockets();
        const members = sockets
          .map((sock) => socketUserMap.get(sock.id))
          .filter((n): n is string => !!n);
        io.to(roomId).emit("members", members);
      }

      socket.join(roomId);
      socketUserMap.set(socket.id, username);
      socket.to(roomId).emit("user-joined", username);
      broadcastMembers(io, roomId);
      currentUsers.add(username);
      socketUserMap.set(socket.id, username);

      Message.find({ roomId })
        .sort({ createdAt: 1 })
        .limit(15)
        .then((msgs: IMessage[]) => {
          socket.emit("history", msgs);
        });

      socket.on("message", async (text: string) => {
        const msg = await Message.create({ roomId, sender: username, text });
        const count = await Message.countDocuments({ roomId });
        if (count > 15) {
          const toDelete = await Message.find({ roomId })
            .sort({ createdAt: 1 })
            .limit(count - 15);
          await Message.deleteMany({ _id: { $in: toDelete.map((m) => m._id) } });
        }
        io.to(roomId).emit("message", msg);
      });

      socket.on("disconnect", async () => {
        socket.leave(roomId);
        socketUserMap.delete(socket.id);
        const clients = await io.in(roomId).fetchSockets();
        if (clients.length === 0) {
          const timer = setTimeout(async () => {
            await import("@/lib/dbConnect").then((m) => m.default());
            await import("@/lib/models/Message")
              .then((m) => m.default)
              .then((Message) => Message.deleteMany({ roomId }));
            emptyTimers.delete(roomId);
          }, EMPTY_ROOM_TTL);
          emptyTimers.set(roomId, timer);
        } else {
          io.to(roomId).emit("user-left", username);
        }
        const usersInRoom = roomUsernames.get(roomId);
        if (usersInRoom) {
          usersInRoom.delete(username);
          if (usersInRoom.size === 0) {
            roomUsernames.delete(roomId);
          }
        }
        broadcastMembers(io, roomId);
      });
    });
  }

  res.end();
}
