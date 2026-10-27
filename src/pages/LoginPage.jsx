import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser, loginUser } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await registerUser({ username: form.email, password: form.password, email: form.email, name: form.name });
      }
      const res = await loginUser({ username: form.email, password: form.password });
      localStorage.setItem('auth_token', res.token);
      window.dispatchEvent(new Event('pose-auth-change'));
      navigate('/profile');
    } catch (err) {
      setError(err?.message || 'Sign in failed. Check your email and password.');
    }
  }

  return (
    <div className="neo-page login-page">
      <form onSubmit={handleSubmit} className="neo-card login-card">
        <div className="login-mark">PC</div>
        <p className="eyebrow">YOUR MOVEMENT STUDIO</p>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="login-subtitle">Save your training sessions and see how your movement changes over time.</p>
        {isRegister && (
          <label className="text-sm block">
          <div className="mb-1 text-neutral-300">Name</div>
            <input name="name" value={form.name} onChange={handleChange} className="neo-input" autoComplete="name" />
          </label>
        )}
        <label className="text-sm block">
          <div className="mb-1 text-neutral-300">Email</div>
          <input type="email" name="email" value={form.email} onChange={handleChange} className="neo-input" autoComplete="email" required />
        </label>
        <label className="text-sm block">
          <div className="mb-1 text-neutral-300">Password</div>
          <input type="password" name="password" value={form.password} onChange={handleChange} className="neo-input" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="neo-button neo-button-lime login-submit">{isRegister ? 'Create account' : 'Sign in'} <span>↗</span></button>
        <div className="login-switch">
          {isRegister ? 'Already have an account?' : "Don't have an account?"} {' '}
          <button type="button" onClick={() => { setError(''); setIsRegister(v => !v); }}>
            {isRegister ? 'Login' : 'Register'}
          </button>
        </div>
        <div className="text-center">
          <Link className="login-guest" to="/">Back to home</Link>
        </div>
      </form>
    </div>
  );
}


