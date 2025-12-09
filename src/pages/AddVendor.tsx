// src/pages/AddVendor.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { persistDraft } from '../store/draftStore';
// Hooks (keep your originals)
import { useVendorBasics } from '../hooks/useVendorBasics';
import { usePincodeLookup } from '../hooks/usePincodeLookup';
import { useVolumetric } from '../hooks/useVolumetric';
import { useCharges } from '../hooks/useCharges';

// ✅ Wizard storage hook
import { useWizardStorage } from '../hooks/useWizardStorage';

// Components (keep your originals)
import { CompanySection } from '../components/CompanySection';
import { TransportSection } from '../components/TransportSection';
import { ChargesSection } from '../components/ChargesSection';
import { PriceChartUpload } from '../components/PriceChartUpload';
import { SavedVendorsTable } from '../components/SavedVendorsTable';

// Utils (unchanged)
import { readDraft, clearDraft } from '../store/draftStore';
import { emitDebug, emitDebugError } from '../utils/debug';

// New numeric helpers
import { sanitizeDigitsOnly, clampNumericString } from '../utils/inputs';
import { validateGST } from '../utils/validators';

// Wizard validation utilities
import {
  validateWizardData,
  getWizardStatus,
  type ValidationResult,
  type WizardStatus,
} from '../utils/wizardValidation';


// Icons
import { CheckCircleIcon, XCircleIcon, AlertTriangle, RefreshCw, FileText, EyeIcon } from 'lucide-react';

// Optional email validator
import isEmail from 'isemail';

// ScrollToTop helper (smooth scroll to ref when `when` changes)
import ScrollToTop from '../components/ScrollToTop'; // adjust path if needed

// ============================================================================
// CONFIG / HELPERS
// ============================================================================

// ---------------- CHARGES NORMALIZATION HELPERS ----------------

/**
 * Generic parser for a single charge group with mode:
 * group = { mode: 'FIXED' | 'VARIABLE', fixed, fixedAmount, variable, variablePercent, ... }
 * Returns exactly one of (fixed, variable) as non-zero based on mode.
 */
function normalizeChargeGroup(group: any): { fixed: number; variable: number } {
  if (!group) return { fixed: 0, variable: 0 };

  const rawMode =
    (group.mode ||
      group.chargeMode ||     // adjust if you use different key
      '').toString().toUpperCase();

  const fixedRaw =
    group.fixedAmount ??
    group.fixedRate ??
    group.fixed ??
    group.amount ??
    0;

  const variableRaw =
    group.variableRange ??
    group.variablePct ??
    group.variablePercent ??
    group.variable ??
    0;

  const fixed = Number(fixedRaw) || 0;
  const variable = Number(variableRaw) || 0;

  if (rawMode === 'FIXED') {
    return { fixed, variable: 0 };
  }
  if (rawMode === 'VARIABLE') {
    return { fixed: 0, variable };
  }

  // Fallback: if mode is missing, send both as-is (you can tighten this later)
  return { fixed, variable };
}

/**
 * Read a simple numeric charge from charges root, with multiple key options.
 * You will adjust key names here ONCE if your hook uses different ones.
 */
function readSimpleCharge(root: any, ...keys: string[]): number {
  if (!root) return 0;
  for (const key of keys) {
    if (root[key] !== undefined && root[key] !== null && root[key] !== '') {
      const num = Number(root[key]);
      if (!Number.isNaN(num)) return num;
    }
  }
  return 0;
}



// ✅ Use your deployed backend (from the "working" version)
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || 'https://backend-2-4tjr.onrender.com').replace(/\/+$/, '');

const ZPM_KEY = 'zonePriceMatrixData';

type PriceMatrix = Record<string, Record<string, number>>;
type ZonePriceMatrixLS = {
  zones: unknown[];
  priceMatrix: PriceMatrix;
  timestamp: string;
};

function getAuthToken(): string {
  return (
    Cookies.get('authToken') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    ''
  );
}

function base64UrlToJson<T = any>(b64url: string): T | null {
  try {
    const b64 = b64url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(b64url.length / 4) * 4, '=');
    const json = atob(b64);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function getCustomerIDFromToken(): string {
  const token = getAuthToken();
  if (!token || token.split('.').length < 2) return '';
  const payload = base64UrlToJson<Record<string, any>>(token.split('.')[1]) || {};
  const id =
    payload?.customer?._id ||
    payload?.user?._id ||
    payload?._id ||
    payload?.id ||
    payload?.customerId ||
    payload?.customerID ||
    '';
  return id || '';
}

/** Capitalize every word (auto-capitalize) */
function capitalizeWords(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .trim();
}

/** GSTIN regex (standard government format) */
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

/** Simple email fallback regex */
const EMAIL_FALLBACK_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Safe getters */
function safeGetField(obj: any, ...keys: string[]): string {
  if (!obj) return '';
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      return String(val);
    }
  }
  return '';
}
function safeGetNumber(obj: any, defaultVal: number, ...keys: string[]): number {
  if (!obj) return defaultVal;
  for (const key of keys) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  }
  return defaultVal;
}

