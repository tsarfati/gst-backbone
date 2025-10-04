import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { encryptJson, decryptJson } from '@/utils/crypto';
import { Lock, Unlock, Plus, Save, Eye } from 'lucide-react';

interface VaultEntry {
  id: string;
  title: string;
  username?: string | null;
  url?: string | null;
  data_ciphertext: string;
  notes_ciphertext?: string | null;
  iv: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export default function CompanyVault() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const { toast } = useToast();

  const [passphrase, setPassphrase] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<VaultEntry[]>([]);

  // New entry form
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');

  const canSave = useMemo(() => unlocked && title.trim().length > 0, [unlocked, title]);

  const unlock = async () => {
    if (!passphrase) {
      toast({ title: 'Passphrase required', description: 'Enter your company vault passphrase to unlock.', variant: 'destructive' });
      return;
    }
    
    setLoading(true);
    try {
      // Fetch one entry to validate passphrase
      const { data: testEntries, error } = await supabase
        .from('vault_entries')
        .select('*')
        .eq('company_id', currentCompany?.id)
        .limit(1);
      
      if (error) throw error;
      
      // If entries exist, validate passphrase by trying to decrypt one
      if (testEntries && testEntries.length > 0) {
        const testEntry = testEntries[0];
        try {
          await decryptJson(testEntry.data_ciphertext, testEntry.iv, testEntry.salt, passphrase);
        } catch {
          toast({ 
            title: 'Incorrect passphrase', 
            description: 'The passphrase you entered is incorrect.', 
            variant: 'destructive' 
          });
          setLoading(false);
          return;
        }
      }
      
      // Passphrase is valid (or no entries to check)
      setUnlocked(true);
      await loadEntries();
    } catch (e: any) {
      toast({ 
        title: 'Error', 
        description: e.message || 'Failed to unlock vault', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('vault_entries')
        .select('*')
        .eq('company_id', currentCompany.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setEntries(data as any);
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load vault entries', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentCompany?.id || !user) return;
    try {
      setLoading(true);
      const payload = { password, notes };
      const enc = await encryptJson(payload, passphrase);
      const { error } = await supabase.from('vault_entries').insert({
        company_id: currentCompany.id,
        created_by: user.id,
        title: title.trim(),
        username: username || null,
        url: url || null,
        data_ciphertext: enc.ciphertext,
        notes_ciphertext: null,
        iv: enc.iv,
        salt: enc.salt,
        algo: enc.algo,
      });
      if (error) throw error;
      toast({ title: 'Saved', description: 'Entry stored securely.' });
      setTitle(''); setUrl(''); setUsername(''); setPassword(''); setNotes('');
      await loadEntries();
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to save entry', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleView = async (entry: VaultEntry) => {
    try {
      const data: any = await decryptJson(entry.data_ciphertext, entry.iv, entry.salt, passphrase);
      const msg = `URL: ${entry.url || '-'}\nUsername: ${entry.username || '-'}\nPassword: ${data.password || '-'}\nNotes: ${data.notes || '-'}`;
      toast({ title: entry.title, description: msg });
    } catch {
      toast({ title: 'Decryption failed', description: 'Invalid passphrase or corrupted data', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Lock className="h-6 w-6" /> Vault
          </h1>
          <p className="text-muted-foreground">Encrypted storage for credentials and sensitive notes (admins/controllers only)</p>
        </div>
      </div>

      {!unlocked ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Unlock className="h-4 w-4" /> Unlock Vault</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input type="password" placeholder="Enter passphrase" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            <Button onClick={unlock}>Unlock</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add Entry</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Title (e.g., Bank Portal)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input placeholder="URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Input placeholder="Username (optional)" value={username} onChange={(e) => setUsername(e.target.value)} />
              <Input placeholder="Password (encrypted)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="md:col-span-2">
                <Textarea placeholder="Notes (encrypted)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={handleSave} disabled={!canSave || loading}>
                  <Save className="h-4 w-4 mr-2" /> Save Securely
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No entries yet.</TableCell>
                      </TableRow>
                    ) : entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.title}</TableCell>
                        <TableCell>{e.url || '-'}</TableCell>
                        <TableCell>{e.username || '-'}</TableCell>
                        <TableCell>{new Date(e.updated_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => handleView(e)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
