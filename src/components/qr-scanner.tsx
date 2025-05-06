import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, Camera, Check } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import dynamic from 'next/dynamic';

// Define type for Html5QrCode
type Html5QrcodeType = any;
let Html5QrCode: Html5QrcodeType | null = null;

interface QRScannerProps {
  onScan: (data: any) => void;
}

export function QRScanner({ onScan }: QRScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize the QR scanner module when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use a try-catch to handle any import errors
      try {
        const loadScanner = async () => {
          try {
            // Dynamic import - this will only run on the client side
            const html5QrcodeModule = await import('html5-qrcode');
            Html5QrCode = html5QrcodeModule.Html5Qrcode;
            setIsReady(true);
          } catch (err) {
            console.error("Failed to load HTML5 QR Code scanner:", err);
            setLoadError("Failed to load QR scanner library. Please use the simple scanner instead.");
          }
        };
        
        loadScanner();
      } catch (error) {
        console.error("Error setting up QR scanner:", error);
        setLoadError("Error initializing QR scanner.");
      }
    }

    // Clean up on unmount
    return () => {
      if (scanning) {
        stopScanner();
      }
    };
  }, []);

  // Additional effect to clean up scanner when unmounting or dialog closes
  useEffect(() => {
    // Clean up scanner when component unmounts or dialog closes
    return () => {
      if (scanning) {
        stopScanner();
      }
    };
  }, [scanning, dialogOpen]);

  const startScanner = async () => {
    if (!videoRef.current || !Html5QrCode) {
      console.error("Video ref or Html5QrCode not available");
      return;
    }
    
    try {
      setScanning(true);
      setScanResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      
      // Start capture loop
      scannerRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      console.error('Error starting QR scanner:', error);
      setScanning(false);
      setLoadError("Could not access camera. Please check your permissions.");
    }
  };
  
  const stopScanner = () => {
    if (scannerRef.current) {
      cancelAnimationFrame(scannerRef.current);
      scannerRef.current = null;
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setScanning(false);
  };
  
  const scanFrame = async () => {
    if (!videoRef.current || !scanning || !Html5QrCode) return;
    
    try {
      // Check if video is ready
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        // Create a canvas to capture video frame
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) return;
        
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL for processing
        const imageData = canvas.toDataURL('image/png');
        
        try {
          // Create a unique ID for the scanner element
          const qrReaderId = "qr-reader-" + Date.now();
          
          // Create a temporary element for the QR scanner
          const tempDiv = document.createElement('div');
          tempDiv.id = qrReaderId;
          tempDiv.style.display = 'none';
          document.body.appendChild(tempDiv);
          
          // Create scanner instance
          const qrCodeScanner = new Html5QrCode(qrReaderId);
          
          try {
            // Attempt to decode directly from image data
            const result = await qrCodeScanner.scanFileV2(
              dataURItoBlob(imageData), 
              /* showImage= */ false
            );
            
            if (result && result.decodedText) {
              // Successfully decoded a QR code
              setScanResult(result.decodedText);
              stopScanner();
              
              try {
                // Parse the result as JSON
                const parsedData = JSON.parse(result.decodedText);
                onScan(parsedData);
              } catch (parseError) {
                console.error('Error parsing QR code data:', parseError);
                onScan({ error: 'Invalid QR code format' });
              }
              
              // Clean up the scanner
              qrCodeScanner.clear();
              document.body.removeChild(tempDiv);
              return;
            }
            
            // Clean up the scanner
            qrCodeScanner.clear();
            document.body.removeChild(tempDiv);
          } catch (scanErr) {
            // Clean up on error
            if (tempDiv.parentNode) {
              document.body.removeChild(tempDiv);
            }
            throw scanErr;
          }
        } catch (decodeError) {
          // Decode failed, continue scanning
          console.error('Error decoding QR code:', decodeError);
        }
        
        // Continue scanning
        scannerRef.current = requestAnimationFrame(scanFrame);
      } else {
        // Video not ready yet, try again
        scannerRef.current = requestAnimationFrame(scanFrame);
      }
    } catch (error) {
      console.error('Error scanning QR code:', error);
      stopScanner();
    }
  };
  
  // Helper function to convert data URI to Blob
  const dataURItoBlob = (dataURI: string): Blob => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeString });
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      setDialogOpen(open);
      if (!open && scanning) {
        stopScanner();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="flex gap-2">
          <Camera className="h-4 w-4" />
          Scan QR Code
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Climb QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4">
          {loadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{loadError}</AlertDescription>
            </Alert>
          )}
          
          <div className="relative aspect-video bg-black rounded-md overflow-hidden">
            {scanning ? (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                ></video>
                <div className="absolute inset-0 border-2 border-dashed border-white/50 m-8 pointer-events-none"></div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full bg-slate-900 text-white">
                {scanResult ? (
                  <div className="flex flex-col items-center gap-2">
                    <Check className="h-8 w-8 text-green-500" />
                    <p>QR Code Scanned Successfully</p>
                  </div>
                ) : (
                  <p className="text-center p-4">
                    {loadError ? 'QR Scanner unavailable' : 'Press "Start Scanning" to begin'}
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex justify-between">
            {scanning ? (
              <Button onClick={stopScanner} variant="destructive">
                Stop Scanning
              </Button>
            ) : (
              <Button onClick={startScanner} disabled={!!scanResult || !isReady || !!loadError}>
                {!isReady && !loadError ? 'Loading Scanner...' : scanResult ? 'Scan Complete' : 'Start Scanning'}
              </Button>
            )}
            
            <Button 
              onClick={() => setDialogOpen(false)} 
              variant={scanResult ? 'default' : 'outline'}
            >
              {scanResult ? 'Continue' : 'Cancel'}
            </Button>
          </div>
          
          {scanResult && (
            <div className="p-2 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 text-sm flex items-center gap-1">
                <Check className="h-4 w-4" />
                QR code data received
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 