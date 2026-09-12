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

 layer=dict(id='verse',kind='text',x=15,y=20,width=180,height=80,hidden=False,locked=False,opacity=1,binding=dict(passageId=pid,field='original',start=0,end=10),text='',imageKey='',fontSize=18,lineHeight=1.7,inset=3,color='#263c34',background='#ffffff',align='left',fit='contain',focalX=50,focalY=50,softEdge=0)
 c=dict(planId=sid,planRevision=1,revision=0,guideVersion=0,paper='#fffdf7',layers=[layer]);e=action(e,{'type':'save-composition','composition':c});assert e['compositions'][0]['revision']==1
 code,data=req('/api/edition?projectId='+id);project=json.loads(data)['project'];assert project['edition']['compositions'][0]['layers'][0]['x']==15
 project['edition']['compositions'][0]['layers'][0]['binding']['field']='notes';code,data=req('/api/projects',project);assert code==409
 stale=dict(e);c['layers'][0]['x']=20;e=action(e,{'type':'save-composition','composition':c});assert e['compositions'][0]['revision']==2
 action(stale,{'type':'save-composition','composition':c},409)
 assert e['passages'][0]['fields']['original']['text']=='abcdefghij'
 assert any(b['targetId']=='composition:'+sid for b in e['bindings'])
 print('PASS: composition persistence, physical coordinates, source preservation, protected-save rejection, stale revision guard, dependency binding')
finally:
 req('/api/projects?id='+id,method='DELETE')
