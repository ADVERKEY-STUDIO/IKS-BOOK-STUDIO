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

 plan=dict(id='',revision=0,title='Production test',kind='spread',family='Quiet verse',allocations=[dict(passageId=e['passages'][0]['id'],fields=['original'],start=0,end=len(e['passages'][0]['fields']['original']['text']))],purpose='Read',tone='Quiet',concept='Quiet scene',composition='Open paper',textArea='Left',textBudget=1200,before='',after='')
 e=action(e,{'type':'save-spread','plan':plan});pid=e['storyboard'][0]['id'];e=action(e,{'type':'approve-spread','id':pid});e=action(e,{'type':'create-art-request','planId':pid,'note':'Paint a quiet scene'});rid=e['artProduction']['requests'][0]['id']
 code,data=req('/api/edition/art-package?projectId='+id+'&requestId='+rid);assert code==200
 with zipfile.ZipFile(io.BytesIO(data)) as archive:assert json.loads(archive.read('manifest.json'))['id']==rid and b'SPREAD PRODUCTION REQUEST' in archive.read('REQUEST.md')
 def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\0'+b'\x90\x60\x30'*2+b'\0'+b'\x90\x60\x30'*2))+chunk(b'IEND',b'')
 def upload(e,note):
  boundary='production-check'
  fields={'projectId':id,'expectedRevision':str(e['revision']),'requestId':rid,'note':note,'caption':'Test artwork','credit':'QA fixture','provenance':'uploaded'}
  payload=b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode() for k,v in fields.items())+(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="fixture.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+(f'\r\n--{boundary}--\r\n').encode()
  request=urllib.request.Request(base+'/api/edition/art-image',data=payload,headers={'x-book-studio-owner':owner,'content-type':'multipart/form-data; boundary='+boundary})
  return json.loads(urllib.request.urlopen(request,timeout=30).read())['project']['edition']
 e=upload(e,'First');v=e['artProduction']['spreads'][0]['versions'][0];e=action(e,{'type':'approve-art','planId':pid,'versionId':v['id']});e=upload(e,'Second');assert e['artProduction']['spreads'][0]['approvedId']==v['id']
 key=v['image']['key'];code,data=req('/api/edition/reference-asset?projectId='+id+'&key='+urllib.parse.quote(key));assert code==200 and data==png
 second=e['artProduction']['spreads'][0]['versions'][1]['id'];e=action(e,{'type':'approve-art','planId':pid,'versionId':second});e=action(e,{'type':'approve-art','planId':pid,'versionId':v['id']});assert len(e['artProduction']['spreads'][0]['versions'])==2
 code,data=req('/api/edition?projectId='+id);assert json.loads(data)['project']['edition']['artProduction']==e['artProduction']
 action(e,{'type':'import-art-result','requestId':rid,'image':v['image'],'note':'Bypass'},400)
 try:urllib.request.urlopen(urllib.request.Request(base+'/api/edition/reference-asset?projectId='+id+'&key='+urllib.parse.quote(key),headers={'x-book-studio-owner':'foreign'}));raise AssertionError('Cross-owner read')
 except urllib.error.HTTPError as error:assert error.code==404
 print('PASS: request ZIP, artwork upload/read, version preservation, approve/restore, reload persistence, JSON import rejection, owner isolation')
finally:
 req('/api/projects?id='+id,method='DELETE')
