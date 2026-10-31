import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  KeyRound, 
  LogIn, 
  UserPlus, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Loader2, 
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Info,
  Link,
  Clipboard
} from 'lucide-react';
import { 
  signInWithPassword, 
  signUpWithPassword, 
  signInWithOtp, 
  verifyEmailOtp, 
  signInWithGoogle,
  setSessionFromUrlOrHash
} from '../../services/cloudSimService';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isRequired?: boolean;
  initialError?: string | null;
}

type AuthMode = 'password' | 'otp';
type PasswordSubMode = 'signin' | 'signup';

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isRequired = false,
  initialError = null
}) => {
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [passwordMode, setPasswordMode] = useState<PasswordSubMode>('signin');
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [pastedUrl, setPastedUrl] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showConfigHelp, setShowConfigHelp] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Status states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(initialError);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (initialError) {
      setErrorMsg(initialError);
    }
  }, [initialError]);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-nh7mvrejvbuynyl7p4rqpm-200682910999.us-west1.run.app';
  const wildcardUrl = `${currentOrigin}/**`;
  const runWildcard = 'https://*.run.app/**';
  const gitHubPagesUrl = 'https://sszretter.github.io/SproutAndSporeS2H/';
  const gitHubPagesWildcard = 'https://sszretter.github.io/SproutAndSporeS2H/**';

  const handleCopy = (text: string, key: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const resetForm = () => {
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    resetForm();

    try {
      if (passwordMode === 'signin') {
        const { error } = await signInWithPassword(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          onSuccess();
          onClose();
        }
      } else {
        const { error, needsEmailConfirm } = await signUpWithPassword(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        } else if (needsEmailConfirm) {
          setInfoMsg('Account created! Please check your email to confirm registration, or log in with your credentials.');
          setPasswordMode('signin');
        } else {
          onSuccess();
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    resetForm();

    try {
      const { error } = await signInWithOtp(email.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        setIsOtpSent(true);
        setInfoMsg(`Sent to ${email.trim()}! Check your inbox for the login link or verification code.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch email OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken.trim()) {
      setErrorMsg('Please enter the verification code from your email.');
      return;
    }

    setIsLoading(true);
    resetForm();

    try {
      const { error } = await verifyEmailOtp(email.trim(), otpToken.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteUrlAuth = async (inputUrl: string) => {
    if (!inputUrl.trim()) {
      setErrorMsg('Please paste the URL containing access_token.');
      return;
    }
    setIsLoading(true);
    resetForm();
    try {
      const { user, error } = await setSessionFromUrlOrHash(inputUrl.trim());
      if (error) {
        setErrorMsg(error.message);
      } else if (user) {
        setInfoMsg(`Signed in successfully as ${user.email}!`);
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate from pasted URL.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    resetForm();
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Google OAuth failed to start.');
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto ${isRequired ? 'cursor-default' : ''}`}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-zinc-100 relative my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button (Hidden when sign-in is required) */}
        {!isRequired && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className={`flex items-center gap-3 mb-5 ${!isRequired ? 'pr-8' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            {isRequired ? <Lock className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">
                Sprout &amp; Spore Authentication
              </h2>
              {isRequired && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-semibold flex items-center gap-1">
                  Required
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              {isRequired 
                ? 'Sign-in required to access cultivation controls, environment telemetry, and facility saves' 
                : 'Save and load multiple indoor grow simulations securely in the cloud'}
            </p>
          </div>
        </div>

        {/* Google OAuth Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2.5 transition-all shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-4">
          <div className="border-t border-zinc-800 w-full" />
          <span className="bg-zinc-900 px-3 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            or continue with email
          </span>
        </div>

        {/* Auth Method Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950/70 border border-zinc-800/80 rounded-xl mb-4 text-xs">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); resetForm(); }}
            className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'password'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold">Email &amp; Password</span>
              <span className="text-[9px] text-emerald-400/80">Instant • Zero Setup</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => { setAuthMode('otp'); resetForm(); }}
            className={`py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
              authMode === 'otp'
                ? 'bg-zinc-800 text-emerald-400 shadow-sm border border-zinc-700/60'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-semibold">Email OTP / Link</span>
              <span className="text-[9px] text-zinc-400">Magic Link or Code</span>
            </div>
          </button>
        </div>

        {/* Error / Info Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-medium">{errorMsg}</span>
              {errorMsg.toLowerCase().includes('expired') && (
                <div className="mt-2 pt-2 border-t border-rose-800/40 flex items-center justify-between text-[11px]">
                  <span className="text-rose-300/80">Links expire after a short time or once clicked.</span>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('password'); setErrorMsg(null); }}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Use Password instead ➔
                  </button>
                </div>
              )}
              {errorMsg.toLowerCase().includes('redirect') && (
                <div className="mt-1.5 text-[11px] text-rose-400/90 underline cursor-pointer" onClick={() => setShowConfigHelp(true)}>
                  Click here to view how to whitelist this URL in Supabase
                </div>
              )}
            </div>
          </div>
        )}
        {infoMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-2.5 text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Method 1: Email & Password Form (Zero configuration required!) */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordAuth} className="space-y-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-emerald-300 text-[11px] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>
                <strong>Tip:</strong> Email &amp; Password requires no email templates or redirect URL whitelist in Supabase. You can create an account or sign in right now!
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="grower@facility.com"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={6}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : passwordMode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Log In with Password</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Cloud Account</span>
                </>
              )}
            </button>

            {/* Toggle Sign In / Sign Up */}
            <div className="text-center pt-2">
              {passwordMode === 'signin' ? (
                <p className="text-xs text-zinc-400">
                  Don't have a password set yet?{' '}
                  <button
                    type="button"
                    onClick={() => { setPasswordMode('signup'); resetForm(); }}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Register account here
                  </button>
                </p>
              ) : (
                <p className="text-xs text-zinc-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setPasswordMode('signin'); resetForm(); }}
                    className="text-emerald-400 hover:underline font-semibold"
                  >
                    Log in here
                  </button>
                </p>
              )}
            </div>
          </form>
        )}

        {/* Method 2: Email OTP / Magic Link */}
        {authMode === 'otp' && (
          <div className="space-y-4">
            {/* Quick Helper for Localhost Redirect (Active even if OTP is not sent yet!) */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <Link className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Redirected to localhost:3000? Paste URL here:</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-normal">
                If the email button redirected to <code className="text-amber-200 bg-amber-950/80 px-1 py-0.5 rounded font-mono text-[10px]">http://localhost:3000/#access_token=...</code>, paste that full link below to log in immediately:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pastedUrl}
                  onChange={e => setPastedUrl(e.target.value)}
                  placeholder="Paste http://localhost:3000/#access_token=... here"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => handlePasteUrlAuth(pastedUrl)}
                  disabled={isLoading || !pastedUrl.trim()}
                  className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  <span>Sign In</span>
                </button>
              </div>
            </div>

            {!isOtpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Your Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="grower@facility.com"
                      required
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1.5">
                    Supabase will dispatch a sign-in email. You can click the link to log in directly, or enter the code.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Magic Link / OTP Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Dual verification instructions */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Mail className="w-4 h-4" />
                    <span>Email dispatched to {email}</span>
                  </div>
                  
                  <div className="text-zinc-300 space-y-1.5 text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-emerald-400">Method A:</span>
                      <span>
                        Click the <strong>"Log In"</strong> button in your email. It will authenticate this browser tab automatically!
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-amber-400">Method B:</span>
                      <span>
                        If your email includes a 6-digit verification code, enter it below:
                      </span>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <ShieldCheck className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
                      <input
                        type="text"
                        value={otpToken}
                        onChange={e => setOtpToken(e.target.value)}
                        placeholder="123456"
                        required
                        autoFocus
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono tracking-widest text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify Code &amp; Sign In</span>
                      </>
                    )}
                  </button>

                  <div className="flex justify-between items-center text-[11px] pt-1">
                    <button
                      type="button"
                      onClick={() => { setIsOtpSent(false); resetForm(); }}
                      className="text-zinc-400 hover:text-zinc-200 underline"
                    >
                      Use a different email
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('password'); resetForm(); }}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      Use Email &amp; Password instead
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Supabase Dashboard Configuration Helper Guide */}
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={() => setShowConfigHelp(!showConfigHelp)}
                className="w-full py-2 px-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-950 border border-zinc-800/80 text-left text-xs text-zinc-300 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-medium text-zinc-200">
                    How to configure Supabase so links open your app directly
                  </span>
                </div>
                {showConfigHelp ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </button>

              {showConfigHelp && (
                <div className="mt-2.5 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 space-y-3 animate-in fade-in duration-150">
                  {/* 1. Localhost redirect explanation */}
                  <div>
                    <h4 className="font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px]">1</span>
                      Link redirects to localhost:3000?
                    </h4>
                    <p className="text-zinc-400 leading-relaxed mb-2">
                      New Supabase projects set the default <strong>Site URL</strong> to <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">http://localhost:3000</code>. When an email link is clicked, Supabase redirects to that default unless your app URL is whitelisted.
                    </p>
                    <p className="text-zinc-400 mb-1.5 font-medium">
                      To fix in Supabase Dashboard (takes 30 seconds):
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-zinc-300 pl-1">
                      <li>Go to <strong>Authentication</strong> ➔ <strong>URL Configuration</strong></li>
                      <li>
                        Set <strong>Site URL</strong> or add to <strong>Redirect URLs</strong>:
                      </li>
                    </ol>

                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-850 px-2.5 py-1.5 rounded-lg font-mono text-[10px]">
                        <div className="truncate pr-2">
                          <span className="text-[9px] text-zinc-400 block font-sans">GitHub Pages Production Site:</span>
                          <span className="text-emerald-400">{gitHubPagesUrl}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(gitHubPagesUrl, 'gh_pages')}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 flex items-center gap-1"
                        >
                          {copiedKey === 'gh_pages' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'gh_pages' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-850 px-2.5 py-1.5 rounded-lg font-mono text-[10px]">
                        <div className="truncate pr-2">
                          <span className="text-[9px] text-zinc-400 block font-sans">GitHub Pages Wildcard:</span>
                          <span className="text-zinc-300">{gitHubPagesWildcard}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(gitHubPagesWildcard, 'gh_wildcard')}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 flex items-center gap-1"
                        >
                          {copiedKey === 'gh_wildcard' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'gh_wildcard' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-850 px-2.5 py-1.5 rounded-lg font-mono text-[10px]">
                        <div className="truncate pr-2">
                          <span className="text-[9px] text-zinc-400 block font-sans">AI Studio Cloud Run Preview Wildcard:</span>
                          <span className="text-zinc-300">{runWildcard}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(runWildcard, 'wildcard')}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 shrink-0 flex items-center gap-1"
                        >
                          {copiedKey === 'wildcard' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'wildcard' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. No Code in Email explanation */}
                  <div className="pt-2 border-t border-zinc-850">
                    <h4 className="font-semibold text-emerald-300 mb-1 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">2</span>
                      Why is there no 6-digit code in the email?
                    </h4>
                    <p className="text-zinc-400 leading-relaxed mb-2">
                      Supabase's default <strong>Magic Link</strong> email template only includes the clickable button (<code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">{'{{ .ConfirmationURL }}'}</code>) and omits the code tag by default.
                    </p>
                    <p className="text-zinc-400 mb-1">
                      If you want an actual numeric 6-digit code in the email:
                    </p>
                    <div className="bg-zinc-900 border border-zinc-850 p-2 rounded-lg text-zinc-300 space-y-1">
                      <p>
                        In Supabase Dashboard ➔ <strong>Authentication</strong> ➔ <strong>Email Templates</strong> ➔ <strong>Magic Link</strong>, add:
                      </p>
                      <div className="flex items-center justify-between bg-zinc-950 px-2 py-1 rounded font-mono text-[10px] text-amber-300">
                        <span>{'Your code is: {{ .Token }}'}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy('Your code is: {{ .Token }}', 'token_tag')}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1"
                        >
                          {copiedKey === 'token_tag' ? <Check className="w-2.5 h-2.5 text-emerald-400" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedKey === 'token_tag' ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. Instant alternative */}
                  <div className="pt-2 border-t border-zinc-850 bg-emerald-950/20 -mx-3.5 -mb-3.5 p-3 rounded-b-xl border-emerald-900/30">
                    <p className="text-emerald-300 font-medium">
                      🚀 <strong>Fastest Solution:</strong> Switch to the <strong>Email &amp; Password</strong> tab above to sign up and save your sims right away without having to modify any Supabase settings!
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
