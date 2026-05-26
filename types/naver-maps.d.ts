declare global {
  interface Window {
    naver?: {
      maps: Record<string, unknown> & {
        Map: unknown;
        LatLng: unknown;
        LatLngBounds: unknown;
        Marker: unknown;
        Polygon: unknown;
        InfoWindow: unknown;
        Point: unknown;
        Animation?: unknown;
        Event: { addListener: (...args: unknown[]) => unknown };
        ZoomControlStyle?: Record<string, number>;
        Position?: Record<string, number>;
        MapTypeId?: Record<string, unknown>;
      };
    };
  }
}

export {};
