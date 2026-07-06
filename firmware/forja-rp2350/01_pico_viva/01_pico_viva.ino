// ============================================================================
// FORJA — Test 01: ¿VIVE la Pico (RP2350)?  blink + serial + ADC
// ----------------------------------------------------------------------------
// Confirma que puedes FLASHEAR y que la Pico corre y lee los ADC. CERO riesgo:
// no toca nada de potencia. Es el "hola mundo" antes del firmware de control.
//
// Board (Arduino IDE): "Raspberry Pi Pico 2"  (core arduino-pico, Earle Philhower)
//   Boards Manager → busca "pico" → instala "Raspberry Pi Pico/RP2040/RP2350".
// Flashear: conecta la Pico apretando BOOTSEL → aparece como USB → Upload.
// Ver salida: Tools → Serial Monitor a 115200 baud.
// ============================================================================

const int PIN_LED = LED_BUILTIN;
const int PIN_V   = A0;   // GP26 → (futuro) divisor de V de la junta
const int PIN_I   = A1;   // GP27 → (futuro) shunt de corriente

void setup() {
  Serial.begin(115200);
  pinMode(PIN_LED, OUTPUT);
  analogReadResolution(12);          // ADC 0..4095
}

uint32_t latido = 0;
void loop() {
  digitalWrite(PIN_LED, !digitalRead(PIN_LED));     // parpadea el LED
  int rv = analogRead(PIN_V);
  int ri = analogRead(PIN_I);
  Serial.printf("FORJA viva  ·  latido %lu  ·  V(GP26)=%4d (%.3f V)  I(GP27)=%4d (%.3f V)\n",
                latido++, rv, rv * 3.3f / 4095.0f, ri, ri * 3.3f / 4095.0f);
  delay(300);
}
