import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import EditorClient from '@/components/EditorClient';
import './editor.css';
import 'grapesjs/dist/css/grapes.min.css';
export const dynamic = 'force-dynamic';
export default async function EditorPage() { if (!await isAuthenticated()) redirect('/editor/login'); return <EditorClient />; }
