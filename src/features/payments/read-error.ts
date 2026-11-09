export class PaymentReadError extends Error {
  constructor() {
    super("Order payment data is unavailable");
    this.name = "PaymentReadError";
  }
}
