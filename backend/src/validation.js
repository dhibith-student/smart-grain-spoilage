const SENSOR_TYPES = new Set([
  'temperature_c',
  'humidity_percent',
  'moisture_raw_adc',
  'gas_raw_adc',
  'light_lux',
  'sound_raw_adc'
]);

const QUALITY_STATES = new Set([
  'ok',
  'error',
  'unavailable',
  'out_of_range',
  'stale'
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function validateReading(reading, index) {
  if (!isObject(reading)) return `readings[${index}] must be an object`;
  if (!SENSOR_TYPES.has(reading.sensor_type)) {
    return `readings[${index}].sensor_type is unsupported`;
  }
  if (!QUALITY_STATES.has(reading.quality_status)) {
    return `readings[${index}].quality_status is unsupported`;
  }
  if (reading.quality_status === 'ok' && !isFiniteNumber(reading.raw_value)) {
    return `readings[${index}].raw_value must be numeric for an ok reading`;
  }
  if (reading.quality_status !== 'ok'
      && (typeof reading.error_code !== 'string' || reading.error_code.trim() === '')) {
    return `readings[${index}].error_code is required for a failed reading`;
  }
  if (reading.calibrated_value !== null
      && reading.calibrated_value !== undefined
      && !isFiniteNumber(reading.calibrated_value)) {
    return `readings[${index}].calibrated_value must be numeric or null`;
  }
  if (reading.metadata !== undefined && !isObject(reading.metadata)) {
    return `readings[${index}].metadata must be an object`;
  }
  return null;
}

export function validateIngestPayload(payload, authenticatedDeviceKey) {
  if (!isObject(payload)) return { ok: false, errors: ['request body must be an object'] };

  const errors = [];
  if (payload.device_key !== authenticatedDeviceKey) {
    errors.push('body.device_key must match x-device-key');
  }
  if (!Number.isSafeInteger(payload.device_sequence_no) || payload.device_sequence_no < 0) {
    errors.push('device_sequence_no must be a non-negative integer');
  }
  if (payload.measured_at !== undefined && payload.measured_at !== null
      && (typeof payload.measured_at !== 'string' || Number.isNaN(Date.parse(payload.measured_at)))) {
    errors.push('measured_at must be an ISO-parseable timestamp or null');
  }
  if (typeof payload.payload_version !== 'string' || payload.payload_version.trim() === '') {
    errors.push('payload_version is required');
  }
  if (payload.firmware_version !== undefined && payload.firmware_version !== null
      && typeof payload.firmware_version !== 'string') {
    errors.push('firmware_version must be a string or null');
  }
  if (payload.wifi_rssi !== undefined && payload.wifi_rssi !== null
      && (!Number.isInteger(payload.wifi_rssi) || payload.wifi_rssi < -127 || payload.wifi_rssi > 0)) {
    errors.push('wifi_rssi must be an integer from -127 to 0 or null');
  }
  if (!Array.isArray(payload.readings) || payload.readings.length === 0) {
    errors.push('readings must be a non-empty array');
  } else {
    const seen = new Set();
    payload.readings.forEach((reading, index) => {
      const error = validateReading(reading, index);
      if (error) errors.push(error);
      if (reading && typeof reading.sensor_type === 'string') {
        if (seen.has(reading.sensor_type)) errors.push(`duplicate sensor type: ${reading.sensor_type}`);
        seen.add(reading.sensor_type);
      }
    });
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export { SENSOR_TYPES, QUALITY_STATES };
