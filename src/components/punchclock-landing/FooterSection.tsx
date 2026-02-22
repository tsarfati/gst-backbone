import { Link } from 'react-router-dom';
import builderlynkIcon from '@/assets/builderlynk-hero-logo-new.png';

export function FooterSection() {
  return (
    <footer style={{ backgroundColor: '#1a1f2e' }} className="text-white py-16">
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
              <li><Link to="/" className="hover:text-white transition-colors">Features</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4 text-lg">Company</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/" className="hover:text-white transition-colors">About</Link></li>
              <li><a href="mailto:support@builderlynk.com" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4 text-lg">LYNK Family</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/punch-clock-lynk" className="hover:text-white transition-colors text-[#E88A2D]">Punch Clock LYNK</Link></li>
              <li><Link to="/pm-lynk" className="hover:text-white transition-colors">PM LYNK</Link></li>
              <li><a href="https://jobsitelynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">JobSiteLYNK</a></li>
              <li><a href="https://residentlynk.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">ResidentLYNK</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4 text-lg">Legal</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} BuilderLYNK. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
