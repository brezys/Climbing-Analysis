// QR Code generation utilities
import QRCodeStyling from 'qr-code-styling';

interface ClimberStats {
  height: string | null;
  weight: string | null;
  apeIndex: string | null;
}

interface ClimbHold {
  x: number;
  y: number;
  color: string;
}

interface ClimbData {
  climbName: string;
  holdColors: string[];
  detectedHolds: ClimbHold[];
  timestamp: string;
  climberStats: ClimberStats;
}

/**
 * Generate a QR code for a climb
 */
export const generateQRCode = async (
  climbName: string,
  holdColors: string[],
  detectedHolds: ClimbHold[],
  climberStats: ClimberStats,
  image?: string | null
): Promise<string> => {
  // Prepare the climb data to store in QR code
  const climbData: ClimbData = {
    climbName,
    holdColors,
    detectedHolds,
    timestamp: new Date().toISOString(),
    climberStats
  };

  const qrCode = new QRCodeStyling({
    width: 256,
    height: 256,
    data: JSON.stringify(climbData),
    image: image || undefined,
    dotsOptions: {
      color: '#008080',
      type: 'rounded'
    },
    cornersSquareOptions: {
      type: 'extra-rounded'
    },
    backgroundOptions: {
      color: '#f0f0f0',
    },
  });

  // Convert the QR code to a data URL
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  
  // Use append method to add to DOM temporarily
  document.body.appendChild(canvas);
  
  // Use render method to draw QR code to canvas
  await qrCode.append(canvas);
  
  // Get data URL from canvas
  const dataUrl = canvas.toDataURL('image/png');
  
  // Clean up
  document.body.removeChild(canvas);
  
  return dataUrl;
};

/**
 * Parse QR code data into a climb object
 */
export const parseQRCodeData = (data: any): ClimbData | null => {
  try {
    // Validate the scanned data
    if (!data.climbName || !data.holdColors) {
      throw new Error('Invalid climb data');
    }
    
    // Return the parsed climb data
    return {
      climbName: data.climbName,
      holdColors: data.holdColors,
      detectedHolds: data.detectedHolds || [],
      timestamp: data.timestamp || new Date().toISOString(),
      climberStats: {
        height: data.climberStats?.height || null,
        weight: data.climberStats?.weight || null,
        apeIndex: data.climberStats?.apeIndex || null
      }
    };
  } catch (error) {
    console.error('Error parsing QR code data:', error);
    return null;
  }
}; 