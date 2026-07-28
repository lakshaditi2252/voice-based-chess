import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";

import { playAudio } from "../services/audioPlayer";
import { StockfishEngine } from "../services/stockfishEngine";

function getGameMessage(chess) {
  if (chess.isCheckmate()) {
    return `${chess.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  }

  if (chess.isStalemate()) {
    return "Draw by stalemate";
  }

  if (chess.isThreefoldRepetition()) {
    return "Draw by threefold repetition";
  }

  if (chess.isInsufficientMaterial()) {
    return "Draw by insufficient material";
  }

  if (chess.isDraw()) {
    return "Draw";
  }

  const sideToMove = chess.turn() === "w" ? "White" : "Black";
  return chess.isCheck() ? `${sideToMove} to move — check` : `${sideToMove} to move`;
}

export default function ChessGame({
  opponent,
  difficulty,
  color,
}) {
  const [game, setGame] = useState(
    new Chess()
  );

  const [history, setHistory] =
    useState([]);

  const [message, setMessage] =
    useState("White to move");

  const {
    transcript,
    interimTranscript,
    finalTranscript,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    language: "en-US",
  });

  const displayTranscript =
    finalTranscript || interimTranscript || transcript ||
    "Waiting for your command...";

  const lastProcessedTranscript =
    useRef("");
  const gameRef = useRef(new Chess());

  const normalizeCommandText = useCallback((value) => {
    return value
      .toLowerCase()
      .replace(/[.,!?]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);
  const engineRef = useRef(null);
  const aiRequestRef = useRef(0);
  const [engineReady, setEngineReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const humanColor = color === "black" ? "b" : "w";
  const aiColor = humanColor === "w" ? "b" : "w";

  const gameInfo = useMemo(() => {
    const history = game.history();
    const turn = game.turn() === "w" ? "White" : "Black";
    const lastMove = history.length > 0 ? history[history.length - 1] : "—";
    const minutes = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const seconds = String(elapsedSeconds % 60).padStart(2, "0");

    return {
      turn,
      lastMove,
      time: `${minutes}:${seconds}`,
    };
  }, [elapsedSeconds, game]);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      if (gameRef.current.isGameOver()) {
        return;
      }

      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    if (opponent !== "computer") {
      return undefined;
    }

    let active = true;
    const engine = new StockfishEngine();
    engineRef.current = engine;

    engine.ready
      .then(() => {
        if (active) {
          setEngineReady(true);
        }
      })
      .catch((error) => {
        console.error("Stockfish failed to initialize:", error);
        if (active) {
          setMessage("AI engine is unavailable");
        }
      });

    return () => {
      active = false;
      aiRequestRef.current += 1;
      engine.dispose();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, [opponent]);

  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      console.warn(
        "Speech recognition is not supported in this browser."
      );
      return;
    }

    const handleAudioPlaybackState = (event) => {
      const isPlaying = Boolean(event.detail?.isPlaying);

      if (isPlaying) {
        SpeechRecognition.stopListening();
        return;
      }

      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
        language: "en-US",
      });
    };

    window.addEventListener("voice-audio-state", handleAudioPlaybackState);

    SpeechRecognition.startListening({
      continuous: true,
      interimResults: true,
      language: "en-US",
    });

    return () => {
      window.removeEventListener("voice-audio-state", handleAudioPlaybackState);
      SpeechRecognition.stopListening();
    };
  }, [browserSupportsSpeechRecognition]);

  const onDrop = useCallback(
    (sourceSquare, targetSquare) => {
      if (
        gameRef.current.isGameOver() ||
        (opponent === "computer" && gameRef.current.turn() !== humanColor)
      ) {
        playAudio("invalidMove");
        return false;
      }

      const gameCopy = new Chess(
        gameRef.current.fen()
      );

      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });

        if (!move) {
          playAudio("invalidMove");
          return false;
        }

        setHistory((prev) => [
          ...prev,
          gameRef.current.fen(),
        ]);

        setGame(gameCopy);
        gameRef.current = gameCopy;

        setMessage(getGameMessage(gameCopy));

        return true;
      } catch {
        playAudio("invalidMove");
        return false;
      }
    },
    [opponent, humanColor]
  );

  function parseVoiceMove(command) {
    const cleanedCommand = command
      .replace(/[.,!?]/g, "")
      .replace(/([a-h])\s+([1-8])/g, "$1$2")
      .replace(/\bmove\b/g, "")
      .replace(/\bfrom\b/g, "")
      .replace(/\bto\b/g, "")
      .replace(/\bthe\b/g, "")
      .trim();

    const squareMatches = [
      ...cleanedCommand.matchAll(
        /\b[a-h][1-8]\b/g
      ),
    ].map((match) => match[0]);

    if (squareMatches.length >= 2) {
      return {
        from: squareMatches[0],
        to: squareMatches[1],
      };
    }

    return null;
  }

  const newGame = useCallback(() => {
    aiRequestRef.current += 1;
    engineRef.current?.cancelSearch();
    const newChess = new Chess();

    setGame(newChess);
    gameRef.current = newChess;
    setElapsedSeconds(0);

    setHistory([]);

    setMessage(getGameMessage(newChess));

    playAudio("newGameStarted");
  }, []);

  const undoMove = useCallback(() => {
    if (history.length === 0) {
      playAudio("invalidMove");
      return;
    }

    const previousFen =
      history[history.length - 1];

    const restoredGame =
      new Chess(previousFen);

    setGame(restoredGame);
    gameRef.current = restoredGame;

    setHistory(
      history.slice(
        0,
        history.length - 1
      )
    );

    playAudio("undoSuccessful");
  }, [history]);

  useEffect(() => {
    if (
      opponent !== "computer" ||
      !engineReady ||
      !engineRef.current ||
      game.isGameOver() ||
      game.turn() !== aiColor
    ) {
      return undefined;
    }

    const positionFen = game.fen();
    const requestId = aiRequestRef.current + 1;
    aiRequestRef.current = requestId;
    let cancelled = false;

    const makeAiMove = async () => {
      setMessage("AI is thinking...");

      try {
        const bestMove = await engineRef.current.getBestMove(
          positionFen,
          difficulty
        );

        if (
          cancelled ||
          aiRequestRef.current !== requestId ||
          gameRef.current.fen() !== positionFen ||
          bestMove === "(none)"
        ) {
          return;
        }

        const gameCopy = new Chess(positionFen);
        const move = gameCopy.move({
          from: bestMove.slice(0, 2),
          to: bestMove.slice(2, 4),
          promotion: bestMove[4] || "q",
        });

        if (!move) {
          throw new Error("Stockfish returned an illegal move.");
        }

        setHistory((previousHistory) => [
          ...previousHistory,
          positionFen,
        ]);
        setGame(gameCopy);
        gameRef.current = gameCopy;
        setMessage(getGameMessage(gameCopy));
      } catch (error) {
        if (!cancelled && aiRequestRef.current === requestId) {
          console.error("AI move failed:", error);
          setMessage("AI could not make a move. Please start a new game.");
        }
      }
    };

    makeAiMove();

    return () => {
      cancelled = true;
      if (aiRequestRef.current === requestId) {
        aiRequestRef.current += 1;
        engineRef.current?.cancelSearch();
      }
    };
  }, [aiColor, difficulty, engineReady, game, opponent]);

  const handleVoiceCommand = useCallback(
    (commandText) => {
      const normalizedTranscript =
        commandText.trim();

      if (!normalizedTranscript) {
        return;
      }

      const command = normalizeCommandText(
        normalizedTranscript
      );

      if (!command) {
        return;
      }

      if (command === lastProcessedTranscript.current) {
        return;
      }

      lastProcessedTranscript.current = command;

      if (
        command.includes("new game") ||
        command.includes("restart")
      ) {
        newGame();
        return;
      }

      if (
        command.includes("undo") ||
        command.includes("take back")
      ) {
        undoMove();
        return;
      }

      const voiceMove = parseVoiceMove(
        command
      );

      if (voiceMove) {
        const moveApplied = onDrop(
          voiceMove.from,
          voiceMove.to
        );

        if (moveApplied) {
          playAudio("moveRecognized");
        }
      }
    },
    [newGame, normalizeCommandText, onDrop, undoMove]
  );

  useEffect(() => {
    const normalizedTranscript =
      (finalTranscript || interimTranscript || transcript).trim();

    if (!normalizedTranscript) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleVoiceCommand(normalizedTranscript);

    if (finalTranscript) {
      resetTranscript();
    }
  }, [finalTranscript, handleVoiceCommand, interimTranscript, resetTranscript, transcript]);
  const capturedPieces = useMemo(() => {
    const whiteCaptured = [];
    const blackCaptured = [];

    game.history({ verbose: true }).forEach((move) => {
      if (!move.captured) {
        return;
      }

      const capturedPiece = move.captured.toLowerCase();
      const pieceSymbol = {
        p: "♟",
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚",
      }[capturedPiece] || "•";

      if (move.color === "w") {
        blackCaptured.push(pieceSymbol);
      } else {
        whiteCaptured.push(pieceSymbol);
      }
    });

    return { white: whiteCaptured, black: blackCaptured };
  }, [game]);

  return (
    <div className="game-shell">
      <div className="game-status-row">
        <div className="status-pill status-pill-accent">{message}</div>
        <div className="status-pill">{opponent === "computer" ? "AI Opponent" : "Local Opponent"}</div>
      </div>

      <div className="board-stage">
        <aside className="captured-tray captured-tray-left">
          <div className="captured-title">White captured</div>
          <div className="captured-pieces">
            {capturedPieces.white.length > 0 ? (
              capturedPieces.white.map((piece, index) => (
                <span key={`${piece}-${index}`} className="captured-piece">
                  {piece}
                </span>
              ))
            ) : (
              <span className="captured-empty">No captures yet</span>
            )}
          </div>
        </aside>

        <div className="board-frame">
          <Chessboard
            boardOrientation={color === "black" ? "black" : "white"}
            position={game.fen()}
            onPieceDrop={onDrop}
          />
        </div>

        <aside className="game-sidebar">
          <div className="game-info-card">
            <div className="game-info-title">Game Info</div>

            <div className="game-info-row">
              <span>Turn</span>
              <strong>{gameInfo.turn}</strong>
            </div>

            <div className="game-info-row">
              <span>Move</span>
              <strong>{gameInfo.lastMove}</strong>
            </div>

            <div className="game-info-row">
              <span>Time</span>
              <strong>{gameInfo.time}</strong>
            </div>
          </div>

          <div className="captured-tray captured-tray-right">
            <div className="captured-title">Black captured</div>
            <div className="captured-pieces">
              {capturedPieces.black.length > 0 ? (
                capturedPieces.black.map((piece, index) => (
                  <span key={`${piece}-${index}`} className="captured-piece">
                    {piece}
                  </span>
                ))
              ) : (
                <span className="captured-empty">No captures yet</span>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
