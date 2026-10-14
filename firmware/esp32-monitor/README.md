# ESP32 sensor-acquisition firmware

This is a separate working implementation. The legacy source of truth remains unchanged at `firmware/legacy/original-sketch.ino`.

## Current behavior

- Uses the confirmed pins from the legacy sketch.
- Reads DHT11 temperature and humidity.
- Reads raw ADC values from the moisture, MQ-135, and microphone inputs.
- Reads BH1750 light level over I2C using SDA GPIO 21 and SCL GPIO 22.
- Explicitly reports invalid DHT11 and BH1750 readings.
- Preserves the existing local warning conditions:
  - Temperature greater than 35 °C
  - Humidity greater than 75%
  - Raw MQ-135 ADC greater than 1800
- Uses the existing buzzer tone and servo positions: buzzer tone at 2000 Hz, servo 90° during alert, and servo 0° when normal.
- Replaces the legacy blocking `delay(2000)` with a `millis()`-based sampling schedule.
- Does not use Wi-Fi, HTTP, Supabase, credentials, or cloud services.

Moisture, MQ-135, and microphone values are reported as `RAW_ONLY`. No calibration constants or derived spoilage classifications are included.

## Libraries

The sketch requires:

- ESP32 Arduino core
- `DHT sensor library`
- `Adafruit Unified Sensor` (dependency of the DHT library)
- `BH1750`
- `ESP32Servo`

`Wire.h` is supplied by the ESP32 Arduino core.

## Compile with Arduino CLI

The current environment does not have `arduino-cli`, PlatformIO, or an ESP32 compiler installed. On a development machine with Arduino CLI:

```powershell
arduino-cli core update-index
arduino-cli core install esp32:esp32
arduino-cli lib install "DHT sensor library"
arduino-cli lib install "Adafruit Unified Sensor"
arduino-cli lib install "BH1750"
arduino-cli lib install "ESP32Servo"
arduino-cli board listall esp32
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/esp32-monitor
```

Use the exact FQBN reported for the physical board if it differs from `esp32:esp32:esp32`.

## Upload

After identifying the serial port and confirming the board FQBN:

```powershell
arduino-cli upload -p COMx --fqbn esp32:esp32:esp32 firmware/esp32-monitor
arduino-cli monitor -p COMx -c baudrate=115200
```

Replace `COMx` and the FQBN with the values for the actual board. Uploading and physical behavior were not tested in this iteration.

## Open hardware checks

Before physical use, verify the items listed in `docs/hardware-verification.md`, especially analog input voltage limits, MQ-135 behavior, microphone module identity, buzzer drive requirements, and servo power. Raw MQ-135 readings must not be described as accurate CO2 or definitive spoilage measurements.
