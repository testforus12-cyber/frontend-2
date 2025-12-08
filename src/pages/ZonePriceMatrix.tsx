// import React, { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { ArrowLeft, CheckCircle, ChevronRight, MapPin, Sparkles } from "lucide-react";
// import { useWizardStorage } from "../hooks/useWizardStorage";
// import type { ZoneConfig, RegionGroup, PincodeEntry } from "../types/wizard.types";
// import DecimalInput from "../components/DecimalInput";

// /* =========================================================
//    CONSTANTS
//    ======================================================= */
// const MAX_ZONES = 28;

// const ZONE_ORDER = [
//   'N1', 'N2', 'N3', 'N4', 'N5', 'N6',
//   'W1', 'W2', 'W3', 'W4',
//   'C1', 'C2', 'C3', 'C4',
//   'S1', 'S2', 'S3', 'S4', 'S5', 'S6',
//   'E1', 'E2', 'E3', 'E4',
//   'NE1', 'NE2', 'NE3', 'NE4'
// ];

// const regionGroups: Record<RegionGroup, string[]> = {
//   North: ["N1", "N2", "N3", "N4", "N5", "N6"],
//   South: ["S1", "S2", "S3", "S4", "S5", "S6"],
//   East: ["E1", "E2", "E3", "E4"],
//   West: ["W1", "W2", "W3", "W4"],
//   Northeast: ["NE1", "NE2", "NE3", "NE4"],
//   Central: ["C1", "C2", "C3", "C4"],
// };

// /* =========================================================
//    HELPER FUNCTIONS
//    ======================================================= */

// const codeToRegion = (code: string): RegionGroup => {
//   if (code.startsWith("NE")) return "Northeast";
//   const c = code[0];
//   if (c === "N") return "North";
//   if (c === "S") return "South";
//   if (c === "E") return "East";
//   if (c === "W") return "West";
//   if (c === "C") return "Central";
//   return "North";
// };

// const sortZonesByOrder = (zones: string[]): string[] => {
//   return zones.sort((a, b) => {
//     const indexA = ZONE_ORDER.indexOf(a);
//     const indexB = ZONE_ORDER.indexOf(b);
//     if (indexA !== -1 && indexB !== -1) return indexA - indexB;
//     return a.localeCompare(b);
//   });
// };

// const csKey = (city: string, state: string) => `${city}||${state}`;
// const parseCsKey = (key: string) => {
//   const i = key.lastIndexOf("||");
//   return { city: key.slice(0, i), state: key.slice(i + 2) };
// };

// /* =========================================================
//    MAIN COMPONENT
//    ======================================================= */
// const ZonePriceMatrix: React.FC = () => {
//   const navigate = useNavigate();
//   const { wizardData, updateZones, updatePriceMatrix, isLoaded } = useWizardStorage();

//   // Dataset
//   const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);
//   const [isLoadingData, setIsLoadingData] = useState(true);

//   // Steps
//   const [currentStep, setCurrentStep] = useState<"select-zones" | "configure-zones" | "price-matrix">("select-zones");

//   // Step 1: Zone Selection
//   const [selectedZoneCodes, setSelectedZoneCodes] = useState<string[]>([]);
  
//   // ✅ NEW FEATURE: Track which regions have expanded zones (5 and 6) visible
//   // 0 = show only zones 1-4, 1 = show zone 5 too, 2 = show zones 5 and 6
//   const [expandedRegions, setExpandedRegions] = useState<Record<RegionGroup, number>>({
//     North: 0,
//     South: 0,
//     East: 0,
//     West: 0,
//     Northeast: 0,
//     Central: 0,
//   });

//   // Step 2: Zone Configuration
//   const [zoneConfigs, setZoneConfigs] = useState<ZoneConfig[]>([]);
//   const [currentZoneIndex, setCurrentZoneIndex] = useState(0);
//   const [activeStateByZone, setActiveStateByZone] = useState<Record<string, string | null>>({});

//   /* -------------------- Load Pincode Data -------------------- */
//   useEffect(() => {
//     const url = `${import.meta.env.BASE_URL || "/"}pincodes.json`;
//     fetch(url)
//       .then((res) => res.json())
//       .then((data: PincodeEntry[]) => {
//         const filtered = (Array.isArray(data) ? data : []).filter(
//           (e) =>
//             e.state &&
//             e.city &&
//             e.state !== "NAN" &&
//             e.state !== "NaN" &&
//             e.city !== "NAN" &&
//             e.city !== "NaN" &&
//             e.state.trim() !== "" &&
//             e.city.trim() !== "" &&
//             e.pincode &&
//             /^\d{6}$/.test(String(e.pincode))
//         );
//         setPincodeData(filtered);
//       })
//       .catch((err) => console.error("Failed to load pincode data:", err))
//       .finally(() => setIsLoadingData(false));
//   }, []);

//   /* -------------------- Load from Wizard Storage -------------------- */
//   useEffect(() => {
//     if (!isLoaded) return;

//     if (wizardData.zones && wizardData.zones.length > 0) {
//       const sortedZones = [...wizardData.zones].sort((a, b) => {
//         const indexA = ZONE_ORDER.indexOf(a.zoneCode);
//         const indexB = ZONE_ORDER.indexOf(b.zoneCode);
//         return indexA - indexB;
//       });

//       setZoneConfigs(sortedZones);
//       setSelectedZoneCodes(sortedZones.map((z) => z.zoneCode));

//       // Determine current step based on data
//       // ✅ Check if price matrix is actually valid
//       const hasPriceMatrix = 
//         wizardData.priceMatrix && 
//         Object.keys(wizardData.priceMatrix).length > 0 &&
//         Object.values(wizardData.priceMatrix).some(toZones => 
//           Object.keys(toZones).length > 0
//         );
      
//       // ✅ Check if zones have actual cities configured
//       const hasConfiguredZones = sortedZones.some(z => 
//         z.isComplete && z.selectedCities && z.selectedCities.length > 0
//       );

//       if (hasPriceMatrix) {
//         setCurrentStep("price-matrix");
//       } else if (hasConfiguredZones) {
//         setCurrentStep("configure-zones");
//       } else {
//         // ✅ If zones exist but not configured, go to select-zones
//         setCurrentStep("select-zones");
//       }
//     } else {
//       // ✅ No zones at all, definitely start at select-zones
//       setCurrentStep("select-zones");
//     }
//   }, [isLoaded, wizardData]);

//   /* -------------------- Derived Data -------------------- */

//   // Region -> State -> Set<City>
//   const byStateByRegion = useMemo(() => {
//     const map = new Map<RegionGroup, Map<string, Set<string>>>();
//     (["North", "South", "East", "West", "Northeast", "Central"] as RegionGroup[]).forEach((r) =>
//       map.set(r, new Map())
//     );

//     for (const e of pincodeData) {
//       const region = codeToRegion(e.zone || "");
//       const stateMap = map.get(region)!;
//       if (!stateMap.has(e.state)) stateMap.set(e.state, new Set());
//       stateMap.get(e.state)!.add(e.city);
//     }

//     return map;
//   }, [pincodeData]);

//   // Get all city keys for a state in a region
//   const getAllCityKeysForState = (state: string, region: RegionGroup): string[] => {
//     const stateMap = byStateByRegion.get(region);
//     if (!stateMap) return [];
//     const cities = stateMap.get(state);
//     if (!cities) return [];
//     return Array.from(cities).map((c) => csKey(c, state));
//   };

//   // Get cities already used by other zones
//   const getUsedCities = (excludeZoneIndex?: number): Set<string> => {
//     const used = new Set<string>();
//     zoneConfigs.forEach((z, idx) => {
//       if (idx !== excludeZoneIndex) {
//         z.selectedCities.forEach((c) => used.add(c));
//       }
//     });
//     return used;
//   };

//   // Get available city keys for a state (not used by other zones)
//   const getAvailableCityKeys = (state: string, region: RegionGroup, currentZoneIndex: number): string[] => {
//     const allKeys = getAllCityKeysForState(state, region);
//     const used = getUsedCities(currentZoneIndex);
//     return allKeys.filter((k) => !used.has(k));
//   };

//   // Current zone config
//   const currentConfig = zoneConfigs[currentZoneIndex];

//   // Get states for current zone
//   const availableStates = useMemo(() => {
//     if (!currentConfig) return [];
//     const stateMap = byStateByRegion.get(currentConfig.region);
//     if (!stateMap) return [];
    
//     // Return ALL states in this region
//     return Array.from(stateMap.keys()).sort((a, b) => a.localeCompare(b));
//   }, [currentConfig, byStateByRegion]);

