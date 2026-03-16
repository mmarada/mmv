import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // We need to sign in to test RLS
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // Assuming this user exists, or we can sign up
    password: 'password123'
  });
  
  if (authError) {
    // Let's sign up a test user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: 'test_chat_rls@example.com',
      password: 'password123',
      options: { data: { username: 'test_chat_rls' } }
    });
    console.log('Signup:', signUpError ? signUpError.message : 'Success');
  }

  const { data, error } = await supabase.from('messages').select('*').limit(1);
  console.log('Messages fetch error:', error?.message || 'Success');
}

test();
