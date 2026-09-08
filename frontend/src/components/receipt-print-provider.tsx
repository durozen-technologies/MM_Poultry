import React, { useEffect, useLayoutEffect } from "react";
import { useReceiptImagePrintJob } from "../hooks/use-receipt-image-print-job";
import { registerReceiptImagePrintJob } from "../services/receipt-print-registry";

/** Mount once at app root so delivery bills use the same image thermal pipeline as test print. */
export function ReceiptPrintProvider({ children }: { children: React.ReactNode }) {
  const { receiptImagePrintBridge, startReceiptImagePrintJob } = useReceiptImagePrintJob();

  // Register before paint so print is available as soon as the app mounts.
  useLayoutEffect(() => {
    registerReceiptImagePrintJob(startReceiptImagePrintJob);
  }, [startReceiptImagePrintJob]);

  useEffect(() => {
    return () => registerReceiptImagePrintJob(null);
  }, []);

  return (
    <>
      {children}
      {receiptImagePrintBridge}
    </>
  );
}
