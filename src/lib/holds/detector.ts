// Hold detection utilities

interface ClimbHold {
  x: number;
  y: number;
  color: string;
}

/**
 * Detects climbing holds in an image based on color matching
 */
export const detectHolds = (
  image: string, 
  holdColors: string[],
  pixelStep: number = 20
): Promise<ClimbHold[]> => {
  return new Promise((resolve, reject) => {
    if (!image || holdColors.length === 0) {
      reject(new Error('Image or hold colors missing'));
      return;
    }
    
    // Create a temporary image to process
    const img = new Image();
    img.src = image;
    img.onload = () => {
      // Create a temporary canvas for processing
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0);
      
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Holds detected
      const holds: ClimbHold[] = [];
      
      // Process every nth pixel for efficiency
      for (let y = 0; y < canvas.height; y += pixelStep) {
        for (let x = 0; x < canvas.width; x += pixelStep) {
          const idx = (y * canvas.width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Check if pixel matches any of the selected hold colors
          for (const color of holdColors) {
            if (isColorMatch(r, g, b, color)) {
              holds.push({x, y, color});
              
              // Draw a circle to mark the hold
              ctx.beginPath();
              ctx.arc(x, y, 8, 0, 2 * Math.PI);
              ctx.strokeStyle = color;
              ctx.lineWidth = 2;
              ctx.stroke();
              
              break;
            }
          }
        }
      }
      
      // Return the detected holds
      resolve(holds);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
};

/**
 * Determines if a pixel color matches a named color
 */
export const isColorMatch = (r: number, g: number, b: number, color: string): boolean => {
  switch (color.toLowerCase()) {
    case 'red':
      return r > 150 && g < 100 && b < 100;
    case 'blue':
      return r < 100 && g < 140 && b > 150;
    case 'green':
      return r < 100 && g > 150 && b < 100;
    case 'yellow':
      return r > 200 && g > 200 && b < 100;
    case 'purple':
      return r > 120 && g < 100 && b > 120;
    case 'orange':
      return r > 200 && g > 100 && g < 180 && b < 100;
    case 'white':
      return r > 200 && g > 200 && b > 200;
    case 'black':
      return r < 50 && g < 50 && b < 50;
    default:
      return false;
  }
};

/**
 * Gets an annotated image with holds marked
 */
export const getAnnotatedImage = (
  image: string,
  detectedHolds: ClimbHold[]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = image;
    img.onload = () => {
      // Create a canvas to draw the annotated image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      // Draw the base image
      ctx.drawImage(img, 0, 0);
      
      // Draw circles for each detected hold
      for (const hold of detectedHolds) {
        ctx.beginPath();
        ctx.arc(hold.x, hold.y, 8, 0, 2 * Math.PI);
        ctx.strokeStyle = hold.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
}; 