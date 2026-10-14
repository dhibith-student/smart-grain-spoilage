#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <ESP32Servo.h>

// Confirmed hardware pins. Keep these aligned with the legacy sketch.
#define DHT_PIN 4
#define MOISTURE_PIN 35
#define MQ135_PIN 32
#define SOUND_PIN 33
#define BUZZER_PIN 25
#define SERVO_PIN 27
#define DHT_TYPE DHT11
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// These are the existing configured warning limits from the legacy sketch.
// They are not universal grain-spoilage thresholds.
const float TEMP_LIMIT_C = 35.0f;
const float HUMIDITY_LIMIT_PERCENT = 75.0f;
const int GAS_LIMIT_RAW_ADC = 1800;

const unsigned long SAMPLE_INTERVAL_MS = 2000UL;
const int SERVO_NORMAL_ANGLE = 0;
const int SERVO_ALERT_ANGLE = 90;

DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;
Servo alertServo;

struct SensorReadings {
  bool dhtValid;
  float temperatureC;
  float humidityPercent;

  // These values are intentionally raw ADC readings. No calibration is applied.
  int moistureRawAdc;
  int gasRawAdc;
  int soundRawAdc;

  bool bh1750Valid;
  float lightLux;
};

unsigned long nextSampleAt = 0;
unsigned long sampleSequence = 0;
bool alarmActive = false;
bool lightSensorReady = false;

void setupSensorsAndActuators() {
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  dht.begin();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  lightSensorReady = lightMeter.begin();

  alertServo.setPeriodHertz(50);
  alertServo.attach(SERVO_PIN, 500, 2400);
  alertServo.write(SERVO_NORMAL_ANGLE);
}

void acquireSensorReadings(SensorReadings &readings) {
  readings.temperatureC = dht.readTemperature();
  readings.humidityPercent = dht.readHumidity();
  readings.dhtValid = !isnan(readings.temperatureC) && !isnan(readings.humidityPercent);

  readings.moistureRawAdc = analogRead(MOISTURE_PIN);
  readings.gasRawAdc = analogRead(MQ135_PIN);
  readings.soundRawAdc = analogRead(SOUND_PIN);

  readings.bh1750Valid = false;
  readings.lightLux = NAN;
  if (lightSensorReady) {
    const float lightLux = lightMeter.readLightLevel();

    // The BH1750 library uses an invalid/saturated 16-bit result at 65535.
    // NaN is also rejected so failed readings are never printed as valid data.
    if (!isnan(lightLux) && lightLux >= 0.0f && lightLux < 65535.0f) {
      readings.lightLux = lightLux;
      readings.bh1750Valid = true;
    }
  }
}

void printDhtReading(const SensorReadings &readings) {
  Serial.print("DHT11 status=");
  if (!readings.dhtValid) {
    Serial.println("ERROR");
    return;
  }

  Serial.print("OK temperature_c=");
  Serial.print(readings.temperatureC, 2);
  Serial.print(" humidity_percent=");
  Serial.println(readings.humidityPercent, 2);
}

void printRawReading(const char *name, int value) {
  Serial.print(name);
  Serial.print(" status=RAW_ONLY raw_adc=");
  Serial.println(value);
}

void printBh1750Reading(const SensorReadings &readings) {
  Serial.print("BH1750 status=");
  if (!lightSensorReady || !readings.bh1750Valid) {
    Serial.println(lightSensorReady ? "ERROR" : "NOT_READY");
    return;
  }

  Serial.print("OK light_lux=");
  Serial.println(readings.lightLux, 2);
}

void printSensorReadings(const SensorReadings &readings) {
  Serial.println("--- GRAIN MONITOR SAMPLE ---");
  Serial.print("sequence=");
  Serial.print(sampleSequence);
  Serial.print(" uptime_ms=");
  Serial.println(millis());

  printDhtReading(readings);
  printRawReading("MOISTURE", readings.moistureRawAdc);
  printRawReading("MQ135", readings.gasRawAdc);
  printRawReading("MICROPHONE", readings.soundRawAdc);
  printBh1750Reading(readings);
}

bool evaluateWarningConditions(const SensorReadings &readings) {
  bool warning = false;

  if (readings.dhtValid && readings.temperatureC > TEMP_LIMIT_C) {
    Serial.println("WARNING reason=HIGH_TEMPERATURE");
    warning = true;
  }

  if (readings.dhtValid && readings.humidityPercent > HUMIDITY_LIMIT_PERCENT) {
    Serial.println("WARNING reason=HIGH_HUMIDITY");
    warning = true;
  }

  // This intentionally preserves the legacy raw MQ-135 comparison. It is not
  // a calibrated gas concentration and does not by itself prove spoilage.
  if (readings.gasRawAdc > GAS_LIMIT_RAW_ADC) {
    Serial.println("WARNING reason=HIGH_MQ135_RAW_ADC");
    warning = true;
  }

  return warning;
}

void applyLocalAlarmState(bool warning) {
  if (warning) {
    // Preserve legacy behavior for the current passive-buzzer assumption.
    tone(BUZZER_PIN, 2000);
    alertServo.write(SERVO_ALERT_ANGLE);
    alarmActive = true;
    Serial.println("ALERT state=ON buzzer=ON servo_angle=90");
    return;
  }

  noTone(BUZZER_PIN);
  alertServo.write(SERVO_NORMAL_ANGLE);

  if (alarmActive) {
    Serial.println("ALERT state=OFF transition=NORMAL");
  } else {
    Serial.println("ALERT state=OFF");
  }

  alarmActive = false;
}

void acquireEvaluateAndReport() {
  SensorReadings readings;
  acquireSensorReadings(readings);
  ++sampleSequence;

  printSensorReadings(readings);
  const bool warning = evaluateWarningConditions(readings);
  applyLocalAlarmState(warning);
  Serial.println();
}

void setup() {
  Serial.begin(115200);
  setupSensorsAndActuators();

  Serial.println("SMART GRAIN SPOILAGE MONITOR");
  Serial.print("BH1750 status=");
  Serial.println(lightSensorReady ? "READY" : "NOT_READY");

  // Start immediately, then continue on a non-blocking schedule.
  nextSampleAt = millis();
}

void loop() {
  const unsigned long now = millis();
  if ((long)(now - nextSampleAt) >= 0) {
    nextSampleAt = now + SAMPLE_INTERVAL_MS;
    acquireEvaluateAndReport();
  }
}
