import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function Contact() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setEmail(user.email);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const { error } = await supabase.from("enquiries").insert([{ email, message }]);
    
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("success");
      setEmail("");
      setMessage("");
    }
  };

  return (
    <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)] text-[10pt]">
      <h2 className="font-bold mb-4">Talk to us</h2>
      {status === "success" ? (
        <p className="text-green-600">Thank you for your message!</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
          {errorMsg && <p className="text-red-500">{errorMsg}</p>}
          <div className="flex flex-col">
            <label className="font-bold mb-1">Email</label>
            <input
              type="email"
              className="border border-[#828282] p-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="font-bold mb-1">Message</label>
            <textarea
              className="border border-[#828282] p-1 h-32"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="bg-[#d4d4d4] border border-[#828282] px-4 py-1 text-black hover:bg-[#c4c4c4]"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? "Sending..." : "Submit"}
          </button>
        </form>
      )}
    </div>
  );
}
