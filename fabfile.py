from __future__ import with_statement
from fabric.api import *

hosts = {
  'production': ['72.51.30.180'],
  'staging': ['72.51.30.179'],
  'dev': ['174.129.30.16']
}
locations = {
  'production': '/data/web/hipsell.com/api/',
  'staging': '/data/web/s.hipsell.com/api/',
  'dev': '/var/hipsell/hs-server/'
}
restarts = {
  'production': 'supervisorctl restart api',
  'staging': 'supervisorctl restart api-staging',
  'dev': 'restart hs-server'
}
pulls = {
  'production': 'git pull origin master',
  'staging': 'git pull origin master',
  'dev': 'git pull origin develop'
}

@task
def deploy(mode):
  # Sanity check
  if not mode in locations:
    raise Error('Bad mode %s' % mode)

  # Set the host lists
  with settings(host_string=','.join(hosts[mode])):

    # Do the deploy
    with cd(locations[mode]):
      run(pulls[mode])
      sudo(restarts[mode])
