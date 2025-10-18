# Third-Party Storage Integration Guide

This guide explains how to connect third-party storage services (Google Drive, OneDrive, FTP) to your application.

## Overview

The File Upload Settings page (Data & Security > File Uploads) allows you to configure naming patterns and enable third-party storage integrations. However, **actual file syncing requires backend implementation**.

## What's Already Set Up

✅ **File Naming Settings**: Configure automatic file renaming patterns for receipts, bills, and subcontracts
✅ **Storage Configuration**: Save connection settings for Google Drive, OneDrive, and FTP
✅ **Database Table**: `file_upload_settings` table stores all configuration

## What Needs to be Implemented

The following requires backend edge functions to be created:

### 1. Google Drive Integration

**Requirements:**
- Google Cloud Project with Drive API enabled
- OAuth 2.0 credentials
- Service account or user authentication

**Implementation Steps:**
1. Create edge function: `supabase/functions/sync-to-google-drive/index.ts`
2. Implement OAuth flow for user authentication
3. Use Google Drive API to upload files
4. Store OAuth tokens securely in Supabase secrets

**Edge Function Example:**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { fileUrl, fileName, folderId } = await req.json()
  
  // Get Google Drive access token
  const accessToken = Deno.env.get('GOOGLE_DRIVE_TOKEN')
  
  // Download file from Supabase Storage
  const fileResponse = await fetch(fileUrl)
  const fileBlob = await fileResponse.blob()
  
  // Upload to Google Drive
  const metadata = {
    name: fileName,
    parents: [folderId]
  }
  
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', fileBlob)
  
  const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: form
  })
  
  return new Response(JSON.stringify(await uploadResponse.json()))
})
```

### 2. OneDrive Integration

**Requirements:**
- Microsoft Azure App registration
- Microsoft Graph API permissions
- OAuth 2.0 credentials

**Implementation Steps:**
1. Create edge function: `supabase/functions/sync-to-onedrive/index.ts`
2. Implement OAuth flow
3. Use Microsoft Graph API for uploads
4. Store credentials securely

**Microsoft Graph API Upload:**
```typescript
const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/items/${folderId}/children`
```

### 3. FTP Integration

**Requirements:**
- FTP server credentials
- Deno FTP client library

**Implementation Steps:**
1. Create edge function: `supabase/functions/sync-to-ftp/index.ts`
2. Use FTP client to connect and upload
3. Store FTP credentials as Supabase secrets

**FTP Upload Example:**
```typescript
import { FTP } from "https://deno.land/x/ftp/mod.ts"

const ftp = new FTP()
await ftp.connect({
  hostname: settings.ftp_host,
  port: settings.ftp_port,
  username: settings.ftp_username,
  password: settings.ftp_password
})

await ftp.uploadFile(localFilePath, remotePath)
await ftp.close()
```

## How to Trigger File Sync

Once edge functions are created, trigger them after file uploads:

```typescript
// In your file upload handler
const { data: uploadData } = await supabase.storage
  .from('receipts')
  .upload(filePath, file)

// Get settings
const { data: settings } = await supabase
  .from('file_upload_settings')
  .select('*')
  .eq('company_id', companyId)
  .single()

// Trigger syncs based on enabled integrations
if (settings.enable_google_drive) {
  await supabase.functions.invoke('sync-to-google-drive', {
    body: {
      fileUrl: uploadData.path,
      fileName: renamedFile,
      folderId: settings.google_drive_folder_id
    }
  })
}

if (settings.enable_onedrive) {
  await supabase.functions.invoke('sync-to-onedrive', {
    body: {
      fileUrl: uploadData.path,
      fileName: renamedFile,
      folderId: settings.onedrive_folder_id
    }
  })
}

if (settings.enable_ftp) {
  await supabase.functions.invoke('sync-to-ftp', {
    body: {
      fileUrl: uploadData.path,
      fileName: renamedFile,
      remotePath: settings.ftp_folder_path
    }
  })
}
```

## Security Considerations

⚠️ **Never store credentials in the database or code**
- Use Supabase Secrets for all API keys and tokens
- Implement proper OAuth flows for Google/Microsoft
- Encrypt FTP passwords
- Use environment variables in edge functions

## Testing

1. Test file naming patterns first
2. Implement one integration at a time
3. Use test folders/accounts initially
4. Monitor edge function logs
5. Implement error handling and retry logic

## Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/guides/about-sdk)
- [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Deno FTP Module](https://deno.land/x/ftp)
