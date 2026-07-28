import Welcome from "../assets/audio/Welcome.m4a.mp4";
import ChooseOpponent from "../assets/audio/ChooseOpponent.m4a.mp4";
import ChooseMode from "../assets/audio/Choose_mode.m4a.mp4";
import ChooseColor from "../assets/audio/Choose_color.m4a.mp4";
import ChooseDifficulty from "../assets/audio/Choose_difficulty.m4a.mp4";
import GameStarted from "../assets/audio/Game_started.m4a.mp4";
import HumanSelected from "../assets/audio/Human_selected.m4a.mp4";
import VoiceModeSelected from "../assets/audio/Voice_mode_selected.m4a.mp4";
import MouseModeSelected from "../assets/audio/Mouse_mode_selected.m4a.mp4";
import NewGameStarted from "../assets/audio/New_game_started.m4a.mp4";
import UndoSuccessful from "../assets/audio/Undo_successful.m4a.mp4";
import InvalidMove from "../assets/audio/Invalid_move.m4a.mp4";
import Listening from "../assets/audio/Listening.m4a.mp4";
import MoveRecognized from "../assets/audio/Move_recognized.m4a.mp4";
import Check from "../assets/audio/Check.m4a.mp4";
import Checkmate from "../assets/audio/Checkmate.m4a.mp4";

const audioFiles = {
  welcome: Welcome,
  chooseOpponent: ChooseOpponent,
  chooseMode: ChooseMode,
  chooseColor: ChooseColor,
  chooseDifficulty: ChooseDifficulty,
  gameStarted: GameStarted,
  humanSelected: HumanSelected,
  voiceModeSelected: VoiceModeSelected,
  mouseModeSelected: MouseModeSelected,
  newGameStarted: NewGameStarted,
  undoSuccessful: UndoSuccessful,
  invalidMove: InvalidMove,
  listening: Listening,
  moveRecognized: MoveRecognized,
  check: Check,
  checkmate: Checkmate,
};

let audioQueue = [];
let isPlaying = false;
let isAudioPlaybackActive = false;

function updateAudioPlaybackState(nextState) {
  if (isAudioPlaybackActive === nextState) {
    return;
  }

  isAudioPlaybackActive = nextState;

  window.dispatchEvent(
    new CustomEvent("voice-audio-state", {
      detail: { isPlaying: nextState },
    })
  );
}

export function playAudio(name) {
  enqueueAudio(name);
}

// Use this for prompts that must finish before the microphone is opened.
export function playAudioAndWait(name) {
  return new Promise((resolve) => {
    enqueueAudio(name, resolve);
  });
}

function enqueueAudio(name, onComplete = () => {}) {
  const file = audioFiles[name];

  if (!file) {
    console.log("Audio not found:", name);
    onComplete();
    return;
  }

  audioQueue.push({ file, onComplete });

  if (!isAudioPlaybackActive) {
    updateAudioPlaybackState(true);
  }

  if (!isPlaying) {
    playNextAudio();
  }
}

function playNextAudio() {
  if (audioQueue.length === 0) {
    isPlaying = false;
    updateAudioPlaybackState(false);
    return;
  }

  isPlaying = true;

  const { file, onComplete } = audioQueue.shift();

  const audio = new Audio(file);

  audio.onended = () => {
    onComplete();
    playNextAudio();
  };

  audio.play().catch((err) => {
    console.error(err);
    onComplete();
    playNextAudio();
  });
}
