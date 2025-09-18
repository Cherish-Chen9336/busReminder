# 🚌 Dubai Bus Buddy

A modern real-time bus information reminder application with PWA support, helping you stay informed about bus arrival times.

## ✨ Main Features

### 🚏 Bus Stop Management
- Search and favorite commonly used bus stops
- Real-time display of bus arrival times
- Support for stop code and name search

### 🚌 Route Query by Line Number
- Query bus stops by route number or route ID
- View stops in sequence order
- Support direction filtering (0/1)
- Service date selection
- Health check functionality

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

### Route Query Settings
- **Line Number Input**: Enter route number (e.g., "8") or route ID (e.g., "F11")
- **Direction Filter**: Select direction 0 or 1 (optional)
- **Service Date**: Choose specific date (defaults to today)
- **Health Check**: Test database connection and functionality

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

## 🚌 Route Query API

### Database RPC Functions

#### route_stops
**Purpose**: Get ordered stops for a specific route
**Parameters**:
- `p_route_id` (TEXT, required): Target route ID
- `p_service_date` (DATE, default: current_date): Service date
- `p_direction` (INT, default: null): Direction filter
- `p_max_trips` (INT, default: 1): Maximum trips to consider

**Returns**: Array of stops with order_no, stop_id, stop_name, coordinates, trip_id, shape_id, direction_id

#### route_id_by_short_name
**Purpose**: Convert route short name to route ID
**Parameters**:
- `p_route_short_name` (TEXT): Route short name (e.g., "8")

**Returns**: Array of matching routes with route_id, route_short_name, route_long_name

### REST Endpoints

**Base URL**: `https://dxjaxszouwvmffeujpkx.supabase.co/rest/v1/rpc/`

**Headers**:
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**Example Payload**:
```json
{
  "p_route_id": "F11",
  "p_service_date": "2024-01-15",
  "p_direction": 0,
  "p_max_trips": 1
}
```

## 🔮 Future Plans

- [x] Route query by line number
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
