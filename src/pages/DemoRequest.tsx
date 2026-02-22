import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import punchClockLynkLogo from '@/assets/punchclock-lynk-logo.png';

export default function DemoRequest() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    number_of_users: '',
    industry: '',
    details: '',
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('demo_requests').insert({
        first_name: form.first_name,
        last_name: form.last_name,
        company_name: form.company_name,
        email: form.email,
        phone: form.phone || null,
        number_of_users: form.number_of_users || null,
        industry: form.industry || null,
        details: form.details || null,
        product: 'punch-clock-lynk',
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0f1419' }}>
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-[#E88A2D] mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-white mb-3">You're all set!</h1>
          <p className="text-gray-400 mb-8">
            We'll reach out within one business day to schedule your personalized tour.
          </p>
          <Link
            to="/punch-clock-lynk"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition-all hover:brightness-110"
            style={{ backgroundColor: '#E88A2D' }}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Punch Clock LYNK
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0f1419' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left — copy */}
          <div className="lg:sticky lg:top-24">
            <Link
              to="/punch-clock-lynk"
              className="inline-flex items-center gap-2 text-white/40 text-sm hover:text-white/60 transition-colors mb-10"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>

            <div className="flex items-center gap-4 mb-8">
              <img
                src={punchClockLynkLogo}
                alt="Punch Clock LYNK"
                className="h-16 w-16 rounded-xl shadow-lg shadow-[#E88A2D]/15"
              />
              <span className="text-white/80 text-lg font-semibold">Punch Clock LYNK</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight mb-4">
              See Punch Clock LYNK{' '}
              <span className="text-[#E88A2D]">in action.</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-10 max-w-md">
              Schedule a personalized tour and see how GPS tracking, AI photo verification, and job costing can work for your crew.
            </p>

            <div className="space-y-4">
              {[
                'Live walkthrough tailored to your business',
                'See GPS, AI presence, and job costing features',
                'Get pricing for your team size',
                'No commitment — just a conversation',
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E88A2D] flex-shrink-0" />
                  <span className="text-gray-300 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — form */}
          <div>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-white/[0.06] p-6 sm:p-8 space-y-5"
              style={{ backgroundColor: '#151a24' }}
            >
              <h2 className="text-xl font-bold text-white mb-1">Book a Demo</h2>
              <p className="text-gray-400 text-sm mb-4">Takes less than a minute.</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">First Name *</label>
                  <input
                    required
                    value={form.first_name}
                    onChange={(e) => update('first_name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Last Name *</label>
                  <input
                    required
                    value={form.last_name}
                    onChange={(e) => update('last_name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Company Name *</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Number of Users</label>
                  <select
                    value={form.number_of_users}
                    onChange={(e) => update('number_of_users', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  >
                    <option value="" className="bg-[#151a24]">Select</option>
                    <option value="1-5" className="bg-[#151a24]">1–5</option>
                    <option value="6-10" className="bg-[#151a24]">6–10</option>
                    <option value="11-29" className="bg-[#151a24]">11–29</option>
                    <option value="30-50" className="bg-[#151a24]">30–50</option>
                    <option value="51-99" className="bg-[#151a24]">51–99</option>
                    <option value="100-300" className="bg-[#151a24]">100–300</option>
                    <option value="300+" className="bg-[#151a24]">300+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Industry</label>
                  <select
                    value={form.industry}
                    onChange={(e) => update('industry', e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                  >
                    <option value="" className="bg-[#151a24]">Select</option>
                    <option value="Construction" className="bg-[#151a24]">Construction</option>
                    <option value="Cleaning Services" className="bg-[#151a24]">Cleaning Services</option>
                    <option value="Landscaping" className="bg-[#151a24]">Landscaping</option>
                    <option value="Electrical" className="bg-[#151a24]">Electrical</option>
                    <option value="Plumbing" className="bg-[#151a24]">Plumbing</option>
                    <option value="HVAC" className="bg-[#151a24]">HVAC</option>
                    <option value="Roofing" className="bg-[#151a24]">Roofing</option>
                    <option value="Manufacturing" className="bg-[#151a24]">Manufacturing</option>
                    <option value="Real Estate" className="bg-[#151a24]">Real Estate</option>
                    <option value="Other" className="bg-[#151a24]">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Anything else we should know?</label>
                <textarea
                  value={form.details}
                  onChange={(e) => update('details', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-white/10 bg-white/[0.04] text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#E88A2D]/50 transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: '#E88A2D' }}
              >
                {loading ? 'Submitting...' : 'Book a Demo'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
