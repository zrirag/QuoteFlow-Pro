import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CorpCard } from '../components/ui/CorpCard';
import { CorpInput } from '../components/ui/CorpInput';
import { CorpButton } from '../components/ui/CorpButton';
import { useStore } from '../store/useStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const { login } = useStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-corp-bg-sec flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-serif font-bold text-corp-text">QuoteFlow Pro</h2>
        <p className="mt-2 text-sm text-corp-text-sec uppercase tracking-widest">Enterprise Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <CorpCard>
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <CorpInput 
              label="Corporate Email Address" 
              type="email" 
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
            
            <CorpInput 
              label="Password" 
              type="password" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-corp-accent focus:ring-corp-accent border-corp-border rounded-sm"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-corp-text-sec">
                  Remember my device
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-corp-text hover:text-corp-accent underline decoration-corp-border underline-offset-4">
                  Forgot password?
                </a>
              </div>
            </div>

            <CorpButton type="submit" fullWidth>
              Secure Sign In
            </CorpButton>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-corp-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-corp-text-muted">Secure Area</span>
              </div>
            </div>
          </div>
        </CorpCard>
      </div>
    </div>
  );
};
