// ==============================================================================
// Nittoo Barcode Scanner Modal
// Native browser BarcodeDetector API with robust camera lifecycle & teardown
// ==============================================================================

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const [cameraStatus, setCameraStatus] = useState<
    'initializing' | 'active' | 'permission_denied' | 'unsupported' | 'error'
  >('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stop all camera tracks and animation frames
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;

    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Handle closing modal with full resource cleanup
  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  // Handle keyboard escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Camera start and detection loop
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraStatus('initializing');
    setErrorMessage(null);

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraStatus('unsupported');
      setErrorMessage('Camera access is not supported by your browser. You can enter the barcode manually.');
      return;
    }

    // Check native BarcodeDetector support
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    if (!hasBarcodeDetector) {
      setCameraStatus('unsupported');
      setErrorMessage(
        'Native barcode scanning is not supported in this browser. You can enter the barcode manually.'
      );
      return;
    }

    // Initialize detector
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detector = new (window as any).BarcodeDetector({
        formats: ['ean_13', 'upc_a', 'ean_8'],
      });
    } catch (err) {
      console.warn('BarcodeDetector instantiation failed:', err);
      setCameraStatus('unsupported');
      setErrorMessage('Barcode scanning could not be initialized. You can enter the barcode manually.');
      return;
    }

    // Request camera access explicitly
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      .then((stream) => {
        if (!isMounted) {
          // Component unmounted while waiting for user permission
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current
            .play()
            .then(() => {
              if (!isMounted) return;
              setCameraStatus('active');
              isScanningRef.current = true;

              // Start detection loop
              const scanFrame = async () => {
                if (!isScanningRef.current || !videoRef.current || !detector) return;

                if (videoRef.current.readyState >= 2) {
                  try {
                    const barcodes = await detector.detect(videoRef.current);
                    if (barcodes && barcodes.length > 0 && isScanningRef.current) {
                      const detected = barcodes[0].rawValue;
                      if (detected) {
                        // Stop camera immediately on detection
                        stopCamera();
                        onDetected(detected);
                        return;
                      }
                    }
                  } catch {
                    // Frame detection error, continue next frame
                  }
                }

                if (isScanningRef.current) {
                  animFrameRef.current = requestAnimationFrame(scanFrame);
                }
              };

              animFrameRef.current = requestAnimationFrame(scanFrame);
            })
            .catch((err) => {
              if (!isMounted) return;
              console.error('Video play failed:', err);
              setCameraStatus('error');
              setErrorMessage('Failed to start camera preview. You can enter the barcode manually.');
            });
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const error = err as Error;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraStatus('permission_denied');
          setErrorMessage('Camera access was denied. You can enter the barcode manually.');
        } else {
          setCameraStatus('error');
          setErrorMessage('Could not connect to camera. You can enter the barcode manually.');
        }
      });

    // Cleanup on unmount or close
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen, stopCamera, onDetected]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-page-in"
    >
      <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 text-sm">📷</span>
            <h2 id="scanner-modal-title" className="text-sm font-semibold tracking-wide">
              Scan Barcode
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer text-lg font-bold"
            aria-label="Close barcode scanner"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder / Video Container */}
        <div className="relative bg-black flex-1 min-h-[280px] max-h-[400px] flex items-center justify-center overflow-hidden">
          {cameraStatus === 'active' && (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Viewfinder Framing Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                <div className="relative w-64 h-40 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                  {/* Subtle Target Guide */}
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-emerald-400/70 -translate-y-1/2 shadow-xs" />
                </div>
                <p className="mt-4 text-xs font-medium text-stone-200 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                  Point the barcode inside the frame
                </p>
              </div>
            </>
          )}

          {cameraStatus === 'initializing' && (
            <div className="flex flex-col items-center gap-3 p-6 text-center">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-stone-400">Requesting camera access...</p>
            </div>
          )}

          {(cameraStatus === 'permission_denied' ||
            cameraStatus === 'unsupported' ||
            cameraStatus === 'error') && (
            <div className="flex flex-col items-center gap-3 p-6 text-center max-w-xs">
              <span className="text-2xl">⚠️</span>
              <p className="text-xs text-stone-300 leading-relaxed">
                {errorMessage || 'Camera access unavailable.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-stone-800 bg-stone-900/90 flex items-center justify-between gap-3">
          <p className="text-[11px] text-stone-400">UPC-A, EAN-13, EAN-8 supported</p>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Enter manually
          </button>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
