import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import {
  buildReceiptHtmlMarkup,
  buildReceiptExportPayload,
} from "../utils/printer-html";
import {
  printReceiptImageBase64WithPrinter,
} from "../utils/printer";
import { DeliveryReceiptData } from "../utils/printer";
import { PrinterDevice } from "../types/printer";

type ReceiptPrintJob = {
  id: string;
  data: DeliveryReceiptData[];
  device: PrinterDevice;
};

type ReceiptBridgeProps = {
  job: ReceiptPrintJob | null;
  onComplete: () => void;
  onError: (error: Error) => void;
};

type ReceiptBridgeMessage =
  | {
    type: "receipt-export";
    payload: string[];
  }
  | {
    type: "receipt-export-error";
    payload: string;
  };

function parseBridgeMessage(rawData: string): ReceiptBridgeMessage | null {
  try {
    const parsed = JSON.parse(rawData) as Partial<ReceiptBridgeMessage>;
    if (
      (parsed.type === "receipt-export" ||
        parsed.type === "receipt-export-error") &&
      ((parsed.type === "receipt-export" &&
        Array.isArray(parsed.payload) &&
        parsed.payload.every((item) => typeof item === "string")) ||
        (parsed.type === "receipt-export-error" &&
          typeof parsed.payload === "string"))
    ) {
      return parsed as ReceiptBridgeMessage;
    }
  } catch {
    // Ignore non-JSON messages from the WebView.
  }

  return null;
}

function ReceiptImagePrintBridge({
  job,
  onComplete,
  onError,
}: ReceiptBridgeProps) {
  const webViewRef = useRef<WebView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const requestedExportKeyRef = useRef<string | null>(null);
  const printInFlightRef = useRef(false);

  useEffect(() => {
    requestedExportKeyRef.current = null;
    printInFlightRef.current = false;
    setCurrentIndex(0);
    setCurrentAttempt(0);
  }, [job?.id]);

  const pageCount = job?.data?.length ?? 0;
  const currentData = job?.data?.[currentIndex] ?? null;
  const currentExportKey =
    job && currentData
      ? `${job.id}:${currentIndex}:${currentAttempt}`
      : null;

  const retryReceiptExport = useCallback(
    (cause: Error) => {
      if (currentAttempt >= 1) {
        onError(
          new Error(
            `${cause.message} Receipt printing was stopped to avoid garbled text output. Please try again.`,
          ),
        );
        return;
      }

      printInFlightRef.current = false;
      requestedExportKeyRef.current = null;
      setCurrentAttempt((value) => value + 1);
    },
    [currentAttempt, onError],
  );

  const advanceToNextBill = useCallback(
    () => {
      printInFlightRef.current = false;
      requestedExportKeyRef.current = null;
      setCurrentAttempt(0);
      setCurrentIndex((value) => value + 1);
    },
    [],
  );

  const handleLoadEnd = useCallback(() => {
    if (!currentExportKey || requestedExportKeyRef.current === currentExportKey) {
      return;
    }

    requestedExportKeyRef.current = currentExportKey;
    webViewRef.current?.injectJavaScript("window.__EXPORT_RECEIPT_IMAGE__ && window.__EXPORT_RECEIPT_IMAGE__(); true;");
  }, [currentExportKey]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (!job || !currentExportKey) {
        return;
      }

      const message = parseBridgeMessage(event.nativeEvent.data);
      if (!message || printInFlightRef.current) {
        return;
      }

      if (message.type === "receipt-export-error") {
        printInFlightRef.current = true;
        retryReceiptExport(new Error(message.payload));
        return;
      }

      printInFlightRef.current = true;

      void printReceiptImageBase64WithPrinter(message.payload, job.device)
        .then(() => {
          if (currentIndex >= pageCount - 1) {
            onComplete();
            return;
          }

          advanceToNextBill();
        })
        .catch((error) => {
          retryReceiptExport(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    },
    [advanceToNextBill, currentIndex, currentExportKey, job, onComplete, pageCount, retryReceiptExport],
  );

  if (!job || !currentData) {
    return null;
  }

  const payload = buildReceiptExportPayload(currentData);
  const sourceHtml = buildReceiptHtmlMarkup(payload);

  return (
    <View pointerEvents="none" style={styles.hiddenBridge}>
      {/* @ts-ignore - Suppress WebView prop type conflicts with React 19 / RN 0.76 */}
      <WebView
        ref={webViewRef}
        key={currentExportKey ?? job.id}
        originWhitelist={["*"]}
        source={{ html: sourceHtml }}
        onLoadEnd={handleLoadEnd}
        onMessage={handleMessage}
        scrollEnabled={false}
        nestedScrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.hiddenWebView}
      />
    </View>
  );
}

export function useReceiptImagePrintJob() {
  const [job, setJob] = useState<ReceiptPrintJob | null>(null);
  const pendingPromiseRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);

  const clearPendingJob = useCallback((error?: Error) => {
    const pending = pendingPromiseRef.current;
    pendingPromiseRef.current = null;
    setJob(null);

    if (!pending) {
      return;
    }

    if (error) {
      pending.reject(error);
      return;
    }

    pending.resolve();
  }, []);

  const startReceiptImagePrintJob = useCallback(
    (data: DeliveryReceiptData[], device: PrinterDevice) =>
      new Promise<void>((resolve, reject) => {
        if (data.length === 0) {
          resolve();
          return;
        }

        const nextJobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        if (pendingPromiseRef.current) {
          pendingPromiseRef.current.reject(
            new Error("A new receipt print job replaced the previous unfinished job."),
          );
        }

        pendingPromiseRef.current = {
          resolve,
          reject,
        };

        setJob({
          id: nextJobId,
          data,
          device,
        });
      }),
    [],
  );

  useEffect(
    () => () => {
      if (pendingPromiseRef.current) {
        pendingPromiseRef.current.reject(
          new Error("The receipt print job was interrupted before it could finish."),
        );
        pendingPromiseRef.current = null;
      }
    },
    [],
  );

  const receiptImagePrintBridge = useMemo(
    () => (
      <ReceiptImagePrintBridge
        job={job}
        onComplete={() => clearPendingJob()}
        onError={(error) => clearPendingJob(error)}
      />
    ),
    [clearPendingJob, job],
  );

  return {
    receiptImagePrintBridge,
    startReceiptImagePrintJob,
  };
}

const styles = StyleSheet.create({
  hiddenBridge: {
    position: "absolute",
    left: -10000,
    top: 0,
    opacity: 0.01,
    width: 404,
    height: 1400,
  },
  hiddenWebView: {
    width: "100%",
    height: "100%",
    backgroundColor: "#ffffff",
  },
});
