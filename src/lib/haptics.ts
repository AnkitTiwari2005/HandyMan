import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function triggerHapticImpact(style: ImpactStyle = ImpactStyle.Heavy) {
  try {
    await Haptics.impact({ style });
  } catch {
    // Fallback to web vibration API
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }
}

export async function triggerHapticNotification(type: NotificationType = NotificationType.Success) {
  try {
    await Haptics.notification({ type });
  } catch {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  }
}
