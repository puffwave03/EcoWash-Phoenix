export type PaymentProviderRequest = {
  amount: number;
  currency: string;
  idempotencyKey: string;
  orderId: string;
};

export type PaymentProviderResult = {
  externalStatus: string;
  provider: string;
  providerReference: string;
};

export interface PaymentProvider {
  confirmPayment(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
  createPaymentIntent(request: PaymentProviderRequest): Promise<PaymentProviderResult>;
  getStatus(providerReference: string): Promise<PaymentProviderResult>;
  refundPayment(providerReference: string, amount: number): Promise<PaymentProviderResult>;
}

// V1 records a business result produced outside Phoenix; it never handles card data.
export const MANUAL_CARD_PROVIDER = "manual";
