import https from 'https';

const PAT = 'sbp_6ecbed7e051ecb9a3f8b8f7652c5f1355295f77a';
const PROJECT_REF = 'vhzdbhdyytvaipkbcsvs';

const sql = `
-- Create collaborative sessions
CREATE TABLE IF NOT EXISTS public.collaborative_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    status TEXT DEFAULT 'waiting',
    course_id UUID REFERENCES public.courses(id),
    max_participants INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    subscription JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.collaborative_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies for collaborative_sessions
DROP POLICY IF EXISTS "Anyone can view collaborative sessions" ON public.collaborative_sessions;
CREATE POLICY "Anyone can view collaborative sessions" ON public.collaborative_sessions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create sessions" ON public.collaborative_sessions;
CREATE POLICY "Authenticated users can create sessions" ON public.collaborative_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- Grant access to service role
GRANT ALL ON public.collaborative_sessions TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
`;

const data = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${PROJECT_REF}/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${PAT}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => { body += d; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(data);
req.end();
