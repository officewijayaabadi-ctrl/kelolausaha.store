import { afterEach, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AttendanceWorkspace, buildAttendanceCsv } from './WorkspaceOperations';

const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const geolocationDescriptor = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
const canvasGetContextDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext');
const canvasToBlobDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');

afterEach(() => {
  vi.unstubAllGlobals();
  [
    [navigator, 'mediaDevices', mediaDevicesDescriptor],
    [navigator, 'geolocation', geolocationDescriptor],
    [HTMLCanvasElement.prototype, 'getContext', canvasGetContextDescriptor],
    [HTMLCanvasElement.prototype, 'toBlob', canvasToBlobDescriptor],
  ].forEach(([target, key, descriptor]) => {
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else delete target[key];
  });
});

test('exports filtered attendance data as safe CSV rows', () => {
  const csv = buildAttendanceCsv([{
    userName: '=SUM(1,1)',
    role: 'SALES',
    branchName: 'Cabang "Utama"',
    status: 'present',
    checkInAt: '2026-11-23T01:00:00.000Z',
    checkOutAt: null,
    checkInMapsUrl: 'https://maps.google.com/?q=-7.1,112.2',
  }], '2026-11-23');

  expect(csv).toContain('"Nama karyawan"');
  expect(csv).toContain("\"'=SUM(1,1)\"");
  expect(csv).toContain('"Cabang ""Utama"""');
  expect(csv).toContain('"Hadir"');
  expect(csv).toContain('"https://maps.google.com/?q=-7.1,112.2"');
});

test('requires a live camera photo for attendance instead of an image file', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    let result = {};
    if (url.endsWith('/attendance/today')) result = { attendance: null };
    if (url.endsWith('/branches')) result = { branches: [{ id: 'branch-id', name: 'Cabang' }] };
    if (url.endsWith('/attendance/settings')) {
      result = {
        settings: {
          timezone: 'Asia/Jakarta',
          workStart: '08:00',
          workEnd: '17:00',
          workDays: [1, 2, 3, 4, 5, 6],
          graceMinutes: 15,
        },
      };
    }
    if (url.includes('/attendance/requests')) result = { requests: [] };
    return { ok: true, json: async () => result };
  }));

  const { container } = render(<AttendanceWorkspace isAuthenticated role="SALES" />);

  expect(await screen.findByRole('heading', { name: 'Absensi masuk' })).toBeDefined();
  await waitFor(() => expect(container.querySelectorAll('input[type="file"]')).toHaveLength(1));
  expect(screen.getAllByRole('button', { name: 'Mulai absensi' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Absen masuk dengan foto & lokasi' })).toBeNull();
  expect(container.querySelectorAll('.attendance-action-card input[type="file"]')).toHaveLength(0);
});

test('uses one camera action button to capture and submit attendance', async () => {
  let todayCalls = 0;
  const fetchMock = vi.fn(async (url) => {
    let result = {};
    if (url.endsWith('/attendance/today')) {
      todayCalls += 1;
      result = todayCalls === 1
        ? { attendance: null }
        : {
          attendance: {
            checkInAt: '2026-11-23T01:00:00.000Z',
            checkInMapsUrl: 'https://maps.google.com/?q=-7.1,112.2',
            checkOutAt: null,
          },
        };
    }
    if (url.endsWith('/branches')) result = { branches: [{ id: 'branch-id', name: 'Cabang' }] };
    if (url.endsWith('/attendance/settings')) {
      result = {
        settings: {
          timezone: 'Asia/Jakarta',
          workStart: '08:00',
          workEnd: '17:00',
          workDays: [1, 2, 3, 4, 5, 6],
          graceMinutes: 15,
        },
      };
    }
    if (url.includes('/attendance/requests')) result = { requests: [] };
    return { ok: true, json: async () => result };
  });
  vi.stubGlobal('fetch', fetchMock);
  const stream = { getTracks: () => [{ stop: vi.fn() }] };
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((onSuccess) => onSuccess({
        coords: { latitude: -7.1, longitude: 112.2 },
      })),
    },
  });
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 640,
    height: 480,
    close: vi.fn(),
  })));
  const context = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
  };
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => context),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((callback) => callback(new Blob(['photo'], { type: 'image/jpeg' }))),
  });

  const { container } = render(<AttendanceWorkspace isAuthenticated role="SALES" />);

  fireEvent.click(await screen.findByRole('button', { name: 'Mulai absensi' }));
  const video = await waitFor(() => {
    const activeVideo = container.querySelector('.attendance-action-card video');
    expect(activeVideo).not.toBeNull();
    return activeVideo;
  });
  Object.defineProperty(video, 'videoWidth', { configurable: true, value: 640 });
  Object.defineProperty(video, 'videoHeight', { configurable: true, value: 480 });
  fireEvent.canPlay(video);
  fireEvent.click(await screen.findByRole('button', { name: 'Ambil foto & absen' }));

  expect(await screen.findByText(/Sudah absen masuk/)).toBeDefined();
  expect(fetchMock.mock.calls.some(([url, options]) => (
    url.endsWith('/attendance/check-in') && options.method === 'POST'
  ))).toBe(true);
});

test('shows one camera and prevents repeating check-in when attendance is already recorded', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    let result = {};
    if (url.endsWith('/attendance/today')) {
      result = {
        attendance: {
          checkInAt: '2026-11-23T01:00:00.000Z',
          checkInMapsUrl: 'https://maps.google.com/?q=-7.1,112.2',
          checkOutAt: null,
        },
      };
    }
    if (url.endsWith('/branches')) result = { branches: [{ id: 'branch-id', name: 'Cabang' }] };
    if (url.endsWith('/attendance/settings')) {
      result = {
        settings: {
          timezone: 'Asia/Jakarta',
          workStart: '08:00',
          workEnd: '17:00',
          workDays: [1, 2, 3, 4, 5, 6],
          graceMinutes: 15,
        },
      };
    }
    if (url.includes('/attendance/requests')) result = { requests: [] };
    return { ok: true, json: async () => result };
  }));

  const { container } = render(<AttendanceWorkspace isAuthenticated role="SALES" />);

  expect(await screen.findByText(/Sudah absen masuk/)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Absen masuk dengan foto & lokasi' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Mulai absensi' })).toHaveLength(1);
  expect(container.querySelectorAll('.attendance-action-card input[type="file"]')).toHaveLength(0);
});
