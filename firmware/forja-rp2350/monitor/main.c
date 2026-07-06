// FORJA MONITOR — lee TODO, SIN potencia (modo seguro / dry-run).
// El gate queda FORZADO OFF mientras POWER_ENABLED=0. Solo lectura + autochequeo.
// Activamos potencia (POWER_ENABLED 1) SOLO después de revisar juntos.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>
#define PIN_GATE      16        // inversor: HIGH -> MOSFET OFF
#define DIV_RATIO     5.0f      // 40k/10k
#define R_SHUNT       0.001f    // R001 = 1 mOhm
#define POWER_ENABLED 0         // <<< 0 = NUNCA manda potencia. No tocar hasta revisar.

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27);
    gpio_init(25); gpio_set_dir(25, GPIO_OUT);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE, GPIO_OUT);
    gpio_put(PIN_GATE, 1);                       // arranca con MOSFET OFF (seguro)

    uint32_t n=0;
    while(true){
        if(!POWER_ENABLED) gpio_put(PIN_GATE, 1);   // SEGURIDAD: gate siempre OFF
        gpio_put(25, n & 1);

        adc_select_input(0); uint16_t a0=adc_read();
        adc_select_input(1); uint16_t a1=adc_read();
        float v0=a0*3.3f/4095.0f, v1=a1*3.3f/4095.0f;
        float Vpunta=v0*DIV_RATIO;                // voltaje real de la punta
        float I=v1/R_SHUNT;                       // corriente por el shunt

        // contacto (requiere pull-up 10k de 3V3 a la punta + pieza a GND):
        //   ABIERTO -> ADC0 ~0.5V ;  TOCANDO -> ADC0 ~0V
        const char* est = (v0 < 0.20f) ? "CONTACTO (toca)" : "ABIERTO         ";
        // autochequeo simple
        const char* chk = (a0 < 4090 && a1 < 4090) ? "ok" : "REVISAR(ADC saturado)";

        printf("MON [gate=OFF sin potencia] · ADC0=%.3fV (Vpunta=%.2fV) · ADC1=%.3fV (I=%.2fA) · %s · sensores:%s · lat %u\n",
               v0, Vpunta, v1, I, est, chk, (unsigned)n++);
        sleep_ms(300);
    }
}
