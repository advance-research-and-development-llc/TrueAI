/**
 * Notifications Service
 *
 * Handles push notifications for important events in the TrueAI platform.
 * Uses expo-notifications for local and push notifications.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type NotificationType =
  | 'task_complete'
  | 'workflow_complete'
  | 'benchmark_complete'
  | 'agent_failed'
  | 'system_alert';

export interface NotificationData {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class NotificationsService {
  private permissionsGranted = false;

  /**
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false; // Not supported on web
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    this.permissionsGranted = finalStatus === 'granted';
    return this.permissionsGranted;
  }

  /**
   * Check if notifications are enabled
   */
  async areNotificationsEnabled(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }

    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Schedule a local notification
   */
  async scheduleNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    if (Platform.OS === 'web') {
      console.log('Notifications not supported on web');
      return '';
    }

    const isEnabled = await this.areNotificationsEnabled();
    if (!isEnabled) {
      console.log('Notifications not enabled');
      return '';
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      },
      trigger: trigger || null, // null = show immediately
    });

    return notificationId;
  }

  /**
   * Send notification for task completion
   */
  async notifyTaskComplete(
    taskName: string,
    status: 'success' | 'failed',
    details?: string
  ): Promise<void> {
    const title = status === 'success'
      ? '✅ Task Completed'
      : '❌ Task Failed';

    const body = status === 'success'
      ? `${taskName} has completed successfully`
      : `${taskName} has failed${details ? `: ${details}` : ''}`;

    await this.scheduleNotification({
      type: 'task_complete',
      title,
      body,
      data: { taskName, status, details },
    });
  }

  /**
   * Send notification for workflow completion
   */
  async notifyWorkflowComplete(
    workflowName: string,
    status: 'success' | 'failed',
    duration?: number
  ): Promise<void> {
    const title = status === 'success'
      ? '✅ Workflow Completed'
      : '❌ Workflow Failed';

    const durationText = duration
      ? ` in ${(duration / 1000).toFixed(1)}s`
      : '';

    const body = status === 'success'
      ? `${workflowName} completed${durationText}`
      : `${workflowName} failed${durationText}`;

    await this.scheduleNotification({
      type: 'workflow_complete',
      title,
      body,
      data: { workflowName, status, duration },
    });
  }

  /**
   * Send notification for benchmark completion
   */
  async notifyBenchmarkComplete(
    taskName: string,
    modelsCount: number,
    winner?: string
  ): Promise<void> {
    const body = winner
      ? `Benchmark "${taskName}" complete. Winner: ${winner}`
      : `Benchmark "${taskName}" complete for ${modelsCount} models`;

    await this.scheduleNotification({
      type: 'benchmark_complete',
      title: '🎯 Benchmark Complete',
      body,
      data: { taskName, modelsCount, winner },
    });
  }

  /**
   * Send notification for agent failure
   */
  async notifyAgentFailed(
    agentName: string,
    errorMessage?: string
  ): Promise<void> {
    const body = errorMessage
      ? `${agentName} encountered an error: ${errorMessage}`
      : `${agentName} execution failed`;

    await this.scheduleNotification({
      type: 'agent_failed',
      title: '⚠️ Agent Failed',
      body,
      data: { agentName, errorMessage },
    });
  }

  /**
   * Send system alert notification
   */
  async notifySystemAlert(
    message: string,
    severity: 'info' | 'warning' | 'error' = 'info'
  ): Promise<void> {
    const icon = severity === 'error' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';

    await this.scheduleNotification({
      type: 'system_alert',
      title: `${icon} System Alert`,
      body: message,
      data: { severity },
    });
  }

  /**
   * Queue notification in database for later delivery
   */
  async queueNotification(
    userId: string,
    notification: NotificationData
  ): Promise<void> {
    await supabase
      .from('notification_queue')
      .insert({
        user_id: userId,
        notification_type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      });
  }

  /**
   * Get pending notifications from database
   */
  async getPendingNotifications(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('sent', false)
      .order('created_at', { ascending: true });

    return data || [];
  }

  /**
   * Mark notification as sent
   */
  async markAsSent(notificationId: string): Promise<void> {
    await supabase
      .from('notification_queue')
      .update({
        sent: true,
        sent_at: new Date().toISOString(),
      })
      .eq('id', notificationId);
  }

  /**
   * Process pending notifications
   */
  async processPendingNotifications(userId: string): Promise<void> {
    const pending = await this.getPendingNotifications(userId);

    for (const notification of pending) {
      await this.scheduleNotification({
        type: notification.notification_type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });

      await this.markAsSent(notification.id);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications(): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(userId: string, limit = 50): Promise<any[]> {
    const { data } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Clear old notifications from database
   */
  async clearOldNotifications(userId: string, daysOld = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await supabase
      .from('notification_queue')
      .delete()
      .eq('user_id', userId)
      .eq('sent', true)
      .lt('created_at', cutoffDate.toISOString());
  }

  /**
   * Add notification listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }
}

// Singleton instance
let notificationsServiceInstance: NotificationsService | null = null;

export function getNotificationsService(): NotificationsService {
  if (!notificationsServiceInstance) {
    notificationsServiceInstance = new NotificationsService();
  }
  return notificationsServiceInstance;
}
