"""Run against the local preview: python3 scripts/verify-book-production-api.py."""
import json, urllib.request, urllib.error, uuid, struct, zlib, io, zipfile
base='http://127.0.0.1:5173'
owner='book-production-check-'+str(uuid.uuid4())
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

 plan=dict(id='',revision=0,title='Book production test',kind='spread',family='Quiet verse',allocations=[dict(passageId=e['passages'][0]['id'],fields=['original'],start=0,end=len(e['passages'][0]['fields']['original']['text']))],purpose='Read',tone='Quiet',concept='Quiet text',composition='Open paper',textArea='Left',textBudget=1200,before='',after='')
 e=action(e,{'type':'save-spread','plan':plan});pid=e['storyboard'][0]['id'];e=action(e,{'type':'approve-spread','id':pid})
 layer=dict(id='original',kind='text',x=15,y=20,width=170,height=70,hidden=False,locked=False,opacity=1,binding=dict(passageId=e['passages'][0]['id'],field='original',start=0,end=len(e['passages'][0]['fields']['original']['text'])),text='',imageKey='',fontSize=18,lineHeight=1.7,inset=3,color='#263c34',background='#ffffff',align='left',fit='contain',focalX=50,focalY=50,softEdge=0)
 c=dict(planId=pid,planRevision=1,revision=0,guideVersion=1,paper='#fffdf7',layers=[layer]);e=action(e,{'type':'save-composition','composition':c})
 original=json.dumps(e['passages'],sort_keys=True)
 e=action(e,{'type':'save-production-batch','name':'Batch one','planIds':[pid]});assert len(e['bookProduction']['batches'])==1
 stale=e;e=action(e,{'type':'review-production-spread','planId':pid,'kind':'submit','note':'Please review'})
 action(stale,{'type':'review-production-spread','planId':pid,'kind':'rework','note':'Stale request'},409)
 e=action(e,{'type':'review-production-spread','planId':pid,'kind':'approve','note':'Reviewed fixture','checks':{'meaning':True,'artwork':True,'textFit':True}})
 e=action(e,{'type':'review-production-spread','planId':pid,'kind':'rework','note':'Only this spread'})
 assert [r['kind'] for r in e['bookProduction']['reviews']]==['submit','approve','rework']
 e=action(e,{'type':'add-book-part','role':'Colophon','title':'Production notes','body':'API verification text only'})
 assert e['bookProduction']['parts'][0]['role']=='Colophon' and len(e['compositions'])==2
 e=action(e,{'type':'save-printer-cover','cover':{'printer':'QA printer','templateReference':'QA supplied dimensions','flatWidth':426,'flatHeight':256,'spineWidth':0,'bleed':3,'notes':'Fixture, not actual printer specifications'}})
 assert json.dumps(e['passages'],sort_keys=True)==original
 code,raw=req('/api/edition?projectId='+id);project=json.loads(raw)['project'];assert project['edition']['bookProduction']==e['bookProduction']
 project['edition']['bookProduction']['reviews']=[];code,raw=req('/api/projects',project);assert code==409,(code,raw)
 code,raw=req('/api/edition?projectId='+id);assert len(json.loads(raw)['project']['edition']['bookProduction']['reviews'])==3
 print('PASS: batch/review persistence, section creation, printer requirements, source preservation, stale revision and protected-save guards')
finally:
 req('/api/projects?id='+id,method='DELETE')
