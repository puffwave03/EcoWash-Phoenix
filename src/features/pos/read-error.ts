export class PosReadError extends Error {
  constructor() {
    super("POS data is unavailable");
    this.name = "PosReadError";
  }
}
