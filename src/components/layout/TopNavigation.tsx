import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, User } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Badge } from '../ui/Badge';
import { formatDistanceToNow } from 'date-fns';

export const TopNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, notifications, markNotificationAsRead } = useStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Quotations', path: '/quotations' },
    { label: 'Builder', path: '/builder' },
    { label: 'Settings', path: '/settings' },
  ];

  if (currentUser?.role === 'Admin' || currentUser?.role === 'HR') {
    navItems.splice(3, 0, { label: 'Admin', path: '/admin' });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-white border-b border-corp-border sticky top-0 z-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Left Section: Logo & Nav Links */}
        <div className="flex items-center space-x-8 lg:space-x-12">
          {/* Logo */}
          <div 
            className="font-serif font-bold text-xl text-corp-text cursor-pointer tracking-tight"
            onClick={() => navigate('/')}
          >
            QuoteFlow <span className="font-light text-corp-text-sec">Pro</span>
          </div>

          {/* Nav Links */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`px-3 lg:px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  location.pathname === item.path || (item.path === '/builder' && location.pathname.startsWith('/builder'))
                    ? 'border-corp-accent text-corp-text'
                    : 'border-transparent text-corp-text-sec hover:text-corp-text'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Section: Search & Icons */}
        <div className="flex items-center space-x-4 lg:space-x-6">
          <div className="hidden lg:flex items-center relative">
            <Search className="w-4 h-4 text-corp-text-muted absolute left-3" />
            <input 
              type="text" 
              placeholder="Search quotes, clients..." 
              className="pl-9 pr-4 py-1.5 text-sm bg-corp-bg-sec border border-transparent focus:bg-white focus:border-corp-border focus:outline-none transition-colors w-64"
            />
          </div>
          
          <div className="relative" ref={dropdownRef}>
            <button 
              className="text-corp-text-sec hover:text-corp-text transition-colors relative mt-1"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-200 shadow-xl rounded-sm overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-800">Notifications</h3>
                  {unreadCount > 0 && <Badge variant="neutral">{unreadCount} New</Badge>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500 text-center">No notifications</div>
                  ) : (
                    notifications.map(notif => (
                      <div 
                        key={notif.id} 
                        className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-blue-50/30' : ''}`}
                        onClick={() => markNotificationAsRead(notif.id)}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-sm font-medium ${!notif.read ? 'text-black' : 'text-gray-700'}`}>{notif.title}</p>
                          {!notif.read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{notif.message}</p>
                        <p className="text-[10px] text-gray-400 font-medium">
                          {formatDistanceToNow(new Date(notif.date), { addSuffix: true })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 border-l border-gray-200 pl-4 lg:pl-6 ml-2 relative" ref={profileRef}>
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-corp-text">{currentUser?.name}</p>
              <p className="text-xs text-corp-text-sec">{currentUser?.role}</p>
            </div>
            <button 
              className="flex items-center justify-center w-8 h-8 bg-corp-bg-sec rounded-full text-corp-text-sec hover:text-corp-text hover:bg-gray-100 transition-colors shrink-0 border border-gray-200"
              title="Profile Options"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <User className="w-4 h-4" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 top-10 mt-2 w-48 bg-white border border-gray-200 shadow-xl rounded-sm overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-left">
                  <p className="text-xs text-gray-500 font-medium">Logged in as</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{currentUser?.name}</p>
                </div>
                <div className="py-1">
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  >
                    Account Settings
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      useStore.getState().logout();
                      navigate('/login');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-semibold transition-colors border-t border-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </nav>
  );
};
