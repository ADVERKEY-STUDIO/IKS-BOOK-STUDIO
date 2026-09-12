"""Run against the local preview: python3 scripts/verify-art-direction-api.py."""
import json, urllib.request, urllib.error, uuid
base='http://127.0.0.1:5173'
owner='art-guide-check-'+str(uuid.uuid4())
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
 code,data=req('/api/projects',{'id':id,'title':'Art guide integration check','source':'Manual sample','chapters':[],'edition':{}});assert code==200
 e=json.loads(data)['project']['edition'];e=action(e,{'type':'add','text':'ॐ अग्निमीळे पुरोहितं','location':'Test sample','provenance':'user-provided'});pid=e['passages'][0]['id']
 e=action(e,{'type':'approve','id':pid,'field':'original'})
 guide={key:'Reviewed sample '+key for key in ['name','purpose','tone','medium','texture','linework','detail','spacing','ornaments','environments','culturalNotes','avoidances']}
 guide.update(layout='quiet',palette={'paper':'#fffdf7','ink':'#263c34','accent':'#985332','support':'#8a9574'},typography={key:{'size':20 if key=='original' else 14,'lineHeight':1.8,'family':'serif'} for key in ['original','transliteration','translation','commentary','caption']},references={'version':1,'references':{},'notes':''})
 e=action(e,{'type':'save-art-guide','guide':guide,'reason':'First guide'})
 code,data=req('/api/edition/art-brief?projectId='+id);assert code==422
 e=action(e,{'type':'approve-art-guide','version':1});code,data=req('/api/edition/art-brief?projectId='+id);assert code==200 and b'artGuideVersion=1' in data
 code,data=req('/api/edition?projectId='+id);saved=json.loads(data)['project'];assert saved['edition']['artDirection']['versions'][0]['approvedAt']
 saved['edition']['artDirection']['versions'][0]['guide']['tone']='Bypass attempt';code,data=req('/api/projects',saved);assert code==409
 original=e['passages'][0]['fields']['original']['text'];guide['tone']='A revised tone';e=action(e,{'type':'save-art-guide','guide':guide,'reason':'Second version'});assert len(e['artDirection']['versions'])==2 and e['artDirection']['versions'][0]['approvedAt'];assert e['passages'][0]['fields']['original']['text']==original
 e=action(e,{'type':'approve-art-guide','version':1},400);e=action(e,{'type':'approve-art-guide','version':2})
 e=action(e,{'type':'edit','id':pid,'field':'original','text':original+' ॥','location':'Test sample','reason':'Correct source','provenance':'user-provided'})
 code,data=req('/api/edition/art-brief?projectId='+id);assert code==422
 e=action(e,{'type':'approve-art-guide','version':2},400)
 print('PASS: guide save, approval, persistence, protected-save rejection, immutable prior version, source preservation, stale-guide production block')
finally:
 req('/api/projects?id='+id,method='DELETE')
