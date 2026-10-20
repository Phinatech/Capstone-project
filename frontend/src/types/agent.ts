/** How a farmer settled up with the agent, in local currency. */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money'
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
