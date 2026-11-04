// Read-only packed-file reader; layout follows electron/asar src/disk.ts and Pickle.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
function readPackedFile(archive,name){
 const fd=fs.openSync(archive,'r');
 try{
  const size=fs.fstatSync(fd).size,lead=Buffer.alloc(16);assert.equal(fs.readSync(fd,lead,0,16,0),16);
  assert.equal(lead.readUInt32LE(0),4,'Unsupported ASAR size pickle');const headerSize=lead.readUInt32LE(4),jsonSize=lead.readUInt32LE(12);
  assert(headerSize>=8&&headerSize<=size-8&&headerSize<=32*1024*1024);assert(jsonSize<=headerSize-8);
  const header=Buffer.alloc(jsonSize);assert.equal(fs.readSync(fd,header,0,jsonSize,16),jsonSize);
  let entry=JSON.parse(header.toString('utf8'));for(const part of name.split('/')){assert(part&&part!=='.'&&part!=='..');entry=entry.files?.[part];assert(entry,'Missing packed file');}
  assert(!entry.link&&!entry.unpacked&&!entry.files,'Expected regular packed file');assert(/^\d+$/.test(entry.offset));
  const offset=8+headerSize+Number(entry.offset);assert(Number.isSafeInteger(offset)&&Number.isSafeInteger(entry.size)&&entry.size>=0&&entry.size<=8*1024*1024&&offset+entry.size<=size);
  const data=Buffer.alloc(entry.size);assert.equal(fs.readSync(fd,data,0,entry.size,offset),entry.size);
  if(entry.integrity?.algorithm==='SHA256')assert.equal(crypto.createHash('sha256').update(data).digest('hex'),entry.integrity.hash,'Packed file integrity mismatch');return data;
 }finally{fs.closeSync(fd);}
}
module.exports={readPackedFile};
if(require.main===module){const [archive,name]=process.argv.slice(2);process.stdout.write(readPackedFile(archive,name));}
