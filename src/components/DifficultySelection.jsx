import { FaBolt, FaBalanceScale, FaRocket } from "react-icons/fa";

export default function DifficultySelection() {
  return (
    <div className="card-container">
      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaBolt className="icon" />
        <div className="card-title">Easy</div>
        <p className="card-copy">Gentle pacing for a relaxed learning flow.</p>
      </div>

      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaBalanceScale className="icon" />
        <div className="card-title">Medium</div>
        <p className="card-copy">Balanced challenge for focused, steady play.</p>
      </div>

      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaRocket className="icon" />
        <div className="card-title">Hard</div>
        <p className="card-copy">Sharper responses for experienced players.</p>
      </div>
    </div>
  );
}