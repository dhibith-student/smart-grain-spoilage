# Smart Grain Spoilage Monitor

Working application foundation for an IoT-based grain-storage monitoring system. Firmware preparation, version-controlled database migrations, a minimal Express API, and a React/Vite dashboard are present. Hosted deployment remains a manual step.

## Confirmed hardware inventory

- ESP32 development board
- DHT11 for temperature and humidity
- Capacitive soil moisture sensor, analog output on GPIO 35
- MQ-135 gas sensor, analog output on GPIO 32
- Acoustic microphone sensor, analog-readable signal on GPIO 33
- BH1750 light sensor over I2C, SDA GPIO 21 and SCL GPIO 22
- Buzzer on GPIO 25
- Servo motor on GPIO 27

The exact microphone module model and its electrical behavior are not yet confirmed. No fan, DS18B20, or other unconfirmed component is part of this repository scope.

The unchanged original Arduino sketch is preserved under `firmware/legacy/original-sketch.ino`. The separate working implementation is under `firmware/esp32-monitor/`.

## Confirmed technology decisions

- Firmware: Arduino C++ for ESP32
- Backend: Node.js and Express
- Database: Supabase PostgreSQL
- Frontend: React and Vite
- Initial dashboard model: private single-user dashboard with login
- Development approach: local development first
- Later deployment targets: Render for the backend and Vercel for the frontend

Supabase, Render, and Vercel credentials are intentionally not configured in this foundation. Firebase and Google AI Studio are not used.

## Repository status

This repository was initialized with Git during the foundation iteration. The existing `ESIOT.pdf` file was preserved unchanged as an existing project artifact; it is not used to expand the confirmed hardware inventory.

See:

- `docs/hardware-verification.md` for electrical checks and unresolved hardware questions.
- `docs/architecture.md` for the planned data flow and security boundaries.
- `docs/implementation-checklist.md` for staged completion criteria.
- `docs/deployment.md` for local, Render, Vercel, and simulated-ingestion commands.
