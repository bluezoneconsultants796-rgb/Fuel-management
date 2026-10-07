import { Alert, Platform } from 'react-native';

/** Alert.alert is a silent no-op on react-native-web, so fall back to window.alert there. */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
