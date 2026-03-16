import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { generateKeyPair, exportPublicKey } from "../utils/crypto";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [view, setView] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      if (view === 'forgot_password') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("Password reset link sent to your email!");
      } else if (view === 'signup') {
        if (!username) {
          setError("Username is required for signup");
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (data.user) {
          // Generate E2EE keys
          const keyPair = await generateKeyPair();
          const publicKey = await exportPublicKey(keyPair.publicKey);
          
          // Store private key (PROTOTYPE: Use IndexedDB for production)
          const privateKeyExported = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
          localStorage.setItem(`private_key_${data.user.id}`, btoa(String.fromCharCode(...new Uint8Array(privateKeyExported))));
          
          // Store public key in profiles table
          await supabase.from("profiles").upsert({ id: data.user.id, public_key: publicKey });
          
          navigate("/");
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        if (data.user) {
          navigate("/");
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-30px)] bg-[#f6f6ef]">
      <div className="bg-white p-6 border border-[#828282] max-w-sm w-full">
        <h2 className="text-lg font-bold mb-4 text-[#ff6600]">
          {view === 'signup' ? "Create Account" : view === 'forgot_password' ? "Reset Password" : "Login"}
        </h2>
        {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
        {message && <div className="text-green-600 mb-4 text-sm">{message}</div>}
        <form onSubmit={handleAuth} className="flex flex-col gap-3">
          {view === 'signup' && (
            <div className="flex flex-col">
              <label className="text-[#828282] text-[10pt] font-bold mb-1">Username</label>
              <input
                type="text"
                className="border border-[#828282] p-1 text-[10pt]"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={view === 'signup'}
              />
            </div>
          )}
          <div className="flex flex-col">
            <label className="text-[#828282] text-[10pt] font-bold mb-1">Email</label>
            <input
              type="email"
              className="border border-[#828282] p-1 text-[10pt]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {view !== 'forgot_password' && (
            <div className="flex flex-col">
              <label className="text-[#828282] text-[10pt] font-bold mb-1">Password</label>
              <input
                type="password"
                className="border border-[#828282] p-1 text-[10pt]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          )}
          <button
            type="submit"
            className="bg-[#d4d4d4] border border-[#828282] px-2 py-1 text-[10pt] text-black hover:bg-[#c4c4c4] mt-2"
          >
            {view === 'signup' ? "Sign Up" : view === 'forgot_password' ? "Send Reset Email" : "Login"}
          </button>
        </form>
        <div className="mt-4 text-[10pt] text-center flex flex-col gap-2">
          {view === 'login' && (
            <button
              onClick={() => setView('forgot_password')}
              className="text-[#828282] hover:underline"
            >
              Forgot your password?
            </button>
          )}
          <button
            onClick={() => setView(view === 'signup' ? 'login' : 'signup')}
            className="text-[#828282] hover:underline"
          >
            {view === 'signup' ? "Already have an account? Login" : "Need an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}
