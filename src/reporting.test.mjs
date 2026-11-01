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
export function validateOfflineTransfer({manifest,expectedSchemaVersion,actualDatabaseChecksum,availableAttachmentChecksums}) {
 validateBackupManifest(manifest);
 if(!manifest.backupId||!manifest.sourceDeviceId||!manifest.schemaVersion) throw new Error('Backup identity and schema metadata required');
 if(manifest.schemaVersion!==expectedSchemaVersion) throw new Error('Backup schema version is incompatible; migrate in a staging restore');
 if(actualDatabaseChecksum!==manifest.checksum) throw new Error('Database checksum mismatch');
 for(const item of manifest.attachments) {
  if(!item||!item.name||!item.checksum||!availableAttachmentChecksums.includes(item.checksum)) throw new Error('Backup attachment missing or checksum mismatch');
 }
 return Object.freeze({backupId:manifest.backupId,readyToRestore:true,requiresAtomicRestore:true});
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
test('offline transfer requires matching schema and database checksum before restore',()=>{
 const manifest={formatVersion:1,backupId:'backup-001',sourceDeviceId:'device-A',schemaVersion:8,createdAt:'2026-11-01T10:00:00Z',database:'db.enc',attachments:[],checksum:'sha256:abc',encryption:'encrypted'};
 assert.deepEqual(validateOfflineTransfer({manifest,expectedSchemaVersion:8,actualDatabaseChecksum:'sha256:abc',availableAttachmentChecksums:[]}),{backupId:'backup-001',readyToRestore:true,requiresAtomicRestore:true});
 assert.throws(()=>validateOfflineTransfer({manifest,expectedSchemaVersion:9,actualDatabaseChecksum:'sha256:abc',availableAttachmentChecksums:[]}),/schema version is incompatible/);
 assert.throws(()=>validateOfflineTransfer({manifest,expectedSchemaVersion:8,actualDatabaseChecksum:'sha256:wrong',availableAttachmentChecksums:[]}),/checksum mismatch/);
});
test('offline transfer rejects missing attachment payloads',()=>{
 const manifest={formatVersion:1,backupId:'backup-002',sourceDeviceId:'device-A',schemaVersion:8,createdAt:'2026-11-01T10:00:00Z',database:'db.enc',attachments:[{name:'invoice.pdf',checksum:'sha256:file1'}],checksum:'sha256:db',encryption:'encrypted'};
 assert.throws(()=>validateOfflineTransfer({manifest,expectedSchemaVersion:8,actualDatabaseChecksum:'sha256:db',availableAttachmentChecksums:[]}),/attachment missing/);
});
test('report exposes source freshness metadata',()=>{
 assert.equal(reportFreshness({generatedAt:'2026-01-01',sourceWatermark:'2026-01-02'}).stale,true);
});
