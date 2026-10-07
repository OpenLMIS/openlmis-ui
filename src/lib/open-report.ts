import { downloadFile } from '@/lib/download-file';

export type ReportDelivery = {
  deliver: (report: Blob) => void;
  close: () => void;
};

export function openReport(filename: string, loadingLabel?: string): ReportDelivery {
  const tab = window.open('', '_blank');
  if (tab?.document && loadingLabel) {
    tab.document.title = loadingLabel;
    tab.document.body.textContent = loadingLabel;
  }
  return {
    deliver: (report) => {
      if (!tab || tab.closed) {
        downloadFile(report, filename);
        return;
      }
      const url = URL.createObjectURL(report);
      try {
        tab.location.href = url;
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    },
    close: () => tab?.close(),
  };
}
