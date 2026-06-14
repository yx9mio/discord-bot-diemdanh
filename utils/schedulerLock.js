'use strict';
const { getClient } = require('../services/_client.js');
const log = require('./logger.js');

const HOST = process.env.HOSTNAME || 'unknown';
const PID = process.pid;
const INSTANCE_ID = `${HOST}-${PID}`;

const DEFAULT_TTL_SECONDS = 70;

let _heartbeatTimer = null;

function _rpc(name, args) {
  return getClient().rpc(name, args);
}

async function tryAcquireLeadership(jobName) {
  const { data, error } = await _rpc('try_acquire_scheduler_lock', {
    p_job_name: jobName,
    p_instance_id: INSTANCE_ID,
    p_ttl_seconds: DEFAULT_TTL_SECONDS,
  });
  if (error) {
    log.warn('SCHED_LOCK', null, 'tryAcquireLeadership(%s) error: %s', jobName, error.message);
    return false;
  }
  return data === true;
}

async function renewLeadership(jobName) {
  const { data, error } = await _rpc('try_acquire_scheduler_lock', {
    p_job_name: jobName,
    p_instance_id: INSTANCE_ID,
    p_ttl_seconds: DEFAULT_TTL_SECONDS,
  });
  if (error) {
    log.warn('SCHED_LOCK', null, 'renewLeadership(%s) error: %s', jobName, error.message);
    return false;
  }
  if (!data) {
    log.warn('SCHED_LOCK', null, 'renewLeadership(%s) lost — lock taken by another instance', jobName);
  }
  return data === true;
}

async function releaseLeadership(jobName) {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  const { error } = await _rpc('release_scheduler_lock', {
    p_job_name: jobName,
    p_instance_id: INSTANCE_ID,
  });
  if (error) {
    log.warn('SCHED_LOCK', null, 'releaseLeadership(%s) error: %s', jobName, error.message);
  }
}

function startHeartbeat(jobName) {
  if (_heartbeatTimer) return;
  _heartbeatTimer = setInterval(() => {
    renewLeadership(jobName).catch(() => {});
  }, 30_000);
  _heartbeatTimer.unref();
}

function stopHeartbeat() {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
}

module.exports = {
  INSTANCE_ID,
  tryAcquireLeadership,
  renewLeadership,
  releaseLeadership,
  startHeartbeat,
  stopHeartbeat,
};
