CREATE TABLE IF NOT EXISTS business_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS business_customers_company_phone_idx
  ON business_customers (company_id, phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE INDEX IF NOT EXISTS business_customers_company_name_idx
  ON business_customers (company_id, lower(name));

CREATE TABLE IF NOT EXISTS business_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id)
);
CREATE INDEX IF NOT EXISTS business_suppliers_company_name_idx
  ON business_suppliers (company_id, lower(name));

CREATE TABLE IF NOT EXISTS business_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  unit TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'product' CHECK (item_type IN ('product', 'service')),
  cost_price BIGINT NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price BIGINT NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (stock >= 0),
  minimum_stock NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  stock_tracked BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, sku)
);
CREATE INDEX IF NOT EXISTS business_products_company_active_name_idx
  ON business_products (company_id, active, lower(name));

CREATE TABLE IF NOT EXISTS business_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  business_type TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_timing TEXT,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  subtotal BIGINT NOT NULL CHECK (subtotal >= 0),
  discount BIGINT NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax BIGINT NOT NULL DEFAULT 0 CHECK (tax >= 0),
  service_charge BIGINT NOT NULL DEFAULT 0 CHECK (service_charge >= 0),
  total BIGINT NOT NULL CHECK (total >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  stock_reserved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, order_number),
  FOREIGN KEY (customer_id, company_id)
    REFERENCES business_customers(id, company_id)
);
CREATE INDEX IF NOT EXISTS business_orders_company_created_idx
  ON business_orders (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS business_orders_company_status_idx
  ON business_orders (company_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS business_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  product_id UUID,
  item_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_price BIGINT NOT NULL CHECK (unit_price >= 0),
  line_total BIGINT NOT NULL CHECK (line_total >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  FOREIGN KEY (order_id, company_id)
    REFERENCES business_orders(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, company_id)
    REFERENCES business_products(id, company_id)
);
CREATE INDEX IF NOT EXISTS business_order_items_order_idx
  ON business_order_items (company_id, order_id);

CREATE TABLE IF NOT EXISTS business_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  payment_method TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (order_id, company_id)
    REFERENCES business_orders(id, company_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS business_payments_order_idx
  ON business_payments (company_id, order_id, paid_at DESC);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('opening', 'purchase', 'sale', 'return', 'adjustment', 'waste')),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity <> 0),
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, company_id)
    REFERENCES business_products(id, company_id)
);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx
  ON inventory_movements (company_id, product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS business_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  supplier_id UUID,
  purchase_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'cancelled')),
  total BIGINT NOT NULL CHECK (total >= 0),
  note TEXT,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, company_id),
  UNIQUE (company_id, purchase_number),
  FOREIGN KEY (supplier_id, company_id)
    REFERENCES business_suppliers(id, company_id)
);
CREATE INDEX IF NOT EXISTS business_purchases_company_date_idx
  ON business_purchases (company_id, purchased_at DESC);

CREATE TABLE IF NOT EXISTS business_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost BIGINT NOT NULL CHECK (unit_cost >= 0),
  line_total BIGINT NOT NULL CHECK (line_total >= 0),
  FOREIGN KEY (purchase_id, company_id)
    REFERENCES business_purchases(id, company_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id, company_id)
    REFERENCES business_products(id, company_id)
);
CREATE INDEX IF NOT EXISTS business_purchase_items_order_idx
  ON business_purchase_items (company_id, purchase_id);
