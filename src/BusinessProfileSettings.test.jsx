import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { BusinessProfileSettings } from './BusinessProfileSettings.jsx';

test('renders editable business identity fields and forwards profile actions', () => {
  const onLogoUpload = vi.fn();
  const onQrisUpload = vi.fn();
  const onProfileChange = vi.fn();
  const onSave = vi.fn((event) => event.preventDefault());
  const profile = {
    name: 'Usaha Dealer',
    address: 'Jalan Merdeka 10',
    phone: '08123456789',
    logoUrl: '/uploads/company/logo.png',
    qrisUrl: '/uploads/company/qris.png',
  };

  render(
    <BusinessProfileSettings
      canEdit
      error=""
      loading={false}
      notice=""
      onLogoUpload={onLogoUpload}
      onQrisUpload={onQrisUpload}
      onProfileChange={onProfileChange}
      onSave={onSave}
      profile={profile}
      saving={false}
      uploading={false}
    />,
  );

  expect(screen.getByRole('textbox', { name: /Nama usaha/ }).value).toBe('Usaha Dealer');
  expect(screen.getByRole('textbox', { name: /Alamat usaha/ }).value).toBe('Jalan Merdeka 10');
  expect(screen.getByRole('textbox', { name: /Nomor HP usaha/ }).value).toBe('08123456789');
  expect(screen.getByRole('img', { name: 'Pratinjau logo usaha' }).getAttribute('src'))
    .toBe('/uploads/company/logo.png');
  expect(screen.getByRole('img', { name: 'Pratinjau QRIS usaha' }).getAttribute('src'))
    .toBe('/uploads/company/qris.png');
  fireEvent.change(screen.getByLabelText('QRIS usaha'), {
    target: { files: [new File(['qris'], 'qris.png', { type: 'image/png' })] },
  });
  expect(onQrisUpload).toHaveBeenCalled();

  fireEvent.change(screen.getByRole('textbox', { name: /Nama usaha/ }), { target: { value: 'Dealer' } });
  expect(onProfileChange).toHaveBeenCalledWith({ ...profile, name: 'Dealer' });
  fireEvent.click(screen.getByRole('button', { name: /Simpan profil/ }));
  expect(onSave).toHaveBeenCalled();
});
