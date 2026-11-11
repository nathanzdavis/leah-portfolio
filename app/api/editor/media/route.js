import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated } from '@/lib/auth';
import { githubConfigured, loadDraftMedia, uploadMediaToGithub } from '@/lib/github';

export const runtime = 'nodejs';
const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','video/mp4','video/webm']);
function safeName(value) { return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100) || 'upload'; }

export async function POST(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error:'Unauthorized' },{status:401});
  try {
    assertSameOrigin(request); const form=await request.formData(); const files=form.getAll('files'); if(!files.length)throw new Error('Choose a file.');
    const assets=[];
    for(const file of files){if(!allowed.has(file.type))throw new Error(`Unsupported file type: ${file.type}`);if(file.size>10*1024*1024)throw new Error('Files must be 10 MB or smaller.');const filename=`${Date.now()}-${safeName(file.name)}`;const repoPath=`public/static/uploads/${filename}`;const buffer=Buffer.from(await file.arrayBuffer());
      if(githubConfigured()){await uploadMediaToGithub(repoPath,buffer.toString('base64'));assets.push({src:`/api/editor/media?path=${encodeURIComponent(repoPath)}`,name:file.name,type:file.type.startsWith('video/')?'video':'image'});}else if(process.env.NODE_ENV!=='production'){const local=path.join(process.cwd(),repoPath);await fs.mkdir(path.dirname(local),{recursive:true});await fs.writeFile(local,buffer);assets.push({src:`/static/uploads/${filename}`,name:file.name,type:file.type.startsWith('video/')?'video':'image'});}else throw new Error('GitHub media storage is not configured.');
    }
    return NextResponse.json({data:assets});
  }catch(error){return NextResponse.json({error:error.message},{status:400})}
}

export async function GET(request) {
  if (!await isAuthenticated()) return new Response(null,{status:401});
  try { const repoPath=new URL(request.url).searchParams.get('path'); if(!repoPath?.startsWith('public/static/uploads/'))throw new Error('Invalid media path.'); const data=await loadDraftMedia(repoPath); return new Response(Buffer.from(data.content,'base64'),{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, max-age=60'}}); }
  catch{return new Response(null,{status:404})}
}
