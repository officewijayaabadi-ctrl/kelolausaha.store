import { expect, test, vi } from 'vitest';
import { processInboundSupportEmail } from './support-email.js';

const ticket = {
  id: 'ticket-id',
  ticket_number: 'KU-1234ABCD',
  requester_name: 'Rani',
  requester_email: 'rani@example.com',
  subject: 'Pertanyaan tentang usaha',
};

const ownerReply = {
  messageId: '<reply-1@example.com>',
  subject: 'Re: [KU-1234ABCD] Pertanyaan tentang usaha',
  text: 'Berikut solusi untuk pertanyaan Anda.',
  from: { value: [{ address: 'kelolausaha.store@gmail.com', name: 'Tim Support' }] },
};

function createPool(insertResult = { rowCount: 1, rows: [{ id: 'message-id', email_forwarded_at: null }] }) {
  return {
    query: vi.fn(async (query) => {
      const normalizedQuery = query.replace(/\s+/g, ' ').trim();
      if (normalizedQuery.startsWith('SELECT * FROM support_tickets')) {
        return { rowCount: 1, rows: [ticket] };
      }
      if (normalizedQuery.startsWith('INSERT INTO support_messages')) return insertResult;
      return { rowCount: 1, rows: [] };
    }),
  };
}

test('stores an email reply, forwards it to the requester, and marks it forwarded', async () => {
  const pool = createPool();
  const sendEmail = vi.fn().mockResolvedValue({});

  await processInboundSupportEmail({
    mailboxUser: 'kelolausaha.store@gmail.com',
    message: ownerReply,
    pool,
    sendEmail,
    supportEmail: 'kelolausaha.store@gmail.com',
    uid: 12,
  });

  expect(sendEmail).toHaveBeenCalledWith({
    to: ticket.requester_email,
    subject: `Balasan: ${ticket.subject}`,
    ticketNumber: ticket.ticket_number,
    text: expect.stringContaining(ownerReply.text),
  });
  expect(pool.query.mock.calls.some(([query]) => query.includes('email_forwarded_at = now()'))).toBe(true);
});

test('does not mark an email reply forwarded when delivery fails', async () => {
  const pool = createPool();
  const sendEmail = vi.fn().mockRejectedValue(new Error('SMTP delivery failed.'));

  await expect(processInboundSupportEmail({
    mailboxUser: 'kelolausaha.store@gmail.com',
    message: ownerReply,
    pool,
    sendEmail,
    supportEmail: 'kelolausaha.store@gmail.com',
    uid: 13,
  })).rejects.toThrow('SMTP delivery failed.');

  expect(pool.query.mock.calls.some(([query]) => query.includes('email_forwarded_at = now()'))).toBe(false);
});

test('imports a sent-folder reply as an outbound owner message without sending it again', async () => {
  const pool = createPool();
  const sendEmail = vi.fn();

  await processInboundSupportEmail({
    mailboxUser: 'kelolausaha.store@gmail.com',
    mailboxKind: 'sent',
    mailboxPath: '[Gmail]/Sent Mail',
    message: {
      ...ownerReply,
      to: { value: [{ address: ticket.requester_email }] },
    },
    pool,
    sendEmail,
    supportEmail: 'kelolausaha.store@gmail.com',
    uid: 15,
  });

  const insertCall = pool.query.mock.calls.find(([query]) => query.includes('INSERT INTO support_messages'));
  expect(insertCall[1]).toEqual([
    ticket.id,
    'owner',
    'Tim Support',
    'kelolausaha.store@gmail.com',
    ownerReply.text,
    ownerReply.messageId,
    'outbound',
  ]);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(pool.query.mock.calls.some(([query]) => query.includes('email_forwarded_at = now()'))).toBe(false);
});

test('ignores a sent-folder support email that was not addressed to the ticket requester', async () => {
  const pool = createPool();

  await processInboundSupportEmail({
    mailboxUser: 'kelolausaha.store@gmail.com',
    mailboxKind: 'sent',
    mailboxPath: '[Gmail]/Sent Mail',
    message: {
      ...ownerReply,
      to: { value: [{ address: 'kelolausaha.store@gmail.com' }] },
    },
    pool,
    sendEmail: vi.fn(),
    supportEmail: 'kelolausaha.store@gmail.com',
    uid: 16,
  });

  expect(pool.query.mock.calls.some(([query]) => query.includes('INSERT INTO support_messages'))).toBe(false);
});

test('ignores the original support notification sent to the support inbox', async () => {
  const pool = createPool();
  const sendEmail = vi.fn();

  await processInboundSupportEmail({
    mailboxUser: 'kelolausaha.store@gmail.com',
    message: {
      ...ownerReply,
      subject: '[KU-1234ABCD] Pertanyaan tentang usaha',
      text: 'Pesan awal dari pengguna.',
    },
    pool,
    sendEmail,
    supportEmail: 'kelolausaha.store@gmail.com',
    uid: 14,
  });

  expect(pool.query).not.toHaveBeenCalled();
  expect(sendEmail).not.toHaveBeenCalled();
});
