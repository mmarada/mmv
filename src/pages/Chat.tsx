import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { encryptMessage, decryptMessage, importPublicKey } from "../utils/crypto";
import { logger } from "../utils/logger";

export default function Chat({ username }: { username: string }) {
  const [searchParams] = useSearchParams();
  const withUser = searchParams.get("with");
  const listingId = searchParams.get("listing");

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [listingTitle, setListingTitle] = useState<string | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState(0);
  const [recipientPublicKey, setRecipientPublicKey] = useState<CryptoKey | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const MAX_MESSAGE_LENGTH = 1000;
  const RATE_LIMIT_MS = 1000;

  useEffect(() => {
    if (withUser && username) {
      const markAsRead = async () => {
        await supabase
          .from("messages")
          .update({ read: true })
          .eq("sender_username", withUser)
          .eq("receiver_username", username)
          .eq("read", false);
      };
      markAsRead();
    }
  }, [withUser, username]);

  useEffect(() => {
    if (withUser) {
      const fetchRecipientKey = async () => {
        // Find user ID for username
        const { data: userData } = await supabase
          .from("profiles")
          .select("id, public_key")
          .eq("username", withUser)
          .single();
        
        if (userData && userData.public_key) {
          const key = await importPublicKey(userData.public_key);
          setRecipientPublicKey(key);
        }
      };
      fetchRecipientKey();
    }
  }, [withUser]);

  useEffect(() => {
    if (listingId) {
      const fetchListing = async () => {
        const { data, error } = await supabase
          .from("listings")
          .select("title")
          .eq("id", listingId)
          .single();
        if (!error && data) {
          setListingTitle(data.title);
        }
      };
      fetchListing();
    }
  }, [listingId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!username) return;
      
      const safeUsername = username.replace(/"/g, '\\"');
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_username.eq."${safeUsername}",receiver_username.eq."${safeUsername}"`)
        .order("created_at", { ascending: true });
      
      if (error) {
        logger.error("Error fetching messages:", error);
        setErrorMsg(error.message);
      } else if (data) {
        // Decrypt messages
        const decryptedMessages = await Promise.all(data.map(async (msg) => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            const privateKeyB64 = localStorage.getItem(`private_key_${user?.id}`);
            if (!privateKeyB64) return msg;
            
            const binaryDer = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
            const privateKey = await window.crypto.subtle.importKey(
              "pkcs8",
              binaryDer,
              { name: "RSA-OAEP", hash: "SHA-256" },
              true,
              ["decrypt"]
            );
            
            const decryptedText = await decryptMessage(msg.text, privateKey);
            return { ...msg, text: decryptedText };
          } catch (e) {
            return msg; // Keep encrypted if decryption fails
          }
        }));
        setMessages(decryptedMessages);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("messages_channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new;
          if (
            newMessage.sender_username === username ||
            newMessage.receiver_username === username
          ) {
            // Decrypt new message
            const decryptNewMessage = async () => {
              try {
                const { data: { user } } = await supabase.auth.getUser();
                const privateKeyB64 = localStorage.getItem(`private_key_${user?.id}`);
                if (!privateKeyB64) return newMessage;
                
                const binaryDer = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
                const privateKey = await window.crypto.subtle.importKey(
                  "pkcs8",
                  binaryDer,
                  { name: "RSA-OAEP", hash: "SHA-256" },
                  true,
                  ["decrypt"]
                );
                
                const decryptedText = await decryptMessage(newMessage.text, privateKey);
                return { ...newMessage, text: decryptedText };
              } catch (e) {
                return newMessage; // Keep encrypted if decryption fails
              }
            };
            decryptNewMessage().then(decryptedMsg => {
              setMessages((prev) => [...prev, decryptedMsg]);
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    
    // Input validation
    if (input.trim().length > MAX_MESSAGE_LENGTH) {
      setErrorMsg(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    // Rate limiting
    const now = Date.now();
    if (now - lastMessageTime < RATE_LIMIT_MS) {
      setErrorMsg("Please wait a moment before sending another message.");
      return;
    }

    if (input.trim() && withUser) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMsg("Not authenticated");
        return;
      }

      setLastMessageTime(now);

      // Encrypt message
      let encryptedText = input;
      if (recipientPublicKey) {
        encryptedText = await encryptMessage(input, recipientPublicKey);
      }

      const newMessage = {
        sender_id: user.id,
        sender_username: username,
        receiver_username: withUser,
        listing_id: listingId || null,
        text: encryptedText,
      };

      const { data, error } = await supabase.from("messages").insert([newMessage]).select();
      if (error) {
        console.error("Error sending message:", error);
        setErrorMsg(error.message);
      } else {
        setInput("");
        if (data && data.length > 0) {
          // Check if it's already in the list (in case realtime beat us to it)
          setMessages((prev) => {
            if (prev.some(m => m.id === data[0].id)) return prev;
            return [...prev, data[0]];
          });
        }
      }
    }
  };

  if (!withUser) {
    // Show list of conversations
    const conversations = Array.from(
      new Set(
        messages.map((m) =>
          m.sender_username === username ? m.receiver_username : m.sender_username
        )
      )
    );
    
    return (
      <div className="p-4 bg-[#f6f6ef] min-h-[calc(100vh-30px)] text-[10pt]">
        <h2 className="font-bold mb-4">Your Conversations</h2>
        {errorMsg && <div className="text-red-500 mb-4">{errorMsg}</div>}
        {conversations.length === 0 ? (
          <p className="text-[#828282]">No messages yet. Browse listings to start a conversation.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conversations.map((user) => (
              <li key={user}>
                <Link to={`/chat?with=${user}`} className="text-black hover:underline">
                  Chat with {user}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const conversationMessages = messages.filter(
    (m) =>
      (m.sender_username === username && m.receiver_username === withUser) ||
      (m.sender_username === withUser && m.receiver_username === username)
  );

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-[#f6f6ef] p-4 text-[10pt]">
      <div className="mb-2">
        <Link to="/chat" className="text-[#828282] hover:underline">&lt; Back to Inbox</Link>
        <h2 className="font-bold mt-2">Chat with {withUser} {listingTitle && `("${listingTitle}")`}</h2>
        {errorMsg && <div className="text-red-500 mt-1">{errorMsg}</div>}
      </div>
      <div className="flex-1 overflow-y-auto mb-4 border border-[#828282] bg-white p-2">
        {conversationMessages.length === 0 && (
          <p className="text-[#828282] italic">No messages yet. Send a message to start the conversation.</p>
        )}
        {conversationMessages.map((msg, idx) => (
          <div key={idx} className="mb-2">
            <span className={`font-bold ${msg.sender_username === username ? 'text-[#ff6600]' : 'text-[#333]'}`}>
              {msg.sender_username}:{" "}
            </span>
            <span className="text-black">{msg.text}</span>
            <span className="text-[#828282] text-[8pt] ml-2">
              {new Date(msg.created_at).toLocaleTimeString()}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          className="border border-[#828282] p-1 flex-1 text-[10pt]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${withUser}...`}
        />
        <button
          type="submit"
          className="bg-[#d4d4d4] border border-[#828282] px-4 py-1 text-[10pt] text-black hover:bg-[#c4c4c4]"
        >
          send
        </button>
      </form>
    </div>
  );
}
