import { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

export default function LoginPage() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError("Enter a valid email and password (min. 6 characters).");
      return;
    }
    setError("");
    try {
      const user = await login({ email: email.trim(), password });
      navigate(user?.onboardingCompleted ? "/dashboard" : "/onboarding/platforms");
    } catch (apiError) {
      setError(apiError?.message || "Unable to sign in.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-400" />
          <div>
            <h1 className="text-2xl font-bold">ProBlogBooster</h1>
            <p className="text-sm text-slate-500">Sign in to your workspace</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button className="w-full rounded-md bg-brand-500 py-2 font-semibold text-white hover:bg-brand-600">Sign in</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          New here?{" "}
          <Link className="font-semibold text-brand-500 hover:text-brand-600" to="/signup">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
