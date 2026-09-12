"""Run against the local preview: python3 scripts/verify-visual-reference-api.py."""
import json, urllib.request, urllib.error, uuid, struct, zlib, io, zipfile
base='http://127.0.0.1:5173'
owner='visual-reference-check-'+str(uuid.uuid4())
id=str(uuid.uuid4())
def req(path,data=None,method=None):
 headers={'x-book-studio-owner':owner}
 if data is not None:headers['content-type']='application/json'
 try:
  r=urllib.request.urlopen(urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method),timeout=30)
  return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def action(e,a,status=200):
 code,data=req('/api/edition',{'projectId':id,'expectedRevision':e['revision'],'action':a});assert code==status,(code,data)
 return json.loads(data)['project']['edition'] if code==200 else e
try:
 code,data=req('/api/projects',{'id':id,'title':'Reference API check','source':'Manual sample','chapters':[],'edition':{}});assert code==200
 e=json.loads(data)['project']['edition'];e=action(e,{'type':'add','text':'Original for technical verification','location':'Test','provenance':'user-provided'});e=action(e,{'type':'approve','id':e['passages'][0]['id'],'field':'original'})
 guide={key:'Reviewed '+key for key in ['name','purpose','tone','medium','texture','linework','detail','spacing','ornaments','environments','culturalNotes','avoidances']}
 guide.update(layout='quiet',palette={'paper':'#fffdf7','ink':'#263c34','accent':'#985332','support':'#8a9574'},typography={key:{'size':20 if key=='original' else 14,'lineHeight':1.8,'family':'serif'} for key in ['original','transliteration','translation','commentary','caption']},references={'version':1,'references':{},'notes':''})
 e=action(e,{'type':'save-art-guide','guide':guide,'reason':'First guide'});e=action(e,{'type':'approve-art-guide','version':1})
 spec={key:'Technical sample '+key for key in ['name','role','features','proportions','clothing','ornaments','colors','objects','poses','expressions','culturalNotes']};spec['kind']='character'
 e=action(e,{'type':'save-reference','spec':spec,'imageIds':[],'reason':'Initial identity'});rid=e['visualReferences'][0]['id']
 e=action(e,{'type':'approve-reference','id':rid,'version':1},400)
 def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'+b'\x90\x60\x30'*2+b'\0'+b'\x90\x60\x30'*2))+chunk(b'IEND',b'')
 boundary='reference-test-upload'
 fields={'projectId':id,'expectedRevision':str(e['revision']),'referenceId':rid,'view':'front','caption':'Technical raster fixture','credit':'Generated test fixture','provenance':'uploaded'}
 payload=b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode() for k,v in fields.items())+(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+(f'\r\n--{boundary}--\r\n').encode()
 request=urllib.request.Request(base+'/api/edition/reference-image',data=payload,headers={'x-book-studio-owner':owner,'content-type':'multipart/form-data; boundary='+boundary})
 result=urllib.request.urlopen(request,timeout=30);e=json.loads(result.read())['project']['edition'];image=e['visualReferences'][0]['versions'][-1]['images'][0]
 asset='/api/edition/reference-asset?projectId='+id+'&key='+urllib.parse.quote(image['key'])
 code,data=req(asset);assert code==200 and data==png
 try:urllib.request.urlopen(urllib.request.Request(base+asset,headers={'x-book-studio-owner':'different-owner'}));raise AssertionError('Cross-owner asset read succeeded')
 except urllib.error.HTTPError as error:assert error.code==404
 e=action(e,{'type':'approve-reference','id':rid,'version':2});code,data=req('/api/edition/art-brief?projectId='+id);assert code==200 and image['id'].encode() in data
 code,data=req('/api/edition/reference-package?projectId='+id+'&referenceId='+rid);assert code==200
 with zipfile.ZipFile(io.BytesIO(data)) as archive:
  manifest=json.loads(archive.read('manifest.json'));assert manifest['approvedVersion']==2 and manifest['referenceId']==rid;assert archive.read(manifest['inputs'][0]['path'])==png;assert b'REFERENCE DEVELOPMENT REQUEST' in archive.read('REQUEST.md')
 e=action(e,{'type':'save-reference','id':rid,'spec':{**spec,'features':'New draft features'},'imageIds':[image['id']],'reason':'New proposed pose'});assert e['visualReferences'][0]['approvedVersion']==2
 code,data=req('/api/edition/art-brief?projectId='+id);assert code==200 and b'New draft features' not in data
 e=action(e,{'type':'archive-reference','id':rid,'archived':True});code,data=req('/api/edition/art-brief?projectId='+id);assert code==200 and b'APPROVED VISUAL REFERENCES' not in data
 print('PASS: image upload/read, owner isolation, reference approval, exact-version production brief, ZIP manifest/images, retained approved identity after draft edit, archive')
finally:
 req('/api/projects?id='+id,method='DELETE')
