export default function AssistantPanel({
  message,
  transcript,
}) {
  return (
    <div className="assistant-box">
      <div className="assistant-title">
        🤖 Voice Assistant
      </div>

      <div
        style={{
          marginBottom: "20px",
        }}
      >
        {message}
      </div>

      <div
        style={{
          color: "#38bdf8",
        }}
      >
        🎤 Listening...
      </div>

      <div
        style={{
          marginTop: "10px",
          color: "#94a3b8",
        }}
      >
        You said:
        {" "}
        {transcript || "..."}
      </div>
    </div>
  );
}