// src/hooks/useVendorAutofill.ts
import { useCallback } from 'react';

const ZPM_KEY = 'zonePriceMatrixData';
type VendorSuggestion = {
  id?: string;
  displayName?: string;
  companyName?: string;
  legalCompanyName?: string;
  vendorPhone?: number | string;
  vendorEmail?: string;
  primaryContactName?: string;
  gstNo?: string;
  subVendor?: string;
  address?: string;
  state?: string;
  city?: string;
  pincode?: string | number;
  mode?: string;
  serviceModes?: string;
  rating?: number;
  zones?: string[];
  zoneConfigs?: Array<{
    zoneCode: string;
    zoneName: string;
    region: string;
    selectedStates: string[];
    selectedCities: string[];
    isComplete: boolean;
  }>;
  zoneMatrixStructure?: Record<string, Record<string, any>>;
  volumetricUnit?: string;
  divisor?: number;
  cftFactor?: number | null;
};

// Options to control what to autofill. Defaults are conservative.
export type AutofillOptions = {
  overwriteBasics?: boolean;       // default true
  overwriteGeo?: boolean;          // default true
  overwriteVolumetric?: boolean;   // default true
  overwriteZones?: boolean;        // default true
  blankCellValue?: string | number | null; // default ''
  wizardStep?: number;             // step to set in vendorWizard.v1 (default 3)
  writeLegacyZpm?: boolean;        // write zonePriceMatrixData (default true)
};