//   /* =========================================================
//      NEW HELPER FUNCTIONS FOR CONSTRAINTS
//      ======================================================= */

//   // Check if a zone can be selected based on sequential constraints
//   const canSelectZone = (code: string, currentSelection: string[]): boolean => {
//     const region = codeToRegion(code);
//     const regionZones = regionGroups[region];
//     const selectedInRegion = currentSelection.filter(z => regionGroups[region].includes(z));
    
//     if (selectedInRegion.length === 0) {
//       // If no zones selected in this region, must start with first zone
//       return code === regionZones[0];
//     }
    
//     // Get indices of selected zones in this region
//     const selectedIndices = selectedInRegion.map(z => regionZones.indexOf(z)).sort((a, b) => a - b);
//     const targetIndex = regionZones.indexOf(code);
    
//     // Check if there's a gap before this zone
//     const minIndex = Math.min(...selectedIndices);
//     const maxIndex = Math.max(...selectedIndices);
    
//     // Can select if it's adjacent to the current selection (no gaps)
//     if (targetIndex === maxIndex + 1 || targetIndex === minIndex - 1) {
//       return true;
//     }
    
//     // Can select if it fills a gap in the current selection
//     if (targetIndex > minIndex && targetIndex < maxIndex) {
//       // Check if this would complete a continuous sequence
//       for (let i = minIndex; i <= maxIndex; i++) {
//         if (!selectedInRegion.includes(regionZones[i]) && i !== targetIndex) {
//           return false; // There's another gap
//         }
//       }
//       return true;
//     }
    
//     return false;
//   };

//   // Check if a zone can be deselected based on sequential constraints
//   const canDeselectZone = (code: string, currentSelection: string[]): boolean => {
//     const region = codeToRegion(code);
//     const regionZones = regionGroups[region];
//     const selectedInRegion = currentSelection.filter(z => regionGroups[region].includes(z));
    
//     if (selectedInRegion.length === 0) return false;
    
//     // Get indices of selected zones in this region
//     const selectedIndices = selectedInRegion.map(z => regionZones.indexOf(z)).sort((a, b) => a - b);
//     const targetIndex = regionZones.indexOf(code);
    
//     // Can only deselect from the ends of the sequence
//     const minIndex = Math.min(...selectedIndices);
//     const maxIndex = Math.max(...selectedIndices);
    
//     return targetIndex === minIndex || targetIndex === maxIndex;
//   };

//   // Select all zones in a region
//   const selectAllInRegion = (region: RegionGroup) => {
//     const regionZones = regionGroups[region];
//     const currentlySelected = selectedZoneCodes.filter(z => !regionGroups[region].includes(z));
//     const newSelection = [...currentlySelected, ...regionZones];
    
//     if (newSelection.length > MAX_ZONES) {
//       alert(`Cannot select all zones in ${region}. Maximum ${MAX_ZONES} zones allowed.`);
//       return;
//     }
    
//     const sorted = sortZonesByOrder(newSelection);
//     setSelectedZoneCodes(sorted);
    
//     // Update zone configs
//     setZoneConfigs((old) => {
//       const existing = old.filter(z => !regionGroups[region].includes(z.zoneCode));
//       const newZones = regionZones.map(code => {
//         const existingZone = old.find(z => z.zoneCode === code);
//         if (existingZone) return existingZone;
        
//         return {
//           zoneCode: code,
//           zoneName: code,
//           region: codeToRegion(code),
//           selectedStates: [],
//           selectedCities: [],
//           isComplete: false,
//         };
//       });
      
//       const updated = [...existing, ...newZones];
//       return updated.sort((a, b) => {
//         const indexA = ZONE_ORDER.indexOf(a.zoneCode);
//         const indexB = ZONE_ORDER.indexOf(b.zoneCode);
//         return indexA - indexB;
//       });
//     });
//   };

//   // Deselect all zones in a region
//   const deselectAllInRegion = (region: RegionGroup) => {
//     const newSelection = selectedZoneCodes.filter(z => !regionGroups[region].includes(z));
//     const sorted = sortZonesByOrder(newSelection);
//     setSelectedZoneCodes(sorted);
    
//     // Remove from configs
//     setZoneConfigs((old) => old.filter(z => !regionGroups[region].includes(z.zoneCode)));
//   };

//   /* =========================================================
//      ✅ NEW FEATURE: ZONE EXPANSION HELPERS (Progressive Reveal)
//      ======================================================= */

//   /**
//    * Get visible zones for a region based on expansion state
//    * - Level 0: Show only zones 1-4 (base zones)
//    * - Level 1: Show zones 1-5 (base + zone 5)
//    * - Level 2: Show zones 1-6 (all zones)
//    */
//   const getVisibleZones = (region: RegionGroup): string[] => {
//     const allZones = regionGroups[region];
//     const expandLevel = expandedRegions[region] || 0;
    
//     // For regions with only 4 zones (East, West, Northeast, Central), show all
//     if (allZones.length <= 4) {
//       return allZones;
//     }
    
//     // For North and South (6 zones each)
//     if (expandLevel === 0) {
//       // Show only zones 1-4
//       return allZones.filter(z => !z.match(/[56]$/));
//     } else if (expandLevel === 1) {
//       // Show zones 1-5
//       return allZones.filter(z => !z.endsWith('6'));
//     } else {
//       // Show all zones (1-6)
//       return allZones;
//     }
//   };

//   /**
//    * Check if a region has zones 5 or 6 that can be revealed
//    */
//   const hasExpandableZones = (region: RegionGroup): boolean => {
//     const allZones = regionGroups[region];
//     return allZones.some(z => z.match(/[56]$/));
//   };

//   /**
//    * Expand zones in a region (show next hidden zone)
//    * First click: show zone 5
//    * Second click: show zone 6
//    */
//   const expandRegionZones = (region: RegionGroup) => {
//     setExpandedRegions(prev => ({
//       ...prev,
//       [region]: Math.min((prev[region] || 0) + 1, 2) // Max level 2
//     }));
//   };

//   /**
//    * Collapse zones in a region (hide last revealed zone)
//    * First click: hide zone 6 (if showing)
//    * Second click: hide zone 5
//    */
//   const collapseRegionZones = (region: RegionGroup) => {
//     setExpandedRegions(prev => ({
//       ...prev,
//       [region]: Math.max((prev[region] || 0) - 1, 0) // Min level 0
//     }));
//   };

//   /* =========================================================
//      STEP 1: ZONE SELECTION
//      ======================================================= */

//   const toggleZoneSelection = (code: string) => {
//     setSelectedZoneCodes((prev) => {
//       const isSelected = prev.includes(code);

//       if (isSelected) {
//         // Deselection - check if allowed
//         if (!canDeselectZone(code, prev)) {
//           const region = codeToRegion(code);
//           alert(`You can only deselect zones from the ends of the sequence in ${region} region.`);
//           return prev;
//         }
        
//         const next = prev.filter((c) => c !== code);
//         const sorted = sortZonesByOrder(next);

//         // Remove from configs
//         setZoneConfigs((old) => old.filter((z) => z.zoneCode !== code));

//         return sorted;
//       } else {
//         // Selection - check if allowed
//         if (!canSelectZone(code, prev)) {
//           const region = codeToRegion(code);
//           alert(`You must select zones sequentially in ${region} region. No gaps allowed.`);
//           return prev;
//         }
        
//         if (prev.length >= MAX_ZONES) {
//           alert(`Maximum ${MAX_ZONES} zones allowed`);
//           return prev;
//         }

//         const next = [...prev, code];
//         const sorted = sortZonesByOrder(next);

//         // Add to configs
//         setZoneConfigs((old) => {
//           const exists = old.find((z) => z.zoneCode === code);
//           if (exists) return old;

//           const newZone: ZoneConfig = {
//             zoneCode: code,
//             zoneName: code,
//             region: codeToRegion(code),
//             selectedStates: [],
//             selectedCities: [],
//             isComplete: false,
//           };

//           const updated = [...old, newZone];
//           return updated.sort((a, b) => {
//             const indexA = ZONE_ORDER.indexOf(a.zoneCode);
//             const indexB = ZONE_ORDER.indexOf(b.zoneCode);
//             return indexA - indexB;
//           });
//         });

//         return sorted;
//       }
//     });
//   };

//   const proceedToConfiguration = () => {
//     if (selectedZoneCodes.length === 0) {
//       alert("Please select at least one zone");
//       return;
//     }
//     setCurrentStep("configure-zones");
//     setCurrentZoneIndex(0);
//   };

