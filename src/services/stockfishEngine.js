const ENGINE_URL = "/stockfish/stockfish-18-lite-single.js";

const DIFFICULTY_SETTINGS = {
  easy: { skillLevel: 2, moveTime: 120 },
  medium: { skillLevel: 10, moveTime: 400 },
  hard: { skillLevel: 20, moveTime: 900 },
};

export class StockfishEngine {
  constructor() {
    this.worker = new Worker(ENGINE_URL);
    this.pendingMove = null;
    this.ignoreNextBestMove = false;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.worker.onmessage = (event) => this.handleMessage(event.data);
    this.worker.onerror = (event) => {
      const error = new Error(event.message || "Stockfish worker failed to load.");
      this.rejectReady?.(error);
      this.rejectPendingMove(error);
    };

    this.send("uci");
  }

  send(command) {
    this.worker.postMessage(command);
  }

  handleMessage(rawLine) {
    const line = String(rawLine);

    if (line === "uciok") {
      this.send("isready");
      return;
    }

    if (line === "readyok") {
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }

    if (line.startsWith("bestmove ")) {
      if (this.ignoreNextBestMove) {
        this.ignoreNextBestMove = false;
        return;
      }

      const move = line.split(/\s+/)[1];
      const pendingMove = this.pendingMove;
      this.pendingMove = null;
      pendingMove?.resolve(move);
    }
  }

  async getBestMove(fen, difficulty) {
    await this.ready;
    this.cancelSearch();

    const settings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.medium;

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.cancelSearch();
        reject(new Error("Stockfish did not return a move in time."));
      }, settings.moveTime + 5000);

      this.pendingMove = {
        resolve: (move) => {
          window.clearTimeout(timeout);
          resolve(move);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      };

      this.send(`setoption name Skill Level value ${settings.skillLevel}`);
      this.send("ucinewgame");
      this.send("isready");
      this.send(`position fen ${fen}`);
      this.send(`go movetime ${settings.moveTime}`);
    });
  }

  rejectPendingMove(error) {
    const pendingMove = this.pendingMove;
    this.pendingMove = null;
    pendingMove?.reject(error);
  }

  cancelSearch() {
    if (this.pendingMove) {
      this.send("stop");
      // Stockfish acknowledges `stop` with a bestmove line. Do not let that
      // late result resolve the promise for the following position.
      this.ignoreNextBestMove = true;
      this.rejectPendingMove(new Error("Stockfish search cancelled."));
    }
  }

  dispose() {
    this.cancelSearch();
    this.worker.terminate();
  }
}
