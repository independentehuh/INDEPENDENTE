import React, { useState } from 'react';
import { Download, Smartphone, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'header' | 'drawer' | 'footer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      {variant === 'drawer' ? (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-semibold text-navy-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-navy-900 dark:text-slate-200" />
            {isIOS ? 'Install App on iOS' : 'Install INDEPENDENTE App'}
          </span>
          <Download className="w-4 h-4" />
        </button>
      ) : variant === 'footer' ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-semibold bg-navy-900 text-white hover:bg-navy-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-navy-900 dark:border-slate-600 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          {isInstallable ? 'Install App Now' : 'Install as Mobile / Desktop App'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          aria-label="Install INDEPENDENTE app"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md border border-navy-900 dark:border-slate-500 text-navy-900 dark:text-white bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isIOS ? 'Install iOS' : 'Install App'}</span>
        </button>
      )}

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install INDEPENDENTE App Guide"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="INDEPENDENTE App Icon"
                  className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                />
                <div>
                  <h3 className="text-base font-bold text-navy-900 dark:text-white">
                    Install INDEPENDENTE App
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Standalone PWA · Works on iOS, Android &amp; Desktop
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
                <p>To install INDEPENDENTE on your iPhone or iPad:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm">
                  <li>
                    Tap the <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white"><Share className="w-3.5 h-3.5" /> Share</strong> button in the Safari toolbar.
                  </li>
                  <li>
                    Scroll down and select <strong className="text-slate-900 dark:text-white">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-slate-900 dark:text-white">Add</strong> to launch INDEPENDENTE as a full-screen app.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                <p>Open the live website URL in your device browser to install it as an app:</p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>
                    <strong className="text-slate-900 dark:text-white">Android (Chrome / Edge):</strong> Tap the browser menu (&#8942;) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">Desktop (Chrome / Edge):</strong> Click the <strong>Install</strong> icon on the right side of the address bar.
                  </li>
                  <li>
                    <strong className="text-slate-900 dark:text-white">iPhone / iPad (Safari):</strong> Tap <strong>Share</strong> &rarr; <strong>Add to Home Screen</strong>.
                  </li>
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-slate-800 dark:hover:bg-slate-700 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
