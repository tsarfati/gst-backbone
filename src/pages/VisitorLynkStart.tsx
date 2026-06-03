import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, ClipboardList, MapPinned, QrCode, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import visitorLynkLogo from '@/assets/visitor-lynk-logo.png';
import { setAuthEntryContext } from '@/utils/authEntryContext';

const darkBg = '#0f1419';
const darkCardBg = '#171c28';
const accentGold = '#F5BE18';
const accentBlue = '#16C4FF';

type OnboardingDraft = {
  companyName: string;
  adminName: string;
  email: string;
  jobName: string;
  jobAddress: string;
  visitorVolume: string;
  checkInStyle: string;
  notes: string;
};

const initialDraft: OnboardingDraft = {
  companyName: '',
  adminName: '',
  email: '',
  jobName: '',
  jobAddress: '',
  visitorVolume: '',
  checkInStyle: '',
  notes: '',
};

const steps = [
  { id: 1, title: 'Company', description: 'Who is rolling this out?' },
  { id: 2, title: 'First Site', description: 'Which job gets VisitorLYNK first?' },
  { id: 3, title: 'Check-In Flow', description: 'What should the first rollout look like?' },
];

export default function VisitorLynkStart() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);

  const progressWidth = useMemo(() => `${(step / steps.length) * 100}%`, [step]);

  const updateDraft = (key: keyof OnboardingDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const goNext = () => setStep((prev) => Math.min(prev + 1, steps.length));
  const goBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const continueToAccountSetup = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('visitorlynk_onboarding_draft', JSON.stringify(draft));
    }
    setAuthEntryContext('builder');
    navigate('/auth', { replace: false });
  };

  const canAdvanceStepOne = draft.companyName.trim() && draft.adminName.trim() && draft.email.trim();
  const canAdvanceStepTwo = draft.jobName.trim() && draft.jobAddress.trim();
  const canAdvanceStepThree = draft.visitorVolume && draft.checkInStyle;

  const canAdvance = step === 1 ? canAdvanceStepOne : step === 2 ? canAdvanceStepTwo : canAdvanceStepThree;

  return (
    <div className="min-h-screen" style={{ backgroundColor: darkBg }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="mb-8">
          <Link to="/visitor-lynk" className="inline-flex items-center gap-2 text-white/65 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to VisitorLYNK
          </Link>
        </div>

        <div className="grid xl:grid-cols-[0.95fr_1.05fr] gap-8 xl:gap-12 items-start">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 p-6 sm:p-8" style={{ backgroundColor: darkCardBg }}>
              <img src={visitorLynkLogo} alt="VisitorLYNK" className="w-56 sm:w-72 h-auto drop-shadow-2xl mb-6" />
              <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Start your first Visitor<span style={{ color: accentGold }}>LY</span><span style={{ color: accentBlue }}>NK</span> rollout.
              </h1>
              <p className="mt-5 text-lg text-white/65 leading-relaxed">
                This is the lightweight front door. We’ll keep the experience focused on visitor check-in, but it still creates a real BuilderLYNK company and real job underneath.
              </p>

              <div className="mt-8 grid gap-4">
                {[
                  {
                    icon: Building2,
                    title: 'Restricted account model',
                    description: 'Visitor-only setup first. Full BuilderLYNK modules later.',
                  },
                  {
                    icon: ClipboardList,
                    title: 'Real job-linked visitor logs',
                    description: 'No duplicate data model and no migration mess later.',
                  },
                  {
                    icon: QrCode,
                    title: 'Fast first-use path',
                    description: 'Company, first site, QR poster, and live sign-in flow.',
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start gap-4">
                    <div
                      className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, rgba(245,190,24,0.22), rgba(22,196,255,0.18))' }}
                    >
                      <item.icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-white">{item.title}</div>
                      <div className="text-sm text-white/60 mt-1">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 p-6" style={{ backgroundColor: '#131926' }}>
              <div className="text-sm uppercase tracking-[0.24em] text-white/45 font-bold">What happens next</div>
              <div className="mt-4 grid gap-3">
                {[
                  'We keep the setup focused on visitor check-in and site access.',
                  'Your first job becomes the anchor for QR posters, logs, and reporting.',
                  'When you want more BuilderLYNK modules later, the same account can expand.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-white/75">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: accentGold }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Card className="border-white/10 text-white shadow-2xl" style={{ backgroundColor: darkCardBg }}>
            <CardHeader className="pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl sm:text-3xl">VisitorLYNK Setup</CardTitle>
                  <CardDescription className="text-white/55 mt-2">
                    We’re building the visitor-only onboarding path here first.
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.24em] text-white/40">Step</div>
                  <div className="text-2xl font-black">
                    {step}<span className="text-white/35">/{steps.length}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: progressWidth, background: `linear-gradient(90deg, ${accentGold}, ${accentBlue})` }}
                  />
                </div>
                <div className="mt-4 grid sm:grid-cols-3 gap-3">
                  {steps.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border px-4 py-3 transition-colors ${
                        item.id === step ? 'border-white/20 bg-white/8' : 'border-white/8 bg-white/3'
                      }`}
                    >
                      <div className="text-xs uppercase tracking-[0.2em] text-white/40">{item.title}</div>
                      <div className="text-sm text-white/75 mt-1">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {step === 1 && (
                <div className="grid gap-5">
                  <div>
                    <Label htmlFor="companyName" className="text-white/80">Company Name</Label>
                    <Input
                      id="companyName"
                      value={draft.companyName}
                      onChange={(e) => updateDraft('companyName', e.target.value)}
                      placeholder="Sigma Construction"
                      className="mt-2 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminName" className="text-white/80">Primary Contact</Label>
                    <Input
                      id="adminName"
                      value={draft.adminName}
                      onChange={(e) => updateDraft('adminName', e.target.value)}
                      placeholder="Mike Sarfati"
                      className="mt-2 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-white/80">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={draft.email}
                      onChange={(e) => updateDraft('email', e.target.value)}
                      placeholder="you@company.com"
                      className="mt-2 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <div>
                    <Label htmlFor="jobName" className="text-white/80">First Job / Site Name</Label>
                    <Input
                      id="jobName"
                      value={draft.jobName}
                      onChange={(e) => updateDraft('jobName', e.target.value)}
                      placeholder="4700 Spruce"
                      className="mt-2 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jobAddress" className="text-white/80">Site Address</Label>
                    <Input
                      id="jobAddress"
                      value={draft.jobAddress}
                      onChange={(e) => updateDraft('jobAddress', e.target.value)}
                      placeholder="4700 Spruce Street, Philadelphia, PA"
                      className="mt-2 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-start gap-4">
                    <MapPinned className="h-5 w-5 mt-1 shrink-0" style={{ color: accentBlue }} />
                    <div className="text-sm text-white/65">
                      This will become the first live BuilderLYNK job behind VisitorLYNK. That’s what keeps visitor logs tied to a real project from day one.
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="grid gap-5">
                  <div>
                    <Label className="text-white/80">Visitor Volume</Label>
                    <Select value={draft.visitorVolume} onValueChange={(value) => updateDraft('visitorVolume', value)}>
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Choose expected volume" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light traffic</SelectItem>
                        <SelectItem value="moderate">Moderate traffic</SelectItem>
                        <SelectItem value="heavy">Heavy daily traffic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-white/80">Preferred Check-In Style</Label>
                    <Select value={draft.checkInStyle} onValueChange={(value) => updateDraft('checkInStyle', value)}>
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Choose how guests will check in" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qr-only">QR poster only</SelectItem>
                        <SelectItem value="qr-plus-photo">QR poster + required photo</SelectItem>
                        <SelectItem value="assisted">Assisted check-in by staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-white/80">Notes</Label>
                    <Textarea
                      id="notes"
                      value={draft.notes}
                      onChange={(e) => updateDraft('notes', e.target.value)}
                      placeholder="Any special compliance or gate requirements?"
                      className="mt-2 bg-white/5 border-white/10 text-white min-h-28"
                    />
                  </div>

                  <div className="rounded-2xl border border-white/10 p-5" style={{ background: 'linear-gradient(135deg, rgba(245,190,24,0.08), rgba(22,196,255,0.08))' }}>
                    <div className="text-sm uppercase tracking-[0.2em] text-white/45 font-bold">Next branch milestone</div>
                    <div className="mt-2 text-white/75 leading-relaxed">
                      After account creation, the next step on this branch is trimming the post-login app shell so VisitorLYNK users only see jobs, visitor setup, QR posters, and visitor logs.
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-between gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={step === 1 ? () => navigate('/visitor-lynk') : goBack}
                  className="border-white/15 bg-white/5 text-white hover:bg-white/10"
                >
                  {step === 1 ? 'Back' : 'Previous'}
                </Button>

                {step < steps.length ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className="text-[#081015] font-bold"
                    style={{ backgroundColor: accentGold }}
                  >
                    Next Step
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={continueToAccountSetup}
                    disabled={!canAdvance}
                    className="text-[#081015] font-bold"
                    style={{ background: `linear-gradient(90deg, ${accentGold}, ${accentBlue})` }}
                  >
                    Continue to Account Setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
