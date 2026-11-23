const PLATFORM_ROOM = 'support:platform';

function cookieValue(cookieHeader, key) {
  const cookies = String(cookieHeader || '').split(';');
  const value = cookies.find((cookie) => cookie.trim().startsWith(`${key}=`));
  return value?.trim().slice(key.length + 1);
}

function ticketRoom(ticketId) {
  return `support:ticket:${ticketId}`;
}

export function registerSupportSockets(io, { pool, hash }) {
  io.use(async (socket, next) => {
    try {
      const token = cookieValue(socket.handshake.headers.cookie, 'ku_session');
      if (token) {
        const result = await pool.query(
          `SELECT u.id, u.email, u.role
           FROM sessions s
           JOIN users u ON u.id = s.user_id AND u.active = true
           WHERE s.token_hash = $1 AND s.expires_at > now()`,
          [hash(token)],
        );
        socket.data.user = result.rows[0] || null;
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on('connection', (socket) => {
    const isPlatformOwner = socket.data.user?.role === 'PLATFORM_OWNER';
    if (isPlatformOwner) socket.join(PLATFORM_ROOM);

    socket.on('support:join', async (payload = {}, acknowledge = () => {}) => {
      try {
        const requestedTicketId = String(payload.ticketId || '').trim();
        const requesterEmail = isPlatformOwner
          ? ''
          : String(socket.data.user?.email || payload.email || '').trim().toLowerCase();

        if (!isPlatformOwner && !requesterEmail) {
          acknowledge({ ok: false, message: 'Email pengguna wajib diisi.' });
          return;
        }

        const tickets = isPlatformOwner
          ? requestedTicketId
            ? await pool.query('SELECT id FROM support_tickets WHERE id = $1', [requestedTicketId])
            : { rows: [] }
          : requestedTicketId
            ? await pool.query(
              'SELECT id FROM support_tickets WHERE id = $1 AND requester_email = $2',
              [requestedTicketId, requesterEmail],
            )
            : await pool.query(
              'SELECT id FROM support_tickets WHERE requester_email = $1 ORDER BY updated_at DESC LIMIT 50',
              [requesterEmail],
            );

        if (requestedTicketId && !tickets.rowCount) {
          acknowledge({ ok: false, message: 'Percakapan tidak ditemukan.' });
          return;
        }

        for (const room of socket.data.supportRooms || []) socket.leave(room);
        socket.data.supportRooms = tickets.rows.map(({ id }) => ticketRoom(id));
        for (const room of socket.data.supportRooms) socket.join(room);
        acknowledge({ ok: true });
      } catch (error) {
        console.error('Support socket subscription failed:', error.message);
        acknowledge({ ok: false, message: 'Koneksi percakapan tidak dapat dibuka.' });
      }
    });
  });
}

export function notifySupportTicketUpdated(io, ticketId) {
  io?.to(ticketRoom(ticketId)).to(PLATFORM_ROOM).emit('support:updated', { ticketId });
}

export function notifySupportTicketCreated(io, ticketId) {
  io?.to(PLATFORM_ROOM).emit('support:ticket-created', { ticketId });
}
