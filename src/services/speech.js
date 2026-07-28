import SpeechRecognition from "react-speech-recognition";

export function speak(text) {
  SpeechRecognition.stopListening();
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onend = () => {
    window.requestAnimationFrame(() => {
      SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
        language: "en-US",
      });
    });
  };

  window.speechSynthesis.speak(utterance);
}