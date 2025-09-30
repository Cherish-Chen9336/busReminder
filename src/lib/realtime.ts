// Real-time bus position tracking service
export interface BusPosition {
  busId: string;
  routeId: string;
  currentStop: string;
  nextStop: string;
  progress: number; // 0-100, represents progress percentage on route
  lat: number;
  lon: number;
  lastUpdate: Date;
  direction: 'inbound' | 'outbound';
  status: 'moving' | 'stopped' | 'delayed';
  eta: number; // Estimated time to next stop (minutes)
}

export interface RouteInfo {
  routeId: string;
  name: string;
  startStop: string;
  endStop: string;
  stops: Array<{
    id: string;
    name: string;
    lat: number;
    lon: number;
    order: number;
  }>;
}

// Real-time data tracker - only shows real data
class RealtimeBusTracker {
  private buses: Map<string, BusPosition> = new Map();
  private updateInterval: number | null = null;
  private callbacks: Set<(buses: BusPosition[]) => void> = new Set();

  constructor() {
    // Don't initialize mock data, only wait for real data
  }

  // Calculate distance between two points (kilometers)
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius (kilometers)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Add real bus data
  addBus(bus: BusPosition) {
    this.buses.set(bus.busId, bus);
    this.notifySubscribers();
  }

  // Remove bus data
  removeBus(busId: string) {
    this.buses.delete(busId);
    this.notifySubscribers();
  }

  // Update bus data
  updateBus(busId: string, updates: Partial<BusPosition>) {
    const existingBus = this.buses.get(busId);
    if (existingBus) {
      this.buses.set(busId, { ...existingBus, ...updates, lastUpdate: new Date() });
      this.notifySubscribers();
    }
  }

  // Start real-time updates - only process real data
  startUpdates() {
    if (this.updateInterval) return;
    
    // Real data update logic - get data from Supabase
    this.updateInterval = window.setInterval(() => {
      // Here should get real-time bus data from Supabase
      // Currently only notify subscribers, no mock data generation
      this.notifySubscribers();
    }, 30000); // Check real data every 30 seconds
  }

  // Stop real-time updates
  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Subscribe to updates
  subscribe(callback: (buses: BusPosition[]) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // Notify subscribers
  private notifySubscribers() {
    const buses = Array.from(this.buses.values());
    this.callbacks.forEach(callback => callback(buses));
  }

  // Get current all bus positions
  getCurrentBuses(): BusPosition[] {
    return Array.from(this.buses.values());
  }

  // Get buses for specific route
  getBusesByRoute(routeId: string): BusPosition[] {
    return Array.from(this.buses.values()).filter(bus => bus.routeId === routeId);
  }
}

// Create global instance
export const realtimeTracker = new RealtimeBusTracker();
