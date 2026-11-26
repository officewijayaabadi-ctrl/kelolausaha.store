export const industryActions = Object.freeze({
  view: 'view',
  create: 'create',
  update: 'update',
  delete: 'delete',
  approve: 'approve',
  export: 'export',
  manage: 'manage',
});

const allActions = Object.freeze(Object.values(industryActions));

function actionModules(modules) {
  return Object.fromEntries(modules.map((module) => [
    module,
    Object.fromEntries(allActions.map((action) => [action, true])),
  ]));
}

function rolePermissions(modules, overrides = {}) {
  const permissions = actionModules(modules);
  Object.entries(overrides).forEach(([module, actions]) => {
    if (!permissions[module]) permissions[module] = {};
    Object.entries(actions).forEach(([action, enabled]) => {
      permissions[module][action] = Boolean(enabled);
    });
  });
  return permissions;
}

const industryRole = (roles) => roles;

export const industryBusinessRegistry = Object.freeze({
  retail: {
    label: 'Retail / Toko',
    modules: ['products', 'pos', 'inventory', 'purchases', 'suppliers', 'customers', 'sales', 'returns', 'cash_closing', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['products', 'pos', 'inventory', 'purchases', 'suppliers', 'customers', 'sales', 'returns', 'cash_closing', 'reports']),
      Manager: rolePermissions(['products', 'pos', 'inventory', 'purchases', 'suppliers', 'customers', 'sales', 'returns', 'cash_closing', 'reports'], { reports: { delete: false } }),
      Supervisor: rolePermissions(['pos', 'inventory', 'customers', 'sales', 'returns', 'cash_closing', 'reports'], { pos: { delete: false }, inventory: { delete: false } }),
      Cashier: rolePermissions(['pos', 'customers', 'sales', 'returns'], { sales: { approve: false, delete: false, export: false }, returns: { update: false, delete: false, approve: false } }),
      WarehouseStaff: rolePermissions(['inventory', 'purchases'], { inventory: { approve: false, delete: false, export: false }, purchases: { approve: false, delete: false } }),
    }),
  },
  dealer_motor: {
    label: 'Dealer Motor',
    modules: ['units', 'spk', 'test_rides', 'customers', 'sales_team', 'leasing', 'delivery', 'service', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['units', 'spk', 'test_rides', 'customers', 'sales_team', 'leasing', 'delivery', 'service', 'reports']),
      SalesManager: rolePermissions(['units', 'spk', 'test_rides', 'customers', 'sales_team', 'leasing', 'delivery', 'reports']),
      Sales: rolePermissions(['units', 'spk', 'test_rides', 'customers'], { spk: { approve: false, delete: false, export: false }, units: { create: false, update: false, delete: false } }),
      SPKVerifier: rolePermissions(['spk', 'customers', 'leasing'], { spk: { create: false, delete: false, export: false } }),
      Driver: rolePermissions(['delivery'], { delivery: { create: false, update: true, delete: false, approve: false, export: false } }),
      Mechanic: rolePermissions(['service'], { service: { delete: false, approve: false, export: false } }),
    }),
  },
  restaurant: {
    label: 'Restoran / Cafe',
    modules: ['menu', 'recipes', 'ingredients', 'tables', 'orders', 'kitchen', 'cashier', 'suppliers', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['menu', 'recipes', 'ingredients', 'tables', 'orders', 'kitchen', 'cashier', 'suppliers', 'reports']),
      RestaurantManager: rolePermissions(['menu', 'recipes', 'ingredients', 'tables', 'orders', 'kitchen', 'cashier', 'suppliers', 'reports']),
      Chef: rolePermissions(['menu', 'recipes', 'ingredients', 'kitchen'], { menu: { delete: false, approve: false }, recipes: { approve: false, delete: false } }),
      Waiter: rolePermissions(['tables', 'orders'], { orders: { approve: false, delete: false, export: false } }),
      Cashier: rolePermissions(['orders', 'cashier'], { orders: { approve: true, delete: false }, cashier: { approve: true } }),
    }),
  },
  fashion: {
    label: 'Fashion',
    modules: ['collections', 'products', 'variants', 'inventory', 'pos', 'customers', 'suppliers', 'returns', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['collections', 'products', 'variants', 'inventory', 'pos', 'customers', 'suppliers', 'returns', 'reports']),
      StoreManager: rolePermissions(['collections', 'products', 'variants', 'inventory', 'pos', 'customers', 'suppliers', 'returns', 'reports']),
      VisualMerchandiser: rolePermissions(['collections', 'products', 'variants', 'inventory'], { inventory: { approve: false, delete: false } }),
      Cashier: rolePermissions(['pos', 'customers', 'returns'], { returns: { approve: false, delete: false } }),
      InventoryStaff: rolePermissions(['variants', 'inventory', 'suppliers'], { inventory: { approve: false, delete: false } }),
    }),
  },
  workshop: {
    label: 'Bengkel',
    modules: ['customers', 'vehicles', 'appointments', 'work_orders', 'mechanics', 'parts', 'estimates', 'cashier', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['customers', 'vehicles', 'appointments', 'work_orders', 'mechanics', 'parts', 'estimates', 'cashier', 'reports']),
      ServiceManager: rolePermissions(['customers', 'vehicles', 'appointments', 'work_orders', 'mechanics', 'parts', 'estimates', 'reports']),
      ServiceAdvisor: rolePermissions(['customers', 'vehicles', 'appointments', 'work_orders', 'estimates'], { work_orders: { approve: false, delete: false }, estimates: { approve: true, delete: false } }),
      Mechanic: rolePermissions(['work_orders', 'vehicles', 'parts'], { work_orders: { approve: false, delete: false, export: false }, parts: { create: false, update: false, delete: false } }),
      Partsman: rolePermissions(['parts', 'work_orders'], { parts: { approve: false, delete: false }, work_orders: { create: false, update: false, delete: false } }),
      Cashier: rolePermissions(['customers', 'work_orders', 'cashier'], { work_orders: { create: false, update: false, delete: false }, cashier: { approve: true } }),
    }),
  },
  distributor: {
    label: 'Distributor',
    modules: ['warehouses', 'products', 'purchases', 'suppliers', 'sales', 'customers', 'deliveries', 'receivables', 'routes', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['warehouses', 'products', 'purchases', 'suppliers', 'sales', 'customers', 'deliveries', 'receivables', 'routes', 'reports']),
      DistributionManager: rolePermissions(['warehouses', 'products', 'purchases', 'suppliers', 'sales', 'customers', 'deliveries', 'receivables', 'routes', 'reports']),
      Sales: rolePermissions(['customers', 'sales', 'deliveries', 'receivables'], { sales: { approve: false, delete: false }, receivables: { update: false, delete: false, approve: false } }),
      WarehouseStaff: rolePermissions(['warehouses', 'products', 'purchases', 'deliveries'], { purchases: { approve: false, delete: false }, deliveries: { approve: false, delete: false } }),
      Finance: rolePermissions(['receivables', 'sales', 'deliveries', 'reports'], { receivables: { approve: true }, sales: { delete: false } }),
      Driver: rolePermissions(['deliveries'], { deliveries: { create: false, delete: false, approve: false, export: false } }),
    }),
  },
  services: {
    label: 'Jasa / Service',
    modules: ['clients', 'services', 'projects', 'appointments', 'assignments', 'worklogs', 'invoices', 'payments', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['clients', 'services', 'projects', 'appointments', 'assignments', 'worklogs', 'invoices', 'payments', 'reports']),
      OperationsManager: rolePermissions(['clients', 'services', 'projects', 'appointments', 'assignments', 'worklogs', 'invoices', 'payments', 'reports']),
      ProjectManager: rolePermissions(['clients', 'projects', 'appointments', 'assignments', 'worklogs', 'invoices'], { invoices: { approve: true, delete: false } }),
      Staff: rolePermissions(['projects', 'appointments', 'assignments', 'worklogs'], { projects: { create: false, delete: false }, worklogs: { approve: false, delete: false } }),
      Finance: rolePermissions(['invoices', 'payments', 'clients', 'reports'], { invoices: { approve: true } }),
    }),
  },
  manufacturing: {
    label: 'Manufaktur',
    modules: ['raw_materials', 'bom', 'production', 'machines', 'work_orders', 'qc', 'finished_goods', 'warehouses', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['raw_materials', 'bom', 'production', 'machines', 'work_orders', 'qc', 'finished_goods', 'warehouses', 'reports']),
      ProductionManager: rolePermissions(['raw_materials', 'bom', 'production', 'machines', 'work_orders', 'qc', 'finished_goods', 'warehouses', 'reports']),
      Planner: rolePermissions(['raw_materials', 'bom', 'production', 'work_orders', 'machines'], { work_orders: { approve: true }, production: { approve: false } }),
      Operator: rolePermissions(['work_orders', 'production', 'finished_goods'], { work_orders: { create: false, delete: false, approve: false }, production: { delete: false, approve: false } }),
      QC: rolePermissions(['qc', 'finished_goods', 'production'], { qc: { approve: true, delete: false }, finished_goods: { delete: false } }),
      WarehouseStaff: rolePermissions(['raw_materials', 'finished_goods', 'warehouses'], { raw_materials: { approve: false, delete: false }, finished_goods: { approve: false, delete: false } }),
    }),
  },
  property: {
    label: 'Properti',
    modules: ['listings', 'units', 'prospects', 'agents', 'viewings', 'bookings', 'contracts', 'payments', 'commissions', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['listings', 'units', 'prospects', 'agents', 'viewings', 'bookings', 'contracts', 'payments', 'commissions', 'reports']),
      PropertyManager: rolePermissions(['listings', 'units', 'prospects', 'agents', 'viewings', 'bookings', 'contracts', 'payments', 'commissions', 'reports']),
      Agent: rolePermissions(['listings', 'units', 'prospects', 'viewings', 'bookings'], { listings: { approve: false, delete: false }, prospects: { delete: false }, bookings: { approve: false, delete: false } }),
      Finance: rolePermissions(['payments', 'contracts', 'commissions', 'reports'], { payments: { approve: true } }),
    }),
  },
  pharmacy: {
    label: 'Apotek',
    modules: ['medicines', 'batches', 'expiry', 'prescriptions', 'inventory', 'suppliers', 'pos', 'customers', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['medicines', 'batches', 'expiry', 'prescriptions', 'inventory', 'suppliers', 'pos', 'customers', 'reports']),
      Pharmacist: rolePermissions(['medicines', 'batches', 'expiry', 'prescriptions', 'inventory', 'pos', 'customers'], { prescriptions: { approve: true }, medicines: { delete: false } }),
      Assistant: rolePermissions(['medicines', 'batches', 'expiry', 'prescriptions', 'inventory', 'pos', 'customers'], { medicines: { delete: false, approve: false }, prescriptions: { delete: false, approve: false } }),
      Cashier: rolePermissions(['pos', 'customers', 'prescriptions'], { pos: { approve: false, delete: false }, prescriptions: { create: false, update: false, delete: false, approve: false } }),
      Procurement: rolePermissions(['medicines', 'batches', 'expiry', 'suppliers', 'inventory'], { inventory: { approve: false, delete: false } }),
    }),
  },
  salon: {
    label: 'Salon / Barbershop',
    modules: ['services', 'stylist', 'booking', 'queue', 'customers', 'commissions', 'products', 'cashier', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['services', 'stylist', 'booking', 'queue', 'customers', 'commissions', 'products', 'cashier', 'reports']),
      SalonManager: rolePermissions(['services', 'stylist', 'booking', 'queue', 'customers', 'commissions', 'products', 'cashier', 'reports']),
      Stylist: rolePermissions(['services', 'booking', 'queue', 'customers', 'commissions'], { services: { create: false, update: false, delete: false, approve: false }, commissions: { create: false, update: false, delete: false, approve: false } }),
      Receptionist: rolePermissions(['booking', 'queue', 'customers', 'cashier'], { booking: { approve: false, delete: false }, cashier: { approve: true } }),
      Cashier: rolePermissions(['queue', 'customers', 'products', 'cashier'], { products: { delete: false }, cashier: { approve: true } }),
    }),
  },
  travel: {
    label: 'Travel / Pariwisata',
    modules: ['packages', 'itinerary', 'schedule', 'reservations', 'participants', 'tickets', 'hotels', 'payments', 'partners', 'reports'],
    roles: industryRole({
      Owner: rolePermissions(['packages', 'itinerary', 'schedule', 'reservations', 'participants', 'tickets', 'hotels', 'payments', 'partners', 'reports']),
      TourManager: rolePermissions(['packages', 'itinerary', 'schedule', 'reservations', 'participants', 'tickets', 'hotels', 'payments', 'partners', 'reports']),
      ReservationStaff: rolePermissions(['packages', 'schedule', 'reservations', 'participants', 'tickets', 'hotels'], { reservations: { approve: false, delete: false } }),
      Guide: rolePermissions(['itinerary', 'schedule', 'participants'], { itinerary: { delete: false, approve: false }, participants: { delete: false, approve: false } }),
      Finance: rolePermissions(['reservations', 'payments', 'partners', 'reports'], { payments: { approve: true } }),
    }),
  },
});