// The hook expects callers to pass the hooks/setters from the AddVendor context.
// Keep the hook simple: it performs mapping and writes storage + calls setters.
export function useVendorAutofill(params: {
  vendorBasics: any;
  pincodeLookup: any;
  volumetric: any;
  setWizardData?: (fn: any) => void;
  setZpm?: (z: any) => void;
  setIsAutoFilled?: (b: boolean) => void;
  setAutoFilledFromName?: (s: string | null) => void;
  setAutoFilledFromId?: (s: string | null) => void;
  setWizardValidation?: (v: any) => void;
  setWizardStatus?: (s: any) => void;
  validateWizardData?: (d: any) => any;
  getWizardStatus?: (d: any) => any;
}) {
  const {
    vendorBasics,
    pincodeLookup,
    volumetric,
    setWizardData,
    setZpm,
    setIsAutoFilled,
    setAutoFilledFromName,
    setAutoFilledFromId,
    setWizardValidation,
    setWizardStatus,
    validateWizardData,
    getWizardStatus,
  } = params;

  const applyVendorAutofill = useCallback(
    (vendor: VendorSuggestion, opts?: AutofillOptions) => {
      const o: AutofillOptions = {
        overwriteBasics: true,
        overwriteGeo: true,
        overwriteVolumetric: true,
        overwriteZones: true,
        blankCellValue: '',
        wizardStep: 3,
        writeLegacyZpm: true,
        ...(opts || {}),
      };

      console.log('[AutoFill] Applying vendor data:', {
        id: vendor.id,
        name: vendor.companyName,
        zones: vendor.zones,
        zoneConfigs: vendor.zoneConfigs,
      });

      // 1) Basics
      if (o.overwriteBasics && vendorBasics?.setBasics) {
        vendorBasics.setBasics((prev: any) => ({
          ...prev,
          legalCompanyName: vendor.legalCompanyName || vendor.companyName || prev.legalCompanyName || '',
          companyName: vendor.companyName || vendor.legalCompanyName || prev.companyName || '',
          contactPersonName: vendor.primaryContactName || prev.contactPersonName || '',
          vendorPhoneNumber: String(vendor.vendorPhone ?? prev.vendorPhoneNumber ?? ''),
          vendorEmailAddress: vendor.vendorEmail ?? prev.vendorEmailAddress ?? '',
          gstin: vendor.gstNo ?? prev.gstin ?? '',
          subVendor: vendor.subVendor ?? prev.subVendor ?? '',
          address: vendor.address ?? prev.address ?? '',
          serviceMode: vendor.serviceModes?.split(',')[0]?.trim().toUpperCase() || prev.serviceMode || 'FTL',
          companyRating: vendor.rating ?? prev.companyRating ?? 3,
        }));
      }

      // 2) Geo
      if (o.overwriteGeo && pincodeLookup) {
        const pincodeStr = vendor.pincode ? String(vendor.pincode) : '';
        if (pincodeStr && typeof pincodeLookup.setPincode === 'function') pincodeLookup.setPincode(pincodeStr);
        if (vendor.state && typeof pincodeLookup.setState === 'function') pincodeLookup.setState(vendor.state);
        if (vendor.city && typeof pincodeLookup.setCity === 'function') pincodeLookup.setCity(vendor.city);
      }

      // 3) Volumetric
      if (o.overwriteVolumetric && volumetric?.setState) {
        volumetric.setState((prev: any) => ({
          ...prev,
          unit: vendor.volumetricUnit === 'Inches' ? 'in' : vendor.volumetricUnit === 'cm' ? 'cm' : prev.unit || 'cm',
          volumetricDivisor: vendor.divisor ?? prev.volumetricDivisor ?? 5000,
          cftFactor: vendor.cftFactor ?? prev.cftFactor ?? null,
        }));
      }

      // 4) Zones -> Use zoneConfigs if available, otherwise build from zones array
      const hasZoneConfigs = Array.isArray(vendor.zoneConfigs) && vendor.zoneConfigs.length > 0;
      const hasZones = Array.isArray(vendor.zones) && vendor.zones.length > 0;
      
      if (o.overwriteZones && (hasZoneConfigs || hasZones)) {
        const blank = o.blankCellValue;
        
        // Build empty price matrix
        const zoneCodes = hasZoneConfigs 
          ? vendor.zoneConfigs!.map(z => z.zoneCode)
          : vendor.zones!;
        
        const emptyPriceMatrix: Record<string, Record<string, any>> = {};
        for (const fromZone of zoneCodes) {
          emptyPriceMatrix[fromZone] = {};
          for (const toZone of zoneCodes) {
            emptyPriceMatrix[fromZone][toZone] = blank;
          }
        }

        // Build wizard zones array - use full zoneConfigs if available
        const wizardZones = hasZoneConfigs 
          ? vendor.zoneConfigs!.map(z => ({
              zoneCode: z.zoneCode,
              zoneName: z.zoneName || z.zoneCode,
              region: z.region || 'North',
              selectedStates: z.selectedStates || [],
              selectedCities: z.selectedCities || [],
              isComplete: z.isComplete || (z.selectedCities && z.selectedCities.length > 0),
            }))
          : vendor.zones!.map((z) => ({ 
              zoneCode: z, 
              zoneName: z,
              region: 'North' as const,
              selectedStates: [],
              selectedCities: [],
              isComplete: false,
            }));

        console.log('[AutoFill] Built wizard zones:', wizardZones);

        // For legacy selectedZones format
        const selectedZonesForWizard = zoneCodes.map((z) => ({ zoneCode: z, zoneName: z }));

        // Write legacy zpm (optional)
        if (o.writeLegacyZpm) {
          try {
            const zpmData = { zones: zoneCodes, priceMatrix: emptyPriceMatrix, timestamp: new Date().toISOString() };
            localStorage.setItem(ZPM_KEY, JSON.stringify(zpmData));
            if (typeof setZpm === 'function') setZpm(zpmData);
          } catch (err) {
            console.warn('autofill: failed writing ZPM_KEY', err);
          }
        }

        // Write wizard state with full zone configs
        try {
          const wizardKey = 'vendorWizard.v1';
          let wizardState: any = {};
          const raw = localStorage.getItem(wizardKey);
          if (raw) {
            try { wizardState = JSON.parse(raw); } catch { wizardState = {}; }
          }
          wizardState = {
            ...wizardState,
            selectedZones: selectedZonesForWizard,
            zones: wizardZones,  // Full zone configs with cities/states
            priceMatrix: emptyPriceMatrix,
            step: o.wizardStep,
            lastUpdated: new Date().toISOString(),
            autoFilledFrom: { vendorId: vendor.id, vendorName: vendor.displayName || vendor.companyName || '' },
          };
          localStorage.setItem(wizardKey, JSON.stringify(wizardState));
          
          if (typeof setWizardData === 'function') {
            setWizardData((prev: any) => ({ 
              ...(prev || {}), 
              selectedZones: selectedZonesForWizard, 
              zones: wizardZones,
              priceMatrix: emptyPriceMatrix,
            }));
          }

          // validation/status refresh if available
          if (validateWizardData && getWizardStatus && setWizardValidation && setWizardStatus) {
            const validation = validateWizardData(wizardState);
            const status = getWizardStatus(wizardState);
            setWizardValidation(validation);
            setWizardStatus(status);
          }
        } catch (err) {
          console.warn('autofill: failed writing vendorWizard.v1', err);
        }
      }

      // 5) Tracking flags + toast handled by caller (so hook is pure)
      if (typeof setIsAutoFilled === 'function') setIsAutoFilled(true);
      if (typeof setAutoFilledFromName === 'function') setAutoFilledFromName(vendor.displayName || vendor.companyName || vendor.legalCompanyName || null);
      if (typeof setAutoFilledFromId === 'function') setAutoFilledFromId(vendor.id ?? null);

    },
    [
      vendorBasics,
      pincodeLookup,
      volumetric,
      setWizardData,
      setZpm,
      setIsAutoFilled,
      setAutoFilledFromName,
      setAutoFilledFromId,
      setWizardValidation,
      setWizardStatus,
      validateWizardData,
      getWizardStatus,
    ]
  );

  return { applyVendorAutofill };
}