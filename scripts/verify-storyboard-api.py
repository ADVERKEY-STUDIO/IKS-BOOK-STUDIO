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
 code,data=req('/api/projects',{'id':id,'title':'Storyboard integration check','source':'Manual sample','chapters':[],'edition':{}});assert code==200
 e=json.loads(data)['project']['edition'];e=action(e,{'type':'add','text':'abcdefghij','location':'QA verse','provenance':'user-provided'});pid=e['passages'][0]['id'];e=action(e,{'type':'approve','id':pid,'field':'original'})
 plan=dict(id='',revision=0,title='Quiet verse',kind='spread',family='Quiet verse',allocations=[dict(passageId=pid,fields=['original'],start=0,end=10)],purpose='Read',tone='Quiet',concept='Open paper',composition='Upper text',textArea='Left upper',textBudget=1200,before='',after='')
 e=action(e,{'type':'save-spread','plan':plan});sid=e['storyboard'][0]['id'];assert e['bindings']==[dict(passageId=pid,targetId=sid)]
 e=action(e,{'type':'approve-spread','id':sid});assert e['storyboard'][0]['approvedContext']
 code,data=req('/api/edition?projectId='+id);assert json.loads(data)['project']['edition']['storyboard']==e['storyboard']
 action(e,{'type':'reorder-spreads','ids':[]},400)
 stale=dict(e);e=action(e,{'type':'edit','id':pid,'field':'original','text':'corrected source','location':'QA verse','reason':'Correction','provenance':'user-provided'});assert e['affectedTargets'][0]['targetId']==sid
 action(stale,{'type':'delete-spread','id':sid},409)
 e=action(e,{'type':'delete-spread','id':sid});assert not e['bindings'] and not e['storyboard']
 print('PASS: storyboard save/reload, approval, registered source dependencies, invalid reorder rejection, stale revision protection, delete cleanup')
finally:
 req('/api/projects?id='+id,method='DELETE')
