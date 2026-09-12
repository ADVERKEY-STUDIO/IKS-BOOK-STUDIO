"""Run against the local preview: python3 scripts/verify-book-review-api.py."""
import json, urllib.request, urllib.error, uuid, struct, zlib, io, zipfile
base='http://127.0.0.1:5173'
owner='book-review-check-'+str(uuid.uuid4())
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
 def context(e):
  import hashlib
  from pathlib import Path
  values={'protocol':1,'font':hashlib.sha256(Path('public/fonts/book-sanskrit.ttf').read_bytes()).hexdigest()}
  for dest,source in [('metadata','metadata'),('passages','passages'),('storyboard','storyboard'),('compositions','compositions'),('printFormat','printFormat'),('artDirection','artDirection'),('references','visualReferences'),('artProduction','artProduction')]:
   if source in e:values[dest]=e[source]
  for key in ['parts','cover']:
   if key in e.get('bookProduction',{}):values[key]=e['bookProduction'][key]
  return json.dumps(values,ensure_ascii=False,separators=(',',':'))
 code,raw=req('/api/edition/review?projectId='+id);report=json.loads(raw);assert code==200 and not report['renderCurrent'] and not report['releaseReady']
 action(e,{'type':'resolve-review-issue','issueId':'render:pending','note':'Ignore'},400)
 snapshot=context(e);results=[{'planId':pid,'problems':[]}]
 e=action(e,{'type':'save-render-review','context':snapshot,'results':results})
 code,raw=req('/api/edition/review?projectId='+id);assert json.loads(raw)['renderCurrent']
 e=action(e,{'type':'add-review-issue','severity':'blocking','message':'Review this layer','target':{'planId':pid,'layerId':'original'}});issue=e['bookReview']['manual'][0]['id']
 code,raw=req('/api/edition/review?projectId='+id);assert any(f['id']==issue for f in json.loads(raw)['findings'])
 e=action(e,{'type':'resolve-review-issue','issueId':issue,'note':'Verified in isolated test'})
 code,raw=req('/api/edition/review?projectId='+id);assert not any(f['id']==issue for f in json.loads(raw)['findings'])
 e=action(e,{'type':'record-human-review','category':'Actual-size printed proof','decision':'changes-required','note':'Not inspected; QA record only'})
 c['layers'][0]['x']=16;e=action(e,{'type':'save-composition','composition':c})
 action(e,{'type':'save-render-review','context':snapshot,'results':results},400)
 code,raw=req('/api/edition/review?projectId='+id);report=json.loads(raw);assert not report['renderCurrent'] and any(f['id']==issue for f in report['findings'])
 code,raw=req('/api/edition?projectId='+id);project=json.loads(raw)['project'];project['edition']['bookReview']['manual']=[];code,raw=req('/api/projects',project);assert code==409
 try:urllib.request.urlopen(urllib.request.Request(base+'/api/edition/review?projectId='+id,headers={'x-book-studio-owner':'foreign'}));raise AssertionError('Owner isolation failed')
 except urllib.error.HTTPError as error:assert error.code==404
 print('PASS: review endpoint, render snapshot guard, unwaivable blocker, resolution history/reopening, human record, protected-save and ownership guards')
finally:
 req('/api/projects?id='+id,method='DELETE')
