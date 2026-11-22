import { describe, expect, test } from 'vitest';
import {
  createNotificationSignature,
  midtransFailureMessage,
  resolveMidtransEnvironment,
  verifyNotificationSignature,
} from './midtrans.js';

describe('Midtrans notification signatures', () => {
  test('selects the API environment that matches the server key prefix', () => {
    expect(resolveMidtransEnvironment('SB-Mid-server-example', 'production')).toBe('sandbox');
    expect(resolveMidtransEnvironment('Mid-server-example', 'sandbox')).toBe('production');
    expect(resolveMidtransEnvironment('unrecognized-key', 'production')).toBe('production');
  });

  describe('Midtrans Snap failures', () => {
    test('explains rejected credentials without exposing provider response details', () => {
      expect(midtransFailureMessage(401, '{"error_messages":["Unauthorized"]}'))
        .toContain('MIDTRANS_SERVER_KEY');
    });

    test('surfaces provider validation errors in a bounded message', () => {
      expect(midtransFailureMessage(400, '{"error_messages":["transaction_details is invalid"]}'))
        .toBe('Midtrans menolak detail transaksi: transaction_details is invalid');
      expect(midtransFailureMessage(502, '<html>gateway error</html>'))
        .toContain('HTTP 502');
    });
  });
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
