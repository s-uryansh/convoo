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
const connectionTimeouts = new Map<string, NodeJS.Timeout>();

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
      pingTimeout: 60000,
      pingInterval: 25000,
    });
    res.socket.server.io = io;

    io.on("connection", async (socket) => {
      const { roomId, username } = socket.handshake.query as {
        roomId?: string;
        username?: string;
      };

      console.log(`\n=== NEW CONNECTION ===`);
      console.log(`Socket ID: ${socket.id}`);
      console.log(`Username: ${username}`);
      console.log(`Room ID: ${roomId}`);
      console.log(`Timestamp: ${new Date().toISOString()}`);

      if (!roomId || !username) {
        console.log("❌ Missing roomId or username");
        socket.disconnect(true);
        return;
      }

      const connectionKey = `${roomId}-${username}`;
      
      if (connectionTimeouts.has(connectionKey)) {
        console.log(`❌ Rapid reconnection detected for ${username} in ${roomId}`);
        
        // --- CHANGE: Emitting a more specific event ---
        socket.emit("rapid-reconnection"); 
        
        socket.disconnect(true);
        return;
      }

      const timeout = setTimeout(() => {
        connectionTimeouts.delete(connectionKey);
      }, 2000); // 2 second cooldown
      connectionTimeouts.set(connectionKey, timeout);

      try {
        const socketsInRoom = await io.in(roomId).fetchSockets();
        console.log(`📊 Current sockets in room ${roomId}: ${socketsInRoom.length}`);

        if (socketsInRoom.length >= 5) {
          console.log(`❌ Room ${roomId} is full (${socketsInRoom.length}/5)`);
          socket.emit("room-full");
          socket.disconnect(true);
          return;
        }

        const connectedUsernames = new Set<string>();
        for (const sock of socketsInRoom) {
          const sockUsername = socketUserMap.get(sock.id);
          if (sockUsername) {
            connectedUsernames.add(sockUsername);
          }
        }

        console.log(`👥 Connected usernames in room:`, Array.from(connectedUsernames));

        if (connectedUsernames.has(username)) {
          console.log(`❌ Username '${username}' already exists in room ${roomId}`);
          socket.emit("duplicate-username");
          socket.disconnect(true);
          return;
        }

        if (emptyTimers.has(roomId)) {
          clearTimeout(emptyTimers.get(roomId)!);
          emptyTimers.delete(roomId);
          console.log(`⏰ Cleared empty room timer for ${roomId}`);
        }

        if (!roomUsernames.has(roomId)) {
          roomUsernames.set(roomId, new Set());
        }

        async function broadcastMembers(io: IOServer, roomId: string) {
          const sockets = await io.in(roomId).fetchSockets();
          const members = sockets
            .map((sock) => socketUserMap.get(sock.id))
            .filter((n): n is string => !!n);
          console.log(`📢 Broadcasting members for room ${roomId}:`, members);
          io.to(roomId).emit("members", members);
        }

        await socket.join(roomId);
        socketUserMap.set(socket.id, username);
        const roomUsers = roomUsernames.get(roomId)!;
        roomUsers.add(username);

        console.log(`✅ User '${username}' successfully joined room '${roomId}'`);
        console.log(`📋 Room users:`, Array.from(roomUsers));

        socket.to(roomId).emit("user-joined", username);
        await broadcastMembers(io, roomId);

        try {
          const msgs: IMessage[] = await Message.find({ roomId })
            .sort({ createdAt: 1 })
            .limit(15);
          socket.emit("history", msgs);
          console.log(`📜 Sent ${msgs.length} messages to ${username}`);
        } catch (error) {
          console.error("❌ Error fetching message history:", error);
        }

        socket.on("message", async (text: string) => {
          try {
            const msg = await Message.create({ roomId, sender: username, text });
            const count = await Message.countDocuments({ roomId });
            
            if (count > 15) {
              const toDelete = await Message.find({ roomId })
                .sort({ createdAt: 1 })
                .limit(count - 15);
              await Message.deleteMany({ _id: { $in: toDelete.map((m) => m._id) } });
            }
            
            io.to(roomId).emit("message", msg);
          } catch (error) {
            console.error("❌ Error handling message:", error);
          }
        });

        socket.on("webrtc-offer", ({ to, sdp }) => {
          console.log(`🔄 WebRTC offer from ${username} to ${to}`);
          socket.to(roomId).emit("webrtc-offer", { from: username, sdp });
        });

        socket.on("webrtc-answer", ({ to, sdp }) => {
          console.log(`🔄 WebRTC answer from ${username} to ${to}`);
          socket.to(roomId).emit("webrtc-answer", { from: username, sdp });
        });

        socket.on("webrtc-candidate", ({ to, candidate }) => {
          socket.to(roomId).emit("webrtc-candidate", { from: username, candidate });
        });

        socket.on("disconnect", async (reason) => {
          console.log(`\n=== DISCONNECT ===`);
          console.log(`User: ${username}`);
          console.log(`Room: ${roomId}`);
          console.log(`Reason: ${reason}`);
          console.log(`Socket ID: ${socket.id}`);
          
          socketUserMap.delete(socket.id);
          
          const usersInRoom = roomUsernames.get(roomId);
          if (usersInRoom) {
            usersInRoom.delete(username);
            console.log(`🗑️ Removed ${username} from room tracking`);
            
            if (usersInRoom.size === 0) {
              roomUsernames.delete(roomId);
              console.log(`🗑️ Room ${roomId} removed from tracking (empty)`);
            }
          }

          const connectionKey = `${roomId}-${username}`;
          if (connectionTimeouts.has(connectionKey)) {
            clearTimeout(connectionTimeouts.get(connectionKey)!);
            connectionTimeouts.delete(connectionKey);
          }

          try {
            const clients = await io.in(roomId).fetchSockets();
            
            if (clients.length === 0) {
              console.log(`🏠 Room ${roomId} is now empty, starting cleanup timer`);
              const timer = setTimeout(async () => {
                try {
                  await import("@/lib/dbConnect").then((m) => m.default());
                  await import("@/lib/models/Message")
                    .then((m) => m.default)
                    .then((Message) => Message.deleteMany({ roomId }));
                  emptyTimers.delete(roomId);
                  console.log(`🧹 Cleaned up messages for empty room ${roomId}`);
                } catch (error) {
                  console.error("❌ Error cleaning up empty room:", error);
                }
              }, EMPTY_ROOM_TTL);
              emptyTimers.set(roomId, timer);
            } else {
              socket.to(roomId).emit("user-left", username);
              await broadcastMembers(io, roomId);
            }
          } catch (error) {
            console.error("❌ Error handling disconnect cleanup:", error);
          }
        });

      } catch (error) {
        console.error("❌ Error in connection handler:", error);
        socket.emit("duplicate-username");
        socket.disconnect(true);
      }
    });
  }

  res.end();
}