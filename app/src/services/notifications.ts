import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseISO, subDays, addDays, isAfter, startOfDay } from 'date-fns';
import type { BillWithContract, Settings } from '../types';
import { formatCurrency } from '../utils/date';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bills', {
      name: 'Bill Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
};

export const cancelBillNotifications = async (billId: string): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.content.data?.billId === billId) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
};

export const scheduleBillNotifications = async (
  bill: BillWithContract,
  settings: Settings
): Promise<void> => {
  if (!settings.reminders_enabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Cancel existing notifications for this bill
  await cancelBillNotifications(bill.id);

  // Don't schedule for paid bills
  if (bill.status === 'paid') return;

  const dueDate = parseISO(bill.due_date);
  const today = startOfDay(new Date());
  const amountStr = formatCurrency(bill.amount, bill.currency);

  // Pre-due reminder
  if (settings.remind_before_days > 0) {
    const reminderDate = subDays(dueDate, settings.remind_before_days);
    if (isAfter(reminderDate, today)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bill Reminder',
          body: `${bill.provider_name} bill of ${amountStr} is due on ${bill.due_date}.`,
          data: { billId: bill.id, type: 'pre-due' },

        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderDate,
        },
      });
    }
  }

  // Due date reminder
  if (settings.remind_on_due_date) {
    if (isAfter(dueDate, today)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Bill Due Today',
          body: `${bill.provider_name} bill of ${amountStr} is due today.`,
          data: { billId: bill.id, type: 'due' },

        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueDate,
        },
      });
    }
  }

  // Overdue reminder
  if (settings.remind_when_overdue) {
    const overdueDate = addDays(dueDate, settings.overdue_reminder_interval_days);
    if (isAfter(overdueDate, today)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'OVERDUE Bill',
          body: `${bill.provider_name} bill of ${amountStr} was due on ${bill.due_date}.`,
          data: { billId: bill.id, type: 'overdue' },

        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: overdueDate,
        },
      });
    }
  }
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
