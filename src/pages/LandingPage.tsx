import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthModal } from '@/components/AuthModal';
import { TenantRequestModal } from '@/components/TenantRequestModal';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import {
  Building2,
  Shield,
  Users,
  BarChart3,
  Clock,
  FileText,
  CheckCircle,
  ArrowRight,
  Mail,
  Phone
} from 'lucide-react';

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showTenantRequestModal, setShowTenantRequestModal] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is authenticated, don't render (will redirect)
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    {
      icon: Building2,
      title: 'Multi-Company Management',
      description: 'Manage multiple construction companies from a single platform with complete data isolation.'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level security with role-based access control and audit trails for every action.'
    },
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Seamlessly collaborate with your team with real-time updates and notifications.'
    },
    {
      icon: BarChart3,
      title: 'Financial Insights',
      description: 'Comprehensive reporting and analytics to track project costs and profitability.'
    },
    {
      icon: Clock,
      title: 'Time Tracking',
      description: 'GPS-enabled punch clock with photo verification for accurate time tracking.'
    },
    {
      icon: FileText,
      title: 'Document Management',
      description: 'Centralized document storage with version control and easy sharing capabilities.'
    }
  ];

  const benefits = [
    'Streamline payables and receivables',
    'Real-time job cost tracking & budget monitoring',
    'Manage subcontracts and purchase orders',
    'Generate professional invoices',
    'Comprehensive audit trails',
    'Mobile-ready for field teams'
  ];

  const coreCapabilities = [
    {
      title: 'Precision Job Costing',
      description: 'Track every dollar across projects with detailed cost code breakdowns. Know exactly where your money goes and keep projects profitable.'
    },
    {
      title: 'Smart Receipt Management',
      description: 'Capture, organize, and code receipts instantly. Turn chaos into clarity with automated receipt processing and categorization.'
    },
    {
      title: 'Streamlined Receipt Coding',
      description: 'Project managers can route purchase receipts directly to job costing with a few clicks. Coding requests flow seamlessly through approval workflows.'
    },
    {
      title: 'Job Cost Accounting Integration',
      description: 'Built around construction-specific accounting principles. Every coding request ties directly to your job cost structure for accurate financial reporting.'
    },
    {
      title: 'Vendor Portal & AIA Billing',
      description: 'Empower vendors to submit AIA-formatted invoices with detailed payment breakdowns. Custom invoice structures that match your company requirements.'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-primary" />
              <span className="text-xl font-bold text-foreground">Builder Backbone</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">About</a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a>
            </div>
            <Button onClick={() => setShowAuthModal(true)} variant="outline">
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            The Backbone of Your
            <span className="text-primary block mt-2">Construction Business</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
            Powerful construction management software that helps you track costs, manage teams, 
            and grow your business. Everything you need in one platform.
          </p>
          <div className="flex justify-center">
            <Button 
              size="lg" 
              onClick={() => setShowTenantRequestModal(true)}
              className="text-lg px-8 py-6"
            >
              Create Your Organization
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tools designed specifically for construction companies
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-card p-6 rounded-lg border border-border hover-lift"
              >
                <feature.icon className="h-12 w-12 text-primary mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">
                Built for Builders, By Builders
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Builder Backbone was created by construction professionals who understand 
                the unique challenges of managing construction projects. We've built a platform 
                that simplifies the complex workflows of construction management.
              </p>
              <p className="text-lg text-muted-foreground mb-8">
                From small contractors to large construction firms, our platform scales with 
                your business and adapts to your specific needs.
              </p>
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl p-8 lg:p-12">
              <div className="text-center">
                <div className="text-6xl font-bold text-primary mb-2">100%</div>
                <p className="text-xl text-foreground mb-6">Cloud-Based Platform</p>
                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div>
                    <div className="text-3xl font-bold text-foreground">24/7</div>
                    <p className="text-muted-foreground">Access Anywhere</p>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-foreground">99.9%</div>
                    <p className="text-muted-foreground">Uptime SLA</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Capabilities */}
          <div className="mt-16">
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground text-center mb-12">
              Core Capabilities That Drive Results
            </h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {coreCapabilities.map((capability, index) => (
                <div 
                  key={index}
                  className="bg-card border border-border rounded-xl p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{capability.title}</h4>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8">
            Join construction companies already using Builder Backbone to streamline their operations.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => setShowTenantRequestModal(true)}
            className="text-lg px-8 py-6"
          >
            Get Started Today
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Have questions? We're here to help you find the right solution for your business.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Email Us</h3>
              <p className="text-muted-foreground">support@builderbackbone.com</p>
            </div>
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Call Us</h3>
              <p className="text-muted-foreground">(555) 123-4567</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/50 border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-bold text-foreground">Builder Backbone</span>
              </div>
              <p className="text-muted-foreground text-sm">
                The complete construction management platform for modern builders.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#about" className="hover:text-foreground transition-colors">About</a></li>
                <li><a href="#contact" className="hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Builder Backbone. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      <TenantRequestModal open={showTenantRequestModal} onOpenChange={setShowTenantRequestModal} />
    </div>
  );
}
