import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export class PushNotificationService {
  static async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    // Request permission to use push notifications
    const permStatus = await PushNotifications.requestPermissions();
    
    if (permStatus.receive === 'granted') {
      // Register with Apple / Google to receive push via APNS/FCM
      await PushNotifications.register();
    } else {
      console.log('Push notification permission denied');
    }

    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Send this token to your server to send push notifications
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.log('Error on registration: ' + JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ' + JSON.stringify(notification));
      
      // Update badge count if provided
      if (notification.data?.badgeCount) {
        this.updateBadgeCount(parseInt(notification.data.badgeCount));
      }
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ' + JSON.stringify(notification));
      
      // Handle navigation based on notification data
      if (notification.notification.data?.route) {
        // Navigate to specific route
        window.location.hash = notification.notification.data.route;
      }
    });
  }

  static async updateBadgeCount(count: number) {
    if (!Capacitor.isNativePlatform()) {
      // For web, we can update the title or favicon
      document.title = count > 0 ? `(${count}) GST Backbone` : 'GST Backbone';
      return;
    }

    try {
      // For native platforms, this would update the app badge
      // Note: Badge count updates typically require additional native plugins
      console.log(`Updating badge count to: ${count}`);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  static async scheduleLocalNotification(title: string, body: string, badgeCount?: number) {
    if (!Capacitor.isNativePlatform()) {
      // For web, show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, badge: '/favicon.ico' });
      }
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title,
          body,
          id: Date.now(),
          schedule: { at: new Date(Date.now() + 1000) }, // 1 second from now
          sound: 'default',
          attachments: undefined,
          actionTypeId: '',
          extra: { badgeCount }
        }
      ]
    });
  }

  static async requestWebNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }
}

// Auto-initialize when imported
if (typeof window !== 'undefined') {
  PushNotificationService.initialize();
}