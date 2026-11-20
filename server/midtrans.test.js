import { describe, expect, test } from 'vitest';
import { createNotificationSignature, verifyNotificationSignature } from './midtrans.js';

describe('Midtrans notification signatures', () => {
  const notification = {
    order_id: 'ku-0123456789abcdef',
    status_code: '200',
    gross_amount: '2499000.00',
  };
  const serverKey = 'sandbox-server-key';

  test('accepts only a valid server-key signature', () => {
    const signature_key = createNotificationSignature({
      orderId: notification.order_id,
      statusCode: notification.status_code,
      grossAmount: notification.gross_amount,
      serverKey,
    });
    expect(verifyNotificationSignature({ ...notification, signature_key }, serverKey)).toBe(true);
    expect(verifyNotificationSignature({ ...notification, signature_key }, 'wrong-key')).toBe(false);
    expect(verifyNotificationSignature({ ...notification, gross_amount: '1.00', signature_key }, serverKey)).toBe(false);
  });

  test('rejects incomplete or malformed notifications', () => {
    expect(verifyNotificationSignature(notification, serverKey)).toBe(false);
    expect(verifyNotificationSignature({ ...notification, signature_key: 'bad' }, serverKey)).toBe(false);
  });
});
