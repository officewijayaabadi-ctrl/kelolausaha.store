import { createHash, timingSafeEqual } from 'node:crypto';

export function resolveMidtransEnvironment(serverKey, configuredEnvironment = '') {
  const key = String(serverKey || '').trim();
  if (key.startsWith('SB-Mid-server-')) return 'sandbox';
  if (key.startsWith('Mid-server-')) return 'production';
  return String(configuredEnvironment).trim().toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';
}

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

export function midtransFailureMessage(status, responseBody) {
  let providerMessages = [];
  try {
    const body = JSON.parse(responseBody);
    if (Array.isArray(body.error_messages)) {
      providerMessages = body.error_messages
        .filter((message) => typeof message === 'string')
        .map((message) => message.replace(/[\u0000-\u001f]/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 3);
    }
  } catch {
    providerMessages = [];
  }
  if (status === 401 || status === 403) {
    return 'Kredensial Midtrans ditolak. Pastikan MIDTRANS_SERVER_KEY dan MIDTRANS_ENV sesuai.';
  }
  if (providerMessages.length) {
    return `Midtrans menolak detail transaksi: ${providerMessages.join('; ').slice(0, 400)}`;
  }
  return `Midtrans gagal membuat pembayaran (HTTP ${status}). Periksa konfigurasi Midtrans atau coba lagi.`;
}
