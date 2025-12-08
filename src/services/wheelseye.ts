// src/services/wheelseye.ts
import { computeWheelseyePrice } from "./wheelseyeEngine";
import { parseDistanceToKm } from "../utils/distanceParser";

import axios from "axios";

/** --- Types you already use on the page --- */
export type ShipmentBox = {
  count: number;
  length: number;
  width: number;
  height: number;
  weight: number;
};

export type QuoteAny = {
  companyName: string;
  price: number;
  totalCharges: number;
  total: number;
  totalPrice: number;
  isTiedUp?: boolean;
  [k: string]: any;
};

export type WheelseyeBreakdown = {
  price: number;
  weightBreakdown?: {
    actualWeight: number;
    volumetricWeight: number;
    chargeableWeight: number;
  };
  vehicle?: string;
  vehicleLength?: number | string;
  matchedWeight?: number;
  matchedDistance?: number;
  vehiclePricing?: Array<{
    vehicleType: string;
    weight: number;
    maxWeight: number;
    wheelseyePrice: number;
    ftlPrice: number;
  }>;
  vehicleCalculation?: { totalVehiclesRequired?: number };
  loadSplit?: any;
  vehicleBreakdown?: any;
};

/** --- New Pricing Data Types --- */
export type DistanceRange = {
  min: number;
  max: number;
};

export type WeightRange = {
  min: number;
  max: number;
};

export type PricingEntry = {
  distanceRange: DistanceRange;
  price: number;
  _id: string;
};

export type VehiclePricingData = {
  _id: string;
  vehicleType: string;
  weightRange: WeightRange;
  distanceRange: DistanceRange;
  vehicleLength: number;
  pricing: PricingEntry[];
  createdAt: string;
  updatedAt: string;
  __v: number;
};

/** --- Config (use env when available) --- */
const BASE_URL =
  (import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ||
    "https://backend-2-4tjr.onrender.com");

const AUTH_HEADER = (token?: string) =>
  token ? { Authorization: `Bearer ${token}` } : undefined;


/**
 * Calculate pricing using local pricing data instead of API calls
 */
/**
 * Calculate pricing using local pricing data instead of API calls
 * (now uses our JSON + engine instead of WHEELSEYE_PRICING_DATA)
 * 
 * NOTE: chargeableWeight parameter should ALREADY be max(actual, volumetric)
 * This function uses it directly for pricing/vehicle selection
 */
export function calculateLocalWheelseyePrice(
  chargeableWeight: number,
  distanceKm: number,
  shipment: ShipmentBox[]
): WheelseyeBreakdown {
  console.log(
    `🧠 Wheelseye engine input: chargeableWeight=${chargeableWeight}kg, distance=${distanceKm}km`
  );

  // Use chargeableWeight for engine calculation (vehicle selection + pricing)
  const engineResult = computeWheelseyePrice(chargeableWeight, distanceKm);

  // Calculate weights from boxes for the breakdown (informational only)
  let totalVolumetricWeight = 0;
  let totalActualWeight = 0;

  shipment.forEach((box) => {
    const volumetric =
      (box.length * box.width * box.height * box.count) / 5000;
    totalVolumetricWeight += volumetric;
    totalActualWeight += box.weight * box.count;
  });

  // finalChargeableWeight should match what was passed in
  const finalChargeableWeight = Math.max(
    totalActualWeight,
    totalVolumetricWeight
  );

  const totalVehiclesRequired = engineResult.vehicles.reduce(
    (sum, v) => sum + v.count,
    0
  );

  // build nice labels: "2 x Eicher 19 ft + Tata Ace"
  const vehicleLabel = engineResult.vehicles
    .map((v) =>
      v.count > 1 ? `${v.count} x ${v.label}` : v.label
    )
    .join(" + ");

  const vehicleLengthLabel = engineResult.vehicles
    .map((v) =>
      v.count > 1 ? `${v.count} x ${v.lengthFt} ft` : `${v.lengthFt} ft`
    )
    .join(" + ");

  const price = engineResult.totalPrice;

  console.log(
    `✅ Wheelseye engine result: ₹${price}, vehicles=${vehicleLabel}, chosenWeight=${engineResult.chosenWeight}kg, totalVehicles=${totalVehiclesRequired}`
  );

  // Detailed per-vehicle pricing (optionally used by UI)
  const vehiclePricing =
    engineResult.vehicles.map((v) => ({
      vehicleType: v.label,
      weight: v.slabWeightKg,
      maxWeight: v.slabWeightKg,
      wheelseyePrice: v.totalPrice, // this type's total
      ftlPrice: Math.round((v.totalPrice * 1.2) / 10) * 10,
    })) || undefined;

  const vehicleBreakdown = engineResult.vehicles;

  return {
    price,
    weightBreakdown: {
      actualWeight: totalActualWeight,
      volumetricWeight: totalVolumetricWeight,
      chargeableWeight: finalChargeableWeight,
    },
    vehicle: vehicleLabel,
    vehicleLength: vehicleLengthLabel,
    matchedWeight: engineResult.chosenWeight,
    matchedDistance: distanceKm,
    vehiclePricing,
    vehicleCalculation: { totalVehiclesRequired },
    loadSplit: null,
    vehicleBreakdown,
  };

}




