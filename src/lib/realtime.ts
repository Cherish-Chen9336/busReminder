// 实时公交位置跟踪服务
export interface BusPosition {
  busId: string;
  routeId: string;
  currentStop: string;
  nextStop: string;
  progress: number; // 0-100，表示在路线上的进度百分比
  lat: number;
  lon: number;
  lastUpdate: Date;
  direction: 'inbound' | 'outbound';
  status: 'moving' | 'stopped' | 'delayed';
  eta: number; // 到达下一站的预计时间（分钟）
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

// 实时数据跟踪器 - 只显示真实数据
class RealtimeBusTracker {
  private buses: Map<string, BusPosition> = new Map();
  private updateInterval: number | null = null;
  private callbacks: Set<(buses: BusPosition[]) => void> = new Set();

  constructor() {
    // 不初始化模拟数据，只等待真实数据
  }

  // 计算两点之间的距离（公里）
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // 添加真实公交车数据
  addBus(bus: BusPosition) {
    this.buses.set(bus.busId, bus);
    this.notifySubscribers();
  }

  // 移除公交车数据
  removeBus(busId: string) {
    this.buses.delete(busId);
    this.notifySubscribers();
  }

  // 更新公交车数据
  updateBus(busId: string, updates: Partial<BusPosition>) {
    const existingBus = this.buses.get(busId);
    if (existingBus) {
      this.buses.set(busId, { ...existingBus, ...updates, lastUpdate: new Date() });
      this.notifySubscribers();
    }
  }

  // 开始实时更新 - 只处理真实数据
  startUpdates() {
    if (this.updateInterval) return;
    
    // 真实数据更新逻辑 - 从Supabase获取数据
    this.updateInterval = window.setInterval(() => {
      // 这里应该从Supabase获取实时公交车数据
      // 目前只通知订阅者，不生成模拟数据
      this.notifySubscribers();
    }, 30000); // 每30秒检查一次真实数据
  }

  // 停止实时更新
  stopUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // 订阅更新
  subscribe(callback: (buses: BusPosition[]) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  // 通知订阅者
  private notifySubscribers() {
    const buses = Array.from(this.buses.values());
    this.callbacks.forEach(callback => callback(buses));
  }

  // 获取当前所有公交车位置
  getCurrentBuses(): BusPosition[] {
    return Array.from(this.buses.values());
  }

  // 获取特定路线的公交车
  getBusesByRoute(routeId: string): BusPosition[] {
    return Array.from(this.buses.values()).filter(bus => bus.routeId === routeId);
  }
}

// 创建全局实例
export const realtimeTracker = new RealtimeBusTracker();
