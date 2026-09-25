export function formatPeriodMonthLabel(month: number | null | undefined): string {
  if (month == null) {
    return '';
  }

  const monthName = new Date(2020, month - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
  });
  return monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

export function formatFeeDisplayName(feeName: string | null | undefined, month: number | null | undefined): string {
  const baseName = feeName?.trim() || 'Frais';

  if (month == null) {
    return baseName;
  }

  const monthLabel = formatPeriodMonthLabel(month);
  return monthLabel ? `${baseName} ${monthLabel}` : baseName;
}