/**
 * Get vehicle type by weight (fallback function)
 * NOTE: weight parameter should be chargeableWeight (max of actual, volumetric)
 */
function getVehicleByWeight(weight: number): string {
  if (weight <= 1000) return "Tata Ace";
  if (weight <= 1200) return "Pickup";
  if (weight <= 1500) return "10 ft Truck";
  if (weight <= 4000) return "Eicher 14 ft";
  if (weight <= 7000) return "Eicher 19 ft";
  if (weight <= 10000) return "Eicher 20 ft";
  if (weight <= 18000) return "Container 32 ft MXL";
  return "Container 32 ft MXL + Additional Vehicle";
}

/**
 * Get vehicle length by weight (fallback function)
 * NOTE: weight parameter should be chargeableWeight (max of actual, volumetric)
 */
function getVehicleLengthByWeight(weight: number): number {
  if (weight <= 1000) return 7;
  if (weight <= 1200) return 8;
  if (weight <= 1500) return 10;
  if (weight <= 4000) return 14;
  if (weight <= 7000) return 19;
  if (weight <= 10000) return 20;
  return 32;
}

/**
 * Try multiple POST endpoints in order until one succeeds (non-404/400).
 * You can override the first item with VITE_* envs if the backend route is known.
 */
async function postFirstAvailable<T>(
  paths: string[],
  body: any,
  token?: string
): Promise<T> {
  const headers = AUTH_HEADER(token);
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const url = `${BASE_URL}${p}`;
      const res = await axios.post(url, body, { headers });
      return res.data as T;
    } catch (err: any) {
      const status = err?.response?.status;
      // keep trying on 404/400; bubble up other statuses (401/500 etc)
      if (status !== 404 && status !== 400) throw err;
      lastErr = err;
      // continue to next candidate
    }
  }
  throw lastErr ?? new Error("No matching endpoint found");
}

/**
 * Estimate distance based on pincode regions (fallback method)
 */
function estimateDistanceByPincode(fromPin: string, toPin: string): number {
  // Basic regional distance estimation based on pincode patterns
  const fromRegion = getRegionFromPincode(fromPin);
  const toRegion = getRegionFromPincode(toPin);
  
  // Regional distance matrix (rough estimates in km)
  const regionalDistances: Record<string, Record<string, number>> = {
    'north': { 'north': 200, 'south': 1500, 'east': 800, 'west': 600, 'central': 400 },
    'south': { 'north': 1500, 'south': 300, 'east': 400, 'west': 500, 'central': 600 },
    'east': { 'north': 800, 'south': 400, 'east': 200, 'west': 1000, 'central': 500 },
    'west': { 'north': 600, 'south': 500, 'east': 1000, 'west': 200, 'central': 400 },
    'central': { 'north': 400, 'south': 600, 'east': 500, 'west': 400, 'central': 200 }
  };
  
  return regionalDistances[fromRegion]?.[toRegion] || 500;
}

/**
 * Get region from pincode (basic estimation)
 */
function getRegionFromPincode(pincode: string): string {
  const pin = parseInt(pincode.substring(0, 2));
  
  if (pin >= 11 && pin <= 20) return 'north'; // Delhi, Haryana, Punjab
  if (pin >= 40 && pin <= 49) return 'west';  // Maharashtra, Gujarat
  if (pin >= 50 && pin <= 59) return 'south'; // Karnataka, Tamil Nadu, Kerala
  if (pin >= 60 && pin <= 69) return 'south'; // Tamil Nadu, Kerala
  if (pin >= 70 && pin <= 79) return 'east';  // West Bengal, Odisha
  if (pin >= 80 && pin <= 89) return 'east';  // Bihar, Jharkhand
  
  return 'central'; // Default fallback
}

