

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
      console.warn('This browser does not support notifications');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result === 'granted';
    } catch (error) {
      console.error('Failed to request notification permission:', error);
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
      
      // Auto-close notification
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Close notification when clicked
      notification.onclick = () => {
        notification.close();
        window.focus();
      };
    } catch (error) {
      console.error('Failed to display notification:', error);
    }
  }

  public async showBusReminder(
    route: string, 
    destination: string, 
    etaMinutes: number
  ): Promise<void> {
    const title = `🚌 Bus Reminder`;
    const body = `Bus ${route} will arrive at ${destination} in ${etaMinutes} minutes`;
    
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
    const title = `🔄 Time Update`;
    const body = `Bus ${route} arrival time at ${destination} has been updated to ${newEtaMinutes} minutes`;
    
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
    const title = `⚠️ Service Alert`;
    const body = `Bus ${route}: ${message}`;
    
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

// Export singleton instance
export const notificationService = NotificationService.getInstance();
