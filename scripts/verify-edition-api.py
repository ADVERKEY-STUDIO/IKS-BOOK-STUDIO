import json, urllib.request, urllib.error, uuid
# Run against the local preview: python3 scripts/verify-edition-api.py
base='http://127.0.0.1:5173'
owner='phase-a-verification-'+str(uuid.uuid4())
project_id=str(uuid.uuid4())
def req(path,data=None,raw=None,content_type=None):
 h={'x-book-studio-owner':owner}
 if data is not None: raw=json.dumps(data).encode(); content_type='application/json'
 if content_type:h['content-type']=content_type
 try:
  r=urllib.request.urlopen(urllib.request.Request(base+path,data=raw,headers=h),timeout=30)
  return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def action(edition, a):
 status, data=req('/api/edition',{'projectId':project_id,'expectedRevision':edition['revision'],'action':a})
 assert status==200,(status,data)
 return json.loads(data)['project']['edition']
try:
 status,data=req('/api/projects',{'id':project_id,'title':'Phase A API verification','source':'No source selected','chapters':[],'edition':{}}); assert status==200,(status,data)
 project=json.loads(data)['project']; edition=project['edition']
 original='ॐ अग्निमीळे पुरोहितं\nअ॒ग्निम् क्ष ज्ञ श्र ।\nśrī kṛṣṇa ā ī ṛ ḷ'
 boundary='edition-test-boundary'; payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="projectId"\r\n\r\n{project_id}\r\n--{boundary}\r\nContent-Disposition: form-data; name="expectedRevision"\r\n\r\n0\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="source.txt"\r\nContent-Type: text/plain\r\n\r\n{original}\r\n--{boundary}--\r\n').encode()
 status,data=req('/api/edition/source',raw=payload,content_type='multipart/form-data; boundary='+boundary); assert status==200,(status,data)
 project=json.loads(data)['project'];edition=project['edition'];assert edition['passages'][0]['fields']['original']['text']==original
 status,download=req('/api/source/download?key='+urllib.parse.quote(edition['sources'][0]['key'])); assert status==200 and download.decode()==original
 pid=edition['passages'][0]['id'];edition=action(edition,{'type':'approve','id':pid,'field':'original'})
 status,data=req('/api/edition',{'projectId':project_id,'expectedRevision':0,'action':{'type':'approve','id':pid,'field':'original'}});assert status==409
 status,data=req('/api/edition?projectId='+project_id);project=json.loads(data)['project'];project['edition']['passages'][0]['fields']['original']['text']='unaudited replacement'
 status,data=req('/api/projects',project);assert status==409,(status,data)
 status,data=req('/api/edition/export?projectId='+project_id);assert status==200 and original in data.decode(),(status,data[:500])
 edition=action(edition,{'type':'edit','id':pid,'field':'translation','text':'Review sample translation','location':'source.txt','reason':'Add translation','provenance':'generated'})
 status,data=req('/api/edition/export?projectId='+project_id);assert status==422
 edition=action(edition,{'type':'approve','id':pid,'field':'translation'})
 edition=action(edition,{'type':'edit','id':pid,'field':'original','text':original+'\n॥','location':'source.txt','reason':'Correction','provenance':'user-provided'})
 assert edition['passages'][0]['fields']['translation']['status']=='stale'
 print('PASS: source upload/download exact text, approval, persistence, stale revision 409, protected-save 409, approved HTML export, unapproved export 422, dependent approval invalidation')
finally:
 request=urllib.request.Request(base+'/api/projects?id='+project_id,headers={'x-book-studio-owner':owner},method='DELETE');urllib.request.urlopen(request).read()
