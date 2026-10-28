"""Create an isolated Wrangler config from the verified build; never deploy automatically."""
import argparse,json,re
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--database-id',required=True,help='ID of the dedicated staging D1 database')
parser.add_argument('--bucket',default='iks-book-studio-staging-assets')
parser.add_argument('--output',default='.wrangler/staging/wrangler.json')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=root/'dist/server/wrangler.json'
if not source.exists():parser.error('Build the application before preparing staging.')
config=json.loads(source.read_text())
if not re.fullmatch(r'[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}',args.database_id):parser.error('Use the actual staging D1 UUID.')
if args.database_id in [d.get('database_id') for d in config.get('d1_databases',[])]:parser.error('Staging must not reuse the build database binding.')
if not re.fullmatch(r'iks-book-studio-staging-[a-z0-9-]+',args.bucket):parser.error('Use a dedicated iks-book-studio-staging-* bucket.')
# Carry compiled module rules but replace deployment identity and all persisted bindings.
config.update(name='iks-book-studio-staging',topLevelName='iks-book-studio-staging',main=str(root/'dist/server/index.js'),workers_dev=True,preview_urls=False)
config['assets']={**config.get('assets',{}),'directory':str(root/'dist/client')}
config['d1_databases']=[{'binding':'DB','database_name':'iks-book-studio-staging-db','database_id':args.database_id}]
config['r2_buckets']=[{'binding':'BUCKET','bucket_name':args.bucket}]
config['vars']={}
for key in ['routes','route','account_id','env']:config.pop(key,None)
output=Path(args.output).resolve();output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(config,indent=2)+'\n')
print(f'Staging configuration prepared: {output}')
print('No deployment performed. Confirm the database and bucket are dedicated staging resources before deploying.')
