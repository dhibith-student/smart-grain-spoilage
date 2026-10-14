# Hardware Verification

This document records only the hardware confirmed by the project owner. The original Arduino sketch remains the source of truth for current firmware behavior and is preserved at `firmware/legacy/original-sketch.ino`.

## Confirmed pin map

| Component | Signal | ESP32 pin | Status |
|---|---|---:|---|
| DHT11 | Digital data | 4 | Confirmed by project owner |
| Capacitive soil moisture sensor | Analog output | 35 | Confirmed by project owner |
| MQ-135 gas sensor | Analog output | 32 | Confirmed by project owner |
| Acoustic microphone sensor | Analog-readable signal | 33 | Confirmed by project owner; module model unresolved |
| BH1750 | SDA | 21 | Confirmed current configuration |
| BH1750 | SCL | 22 | Confirmed current configuration |
| Buzzer | Control | 25 | Confirmed by project owner |
| Servo motor | Control/PWM | 27 | Confirmed by project owner |

No DC fan, DS18B20, relay, or other component is included in the current inventory.

## Electrical checks required before firmware implementation

These checks have not been performed by this repository foundation work.

### ESP32 input voltage protection

- Confirm the ESP32 board's supported GPIO voltage range.
- Measure the maximum voltage delivered by the MQ-135 analog output before connecting it to GPIO 32.
- Measure the maximum voltage delivered by the moisture sensor analog output before connecting it to GPIO 35.
- Measure the maximum voltage delivered by the microphone analog output before connecting it to GPIO 33.
- Add an appropriate level-shifting or voltage-divider circuit if any output can exceed the ESP32 ADC input limit.
- Confirm that all modules share a suitable common ground.

### MQ-135

- Confirm the module supply voltage and heater current.
- Confirm warm-up and calibration requirements for the exact module.
- Treat the value as a raw gas-sensor signal until calibration is established.
- Do not interpret raw ADC readings as accurate CO2 concentration or proof of grain spoilage.

### Microphone sensor

- Identify the exact module model.
- Confirm whether the available signal is analog, digital, or both.
- Confirm its supply voltage and analog-output range.
- Determine whether the signal represents amplitude, an envelope, threshold events, or another quantity.
- Do not label readings as decibels or infer insect activity until the module and measurement method are verified.

### BH1750

- Confirm the module supply-voltage range and whether it includes I2C level shifting.
- Confirm the I2C address and that GPIO 21/GPIO 22 are electrically available.
- Confirm whether external pull-up resistors are present and compatible with the ESP32.

### Buzzer

- Confirm whether the buzzer is an active or passive device and its supply voltage/current.
- Confirm that GPIO 25 can drive it safely, or add a transistor/MOSFET driver and protection as required.

### Servo

- Power the servo from a suitable external supply rather than assuming the ESP32 board can provide its current.
- Connect the servo supply ground to ESP32 ground.
- Check for voltage dips, resets, and signal noise during movement.
- Confirm the safe mechanical travel range before implementing automatic movement.

### DHT11 and moisture sensor

- Confirm the DHT11 module's supply voltage and data-line pull-up arrangement.
- Confirm the moisture module's output range at the selected supply voltage.
- Record dry/wet reference observations later; do not add calibration values before measurement.

## Verification record

| Check | Result | Evidence/date |
|---|---|---|
| Physical ESP32 board identified | Pending | Not tested in this iteration |
| Microphone module identified | Pending | Not tested in this iteration |
| Analog output voltage limits measured | Pending | Not tested in this iteration |
| Servo supply and current verified | Pending | Not tested in this iteration |
| Buzzer drive circuit verified | Pending | Not tested in this iteration |
| BH1750 address and pull-ups verified | Pending | Not tested in this iteration |
