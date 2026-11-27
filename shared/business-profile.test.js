import { expect, test } from 'vitest';
import { shapeBusinessProfile } from './business-profile.js';

test('keeps the business phone in the profile response and normalizes optional assets', () => {
  expect(shapeBusinessProfile({
    name: 'Dealer WAM',
    address: 'Jl. Merdeka',
    phone: '081234567890',
    logoUrl: null,
    qrisUrl: null,
  })).toEqual({
    name: 'Dealer WAM',
    address: 'Jl. Merdeka',
    phone: '081234567890',
    logoUrl: '',
    qrisUrl: '',
  });
});
