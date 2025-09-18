// Enhanced notification service for bus arrivals
export class NotificationService {
  private permission: NotificationPermission = 'default';
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = 'Notification' in window;
    this.permission = Notification.permission;
  }

  // Check if notifications are supported
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  // Request notification permission
  async requestPermission(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn('Notifications are not supported in this browser');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Show bus arrival notification
  async showBusArrival(route: string, stopName: string, etaMinutes: number): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(`🚌 Bus ${route} Arriving`, {
      body: `Bus ${route} will arrive at ${stopName} in ${etaMinutes} minutes`,
      icon: '/icon-placeholder.svg',
      badge: '/icon-placeholder.svg',
      tag: `bus-${route}-${stopName}`,
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  }

  // Show bus reminder notification
  async showBusReminder(route: string, stopName: string, reminderMinutes: number): Promise<void> {
    if (this.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(`⏰ Bus Reminder`, {
      body: `Bus ${route} will arrive at ${stopName} in ${reminderMinutes} minutes`,
      icon: '/icon-placeholder.svg',
      badge: '/icon-placeholder.svg',
      tag: `reminder-${route}-${stopName}`,
      requireInteraction: true
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    // Auto-close after 15 seconds
    setTimeout(() => {
      notification.close();
    }, 15000);
  }
}

// Create global instance
export const notificationService = new NotificationService();