"""Shared test destination guard: remote destructive fixtures may only use the named staging Worker."""
import os
from urllib.parse import urlsplit

def verification_base():
 value=os.environ.get('IKS_STAGING_URL','http://127.0.0.1:5173').rstrip('/')
 url=urlsplit(value)
 if url.username or url.password or url.query or url.fragment or url.path:
  raise ValueError('Use a bare staging origin without credentials, path, query or fragment.')
 if value=='http://127.0.0.1:5173':return value
 if url.scheme!='https' or not url.hostname or not url.hostname.startswith('iks-book-studio-staging.') or not url.hostname.endswith('.workers.dev') or url.port:
  raise ValueError('Remote verification is restricted to https://iks-book-studio-staging.<account>.workers.dev. Never run fixture cleanup on production.')
 return value
