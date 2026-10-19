async function testUser2() {
  const loginRes = await fetch('https://finora-andi.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ardiansyahnasir56@gmail.com', password: 'password', remember: true }),
  });

  const cookie = loginRes.headers.get('set-cookie');
  console.log('USER2_LOGIN_STATUS:', loginRes.status);
  const data = await loginRes.json();
  console.log('USER2_DATA:', data);

  const accRes = await fetch('https://finora-andi.vercel.app/api/accounts', {
    headers: { Cookie: cookie },
  });
  const accData = await accRes.json();
  console.log('USER2_ACCOUNTS:', accData.map(a => ({ name: a.name, type: a.type, balance: a.balance })));
}

testUser2().catch(console.error);
