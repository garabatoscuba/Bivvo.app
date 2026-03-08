// Unit conversion utilities for recipe ingredient cost calculations

type UnitCategory = 'weight' | 'volume' | 'unit';

interface UnitDef {
  category: UnitCategory;
  /** Factor to convert 1 of this unit to the base unit (g for weight, ml for volume) */
  toBase: number;
  label: string;
}

const UNITS: Record<string, UnitDef> = {
  // Weight – base: grams
  g:   { category: 'weight', toBase: 1,       label: 'g' },
  kg:  { category: 'weight', toBase: 1000,    label: 'kg' },
  lb:  { category: 'weight', toBase: 453.592, label: 'lb' },
  oz:  { category: 'weight', toBase: 28.3495, label: 'oz' },
  // Volume – base: ml
  ml:  { category: 'volume', toBase: 1,       label: 'ml' },
  l:   { category: 'volume', toBase: 1000,    label: 'l' },
  'fl oz': { category: 'volume', toBase: 29.5735, label: 'fl oz' },
  galón:   { category: 'volume', toBase: 3785.41, label: 'galón' },
  // Discrete – no conversion
  pieza:  { category: 'unit', toBase: 1, label: 'Pieza' },
  unidad: { category: 'unit', toBase: 1, label: 'Unidad' },
};

/** Normalize key: lowercase, trim */
export function normalizeUnitKey(unit: string): string {
  const u = unit.trim().toLowerCase();
  // Common aliases
  if (u === 'gramo' || u === 'gramos') return 'g';
  if (u === 'kilogramo' || u === 'kilogramos') return 'kg';
  if (u === 'libra' || u === 'libras') return 'lb';
  if (u === 'onza' || u === 'onzas') return 'oz';
  if (u === 'mililitro' || u === 'mililitros') return 'ml';
  if (u === 'litro' || u === 'litros') return 'l';
  if (u === 'galon' || u === 'galones' || u === 'galón') return 'galón';
  if (u === 'fl oz' || u === 'floz') return 'fl oz';
  if (u === 'pieza' || u === 'piezas' || u === 'pza') return 'pieza';
  if (u === 'unidad' || u === 'unidades' || u === 'ud' || u === 'u') return 'unidad';
  return u;
}

export function getUnitDef(unit: string): UnitDef | null {
  return UNITS[normalizeKey(unit)] || null;
}

/** Get category of a unit */
export function getUnitCategory(unit: string): UnitCategory {
  return getUnitDef(unit)?.category || 'unit';
}

/**
 * Convert `qty` from `fromUnit` to `toUnit`.
 * Returns null if units are incompatible.
 */
export function convertUnits(qty: number, fromUnit: string, toUnit: string): number | null {
  const from = getUnitDef(fromUnit);
  const to = getUnitDef(toUnit);
  if (!from || !to) return null;
  if (from.category !== to.category) return null;
  if (from.category === 'unit') return qty; // no conversion for discrete
  // Convert: qty * fromBase / toBase
  return (qty * from.toBase) / to.toBase;
}

/**
 * Calculate the cost for `recipeQty` in `recipeUnit`
 * given that the ingredient costs `costPerPurchaseUnit` in `purchaseUnit`.
 */
export function calcIngredientCost(
  recipeQty: number,
  recipeUnit: string,
  costPerPurchaseUnit: number,
  purchaseUnit: string
): number {
  const converted = convertUnits(recipeQty, recipeUnit, purchaseUnit);
  if (converted === null) {
    // Fallback: assume same unit
    return recipeQty * costPerPurchaseUnit;
  }
  return converted * costPerPurchaseUnit;
}

/** Return compatible units for a given unit */
export function getCompatibleUnits(unit: string): { value: string; label: string }[] {
  const cat = getUnitCategory(unit);
  return Object.entries(UNITS)
    .filter(([, def]) => def.category === cat)
    .map(([key, def]) => ({ value: key, label: def.label }));
}

/** All supported units */
export function getAllUnits(): { value: string; label: string; category: UnitCategory }[] {
  return Object.entries(UNITS).map(([key, def]) => ({
    value: key,
    label: def.label,
    category: def.category,
  }));
}
