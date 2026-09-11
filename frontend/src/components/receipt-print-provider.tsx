import React, { useEffect, useLayoutEffect } from "react";
import { useReceiptImagePrintJob } from "../hooks/use-receipt-image-print-job";
import { usePrinterStore } from "../store/printer-store";

/** Mount once at app root so delivery bills use the same image thermal pipeline as test print. */
export function ReceiptPrintProvider({ children }: { children: React.ReactNode }) {
  const { receiptImagePrintBridge, startReceiptImagePrintJob } = useReceiptImagePrintJob();

  const setStartReceiptJob = usePrinterStore((s) => s.setStartReceiptJob);

  // Register before paint so print is available as soon as the app mounts.
  useLayoutEffect(() => {
    setStartReceiptJob(startReceiptImagePrintJob);
  }, [startReceiptImagePrintJob, setStartReceiptJob]);

  useEffect(() => {
    return () => setStartReceiptJob(null);
  }, [setStartReceiptJob]);

  return (
    <>
      {children}
      {receiptImagePrintBridge}
    </>
  );
}
