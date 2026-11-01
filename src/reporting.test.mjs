import test from 'node:test';
import assert from 'node:assert/strict';
export function asOfRows(rows,asOf) {
 const cutoff=Date.parse(asOf);
 if(!Number.isFinite(cutoff)) throw new Error('Valid as-of timestamp required');
 return rows.filter(r=>{const t=Date.parse(r.effectiveAt);return Number.isFinite(t)&&t<=cutoff;});
}
export function validateBackupManifest(manifest) {
 if(!manifest||manifest.formatVersion!==1||!manifest.createdAt||!manifest.database||!Array.isArray(manifest.attachments)||!manifest.checksum) throw new Error('Incomplete backup manifest');
 if(!['encrypted','not-applicable'].includes(manifest.encryption)) throw new Error('Backup encryption state must be explicit');
 return true;
}
export function reportFreshness({generatedAt,sourceWatermark}) {
 const generated=Date.parse(generatedAt),watermark=Date.parse(sourceWatermark);
 if(!Number.isFinite(generated)||!Number.isFinite(watermark)) throw new Error('Report timestamps required');
 return Object.freeze({generatedAt,sourceWatermark,stale:watermark>generated});
}
test('as-of reports use effective transaction date',()=>{
 const rows=[{id:1,effectiveAt:'2026-01-01'},{id:2,effectiveAt:'2026-02-01'}];
 assert.deepEqual(asOfRows(rows,'2026-01-15').map(x=>x.id),[1]);
});
test('backup manifest must describe encryption and integrity',()=>{
 assert.equal(validateBackupManifest({formatVersion:1,createdAt:'now',database:'db.enc',attachments:[],checksum:'sha256:abc',encryption:'encrypted'}),true);
 assert.throws(()=>validateBackupManifest({formatVersion:1,database:'db',attachments:[],checksum:'x'}));
});
test('report exposes source freshness metadata',()=>{
 assert.equal(reportFreshness({generatedAt:'2026-01-01',sourceWatermark:'2026-01-02'}).stale,true);
});