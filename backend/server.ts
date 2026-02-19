import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketServer } from "socket.io";

import routes from "./routes/index";
import { setupSocketHandler } from "./socketHandler";
import { setupCollabNamespace } from "./socketHandler-v2";
import { errorHandler } from "./middleware/errorHandler";
import { startJobProcessor } from "./queues/jobProcessor";
import { connectDB } from "./config/database";

// ---- ENV check
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is missing. Please add it to backend/.env.");
  process.exit(1);
}

// ---- Express app
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// ---- Routes (all delegated to ./routes/)
app.use(routes);

// ---- Error handler (must be last middleware)
app.use(errorHandler);

// ---- HTTP server + Socket.IO
const PORT = Number(process.env.PORT || 4000);
const httpServer = http.createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: true, credentials: true },
});

app.set("io", io);

// ---- Socket.IO: legacy rooms
setupSocketHandler(io);

// ---- Socket.IO V2: /collab namespace
setupCollabNamespace(io);

// ---- Start job processor
startJobProcessor();

// ---- Connect to MongoDB (optional) then start server
connectDB().finally(() => {
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
});
