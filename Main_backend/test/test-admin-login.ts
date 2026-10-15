import { AuthService } from '../src/services/auth.service';
import { UserService } from '../src/services/user.service';
import { pool } from '../src/config/database';

async function testLogin() {
  console.log('Testing Admin login with phamthaisang1710@gmail.com...');
  const res = await AuthService.login({
    email: 'phamthaisang1710@gmail.com',
    password: 'AdminPassword123@'
  });
  console.log('✅ Login SUCCESSFUL!');
  console.log('User ID:', res.id);
  console.log('Email:', res.email);
  console.log('Token:', res.token ? res.token.substring(0, 30) + '...' : 'none');

  const profile = await UserService.getById(res.id);
  console.log('Full Name:', profile.full_name);
  console.log('Status:', profile.status);
  console.log('Roles:', profile.system_roles);

  await pool.end();
}

testLogin().catch(err => {
  console.error('❌ Login FAILED:', err.message);
  process.exit(1);
});