//   /* =========================================================
//      STEP 2: ZONE CONFIGURATION
//      ======================================================= */

//   const setActiveState = (state: string | null) => {
//     if (!currentConfig) return;
//     setActiveStateByZone((prev) => ({ ...prev, [currentConfig.zoneCode]: state }));
//   };

//   const getActiveState = (): string | null => {
//     if (!currentConfig) return null;
//     return activeStateByZone[currentConfig.zoneCode] || null;
//   };

//   const toggleCity = (cityKey: string) => {
//     if (!currentConfig) return;

//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => {
//         if (idx !== currentZoneIndex) return z;

//         const isSelected = z.selectedCities.includes(cityKey);
//         const selectedCities = isSelected
//           ? z.selectedCities.filter((k) => k !== cityKey)
//           : [...z.selectedCities, cityKey];

//         // Derive states from cities
//         const stateSet = new Set<string>();
//         selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
//         const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

//         return { ...z, selectedCities, selectedStates };
//       })
//     );
//   };

//   const selectAllInState = (state: string) => {
//     if (!currentConfig) return;

//     const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
//     if (available.length === 0) return;

//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => {
//         if (idx !== currentZoneIndex) return z;

//         const selectedCities = Array.from(new Set([...z.selectedCities, ...available]));

//         // Derive states
//         const stateSet = new Set<string>();
//         selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
//         const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

//         return { ...z, selectedCities, selectedStates };
//       })
//     );
//   };

//   const clearState = (state: string) => {
//     if (!currentConfig) return;

//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => {
//         if (idx !== currentZoneIndex) return z;

//         const selectedCities = z.selectedCities.filter((k) => parseCsKey(k).state !== state);

//         // Derive states
//         const stateSet = new Set<string>();
//         selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
//         const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

//         return { ...z, selectedCities, selectedStates };
//       })
//     );
//   };

//   // ✅ NEW: Select all cities from all available states
//   const selectAllStates = () => {
//     if (!currentConfig) return;

//     // Collect all available city keys from all states in this region
//     const allAvailableCities: string[] = [];
    
//     availableStates.forEach((state) => {
//       const available = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
//       allAvailableCities.push(...available);
//     });

//     if (allAvailableCities.length === 0) return;

//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => {
//         if (idx !== currentZoneIndex) return z;

//         // Merge with existing selections and remove duplicates
//         const selectedCities = Array.from(new Set([...z.selectedCities, ...allAvailableCities]));

//         // Derive states
//         const stateSet = new Set<string>();
//         selectedCities.forEach((k) => stateSet.add(parseCsKey(k).state));
//         const selectedStates = Array.from(stateSet).sort((a, b) => a.localeCompare(b));

//         return { ...z, selectedCities, selectedStates };
//       })
//     );
//   };

//   // ✅ NEW: Clear all selected cities from all states
//   const clearAllStates = () => {
//     if (!currentConfig) return;

//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => {
//         if (idx !== currentZoneIndex) return z;

//         // Clear all selections
//         return { 
//           ...z, 
//           selectedCities: [], 
//           selectedStates: [] 
//         };
//       })
//     );
//   };

//   const saveCurrentZone = () => {
//     if (!currentConfig) return;

//     if (currentConfig.selectedCities.length === 0) {
//       alert("Please select at least one city before saving");
//       return;
//     }

//     // Mark as complete
//     setZoneConfigs((prev) =>
//       prev.map((z, idx) => (idx === currentZoneIndex ? { ...z, isComplete: true } : z))
//     );

//     // Navigate to next incomplete zone
//     const nextIncomplete = zoneConfigs.findIndex((z, idx) => idx > currentZoneIndex && !z.isComplete);
//     if (nextIncomplete !== -1) {
//       setCurrentZoneIndex(nextIncomplete);
//     }
//   };

//   const finalizeConfiguration = () => {
//     const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
//     if (validZones.length === 0) {
//       alert("Please configure at least one zone");
//       return;
//     }

//     // Save zones to wizard storage
//     updateZones(validZones);

//     // Initialize price matrix
//     const matrix: Record<string, Record<string, number>> = {};
//     validZones.forEach((fromZone) => {
//       matrix[fromZone.zoneCode] = {};
//       validZones.forEach((toZone) => {
//         matrix[fromZone.zoneCode][toZone.zoneCode] = 0;
//       });
//     });

//     updatePriceMatrix(matrix);
//     setCurrentStep("price-matrix");
//   };

//   /* =========================================================
//      STEP 3: PRICE MATRIX
//      ======================================================= */

//   const validZones = useMemo(
//     () => zoneConfigs.filter((z) => z.selectedCities.length > 0),
//     [zoneConfigs]
//   );

//   const updatePrice = (fromZone: string, toZone: string, value: number | null) => {
//     const updated = { ...wizardData.priceMatrix };
//     if (!updated[fromZone]) updated[fromZone] = {};
//     updated[fromZone][toZone] = value ?? 0;
//     updatePriceMatrix(updated);
//   };

//   const getPrice = (fromZone: string, toZone: string): number | null => {
//     return wizardData.priceMatrix?.[fromZone]?.[toZone] ?? null;
//   };

//   const savePriceMatrixAndReturn = () => {
//     // Already saved via updatePrice, just navigate back
//     navigate("/addvendor", { replace: true });
//   };

//   /* =========================================================
//      RENDER
//      ======================================================= */

//   if (isLoadingData) {
//     return (
//       <div className="min-h-screen bg-slate-50 flex items-center justify-center">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
//           <p className="mt-4 text-slate-600">Loading data…</p>
//         </div>
//       </div>
//     );
//   }

//   /* ---------- STEP 1: SELECT ZONES ---------- */
//   if (currentStep === "select-zones") {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
//         <div className="w-full px-8 py-8">
//           {/* Header */}
//           <div className="mb-6">
//             <button
//               onClick={() => navigate("/addvendor")}
//               className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
//             >
//               <ArrowLeft className="h-4 w-4" /> Back to Add Vendor
//             </button>
//           </div>

//           <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
//             <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900">Select Your Zones</h1>
//             <p className="mt-1 text-slate-600">Pick up to {MAX_ZONES} zones from the regions below. Zones must be selected sequentially within each region.</p>

//             {/* Region Groups */}
//             <div className="mt-6 space-y-6">
//               {(Object.keys(regionGroups) as RegionGroup[]).map((region) => {
//                 const regionZones = regionGroups[region]; // All zones in region
//                 const visibleZones = getVisibleZones(region); // ✅ NEW: Zones currently visible
//                 const hasExpandable = hasExpandableZones(region); // ✅ NEW: Can this region expand?
//                 const expandLevel = expandedRegions[region] || 0; // ✅ NEW: Current expansion level
                
//                 const selectedInRegion = selectedZoneCodes.filter(z => regionZones.includes(z));
//                 const hasAnySelected = selectedInRegion.length > 0;
//                 const allSelected = selectedInRegion.length === regionZones.length;

//                 return (
//                   <div key={region} className="border border-slate-200 rounded-xl p-5">
//                     <div className="flex items-center justify-between mb-3">
//                       <div className="flex items-center gap-3">
//                         <MapPin className="h-6 w-6 text-blue-600" />
//                         <h3 className="text-xl font-semibold text-slate-900">{region}</h3>
//                         <span className="text-sm text-slate-500">
//                           ({selectedInRegion.length}/{regionZones.length} selected)
//                         </span>
//                       </div>
                      
//                       {/* Select All / Deselect All Buttons */}
//                       <div className="flex gap-2">
//                         <button
//                           onClick={() => selectAllInRegion(region)}
//                           disabled={allSelected || (selectedZoneCodes.length + regionZones.length - selectedInRegion.length > MAX_ZONES)}
//                           className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
//                             allSelected || (selectedZoneCodes.length + regionZones.length - selectedInRegion.length > MAX_ZONES)
//                               ? "bg-slate-100 text-slate-400 cursor-not-allowed"
//                               : "bg-green-100 text-green-700 hover:bg-green-200"
//                           }`}
//                         >
//                           Select All
//                         </button>
//                         <button
//                           onClick={() => deselectAllInRegion(region)}
//                           disabled={!hasAnySelected}
//                           className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
//                             !hasAnySelected
//                               ? "bg-slate-100 text-slate-400 cursor-not-allowed"
//                               : "bg-red-100 text-red-700 hover:bg-red-200"
//                           }`}
//                         >
//                           Deselect All
//                         </button>
//                       </div>
//                     </div>

