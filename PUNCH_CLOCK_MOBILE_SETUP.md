# GST Punch Clock Mobile App Setup

## Overview
This project now includes a separate mobile punch clock app that employees can use to punch in/out. The app syncs with the same Supabase database as the main application.

## Development Access
During development, you can access the punch clock app at:
- **Web URL**: `/punch-clock-app`
- **Mobile optimized interface** designed specifically for employees

## Mobile App Deployment

### Prerequisites
- Git repository access
- Node.js installed
- For iOS: Mac with Xcode
- For Android: Android Studio

### Step 1: Export to GitHub
1. Click the "Export to Github" button in Lovable
2. Git pull the project from your GitHub repository

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Add Mobile Platforms
```bash
# For iOS (requires macOS)
npx cap add ios

# For Android
npx cap add android
```

### Step 4: Update Native Dependencies
```bash
# For iOS
npx cap update ios

# For Android  
npx cap update android
```

### Step 5: Build the Project
```bash
npm run build
```

### Step 6: Sync to Native Platforms
```bash
npx cap sync
```
*Note: Run this command whenever you git pull new changes*

### Step 7: Run on Device/Emulator
```bash
# For Android
npx cap run android

# For iOS (requires macOS and Xcode)
npx cap run ios
```

## App Configuration
The Capacitor configuration is set up with:
- **App ID**: `app.lovable.77c166dbfb3342d5a173494b5f92758d`
- **App Name**: GST Punch Clock
- **Hot Reload URL**: Enabled for development

## Features
- **Employee Authentication**: Secure login using existing user accounts
- **Job Selection**: Choose from active jobs
- **Cost Code Selection**: Select appropriate cost codes
- **Photo Capture**: Required photos for punch in/out
- **GPS Location**: Automatic location capture
- **Real-time Sync**: All punches sync immediately with main database
- **Current Status Display**: Shows if employee is currently punched in
- **Time Display**: Large, clear time display

## Database Sync
The punch clock app uses the same Supabase tables:
- `punch_records` - Stores all punch in/out events
- `current_punch_status` - Tracks active punch sessions
- `jobs` - Available jobs for selection
- `cost_codes` - Available cost codes
- `profiles` - Employee information

All data is synchronized in real-time between the main app and punch clock app.

## Security
- Row Level Security (RLS) policies ensure employees can only see their own data
- JWT authentication required for all API calls
- Photos stored securely in Supabase Storage

## Customization
The punch clock app can be customized by editing:
- `src/pages/PunchClockApp.tsx` - Main punch clock interface
- `capacitor.config.ts` - Mobile app configuration

## Troubleshooting
- **Camera not working**: Ensure camera permissions are granted
- **Location not working**: Enable location services
- **Sync issues**: Check internet connection and Supabase connectivity

For more detailed mobile development guidance, visit: https://lovable.dev/blogs/TODO