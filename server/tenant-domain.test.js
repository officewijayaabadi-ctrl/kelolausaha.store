import { describe, expect, test } from 'vitest';
import { slugifyBusinessName, tenantSlugFromHost, workspaceUrlFor } from './tenant-domain.js';

describe('tenant subdomains', () => {
  test('normalizes business names into readable subdomain slugs', () => {
    expect(slugifyBusinessName('Dealer Wijaya Abadi')).toBe('dealer-wijaya-abadi');
    expect(slugifyBusinessName('Toko é & Co.')).toBe('toko-e-co');
    expect(slugifyBusinessName('東京')).toBe('usaha');
  });

  test('recognizes only a single tenant label under the configured root domain', () => {
    expect(tenantSlugFromHost('dealer-wijaya.kelolausaha.store', 'kelolausaha.store'))
      .toBe('dealer-wijaya');
    expect(tenantSlugFromHost('kelolausaha.store', 'kelolausaha.store')).toBeNull();
    expect(tenantSlugFromHost('nested.dealer.kelolausaha.store', 'kelolausaha.store')).toBeNull();
    expect(tenantSlugFromHost('dealer.other-domain.test', 'kelolausaha.store')).toBeNull();
  });

  test('builds workspace URLs from the configured app origin', () => {
    expect(workspaceUrlFor('dealer-wijaya', 'https://kelolausaha.store'))
      .toBe('https://dealer-wijaya.kelolausaha.store');
    expect(workspaceUrlFor('dealer-wijaya', 'http://localhost:3000'))
      .toBe('http://dealer-wijaya.localhost:3000');
  });
});
