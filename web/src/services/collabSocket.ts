import { io, Socket } from "socket.io-client";
import { API_BASE } from "../config";

let collabSocket: Socket | null = null;
let _authenticatedUserId: string | null = null;

export function getCollabSocket(): Socket {
  if (!collabSocket) {
    const token = localStorage.getItem("lc_token");
    collabSocket = io(`${API_BASE}/collab`, {
      transports: ["websocket", "polling"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: token ? { token } : undefined,
    });

    // Re-authenticate on reconnect
    collabSocket.on("connect", () => {
      if (_authenticatedUserId) {
        collabSocket!.emit("auth", { userId: _authenticatedUserId }, (response: any) => {
          if (!response.ok) {
            console.error("Re-auth failed after reconnect:", response.error);
          }
        });
      }
    });
  }
  return collabSocket;
}

export function connectCollab(userId: string): Promise<any> {
  const socket = getCollabSocket();
  _authenticatedUserId = userId;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Auth timeout: sunucu yanıt vermedi"));
    }, 10000);

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("auth", { userId }, (response: any) => {
      clearTimeout(timeout);
      if (response.ok) {
        resolve(response.profile);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

export function disconnectCollab(): void {
  _authenticatedUserId = null;
  if (collabSocket) {
    collabSocket.disconnect();
    collabSocket = null;
  }
}

export function getAuthenticatedUserId(): string | null {
  return _authenticatedUserId;
}