//                     {/* ✅ UPDATED: Zone buttons with expand/collapse functionality */}
//                     <div className="flex flex-wrap gap-3">
//                       {visibleZones.map((code) => {
//                         const selected = selectedZoneCodes.includes(code);
//                         const canSelect = !selected && canSelectZone(code, selectedZoneCodes);
//                         const canDeselect = selected && canDeselectZone(code, selectedZoneCodes);
//                         const disabled = !selected && (selectedZoneCodes.length >= MAX_ZONES || !canSelect);
//                         const notAllowed = selected && !canDeselect;

//                         return (
//                           <button
//                             key={code}
//                             onClick={() => {
//                               if (!disabled && !notAllowed) {
//                                 toggleZoneSelection(code);
//                               } else if (notAllowed) {
//                                 alert(`You can only deselect zones from the ends of the sequence. Deselect zones after ${code} first.`);
//                               }
//                             }}
//                             disabled={disabled}
//                             className={`px-5 py-3 rounded-xl font-semibold transition-all ${
//                               selected
//                                 ? notAllowed
//                                   ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md opacity-75 cursor-not-allowed"
//                                   : "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md scale-105"
//                                 : disabled
//                                 ? "bg-slate-100 text-slate-400 cursor-not-allowed"
//                                 : "bg-slate-100 text-slate-800 hover:bg-slate-200"
//                             }`}
//                             title={
//                               notAllowed
//                                 ? "Can only deselect from the end of the sequence"
//                                 : disabled && !selected && !canSelect
//                                 ? "Must select zones sequentially"
//                                 : ""
//                             }
//                           >
//                             {code}
//                           </button>
//                         );
//                       })}

//                       {/* ✅ NEW: Expand/Collapse Buttons */}
//                       {hasExpandable && (
//                         <>
//                           {/* Show + button if not fully expanded */}
//                           {expandLevel < 2 && (
//                             <button
//                               onClick={() => expandRegionZones(region)}
//                               className="px-5 py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md transition-all hover:scale-105"
//                               title={`Show ${expandLevel === 0 ? 'zone 5' : 'zone 6'}`}
//                             >
//                               +
//                             </button>
//                           )}

//                           {/* Show - button if any zones are expanded */}
//                           {expandLevel > 0 && (
//                             <button
//                               onClick={() => collapseRegionZones(region)}
//                               className="px-5 py-3 rounded-xl font-bold text-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md transition-all hover:scale-105"
//                               title={`Hide ${expandLevel === 2 ? 'zone 6' : 'zone 5'}`}
//                             >
//                               −
//                             </button>
//                           )}
//                         </>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>

//             {/* Selected Zones Summary */}
//             {selectedZoneCodes.length > 0 && (
//               <div className="mt-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
//                 <h4 className="font-semibold text-blue-900">Selected Zones ({selectedZoneCodes.length})</h4>
//                 <div className="mt-2 flex flex-wrap gap-2">
//                   {selectedZoneCodes.map((code) => (
//                     <span key={code} className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm">
//                       {code}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Proceed Button */}
//             <div className="mt-8 flex justify-center">
//               <button
//                 onClick={proceedToConfiguration}
//                 disabled={selectedZoneCodes.length === 0}
//                 className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
//               >
//                 <Sparkles className="h-6 w-6" />
//                 Configure Zones
//                 <ChevronRight className="h-5 w-5" />
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   /* ---------- STEP 2: CONFIGURE ZONES ---------- */
//   if (currentStep === "configure-zones" && currentConfig) {
//     const activeState = getActiveState();

//     return (
//       <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
//         <div className="w-full px-8 py-8">
//           {/* Header */}
//           <div className="mb-4">
//             <h1 className="text-3xl font-bold text-slate-900">Configure Zones</h1>
//             <p className="text-slate-600">Assign cities to each zone. Cities can only belong to one zone.</p>
//           </div>

//           {/* Zone Tabs */}
//           <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
//             {zoneConfigs.map((z, idx) => (
//               <button
//                 key={z.zoneCode}
//                 onClick={() => setCurrentZoneIndex(idx)}
//                 className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
//                   idx === currentZoneIndex
//                     ? "bg-blue-600 text-white shadow-lg"
//                     : z.isComplete
//                     ? "bg-green-100 text-green-700"
//                     : "bg-slate-200 text-slate-700 hover:bg-slate-300"
//                 }`}
//               >
//                 {z.zoneName} {z.isComplete && "✓"}
//               </button>
//             ))}
//           </div>

//           {/* Configuration Panel */}
//           <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
//             <div className="flex items-center justify-between mb-6">
//               <h2 className="text-2xl font-bold text-slate-900">
//                 Zone {currentConfig.zoneName} <span className="text-slate-500">({currentConfig.region})</span>
//               </h2>
//               <div className="flex gap-2">
//                 <button
//                   onClick={selectAllStates}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
//                   title="Select all cities from all states"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Select All States
//                 </button>
//                 <button
//                   onClick={clearAllStates}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
//                   title="Clear all selected cities"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Clear All States
//                 </button>
//                 <button
//                   onClick={saveCurrentZone}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Save & Next
//                 </button>
//               </div>
//             </div>

//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
//               {/* Left: States */}
//               <div>
//                 <h3 className="text-lg font-semibold text-slate-900 mb-3">States</h3>
//                 <div className="space-y-2 max-h-[500px] overflow-y-auto">
//                   {availableStates.map((state) => {
//                     // ✅ FIX APPLIED HERE:
//                     // We get available keys (which excludes OTHER zones, but includes current zone)
//                     const availableKeys = getAvailableCityKeys(state, currentConfig.region, currentZoneIndex);
                    
//                     // Calculate how many are selected in THIS zone
//                     const selectedCount = currentConfig.selectedCities.filter((k) => parseCsKey(k).state === state).length;
                    
//                     // Denominator is strictly the cities available for this zone (Total - OtherZones)
//                     // This ensures that if N1 took 4/11, N2 sees "0/7" initially.
//                     const totalForThisZone = availableKeys.length; 
                    
//                     const isActive = activeState === state;

//                     return (
//                       <div
//                         key={state}
//                         onClick={() => setActiveState(state)}
//                         className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
//                           isActive
//                             ? "border-blue-600 bg-blue-50"
//                             : selectedCount > 0
//                             ? "border-green-300 bg-green-50"
//                             : "border-slate-200 bg-white hover:border-slate-300"
//                         }`}
//                       >
//                         <div className="flex items-center justify-between">
//                           <div className="font-medium text-slate-900">{state}</div>
//                           <div className="text-sm text-slate-600">
//                             {selectedCount}/{totalForThisZone}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Right: Cities */}
//               <div>
//                 <div className="flex items-center justify-between mb-3">
//                   <h3 className="text-lg font-semibold text-slate-900">
//                     Cities {activeState && `(${activeState})`}
//                   </h3>
//                   {activeState && (
//                     <div className="flex gap-2">
//                       <button
//                         onClick={() => selectAllInState(activeState)}
//                         className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-800 hover:bg-green-200"
//                       >
//                         Select All
//                       </button>
//                       <button
//                         onClick={() => clearState(activeState)}
//                         className="text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-800 hover:bg-red-200"
//                       >
//                         Clear
//                       </button>
//                     </div>
//                   )}
//                 </div>

//                 <div className="max-h-[500px] overflow-y-auto">
//                   {!activeState && (
//                     <div className="text-sm text-slate-500 text-center py-8">
//                       Select a state to view its cities
//                     </div>
//                   )}

//                   {activeState && (
//                     <div className="space-y-2">
//                       {(() => {
//                         const available = getAvailableCityKeys(activeState, currentConfig.region, currentZoneIndex);
//                         const alreadySelected = currentConfig.selectedCities.filter(
//                           (k) => parseCsKey(k).state === activeState
//                         );

//                         // Combine and sort
//                         const allCityKeys = Array.from(new Set([...alreadySelected, ...available]));
//                         const sorted = allCityKeys
//                           .map((k) => ({ key: k, city: parseCsKey(k).city }))
//                           .sort((a, b) => a.city.localeCompare(b.city));

//                         return sorted.map(({ key, city }) => {
//                           const isSelected = currentConfig.selectedCities.includes(key);
//                           const isAvailable = available.includes(key);
//                           const isBlocked = !isAvailable && !isSelected;

