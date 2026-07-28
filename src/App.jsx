import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaChessKnight,
  FaMicrophone,
  FaRobot,
  FaSpinner,
  FaUser,
  FaVolumeUp,
  FaMousePointer,
  FaTrophy,
} from "react-icons/fa";

import "./VoiceChess.css";

import ChessGame from "./components/ChessGame";
import OpponentSelection from "./components/OpponentSelection";
import ModeSelection from "./components/ModeSelection";
import DifficultySelection from "./components/DifficultySelection";
import ColorSelection from "./components/ColorSelection";

import {
  playAudio,
  playAudioAndWait,
} from "./services/audioPlayer";
import { startDeepgram } from "./services/deepgramService";
import { resolveMenuSelection } from "./services/menuSelection";

export default function App() {
  const [screen, setScreen] = useState("welcome");

  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [heardText, setHeardText] = useState(
    "Waiting for your command..."
  );
  const [voiceUiState, setVoiceUiState] = useState("preparing");
  const [displayMessage, setDisplayMessage] = useState("");
  const screenRef = useRef(screen);
  const lastHandledCommandRef = useRef("");
  const recognitionRef = useRef(null);
  const voiceCleanupRef = useRef(() => {});
  const isListeningRef = useRef(false);
  const voiceTransitionTimeoutRef = useRef(null);
  const recentSelectionsRef = useRef(new Map());
  const listenerVersionRef = useRef(0);

  useEffect(() => {
    screenRef.current = screen;
    recentSelectionsRef.current.clear();
    lastHandledCommandRef.current = "";
  }, [screen]);

  const handleVoiceCommand = useCallback(
    (commandText, { allowFuzzy = true } = {}) => {
      const currentScreen = screenRef.current;
      const commandsByScreen = {
        opponent: ["human", "ai"],
        mode: ["voice", "mouse"],
        difficulty: ["easy", "medium", "hard"],
        color: ["white", "black"],
      };
      const selection = resolveMenuSelection({
        commandText,
        currentScreen,
        commandsByScreen,
        recentSelections: recentSelectionsRef.current,
        allowFuzzy,
        now: Date.now(),
      });

      if (!selection.shouldHandle) {
        return;
      }

      const command = selection.match.command;
      lastHandledCommandRef.current = `${currentScreen}:${command}`;

      if (currentScreen === "opponent") {
        if (command === "human") {
          setSelectedOpponent("human");
          playAudio("humanSelected");
          setScreen("mode");
          return;
        }

        if (command === "ai") {
          setSelectedOpponent("computer");
          setScreen("difficulty");
          return;
        }
      }

      if (currentScreen === "mode") {
        if (command === "voice") {
          setSelectedMode("voice");
          playAudio("voiceModeSelected");
          setScreen("color");
          return;
        }

        if (command === "mouse") {
          setSelectedMode("mouse");
          playAudio("mouseModeSelected");
          setScreen("color");
          return;
        }
      }

      if (currentScreen === "difficulty") {
        if (command === "easy") {
          setSelectedDifficulty("easy");
          setScreen("color");
          return;
        }

        if (command === "medium") {
          setSelectedDifficulty("medium");
          setScreen("color");
          return;
        }

        if (command === "hard") {
          setSelectedDifficulty("hard");
          setScreen("color");
          return;
        }
      }

      if (currentScreen === "color") {
        if (command === "white") {
          setSelectedColor("white");
          playAudio("gameStarted");
          setScreen("playing");
          return;
        }

        if (command === "black") {
          setSelectedColor("black");
          playAudio("gameStarted");
          setScreen("playing");
          return;
        }
      }
    },
    []
  );

  useEffect(() => {
    if (screen === "playing") {
      setDisplayMessage("");
      return;
    }

    let cancelled = false;

    const handleAudioState = (event) => {
      const isPlaying = Boolean(event.detail?.isPlaying);

      if (isPlaying) {
        setVoiceUiState("speaking");
        setDisplayMessage("Please wait while I finish speaking.");
        if (voiceTransitionTimeoutRef.current) {
          window.clearTimeout(voiceTransitionTimeoutRef.current);
          voiceTransitionTimeoutRef.current = null;
        }
        return;
      }

      if (screenRef.current === "welcome") {
        return;
      }

      setVoiceUiState("preparing");
      setDisplayMessage("I'm getting ready to listen. Please wait...");
      if (voiceTransitionTimeoutRef.current) {
        window.clearTimeout(voiceTransitionTimeoutRef.current);
      }

      voiceTransitionTimeoutRef.current = window.setTimeout(() => {
        if (!cancelled) {
          setVoiceUiState("listening");
          setDisplayMessage("Microphone is active and ready for your voice.");
        }
      }, 3000);
    };

    window.addEventListener("voice-audio-state", handleAudioState);
    const stopActiveListener = () => {
      isListeningRef.current = false;
      voiceCleanupRef.current();
      voiceCleanupRef.current = () => {};

      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };

    const prompts = {
      welcome: ["welcome"],
      opponent: ["chooseOpponent"],
      mode: ["chooseMode"],
      difficulty: ["chooseDifficulty"],
      color: ["chooseColor"],
    };
    let browserStream;
    let browserRecognition;
    let browserListenerStarted = false;
    const SpeechRecognitionCtor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    const startBrowserListening = async () => {
      if (browserListenerStarted || cancelled) {
        return;
      }

      browserListenerStarted = true;

      if (!SpeechRecognitionCtor) {
        console.warn(
          "Speech recognition is not supported in this browser."
        );
        return;
      }

      try {
        browserStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } catch (error) {
        console.warn(
          "Microphone permission is required for voice control.",
          error
        );
        return;
      }

      if (cancelled) {
        browserStream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recognition = new SpeechRecognitionCtor();
      browserRecognition = recognition;
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let commandText = "";
        let allowFuzzy = false;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const resultText = result[0].transcript.trim();

          if (!resultText) {
            continue;
          }

          commandText = resultText;
          allowFuzzy = result.isFinal;
        }

        if (!commandText) {
          return;
        }

        setHeardText(commandText);
        handleVoiceCommand(commandText, {
          allowFuzzy,
        });
      };

      recognition.onerror = (event) => {
        console.warn("Speech error:", event.error);
      };

      recognition.onend = () => {
        if (
          cancelled ||
          recognitionRef.current !== recognition ||
          !isListeningRef.current
        ) {
          return;
        }

        try {
          recognition.start();
        } catch {
          recognitionRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      isListeningRef.current = true;
      recognition.start();
    };

    const startVoiceListener = () => {
      const listenerVersion = listenerVersionRef.current + 1;
      listenerVersionRef.current = listenerVersion;

      const cleanup = startDeepgram((transcript) => {
        if (cancelled || listenerVersionRef.current !== listenerVersion) {
          return;
        }

        const commandText = transcript.text.trim();
        if (!commandText) {
          return;
        }

        setHeardText(commandText);
        handleVoiceCommand(commandText, {
          // Alias/exact command matches can be accepted immediately. Fuzzy
          // matching waits for Deepgram's stable result to avoid false picks.
          allowFuzzy: transcript.isFinal,
        });
      }, () => {
        // A local relay is optional during development. Browser speech keeps
        // onboarding usable whenever it is unavailable.
        cleanup();
        startBrowserListening();
      });

      voiceCleanupRef.current = () => {
        cleanup();
        browserRecognition?.stop();
        browserStream?.getTracks().forEach((track) => track.stop());
      };
      isListeningRef.current = true;
    };

    const announceOptionsThenListen = async () => {
      for (const prompt of prompts[screen] || []) {
        stopActiveListener();
        await playAudioAndWait(prompt);

        if (cancelled) {
          return;
        }

        if (screen === "welcome") {
          setScreen("opponent");
          return;
        }

        startVoiceListener();
      }
    };

    announceOptionsThenListen();

    return () => {
      cancelled = true;
      if (voiceTransitionTimeoutRef.current) {
        window.clearTimeout(voiceTransitionTimeoutRef.current);
        voiceTransitionTimeoutRef.current = null;
      }
      window.removeEventListener("voice-audio-state", handleAudioState);
      stopActiveListener();
    };
  }, [screen, handleVoiceCommand]);

  const voiceStateConfig = {
    speaking: {
      title: "Assistant Speaking...",
      subtitle: "Please wait while I finish speaking.",
      icon: <FaVolumeUp className="voice-state-icon speaking" />,
      accent: "speaking",
    },
    preparing: {
      title: "Preparing Microphone...",
      subtitle: "I'm getting ready to listen. Please wait...",
      icon: <FaSpinner className="voice-state-icon preparing" />,
      accent: "preparing",
    },
    listening: {
      title: "Speak Now",
      subtitle: "Microphone is active and ready for your voice.",
      icon: <FaMicrophone className="voice-state-icon listening" />,
      accent: "listening",
    },
  };

  const assistantState = voiceStateConfig[voiceUiState];

  const setupCopy = {
    welcome: {
      step: "1",
      eyebrow: "Welcome",
      title: "Let's set up your game.",
      body: displayMessage || "I'll guide you through a few quick choices.",
      cards: null,
    },
    opponent: {
      step: "2",
      eyebrow: "Choose Opponent",
      title: "Who would you like to play against?",
      body: displayMessage || "Would you like to play against Human or AI?",
      cards: <OpponentSelection selected={selectedOpponent} />,
    },
    mode: {
      step: "3",
      eyebrow: "Choose Mode",
      title: "How would you like to control the game?",
      body: displayMessage || "Would you like to use Voice or Mouse?",
      cards: <ModeSelection selected={selectedMode} />,
    },
    color: {
      step: "4",
      eyebrow: "Choose Color",
      title: "Which side would you like to play?",
      body: displayMessage || "Would you like to play as White or Black?",
      cards: <ColorSelection selected={selectedColor} />,
    },
    difficulty: {
      step: "5",
      eyebrow: "Choose Difficulty",
      title: "Choose your preferred difficulty.",
      body: displayMessage || "Choose your preferred difficulty.",
      cards: <DifficultySelection selected={selectedDifficulty} />,
    },
  };

  const currentSetup = setupCopy[screen] || setupCopy.welcome;

  const statusChips = [
    {
      label: selectedOpponent
        ? selectedOpponent === "human"
          ? "Human"
          : "AI"
        : "Opponent",
      icon: selectedOpponent === "human" ? <FaUser /> : <FaRobot />,
    },
    {
      label: selectedMode
        ? selectedMode === "voice"
          ? "Voice"
          : "Mouse"
        : "Mode",
      icon: selectedMode === "voice" ? <FaMicrophone /> : <FaMousePointer />,
    },
    {
      label: selectedColor
        ? selectedColor === "white"
          ? "White"
          : "Black"
        : "Color",
      icon: <FaChessKnight />,
    },
    {
      label: selectedDifficulty || "Difficulty",
      icon: <FaTrophy />,
    },
  ];

  return (
    <div className="app-shell">
      <motion.header
        className="hero-panel"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="hero-title-wrap">
          <div className="hero-ornament">
            <FaChessKnight />
          </div>
          <div>
            <h1 className="hero-title">Voice Chess</h1>
            <div className="hero-line">
              <span />
              <span className="hero-line-dot" />
              <span className="hero-line-label">Accessibility First Chess</span>
              <span className="hero-line-dot" />
              <span />
            </div>
          </div>
        </div>
        <p className="hero-subtitle">
          A premium voice-first chess experience designed as a polished accessibility product.
        </p>

        <div className="status-row">
          {statusChips.map((chip) => (
            <div key={chip.label} className="status-chip">
              <span className="status-chip-icon">{chip.icon}</span>
              <span>{chip.label}</span>
            </div>
          ))}
        </div>
      </motion.header>

      {screen === "playing" ? (
        <main className="game-page">
          <motion.section
            className="game-surface"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <ChessGame
              opponent={selectedOpponent}
              difficulty={selectedDifficulty}
              color={selectedColor}
            />
          </motion.section>
        </main>
      ) : (
        <AnimatePresence mode="wait">
          <motion.main
            key={screen}
            className="setup-page"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.38 }}
          >
            <section className="setup-intro-card">
              <div className="setup-step-pill">{currentSetup.step}</div>
              <div className="setup-intro-kicker">{currentSetup.eyebrow}</div>
              <div className="setup-intro-title">{currentSetup.title}</div>
              <div className="setup-intro-copy">{currentSetup.body}</div>
            </section>

            {currentSetup.cards && (
              <section className="setup-panel setup-panel-single active">
                <div className="setup-panel-body">{currentSetup.cards}</div>
              </section>
            )}
          </motion.main>
        </AnimatePresence>
      )}

      <motion.footer
        className={`assistant-dock ${voiceUiState}`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className={`assistant-dock-orb ${assistantState.accent}`}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={voiceUiState}
              className="assistant-dock-orb-icon"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {assistantState.icon}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="assistant-dock-body">
          <div className="assistant-dock-meta">
            <span className="assistant-dock-label">Voice Assistant</span>
            <span className="assistant-dock-state">{assistantState.title}</span>
          </div>

          <div className="assistant-dock-copy">{assistantState.subtitle}</div>

          <div className="assistant-dock-waveform" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="assistant-dock-transcript">{heardText}</div>
        </div>

        <div className="assistant-dock-cancel">Cancel</div>
      </motion.footer>
    </div>
  );
}
