import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, ChevronRight, MapPin, Sparkles, Trash2, AlertTriangle } from "lucide-react";
import { useWizardStorage } from "../hooks/useWizardStorage";
import type { ZoneConfig, RegionGroup, PincodeEntry } from "../types/wizard.types";
import DecimalInput from "../components/DecimalInput";

/* =========================================================
   CONSTANTS
   ======================================================= */
const MAX_ZONES = 28;

const ZONE_ORDER = [
  'N1', 'N2', 'N3', 'N4', 'N5', 'N6',
  'W1', 'W2', 'W3', 'W4',
  'C1', 'C2', 'C3', 'C4',
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6',
  'E1', 'E2', 'E3', 'E4',
  'NE1', 'NE2', 'NE3', 'NE4'
];

const regionGroups: Record<RegionGroup, string[]> = {
  North: ["N1", "N2", "N3", "N4", "N5", "N6"],
  South: ["S1", "S2", "S3", "S4", "S5", "S6"],
  East: ["E1", "E2", "E3", "E4"],
  West: ["W1", "W2", "W3", "W4"],
  Northeast: ["NE1", "NE2", "NE3", "NE4"],
  Central: ["C1", "C2", "C3", "C4"],
};

/* =========================================================
   TYPES
   ======================================================= */
type WarningModalType = 
  | 'exhaustion'           // Cities exhausted, some zones will be empty
  | 'no-cities-available'  // Current zone has no cities available
  | 'zone-disabled-info';  // Info about a disabled zone

interface WarningModalState {
  isOpen: boolean;
  type: WarningModalType;
  message: string;
  affectedZones: string[];
  region: RegionGroup | null;
  stats: {
    totalCities: number;
    assignedCities: number;
    availableCities: number;
  } | null;
}

/* =========================================================
   HELPER FUNCTIONS
   ======================================================= */
const codeToRegion = (code: string): RegionGroup => {
  if (code.startsWith("NE")) return "Northeast";
  const firstChar = code.charAt(0);
  if (firstChar === "N") return "North";
  if (firstChar === "S") return "South";
  if (firstChar === "E") return "East";
  if (firstChar === "W") return "West";
  if (firstChar === "C") return "Central";
  console.error('Unknown zone code:', code);
  return "North";
};

const sortZonesByOrder = (zones: string[]): string[] => {
  return [...zones].sort((a, b) => {
    const indexA = ZONE_ORDER.indexOf(a);
    const indexB = ZONE_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    return a.localeCompare(b);
  });
};

const csKey = (city: string, state: string) => `${city}||${state}`;
const parseCsKey = (key: string) => {
  const i = key.lastIndexOf("||");
  return { city: key.slice(0, i), state: key.slice(i + 2) };
};

/* =========================================================
   MAIN COMPONENT
   ======================================================= */
