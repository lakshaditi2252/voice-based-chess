const RELAY_URL =
  import.meta.env.VITE_VOICE_RELAY_URL ||
  "ws://localhost:3001";

// The API key belongs only on the relay.  This browser client only sends audio
// to the relay and receives transcripts back.
export function startDeepgram(onTranscript, onUnavailable = () => {}) {
  let socket;
  let recorder;
  let stream;
  let disposed = false;
  let unavailableReported = false;

  const reportUnavailable = (error) => {
    if (disposed || unavailableReported) {
      return;
    }

    unavailableReported = true;
    onUnavailable(error);
  };

  socket = new WebSocket(RELAY_URL);

  socket.onopen = () => {
    console.log("✅ Connected to voice relay");

    navigator.mediaDevices
      .getUserMedia({
        audio: true,
      })
      .then((mediaStream) => {
        stream = mediaStream;

        const mimeType = "audio/webm;codecs=opus";
        recorder = MediaRecorder.isTypeSupported(mimeType)
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
          if (
            event.data.size > 0 &&
            socket.readyState === WebSocket.OPEN
          ) {
            socket.send(event.data);
          }
        };

        // Smaller chunks keep the stream live and reduce time-to-transcript.
        recorder.start(50);
      })
      .catch((error) => {
        console.error("Microphone error:", error);
        reportUnavailable(error);
        socket.close();
      });
  };

  socket.onmessage = (message) => {
    let data;

    try {
      data = JSON.parse(message.data);
    } catch (error) {
      console.error("Invalid voice relay response:", error);
      return;
    }

    if (data.type === "transcript" && data.text) {
      onTranscript({
        text: data.text,
        isFinal: data.isFinal === true,
        speechFinal: data.speechFinal === true,
        confidence: data.confidence,
      });
    }

    if (data.type === "error") {
      console.error(data.message);
      reportUnavailable(new Error(data.message));
    }
  };

  socket.onerror = (e) => {
    console.error(e);
    reportUnavailable(e);
  };

  socket.onclose = () => {
    console.log("Voice relay closed");
    reportUnavailable(new Error("Voice relay connection closed."));
  };

  return () => {
    disposed = true;
    recorder?.stop();
    stream?.getTracks().forEach((track) => track.stop());
    socket?.close();
  };
}