//                           return (
//                             <label
//                               key={key}
//                               className={`flex items-center justify-between p-2 rounded-lg border text-sm ${
//                                 isSelected
//                                   ? "bg-green-50 border-green-200"
//                                   : isBlocked
//                                   ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
//                                   : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
//                               }`}
//                             >
//                               <span className="truncate">{city}</span>
//                               <input
//                                 type="checkbox"
//                                 checked={isSelected}
//                                 disabled={isBlocked}
//                                 onChange={() => toggleCity(key)}
//                                 className="h-4 w-4 text-green-600"
//                               />
//                             </label>
//                           );
//                         });
//                       })()}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* Summary */}
//             <div className="mt-6 p-4 bg-blue-50 rounded-xl">
//               <h4 className="font-semibold text-blue-900">Summary</h4>
//               <p className="text-sm text-blue-800">
//                 {currentConfig.selectedCities.length} cities in {currentConfig.selectedStates.length} state(s)
//               </p>
//             </div>

//             {/* Footer Actions */}
//             <div className="mt-6 flex items-center justify-between">
//               <button
//                 onClick={() => setCurrentStep("select-zones")}
//                 className="px-4 py-2 text-slate-700 hover:text-slate-900"
//               >
//                 ← Back to Selection
//               </button>

//               <div className="flex gap-2">
//                 <button
//                   onClick={selectAllStates}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
//                   title="Select all cities from all states"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Select All States
//                 </button>
                
//                 <button
//                   onClick={clearAllStates}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
//                   title="Clear all selected cities"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Clear All States
//                 </button>
                
//                 <button
//                   onClick={saveCurrentZone}
//                   className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
//                 >
//                   <CheckCircle className="h-5 w-5" /> Save & Next
//                 </button>

//                 {zoneConfigs.every((z) => z.isComplete || z === currentConfig) && (
//                   <button
//                     onClick={finalizeConfiguration}
//                     className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
//                   >
//                     Complete Configuration
//                   </button>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   /* ---------- STEP 3: PRICE MATRIX ---------- */
//   if (currentStep === "price-matrix") {
//     return (
//       <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
//         <div className="w-full px-8 py-8">
//           {/* Header */}
//           <div className="mb-6">
//             <button
//               onClick={() => setCurrentStep("configure-zones")}
//               className="inline-flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-slate-900"
//             >
//               <ArrowLeft className="h-4 w-4" /> Back to Configuration
//             </button>
//           </div>

//           <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 md:p-8">
//             <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Zone Price Matrix</h1>
//             <p className="text-slate-600 mb-6">Enter the price for shipping between zones.</p>

