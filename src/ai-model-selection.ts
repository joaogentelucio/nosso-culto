// Internal deployment gate for Nosso Culto AI. No technical choices in the UI.
// The user-facing button remains "Transcrever" even after a model is promoted.
export const BASELINE_SPEECH_MODEL='Xenova/whisper-base';

type ReleaseManifest={
 schema_version?:unknown;
 model_id?:unknown;
 quality_gate_passed?:unknown;
 timing_gate_passed?:unknown;
 browser_export_verified?:unknown;
};
export function selectSpeechModel(manifest:unknown):string{
 if(!manifest||typeof manifest!=='object'||Array.isArray(manifest))
   return BASELINE_SPEECH_MODEL;
 const data=manifest as ReleaseManifest;
 if(data.schema_version!==1||data.quality_gate_passed!==true||
    data.timing_gate_passed!==true||data.browser_export_verified!==true)
   return BASELINE_SPEECH_MODEL;
 const id=data.model_id;
 // A deployment manifest must be versioned and reviewed by maintainers.
 if(typeof id!=='string'||!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(id))
   return BASELINE_SPEECH_MODEL;
 return id;
}
