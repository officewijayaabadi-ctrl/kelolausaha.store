import { afterEach, expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AttendanceWorkspace, buildAttendanceCsv } from './WorkspaceOperations';

afterEach(() => {
  vi.unstubAllGlobals();
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
  expect(screen.getAllByRole('button', { name: 'Buka kamera' })).toHaveLength(2);
  expect(container.querySelectorAll('.attendance-action-card input[type="file"]')).toHaveLength(0);
});