/**
 * Distance provider (optional).
 * NOTE: We DO NOT call any distance endpoint unless an explicit env path is provided.
 * Prefer passing distanceKmOverride to the builder instead.
 */
export async function getDistanceKmByAPI(
  fromPin: string,
  toPin: string,
  token?: string
): Promise<number> {
  const explicit = import.meta.env.VITE_DISTANCE_ENDPOINT; // e.g. "/api/transporter/distance"
  if (!explicit) {
    // No explicit distance endpoint configured — avoid calling loose ends.
    throw new Error("No distance endpoint configured (VITE_DISTANCE_ENDPOINT).");
  }

  const candidates = [
    explicit,                                 // take env first if provided
    "/api/transporter/distance",
    "/api/transporter/getDistance",
    "/api/distance",
    "/distance",
  ].filter(Boolean) as string[];

  const data: any = await postFirstAvailable<any>(
    candidates,
    { fromPincode: fromPin, toPincode: toPin },
    token
  );

  const km =
    Number(
      data?.distanceKm ??
      data?.data?.distanceKm ??
      data?.result?.distanceKm
    ) || 0;

  if (!km) throw new Error("No distance in response");
  return km;
}

/** 
 * Wheelseye price — use local pricing data first, fallback to API 
 * NOTE: chargeableWeight should ALREADY be max(actual, volumetric)
 */
export async function getWheelseyePriceFromDB(
  chargeableWeight: number,
  distanceKm: number,
  shipment: ShipmentBox[],
  token?: string
): Promise<WheelseyeBreakdown> {
  // First, try to calculate using local pricing data
  try {
    console.log(`🚛 Using local Wheelseye pricing data for calculation (chargeableWeight=${chargeableWeight}kg)`);
    const localResult = calculateLocalWheelseyePrice(chargeableWeight, distanceKm, shipment);
    console.log(`✅ Local pricing calculation successful: ₹${localResult.price}`);
    return localResult;
  } catch (localError) {
    console.warn(`⚠️ Local pricing calculation failed, falling back to API:`, localError);
    
    // Fallback to API call if local calculation fails
    const explicit = import.meta.env.VITE_WHEELS_PRICE_ENDPOINT; // e.g. "/api/vendor/wheelseye-pricing"
    const candidates = [
      explicit,                                   // env wins if set
      "/api/vendor/wheelseye-pricing",           // correct endpoint
      "/api/wheelseye/pricing",                  // alternative endpoint
    ].filter(Boolean) as string[];

    try {
      const data = await postFirstAvailable<WheelseyeBreakdown>(
        candidates,
        { weight: chargeableWeight, distance: distanceKm, shipment_details: shipment },
        token
      );
      console.log(`✅ API pricing calculation successful: ₹${data.price}`);
      return data;
    } catch (apiError) {
      console.error(`❌ Both local and API pricing calculations failed:`, apiError);
      
      // Final fallback with basic calculation - use chargeableWeight
      const fallbackPrice = Math.max(3000, Math.round(distanceKm * 25 + chargeableWeight * 2));
      
      // Calculate weights from shipment for breakdown
      let totalVolumetricWeight = 0;
      let totalActualWeight = 0;
      shipment.forEach((box) => {
        const volumetric = (box.length * box.width * box.height * box.count) / 5000;
        totalVolumetricWeight += volumetric;
        totalActualWeight += box.weight * box.count;
      });
      
      return {
        price: fallbackPrice,
        weightBreakdown: {
          actualWeight: totalActualWeight,
          volumetricWeight: totalVolumetricWeight,
          chargeableWeight: chargeableWeight
        },
        vehicle: getVehicleByWeight(chargeableWeight),
        vehicleLength: getVehicleLengthByWeight(chargeableWeight),
        matchedWeight: chargeableWeight,
        matchedDistance: distanceKm
      };
    }
  }
}

