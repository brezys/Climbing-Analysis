# ClimbSight - AI-Powered Climbing Analysis

ClimbSight is an advanced rock climbing analysis platform that uses computer vision and AI to help climbers track, analyze, and improve their technique. By capturing real-time pose data and providing instant feedback, ClimbSight enables climbers of all levels to optimize their movements, identify weaknesses, and track progress over time.

## 🧗‍♀️ Features

### Biometric Profiles
- Track height, weight, and ape index measurements
- Personalized analysis based on your body metrics

![image](https://github.com/user-attachments/assets/0dd4735d-fc22-454b-9856-b1316852e377)

### Climb Definition & Sharing
- Upload images of climbing routes
- Automatic hold detection based on color
- Generate QR codes to share routes with others
- Scan QR codes to load route data

### Real-Time AI Analysis
- Live pose detection during climbing
- Detailed body position metrics
- Track joint angles, body lean, and arm extension
- Movement tracking for hands, feet, and center of gravity
  
  ![image](https://github.com/user-attachments/assets/bd4fc26d-5f9f-497e-bb4e-dfd6c5ca62b4)

### Session Recording
- Record climbing attempts with synchronized AI data
- Review recordings with skeletal overlays
- Compare multiple climbing attempts

### Performance Comparison
- Side-by-side video comparison with skeletal tracking
- Analyze differences in technique between attempts
- Compare completion time, speed, and path efficiency
- Identify the more efficient climbing pattern

  ![image](https://github.com/user-attachments/assets/46fa74a8-f508-42d0-8fc4-97993025c02e)

### Smart Feedback
- Receive personalized climbing advice
- AI-generated technique suggestions
- Targeted areas for improvement

## 🧩 Technology

ClimbSight leverages several cutting-edge technologies:

- **MediaPipe** for high-performance pose estimation
- **Next.js** and React for the UI framework
- **Computer Vision** algorithms for hold detection and motion tracking
- **QR Code** generation and scanning for route sharing
- **Advanced analytics** for climbing performance metrics

## 🚀 Getting Started

### Prerequisites
- Node.js (16.x or higher)
- A modern web browser
- A webcam or mobile device camera

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/brezys/Climbing-Analysis.git
   ```

2. Install dependencies:
   ```
   cd climbsight
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000`

5. You will also need to enter a Google Gemini API Key into a .env file.
   ```
   GEMINI_API_KEY=
   ```

## 📱 Usage Guide

1. **Enter your biometrics** for personalized analysis
2. **Define a climb** by uploading a photo and selecting hold colors
3. **Turn on the camera** to begin AI analysis
4. **Record your climbing attempts** for detailed feedback
5. **Compare different attempts** to identify improvements
6. **Receive AI-generated advice** to enhance your technique

## 🔮 Future Plans

- Mobile app for on-the-wall analysis
- Integration with gym route databases
- Machine learning for climb difficulty estimation
- Social features to share and compare with friends
- Training plans based on climbing analysis

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
