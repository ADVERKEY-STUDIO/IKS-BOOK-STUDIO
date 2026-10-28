"""Local-only staging safety tests. Does not contact Cloudflare."""
import json,os,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from verification_target import verification_base

class StagingGuards(unittest.TestCase):
 def test_default_is_local(self):
  with patch.dict(os.environ,{},clear=True):self.assertEqual(verification_base(),'http://127.0.0.1:5173')
 def test_remote_production_and_malformed_origins_rejected(self):
  for value in ['https://iksmain.gg220962.workers.dev','http://iks-book-studio-staging.example.workers.dev','https://iks-book-studio-staging.example.workers.dev/path','https://iks-book-studio-staging.example.workers.dev?key=value','https://person@iks-book-studio-staging.example.workers.dev','https://iks-book-studio-staging.example.workers.dev.evil.test']:
   with self.subTest(value=value),patch.dict(os.environ,{'IKS_STAGING_URL':value}):
    with self.assertRaises(ValueError):verification_base()
 def test_named_staging_allowed(self):
  value='https://iks-book-studio-staging.example.workers.dev'
  with patch.dict(os.environ,{'IKS_STAGING_URL':value}):self.assertEqual(verification_base(),value)
 def test_prepared_config_uses_separate_resources(self):
  source=json.loads(Path('dist/server/wrangler.json').read_text())
  original=source['d1_databases'][0]['database_id']
  command=[sys.executable,'scripts/prepare-cloudflare-staging.py','--database-id']
  self.assertNotEqual(subprocess.run(command+[original],capture_output=True).returncode,0)
  with tempfile.TemporaryDirectory() as directory:
   target=Path(directory)/'wrangler.json'
   result=subprocess.run(command+['00000000-0000-4000-8000-000000000001','--output',str(target)],capture_output=True)
   self.assertEqual(result.returncode,0,result.stderr)
   config=json.loads(target.read_text())
   self.assertEqual(config['name'],'iks-book-studio-staging')
   self.assertNotEqual(config['d1_databases'][0]['database_id'],original)
   self.assertEqual(config['r2_buckets'][0]['bucket_name'],'iks-book-studio-staging-assets')
   self.assertEqual(config['vars'],{})
   self.assertNotIn('routes',config)
if __name__=='__main__':unittest.main()
