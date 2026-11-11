import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import LoginForm from '@/components/LoginForm';
import '../editor.css';
export default async function LoginPage() { if (await isAuthenticated()) redirect('/editor'); return <LoginForm />; }
