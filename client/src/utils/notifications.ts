import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export type ReminderPattern = 'daily' | 'weekly';

export interface Reminder {
  id: string; // UUID
  time: string; // "HH:mm" 24h format
  pattern: ReminderPattern;
  daysOfWeek: number[]; // 1=Sun, 2=Mon, 3=Tue, ..., 7=Sat
  enabled: boolean;
}

export const isPushSupported = () => Capacitor.isNativePlatform();

export const syncReminders = async (reminders: Reminder[]) => {
  if (!isPushSupported()) return;

  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return;

  // Wipe slate
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel(pending);
  }

  let counter = 1;
  const notificationsToSchedule: any[] = [];

  for (const r of reminders) {
    if (!r.enabled) continue;
    const [h, m] = r.time.split(':').map(Number);

    const soundAsset = Capacitor.getPlatform() === 'android' ? 'oneup.wav' : '1up.wav';

    if (r.pattern === 'daily') {
      notificationsToSchedule.push({
        id: counter++,
        title: '1UP Sprint! 🚀',
        body: 'Time for your daily math sprint! Keep your streak alive.',
        schedule: { on: { hour: h, minute: m }, repeats: true },
        extra: { intent: 'open_app' },
        sound: soundAsset,
      });
    } else {
      for (const day of r.daysOfWeek) {
        notificationsToSchedule.push({
          id: counter++,
          title: '1UP Sprint! 🚀',
          body: 'Time for your scheduled math sprint!',
          // Capacitor weekday is 1-indexed (1 = Sunday)
          schedule: { on: { weekday: day, hour: h, minute: m }, repeats: true },
          extra: { intent: 'open_app' },
          sound: soundAsset,
        });
      }
    }
  }

  if (notificationsToSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: notificationsToSchedule });
  }
};