export function getIndustryDefinition(industryKey) {
  return industryBusinessRegistry[industryKey] || null;
}

export function normalizeIndustryKey(industryKey) {
  const aliases = {
    dealer: 'dealer_motor',
    restro: 'restaurant',
    restaurant_cafe: 'restaurant',
    resto: 'restaurant',
    bengkel: 'workshop',
    grosir: 'distributor',
    distribution: 'distributor',
    jasa: 'services',
    apotek: 'pharmacy',
    salon_barbershop: 'salon',
    travel_pariwisata: 'travel',
  };
  return aliases[industryKey] || industryKey;
}

export function getIndustryRoles(industryKey) {
  const definition = getIndustryDefinition(normalizeIndustryKey(industryKey));
  return definition ? Object.keys(definition.roles) : [];
}

export function getRolePermissions(industryKey, role) {
  const definition = getIndustryDefinition(normalizeIndustryKey(industryKey));
  return definition?.roles[role] || null;
}

export function flattenRolePermissions(industryKey, role) {
  const permissions = getRolePermissions(industryKey, role);
  if (!permissions) return [];
  return Object.entries(permissions).flatMap(([module, actions]) => (
    Object.entries(actions)
      .filter(([, enabled]) => enabled)
      .map(([action]) => `${module}.${action}`)
  ));
}

export function canRolePerform(industryKey, role, module, action, branch = null) {
  const permissions = getRolePermissions(industryKey, role);
  if (!permissions?.[module]?.[action]) return false;
  if (branch && typeof branch.allowed === 'boolean') return branch.allowed;
  return true;
}

export function createIndustryAuditEvent({
  companyId,
  branchId = null,
  userId,
  role,
  industry,
  module,
  action,
  resourceType,
  resourceId = null,
  before = null,
  after = null,
  metadata = {},
}) {
  return Object.freeze({
    companyId,
    branchId,
    userId,
    role,
    industry: normalizeIndustryKey(industry),
    module,
    action,
    resourceType,
    resourceId,
    before,
    after,
    metadata,
    occurredAt: new Date().toISOString(),
  });
}