/** LocalStorage loader (legacy - for backwards compatibility) */
function safeLoadZPM(): ZonePriceMatrixLS | null {
  try {
    const raw = localStorage.getItem(ZPM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.priceMatrix && typeof parsed.priceMatrix === 'object') return parsed;
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const AddVendor: React.FC = () => {
  // Hooks (manage sub-section state/UI)
  const vendorBasics = useVendorBasics();
  const pincodeLookup = usePincodeLookup();
  const volumetric = useVolumetric();
  const charges = useCharges();

  // Wizard storage hook
  const { wizardData, isLoaded: wizardLoaded, clearWizard } = useWizardStorage();

  // Page-level state
  const [transportMode, setTransportMode] = useState<'road' | 'air' | 'rail' | 'ship'>('road');
  const [priceChartFile, setPriceChartFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Overlay + ScrollToTop state (ADDED)
  const [showSubmitOverlay, setShowSubmitOverlay] = useState(false);
  const [submitOverlayStage, setSubmitOverlayStage] =
    useState<'loading' | 'success'>('loading');
  // 👉 for ScrollToTop
  const topRef = useRef<HTMLDivElement | null>(null);
  const [scrollKey, setScrollKey] = useState<number | string>(0);

  // Invoice Value State (New)
  const [invoicePercentage, setInvoicePercentage] = useState<string>('');
  const [invoiceMinAmount, setInvoiceMinAmount] = useState<string>('');
  const [invoiceUseMax, setInvoiceUseMax] = useState<boolean>(false);
  const [invoiceManualOverride, setInvoiceManualOverride] = useState<boolean>(false);
  const [showInvoiceSection, setShowInvoiceSection] = useState<boolean>(false);
  // Token viewer (debug)
  const [tokenPanelOpen, setTokenPanelOpen] = useState(false);
  const [tokenValue, setTokenValue] = useState<string>('');
  const [tokenPayload, setTokenPayload] = useState<any>(null);

  // Zone Price Matrix (from wizard/localStorage)
  const [zpm, setZpm] = useState<ZonePriceMatrixLS | null>(null);

  // Wizard validation state
  const [wizardValidation, setWizardValidation] = useState<ValidationResult | null>(null);
  const [wizardStatus, setWizardStatus] = useState<WizardStatus | null>(null);

  const navigate = useNavigate();

  // Prevent double-run in React StrictMode / dev double-mounts
  const mountRan = useRef(false);

  // Load zone data from localStorage (legacy method)
  const loadZoneData = useCallback(() => {
    const data = safeLoadZPM();
    setZpm(data);
    emitDebug('ZPM_LOADED', { hasData: !!data, data });
    if (!data && (!wizardData || !wizardData.priceMatrix)) {
      toast.error('No zone matrix found. Open the wizard to create one.', {
        duration: 2200,
        id: 'zpm-missing',
      });
    } else if (data) {
      toast.success('Zone matrix loaded from browser', {
        duration: 1400,
        id: 'zpm-loaded',
      });
    }
  }, [wizardData]);

  // Validate wizard data when loaded
  useEffect(() => {
    if (wizardLoaded && wizardData) {
      const validation = validateWizardData(wizardData);
      const status = getWizardStatus(wizardData);
      setWizardValidation(validation);
      setWizardStatus(status);
      emitDebug('WIZARD_VALIDATION', { validation, status });
    }
  }, [wizardLoaded, wizardData]);

  const matrixSize = useMemo(() => {
    // Prioritize wizard data, fallback to legacy localStorage
    const matrix = wizardData?.priceMatrix || zpm?.priceMatrix || {};
    const rows = Object.keys(matrix).length;
    const cols = rows ? Object.keys(Object.values(matrix)[0] ?? {}).length : 0;
    return { rows, cols };
  }, [zpm, wizardData]);

  // Load draft + zone matrix on mount
  useEffect(() => {
    if (mountRan.current) return;
    mountRan.current = true;

    const draft = readDraft();
    if (draft) {
      emitDebug('DRAFT_LOADED_ON_MOUNT', draft);
      try {
        if (draft.basics && typeof vendorBasics.loadFromDraft === 'function') {
          vendorBasics.loadFromDraft(draft.basics);
          if (draft.basics.transportMode) setTransportMode(draft.basics.transportMode);
        }
        if (draft.geo && typeof pincodeLookup.loadFromDraft === 'function') {
          pincodeLookup.loadFromDraft(draft.geo);
        }
        if (draft.volumetric && typeof volumetric.loadFromDraft === 'function') {
          volumetric.loadFromDraft(draft.volumetric);
        }
        if (draft.charges && typeof charges.loadFromDraft === 'function') {
          charges.loadFromDraft(draft.charges);
        }
        toast.success('Draft restored', { duration: 1600, id: 'draft-restored' });
      } catch (err) {
        emitDebugError('DRAFT_LOAD_ERROR', { err });
        toast.error('Failed to restore draft completely');
      }
    }
    loadZoneData(); // also load zone matrix from localStorage (legacy)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  //useffect for auto-fill of invoice value charges//
  useEffect(() => {
  // Don't overwrite if user manually changed invoice fields
  if (invoiceManualOverride) return;

  // Defensive read of rov data from charges hook
  const rov = (charges && (charges.charges || (charges as any)))?.rovCharges || (charges && (charges as any)?.rov) || null;
  if (!rov) return;

  const mode = (rov.mode || (rov.currency === 'INR' ? 'FIXED' : rov.currency === 'PERCENT' ? 'VARIABLE' : '') || '').toString().toUpperCase();

  const toStr = (v: any) => (v === undefined || v === null ? '' : String(v));

  if (mode === 'FIXED') {
    // when ROV is fixed -> invoice min := fixed amount, percentage := 0.0001, useMax := true
    const fixedVal = rov.fixedAmount ?? rov.fixed ?? rov.fixedRate ?? 0;
    const fixedStr = String(Number(fixedVal) || 0);
    setInvoiceMinAmount(fixedStr);
    setInvoicePercentage('0.0001');
    setInvoiceUseMax(true);
  } else if (mode === 'VARIABLE') {
    // when ROV is variable -> invoice percentage := rov variable, min := 0, useMax := true
    const varVal = rov.variableRange ?? rov.variable ?? rov.variablePct ?? rov.variablePercent ?? '';
    const varStr = toStr(varVal);
    setInvoicePercentage(varStr);
    setInvoiceMinAmount('0');
    setInvoiceUseMax(true);
  }
}, [
  // watch the rov object specifically so the effect runs only when ROV changes
  charges?.charges?.rovCharges,
  // include manual override so we bail out if it changes
  invoiceManualOverride,
]);
// 🔥 Auto-persist pincode so it doesn't disappear when returning from Wizard
useEffect(() => {
  if (!pincodeLookup?.geo?.pincode) return;

  persistDraft({
    geo: {
      pincode: pincodeLookup.geo.pincode,
      state: pincodeLookup.geo.state,
      city: pincodeLookup.geo.city,
    },
  });
}, [
  pincodeLookup?.geo?.pincode,
  pincodeLookup?.geo?.state,
  pincodeLookup?.geo?.city,
]);

  // ===== Local validation for basics =====
  const validateVendorBasicsLocal = (): { ok: boolean; errs: string[] } => {
    const errs: string[] = [];
    const b = vendorBasics.basics || {};
    const geo = pincodeLookup.geo || {};

    // ---- map to new company section fields ----
    const legalName = capitalizeWords(
      safeGetField(b, 'legalCompanyName', 'name', 'companyName', 'company')
    ).slice(0, 60);

    const contactPerson = capitalizeWords(
      safeGetField(b, 'contactPersonName')
    ).slice(0, 30);

    const subVendor = capitalizeWords(
      safeGetField(b, 'subVendor', 'sub_vendor')
    ).slice(0, 20);

    // ✅ FIXED: Use 'b' not 'basics' - allow alphanumeric
    const vendorCode = safeGetField(b, 'vendorCode', 'vendor_code')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 9);

    // ✅ FIXED: Use 'b' instead of 'basics'
    const vendorPhone = sanitizeDigitsOnly(
      safeGetField(b, 'vendorPhoneNumber', 'vendorPhone', 'primaryContactPhone')
    ).slice(0, 10);

    const vendorEmail = safeGetField(
      b,
      'vendorEmailAddress',
      'vendorEmail',
      'primaryContactEmail'
    ).trim();

    const gstin = safeGetField(b, 'gstin', 'gst', 'gstNo')
      .toUpperCase()
      .replace(/\s+/g, '')
      .slice(0, 15);
    if (gstin) {
      const gstError = validateGST(gstin);
      if (gstError) errs.push(gstError);
    }
    const address = safeGetField(b, 'address').trim().slice(0, 150);

    // ---- basic text length and required checks ----
    if (!legalName || legalName.trim().length === 0) {
      errs.push('Legal Transporter name is required (max 60 chars).');
    }
    if (legalName.trim().length > 60) {
      errs.push('Legal Transporter name must be at most 60 characters.');
    }

    if (!contactPerson || contactPerson.trim().length === 0) {
      errs.push('Contact person is required (max 30 chars).');
    }
    if (contactPerson.trim().length > 30) {
      errs.push('Contact person must be at most 30 characters.');
    }

    if (subVendor && subVendor.trim().length > 20) {
      errs.push('Sub vendor must be at most 20 characters.');
    }

    // ✅ FIXED: Allow alphanumeric vendor codes
    if (!/^[A-Za-z0-9]{1,9}$/.test(vendorCode)) {
      errs.push('Vendor code must be 1 to 9 characters, letters and digits only.');
    }

    if (!/^[1-9][0-9]{9}$/.test(vendorPhone)) {
      errs.push('Contact number must be 10 digits and cannot start with 0.');
    }

    // ---- email validation (unchanged logic) ----
    let emailOk = false;
    try {
      emailOk = !!(
        vendorEmail &&
        (isEmail.validate ? isEmail.validate(vendorEmail) : isEmail(vendorEmail))
      );
    } catch {
      emailOk = EMAIL_FALLBACK_RE.test(vendorEmail);
    }
    if (!emailOk) {
      errs.push('Invalid email address (must include a domain and a dot).');
    }

    // ---- GST validation (same regex) ----
    if (!GST_REGEX.test(gstin)) {
      errs.push('GST number must be a valid 15-character GSTIN.');
    }

    // ---- address ----
    if (!address || address.trim().length === 0) {
      errs.push('Address is required (max 150 chars).');
    }
    if (address.trim().length > 150) {
      errs.push('Address must be at most 150 characters.');
    }

    // ---- fuel surcharge (unchanged) ----
    try {
      const c = charges.charges || {};
      const fuel = safeGetNumber(c, 0, 'fuelSurcharge', 'fuel');
      if (!Number.isFinite(fuel) || fuel < 0 || fuel > 50) {
        errs.push('Fuel surcharge must be between 0 and 50.');
      }
    } catch {
      /* ignore */
    }

    // ---- pincode from geo: must be exactly 6 digits ----
    const pincodeStr = String(geo.pincode ?? '')
      .replace(/\D+/g, '')
      .slice(0, 6);
    if (pincodeStr && pincodeStr.length !== 6) {
      errs.push('Pincode looks invalid (must be exactly 6 digits).');
    }

    // ---- serviceMode & companyRating (new fields) ----
    const serviceMode = (b as any).serviceMode;
    if (!serviceMode || (serviceMode !== 'FTL' && serviceMode !== 'LTL')) {
      errs.push('Please select a service mode.');
    }

    const rating = (b as any).companyRating;
    if (rating === null || rating === undefined || rating === '') {
      errs.push('Please select a company rating.');
    } else {
      const n = Number(rating);
      if (!Number.isFinite(n) || n < 1 || n > 5) {
        errs.push('Company rating must be between 1 and 5.');
      }
    }

    return { ok: errs.length === 0, errs };
  };


  // ===== GLOBAL VALIDATION (with detailed debug + toasts + bypassValidation) =====
  // ===== GLOBAL VALIDATION (EXACT ERROR REPORTING) =====
  const validateAll = (): boolean => {
    // We use a Set to automatically remove duplicate error messages
    const uniqueErrors = new Set<string>();

    console.debug('[VALIDATION] Starting exact validation checks');

    // 1. EXACT LOCAL CHECKS (Run these FIRST to get specific messages)
    try {
      const local = validateVendorBasicsLocal();
      if (!local.ok) {
        local.errs.forEach(e => uniqueErrors.add(e));
      }
    } catch (err) {
      console.error('[VALIDATION] validateVendorBasicsLocal threw', err);
      uniqueErrors.add('Error checking specific company details (check console).');
    }

    // 2. WIZARD / ZONE CHECKS (Extract specific zone errors)
    if (wizardData && !wizardValidation?.isValid) {
      if (wizardValidation?.errors && wizardValidation.errors.length > 0) {
        // Add specific errors like "Zone NE2 is incomplete"
        wizardValidation.errors.forEach(e => uniqueErrors.add(e));
      } else {
        uniqueErrors.add('Wizard configuration is invalid (check Zone setup).');
      }
    }

    // 3. HOOK STATE CHECKS (Trigger Red Borders)
    // We still run these functions because they turn the input borders red in the UI,
    // but we only add a message if we haven't already caught a specific error for that section.
    
    // Vendor Basics (UI Red Borders)
    const vbOk = typeof vendorBasics.validateAll === 'function' ? vendorBasics.validateAll() : true;
    // Note: We rely on 'validateVendorBasicsLocal' (step 1) for the text message, so we don't push a generic one here.

    // Pincode (UI Red Borders + Message)
    const plOk = typeof pincodeLookup.validateGeo === 'function' ? pincodeLookup.validateGeo() : true;
    if (!plOk) uniqueErrors.add('Location/Pincode information is incomplete.');

    // Volumetric (UI Red Borders + Message)
    const volOk = typeof volumetric.validateVolumetric === 'function' ? volumetric.validateVolumetric() : true;
    if (!volOk) uniqueErrors.add('Volumetric configuration is invalid.');

    // Charges (UI Red Borders + Message)
    const chOk = typeof charges.validateAll === 'function' ? charges.validateAll() : true;
    if (!chOk) uniqueErrors.add('Charges configuration is invalid.');

    // 4. Matrix Check (Essential)
    const hasWizardMatrix = wizardData?.priceMatrix && Object.keys(wizardData.priceMatrix).length > 0;
    const hasLegacyMatrix = zpm?.priceMatrix && Object.keys(zpm.priceMatrix).length > 0;

    if (!hasWizardMatrix && !hasLegacyMatrix) {
      uniqueErrors.add('Zone Price Matrix is missing. Please Open Wizard > Save > Reload Data.');
    }

    // 5. BYPASS CHECK
    const urlParams = new URLSearchParams(window.location.search);
    const bypass = urlParams.get('bypassValidation') === '1';
    
    if (bypass && uniqueErrors.size > 0) {
      console.warn('[VALIDATION] Bypassing errors:', Array.from(uniqueErrors));
      toast.success('Validation bypassed (Dev Mode)', { icon: '⚠️' });
      return true;
    }

    // 6. FINAL VERDICT
    if (uniqueErrors.size > 0) {
      // Convert Set back to Array and show toasts
      Array.from(uniqueErrors).forEach((msg) => {
        toast.error(msg, { duration: 5000 });
      });
      
      emitDebugError('VALIDATION_FAILED', { errs: Array.from(uniqueErrors) });
      return false;
    }

    return true;
  };

  // ===== Token debug panel =====
  const handleShowToken = () => {
    const tok = getAuthToken();
    if (!tok) {
      toast.error('No token found (login again?)');
      setTokenPanelOpen(true);
      setTokenValue('');
      setTokenPayload(null);
      return;
    }
    const payload =
      tok.split('.').length >= 2 ? base64UrlToJson(tok.split('.')[1]) : null;
    setTokenValue(tok);
    setTokenPayload(payload);
    setTokenPanelOpen(true);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };




  // ===== Build API payload (uses wizard data OR legacy localStorage) =====
  const buildPayloadForApi = () => {
    // 🔍 DEBUG: Log raw form state BEFORE processing
    console.log('📋 RAW FORM STATE (before buildPayloadForApi):', {
      'vendorBasics.basics': vendorBasics.basics,
      'charges.charges': charges.charges,
      'volumetric.state': volumetric.state,
      'pincodeLookup.geo': pincodeLookup.geo,
    });
    
    const basics = vendorBasics.basics || {};
    const geo = pincodeLookup.geo || {};

    const name = capitalizeWords(safeGetField(basics, 'name', 'companyName')).slice(0, 60);
    const displayName = capitalizeWords(
      safeGetField(basics, 'displayName', 'display_name'),
    ).slice(0, 30);
    const companyName = capitalizeWords(
      safeGetField(basics, 'legalCompanyName', 'companyName', 'company_name'),
    ).slice(0, 30);
    const primaryCompanyName = capitalizeWords(
      safeGetField(basics, 'primaryCompanyName', 'primaryCompany'),
    ).slice(0, 25);
    const subVendor = capitalizeWords(safeGetField(basics, 'subVendor', 'sub_vendor')).slice(
      0,
      20,
    );
    
    // ✅ FIX 1: Extract contactPerson
    const contactPerson = capitalizeWords(
      safeGetField(basics, 'contactPerson', 'contactPersonName', 'primaryContactName')
    ).slice(0, 100);

    // ✅ FIXED: Use 'basics' not 'b' - allow alphanumeric
    const vendorCode = safeGetField(basics, 'vendorCode', 'vendor_code')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')   // keep only A–Z and 0–9
      .slice(0, 9);

    const vendorPhoneStr = sanitizeDigitsOnly(
      safeGetField(basics, 'vendorPhoneNumber', 'vendorPhone', 'primaryContactPhone'),
    ).slice(0, 10);
    const vendorPhoneNum = Number(
      clampNumericString(vendorPhoneStr, 1000000000, 9999999999, 10) || 0,
    );

    const vendorEmail = safeGetField(
      basics,
      'vendorEmailAddress',
      'vendorEmail',
      'primaryContactEmail',
    ).trim();
    const gstNo = safeGetField(basics, 'gstin', 'gstNo', 'gst')
      .toUpperCase()
      .replace(/\s+/g, '')
      .slice(0, 15);
    const address = safeGetField(basics, 'address').trim().slice(0, 150);
    
    // ✅ FIX 2: Extract city from geo
    const city = String(geo.city ?? '').trim().slice(0, 50);
    
    // ✅ FIX 3: Extract rating from basics
    const rating = Number(safeGetField(basics, 'rating', 'companyRating')) || 4;
    
    // ✅ FIX 4: Extract service mode (FTL/LTL)
    const serviceMode = safeGetField(basics, 'serviceMode', 'service_mode') || 'FTL';

    // ✅ FIXED: Direct access to volumetric.state
    const volState = volumetric.state || {};
    const volUnit = volState.unit || 'cm';

    emitDebug('VOLUMETRIC_DATA_DEBUG', {
      volState,
      volUnit,
      fullVolumetricHook: volumetric,
    });

    const volumetricBits =
      volUnit === 'cm'
        ? {
            divisor: volState.volumetricDivisor || null,
            cftFactor: null as number | null,
          }
        : {
            divisor: null as number | null,
            cftFactor: volState.cftFactor || null,
          };

    emitDebug('VOLUMETRIC_BITS_MAPPED', volumetricBits);

    // ✅ FIXED: Preserve decimals instead of stripping them
    const parseCharge = (
      val: any,
      min = 0,
      max = 100000,
      digitLimit?: number,
    ): number => {
      if (val === undefined || val === null || val === '') return 0;
      
      // Convert to number directly (preserves decimals)
      const num = Number(val);
      
      // Return 0 if NaN
      if (isNaN(num)) return 0;
      
      // Clamp to min/max
      const clamped = Math.min(Math.max(num, min), max);
      
      // Round to 2 decimal places to avoid floating point issues
      return Math.round(clamped * 100) / 100;
    };

    const c = charges.charges || {};

    // 🔍 Normalize all toggle-based groups ONCE using your helper
    const rovNorm        = normalizeChargeGroup(c.rovCharges);
    const codNorm        = normalizeChargeGroup(c.codCharges);
    const topayNorm = normalizeChargeGroup(c.toPayCharges);  // ✅ Capital P
    const handlingNorm   = normalizeChargeGroup(c.handlingCharges);
    const appointNorm    = normalizeChargeGroup(c.appointmentCharges);
    const insuranceNorm  = normalizeChargeGroup(c.insuranceCharges || c.insuaranceCharges);
    const odaNorm        = normalizeChargeGroup(c.odaCharges);
    const prepaidNorm    = normalizeChargeGroup(c.prepaidCharges);
    const fmNorm         = normalizeChargeGroup(c.fmCharges);

    // ✅ serviceMode + volumetricUnit + all simple numeric charges
    const priceRate = {
      serviceMode: serviceMode,
      volumetricUnit: volUnit,

      // simple one–value fields
      minWeight: parseCharge(
        safeGetNumber(c, 0, 'minWeightKg'),  // ✅ Correct field name
        0,
        10000,
        5,
      ),
      docketCharges: parseCharge(
        safeGetNumber(c, 0, 'docketCharges'),
        0,
        10000,
        5,
      ),
      fuel: parseCharge(
        safeGetNumber(c, 0, 'fuelSurchargePct'),  // ✅ Correct field name
        0,
        50,
        2,
      ),

      // 🔁 ROV / COD / To-Pay etc – use normalized values
      rovCharges: {
        fixed:    parseCharge(rovNorm.fixed,    0, 100000),
        variable: parseCharge(rovNorm.variable, 0, 100000),
      },
      codCharges: {
        fixed:    parseCharge(codNorm.fixed,    0, 100000),
        variable: parseCharge(codNorm.variable, 0, 100000),
      },
      topayCharges: {
        fixed:    parseCharge(topayNorm.fixed,    0, 100000),
        variable: parseCharge(topayNorm.variable, 0, 100000),
      },
      handlingCharges: {
        fixed:    parseCharge(handlingNorm.fixed,    0, 100000),
        variable: parseCharge(handlingNorm.variable, 0, 100000),
        threshholdweight: parseCharge(
          safeGetNumber(
            c.handlingCharges || c,
            0,
            'threshholdweight',
            'handlingThresholdWeight',
            'thresholdWeight',
          ),
          0,
          100000,
        ),
      },
      appointmentCharges: {
        fixed:    parseCharge(appointNorm.fixed,    0, 100000),
        variable: parseCharge(appointNorm.variable, 0, 100000),
      },

      // ====== volumetric (see next section) ======
      ...volumetricBits,

      // basic numeric add-ons
      minCharges: parseCharge(
        safeGetNumber(c, 0, 'minimumCharges', 'minCharges'),
        0,
        100000,
      ),
      greenTax: parseCharge(
        safeGetNumber(c, 0, 'greenTax', 'ngt'),
        0,
        100000,
      ),
      daccCharges: parseCharge(
        safeGetNumber(c, 0, 'daccCharges'),
        0,
        100000,
      ),
      miscellanousCharges: parseCharge(
        safeGetNumber(c, 0, 'miscCharges', 'miscellanousCharges'),
        0,
        100000,
      ),

      insuaranceCharges: {
        fixed:    parseCharge(insuranceNorm.fixed,    0, 100000),
        variable: parseCharge(insuranceNorm.variable, 0, 100000),
      },
      odaCharges: {
        fixed:    parseCharge(odaNorm.fixed,    0, 100000),
        variable: parseCharge(odaNorm.variable, 0, 100000),
      },
      prepaidCharges: {
        fixed:    parseCharge(prepaidNorm.fixed,    0, 100000),
        variable: parseCharge(prepaidNorm.variable, 0, 100000),
      },
      fmCharges: {
        fixed:    parseCharge(fmNorm.fixed,    0, 100000),
        variable: parseCharge(fmNorm.variable, 0, 100000),
      },

      hamaliCharges: parseCharge(
        safeGetNumber(c, 0, 'hamaliCharges', 'hamali'),
        0,
        100000,
      ),
    };
    


    // Use wizard data if available, fallback to legacy localStorage
    const priceChart = (wizardData?.priceMatrix || zpm?.priceMatrix || {}) as PriceMatrix;
    
    // ✅ FIX 7: Extract selected zones from wizard
    const selectedZones = wizardData?.selectedZones || zpm?.selectedZones || [];

    const pincodeStr = String(geo.pincode ?? '')
      .replace(/\D+/g, '')
      .slice(0, 6);
    const pincodeNum = Number(pincodeStr || 0);

    // ✅ AUTO-ENABLE if user entered any values
    const hasInvoicePercentage = invoicePercentage && Number(invoicePercentage) > 0;
    const hasInvoiceMinAmount = invoiceMinAmount && Number(invoiceMinAmount) > 0;
    const invoiceAutoEnabled = hasInvoicePercentage || hasInvoiceMinAmount;

    const payloadForApi = {
      customerID: getCustomerIDFromToken(),
      companyName: companyName.trim(),
      contactPerson: contactPerson,      // ✅ NEW - at root level
      vendorCode: vendorCode,
      vendorPhone: vendorPhoneNum,
      vendorEmail: vendorEmail,
      gstNo,
      mode: transportMode || 'road',
      address,
      state: String(geo.state ?? '').toUpperCase(),
      pincode: pincodeNum,
      city: city,                         // ✅ NEW - at root level
      rating: rating,                     // ✅ NEW - at root level
      subVendor: subVendor,               // ✅ NEW - at root level (not nested)
      selectedZones: selectedZones,       // ✅ NEW - at root level
      human: { name, displayName, primaryCompanyName },  // Removed subVendor from here
      prices: { priceRate, priceChart },
      
      invoiceValueCharges: {
        enabled: invoiceAutoEnabled,
        percentage: Number(invoicePercentage || 0),
        minimumAmount: Number(invoiceMinAmount || 0),
        description: 'Invoice Value Handling Charges',
      },
    };
    
    console.log('🔍 FINAL PAYLOAD:', payloadForApi);
    console.log('🔍 CHARGES IN PAYLOAD:', {
      'priceRate.codCharges': payloadForApi.prices.priceRate.codCharges,
      'priceRate.topayCharges': payloadForApi.prices.priceRate.topayCharges,
      'priceRate.rovCharges': payloadForApi.prices.priceRate.rovCharges,
      'priceRate.prepaidCharges': payloadForApi.prices.priceRate.prepaidCharges,
    });
    return payloadForApi;
  };

  // ===== Submit =====
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    emitDebug('SUBMIT_STARTED');
    console.debug('[SUBMIT] clicked - start');

    // Validate (logs inside validateAll will tell us what failed)
    const ok = validateAll();
    console.debug('[SUBMIT] validateAll result ->', ok);
    if (!ok) {
      emitDebugError('VALIDATION_FAILED_ON_SUBMIT');
      console.warn('[SUBMIT] Validation failed - aborting submit (no network).');
      return;
    }

    setIsSubmitting(true);

    // Show full-screen overlay loading immediately
    setShowSubmitOverlay(true);
    setSubmitOverlayStage('loading');

    try {
      const payloadForApi = buildPayloadForApi();
      
      // Debug: Log the 3 specific fields we're tracking
      console.log('📤 Sending Fields:', {
        contactPerson: payloadForApi.contactPerson || '(empty)',
        subVendor: payloadForApi.subVendor || '(empty)',
        codCharges: payloadForApi.prices?.priceRate?.codCharges,
        topayCharges: payloadForApi.prices?.priceRate?.topayCharges,
      });
      
      console.log('🔍 INVOICE DEBUG:', {
        invoicePercentage,
        invoiceMinAmount,
        invoiceUseMax,
      });
      // 👆 JUST THIS ONE LINE
      emitDebug('SUBMIT_PAYLOAD_FOR_API', payloadForApi);
      console.debug('[SUBMIT] payloadForApi', payloadForApi);
 
      const fd = new FormData();
      fd.append('customerID', String(payloadForApi.customerID || ''));
      fd.append('companyName', payloadForApi.companyName);
      fd.append('contactPerson', payloadForApi.contactPerson);              // ✅ NEW
      fd.append('vendorCode', payloadForApi.vendorCode);
      fd.append('vendorPhone', String(payloadForApi.vendorPhone));
      fd.append('vendorEmail', payloadForApi.vendorEmail);
      fd.append('gstNo', payloadForApi.gstNo);
      fd.append('mode', payloadForApi.mode);
      fd.append('address', payloadForApi.address);
      fd.append('state', payloadForApi.state);
      fd.append('pincode', String(payloadForApi.pincode));
      fd.append('city', payloadForApi.city);                                // ✅ NEW
      fd.append('rating', String(payloadForApi.rating));                    // ✅ FIXED - use actual rating
      fd.append('subVendor', payloadForApi.subVendor || '');                // ✅ NEW
      fd.append('selectedZones', JSON.stringify(payloadForApi.selectedZones)); // ✅ NEW
      fd.append('priceRate', JSON.stringify(payloadForApi.prices.priceRate));
      fd.append('priceChart', JSON.stringify(payloadForApi.prices.priceChart));
      if (priceChartFile) fd.append('priceChart', priceChartFile);
      fd.append('vendorJson', JSON.stringify(payloadForApi));

      // 🔍 COMPREHENSIVE DEBUG: Show exactly what's in FormData
      console.log('📦 FormData being sent:', {
        customerID: payloadForApi.customerID,
        companyName: payloadForApi.companyName,
        contactPerson: payloadForApi.contactPerson || '(EMPTY)',
        subVendor: payloadForApi.subVendor || '(EMPTY)',
        vendorCode: payloadForApi.vendorCode,
        priceRateStringified: JSON.stringify(payloadForApi.prices.priceRate).substring(0, 200) + '...',
        priceRateContainsCOD: JSON.stringify(payloadForApi.prices.priceRate).includes('codCharges'),
        priceRateContainsTOPAY: JSON.stringify(payloadForApi.prices.priceRate).includes('topayCharges'),
        actualCODValue: payloadForApi.prices.priceRate.codCharges,
        actualTOPAYValue: payloadForApi.prices.priceRate.topayCharges,
      });

      const token = getAuthToken();
      const url = `${API_BASE}/api/transporter/addtiedupcompanies`;
      emitDebug('SUBMITTING_TO_API', { url, hasToken: !!token });
      console.debug('[SUBMIT] sending fetch to', url, { hasToken: !!token });

      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      const json = await res.json().catch(() => ({} as any));
      emitDebug('API_RESPONSE', { status: res.status, json });
      console.debug('[SUBMIT] API_RESPONSE', res.status, json);

      if (!res.ok || !json?.success) {
        emitDebugError('SUBMIT_ERROR', { status: res.status, json });
        toast.error(json?.message || `Failed to create vendor (${res.status})`, {
          duration: 5200,
        });
        setIsSubmitting(false);
        setShowSubmitOverlay(false); // 👈 ensure overlay hides on API error
        return;
      }

      toast.success('Vendor created successfully!', { duration: 800 });

      // show success tick in overlay
      setSubmitOverlayStage('success');

      // reset the form as you already do
      clearDraft();
      clearWizard();
      localStorage.removeItem(ZPM_KEY);
      try {
        if (typeof vendorBasics.reset === 'function') vendorBasics.reset();
        if (typeof pincodeLookup.reset === 'function') pincodeLookup.reset();
        if (typeof volumetric.reset === 'function') volumetric.reset();
        if (typeof charges.reset === 'function') charges.reset();
      } catch (err) {
        emitDebugError('RESET_HOOKS_ERROR', { err });
      }
      setPriceChartFile(null);
      setTransportMode('road');
      setInvoicePercentage('');
      setInvoiceMinAmount('');
      setInvoiceUseMax(false);
      setInvoiceManualOverride(false);
      setZpm(null);
      setWizardValidation(null);
      setWizardStatus(null);
      setRefreshTrigger((x) => x + 1);

      // trigger smooth scroll to top (ScrollToTop listens on this)
      setScrollKey(Date.now());
    } catch (err) {
      emitDebugError('SUBMIT_EXCEPTION', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      toast.error('Unexpected error. Please try again.', { duration: 5200 });
      setShowSubmitOverlay(false); // 👈 hide overlay on unexpected exception
    } finally {
      setIsSubmitting(false);
      // NOTE: Do not auto-hide overlay here — success state should show until user clicks action.
    }
  };




  // ===== Reset =====
  const handleReset = () => {
    if (!confirm('Reset the form? Unsaved changes will be lost.')) return;
    try {
      if (typeof vendorBasics.reset === 'function') vendorBasics.reset();
      if (typeof pincodeLookup.reset === 'function') pincodeLookup.reset();
      if (typeof volumetric.reset === 'function') volumetric.reset();
      if (typeof charges.reset === 'function') charges.reset();
    } catch (err) {
      emitDebugError('RESET_HOOKS_ERROR', { err });
    }
    setPriceChartFile(null);
    setTransportMode('road');
    setInvoicePercentage('');
    setInvoiceMinAmount('');
    setInvoiceUseMax(false);
    setInvoiceManualOverride(false);
    clearDraft();
    clearWizard(); // ADD THIS
    toast.success('Form reset', { duration: 1200 });
  };

  // ========================================================================
  // PAGE UI (your preferred UI)
  // ========================================================================
  return (
    <div
      ref={topRef}
      className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200"
    >
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="w-full px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white grid place-items-center font-bold shadow-sm">
              F
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Add Vendor</h1>
              <p className="text-xs text-slate-600">
                Freight Cost Calculator · Transporter Setup
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShowToken}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              Token
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300"
            >
              Reset
            </button>
            <button
              type="submit"
              form="add-vendor-form"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSubmitting ? 'Saving…' : 'Save Vendor'}
            </button>
          </div>
        </div>
      </div>

      {/* Token panel (debug) */}
      {tokenPanelOpen && (
        <div className="w-full px-8 mt-4">
          <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800">Current Auth Token</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => copyText(tokenValue)}
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Copy token
                </button>
                <button
                  type="button"
                  onClick={() =>
                    copyText(JSON.stringify(tokenPayload, null, 2) || '')
                  }
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Copy payload
                </button>
                <button
                  type="button"
                  onClick={() => setTokenPanelOpen(false)}
                  className="px-2 py-1 text-xs rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Hide
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-700 break-all">
              <div className="mb-2">
                <span className="font-mono font-semibold mr-2">Token:</span>
                <span className="font-mono">{tokenValue || '(empty)'}</span>
              </div>
              <div className="mt-3">
                <div className="font-mono font-semibold mb-1">Decoded Payload:</div>
                <pre className="whitespace-pre-wrap font-mono bg-slate-900 text-slate-100 p-3 rounded-md overflow-x-auto">
{JSON.stringify(tokenPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="w-full px-8 py-6">
        <form id="add-vendor-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white/90 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 gap-0 divide-y divide-slate-200">
              <div className="p-6 md:p-8">
                <CompanySection
                  vendorBasics={vendorBasics}
                  pincodeLookup={pincodeLookup}
                />
              </div>

              <div className="p-6 md:p-8 bg-slate-50/60">
                <TransportSection
                  volumetric={volumetric}
                  transportMode={transportMode}
                  onTransportModeChange={(m) => setTransportMode(m)}
                />
              </div>

              <div className="p-6 md:p-8">
                <ChargesSection charges={charges} />
              </div>

              {/* Invoice Value Charges Section (Placed Intelligently here) */}
              {showInvoiceSection && (
  <div className="p-6 md:p-8 bg-slate-50/60 border-t border-slate-200">
    <div className="w-full">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">
          Invoice Value Configuration
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Percentage Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Invoice Value Percentage (%)
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={invoicePercentage}
              onChange={(e) => {
                // Allow numbers and one dot
                const val = e.target.value.replace(/[^0-9.]/g, '');
                if ((val.match(/\./g) || []).length <= 1) {
                  setInvoicePercentage(val);
                  setInvoiceManualOverride(true);
                }
              }}
              placeholder="0.00"
              className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 pl-3 pr-8"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-slate-400 text-sm">%</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Numeric values only.</p>
        </div>

        {/* Min Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Minimum Amount (₹)
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={invoiceMinAmount}
              onChange={(e) => {
                const val = sanitizeDigitsOnly(e.target.value);
                setInvoiceMinAmount(val);
                setInvoiceManualOverride(true);
              }}
              placeholder="0"
              className="w-full rounded-lg border-slate-300 focus:border-blue-500 focus:ring-blue-500 pl-3 pr-8"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-slate-400 text-sm">₹</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Numeric values only.</p>
        </div>
      </div>

      {/* UI Matching Toggle */}
      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex-1">
          <span className="text-sm font-semibold text-slate-900">Calculation Method</span>
          <p className="text-xs text-slate-500 mt-1">
            Use the maximum of the percentage value and the minimum amount?
          </p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setInvoiceUseMax(true)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all shadow-sm ${
              invoiceUseMax ? 'bg-white text-blue-600 ring-1 ring-black/5' : 'bg-transparent text-slate-500 hover:text-slate-700 shadow-none'
            }`}
          >
            Yes, Use Max
          </button>
          <button
            type="button"
            onClick={() => setInvoiceUseMax(false)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all shadow-sm ${
              !invoiceUseMax ? 'bg-white text-slate-900 ring-1 ring-black/5' : 'bg-transparent text-slate-500 hover:text-slate-700 shadow-none'
            }`}
          >
            No
          </button>
        </div>
      </div>
    </div>
  </div>
)}


              {/* Zone Price Matrix section with validation */}
              <div className="p-6 md:p-8 bg-slate-50/60">
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Zone Price Matrix
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => navigate('/zone-price-matrix')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        {wizardStatus?.hasPriceMatrix ? 'Edit Wizard' : 'Open Wizard'}
                      </button>
                      <button
                        type="button"
                        onClick={loadZoneData}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Reload Data
                      </button>
                    </div>
                  </div>

                  {/* Status Display */}
                  <div className="space-y-3">
                    {/* Primary Status */}
                    <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-slate-200 bg-slate-50">
                      {wizardStatus?.hasPriceMatrix ? (
                        <>
                          <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-green-900">
                              Zone data loaded ({matrixSize.rows}×{matrixSize.cols})
                            </p>
                            <p className="text-xs text-green-700">
                              {wizardStatus.zoneCount} zones configured
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-900">
                              No zone data configured
                            </p>
                            <p className="text-xs text-red-700">
                              Please open the wizard to configure zones
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Validation Errors */}
                    {wizardValidation &&
                      !wizardValidation.isValid &&
                      wizardValidation.errors.length > 0 && (
                        <div className="p-4 rounded-lg border-2 border-red-300 bg-red-50">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-red-900 mb-2">
                                Configuration Issues:
                              </p>
                              <ul className="space-y-1 text-sm text-red-800">
                                {wizardValidation.errors.map((error, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-red-600 mt-0.5">•</span>
                                    <span>{error}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Validation Warnings */}
                    {wizardValidation &&
                      wizardValidation.isValid &&
                      wizardValidation.warnings.length > 0 && (
                        <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-yellow-900 mb-2">
                                Warnings:
                              </p>
                              <ul className="space-y-1 text-sm text-yellow-800">
                                {wizardValidation.warnings.map((warning, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-yellow-600 mt-0.5">•</span>
                                    <span>{warning}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Success State */}
                    {wizardValidation &&
                      wizardValidation.isValid &&
                      wizardValidation.warnings.length === 0 &&
                      wizardStatus?.hasPriceMatrix && (
                        <div className="p-4 rounded-lg border-2 border-green-300 bg-green-50">
                          <div className="flex items-center gap-3">
                            <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0" />
                            <p className="text-sm text-green-800">
                              Configuration is complete and valid
                            </p>
                          </div>
                        </div>
                      )}

{/* Progress Bar */}
                    {wizardStatus && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">
                            Configuration Progress
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {wizardStatus.hasPriceMatrix ? 100 : wizardStatus.completionPercentage}%
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-green-600 transition-all duration-500"
                            style={{
                              width: `${wizardStatus.hasPriceMatrix ? 100 : wizardStatus.completionPercentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Info Note */}
                    <p className="text-xs text-slate-600 leading-relaxed">
                      The wizard saves data in your browser under{' '}
                      <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-800">
                        vendorWizard.v1
                      </code>
                      . After configuring zones and pricing, click{' '}
                      <strong className="text-slate-900">Reload Data</strong> to load it
                      here.
                    </p>
                  </div>
                </div>
              </div>

              {/* Keep file upload for CSV/Excel import */}
              <div className="p-6 md:p-8">
                <PriceChartUpload
                  file={priceChartFile}
                  onFileChange={setPriceChartFile}
                />
              </div>

              {/* Footer actions */}
              <div className="p-6 md:p-8 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-3 bg-slate-200 text-slate-800 font-medium rounded-xl hover:bg-slate-300 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <XCircleIcon className="w-5 h-5" />
                    Reset Form
                  </span>
                </button>
                {/*
                               <button
                  type="button"
                  onClick={() => setShowInvoiceSection((s) => !s)}
                  className="px-5 py-3 bg-slate-200 text-slate-800 font-medium rounded-xl hover:bg-slate-300 transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    <EyeIcon className="w-5 h-5" />
                    Show Invoice Value
                  </span>
                </button>*/}
                <button
                  type="submit"
                  disabled={isSubmitting || (wizardValidation && !wizardValidation.isValid)}
                  className="px-5 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-5 h-5" />
                        Save Vendor
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </form>

        
      </div>

      {/* Full-screen submit overlay */}
      {showSubmitOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-10 py-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-[90%]">
            {submitOverlayStage === 'loading' ? (
              <>
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
                <p className="text-sm text-slate-700 font-medium">
                  Creating vendor, please wait…
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircleIcon className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-sm text-slate-800 font-semibold">
                  Vendor added successfully!
                </p>
                <p className="text-xs text-slate-500">
                  Add another vendor?
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      // overlay is already on success, form already reset
                      setShowSubmitOverlay(false);
                      // ensure we’re at the top
                      setScrollKey(Date.now());
                    }}
                    className="mt-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  >
                    Add another vendor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubmitOverlay(false);
                      navigate('/my-vendors');
                    }}
                    className="mt-1 px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium hover:bg-slate-50"
                  >
                    Go to Vendor list
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Smooth scroll helper after success */}
      <ScrollToTop targetRef={topRef} when={scrollKey} offset={80} />
    </div>
  );
};

export default AddVendor;
