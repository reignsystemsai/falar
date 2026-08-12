export function normalizeSpeakNumber(
  value: string
): string | null {
  const input = value.trim();

  if (!input.startsWith('+')) {
    return null;
  }

  const digits = input.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  return `+${digits}`;
}

export function cleanContactLabel(
  value?: string | null
): string {
  if (!value) return 'Mobile';

  const match =
    value.match(/^_\$!<(.+)>!\$_$/);

  return match?.[1] || value;
}
