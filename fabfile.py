
from __future__ import with_statement
from fabric.api import *


def d(): env.hosts = ['174.129.30.16']
develop = d

def s(): env.hosts = ['72.51.30.179']
staging = s

def p(): env.hosts = ['72.51.30.180']
production = p


def merge():
  branch = local('git symbolic-ref -q HEAD', capture=True).split('/')[-1]

  if branch != 'master':
    local('git checkout master')

  local('git pull origin master')
  local('git merge origin develop')
  local('git push origin master')

  if branch != 'master':
    local('git checkout %s' % branch)


def deploy():
  if 'd.hipsell.com' in env.hosts: pass
    # this doesn't work yet
    #with cd('/var/hipsell/hs-server'):

  elif 's.hipsell.com' in env.hosts or 'hipsell.com' in env.hosts:

    if 's.hipsell.com' in env.hosts:
      loc = '/data/web/s.hipsell.com/api/'
      proc = 'api-staging'

    elif 'hipsell.com' in env.hosts:
      loc = '/data/web/hipsell.com/api/'
      proc = 'api'

    with cd(loc):
      run('git pull origin master')
      run('sudo supervisorctl restart %s' % proc)

  else:
    raise ValueError('Bad server %s' % server)
