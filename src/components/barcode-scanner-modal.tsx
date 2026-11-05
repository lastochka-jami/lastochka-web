'use client';

import { appPath } from '@/lib/app-path';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Zap,
  ZapOff,
  Keyboard,
  ScanLine,
  X,
  Loader2,
  Search,
} from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/browser';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BarcodeScannerModal({ isOpen, onClose }: BarcodeScannerModalProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<any>(null);

  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');

  // Lock body scroll when scanner is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Start camera and scanner
  useEffect(() => {
    if (!isOpen || manualMode) {
      stopScanner();
      return;
    }

    let isCancelled = false;

    async function startScanner() {
      setError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Камера не поддерживается вашим браузером');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setHasCamera(true);

        const track = stream.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          const capabilities = track.getCapabilities() as any;
          if (capabilities && capabilities.torch) {
            setTorchSupported(true);
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const reader = new BrowserMultiFormatReader();
        readerRef.current = reader;

        // Decode from video stream
        if (videoRef.current) {
          const controls = await reader.decodeFromVideoElement(
            videoRef.current,
            (result, err) => {
              if (result && !isCancelled) {
                const text = result.getText();
                if (text) {
                  handleBarcodeDetected(text);
                }
              }
            },
          );
          controlsRef.current = controls;
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Camera error:', err);
          setHasCamera(false);
          setError(
            err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
              ? 'Доступ к камере запрещен. Разрешите доступ в настройках браузера или введите штрихкод вручную.'
              : 'Не удалось запустить камеру. Вы можете ввести штрихкод вручную.',
          );
        }
      }
    }

    startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, [isOpen, manualMode]);

  function stopScanner() {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
      controlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setTorchOn(false);
  }

  async function toggleTorch() {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await (track.applyConstraints as any)({
        advanced: [{ torch: nextTorch }],
      });
      setTorchOn(nextTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  }

  async function handleBarcodeDetected(code: string) {
    if (busy) return;
    setBusy(true);
    setError('');

    // Stop scanning during API request
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {}
    }

    try {
      const res = await fetch(appPath(`/api/barcode/${encodeURIComponent(code.trim())}`));
      const json = await res.json();

      if (!res.ok || !json?.data) {
        setError(json?.message || 'Товар с указанным штрихкодом не найден');
        setBusy(false);
        // Resume reader after 2 seconds
        setTimeout(() => {
          if (videoRef.current && readerRef.current && isOpen && !manualMode) {
            readerRef.current
              .decodeFromVideoElement(videoRef.current, (result) => {
                if (result) handleBarcodeDetected(result.getText());
              })
              .then((c) => (controlsRef.current = c))
              .catch(() => {});
          }
        }, 2000);
        return;
      }

      const product = json.data;
      stopScanner();
      onClose();
      router.push(`/product/${product.id}`);
    } catch (err: any) {
      setError(err?.message || 'Ошибка поиска товара');
      setBusy(false);
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(appPath(`/api/barcode/${encodeURIComponent(code)}`));
      const json = await res.json();
      if (!res.ok || !json?.data) {
        setError(json?.message || 'Товар с указанным штрихкодом не найден');
        setBusy(false);
        return;
      }
      const product = json.data;
      stopScanner();
      onClose();
      router.push(`/product/${product.id}`);
    } catch (err: any) {
      setError(err?.message || 'Ошибка при поиске');
      setBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="barcode-scanner-screen" role="dialog" aria-modal="true" aria-label="Сканирование штрихкода">
      {/* Top Navigation Bar */}
      <div className="barcode-scanner-header">
        <button
          type="button"
          className="barcode-header-btn"
          onClick={() => {
            stopScanner();
            onClose();
          }}
          aria-label="Закрыть сканер"
        >
          <ChevronLeft size={28} />
        </button>

        <h1 className="barcode-header-title">Сканирование штрихкода</h1>

        {torchSupported ? (
          <button
            type="button"
            className={`barcode-header-btn torch-btn ${torchOn ? 'active' : ''}`}
            onClick={toggleTorch}
            aria-label={torchOn ? 'Выключить фонарик' : 'Включить фонарик'}
            title={torchOn ? 'Выключить фонарик' : 'Включить фонарик'}
          >
            {torchOn ? <Zap size={24} /> : <ZapOff size={24} />}
          </button>
        ) : (
          <div className="barcode-header-placeholder" aria-hidden="true" />
        )}
      </div>

      {/* Main Viewfinder / Camera Area */}
      <div className="barcode-scanner-body">
        {!manualMode ? (
          <>
            <video
              ref={videoRef}
              className="barcode-video"
              playsInline
              muted
              autoPlay
            />

            {/* Viewfinder overlay */}
            <div className="barcode-viewfinder-overlay">
              <div className="viewfinder-top" />
              <div className="viewfinder-middle">
                <div className="viewfinder-left" />
                <div className="viewfinder-frame">
                  {/* Corner accents */}
                  <span className="corner top-left" />
                  <span className="corner top-right" />
                  <span className="corner bottom-left" />
                  <span className="corner bottom-right" />

                  {/* Laser scan line */}
                  <div className="viewfinder-laser" />

                  {busy && (
                    <div className="viewfinder-busy">
                      <Loader2 className="spinner" size={36} />
                      <span>Поиск товара...</span>
                    </div>
                  )}
                </div>
                <div className="viewfinder-right" />
              </div>
              <div className="viewfinder-bottom" />
            </div>
          </>
        ) : (
          /* Manual Input Screen */
          <div className="barcode-manual-container">
            <form onSubmit={handleManualSubmit} className="barcode-manual-form">
              <div className="barcode-manual-icon">
                <ScanLine size={48} />
              </div>
              <h2>Введите штрихкод товара</h2>
              <p className="muted">Штрихкод указан на упаковке (обычно состоит из 8 или 13 цифр)</p>

              <div className="barcode-manual-input-wrap">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Например, 4607004880012"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  autoFocus
                  required
                  className="barcode-manual-input"
                />
              </div>

              <button
                type="submit"
                className="primary barcode-manual-submit-btn"
                disabled={busy || !manualCode.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="spinner" size={18} />
                    Поиск...
                  </>
                ) : (
                  <>
                    <Search size={18} />
                    Найти товар
                  </>
                )}
              </button>

              <button
                type="button"
                className="secondary barcode-back-to-camera-btn"
                onClick={() => setManualMode(false)}
              >
                Вернуться к камере
              </button>
            </form>
          </div>
        )}

        {/* Error Toast / Banner */}
        {error && (
          <div className="barcode-error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              className="barcode-error-dismiss"
              onClick={() => setError('')}
              aria-label="Скрыть ошибку"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Sheet Card */}
      {!manualMode && (
        <div className="barcode-scanner-bottom-sheet">
          <div className="bottom-sheet-icon">
            <ScanLine size={36} />
          </div>
          <p className="bottom-sheet-text">Наведите камеру на штрихкод товара</p>
          <button
            type="button"
            className="barcode-manual-toggle-btn"
            onClick={() => setManualMode(true)}
          >
            <Keyboard size={20} />
            <span>Ввести штрихкод вручную</span>
          </button>
        </div>
      )}
    </div>
  );
}
