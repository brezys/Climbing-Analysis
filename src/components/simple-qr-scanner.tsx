import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, Check, Upload } from 'lucide-react';

interface SimpleQRScannerProps {
  onScan: (data: any) => void;
}

export function SimpleQRScanner({ onScan }: SimpleQRScannerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setScanning(true);
      
      // Create a placeholder for scan results
      // In a real QR scanner we would process the image here
      // This is a simplified version that just simulates success
      setTimeout(() => {
        // Simulate a successful scan
        const simulatedData = {
          climbName: "Sample Climb",
          holdColors: ["red", "blue", "green"],
          detectedHolds: Array.from({length: 12}, (_, i) => ({
            x: Math.random() * 100, 
            y: Math.random() * 100, 
            color: ["red", "blue", "green"][Math.floor(Math.random() * 3)]
          })),
          timestamp: new Date().toISOString(),
          climberStats: {
            height: 175,
            weight: 70,
            apeIndex: 5
          }
        };
        
        setScanResult(JSON.stringify(simulatedData));
        onScan(simulatedData);
        setScanning(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error processing QR image:', error);
      setScanning(false);
      onScan({ error: 'Failed to process QR code' });
    }
  };
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="flex gap-2">
          <Camera className="h-4 w-4" />
          Quick QR Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Climb from QR Code</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Take a picture of a climb QR code and upload it here.
          </p>
          
          <div className="bg-slate-100 p-8 rounded-md flex flex-col items-center justify-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            {scanResult ? (
              <div className="flex flex-col items-center gap-2">
                <Check className="h-8 w-8 text-green-500" />
                <p className="text-center">QR Code Processed Successfully</p>
              </div>
            ) : (
              <Button
                variant="outline"
                className="flex gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
              >
                {scanning ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload QR Code Image
                  </>
                )}
              </Button>
            )}
          </div>
          
          <Button 
            onClick={() => setDialogOpen(false)} 
            variant={scanResult ? 'default' : 'outline'}
          >
            {scanResult ? 'Continue' : 'Cancel'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 