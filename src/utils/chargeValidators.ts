/**
 * Charge validators for individual charge cards
 * Implements strict validation rules without auto-clamping
 */

// =============================================================================
// CONSTANTS
// =============================================================================

export const UNIT_OPTIONS = ['per kg', 'per piece', 'per box'] as const;
export type Unit = typeof UNIT_OPTIONS[number];

export const CURRENCY_OPTIONS = ['INR', 'PERCENT'] as const;
export type Currency = typeof CURRENCY_OPTIONS[number];

export const MODE_OPTIONS = ['FIXED', 'VARIABLE'] as const;
export type Mode = typeof MODE_OPTIONS[number];

export const VARIABLE_RANGES = [
  '0%',
  '0.1% - 1%',
  '1.25% - 2.5%',
  '3% - 4%',
  '4% - 5%',
] as const;
export type VariableRange = typeof VARIABLE_RANGES[number];

// =============================================================================
// CHARGE CARD DATA STRUCTURE
// =============================================================================

export interface ChargeCardData {
  unit: Unit;
  currency: Currency;
  mode: Mode;
  fixedAmount: number;
  variableRange: VariableRange;
  weightThreshold?: number; // Optional - only used in handlingCharges
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate fixed amount (when currency = INR and mode = FIXED)
 * Range: 1-5000 inclusive
 * For handling charges: ALWAYS mandatory
 */
export const validateFixedAmount = (value: number, isHandlingCharge: boolean = false): string => {
  // For handling charges, it's MANDATORY (no special treatment)
  if (value === null || value === undefined || isNaN(value) || value === 0) {
    return 'This field is required';
  }
  if (value < 1 || value > 5000) {
    return 'Enter amount between 1-5,000';
  }
  return '';
};

/**
 * Validate variable range selection
 * Must be one of the allowed enum values
 */
export const validateVariableRange = (value: string): string => {
  if (!value) {
    return 'This field is required';
  }
  if (!VARIABLE_RANGES.includes(value as VariableRange)) {
    return 'Please choose a valid percentage range';
  }
  return '';
};

/**
 * Validate weight threshold (MANDATORY for handling charges)
 * Range: 1-20000 inclusive
 */
export const validateWeightThreshold = (value: number): string => {
  if (value === null || value === undefined || isNaN(value) || value === 0) {
    return 'Weight threshold is required for handling charges';
  }
  if (value < 1 || value > 20000) {
    return 'Enter amount between 1-20,000';
  }
  return '';
};

/**
 * Validate unit selection
 */
export const validateUnit = (value: string): string => {
  if (!value) {
    return 'This field is required';
  }
  if (!UNIT_OPTIONS.includes(value as Unit)) {
    return 'Invalid unit selection';
  }
  return '';
};

/**
 * Validate complete charge card data
 * @param data - Charge card data
 * @param validateWeight - Whether to validate weight threshold (only for handlingCharges)
 * @param isHandlingCharge - Whether this is a handling charge (affects validation)
 */
export const validateChargeCard = (
  data: ChargeCardData, 
  validateWeight: boolean = false,
  isHandlingCharge: boolean = false
): Record<string, string> => {
  const errors: Record<string, string> = {};

  // Validate unit
  const unitError = validateUnit(data.unit);
  if (unitError) errors.unit = unitError;

  // Validate based on currency and mode
  if (data.currency === 'INR') {
    if (data.mode === 'FIXED') {
      const fixedError = validateFixedAmount(data.fixedAmount, isHandlingCharge);
      if (fixedError) errors.fixedAmount = fixedError;
    } else {
      const variableError = validateVariableRange(data.variableRange);
      if (variableError) errors.variableRange = variableError;
    }
  } else {
    // PERCENT only shows variable
    const variableError = validateVariableRange(data.variableRange);
    if (variableError) errors.variableRange = variableError;
  }

  // Validate weight threshold (MANDATORY if validateWeight is true, i.e., for handlingCharges)
  if (validateWeight) {
    const weightError = validateWeightThreshold(data.weightThreshold);
    if (weightError) errors.weightThreshold = weightError;
  }

  return errors;
};

/**
 * Create default charge card data
 */
export const createDefaultChargeCard = (): ChargeCardData => ({
  unit: 'per kg',
  currency: 'INR',
  mode: 'FIXED',
  fixedAmount: 0,
  variableRange: '0%',
  weightThreshold: null,
});