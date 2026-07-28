import { FaChessKing } from "react-icons/fa";

export default function ColorSelection() {
  return (
    <div className="card-container">
      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaChessKing className="icon" />
        <div className="card-title">White</div>
        <p className="card-copy">Open with the light side and keep the board aligned.</p>
      </div>

      <div className="option-card" style={{ pointerEvents: "none" }}>
        <FaChessKing className="icon" />
        <div className="card-title">Black</div>
        <p className="card-copy">Take the darker side and respond with confidence.</p>
      </div>
    </div>
  );
}