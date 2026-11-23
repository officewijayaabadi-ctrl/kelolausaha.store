export async function processInboundSupportEmail({
  mailboxUser,
  message,
  mailboxKind = 'inbox',
  mailboxPath = 'INBOX',
  pool,
  sendEmail,
  onMessage,
  supportEmail,
  uid,
}) {
  const combinedText = `${message.subject || ''}\n${message.text || ''}\n${message.html || ''}`;
  const ticketNumberMatch = combinedText.match(/KU-[A-F0-9]{8}/i);
  if (!ticketNumberMatch) return;

  const ticketNumber = ticketNumberMatch[0].toUpperCase();
  const senderEmail = message.from?.value?.[0]?.address?.toLowerCase()
    || supportEmail.toLowerCase();
  const isSupportReply = senderEmail === supportEmail.toLowerCase();
  const isSentMailbox = mailboxKind === 'sent';
  const isEmailReply = Boolean(message.inReplyTo || message.references?.length)
    || /^\s*(?:re|aw|sv):/i.test(message.subject || '');
  if (isSupportReply && !isSentMailbox && !isEmailReply) return;

  const ticketResult = await pool.query(
    'SELECT * FROM support_tickets WHERE ticket_number = $1',
    [ticketNumber],
  );
  if (!ticketResult.rowCount) return;

  const ticket = ticketResult.rows[0];
  if (isSupportReply && isSentMailbox) {
    const sentToRequester = message.to?.value?.some(
      (recipient) => recipient.address?.toLowerCase() === ticket.requester_email.toLowerCase(),
    );
    if (!sentToRequester && !isEmailReply) return;
  }

  const senderType = isSupportReply ? 'owner' : 'user';
  const body = String(message.text || message.html || '').trim().slice(0, 5000);
  if (!body) return;

  const emailMessageId = message.messageId || `${mailboxUser}:${mailboxPath}:${uid}`;
  const insertResult = await pool.query(`
    INSERT INTO support_messages (
      ticket_id, sender_type, sender_name, sender_email, body,
      email_message_id, email_direction
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (email_message_id) WHERE email_message_id IS NOT NULL
    DO NOTHING
    RETURNING id, email_forwarded_at
  `, [
    ticket.id,
    senderType,
    message.from?.value?.[0]?.name || (isSupportReply ? 'Tim Support KelolaUsaha.store' : ticket.requester_name),
    senderEmail,
    body,
    emailMessageId,
    isSupportReply ? 'outbound' : 'inbound',
  ]);
  const messageRow = insertResult.rowCount
    ? insertResult.rows[0]
    : (await pool.query(
      'SELECT id, email_forwarded_at FROM support_messages WHERE email_message_id = $1',
      [emailMessageId],
    )).rows[0];
  if (!messageRow) throw new Error(`Pesan email ${emailMessageId} tidak dapat disimpan.`);

  await pool.query(
    `UPDATE support_tickets SET status = $1, updated_at = now() WHERE ticket_number = $2`,
    [isSupportReply ? 'waiting_user' : 'new', ticketNumber],
  );
  if (insertResult.rowCount) onMessage?.(ticket.id);

  if (isSupportReply && !isSentMailbox && !messageRow.email_forwarded_at) {
    await sendEmail({
      to: ticket.requester_email,
      subject: `Balasan: ${ticket.subject}`,
      ticketNumber,
      text: `Halo ${ticket.requester_name},\n\n${body}\n\nTim Support KelolaUsaha.store\n\nNomor tiket: ${ticketNumber}`,
    });
    await pool.query(
      'UPDATE support_messages SET email_forwarded_at = now() WHERE id = $1 AND email_forwarded_at IS NULL',
      [messageRow.id],
    );
  }
}
