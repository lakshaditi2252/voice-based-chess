import { motion } from "framer-motion";
import { FaRobot, FaUser } from "react-icons/fa";

export default function OpponentSelection({ selected }) {
  return (
    <div className="card-container">
      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`option-card ${selected === "human" ? "selected" : ""}`}
        style={{ pointerEvents: "none" }}
      >
        <FaUser className="icon" />
        <div className="card-title">Human</div>
        <p className="card-copy">Play locally and keep the experience fully voice-first.</p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.02 }}
        className={`option-card ${selected === "computer" ? "selected" : ""}`}
        style={{ pointerEvents: "none" }}
      >
        <FaRobot className="icon" />
        <div className="card-title">AI</div>
        <p className="card-copy">Challenge an engine with adaptive difficulty and voice guidance.</p>
      </motion.div>
    </div>
  );
}