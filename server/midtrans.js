import { createHash, timingSafeEqual } from 'node:crypto';

export function createNotificationSignature({ orderId, statusCode, grossAmount, serverKey }) {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

export function verifyNotificationSignature(notification, serverKey) {
  const { order_id: orderId, status_code: statusCode, gross_amount: grossAmount, signature_key: signature } = notification;
  if (!orderId || !statusCode || !grossAmount || !signature || !serverKey) return false;
  const expected = createNotificationSignature({ orderId, statusCode, grossAmount, serverKey });
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(String(signature));
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}
