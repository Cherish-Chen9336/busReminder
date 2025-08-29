# 🚌 Dubai Bus Buddy

A modern real-time bus information reminder application with PWA support, helping you stay informed about bus arrival times.

## ✨ Main Features

### 🚏 Bus Stop Management
- Search and favorite commonly used bus stops
- Real-time display of bus arrival times
- Support for stop code and name search

### 🔔 Smart Reminder System
- Automatic alerts when buses are approaching
- Arrival time change notifications
- Customizable reminder time (1-15 minutes)
- Support for push notifications and local notifications

### 📱 PWA Support
- Can be added to mobile home screen
- Offline caching functionality
- Native app experience
- Auto-update

### 🎨 User-Friendly Interface
- Responsive design supporting various devices
- Dark mode support
- Modern UI design
- Smooth animations

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Development Mode
```bash
npm run dev
```

### Build Production Version
```bash
npm run build
```

### Preview Build Results
```bash
npm run preview
```

## 📱 PWA Installation Guide

### Android Chrome
1. Open the app
2. Click the "Install" button on the right side of the address bar
3. Select "Add to Home Screen"

### iOS Safari
1. Open the app
2. Click the share button
3. Select "Add to Home Screen"

### Desktop Browser
1. Open the app
2. Click the "Install" button on the right side of the address bar
3. Select "Install"

## ⚙️ Settings Guide

### Notification Settings
- **Enable Notifications**: Turn on/off push notifications
- **Reminder Time**: Set how many minutes in advance to remind (1-15 minutes)
- **Test Notifications**: Test if notification functionality is working properly

### App Settings
- **Auto Refresh**: Automatically update bus information (every 30 seconds)
- **Dark Mode**: Switch between dark/light themes

## 🔧 Technical Architecture

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling Framework**: Tailwind CSS
- **State Management**: Zustand
- **PWA Support**: Service Worker + Manifest
- **Notification System**: Web Notifications API

## 📁 Project Structure

```
dubai-bus-buddy/
├── public/
│   ├── manifest.json      # PWA configuration
│   ├── sw.js             # Service Worker
│   └── icon-*.png        # App icons
├── src/
│   ├── components/       # React components
│   ├── lib/             # Utility libraries
│   ├── App.tsx          # Main app component
│   └── main.tsx         # App entry point
└── package.json
```

## 🌟 Special Features

### Real-time Data Updates
- Auto-refresh bus information every 30 seconds
- Smart detection of time changes
- Timely update notifications

### Smart Reminders
- Automatic reminders based on user settings
- Avoid duplicate notifications
- Support for multiple notification types

### Offline Support
- Service Worker caching of critical resources
- View basic information even when offline
- Auto-sync when network is restored

## 🔮 Future Plans

- [ ] Integrate real bus API
- [ ] Add route planning functionality
- [ ] Support multiple languages
- [ ] Add user account system
- [ ] Support more cities

## 🤝 Contributing Guide

Welcome to submit Issues and Pull Requests!

1. Fork the project
2. Create a feature branch
3. Submit changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

MIT License

## 📞 Contact Us

If you have questions or suggestions, please contact us through:

- Submit GitHub Issue
- Send email to project maintainer

---

**Enjoy convenient bus travel experience!** 🚌✨
