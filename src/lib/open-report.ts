export function openReport(report: Blob) {
  const url = URL.createObjectURL(report);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
