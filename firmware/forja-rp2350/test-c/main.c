// FORJA Test 01 (C/Pico SDK) — ¿vive la Pico? USB serial + blink + lee ADC.
// ADC0 = GP26 (V, divisor de la punta) · ADC1 = GP27 (I, shunt). Sin riesgo.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>

int main(void) {
    stdio_init_all();                 // consola por USB (CDC)
    adc_init();
    adc_gpio_init(26);                // ADC0 = GP26 (pin 31)
    adc_gpio_init(27);                // ADC1 = GP27 (pin 32)
    gpio_init(25); gpio_set_dir(25, GPIO_OUT);   // LED Pico 2 = GP25

    uint32_t n = 0;
    while (true) {
        gpio_put(25, n & 1);
        adc_select_input(0); uint16_t v = adc_read();
        adc_select_input(1); uint16_t i = adc_read();
        printf("FORJA viva  ·  latido %u  ·  ADC0(GP26)=%u (%.3f V)  ADC1(GP27)=%u (%.3f V)\n",
               (unsigned)n++, v, v * 3.3f / 4095.0f, i, i * 3.3f / 4095.0f);
        sleep_ms(300);
    }
}
