export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.checkPermission();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private async checkPermission(): Promise<void> {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('此浏览器不支持通知功能');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('通知权限被拒绝');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    } catch (error) {
      console.error('请求通知权限失败:', error);
      return false;
    }
  }

  public async showNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) {
        return;
      }
    }

    const defaultOptions: NotificationOptions = {
      icon: '/icon-placeholder.svg',
      badge: '/icon-placeholder.svg',
      requireInteraction: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      
      // 自动关闭通知
      setTimeout(() => {
        notification.close();
      }, 5000);

      // 点击通知时关闭
      notification.onclick = () => {
        notification.close();
        window.focus();
      };
    } catch (error) {
      console.error('显示通知失败:', error);
    }
  }

  public async showBusReminder(
    route: string, 
    destination: string, 
    etaMinutes: number
  ): Promise<void> {
    const title = `🚌 公交提醒`;
    const body = `${route}路公交将在${etaMinutes}分钟后到达${destination}`;
    
    await this.showNotification(title, {
      body,
      tag: `bus-${route}-${destination}`
    });
  }

  public async showDepartureUpdate(
    route: string,
    destination: string,
    newEtaMinutes: number,
    _oldEtaMinutes: number
  ): Promise<void> {
    const title = `🔄 时间更新`;
    const body = `${route}路公交到达${destination}的时间已更新为${newEtaMinutes}分钟`;
    
    await this.showNotification(title, {
      body,
      tag: `update-${route}-${destination}`,
      requireInteraction: true
    });
  }

  public async showServiceAlert(
    route: string,
    message: string
  ): Promise<void> {
    const title = `⚠️ 服务提醒`;
    const body = `${route}路公交: ${message}`;
    
    await this.showNotification(title, {
      body,
      tag: `alert-${route}`,
      requireInteraction: true
    });
  }

  public isSupported(): boolean {
    return 'Notification' in window;
  }

  public getPermissionStatus(): NotificationPermission {
    return this.permission;
  }
}

// 导出单例实例
export const notificationService = NotificationService.getInstance();
