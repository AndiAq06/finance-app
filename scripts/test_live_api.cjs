async function test() {
  const loginRes = await fetch('https://finora-andi.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@finora.test', password: 'password', remember: true }),
  });

  const cookie = loginRes.headers.get('set-cookie');
  console.log('LOGIN_STATUS:', loginRes.status);
  const data = await loginRes.json();
  console.log('LOGIN_DATA:', data);

  // Now call /api/dashboard with the session cookie
  const dashRes = await fetch('https://finora-andi.vercel.app/api/dashboard', {
    headers: { Cookie: cookie },
  });
  console.log('DASHBOARD_STATUS:', dashRes.status);
  const dashData = await dashRes.json();
  console.log('DASHBOARD_SUMMARY:', {
    net_worth: dashData.net_worth,
    total_balance: dashData.total_balance,
    accounts_count: dashData.accounts?.length,
    recent_transactions: dashData.recent_transactions?.length,
  });
}

test().catch(console.error);