/**
 * End-to-end builder:
 * - DOES NOT call any distance route unless distanceKmOverride is missing *and* VITE_DISTANCE_ENDPOINT is set.
 * - Prefer passing distance from your /calculate response via distanceKmOverride.
 * 
 * VOLUMETRIC WEIGHT FIX:
 * - Computes chargeableWeight = max(actualWeight, volumetricWeight) BEFORE any pricing calls
 * - All pricing, vehicle selection, and load-split logic uses chargeableWeight
 * - UI values (actualWeight, volumetricWeight) are still returned separately
 */
export async function buildFtlAndWheelseyeQuotes(opts: {
  fromPincode: string;
  toPincode: string;
  shipment: ShipmentBox[];
  totalWeight: number;
  token?: string;
  ekartFallback?: number;
  isWheelseyeServiceArea: (pin: string) => boolean;
  distanceKmOverride?: number; // <── Prefer this; avoids any distance API call
}) {
  const {
    fromPincode,
    toPincode,
    shipment,
    totalWeight,
    token,
    ekartFallback = 32000,
    isWheelseyeServiceArea,
    distanceKmOverride,
  } = opts;

  // 1) Distance: ALWAYS use the provided distance from main calculation (same as other vendors)
  // let distanceKm = 0;
  
  // console.log('Distance override received:', distanceKmOverride, 'type:', typeof distanceKmOverride);
  
  // if (typeof distanceKmOverride === "number" && distanceKmOverride > 0) {
  //   distanceKm = distanceKmOverride;
  //   console.log(`✅ Using provided distance from main calculation: ${distanceKm}km`);
  //   console.log(`✅ SKIPPING all distance calculations - using exact same distance as other vendors`);
  // }

let distanceKm = parseDistanceToKm(distanceKmOverride);

if (distanceKm <= 0) {
  console.error('❌ No valid distance provided!');
  return {
    distanceKm: 0,
    ftlQuote: null,
    wheelseyeQuote: null,
    numbers: { ftlPrice: 0, wheelseyePrice: 0, actualWeight: 0, volumetricWeight: 0, chargeableWeight: 0 },
  };

}else if (typeof distanceKmOverride === "number" && distanceKmOverride === 0) {
    console.error('❌ Distance override is 0 - this means main calculation failed to provide distance');
    console.error('❌ Cannot proceed with Wheelseye/Local FTL calculation without valid distance');
    return {
      distanceKm: 0,
      ftlQuote: null,
      wheelseyeQuote: null,
      numbers: { ftlPrice: 0, wheelseyePrice: 0, actualWeight: 0, volumetricWeight: 0, chargeableWeight: 0 },
    };
  } else {
    // Only calculate distance if not provided (should not happen in normal flow)
    console.warn('❌ No valid distance provided from main calculation, falling back to calculation');
    console.warn('❌ This should not happen - distance should always be provided from main calculation');
    try {
      distanceKm = await getDistanceKmByAPI(fromPincode, toPincode, token);
    } catch (error) {
      // Try to calculate distance using pincode coordinates as fallback
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'https://backend-2-4tjr.onrender.com'}/api/vendor/wheelseye-distance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
          },
          body: JSON.stringify({
            origin: fromPincode,
            destination: toPincode
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          distanceKm = data.distanceKm;
          console.log(`Distance calculated via backend: ${distanceKm}km`);
        } else {
          throw new Error('Backend distance calculation failed');
        }
      } catch (fallbackError) {
        // Final fallback: estimate based on pincode regions
        distanceKm = estimateDistanceByPincode(fromPincode, toPincode);
        console.warn(`Distance calculation failed, using estimated distance: ${distanceKm}km`);
      }
    }
  }

  // ============================================================================
  // 2) VOLUMETRIC WEIGHT FIX: Compute weights FIRST, before any pricing calls
  // ============================================================================
  
  // Calculate volumetric weight from shipment boxes
  let totalVolumetricWeight = 0;
  shipment.forEach((box) => {
    const volumetric = (box.length * box.width * box.height * box.count) / 5000;
    totalVolumetricWeight += volumetric;
  });

  // actualWeight = totalWeight passed from caller (sum of box weights)
  // volumetricWeight = calculated from dimensions
  // chargeableWeight = MAX of the two (this is what determines pricing & vehicle)
  const actualWeight = totalWeight;
  const volumetricWeight = totalVolumetricWeight;
  const chargeableWeight = Math.max(actualWeight, volumetricWeight);

  console.log(`📦 Weight calculation:`);
  console.log(`   - Actual weight: ${actualWeight}kg`);
  console.log(`   - Volumetric weight: ${Math.round(volumetricWeight)}kg`);
  console.log(`   - Chargeable weight (max): ${Math.round(chargeableWeight)}kg`);
  console.log(`   - Using ${volumetricWeight > actualWeight ? 'VOLUMETRIC' : 'ACTUAL'} weight for pricing`);

  // ============================================================================
  // 3) Compute Wheelseye + FTL using CHARGEABLE weight
  // ============================================================================
  
  let ftlPrice = 0;
  let wheelseyePrice = 0;
  let wheelseyeResult: WheelseyeBreakdown | null = null;

  try {
    console.log(`🚛 Calling Wheelseye pricing with chargeableWeight: ${Math.round(chargeableWeight)}kg, distance: ${distanceKm}km`);
    
    // CRITICAL FIX: Use chargeableWeight instead of totalWeight
    wheelseyeResult = await getWheelseyePriceFromDB(
      chargeableWeight,  // ← FIXED: was totalWeight
      distanceKm,
      shipment,
      token
    );

    // Engine now handles ALL weight ranges including >18T
    // No need for manual splitting here
    wheelseyePrice = wheelseyeResult.price;
    ftlPrice = Math.round((wheelseyePrice * 1.2) / 10) * 10;
  } catch (e) {
    console.warn("Wheelseye pricing failed, using fallback:", e);
    ftlPrice = Math.round((ekartFallback * 1.1) / 10) * 10;
    wheelseyePrice = Math.round((ekartFallback * 0.95) / 10) * 10;
  }

  // Check if load is too light for FTL (use chargeableWeight for this check too)
  const tooLight = chargeableWeight < 500;

  // Vehicle selection helpers - use chargeableWeight
  const makeVehicleByWeight = (w: number) =>
    w > 18000
      ? "Container 32 ft MXL + Additional Vehicle"
      : w <= 1000
      ? "Tata Ace"
      : w <= 1500
      ? "Pickup"
      : w <= 2000
      ? "10 ft Truck"
      : w <= 4000
      ? "Eicher 14 ft"
      : w <= 7000
      ? "Eicher 19 ft"
      : w <= 10000
      ? "Eicher 20 ft"
      : "Container 32 ft MXL";

  const makeVehicleLen = (w: number) =>
    w > 18000
      ? "32 ft + Additional"
      : w <= 1000
      ? 7
      : w <= 1500
      ? 8
      : w <= 2000
      ? 10
      : w <= 4000
      ? 14
      : w <= 7000
      ? 19
      : w <= 10000
      ? 20
      : 32;

  const etaDays = (km: number) => Math.ceil(km / 400);

  // Base quote object - includes all weight values for UI
  const base = {
    actualWeight,
    volumetricWeight,
    chargeableWeight,
    matchedWeight: wheelseyeResult?.matchedWeight ?? chargeableWeight,
    matchedDistance: wheelseyeResult?.matchedDistance ?? distanceKm,
    distance: `${Math.round(distanceKm)} km`,
    originPincode: fromPincode,
    destinationPincode: toPincode,
    isTiedUp: false,
  };

  // Build FTL quote - vehicle selection based on chargeableWeight
  const ftlQuote =
    !tooLight && isWheelseyeServiceArea(fromPincode)
      ? {
          ...base,
          message: "",
          isHidden: false,
          transporterData: { 
            _id: "local-ftl-transporter",
            rating: 4.6,
            name: "LOCAL FTL",
            type: "FTL"
          },
          companyName: "LOCAL FTL",
          transporterName: "LOCAL FTL",
          category: "LOCAL FTL",
          totalCharges: ftlPrice,
          price: ftlPrice,
          total: ftlPrice,
          totalPrice: ftlPrice,
          estimatedTime: etaDays(distanceKm),
          estimatedDelivery: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          deliveryTime: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          // Vehicle selection uses chargeableWeight
          vehicle:
            wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
          vehicleLength:
            wheelseyeResult?.vehicleLength ?? makeVehicleLen(chargeableWeight),
          loadSplit: wheelseyeResult?.loadSplit ?? null,
          vehicleBreakdown: (wheelseyeResult as any)?.vehicleBreakdown ?? null,
        }
      : null;

  console.log(`🚛 Local FTL quote created with distance: ${Math.round(distanceKm)} km, price: ₹${ftlPrice}`);

  // Normalise vehicle breakdown & vehicleCalculation from wheelseyeResult
  const rawVehicleBreakdown =
    Array.isArray((wheelseyeResult as any)?.vehicleBreakdown)
      ? (wheelseyeResult as any).vehicleBreakdown
      : Array.isArray((wheelseyeResult as any)?.vehicleCalculation?.vehicleBreakdown)
      ? (wheelseyeResult as any).vehicleCalculation.vehicleBreakdown
      : [];

  const normalisedVehicleBreakdown = rawVehicleBreakdown.map((v: any) => ({
    ...v,
    count: v.count ?? 1,
  }));

  const totalVehiclesRequired = normalisedVehicleBreakdown.length
    ? normalisedVehicleBreakdown.reduce(
        (sum: number, v: any) => sum + (v.count ?? 1),
        0
      )
    : undefined;

  const totalVehiclePrice = normalisedVehicleBreakdown.length
    ? normalisedVehicleBreakdown.reduce(
        (sum: number, v: any) => sum + (Number(v.price) || 0),
        0
      )
    : undefined;

  // Build Wheelseye quote - vehicle selection based on chargeableWeight
  const wheelseyeQuote =
    !tooLight && isWheelseyeServiceArea(fromPincode)
      ? {
          ...base,
          message: "",
          isHidden: false,
          transporterData: {
            _id: "wheelseye-ftl-transporter",
            rating: 4.6,
            name: "Wheelseye FTL",
            type: "FTL",
          },
          companyName: "Wheelseye FTL",
          transporterName: "Wheelseye FTL",
          category: "Wheelseye FTL",

          totalCharges: wheelseyePrice,
          price: wheelseyePrice,
          total: wheelseyePrice,
          totalPrice: wheelseyePrice,

          estimatedTime: etaDays(distanceKm),
          estimatedDelivery: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,
          deliveryTime: `${etaDays(distanceKm)} Day${
            etaDays(distanceKm) > 1 ? "s" : ""
          }`,

          // Vehicle selection uses chargeableWeight
          vehicle:
            wheelseyeResult?.vehicle ?? makeVehicleByWeight(chargeableWeight),
          vehicleLength:
            wheelseyeResult?.vehicleLength ??
            makeVehicleLen(chargeableWeight),

          // Legacy LTL-style splitting (will only be used when no FTL combo)
          loadSplit: wheelseyeResult?.loadSplit ?? null,

          // Flat vehicleBreakdown for UI
          vehicleBreakdown:
            normalisedVehicleBreakdown.length > 0
              ? normalisedVehicleBreakdown
              : null,

          // Nested vehicleCalculation for UI + future logic
          vehicleCalculation: {
            ...(wheelseyeResult as any)?.vehicleCalculation,
            vehicleBreakdown: normalisedVehicleBreakdown,
            totalVehiclesRequired:
              totalVehiclesRequired ??
              (wheelseyeResult as any)?.vehicleCalculation
                ?.totalVehiclesRequired,
            totalPrice: totalVehiclePrice ?? wheelseyePrice,
          },
        }
      : null;

  console.log(
    `🚛 Wheelseye quote created with distance: ${Math.round(
      distanceKm
    )} km, price: ₹${wheelseyePrice}`
  );

  // Debug block for troubleshooting
  console.log("🔍 DEBUG - wheelseyeResult.vehicleBreakdown:", 
    JSON.stringify(wheelseyeResult?.vehicleBreakdown, null, 2)
  );
  console.log("🔍 DEBUG - ftlQuote.vehicleBreakdown:", 
    ftlQuote?.vehicleBreakdown ? JSON.stringify(ftlQuote.vehicleBreakdown, null, 2) : "null"
  );
  console.log("🔍 DEBUG - wheelseyeQuote.vehicleBreakdown:", 
    wheelseyeQuote?.vehicleBreakdown ? JSON.stringify(wheelseyeQuote.vehicleBreakdown, null, 2) : "null"
  );

  return {
    distanceKm,
    ftlQuote,
    wheelseyeQuote,
    numbers: {
      ftlPrice,
      wheelseyePrice,
      actualWeight,
      volumetricWeight,
      chargeableWeight,
    },
    wheelseyeRaw: wheelseyeResult,
  };
}