const ZonePriceMatrix: React.FC = () => {
  const navigate = useNavigate();
  const { wizardData, updateZones, updatePriceMatrix, isLoaded } = useWizardStorage();
    // 🔝 Scroll to top whenever Wizard page opens
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth", // or "auto" if you want instant jump
    });
  }, []);

  // Dataset
  const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Steps
  const [currentStep, setCurrentStep] = useState<"select-zones" | "configure-zones" | "price-matrix">("select-zones");

  // Step 1: Zone Selection
  const [selectedZoneCodes, setSelectedZoneCodes] = useState<string[]>([]);
  const [visibleZoneCount, setVisibleZoneCount] = useState<Record<RegionGroup, number>>({
    North: 1,
    South: 1,
    East: 1,
    West: 1,
    Northeast: 1,
    Central: 1,
  });

  // Step 2: Zone Configuration
  const [zoneConfigs, setZoneConfigs] = useState<ZoneConfig[]>([]);
  const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
  const [activeStateByZone, setActiveStateByZone] = useState<Record<string, string | null>>({});

  // Warning modal state - using object pattern to avoid callback issues
  const [warningModal, setWarningModal] = useState<WarningModalState>({
    isOpen: false,
    type: 'exhaustion',
    message: '',
    affectedZones: [],
    region: null,
    stats: null,
  });
  
  // Use ref for promise resolution to avoid stale closure issues
  const warningResolverRef = useRef<((result: 'continue' | 'delete' | 'cancel' | 'back') => void) | null>(null);

  /* -------------------- Load Pincode Data -------------------- */
  useEffect(() => {
    const url = `${import.meta.env.BASE_URL || "/"}pincodes.json`;
    fetch(url)
      .then((res) => res.json())
      .then((data: PincodeEntry[]) => {
        const filtered = (Array.isArray(data) ? data : []).filter(
          (e) =>
            e.state &&
            e.city &&
            e.state !== "NAN" &&
            e.state !== "NaN" &&
            e.city !== "NAN" &&
            e.city !== "NaN" &&
            e.state.trim() !== "" &&
            e.city.trim() !== "" &&
            e.pincode &&
            /^\d{6}$/.test(String(e.pincode))
        );
        setPincodeData(filtered);
      })
      .catch((err) => console.error("Failed to load pincode data:", err))
      .finally(() => setIsLoadingData(false));
  }, []);

  /* -------------------- Load from Wizard Storage -------------------- */
  useEffect(() => {
    if (!isLoaded) return;

    if (wizardData.zones && wizardData.zones.length > 0) {
      const sortedZones = [...wizardData.zones].sort((a, b) => {
        const indexA = ZONE_ORDER.indexOf(a.zoneCode);
        const indexB = ZONE_ORDER.indexOf(b.zoneCode);
        return indexA - indexB;
      });

      setZoneConfigs(sortedZones);
      setSelectedZoneCodes(sortedZones.map((z) => z.zoneCode));

      // Update visible zone counts based on loaded data
      const newVisibleCounts: Record<RegionGroup, number> = {
        North: 1, South: 1, East: 1, West: 1, Northeast: 1, Central: 1,
      };
      
      sortedZones.forEach((z) => {
        const region = z.region;
        const regionZones = regionGroups[region];
        const zoneIndex = regionZones.indexOf(z.zoneCode);
        if (zoneIndex >= 0) {
          newVisibleCounts[region] = Math.max(newVisibleCounts[region], zoneIndex + 1);
        }
      });
      
      setVisibleZoneCount(newVisibleCounts);

      const hasPriceMatrix = 
        wizardData.priceMatrix && 
        Object.keys(wizardData.priceMatrix).length > 0 &&
        Object.values(wizardData.priceMatrix).some(toZones => 
          Object.keys(toZones).length > 0
        );
      
      const hasConfiguredZones = sortedZones.some(z => 
        z.isComplete && z.selectedCities && z.selectedCities.length > 0
      );

      if (hasPriceMatrix) {
        setCurrentStep("price-matrix");
      } else if (hasConfiguredZones) {
        setCurrentStep("configure-zones");
      } else {
        setCurrentStep("select-zones");
      }
    } else {
      setCurrentStep("select-zones");
    }
  }, [isLoaded, wizardData]);

  /* -------------------- Derived Data -------------------- */
  // Region -> State -> Set<City>
  const byStateByRegion = useMemo(() => {
    const map = new Map<RegionGroup, Map<string, Set<string>>>();
    (["North", "South", "East", "West", "Northeast", "Central"] as RegionGroup[]).forEach((r) =>
      map.set(r, new Map())
    );

    for (const e of pincodeData) {
      const region = codeToRegion(e.zone || "");
      const stateMap = map.get(region)!;
      if (!stateMap.has(e.state)) stateMap.set(e.state, new Set());
      stateMap.get(e.state)!.add(e.city);
    }

    return map;
  }, [pincodeData]);

  // Get all city keys for a state in a region
  const getAllCityKeysForState = useCallback((state: string, region: RegionGroup): string[] => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    const cities = stateMap.get(state);
    if (!cities) return [];
    return Array.from(cities).map((c) => csKey(c, state));
  }, [byStateByRegion]);

  // Get cities already used by other zones (excluding a specific zone index)
  const getUsedCities = useCallback((excludeZoneIndex?: number): Set<string> => {
    const used = new Set<string>();
    zoneConfigs.forEach((z, idx) => {
      if (idx !== excludeZoneIndex) {
        z.selectedCities.forEach((c) => used.add(c));
      }
    });
    return used;
  }, [zoneConfigs]);

  // Get available city keys for a state (not used by other zones)
  const getAvailableCityKeys = useCallback((state: string, region: RegionGroup, zoneIndex: number): string[] => {
    const allKeys = getAllCityKeysForState(state, region);
    const used = getUsedCities(zoneIndex);
    return allKeys.filter((k) => !used.has(k));
  }, [getAllCityKeysForState, getUsedCities]);

  // Current zone config
  const currentConfig = zoneConfigs[currentZoneIndex];

  // Get total cities in a region
  const getTotalCitiesInRegion = useCallback((region: RegionGroup): number => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return 0;
    let total = 0;
    stateMap.forEach((cities) => total += cities.size);
    return total;
  }, [byStateByRegion]);

  // Get count of cities already assigned in a region (across all zones)
  const getAssignedCitiesInRegion = useCallback((region: RegionGroup): number => {
    const usedCities = new Set<string>();
    zoneConfigs.forEach((z) => {
      if (codeToRegion(z.zoneCode) === region) {
        z.selectedCities.forEach((c) => usedCities.add(c));
      }
    });
    return usedCities.size;
  }, [zoneConfigs]);

  // Get count of available cities for a specific zone
  const getAvailableCitiesForZone = useCallback((zoneCode: string): number => {
    const region = codeToRegion(zoneCode);
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return 0;
    
    let totalCities = 0;
    stateMap.forEach((cities) => totalCities += cities.size);
    
    // Count cities used by OTHER zones in this region
    const usedCities = new Set<string>();
    zoneConfigs.forEach((z) => {
      if (z.zoneCode !== zoneCode && codeToRegion(z.zoneCode) === region) {
        z.selectedCities.forEach((c) => usedCities.add(c));
      }
    });
    
    return totalCities - usedCities.size;
  }, [byStateByRegion, zoneConfigs]);

  // Get list of states that have at least 1 available city for a zone
  const getAvailableStatesForZone = useCallback((zoneCode: string): string[] => {
    const region = codeToRegion(zoneCode);
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    
    const zoneIndex = zoneConfigs.findIndex(z => z.zoneCode === zoneCode);
    const availableStates: string[] = [];
    
    stateMap.forEach((_, state) => {
      const available = getAvailableCityKeys(state, region, zoneIndex);
      if (available.length > 0) {
        availableStates.push(state);
      }
    });
    
    return availableStates.sort((a, b) => a.localeCompare(b));
  }, [byStateByRegion, zoneConfigs, getAvailableCityKeys]);

  // Check if a zone is disabled (0 cities available)
  const isZoneDisabled = useCallback((zoneCode: string): boolean => {
    return getAvailableCitiesForZone(zoneCode) === 0;
  }, [getAvailableCitiesForZone]);

  // Get all zones in a region that have no cities available
  const getDisabledZonesInRegion = useCallback((region: RegionGroup): string[] => {
    return selectedZoneCodes
      .filter(z => codeToRegion(z) === region && isZoneDisabled(z));
  }, [selectedZoneCodes, isZoneDisabled]);

  // Get zones that would be empty if we proceed with current zone's configuration
  const getEmptyZonesAfterSave = useCallback((currentZoneCode: string): string[] => {
    const region = codeToRegion(currentZoneCode);
    const currentZone = zoneConfigs.find(z => z.zoneCode === currentZoneCode);
    
    // Calculate total cities that would be used after saving current zone
    const citiesAfterSave = new Set<string>();
    zoneConfigs.forEach((z) => {
      if (codeToRegion(z.zoneCode) === region) {
        z.selectedCities.forEach((c) => citiesAfterSave.add(c));
      }
    });
    
    const totalCities = getTotalCitiesInRegion(region);
    const remainingCities = totalCities - citiesAfterSave.size;
    
    // Find zones that would have no cities available
    const emptyZones: string[] = [];
    const otherZonesInRegion = selectedZoneCodes.filter(
      z => z !== currentZoneCode && codeToRegion(z) === region
    );
    
    otherZonesInRegion.forEach((zoneCode) => {
      const zoneConfig = zoneConfigs.find(z => z.zoneCode === zoneCode);
      // If zone already has cities, it's not empty
      if (zoneConfig && zoneConfig.selectedCities.length > 0) return;
      // If zone is not configured and no cities remain, it would be empty
      if (remainingCities === 0) {
        emptyZones.push(zoneCode);
      }
    });
    
    return emptyZones;
  }, [zoneConfigs, selectedZoneCodes, getTotalCitiesInRegion]);

  // Available states for current zone
  const availableStates = useMemo(() => {
    if (!currentConfig) return [];
    return getAvailableStatesForZone(currentConfig.zoneCode);
  }, [currentConfig, getAvailableStatesForZone]);

  /* =========================================================
     WARNING MODAL FUNCTIONS
     ======================================================= */
  
  const showWarning = useCallback((
    type: WarningModalType,
    affectedZones: string[],
    region: RegionGroup
  ): Promise<'continue' | 'delete' | 'cancel' | 'back'> => {
    return new Promise((resolve) => {
      const totalCities = getTotalCitiesInRegion(region);
      const assignedCities = getAssignedCitiesInRegion(region);
      const availableCities = totalCities - assignedCities;
      
      let message = '';
      
      switch (type) {
        case 'exhaustion':
          if (affectedZones.length === 1) {
            message = `Zone ${affectedZones[0]} will have no cities available after this operation.`;
          } else {
            message = `Zones ${affectedZones.join(', ')} will have no cities available after this operation.`;
          }
          break;
          
        case 'no-cities-available':
          message = `All cities in the ${region} region have been assigned to other zones. No cities are available for ${affectedZones[0]}.`;
          break;
          
        case 'zone-disabled-info':
          message = `Zone ${affectedZones[0]} has no available cities because all ${totalCities} cities in the ${region} region have been assigned to other zones.`;
          break;
      }
      
      warningResolverRef.current = resolve;
      
      setWarningModal({
        isOpen: true,
        type,
        message,
        affectedZones,
        region,
        stats: { totalCities, assignedCities, availableCities },
      });
    });
  }, [getTotalCitiesInRegion, getAssignedCitiesInRegion]);

  const closeWarningModal = useCallback((result: 'continue' | 'delete' | 'cancel' | 'back') => {
    setWarningModal(prev => ({ ...prev, isOpen: false }));
    if (warningResolverRef.current) {
      warningResolverRef.current(result);
      warningResolverRef.current = null;
    }
  }, []);

  /* =========================================================
     ZONE MANAGEMENT FUNCTIONS
     ======================================================= */

  // Remove zones (used for deleting empty zones)
  const removeZones = useCallback((codesToRemove: string[]) => {
    setSelectedZoneCodes((prev) => {
      const next = prev.filter((c) => !codesToRemove.includes(c));
      return sortZonesByOrder(next);
    });

    setZoneConfigs((prev) => {
      const newConfigs = prev.filter((z) => !codesToRemove.includes(z.zoneCode));
      
      // Adjust currentZoneIndex if necessary
      setCurrentZoneIndex((oldIndex) => {
        if (newConfigs.length === 0) return 0;
        const currentZone = prev[oldIndex];
        if (!currentZone) return Math.min(oldIndex, newConfigs.length - 1);
        
        const stillExists = !codesToRemove.includes(currentZone.zoneCode);
        if (stillExists) {
          const idx = newConfigs.findIndex((z) => z.zoneCode === currentZone.zoneCode);
          return idx === -1 ? Math.min(oldIndex, newConfigs.length - 1) : idx;
        }
        return Math.min(oldIndex, newConfigs.length - 1);
      });
      
      return newConfigs;
    });
  }, []);

  /* =========================================================
     ZONE SELECTION CONSTRAINTS
     ======================================================= */

  const canSelectZone = useCallback((code: string, currentSelection: string[]): boolean => {
    const region = codeToRegion(code);
    const regionZones = regionGroups[region];
    const selectedInRegion = currentSelection.filter(z => regionZones.includes(z));
    
    if (selectedInRegion.length === 0) {
      return code === regionZones[0];
    }
    
    const selectedIndices = selectedInRegion.map(z => regionZones.indexOf(z)).sort((a, b) => a - b);
    const targetIndex = regionZones.indexOf(code);
    const minIndex = Math.min(...selectedIndices);
    const maxIndex = Math.max(...selectedIndices);
    
    if (targetIndex === maxIndex + 1 || targetIndex === minIndex - 1) {
      return true;
    }
    
    if (targetIndex > minIndex && targetIndex < maxIndex) {
      for (let i = minIndex; i <= maxIndex; i++) {
        if (!selectedInRegion.includes(regionZones[i]) && i !== targetIndex) {
          return false;
        }
      }
      return true;
    }
    
    return false;
  }, []);

  const canDeselectZone = useCallback((code: string, currentSelection: string[]): boolean => {
    const region = codeToRegion(code);
    const regionZones = regionGroups[region];
    const selectedInRegion = currentSelection.filter(z => regionZones.includes(z));
    
    if (selectedInRegion.length === 0) return false;
    
    const selectedIndices = selectedInRegion.map(z => regionZones.indexOf(z)).sort((a, b) => a - b);
    const targetIndex = regionZones.indexOf(code);
    const minIndex = Math.min(...selectedIndices);
    const maxIndex = Math.max(...selectedIndices);
    
    return targetIndex === minIndex || targetIndex === maxIndex;
  }, []);

  /* =========================================================
     STEP 1: ZONE SELECTION HANDLERS
     ======================================================= */

  const toggleZoneSelection = useCallback(async (code: string) => {
    const isSelected = selectedZoneCodes.includes(code);
    const zoneDisabled = isZoneDisabled(code);

    if (isSelected) {
      // If zone is disabled, allow deselection without constraint check
      // OR show info modal with delete option
      if (zoneDisabled) {
        const region = codeToRegion(code);
        const result = await showWarning('zone-disabled-info', [code], region);
        
        if (result === 'delete') {
          removeZones([code]);
        }
        return;
      }
      
      if (!canDeselectZone(code, selectedZoneCodes)) {
        const region = codeToRegion(code);
        alert(`You can only deselect zones from the ends of the sequence in ${region} region.`);
        return;
      }
      
      const next = selectedZoneCodes.filter((c) => c !== code);
      setSelectedZoneCodes(sortZonesByOrder(next));
      setZoneConfigs((old) => old.filter((z) => z.zoneCode !== code));
      
    } else {
      if (!canSelectZone(code, selectedZoneCodes)) {
        const region = codeToRegion(code);
        alert(`You must select zones sequentially in ${region} region. No gaps allowed.`);
        return;
      }
      
      if (selectedZoneCodes.length >= MAX_ZONES) {
        alert(`Maximum ${MAX_ZONES} zones allowed`);
        return;
      }

      const next = [...selectedZoneCodes, code];
      setSelectedZoneCodes(sortZonesByOrder(next));

      setZoneConfigs((old) => {
        const exists = old.find((z) => z.zoneCode === code);
        if (exists) return old;

        const newZone: ZoneConfig = {
          zoneCode: code,
          zoneName: code,
          region: codeToRegion(code),
          selectedStates: [],
          selectedCities: [],
          isComplete: false,
        };

        const updated = [...old, newZone];
        return updated.sort((a, b) => {
          const indexA = ZONE_ORDER.indexOf(a.zoneCode);
          const indexB = ZONE_ORDER.indexOf(b.zoneCode);
          return indexA - indexB;
        });
      });
    }
  }, [selectedZoneCodes, isZoneDisabled, canDeselectZone, canSelectZone, showWarning, removeZones]);

  const selectAllInRegion = useCallback((region: RegionGroup) => {
    const regionZones = regionGroups[region];
    const currentlySelected = selectedZoneCodes.filter(z => !regionZones.includes(z));
    const newSelection = [...currentlySelected, ...regionZones];
    
    if (newSelection.length > MAX_ZONES) {
      alert(`Cannot select all zones in ${region}. Maximum ${MAX_ZONES} zones allowed.`);
      return;
    }
    
    setSelectedZoneCodes(sortZonesByOrder(newSelection));
    
    setZoneConfigs((old) => {
      const existing = old.filter(z => !regionZones.includes(z.zoneCode));
      const newZones = regionZones.map(code => {
        const existingZone = old.find(z => z.zoneCode === code);
        if (existingZone) return existingZone;
        
        return {
          zoneCode: code,
          zoneName: code,
          region: codeToRegion(code),
          selectedStates: [],
          selectedCities: [],
          isComplete: false,
        };
      });
      
      return [...existing, ...newZones].sort((a, b) => {
        const indexA = ZONE_ORDER.indexOf(a.zoneCode);
        const indexB = ZONE_ORDER.indexOf(b.zoneCode);
        return indexA - indexB;
      });
    });
  }, [selectedZoneCodes]);

  const deselectAllInRegion = useCallback((region: RegionGroup) => {
    const newSelection = selectedZoneCodes.filter(z => !regionGroups[region].includes(z));
    setSelectedZoneCodes(sortZonesByOrder(newSelection));
    setZoneConfigs((old) => old.filter(z => !regionGroups[region].includes(z.zoneCode)));
  }, [selectedZoneCodes]);

  const selectAllZones = useCallback(() => {
    const allZones = Object.values(regionGroups).flat();
    
    if (allZones.length > MAX_ZONES) {
      alert(`Cannot select all zones. Maximum ${MAX_ZONES} zones allowed.`);
      return;
    }
    
    setSelectedZoneCodes(sortZonesByOrder(allZones));
    
    setZoneConfigs(allZones.map(code => {
      const existingZone = zoneConfigs.find(z => z.zoneCode === code);
      if (existingZone) return existingZone;
      
      return {
        zoneCode: code,
        zoneName: code,
        region: codeToRegion(code),
        selectedStates: [],
        selectedCities: [],
        isComplete: false,
      };
    }).sort((a, b) => {
      const indexA = ZONE_ORDER.indexOf(a.zoneCode);
      const indexB = ZONE_ORDER.indexOf(b.zoneCode);
      return indexA - indexB;
    }));
    
    setVisibleZoneCount({
      North: regionGroups.North.length,
      South: regionGroups.South.length,
      East: regionGroups.East.length,
      West: regionGroups.West.length,
      Northeast: regionGroups.Northeast.length,
      Central: regionGroups.Central.length,
    });
  }, [zoneConfigs]);

  const deselectAllZones = useCallback(() => {
    setSelectedZoneCodes([]);
    setZoneConfigs([]);
  }, []);

  const getVisibleZones = useCallback((region: RegionGroup): string[] => {
    const allZones = regionGroups[region];
    const count = visibleZoneCount[region] || 1;
    return allZones.slice(0, count);
  }, [visibleZoneCount]);

  const hasExpandableZones = useCallback((region: RegionGroup): boolean => {
    const allZones = regionGroups[region];
    const currentCount = visibleZoneCount[region] || 1;
    return currentCount < allZones.length;
  }, [visibleZoneCount]);

  const expandRegionZones = useCallback((region: RegionGroup) => {
    const allZones = regionGroups[region];
    setVisibleZoneCount(prev => ({
      ...prev,
      [region]: Math.min((prev[region] || 1) + 1, allZones.length)
    }));
  }, []);

  const collapseRegionZones = useCallback((region: RegionGroup) => {
    setVisibleZoneCount(prev => ({
      ...prev,
      [region]: Math.max((prev[region] || 1) - 1, 1)
    }));
  }, []);

  const canExpandRegion = useCallback((region: RegionGroup): boolean => {
    const visibleZones = getVisibleZones(region);
    const hasMoreZones = hasExpandableZones(region);
    if (!hasMoreZones) return false;
    return visibleZones.every(zone => selectedZoneCodes.includes(zone));
  }, [getVisibleZones, hasExpandableZones, selectedZoneCodes]);

  const proceedToConfiguration = useCallback(() => {
    if (selectedZoneCodes.length === 0) {
      alert("Please select at least one zone");
      return;
    }
    setCurrentStep("configure-zones");
    setCurrentZoneIndex(0);
  }, [selectedZoneCodes]);

  /* =========================================================
     STEP 2: ZONE CONFIGURATION HANDLERS
     ======================================================= */

  const setActiveState = useCallback((state: string | null) => {
    if (!currentConfig) return;
    setActiveStateByZone((prev) => ({ ...prev, [currentConfig.zoneCode]: state }));
  }, [currentConfig]);

  const getActiveState = useCallback((): string | null => {
    if (!currentConfig) return null;
    return activeStateByZone[currentConfig.zoneCode] || null;
  }, [currentConfig, activeStateByZone]);

  const toggleCity = useCallback((cityKey: string) => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const isSelected = z.selectedCities.includes(cityKey);
        const selectedCities = isSelected
          ? z.selectedCities.filter((k) => k !== cityKey)
          : [...z.selectedCities, cityKey];

        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  }, [currentConfig, currentZoneIndex]);

  const selectAllInState = useCallback((state: string) => {
    if (!currentConfig) return;

    const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
    if (available.length === 0) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const selectedCities = Array.from(new Set([...z.selectedCities, ...available]));
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  }, [currentConfig, currentZoneIndex, getAvailableCityKeys]);

  const clearState = useCallback((state: string) => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const selectedCities = z.selectedCities.filter((k) => parseCsKey(k).state !== state);
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  }, [currentConfig, currentZoneIndex]);

  const selectAllStates = useCallback(() => {
    if (!currentConfig) return;

    const allAvailableCities: string[] = [];
    availableStates.forEach((state) => {
      const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
      allAvailableCities.push(...available);
    });

    if (allAvailableCities.length === 0) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        const selectedCities = Array.from(new Set([...z.selectedCities, ...allAvailableCities]));
        const stateSet = new Set<string>();
        selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
        const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

        return { ...z, selectedCities, selectedStates };
      })
    );
  }, [currentConfig, currentZoneIndex, availableStates, getAvailableCityKeys]);

  const clearAllStates = useCallback(() => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;
        return { ...z, selectedCities: [], selectedStates: [] };
      })
    );
  }, [currentConfig, currentZoneIndex]);

  const saveCurrentZone = useCallback(async () => {
    if (!currentConfig) return;

    // Check if current zone has no cities AND no cities are available
    if (currentConfig.selectedCities.length === 0 && availableStates.length === 0) {
      const result = await showWarning('no-cities-available', [currentConfig.zoneCode], currentConfig.region);
      
      if (result === 'delete') {
        removeZones([currentConfig.zoneCode]);
        // Find next zone to configure
        const remainingZones = zoneConfigs.filter(z => z.zoneCode !== currentConfig.zoneCode);
        if (remainingZones.length === 0) {
          setCurrentStep("select-zones");
        }
      } else if (result === 'back') {
        setCurrentStep("select-zones");
      }
      return;
    }

    if (currentConfig.selectedCities.length === 0) {
      alert("Please select at least one city before saving");
      return;
    }

    // Check if saving would leave other zones empty
    const emptyZones = getEmptyZonesAfterSave(currentConfig.zoneCode);
    
    if (emptyZones.length > 0) {
      const result = await showWarning('exhaustion', emptyZones, currentConfig.region);
      
      if (result === 'cancel') {
        return;
      }
      
      if (result === 'delete') {
        // Delete the empty zones and continue
        removeZones(emptyZones);
      }
      // 'continue' - proceed without deleting
    }

    // Mark current zone as complete and find next
    setZoneConfigs((prev) => {
      const updated = prev.map((z, idx) => 
        idx === currentZoneIndex ? { ...z, isComplete: true } : z
      );
      
      // Find next incomplete zone
      const nextIncomplete = updated.findIndex((z, idx) => idx > currentZoneIndex && !z.isComplete);
      if (nextIncomplete !== -1) {
        setTimeout(() => setCurrentZoneIndex(nextIncomplete), 0);
      }
      
      return updated;
    });
  }, [currentConfig, currentZoneIndex, availableStates, showWarning, removeZones, getEmptyZonesAfterSave, zoneConfigs]);

  const finalizeConfiguration = useCallback(async () => {
    const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
    
    if (validZones.length === 0) {
      alert("Please configure at least one zone with cities");
      return;
    }

    // Check for empty zones across all regions
    const allEmptyZones: string[] = [];
    (["North", "South", "East", "West", "Northeast", "Central"] as RegionGroup[]).forEach((region) => {
      const disabled = getDisabledZonesInRegion(region);
      // Only include zones that are selected but have no cities
      disabled.forEach((z) => {
        const config = zoneConfigs.find(c => c.zoneCode === z);
        if (config && config.selectedCities.length === 0) {
          allEmptyZones.push(z);
        }
      });
    });

    if (allEmptyZones.length > 0) {
      // Group by region for better UX
      const firstEmptyZone = allEmptyZones[0];
      const region = codeToRegion(firstEmptyZone);
      
      const result = await showWarning('exhaustion', allEmptyZones, region);
      
      if (result === 'cancel') {
        return;
      }
      
      if (result === 'delete') {
        removeZones(allEmptyZones);
        // Recalculate valid zones after removal
        const updatedValidZones = zoneConfigs
          .filter((z) => !allEmptyZones.includes(z.zoneCode) && z.selectedCities.length > 0);
        
        if (updatedValidZones.length === 0) {
          alert("No zones with cities remaining. Please configure at least one zone.");
          return;
        }
      }
    }

    // Get final valid zones after any deletions
    const finalValidZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
    
    updateZones(finalValidZones);

    // Initialize price matrix
    const matrix: Record<string, Record<string, number>> = {};
    finalValidZones.forEach((fromZone) => {
      matrix[fromZone.zoneCode] = {};
      finalValidZones.forEach((toZone) => {
        matrix[fromZone.zoneCode][toZone.zoneCode] = 0;
      });
    });

    updatePriceMatrix(matrix);
    setCurrentStep("price-matrix");
  }, [zoneConfigs, getDisabledZonesInRegion, showWarning, removeZones, updateZones, updatePriceMatrix]);

  /* =========================================================
     STEP 3: PRICE MATRIX HANDLERS
     ======================================================= */

  const validZones = useMemo(
    () => zoneConfigs.filter((z) => z.selectedCities.length > 0),
    [zoneConfigs]
  );

  const updatePrice = useCallback((fromZone: string, toZone: string, value: number | null) => {
    const updated = { ...wizardData.priceMatrix };
    if (!updated[fromZone]) updated[fromZone] = {};
    updated[fromZone][toZone] = value ?? 0;
    updatePriceMatrix(updated);
  }, [wizardData.priceMatrix, updatePriceMatrix]);

  const getPrice = useCallback((fromZone: string, toZone: string): number | null => {
    return wizardData.priceMatrix?.[fromZone]?.[toZone] ?? null;
  }, [wizardData.priceMatrix]);

  const savePriceMatrixAndReturn = useCallback(() => {
    navigate("/addvendor", { replace: true });
  }, [navigate]);

  /* =========================================================
     WARNING MODAL COMPONENT
     ======================================================= */
  const WarningModal = () => {
    if (!warningModal.isOpen) return null;

    const { type, message, affectedZones, region, stats } = warningModal;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {type === 'exhaustion' && 'Zones Without Cities'}
                {type === 'no-cities-available' && 'No Cities Available'}
                {type === 'zone-disabled-info' && 'Zone Unavailable'}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-slate-900">{stats.totalCities}</div>
                  <div className="text-xs text-slate-500">Total Cities</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-green-600">{stats.assignedCities}</div>
                  <div className="text-xs text-slate-500">Assigned</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-orange-600">{stats.availableCities}</div>
                  <div className="text-xs text-slate-500">Available</div>
                </div>
              </div>
            </div>
          )}

          {/* Affected Zones */}
          {affectedZones.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs font-semibold text-orange-800 mb-2">
                Affected Zone{affectedZones.length > 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-2">
                {affectedZones.map((zone) => (
                  <span key={zone} className="px-2 py-1 bg-orange-200 text-orange-800 rounded text-sm font-medium">
                    {zone}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-6">
            {/* Cancel - always available */}
            <button
              onClick={() => closeWarningModal('cancel')}
              className="flex-1 min-w-[100px] px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>

            {/* Back to Selection - for no-cities-available */}
            {type === 'no-cities-available' && (
              <button
                onClick={() => closeWarningModal('back')}
                className="flex-1 min-w-[100px] px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Back to Selection
              </button>
            )}

            {/* Continue Anyway - for exhaustion */}
            {type === 'exhaustion' && (
              <button
                onClick={() => closeWarningModal('continue')}
                className="flex-1 min-w-[100px] px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
              >
                Continue Anyway
              </button>
            )}

            {/* Delete Zone(s) - always available when there are affected zones */}
            {affectedZones.length > 0 && (
              <button
                onClick={() => closeWarningModal('delete')}
                className="flex-1 min-w-[100px] px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete {affectedZones.length > 1 ? `${affectedZones.length} Zones` : 'Zone'}
              </button>
            )}
          </div>

          {/* Help text */}
          <p className="text-xs text-slate-500 mt-4 text-center">
            {type === 'exhaustion' && 'Deleting empty zones will remove them from your configuration.'}
            {type === 'no-cities-available' && 'You can go back and reassign cities from other zones.'}
            {type === 'zone-disabled-info' && 'Delete this zone or reassign cities from other zones in this region.'}
          </p>
        </div>
      </div>
    );
  };

  /* =========================================================
     RENDER
     ======================================================= */

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading data…</p>
        </div>
      </div>
    );
  }

  /* ---------- STEP 1: SELECT ZONES ---------- */
  if (currentStep === "select-zones") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-8 py-8">
          <div className="mb-6">
            <button
              onClick={() => navigate("/addvendor")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Add Vendor
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Select Your Zones</h1>
                <p className="mt-1 text-slate-600">
                  Pick up to {MAX_ZONES} zones from the regions below. Zones must be selected sequentially within each region.
                </p>
              </div>
              
              <div className="flex gap-3 ml-6">
                <button
                  onClick={selectAllZones}
                  disabled={selectedZoneCodes.length === Object.values(regionGroups).flat().length}
                  className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all shadow-md ${
                    selectedZoneCodes.length === Object.values(regionGroups).flat().length
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:shadow-lg hover:scale-105"
                  }`}
                >
                  Select All Zones
                </button>
                <button
                  onClick={deselectAllZones}
                  disabled={selectedZoneCodes.length === 0}
                  className={`px-6 py-3 text-sm font-semibold rounded-xl transition-all shadow-md ${
                    selectedZoneCodes.length === 0
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-lg hover:scale-105"
                  }`}
                >
                  Deselect All Zones
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {(Object.keys(regionGroups) as RegionGroup[]).map((region) => {
                const regionZones = regionGroups[region];
                const visibleZones = getVisibleZones(region);
                const hasExpandable = hasExpandableZones(region);
                
                const selectedInRegion = selectedZoneCodes.filter(z => regionZones.includes(z));
                const hasAnySelected = selectedInRegion.length > 0;
                const allSelected = selectedInRegion.length === regionZones.length;

                const totalCities = getTotalCitiesInRegion(region);
                const assignedCities = getAssignedCitiesInRegion(region);
                const availableCities = totalCities - assignedCities;
                const disabledZones = getDisabledZonesInRegion(region);

                return (
                  <div key={region} className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <MapPin className="h-6 w-6 text-blue-600" />
                        <h3 className="text-xl font-semibold text-slate-900">{region}</h3>
                        <span className="text-sm text-slate-500">
                          ({selectedInRegion.length}/{regionZones.length} selected)
                        </span>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllInRegion(region)}
                          disabled={allSelected || (selectedZoneCodes.length + regionZones.length - selectedInRegion.length > MAX_ZONES)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            allSelected || (selectedZoneCodes.length + regionZones.length - selectedInRegion.length > MAX_ZONES)
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => deselectAllInRegion(region)}
                          disabled={!hasAnySelected}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            !hasAnySelected
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Region Stats Warning */}
                    {assignedCities > 0 && (
                      <div className={`mt-2 mb-3 p-3 rounded-lg ${
                        availableCities === 0 
                          ? "bg-red-50 border border-red-200" 
                          : "bg-orange-50 border border-orange-200"
                      }`}>
                        <p className={`text-sm font-semibold ${
                          availableCities === 0 ? "text-red-800" : "text-orange-800"
                        }`}>
                          {availableCities === 0 
                            ? `⚠️ All ${totalCities} cities assigned.`
                            : `⚠️ ${assignedCities}/${totalCities} cities assigned. ${availableCities} remaining.`
                          }
                        </p>
                        {disabledZones.length > 0 && (
                          <p className={`text-xs mt-1 ${
                            availableCities === 0 ? "text-red-700" : "text-orange-700"
                          }`}>
                            {disabledZones.length} zone(s) unavailable: {disabledZones.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {visibleZones.map((code) => {
                        const selected = selectedZoneCodes.includes(code);
                        const zoneDisabled = isZoneDisabled(code);
                        const canSelect = !selected && canSelectZone(code, selectedZoneCodes);
                        const canDeselect = selected && canDeselectZone(code, selectedZoneCodes);
                        const disabled = !selected && (selectedZoneCodes.length >= MAX_ZONES || !canSelect);
                        const notAllowed = selected && !canDeselect && !zoneDisabled;

                        return (
                          <button
                            key={code}
                            onClick={() => toggleZoneSelection(code)}
                            disabled={disabled && !zoneDisabled}
                            className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                              zoneDisabled && selected
                                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md border-2 border-red-700 cursor-pointer"
                                : selected
                                ? notAllowed
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md opacity-75 cursor-not-allowed"
                                  : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
                                : disabled
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                            }`}
                            title={
                              zoneDisabled && selected
                                ? "No cities available - click to view options"
                                : notAllowed
                                ? "Can only deselect from the end of the sequence"
                                : disabled && !canSelect
                                ? "Must select zones sequentially"
                                : ""
                            }
                          >
                            {code}
                            {zoneDisabled && selected && <span className="ml-1 text-xs">⚠️</span>}
                          </button>
                        );
                      })}

                      {hasExpandable && (
                        <>
                          <button
                            onClick={() => expandRegionZones(region)}
                            disabled={!canExpandRegion(region)}
                            className={`px-5 py-3 rounded-xl font-bold text-lg shadow-md transition-all ${
                              canExpandRegion(region)
                                ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 hover:scale-105"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                            title={canExpandRegion(region) ? "Show next zone" : "Select all visible zones first"}
                          >
                            +
                          </button>

                          {visibleZoneCount[region] > 1 && (
                            <button
                              onClick={() => collapseRegionZones(region)}
                              className="px-5 py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md transition-all hover:scale-105"
                              title="Hide last zone"
                            >
                              −
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedZoneCodes.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <h4 className="font-semibold text-blue-900">Selected Zones ({selectedZoneCodes.length})</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedZoneCodes.map((code) => {
                    const zoneDisabled = isZoneDisabled(code);
                    return (
                      <span 
                        key={code} 
                        className={`px-3 py-1.5 rounded-full text-sm ${
                          zoneDisabled 
                            ? "bg-red-500 text-white" 
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {code} {zoneDisabled && "⚠️"}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-center">
              <button
                onClick={proceedToConfiguration}
                disabled={selectedZoneCodes.length === 0}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Sparkles className="h-6 w-6" />
                Configure Zones
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <WarningModal />
      </div>
    );
  }

  /* ---------- STEP 2: CONFIGURE ZONES ---------- */
  if (currentStep === "configure-zones" && currentConfig) {
    const activeState = getActiveState();
    const allConfiguredOrEmpty = zoneConfigs.every(z => 
      z.isComplete || 
      z === currentConfig || 
      (isZoneDisabled(z.zoneCode) && z.selectedCities.length === 0)
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-8 py-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Configure Zones</h1>
            <p className="text-slate-600">Assign cities to each zone. Cities can only belong to one zone.</p>
          </div>

          {/* Zone Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {zoneConfigs.map((z, idx) => {
              const zoneDisabled = isZoneDisabled(z.zoneCode);
              const isEmpty = z.selectedCities.length === 0;
              
              return (
                <button
                  key={z.zoneCode}
                  onClick={() => setCurrentZoneIndex(idx)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                    idx === currentZoneIndex
                      ? "bg-blue-600 text-white shadow-lg"
                      : z.isComplete
                      ? "bg-green-100 text-green-700"
                      : zoneDisabled && isEmpty
                      ? "bg-red-100 text-red-700"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {z.zoneName} 
                  {z.isComplete && " ✓"}
                  {zoneDisabled && isEmpty && !z.isComplete && " ⚠️"}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Zone {currentConfig.zoneName} <span className="text-slate-500">({currentConfig.region})</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* States Panel */}
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">States</h3>
                
                {availableStates.length === 0 ? (
                  <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl text-center">
                    <div className="text-red-600 text-4xl mb-3">🚫</div>
                    <p className="text-lg font-semibold text-red-900 mb-2">No Cities Available</p>
                    <p className="text-sm text-red-700">
                      All cities in the {currentConfig.region} region have been assigned to previous zones.
                    </p>
                    <div className="mt-4 flex gap-2 justify-center">
                      <button
                        onClick={() => setCurrentStep("select-zones")}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700"
                      >
                        Back to Selection
                      </button>
                      <button
                        onClick={() => removeZones([currentConfig.zoneCode])}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" /> Delete Zone
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {availableStates.map((state) => {
                      const availableKeys = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
                      const selectedCount = currentConfig.selectedCities.filter((k) => parseCsKey(k).state === state).length;
                      const totalForThisZone = availableKeys.length;
                      const isActive = activeState === state;

                      return (
                        <div
                          key={state}
                          onClick={() => setActiveState(state)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isActive
                              ? "border-blue-600 bg-blue-50"
                              : selectedCount > 0
                              ? "border-green-300 bg-green-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-slate-900">{state}</div>
                            <div className="text-sm text-slate-600">
                              {selectedCount}/{totalForThisZone}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cities Panel */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Cities {activeState && `(${activeState})`}
                  </h3>
                  {activeState && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => selectAllInState(activeState)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200"
                      >
                        Select All
                      </button>
                      <button
                        onClick={() => clearState(activeState)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  {!activeState && (
                    <div className="text-sm text-slate-500 text-center py-8">
                      Select a state to view its cities
                    </div>
                  )}

                  {activeState && (
                    <div className="space-y-2">
                      {(() => {
                        const available = getAvailableCityKeys(activeState, currentConfig.region, currentZoneIndex);
                        const alreadySelected = currentConfig.selectedCities.filter(
                          (k) => parseCsKey(k).state === activeState
                        );

                        const allCityKeys = Array.from(new Set([...alreadySelected, ...available]));
                        const sorted = allCityKeys
                          .map((k) => ({ key: k, city: parseCsKey(k).city }))
                          .sort((a, b) => a.city.localeCompare(b.city));

                        return sorted.map(({ key, city }) => {
                          const isSelected = currentConfig.selectedCities.includes(key);
                          const isAvailable = available.includes(key);
                          const isBlocked = !isAvailable && !isSelected;

                          return (
                            <label
                              key={key}
                              className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
                                isSelected
                                  ? "bg-green-50 border-green-200"
                                  : isBlocked
                                  ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                                  : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                              }`}
                            >
                              <span className="truncate">{city}</span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isBlocked}
                                onChange={() => toggleCity(key)}
                                className="h-4 w-4 text-green-600"
                              />
                            </label>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900">Summary</h4>
              <p className="text-sm text-blue-800">
                {currentConfig.selectedCities.length} cities in {currentConfig.selectedStates.length} state(s)
              </p>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep("select-zones")}
                className="px-4 py-2 text-slate-700 hover:text-slate-900"
              >
                ← Back to Selection
              </button>

              <div className="flex gap-2">
                <button
                  onClick={selectAllStates}
                  disabled={availableStates.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-5 w-5" /> Select All States
                </button>
                
                <button
                  onClick={clearAllStates}
                  disabled={currentConfig.selectedCities.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-5 w-5" /> Clear All
                </button>
                
                <button
                  onClick={saveCurrentZone}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
                >
                  <CheckCircle className="h-5 w-5" /> Save & Next
                </button>

                {allConfiguredOrEmpty && (
                  <button
                    onClick={finalizeConfiguration}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <Sparkles className="h-5 w-5" /> Complete Configuration
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <WarningModal />
      </div>
    );
  }

  /* ---------- STEP 3: PRICE MATRIX ---------- */
  if (currentStep === "price-matrix") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-8 py-8">
          <div className="mb-6">
            <button
              onClick={() => setCurrentStep("configure-zones")}
              className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Configuration
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Zone Price Matrix</h1>
            <p className="text-slate-600 mb-6">Enter the price for shipping between zones.</p>

            <div className="overflow-auto max-h-[600px] border border-slate-300 rounded-lg">
              <table className="w-full border-separate border-spacing-0">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 p-2 bg-slate-100 font-bold text-slate-800 text-sm border border-slate-300">
                      FROM / TO
                    </th>
                    {validZones.map((zone) => (
                      <th
                        key={zone.zoneCode}
                        className="p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300 min-w-[80px]"
                      >
                        {zone.zoneCode}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {validZones.map((fromZone) => (
                    <tr key={fromZone.zoneCode}>
                      <td className="sticky left-0 z-10 p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300">
                        {fromZone.zoneCode}
                      </td>
                      {validZones.map((toZone) => (
                        <td key={toZone.zoneCode} className="p-1 border border-slate-300">
                          <DecimalInput
                            value={getPrice(fromZone.zoneCode, toZone.zoneCode)}
                            onChange={(value) => updatePrice(fromZone.zoneCode, toZone.zoneCode, value)}
                            placeholder="0.00"
                            className="w-full px-2 py-1 border border-slate-200 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            max={999}
                            maxDecimals={2}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900">Matrix Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 text-sm">
                <div>
                  <span className="text-blue-700">Zones:</span>
                  <span className="ml-2 font-semibold">{validZones.length}</span>
                </div>
                <div>
                  <span className="text-blue-700">Total Routes:</span>
                  <span className="ml-2 font-semibold">{validZones.length * validZones.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={savePriceMatrixAndReturn}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                <CheckCircle className="h-5 w-5" />
                Save & Return to Add Vendor
              </button>
            </div>
          </div>
        </div>

        <WarningModal />
      </div>
    );
  }

  return null;
};

export default ZonePriceMatrix;