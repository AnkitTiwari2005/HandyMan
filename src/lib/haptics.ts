import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export async function triggerHapticImpact(style: ImpactStyle = ImpactStyle.Medium) {
  try {
    await Haptics.impact({ style });
  } catch {
    // Fallback to web vibration API
    if ('vibrate' in navigator) {
      navigator.vibrate(30);
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

/** Very light feedback for navigation taps (heavy impact on every tap was draining and annoying). */
export function triggerHapticTap() {
  return triggerHapticImpact(ImpactStyle.Light);
}
