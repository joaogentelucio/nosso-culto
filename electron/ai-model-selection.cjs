'use strict';
// Native model promotion is strictly opt-in and restricted to release resources.
// Without verified GGML weights, Electron continues using the bundled Whisper.
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const {createHash}=require('node:crypto');
const path=require('node:path');
const MODEL_NAME='ggml-nosso-culto-ai.bin';
const MIN_BYTES=50_000_000;
const MAX_BYTES=3_000_000_000;
async function verifiedBundledModel(engineFolder){
 const directory=path.join(engineFolder,'models');
 let manifest;
 try{
   manifest=JSON.parse(await fs.readFile(path.join(directory,'release.json'),'utf8'));
 }catch{return null;}
 if(!manifest||manifest.schema_version!==1||manifest.filename!==MODEL_NAME||
    manifest.quality_gate_passed!==true||
    manifest.timing_gate_passed!==true||
    manifest.ggml_export_verified!==true||
    !/^[a-f0-9]{64}$/i.test(String(manifest.sha256||'')))return null;
 if(typeof manifest.baseline_test_wer!=='number'||
    typeof manifest.candidate_test_wer!=='number'||
    !Number.isFinite(manifest.baseline_test_wer)||
    !Number.isFinite(manifest.candidate_test_wer)||
    manifest.candidate_test_wer>=manifest.baseline_test_wer)return null;
 if(typeof manifest.mean_absolute_start_error_seconds!=='number'||
    !Number.isFinite(manifest.mean_absolute_start_error_seconds)||
    manifest.mean_absolute_start_error_seconds>0.5||
    manifest.mean_absolute_start_error_seconds<0)return null;
 const file=path.join(directory,MODEL_NAME);
 try{
   const stat=await fs.stat(file);
   if(!stat.isFile()||stat.size<MIN_BYTES||stat.size>MAX_BYTES)return null;
   const digest=createHash('sha256');
   for await(const buffer of createReadStream(file)){digest.update(buffer);}
   if(digest.digest('hex').toLowerCase()!==manifest.sha256.toLowerCase())return null;
   return file;
 }catch{return null;}
}
module.exports={verifiedBundledModel};
