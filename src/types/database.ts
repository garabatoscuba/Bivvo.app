// Tipos extendidos para las nuevas tablas
export type ProductStatus = 'for_sale' | 'warehouse' | 'discontinued';
export type InventoryMovementType = 'purchase' | 'sale' | 'transfer_in' | 'transfer_out' | 'loss' | 'adjustment' | 'return';
export type PaymentType = 'cash' | 'credit' | 'card' | 'transfer' | 'mixed';
export type SaleStatus = 'completed' | 'pending' | 'cancelled';

export interface Category {
  id: string;
  business_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string | null;
  code: string;
  name: string;
  description: string | null;
  cost_price: number;
  sale_price: number;
  image_url: string | null;
  status: ProductStatus;
  min_stock: number;
  barcode: string | null;
  supplier: string | null;
  unit_of_measure: string;
  brand: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface BranchStock {
  id: string;
  branch_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface InventoryMovement {
  id: string;
  branch_id: string;
  product_id: string;
  user_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  notes: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  branch_id: string;
  user_id: string;
  customer_id: string | null;
  sale_number: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_type: PaymentType;
  status: SaleStatus;
  amount_paid: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount: number;
  total: number;
  created_at: string;
  product?: Product;
}

export interface Branch {
  id: string;
  business_id: string;
  name: string;
  slug: string | null;
  is_main: boolean;
  address: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

// Tipos para el carrito de POS
export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}