//             {/* Price Matrix Table */}
//             <div className="overflow-auto max-h-[600px] border border-slate-300 rounded-lg">
//               <table className="w-full border-separate border-spacing-0">
//                 <thead className="sticky top-0 z-10">
//                   <tr>
//                     <th className="sticky left-0 z-20 p-2 bg-slate-100 font-bold text-slate-800 text-sm border border-slate-300">
//                       FROM/TO
//                     </th>
//                     {validZones.map((zone) => (
//                       <th
//                         key={zone.zoneCode}
//                         className="p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300 min-w-[80px]"
//                       >
//                         {zone.zoneCode}
//                       </th>
//                     ))}
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {validZones.map((fromZone) => (
//                     <tr key={fromZone.zoneCode}>
//                       <td className="sticky left-0 z-10 p-2 bg-slate-50 font-semibold text-slate-700 text-xs border border-slate-300">
//                         {fromZone.zoneCode}
//                       </td>
//                       {validZones.map((toZone) => (
//                         <td key={toZone.zoneCode} className="p-1 border border-slate-300">
//                           <DecimalInput
//                             value={getPrice(fromZone.zoneCode, toZone.zoneCode)}
//                             onChange={(value) => updatePrice(fromZone.zoneCode, toZone.zoneCode, value)}
//                             placeholder="0.00"
//                             className="w-full px-2 py-1 border border-slate-200 rounded text-center text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
//                             max={999}
//                             maxDecimals={2}
//                           />
//                         </td>
//                       ))}
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>

//             {/* Summary */}
//             <div className="mt-6 p-4 bg-blue-50 rounded-xl">
//               <h4 className="font-semibold text-blue-900">Matrix Summary</h4>
//               <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2 text-sm">
//                 <div>
//                   <span className="text-blue-700">Zones:</span>
//                   <span className="ml-2 font-semibold">{validZones.length}</span>
//                 </div>
//                 <div>
//                   <span className="text-blue-700">Total Routes:</span>
//                   <span className="ml-2 font-semibold">{validZones.length * validZones.length}</span>
//                 </div>
//               </div>
//             </div>

//             {/* Actions */}
//             <div className="mt-6 flex justify-end gap-3">
//               <button
//                 onClick={savePriceMatrixAndReturn}
//                 className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
//               >
//                 <CheckCircle className="h-5 w-5" />
//                 Save & Return to Add Vendor
//               </button>
//             </div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return null;
// };

// export default ZonePriceMatrix;


import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, ChevronRight, MapPin, Sparkles } from "lucide-react";
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
   HELPER FUNCTIONS
   ======================================================= */

const codeToRegion = (code: string): RegionGroup => {
  // CRITICAL: Check NE first before E to avoid conflicts
  if (code.startsWith("NE")) return "Northeast";
  
  // Extract first character after checking NE
  const firstChar = code.charAt(0);
  
  // Use explicit string matching to avoid any edge cases
  if (firstChar === "N") return "North";
  if (firstChar === "S") return "South";
  if (firstChar === "E") return "East";
  if (firstChar === "W") return "West";
  if (firstChar === "C") return "Central";
  
  // Fallback (should never reach here)
  console.error('Unknown zone code:', code);
  return "North";
};

const sortZonesByOrder = (zones: string[]): string[] => {
  return zones.sort((a, b) => {
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

  // Dataset
  const [pincodeData, setPincodeData] = useState<PincodeEntry[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Steps
  const [currentStep, setCurrentStep] = useState<"select-zones" | "configure-zones" | "price-matrix">("select-zones");

  // Step 1: Zone Selection
  const [selectedZoneCodes, setSelectedZoneCodes] = useState<string[]>([]);
  
  // Track how many zones are visible per region (starts at 1 for each region)
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

  // Warning modal state
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [warningZones, setWarningZones] = useState<string[]>([]);
  const [warningCallback, setWarningCallback] = useState<((confirmed: boolean) => void) | null>(null);

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
  const getAllCityKeysForState = (state: string, region: RegionGroup): string[] => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    const cities = stateMap.get(state);
    if (!cities) return [];
    return Array.from(cities).map((c) => csKey(c, state));
  };

  // Get cities already used by other zones
  const getUsedCities = (excludeZoneIndex?: number): Set<string> => {
    const used = new Set<string>();
    zoneConfigs.forEach((z, idx) => {
      if (idx !== excludeZoneIndex) {
        z.selectedCities.forEach((c) => used.add(c));
      }
    });
    return used;
  };

  // Get available city keys for a state (not used by other zones)
  const getAvailableCityKeys = (state: string, region: RegionGroup, currentZoneIndex: number): string[] => {
    const allKeys = getAllCityKeysForState(state, region);
    const used = getUsedCities(currentZoneIndex);
    return allKeys.filter((k) => !used.has(k));
  };

  // Current zone config
  const currentConfig = zoneConfigs[currentZoneIndex];

  /**
   * Get count of available cities for a specific zone (excluding cities taken by other zones)
   */
   const getAvailableCitiesForZone = (zoneCode: string): number => {
  const region = codeToRegion(zoneCode);
  const stateMap = byStateByRegion.get(region);
  if (!stateMap) return 0;
  
  // Get all cities in this region
  let totalCities = 0;
  stateMap.forEach((cities) => {
    totalCities += cities.size;
  });
  
  // ⭐ CRITICAL FIX: Count cities from ALL zones in this region EXCEPT the zone we're checking
  const usedCities = new Set<string>();
  zoneConfigs.forEach((z) => {
    if (z.zoneCode !== zoneCode && codeToRegion(z.zoneCode) === region) {
      // ⭐ Count cities even if zone is not marked complete yet
      // This includes the CURRENT zone being configured
      z.selectedCities.forEach((c) => usedCities.add(c));
    }
  });
  
  return totalCities - usedCities.size;
};

  /**
   * Get list of states that have at least 1 available city for a zone
   */
  const getAvailableStatesForZone = (zoneCode: string): string[] => {
    const region = codeToRegion(zoneCode);
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return [];
    
    const currentZoneIndex = zoneConfigs.findIndex(z => z.zoneCode === zoneCode);
    const availableStates: string[] = [];
    
    stateMap.forEach((cities, state) => {
      const available = getAvailableCityKeys(state, region, currentZoneIndex);
      if (available.length > 0) {
        availableStates.push(state);
      }
    });
    
    return availableStates.sort((a, b) => a.localeCompare(b));
  };

  /**
   * Check which zones in the same region will have 0 cities available
   * Returns array of zone codes that would be empty
   */
  // const getEmptyZonesInRegion = (currentZoneCode: string): string[] => {
  //   const region = codeToRegion(currentZoneCode);
  //   const currentIndex = selectedZoneCodes.indexOf(currentZoneCode);
    
  //   // Get zones after current zone in the selected zones list (same region only)
  //   const remainingZones = selectedZoneCodes.slice(currentIndex + 1).filter(
  //     z => codeToRegion(z) === region
  //   );
    
  //   // Check which ones would have 0 cities
  //   const emptyZones: string[] = [];
    
  //   remainingZones.forEach((zoneCode) => {
  //     const availableCount = getAvailableCitiesForZone(zoneCode);
  //     if (availableCount === 0) {
  //       emptyZones.push(zoneCode);
  //     }
  //   });
    
  //   return emptyZones;
  // };
   
const getEmptyZonesInRegion = (currentZoneCode: string): string[] => {
  const region = codeToRegion(currentZoneCode);
  
  // ⭐ CHANGED: Check ALL zones in same region (except current)
  const otherZonesInRegion = selectedZoneCodes.filter(
    z => z !== currentZoneCode && codeToRegion(z) === region
  );
  
  // Check which ones would have 0 cities
  const emptyZones: string[] = [];
  
  otherZonesInRegion.forEach((zoneCode) => {
    const availableCount = getAvailableCitiesForZone(zoneCode);
    if (availableCount === 0) {
      emptyZones.push(zoneCode);
    }
  });
  
  return emptyZones;
};


  /**
   * Get total cities in a region
   */
  const getTotalCitiesInRegion = (region: RegionGroup): number => {
    const stateMap = byStateByRegion.get(region);
    if (!stateMap) return 0;
    
    let total = 0;
    stateMap.forEach((cities) => {
      total += cities.size;
    });
    return total;
  };

  /**
   * Get count of cities already assigned in a region
   */
  const getAssignedCitiesInRegion = (region: RegionGroup): number => {
    const usedCities = new Set<string>();
    
    zoneConfigs.forEach((z) => {
      if (codeToRegion(z.zoneCode) === region) {
        z.selectedCities.forEach((c) => usedCities.add(c));
      }
    });
    
    return usedCities.size;
  };

  /**
   * Check if a zone should be disabled (0 cities available)
   */
  const isZoneDisabled = (zoneCode: string): boolean => {
    const available = getAvailableCitiesForZone(zoneCode);
    return available === 0;
  };

  /**
   * Show warning modal and return promise that resolves when user clicks OK/Cancel
   */
  const showExhaustionWarning = (emptyZones: string[], currentZone: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const region = codeToRegion(currentZone);
      const totalCities = getTotalCitiesInRegion(region);
      const assignedCities = getAssignedCitiesInRegion(region);
      
      let message = '';
      if (emptyZones.length === 1) {
        message = `You have assigned ${assignedCities}/${totalCities} cities from the ${region} region. Zone ${emptyZones[0]} will have no cities available.`;
      } else {
        const zoneList = emptyZones.join(', ');
        message = `You have assigned ${assignedCities}/${totalCities} cities from the ${region} region. Zones ${zoneList} will have no cities available.`;
      }
      
      setWarningMessage(message);
      setWarningZones(emptyZones);
      setShowWarningModal(true);
      setWarningCallback(() => (userConfirmed: boolean) => {
        setShowWarningModal(false);
        resolve(userConfirmed);
      });
    });
  };

  // Get states for current zone
  const availableStates = useMemo(() => {
    if (!currentConfig) return [];
    return getAvailableStatesForZone(currentConfig.zoneCode);
  }, [currentConfig, zoneConfigs]);

  /* =========================================================
     HELPER FUNCTIONS FOR CONSTRAINTS
     ======================================================= */

  // Check if a zone can be selected based on sequential constraints
  const canSelectZone = (code: string, currentSelection: string[]): boolean => {
    const region = codeToRegion(code);
    const regionZones = regionGroups[region];
    const selectedInRegion = currentSelection.filter(z => regionGroups[region].includes(z));
    
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
  };

  // Check if a zone can be deselected based on sequential constraints
  const canDeselectZone = (code: string, currentSelection: string[]): boolean => {
    const region = codeToRegion(code);
    const regionZones = regionGroups[region];
    const selectedInRegion = currentSelection.filter(z => regionGroups[region].includes(z));
    
    if (selectedInRegion.length === 0) return false;
    
    const selectedIndices = selectedInRegion.map(z => regionZones.indexOf(z)).sort((a, b) => a - b);
    const targetIndex = regionZones.indexOf(code);
    
    const minIndex = Math.min(...selectedIndices);
    const maxIndex = Math.max(...selectedIndices);
    
    return targetIndex === minIndex || targetIndex === maxIndex;
  };

  // Select all zones in a region
  const selectAllInRegion = (region: RegionGroup) => {
    const regionZones = regionGroups[region];
    const currentlySelected = selectedZoneCodes.filter(z => !regionGroups[region].includes(z));
    const newSelection = [...currentlySelected, ...regionZones];
    
    if (newSelection.length > MAX_ZONES) {
      alert(`Cannot select all zones in ${region}. Maximum ${MAX_ZONES} zones allowed.`);
      return;
    }
    
    const sorted = sortZonesByOrder(newSelection);
    setSelectedZoneCodes(sorted);
    
    setZoneConfigs((old) => {
      const existing = old.filter(z => !regionGroups[region].includes(z.zoneCode));
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
      
      const updated = [...existing, ...newZones];
      return updated.sort((a, b) => {
        const indexA = ZONE_ORDER.indexOf(a.zoneCode);
        const indexB = ZONE_ORDER.indexOf(b.zoneCode);
        return indexA - indexB;
      });
    });
  };

  // Deselect all zones in a region
  const deselectAllInRegion = (region: RegionGroup) => {
    const newSelection = selectedZoneCodes.filter(z => !regionGroups[region].includes(z));
    const sorted = sortZonesByOrder(newSelection);
    setSelectedZoneCodes(sorted);
    
    setZoneConfigs((old) => old.filter(z => !regionGroups[region].includes(z.zoneCode)));
  };

  /**
   * Get visible zones for a region based on how many zones should be shown
   * Starts with 1 zone, progressively reveals more as user clicks +
   */
  const getVisibleZones = (region: RegionGroup): string[] => {
    const allZones = regionGroups[region];
    const count = visibleZoneCount[region] || 1;
    
    return allZones.slice(0, count);
  };

  /**
   * Check if a region has more zones that can be revealed
   */
  const hasExpandableZones = (region: RegionGroup): boolean => {
    const allZones = regionGroups[region];
    const currentCount = visibleZoneCount[region] || 1;
    return currentCount < allZones.length;
  };

  /**
   * Expand zones in a region (show one more zone)
   */
  const expandRegionZones = (region: RegionGroup) => {
    const allZones = regionGroups[region];
    setVisibleZoneCount(prev => ({
      ...prev,
      [region]: Math.min((prev[region] || 1) + 1, allZones.length)
    }));
  };

  /**
   * Collapse zones in a region (hide last revealed zone)
   */
  const collapseRegionZones = (region: RegionGroup) => {
    setVisibleZoneCount(prev => ({
      ...prev,
      [region]: Math.max((prev[region] || 1) - 1, 1)
    }));
  };

  /**
   * Select all zones from all regions (respecting MAX_ZONES limit)
   */
  const selectAllZones = () => {
    const allZones = Object.values(regionGroups).flat();
    
    if (allZones.length > MAX_ZONES) {
      alert(`Cannot select all zones. Maximum ${MAX_ZONES} zones allowed. Total available: ${allZones.length}`);
      return;
    }
    
    const sorted = sortZonesByOrder(allZones);
    setSelectedZoneCodes(sorted);
    
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
  };

  /**
   * Deselect all zones from all regions
   */
  const deselectAllZones = () => {
    setSelectedZoneCodes([]);
    setZoneConfigs([]);
  };

  /**
   * Check if + button should be enabled for a region
   * Only enable if all currently visible zones are selected
   */
  const canExpandRegion = (region: RegionGroup): boolean => {
    const visibleZones = getVisibleZones(region);
    const hasMoreZones = hasExpandableZones(region);
    
    if (!hasMoreZones) return false;
    
    const allVisibleSelected = visibleZones.every(zone => selectedZoneCodes.includes(zone));
    
    return allVisibleSelected;
  };

  /* =========================================================
     STEP 1: ZONE SELECTION
     ======================================================= */

  const toggleZoneSelection = (code: string) => {
    setSelectedZoneCodes((prev) => {
      const isSelected = prev.includes(code);

      if (isSelected) {
        if (!canDeselectZone(code, prev)) {
          const region = codeToRegion(code);
          alert(`You can only deselect zones from the ends of the sequence in ${region} region.`);
          return prev;
        }
        
        const next = prev.filter((c) => c !== code);
        const sorted = sortZonesByOrder(next);

        setZoneConfigs((old) => old.filter((z) => z.zoneCode !== code));

        return sorted;
      } else {
        if (!canSelectZone(code, prev)) {
          const region = codeToRegion(code);
          alert(`You must select zones sequentially in ${region} region. No gaps allowed.`);
          return prev;
        }
        
        if (prev.length >= MAX_ZONES) {
          alert(`Maximum ${MAX_ZONES} zones allowed`);
          return prev;
        }

        const next = [...prev, code];
        const sorted = sortZonesByOrder(next);

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

        return sorted;
      }
    });
  };

  const proceedToConfiguration = () => {
    if (selectedZoneCodes.length === 0) {
      alert("Please select at least one zone");
      return;
    }
    setCurrentStep("configure-zones");
    setCurrentZoneIndex(0);
  };

  /* =========================================================
     STEP 2: ZONE CONFIGURATION
     ======================================================= */

  const setActiveState = (state: string | null) => {
    if (!currentConfig) return;
    setActiveStateByZone((prev) => ({ ...prev, [currentConfig.zoneCode]: state }));
  };

  const getActiveState = (): string | null => {
    if (!currentConfig) return null;
    return activeStateByZone[currentConfig.zoneCode] || null;
  };

  const toggleCity = (cityKey: string) => {
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
  };

  const selectAllInState = (state: string) => {
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
  };

  const clearState = (state: string) => {
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
  };

  const selectAllStates = () => {
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
  };

  const clearAllStates = () => {
    if (!currentConfig) return;

    setZoneConfigs((prev) =>
      prev.map((z, idx) => {
        if (idx !== currentZoneIndex) return z;

        return { 
          ...z, 
          selectedCities: [], 
          selectedStates: [] 
        };
      })
    );
  };

  // const saveCurrentZone = async () => {
  //   if (!currentConfig) return;

  //   if (currentConfig.selectedCities.length === 0) {
  //     alert("Please select at least one city before saving");
  //     return;
  //   }

  //   // Check if remaining zones in same region would be empty
  //   const emptyZones = getEmptyZonesInRegion(currentConfig.zoneCode);
    
  //   if (emptyZones.length > 0) {
  //     const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
  //     if (!userConfirmed) {
  //       return;
  //     }
  //   }

  //   setZoneConfigs((prev) =>
  //     prev.map((z, idx) => (idx === currentZoneIndex ? { ...z, isComplete: true } : z))
  //   );

  //   const nextIncomplete = zoneConfigs.findIndex((z, idx) => idx > currentZoneIndex && !z.isComplete);
  //   if (nextIncomplete !== -1) {
  //     setCurrentZoneIndex(nextIncomplete);
  //   }
  // };

  const saveCurrentZone = async () => {
  if (!currentConfig) return;

  // Check if current zone has no cities AND no cities are available
  if (currentConfig.selectedCities.length === 0 && availableStates.length === 0) {
    // Show custom modal for "No cities available" scenario
    const region = currentConfig.region;
    setWarningMessage(
      `No Cities Available\n\nAll cities in the ${region} region have been assigned to previous zones.\n\nPlease go back and deselect cities from other zones to make them available for ${currentConfig.zoneCode}.`
    );
    setWarningZones([currentConfig.zoneCode]);
    setShowWarningModal(true);
    setWarningCallback(() => (userConfirmed: boolean) => {
      setShowWarningModal(false);
      // Don't proceed even if confirmed
    });
    return;
  }

  if (currentConfig.selectedCities.length === 0) {
    alert("Please select at least one city before saving");
    return;
  }

  // Check if remaining zones in same region would be empty
  const emptyZones = getEmptyZonesInRegion(currentConfig.zoneCode);
  
  console.log('saveCurrentZone - emptyZones result:', emptyZones);
console.log('saveCurrentZone - emptyZones.length:', emptyZones.length);

if (emptyZones.length > 0) {
  console.log('Triggering warning for zones:', emptyZones);
  const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
  if (!userConfirmed) {
    return;
  }
}


  if (emptyZones.length > 0) {
    const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
    if (!userConfirmed) {
      return;
    }
  }

  setZoneConfigs((prev) =>
    prev.map((z, idx) => (idx === currentZoneIndex ? { ...z, isComplete: true } : z))
  );

  const nextIncomplete = zoneConfigs.findIndex((z, idx) => idx > currentZoneIndex && !z.isComplete);
  if (nextIncomplete !== -1) {
    setCurrentZoneIndex(nextIncomplete);
  }
};

  // const finalizeConfiguration = async () => {
  //   const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
  //   if (validZones.length === 0) {
  //     alert("Please configure at least one zone");
  //     return;
  //   }

  //   if (currentConfig) {
  //     const emptyZones = getEmptyZonesInRegion(currentConfig.zoneCode);
      
  //     if (emptyZones.length > 0) {
  //       const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
  //       if (!userConfirmed) {
  //         return;
  //       }
  //     }
  //   }

  //   updateZones(validZones);

  //   const matrix: Record<string, Record<string, number>> = {};
  //   validZones.forEach((fromZone) => {
  //     matrix[fromZone.zoneCode] = {};
  //     validZones.forEach((toZone) => {
  //       matrix[fromZone.zoneCode][toZone.zoneCode] = 0;
  //     });
  //   });

  //   updatePriceMatrix(matrix);
  //   setCurrentStep("price-matrix");
  // };

  const finalizeConfiguration = async () => {
  const validZones = zoneConfigs.filter((z) => z.selectedCities.length > 0);
  if (validZones.length === 0) {
    alert("Please configure at least one zone");
    return;
  }

  // Check if current zone has no cities available
  if (currentConfig && availableStates.length === 0 && currentConfig.selectedCities.length === 0) {
    const region = currentConfig.region;
    setWarningMessage(
      `No Cities Available\n\nAll cities in the ${region} region have been assigned to previous zones.\n\nPlease go back and deselect cities from other zones to make them available for ${currentConfig.zoneCode}.`
    );
    setWarningZones([currentConfig.zoneCode]);
    setShowWarningModal(true);
    setWarningCallback(() => (userConfirmed: boolean) => {
      setShowWarningModal(false);
      // Don't proceed even if confirmed
    });
    return;
  }

  if (currentConfig) {
    const emptyZones = getEmptyZonesInRegion(currentConfig.zoneCode);

    // DEBUG: Add these lines temporarily
console.log('Current Zone:', currentConfig.zoneCode);
console.log('Current Region:', currentConfig.region);
console.log('Empty Zones Found:', emptyZones);
console.log('Available States:', availableStates.length);

console.log('🔍 SAVE & NEXT DEBUG:', {
  currentZone: currentConfig.zoneCode,
  emptyZones: emptyZones,
  willShowWarning: emptyZones.length > 0
});

if (emptyZones.length > 0) {
  const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
  if (!userConfirmed) {
    return;
  }
}
    
    if (emptyZones.length > 0) {
      const userConfirmed = await showExhaustionWarning(emptyZones, currentConfig.zoneCode);
      if (!userConfirmed) {
        return;
      }
    }
  }

  updateZones(validZones);

  const matrix: Record<string, Record<string, number>> = {};
  validZones.forEach((fromZone) => {
    matrix[fromZone.zoneCode] = {};
    validZones.forEach((toZone) => {
      matrix[fromZone.zoneCode][toZone.zoneCode] = 0;
    });
  });

  updatePriceMatrix(matrix);
  setCurrentStep("price-matrix");
};

  /* =========================================================
     STEP 3: PRICE MATRIX
     ======================================================= */

  const validZones = useMemo(
    () => zoneConfigs.filter((z) => z.selectedCities.length > 0),
    [zoneConfigs]
  );

  const updatePrice = (fromZone: string, toZone: string, value: number | null) => {
    const updated = { ...wizardData.priceMatrix };
    if (!updated[fromZone]) updated[fromZone] = {};
    updated[fromZone][toZone] = value ?? 0;
    updatePriceMatrix(updated);
  };

  const getPrice = (fromZone: string, toZone: string): number | null => {
    return wizardData.priceMatrix?.[fromZone]?.[toZone] ?? null;
  };

  const savePriceMatrixAndReturn = () => {
    navigate("/addvendor", { replace: true });
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
                <p className="mt-1 text-slate-600">Pick up to {MAX_ZONES} zones from the regions below. Zones must be selected sequentially within each region.</p>
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

                    {(() => {
                      const totalCities = getTotalCitiesInRegion(region);
                      const assignedCities = getAssignedCitiesInRegion(region);
                      const availableCities = totalCities - assignedCities;
                      const selectedInRegionCount = selectedInRegion.length;
                      const disabledZones = selectedInRegion.filter(z => isZoneDisabled(z));
                      
                      if (assignedCities >= totalCities && selectedInRegionCount > 0) {
                        return (
                          <div className="mt-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800 font-semibold">
                              ⚠️ All {totalCities} cities assigned. {disabledZones.length} zone(s) unavailable.
                            </p>
                            <p className="text-xs text-red-700 mt-1">
                              {disabledZones.length > 0 && `Unavailable zones: ${disabledZones.join(', ')}`}
                            </p>
                          </div>
                        );
                      } else if (assignedCities > 0 && availableCities < totalCities) {
                        return (
                          <div className="mt-2 mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <p className="text-sm text-orange-800 font-semibold">
                              ⚠️ {assignedCities}/{totalCities} cities assigned. {availableCities} cities remaining.
                            </p>
                            {disabledZones.length > 0 && (
                              <p className="text-xs text-orange-700 mt-1">
                                {disabledZones.length} zone(s) have no cities available: {disabledZones.join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="flex flex-wrap gap-3">
                      {visibleZones.map((code) => {
                        const selected = selectedZoneCodes.includes(code);
                        const zoneDisabled = isZoneDisabled(code);
                        const canSelect = !selected && canSelectZone(code, selectedZoneCodes);
                        const canDeselect = selected && canDeselectZone(code, selectedZoneCodes);
                        const disabled = !selected && (selectedZoneCodes.length >= MAX_ZONES || !canSelect);
                        const notAllowed = selected && !canDeselect;

                        return (
                          <button
                            key={code}
                            onClick={() => {
                              if (zoneDisabled && selected) {
                                const totalCities = getTotalCitiesInRegion(region);
                                const assignedCities = getAssignedCitiesInRegion(region);
                                alert(
                                  `Zone ${code} has no available cities.\n\n` +
                                  `All ${totalCities} cities in the ${region} region have been assigned to other zones.\n` +
                                  `Current assignment: ${assignedCities}/${totalCities} cities used.\n\n` +
                                  `You can deselect this zone or go back to previous zones to free up cities.`
                                );
                              } else if (!disabled && !notAllowed) {
                                toggleZoneSelection(code);
                              } else if (notAllowed) {
                                alert(`You can only deselect zones from the ends of the sequence. Deselect zones after ${code} first.`);
                              }
                            }}
                            disabled={disabled && !zoneDisabled}
                            className={`px-5 py-3 rounded-xl font-semibold transition-all ${
                              zoneDisabled && selected
                                ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md border-2 border-red-700"
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
                                ? "No cities available - click for details"
                                : notAllowed
                                ? "Can only deselect from the end of the sequence"
                                : disabled && !selected && !canSelect
                                ? "Must select zones sequentially"
                                : ""
                            }
                          >
                            {code}
                            {zoneDisabled && selected && (
                              <span className="ml-1 text-xs">⚠️</span>
                            )}
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
                            title={
                              canExpandRegion(region)
                                ? `Show next zone`
                                : "Select all visible zones first"
                            }
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
                  {selectedZoneCodes.map((code) => (
                    <span key={code} className="px-3 py-1.5 bg-blue-600 text-white rounded-full text-sm">
                      {code}
                    </span>
                  ))}
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
      </div>
    );
  }

  /* ---------- STEP 2: CONFIGURE ZONES ---------- */
  if (currentStep === "configure-zones" && currentConfig) {
    const activeState = getActiveState();

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-8 py-8">
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-900">Configure Zones</h1>
            <p className="text-slate-600">Assign cities to each zone. Cities can only belong to one zone.</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {zoneConfigs.map((z, idx) => (
              <button
                key={z.zoneCode}
                onClick={() => setCurrentZoneIndex(idx)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  idx === currentZoneIndex
                    ? "bg-blue-600 text-white shadow-lg"
                    : z.isComplete
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {z.zoneName} {z.isComplete && "✓"}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Zone {currentConfig.zoneName} <span className="text-slate-500">({currentConfig.region})</span>
              </h2>
            
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 mb-3">States</h3>
                
                {availableStates.length === 0 ? (
                  <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl text-center">
                    <div className="text-red-600 text-4xl mb-3">🚫</div>
                    <p className="text-lg font-semibold text-red-900 mb-2">
                      No Cities Available
                    </p>
                    <p className="text-sm text-red-700">
                      All cities in the {currentConfig.region} region have been assigned to previous zones.
                    </p>
                    <p className="text-xs text-red-600 mt-3">
                      Please go back and deselect cities from other zones to make them available for {currentConfig.zoneCode}.
                    </p>
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

            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <h4 className="font-semibold text-blue-900">Summary</h4>
              <p className="text-sm text-blue-800">
                {currentConfig.selectedCities.length} cities in {currentConfig.selectedStates.length} state(s)
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep("select-zones")}
                className="px-4 py-2 text-slate-700 hover:text-slate-900"
              >
                ← Back to Selection
              </button>

              {/* <div className="flex gap-2">
                <button
                  onClick={selectAllStates}
                  disabled={false}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-green-700"
                  title="Select all cities from all states"
                >
                  <CheckCircle className="h-5 w-5" /> Select All States
                </button>
                
                <button
                  onClick={clearAllStates}
                  disabled={false}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-red-700"
                  title="Clear all selected cities"
                >
                  <CheckCircle className="h-5 w-5" /> Clear All States
                </button>
                
                <button
                  onClick={saveCurrentZone}
                  disabled={false}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
                  title={availableStates.length === 0 ? "No cities available in this region" : "Select all cities from all states"}
                >
                  <CheckCircle className="h-5 w-5" /> Save & Next
                </button>

                {(() => {
                  const allConfiguredOrEmpty = zoneConfigs.every(z => 
                    z.isComplete || 
                    z === currentConfig || 
                    getAvailableCitiesForZone(z.zoneCode) === 0
                  );
                  
                  return allConfiguredOrEmpty && (
                    <button
                      onClick={finalizeConfiguration}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Complete Configuration
                    </button>
                  );
                })()}
              </div> */}
              <div className="flex gap-2">
  <button
    onClick={selectAllStates}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700"
    title="Select all cities from all states"
  >
    <CheckCircle className="h-5 w-5" /> Select All States
  </button>
  
  <button
    onClick={clearAllStates}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700"
    title="Clear all selected cities"
  >
    <CheckCircle className="h-5 w-5" /> Clear All States
  </button>
  
  <button
    onClick={saveCurrentZone}
    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-blue-600 text-white hover:bg-blue-700"
    title="Save current zone and proceed"
  >
    <CheckCircle className="h-5 w-5" /> Save & Next
  </button>

  {(() => {
    const allConfiguredOrEmpty = zoneConfigs.every(z => 
      z.isComplete || 
      z === currentConfig || 
      getAvailableCitiesForZone(z.zoneCode) === 0
    );
    
    return allConfiguredOrEmpty && (
      <button
        onClick={finalizeConfiguration}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Complete Configuration
      </button>
    );
  })()}
</div>

 {/* Warning Modal */}
        {showWarningModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    Zones Without Cities
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {warningMessage}
                  </p>
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-800 font-semibold">
                      Do you want to continue?
                    </p>
                    <p className="text-xs text-orange-700 mt-1">
                      You can go back and adjust your selections to make cities available for these zones.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    if (warningCallback) warningCallback(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (warningCallback) warningCallback(true);
                  }}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        )}
            </div>
          </div>
        </div>
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
                      FROM/TO
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

       
      </div>
    );
  }


  return null;
};

export default ZonePriceMatrix;