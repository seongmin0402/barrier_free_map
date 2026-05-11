export type AccessibilityLevel = "A" | "B" | "C";

export interface FloorPhotoGroupClient {
  floor: string;
  images: { url: string; originalName?: string }[];
}

/** public/data/buildings.json과 동일한 형태 */
export interface BarrierBuilding {
  id: string;
  name: string;
  lat: number;
  lng: number;
  floorLabel: string;
  wheelchairAccess: boolean;
  elevatorAvailable: boolean;
  brailleAvailable: boolean;
  toiletAvailable: boolean;
  autoDoorAvailable: boolean;
  thresholdPresent: boolean;
  rampAvailable: boolean;
  parkingCapacity: number;
  parkingDistanceEntranceM: number;
  description: string;
  floorPhotoSummary: string;
  floorPhotoImageNames: string;
  floorPhotoGroups: FloorPhotoGroupClient[];
  facilities: string[];
  accessibilityLevel: AccessibilityLevel;
}
