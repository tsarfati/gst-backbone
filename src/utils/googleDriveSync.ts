import { supabase } from '@/integrations/supabase/client';

type SyncCategory = 
  | 'photos' 
  | 'filing_cabinet' 
  | 'subcontracts' 
  | 'permits' 
  | 'delivery_tickets' 
  | 'receipts' 
  | 'bills'
  | 'company_permits'
  | 'company_contracts'
  | 'company_insurance'
  | 'company_files';

/**
 * Sync a file to Google Drive if the company has sync enabled for the given category.
 * This is a fire-and-forget operation — errors are logged but don't block the caller.
 */
export async function syncFileToGoogleDrive({
  companyId,
  jobId,
  category,
  fileUrl,
  fileName,
  subfolder,
}: {
  companyId: string;
  jobId?: string;
  category: SyncCategory;
  fileUrl: string;
  fileName: string;
  subfolder?: string;
}) {
  try {
    // Check if Google Drive is connected
    const { data: tokenData } = await supabase
      .from('google_drive_tokens')
      .select('folder_id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (!tokenData?.folder_id) return;

    // Check if sync is enabled for this category
    const isCompanyCategory = category.startsWith('company_');
    
    if (isCompanyCategory) {
      const { data: settings } = await supabase
        .from('google_drive_sync_settings' as any)
        .select('*')
        .eq('company_id', companyId)
        .is('job_id', null)
        .maybeSingle();

      const syncKey = `sync_${category}`;
      if (!settings || !(settings as any)[syncKey]) return;
    } else if (jobId) {
      const { data: settings } = await supabase
        .from('google_drive_sync_settings' as any)
        .select('*')
        .eq('company_id', companyId)
        .eq('job_id', jobId)
        .maybeSingle();

      const syncKey = `sync_${category}`;
      if (!settings || !(settings as any)[syncKey]) return;
    } else {
      // No job ID and not a company category — skip
      return;
    }

    // Resolve actual download URL if it's a storage path
    let resolvedUrl = fileUrl;
    if (!fileUrl.startsWith('http')) {
      // It's a storage path — try to get a public URL or signed URL
      const bucketAndPath = fileUrl.split('/');
      const bucket = bucketAndPath[0];
      const path = bucketAndPath.slice(1).join('/');
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      resolvedUrl = data.publicUrl;
    }

    // Call the sync edge function
    await supabase.functions.invoke('sync-to-google-drive', {
      body: {
        company_id: companyId,
        file_url: resolvedUrl,
        file_name: subfolder ? `${subfolder}/${fileName}` : fileName,
        folder_id: tokenData.folder_id,
      },
    });

    console.log(`[Google Drive Sync] Synced "${fileName}" for category "${category}"`);
  } catch (err) {
    console.error('[Google Drive Sync] Error:', err);
    // Don't throw — sync is best-effort
  }
}
