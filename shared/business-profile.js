export function shapeBusinessProfile({ name, address, phone, logoUrl, qrisUrl }) {
  return {
    name,
    address,
    phone,
    logoUrl: logoUrl ?? '',
    qrisUrl: qrisUrl ?? '',
  };
}
