import { WebSocketServer, WebSocket } from "ws";
import "dotenv/config";

const PORT = Number(process.env.VOICE_SERVER_PORT || 3001);
const API_KEY = process.env.DEEPGRAM_API_KEY;
const COMMAND_KEYTERMS = [
  "human",
  "AI",
  "voice",
  "mouse",
  "easy",
  "medium",
  "hard",
  "white",
  "black",
];

if (!API_KEY) {
  console.error("Missing DEEPGRAM_API_KEY in the environment.");
  process.exit(1);
}

const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`Voice relay listening on ws://localhost:${PORT}`);
});

function createDeepgramSocket(browserSocket, pendingAudio) {
  const listenUrl = new URL("wss://api.deepgram.com/v1/listen");
  listenUrl.searchParams.set("model", "nova-3");
  listenUrl.searchParams.set("language", "en-US");
  listenUrl.searchParams.set("punctuate", "false");
  listenUrl.searchParams.set("interim_results", "true");
  listenUrl.searchParams.set("endpointing", "80");
  COMMAND_KEYTERMS.forEach((keyterm) => {
    listenUrl.searchParams.append("keyterm", keyterm);
  });

  const deepgramSocket = new WebSocket(
    listenUrl,
    ["token", API_KEY]
  );
  deepgramSocket.onopen = () => {
    console.log("Connected to Deepgram");
    pendingAudio.splice(0).forEach((audio) => {
      deepgramSocket.send(audio);
    });
  };

  deepgramSocket.onmessage = (event) => {
    const payload = JSON.parse(event.data.toString());
    const transcript =
      payload.channel?.alternatives?.[0]?.transcript?.trim();

    if (transcript && browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(
        JSON.stringify({
          type: "transcript",
          text: transcript,
          isFinal: payload.is_final === true,
          speechFinal: payload.speech_final === true,
          confidence: payload.channel?.alternatives?.[0]?.confidence,
        })
      );
    }
  };

  deepgramSocket.onerror = (error) => {
    console.error("Deepgram error:", error);
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(
        JSON.stringify({
          type: "error",
          message: "Deepgram speech backend is unavailable.",
        })
      );
    }
  };

  deepgramSocket.onclose = () => {
    console.log("Deepgram connection closed");
    if (browserSocket.readyState === WebSocket.OPEN) {
      browserSocket.send(
        JSON.stringify({
          type: "error",
          message: "Deepgram speech backend disconnected.",
        })
      );
    }
  };

  return deepgramSocket;
}

wss.on("connection", (browserSocket) => {
  console.log("Browser connected to voice relay");

  const pendingAudio = [];
  const deepgramSocket = createDeepgramSocket(browserSocket, pendingAudio);

  browserSocket.on("message", (message, isBinary) => {
    if (isBinary) {
      if (deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.send(message);
      } else if (deepgramSocket.readyState === WebSocket.CONNECTING) {
        // Do not lose the first spoken option while Deepgram is connecting.
        pendingAudio.push(message);
        if (pendingAudio.length > 32) {
          pendingAudio.shift();
        }
      }
      return;
    }

    const payload = message.toString();
    if (payload === "start") {
      return;
    }
  });

  browserSocket.on("close", () => {
    if (deepgramSocket.readyState === WebSocket.OPEN || deepgramSocket.readyState === WebSocket.CONNECTING) {
      deepgramSocket.close();
    }
  });
});
