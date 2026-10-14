import { SENSOR_TYPES } from './validation.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateDeviceId(value) {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function parseHistoryQuery(query) {
  const errors = [];
  const limit = query.limit === undefined ? 100 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) errors.push('limit must be an integer from 1 to 500');

  let from;
  let to;
  if (query.from !== undefined) {
    if (Number.isNaN(Date.parse(query.from))) errors.push('from must be an ISO-parseable timestamp');
    else from = new Date(query.from).toISOString();
  }
  if (query.to !== undefined) {
    if (Number.isNaN(Date.parse(query.to))) errors.push('to must be an ISO-parseable timestamp');
    else to = new Date(query.to).toISOString();
  }
  if (from && to && from > to) errors.push('from must be earlier than or equal to to');
  if (query.sensor !== undefined && !SENSOR_TYPES.has(query.sensor)) errors.push('sensor is unsupported');

  return errors.length ? { ok: false, errors } : { ok: true, limit, from, to, sensor: query.sensor };
}
