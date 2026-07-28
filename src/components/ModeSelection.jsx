import { FaMicrophone, FaMousePointer } from "react-icons/fa";

export default function ModeSelection() {
  return (
    <div className="card-container">
      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaMicrophone className="icon" />
        <div className="card-title">Voice</div>
        <p className="card-copy">Speak commands naturally and keep hands free.</p>
      </div>

      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaMousePointer className="icon" />
        <div className="card-title">Mouse</div>
        <p className="card-copy">Use direct interaction when you prefer tactile control.</p>
      </div>
    </div>
  );
}