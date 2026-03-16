import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { supabase } from "./lib/supabase";
import Home from "./pages/Home";
import Submit from "./pages/Submit";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Contact from "./pages/Contact";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata.username || session.user.email?.split("@")[0]);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata.username || session.user.email?.split("@")[0]);
      } else {
        setUsername("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!username) return;

    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_username", username)
        .eq("read", false);
      
      if (!error) {
        setUnreadCount(count || 0);
      }
    };

    fetchUnreadCount();

    const channel = supabase
      .channel("unread_messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload.new.receiver_username === username) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f6f6ef] flex items-center justify-center text-[#828282]">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Analytics />
      <div className="min-h-screen bg-[#f6f6ef] font-sans text-[10pt] text-[#828282]">
        <div className="mx-auto max-w-[85%] bg-white w-full">
          {/* Header */}
          <header className="bg-[#6a0dad] p-0.5 flex items-center text-black">
            <Link to="/" className="flex items-center gap-1 px-1 font-bold text-[10pt] hover:text-white">
              <div className="border border-white w-[18px] h-[18px] flex items-center justify-center text-white bg-[#6a0dad] text-[10pt] leading-none">
                N
              </div>
              NestDirect
            </Link>
            <nav className="flex items-center text-[10pt] ml-2">
              <Link to="/new" className="hover:text-white px-1">new</Link>
              <span className="text-[#222]">|</span>
              <Link to="/submit" className="hover:text-white px-1">submit</Link>
              <span className="text-[#222]">|</span>
              <Link to="/chat" className={`hover:text-white px-1 ${unreadCount > 0 ? 'font-bold text-white' : ''}`}>
                chat {unreadCount > 0 && `(${unreadCount})`}
              </Link>
            </nav>
            <div className="ml-auto px-2 text-[10pt]">
              {session ? (
                <>
                  <span className="mr-2">{username}</span>
                  <button onClick={handleLogout} className="hover:text-white cursor-pointer">logout</button>
                </>
              ) : (
                <Link to="/login" className="hover:text-white">login</Link>
              )}
            </div>
          </header>

          {/* Main Content */}
          <main className="bg-[#f6f6ef] p-2 min-h-[calc(100vh-100px)]">
            <Routes>
              <Route path="/" element={<Home username={username} />} />
              <Route path="/new" element={<Home username={username} />} />
              <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
              <Route path="/submit" element={session ? <Submit username={username} /> : <Navigate to="/login" />} />
              <Route path="/chat" element={session ? <Chat username={username} /> : <Navigate to="/login" />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/contact" element={<Contact />} />
            </Routes>
          </main>
          
          {/* Footer */}
          <footer className="bg-white p-4 border-t border-[#828282] text-center text-[9pt] text-[#828282]">
            <a 
              href="https://www.seattle.gov/police/information-and-data/data/online-crime-maps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Crime search in the area
            </a>
            <span className="mx-2">|</span>
            <Link to="/contact" className="hover:underline">Talk to us</Link>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
