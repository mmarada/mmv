import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password updated successfully!");
      setTimeout(() => navigate("/"), 2000);
    }
  };

  return (
    <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)]">
      <h2 className="text-lg font-bold mb-4 text-[#ff6600]">Reset Password</h2>
      {error && <div className="text-red-500 mb-4 text-sm">{error}</div>}
      {message && <div className="text-green-600 mb-4 text-sm">{message}</div>}
      
      <form onSubmit={handleReset} className="flex flex-col gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-[#828282] text-[10pt] font-bold">New Password</label>
          <input
            type="password"
            className="border border-[#828282] p-1 text-[10pt]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-[#d4d4d4] border border-[#828282] px-2 py-1 text-[10pt] text-black hover:bg-[#c4c4c4] w-fit"
        >
          Update Password
        </button>
      </form>
    </div>
  );
}
