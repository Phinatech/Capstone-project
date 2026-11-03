/** How a farmer settled up with the agent, in local currency. */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'mobile_money';

/** Translation keys; render with t(). */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, 'payment.cash' | 'payment.bank_transfer' | 'payment.mobile_money'> = {
  cash: 'payment.cash',
  bank_transfer: 'payment.bank_transfer',
  mobile_money: 'payment.mobile_money'
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];
