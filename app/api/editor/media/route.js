import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertSameOrigin, isAuthenticated } from '@/lib/auth';
import { githubConfigured, loadDraftMedia, uploadMediaToGithub } from '@/lib/github';

export const runtime = 'nodejs';
const mediaTypes = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', webp:'image/webp', gif:'image/gif', svg:'image/svg+xml', avif:'image/avif', mp4:'video/mp4', webm:'video/webm' };
const allowed = new Set(Object.values(mediaTypes));
function safeName(value) { return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(-100) || 'upload'; }

export async function POST(request) {
  if (!await isAuthenticated()) return NextResponse.json({ error:'Unauthorized' },{status:401});
  try {
    assertSameOrigin(request); const form=await request.formData(); const files=[...form.getAll('files'),...form.getAll('files[]')]; if(!files.length)throw new Error('Choose a file.');
    const assets=[];
    for(const file of files){if(!allowed.has(file.type))throw new Error('Use JPG, PNG, WebP, GIF, SVG, AVIF, MP4, or WebM.');if(file.size>4*1024*1024)throw new Error('Files must be 4 MB or smaller.');const extension=Object.keys(mediaTypes).find(key=>mediaTypes[key]===file.type);const filename=`${randomUUID()}-${safeName(file.name)}.${extension}`;const repoPath=`public/static/uploads/${filename}`;const buffer=Buffer.from(await file.arrayBuffer());
      if(githubConfigured()){await uploadMediaToGithub(repoPath,buffer.toString('base64'));assets.push({src:`/api/editor/media?path=${encodeURIComponent(repoPath)}`,name:file.name,type:file.type.startsWith('video/')?'video':'image'});}else if(process.env.NODE_ENV!=='production'){const local=path.join(process.cwd(),repoPath);await fs.mkdir(path.dirname(local),{recursive:true});await fs.writeFile(local,buffer);assets.push({src:`/static/uploads/${filename}`,name:file.name,type:file.type.startsWith('video/')?'video':'image'});}else throw new Error('GitHub media storage is not configured.');
    }
    return NextResponse.json({data:assets});
  }catch(error){return NextResponse.json({error:error.message},{status:400})}
}

export async function GET(request) {
  if (!await isAuthenticated()) return new Response(null,{status:401});
  try {
    const repoPath = new URL(request.url).searchParams.get('path');
    if (!/^public\/static\/uploads\/[a-z0-9._-]+$/.test(repoPath || '')) return new Response(null, { status: 404 });
    const extension = repoPath.split('.').pop();
    return new Response(await loadDraftMedia(repoPath), {
      headers: {
        'Content-Type': Object.hasOwn(mediaTypes, extension) ? mediaTypes[extension] : 'application/octet-stream',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=60',
      },
    });
  }
  catch{return new Response(null,{status:404})}
}
