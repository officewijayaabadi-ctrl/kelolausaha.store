import { createServer } from 'node:http';
import { expect, test, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { io as createSocketClient } from 'socket.io-client';
import {
  notifySupportTicketUpdated,
  registerSupportSockets,
} from './support-chat.js';

function createSocket() {
  const handlers = new Map();
  return {
    handlers,
    data: {},
    handshake: { headers: {} },
    join: vi.fn(),
    leave: vi.fn(),
    on: vi.fn((event, handler) => handlers.set(event, handler)),
  };
}

function createIo() {
  const handlers = new Map();
  const io = {
    handlers,
    middleware: null,
    use: vi.fn((middleware) => {
      io.middleware = middleware;
    }),
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    to: vi.fn(() => io),
    emit: vi.fn(),
  };
  return io;
}

test('joins a guest only to tickets matching the supplied requester email', async () => {
  const io = createIo();
  const pool = {
    query: vi.fn(async (_query, parameters) => (
      parameters[1] === 'rani@example.com'
        ? { rowCount: 1, rows: [{ id: 'ticket-1' }] }
        : { rowCount: 0, rows: [] }
    )),
  };
  registerSupportSockets(io, { pool, hash: (token) => token });
  const socket = createSocket();
  await new Promise((resolve, reject) => {
    io.middleware(socket, (error) => (error ? reject(error) : resolve()));
  });
  io.handlers.get('connection')(socket);
  const join = socket.handlers.get('support:join');
  const acknowledge = vi.fn();

  await join({ ticketId: 'ticket-1', email: 'Rani@Example.com' }, acknowledge);

  expect(socket.join).toHaveBeenCalledWith('support:ticket:ticket-1');
  expect(acknowledge).toHaveBeenCalledWith({ ok: true });

  await join({ ticketId: 'ticket-1', email: 'other@example.com' }, acknowledge);
  expect(acknowledge).toHaveBeenLastCalledWith({
    ok: false,
    message: 'Percakapan tidak ditemukan.',
  });
});

test('authenticates platform owners and sends ticket update events to both chat rooms', async () => {
  const io = createIo();
  const pool = {
    query: vi.fn(async () => ({
      rowCount: 1,
      rows: [{ id: 'owner-1', role: 'PLATFORM_OWNER' }],
    })),
  };
  registerSupportSockets(io, { pool, hash: (token) => `hashed-${token}` });
  const socket = createSocket();
  socket.handshake.headers.cookie = 'ku_session=secure-session-token';
  await new Promise((resolve, reject) => {
    io.middleware(socket, (error) => (error ? reject(error) : resolve()));
  });
  io.handlers.get('connection')(socket);

  expect(socket.join).toHaveBeenCalledWith('support:platform');
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('s.token_hash = $1'), [
    'hashed-secure-session-token',
  ]);

  notifySupportTicketUpdated(io, 'ticket-1');
  expect(io.to).toHaveBeenCalledWith('support:ticket:ticket-1');
  expect(io.emit).toHaveBeenCalledWith('support:updated', { ticketId: 'ticket-1' });
});

test('delivers ticket updates over a live Socket.IO connection', async () => {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket.io',
    serveClient: false,
  });
  registerSupportSockets(io, {
    pool: {
      query: vi.fn(async () => ({ rowCount: 1, rows: [{ id: 'ticket-1' }] })),
    },
    hash: (token) => token,
  });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  const client = createSocketClient(`http://127.0.0.1:${port}`, {
    path: '/api/socket.io',
    transports: ['websocket'],
  });

  try {
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    const joinResult = await new Promise((resolve) => {
      client.emit('support:join', {
        ticketId: 'ticket-1',
        email: 'rani@example.com',
      }, resolve);
    });
    expect(joinResult).toEqual({ ok: true });

    const update = new Promise((resolve) => client.once('support:updated', resolve));
    notifySupportTicketUpdated(io, 'ticket-1');
    expect(await update).toEqual({ ticketId: 'ticket-1' });
  } finally {
    client.disconnect();
    await new Promise((resolve) => io.close(resolve));
  }
});
