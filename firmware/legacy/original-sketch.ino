#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <ESP32Servo.h>

#define DHT_PIN 4
#define MOISTURE_PIN 35
#define MQ135_PIN 32
#define SOUND_PIN 33
#define BUZZER_PIN 25
#define SERVO_PIN 27
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);
BH1750 lightMeter;
Servo alertServo;

const float TEMP_LIMIT = 35.0;
const float HUMIDITY_LIMIT = 75.0;
const int GAS_LIMIT = 1800;

float temperature, humidity, lightLevel;
int moistureValue, gasValue, soundValue;
bool alarmActive = false;

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);
  dht.begin();

  Wire.begin(21, 22);

  if (lightMeter.begin())
    Serial.println("BH1750 ready");
  else
    Serial.println("BH1750 not detected");

  alertServo.setPeriodHertz(50);
  alertServo.attach(SERVO_PIN, 500, 2400);
  alertServo.write(0);

  Serial.println("SMART GRAIN SPOILAGE MONITOR");
}

void loop() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();

  moistureValue = analogRead(MOISTURE_PIN);
  gasValue = analogRead(MQ135_PIN);
  soundValue = analogRead(SOUND_PIN);
  lightLevel = lightMeter.readLightLevel();

  Serial.println("\n--- GRAIN MONITOR ---");

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT11 reading failed");
  } else {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" C");

    Serial.print("Humidity: ");
    Serial.print(humidity);
    Serial.println(" %");
  }

  Serial.print("Moisture raw: ");
  Serial.println(moistureValue);

  Serial.print("Gas raw: ");
  Serial.println(gasValue);

  Serial.print("Sound raw: ");
  Serial.println(soundValue);

  Serial.print("Light: ");
  Serial.print(lightLevel);
  Serial.println(" lux");

  bool warning = false;

  if (!isnan(temperature) && temperature > TEMP_LIMIT) {
    Serial.println("WARNING: High temperature!");
    warning = true;
  }

  if (!isnan(humidity) && humidity > HUMIDITY_LIMIT) {
    Serial.println("WARNING: High humidity!");
    warning = true;
  }

  if (gasValue > GAS_LIMIT) {
    Serial.println("WARNING: High gas reading!");
    warning = true;
  }

  if (warning) {
    // Generate sound for a passive buzzer
    tone(BUZZER_PIN, 2000);
    alertServo.write(90);
    alarmActive = true;
    Serial.println("ALERT: Buzzer sounding, servo moved");
  } else {
    noTone(BUZZER_PIN);
    alertServo.write(0);

    if (alarmActive) {
      Serial.println("Conditions normal: alarm OFF");
    } else {
      Serial.println("Status: NORMAL");
    }

    alarmActive = false;
  }

  delay(2000);
}