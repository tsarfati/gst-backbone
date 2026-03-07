import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Phone } from 'lucide-react';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

export default function ContactPage() {
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);
  const { toast } = useToast();

  const darkBg = '#0f1419';
  const darkCardBg = '#1a1f2e';
  const supportEmail = 'support@builderlink.com';

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, []);

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const handleSubmitContact = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Please complete all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSendingContact(true);
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h2 style="margin: 0 0 16px;">BuilderLYNK Website Contact Form</h2>
          <p style="margin: 0 0 8px;"><strong>Name:</strong> ${escapeHtml(contactName.trim())}</p>
          <p style="margin: 0 0 8px;"><strong>Email:</strong> ${escapeHtml(contactEmail.trim())}</p>
          <p style="margin: 16px 0 8px;"><strong>Message:</strong></p>
          <div style="white-space: pre-wrap; line-height: 1.5; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px;">
            ${escapeHtml(contactMessage.trim())}
          </div>
        </div>
      `;

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: supportEmail,
          subject: `Website Contact Form: ${contactName.trim()}`,
          html,
        },
      });
      if (error) throw error;

      toast({
        title: 'Message sent',
        description: "Thanks. We'll get back to you soon.",
      });
      setContactName('');
      setContactEmail('');
      setContactMessage('');
    } catch (error: any) {
      toast({
        title: 'Could not send message',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSendingContact(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: darkBg }}>
      <nav className="border-b border-white/10" style={{ backgroundColor: 'rgba(15, 20, 25, 0.95)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <img src={builderlynkIcon} alt="BuilderLYNK" className="h-14 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/#features" className="text-white/80 hover:text-white transition-colors font-medium">Features</Link>
              <Link to="/#about" className="text-white/80 hover:text-white transition-colors font-medium">About</Link>
              <Link to="/punch-clock-lynk" className="text-white/80 hover:text-white transition-colors font-medium">Punch Clock Lynk</Link>
              <Link to="/pm-lynk" className="text-white/80 hover:text-white transition-colors font-medium">PM Lynk</Link>
              <Link to="/contact" className="text-white font-medium">Contact</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button
                  variant="outline"
                  className="border-white/50 text-gray-900 bg-white hover:bg-white/90"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-10 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 max-w-6xl mx-auto">
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Get in <span className="text-[#E88A2D]">Touch</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-5xl mx-auto">
              Have questions? We&apos;re here to help you find the right solution for your business.
            </p>
          </div>

          <div
            className="max-w-3xl mx-auto rounded-2xl border border-white/10 p-6 sm:p-8"
            style={{ backgroundColor: darkCardBg }}
          >
            <form onSubmit={handleSubmitContact} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="text-white">Name</Label>
                  <Input
                    id="contact-name"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your name"
                    className="bg-background/60 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-white">Email</Label>
                  <Input
                    id="contact-email"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="bg-background/60 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message" className="text-white">Message</Label>
                <Textarea
                  id="contact-message"
                  required
                  rows={8}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can we help?"
                  className="bg-background/60 border-white/20 text-white placeholder:text-gray-500 resize-none"
                />
              </div>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={sendingContact}
                  className="bg-[#E88A2D] hover:bg-[#d67a20] text-white"
                >
                  {sendingContact ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </div>

          <div className="max-w-3xl mx-auto mt-8 text-center">
            <p className="text-gray-400 text-lg sm:text-xl mb-3">or</p>
            <p className="w-full text-center text-2xl sm:text-3xl font-bold text-white inline-flex items-center justify-center gap-3">
              <Phone className="h-7 w-7 text-[#E88A2D]" />
              Call us: (267) 625-4866
            </p>
          </div>
        </div>
      </section>

      <footer style={{ backgroundColor: darkCardBg }} className="text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 lg:gap-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <img src={builderlynkIcon} alt="BuilderLYNK" className="h-12 w-auto" />
                <span className="text-xl font-bold text-white">BuilderLYNK</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                The complete construction management platform for modern builders.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/#about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">LYNK Family</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link to="/punch-clock-lynk" className="hover:text-white transition-colors">Punch Clock LYNK</Link></li>
                <li><Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link></li>
                <li><a href="https://jobsitelynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">JobSiteLYNK</a></li>
                <li><a href="https://residentlynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ResidentLYNK</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
