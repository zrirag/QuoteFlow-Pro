import React, { useState } from 'react';
import { TopNavigation } from '../components/layout/TopNavigation';
import { CorpCard } from '../components/ui/CorpCard';
import { CorpInput } from '../components/ui/CorpInput';
import { CorpButton } from '../components/ui/CorpButton';
import { Badge } from '../components/ui/Badge';
import { Check, Folder, RefreshCw } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect } from 'react';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('drive');
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error'>('synced');
  
  const getDriveStatus = useStore((state) => state.getDriveStatus);
  const connectGoogleDrive = useStore((state) => state.connectGoogleDrive);
  const disconnectDrive = useStore((state) => state.disconnectDrive);

  useEffect(() => {
    getDriveStatus().then((status) => setIsConnected(status.connected));
  }, [getDriveStatus]);

  const handleConnect = async () => {
    if (isConnected) {
      await disconnectDrive();
      setIsConnected(false);
    } else {
      await connectGoogleDrive();
    }
  };

  return (
    <div className="min-h-screen bg-corp-bg flex flex-col font-sans">
      <TopNavigation />
      
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-10 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex-shrink-0">
          <h2 className="text-xl font-serif font-semibold text-corp-text mb-6">Settings</h2>
          <nav className="space-y-1">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-full text-left px-4 py-2 text-sm font-medium border-l-2 transition-colors ${activeTab === 'profile' ? 'border-corp-accent text-corp-text bg-corp-bg-sec' : 'border-transparent text-corp-text-sec hover:text-corp-text hover:bg-[#F9F9F9]'}`}
            >
              Corporate Profile
            </button>
            <button 
              onClick={() => setActiveTab('drive')}
              className={`w-full text-left px-4 py-2 text-sm font-medium border-l-2 transition-colors ${activeTab === 'drive' ? 'border-corp-accent text-corp-text bg-corp-bg-sec' : 'border-transparent text-corp-text-sec hover:text-corp-text hover:bg-[#F9F9F9]'}`}
            >
              Integrations (Google Drive)
            </button>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 max-w-3xl">
          {activeTab === 'profile' && (
            <CorpCard title="Corporate Profile">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <CorpInput label="Company Name" defaultValue="QuoteFlow Pro" />
                  <CorpInput label="Registration Number" defaultValue="123-456-789" />
                </div>
                <CorpInput label="Headquarters Address" defaultValue="123 Corporate Blvd, Suite 400, New York, NY 10001" />
                
                <div className="pt-4 border-t border-corp-border flex justify-end">
                  <CorpButton>Save Changes</CorpButton>
                </div>
              </div>
            </CorpCard>
          )}

          {activeTab === 'drive' && (
            <CorpCard title="Google Drive Integration">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-6 border-b border-gray-100">
                  <div>
                    <h4 className="font-medium text-corp-text flex items-center gap-2">
                      Google Drive Backup
                      {isConnected && <Badge variant="success">Connected</Badge>}
                    </h4>
                    <p className="text-sm text-corp-text-sec mt-1">Automatically sync all generated PDF quotations to your corporate Google Drive.</p>
                  </div>
                  <CorpButton 
                    variant={isConnected ? 'secondary' : 'primary'}
                    onClick={handleConnect}
                  >
                    {isConnected ? 'Disconnect Drive' : 'Connect Drive'}
                  </CorpButton>
                </div>

                {isConnected && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-gray-100">
                      <div>
                        <label className="block text-xs font-semibold text-corp-text-sec uppercase tracking-wider mb-2">Export Destination Folder</label>
                        <div className="flex items-center gap-3 p-3 border border-gray-200 bg-gray-50 rounded text-sm">
                          <Folder className="w-5 h-5 text-blue-500" />
                          <span className="flex-1 font-medium text-gray-800 truncate">/Corporate/Quotations/2026</span>
                          <button className="text-blue-600 font-medium hover:text-blue-800">Change</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-corp-text-sec uppercase tracking-wider mb-2">Sync Status</label>
                        <div className="flex items-center gap-3 p-3 border border-gray-200 bg-gray-50 rounded text-sm">
                          {syncStatus === 'synced' ? (
                            <>
                              <Check className="w-5 h-5 text-green-500" />
                              <span className="flex-1 text-gray-600">Up to date (Last sync: Just now)</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                              <span className="flex-1 text-gray-600">Syncing...</span>
                            </>
                          )}
                          <button 
                            className="text-gray-500 hover:text-gray-800"
                            onClick={() => {
                              setSyncStatus('syncing');
                              setTimeout(() => setSyncStatus('synced'), 2000);
                            }}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-corp-text mb-3">Sync Options</h4>
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black" defaultChecked />
                          <span className="text-sm text-gray-700">Sync Approved Quotations automatically</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black" defaultChecked />
                          <span className="text-sm text-gray-700">Include signature page in export</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black" />
                          <span className="text-sm text-gray-700">Add "DRAFT" watermark to pending quotes</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CorpCard>
          )}
        </div>

      </main>
    </div>
  );
};
