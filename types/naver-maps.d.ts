declare global {
  interface Window {
    naver?: {
      maps: Record<string, unknown> & {
        Map: unknown;
        LatLng: unknown;
        LatLngBounds: unknown;
        Marker: unknown;
        Animation?: unknown;
        Event: { addListener: (...args: unknown[]) => unknown };
        ZoomControlStyle?: Record<string, number>;
        Position?: Record<string, number>;
      };
    };
  }
}

export {};
