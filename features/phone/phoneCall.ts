import * as Linking from 'expo-linking';

export function normalizeDialNumber(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  const keepPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (keepPlus) {
    return `+${digits}`;
  }

  if (digits.startsWith('00') && digits.length > 2) {
    return `+${digits.slice(2)}`;
  }

  return digits;
}

export async function placePhoneCall(rawValue: string): Promise<void> {
  const normalized = normalizeDialNumber(rawValue);

  if (!normalized) {
    throw new Error('Enter a valid phone number.');
  }

  const telUrl = `tel:${normalized}`;
  const canOpen = await Linking.canOpenURL(telUrl);

  if (!canOpen) {
    throw new Error('Phone calling is unavailable on this device.');
  }

  await Linking.openURL(telUrl);
}
