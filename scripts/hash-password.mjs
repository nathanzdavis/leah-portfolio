import crypto from 'node:crypto';
import readline from 'node:readline/promises';
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const password=await rl.question('Editor password: ');rl.close();
if(password.length<12)throw new Error('Use at least 12 characters.');
const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(password,salt,64).toString('hex');
console.log(`EDITOR_PASSWORD_HASH=scrypt$${salt}$${hash}`);
