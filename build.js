const fs=require('node:fs'),path=require('node:path');
const role=require('./app-role.json').role;
if(!['simulator','tower'].includes(role))throw Error('Invalid application role');
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist',{recursive:true});fs.cpSync('src','dist',{recursive:true});
fs.writeFileSync('dist/entry.js','window.CMP_ENTRY='+JSON.stringify(role==='simulator'?'lab':'tower')+';\n');
let html=fs.readFileSync('dist/index.html','utf8').replace('<title>CMP 공정 실습실 · D-A-A LOOP</title>','<title>'+ (role==='simulator'?'CMP 시뮬레이터':'CMP AI 관제탑')+' · D-A-A LOOP</title>');
fs.writeFileSync('dist/index.html',html);
fs.writeFileSync('dist/_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: SAMEORIGIN\n');
console.log('Built '+role+' → dist');
