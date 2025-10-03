# Creating an iPhone or Android App from Your Lovable Project

This guide explains how to convert your Lovable web app into a native mobile app for iOS and Android using Capacitor.

## Overview

Your project already has Capacitor configured (see `capacitor.config.ts`). Capacitor allows you to turn your web app into a native mobile app that can be published to the App Store and Google Play.

## Prerequisites

### For Both Platforms:
- Node.js installed (v16 or higher)
- Git installed
- GitHub account (to export your project)

### For iOS (iPhone/iPad):
- **Mac computer required** (Xcode only runs on macOS)
- Xcode (download from Mac App Store)
- Apple Developer Account ($99/year to publish to App Store)

### For Android:
- Android Studio (works on Windows, Mac, or Linux)
- Java Development Kit (JDK 11 or higher)
- Google Play Developer Account ($25 one-time fee to publish)

## Step-by-Step Guide

### Step 1: Export Your Project from Lovable

1. Click the **"Export to GitHub"** button in Lovable
2. Connect your GitHub account if you haven't already
3. Choose a repository name and make it public or private
4. Wait for the export to complete

### Step 2: Clone Your Project Locally

```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Install all dependencies
npm install
```

### Step 3: Add Mobile Platforms

**Important:** Only add the platforms you need!

```bash
# For iOS (only on Mac)
npx cap add ios

# For Android
npx cap add android

# Update platform dependencies
npx cap update ios    # if you added iOS
npx cap update android # if you added Android
```

### Step 4: Build Your Web App

```bash
# Build the production version of your app
npm run build
```

### Step 5: Sync to Native Platforms

```bash
# This copies your web app into the native projects
npx cap sync
```

**Important:** Run `npx cap sync` every time you:
- Pull new code from GitHub
- Make changes to your web app
- Update Capacitor plugins

### Step 6: Open and Run in Native IDE

#### For iOS:

```bash
# Open in Xcode
npx cap open ios
```

In Xcode:
1. Select a simulator (e.g., iPhone 15 Pro) or connect a real iPhone
2. Click the Play button to build and run
3. Wait for the app to install and launch

#### For Android:

```bash
# Open in Android Studio
npx cap open android
```

In Android Studio:
1. Wait for Gradle sync to complete (first time takes a while)
2. Select an emulator or connect a real Android device
3. Click the Run button (green play icon)
4. Wait for the app to install and launch

## Testing Your App

### On Simulator/Emulator (Free)
- iOS: Use Xcode's iOS Simulator (included with Xcode)
- Android: Use Android Studio's emulator (create one in Device Manager)

### On Real Device (Free for testing)
- iOS: Connect iPhone via USB, select it in Xcode, may need to trust your computer on the device
- Android: Enable Developer Mode and USB Debugging on your Android device, connect via USB

## Publishing to App Stores

### iOS App Store:

1. **Get an Apple Developer Account** ($99/year)
   - Sign up at [developer.apple.com](https://developer.apple.com)

2. **Configure App in Xcode:**
   - Set your Team in Signing & Capabilities
   - Configure Bundle Identifier (must be unique, e.g., `com.yourcompany.gstpunchclock`)
   - Set app version and build number
   - Add app icons (1024x1024 for App Store)

3. **Archive and Upload:**
   - Product → Archive in Xcode
   - Upload to App Store Connect
   - Fill out app information, screenshots, description
   - Submit for review (typically takes 1-3 days)

### Google Play Store:

1. **Get a Google Play Developer Account** ($25 one-time)
   - Sign up at [play.google.com/console](https://play.google.com/console)

2. **Configure App in Android Studio:**
   - Update `applicationId` in `android/app/build.gradle`
   - Set version code and version name
   - Add app icons in `res/mipmap` folders
   - Create a keystore for signing (keep this secure!)

3. **Build Release APK/Bundle:**
   - Build → Generate Signed Bundle/APK
   - Choose Android App Bundle (recommended)
   - Sign with your keystore
   - Upload to Play Console
   - Fill out store listing, screenshots, description
   - Submit for review (typically takes a few hours to a day)

## Hot Reload During Development

Your `capacitor.config.ts` is configured to use hot reload during development:

```typescript
server: {
  url: 'https://77c166db-fb33-42d5-a173-494b5f92758d.lovableproject.com?forceHideBadge=true',
  cleartext: true
}
```

This means the app will load your live Lovable preview. When you're ready to build a standalone app:

1. **Comment out** or remove the `server` section in `capacitor.config.ts`
2. Rebuild: `npm run build`
3. Sync: `npx cap sync`
4. The app will now use your built files instead of the live preview

## Common Issues and Solutions

### iOS Build Fails
- Make sure Xcode is fully updated
- Clean build folder: Product → Clean Build Folder in Xcode
- Delete `ios/App/Pods` folder and run `npx cap sync ios` again

### Android Build Fails
- Make sure Java JDK 11+ is installed
- File → Invalidate Caches / Restart in Android Studio
- Check `android/gradle.properties` for correct settings

### App Shows Blank Screen
- Make sure you ran `npm run build` and `npx cap sync`
- Check browser console in the app for errors
- Verify `capacitor.config.ts` `webDir` points to `dist`

### Plugins Not Working
- Make sure you ran `npx cap update` after adding platforms
- Sync again: `npx cap sync`
- Rebuild the native project

## App Configuration

Your app details are in `capacitor.config.ts`:

```typescript
{
  appId: 'app.lovable.77c166dbfb3342d5a173494b5f92758d',
  appName: 'GST Punch Clock',
  webDir: 'dist',
  ...
}
```

You can customize:
- **appId**: Your unique app identifier (reverse domain format)
- **appName**: The name shown on the device
- **webDir**: Build output directory (keep as `dist`)

## Resources

- **Capacitor Docs:** [capacitorjs.com/docs](https://capacitorjs.com/docs)
- **iOS Developer:** [developer.apple.com](https://developer.apple.com)
- **Android Developer:** [developer.android.com](https://developer.android.com)
- **Lovable Docs:** [docs.lovable.dev](https://docs.lovable.dev)

## Need Help?

- Check Capacitor's community forum: [forum.capacitorjs.com](https://forum.capacitorjs.com)
- Visit Lovable's Discord community
- Review the existing `PUNCH_CLOCK_MOBILE_SETUP.md` for punch clock specific features

## Next Steps After Publishing

1. Monitor reviews and ratings
2. Respond to user feedback
3. Keep your app updated with new features from Lovable
4. Test on multiple devices and OS versions
5. Consider adding push notifications using `@capacitor/push-notifications`

Good luck with your mobile app! 🚀
