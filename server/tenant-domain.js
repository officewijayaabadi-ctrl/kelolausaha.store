export function slugifyBusinessName(name) {
  const slug = String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return slug || 'usaha';
}

export function tenantSlugFromHost(hostname, rootDomain) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '').split(':')[0];
  const root = String(rootDomain || '').trim().toLowerCase().replace(/\.$/, '').split(':')[0];
  if (!host || !root || host === root || host === `www.${root}`) return null;

  const suffix = `.${root}`;
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export function workspaceUrlFor(slug, origin) {
  const normalizedSlug = String(slug || '');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedSlug)) {
    throw new Error('Slug workspace tidak valid.');
  }
  const url = new URL(origin);
  return `${url.protocol}//${normalizedSlug}.${url.hostname}${url.port ? `:${url.port}` : ''}`;
}
