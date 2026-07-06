// FORJA Test 02 — driver del GATE. Toglea GP16 cada ~1.5s y reporta.
// Gate driver KSP2222A es INVERSOR: GP16=1 → gate ~0V ; GP16=0 → gate ~5V.
// Mide el GATE del MOSFET con el multímetro: debe saltar 0↔5V en sincronía.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>
#define PIN_GATE 16
int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27);
    gpio_init(25); gpio_set_dir(25, GPIO_OUT);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE, GPIO_OUT);
    uint32_t n=0;
    while(true){
        bool g = (n/5) & 1;            // togglea cada 5 ciclos (~1.5 s)
        gpio_put(PIN_GATE, g);
        gpio_put(25, n & 1);
        adc_select_input(0); uint16_t v=adc_read();
        adc_select_input(1); uint16_t i=adc_read();
        printf("GP16=%d  ->  GATE debe estar ~%s  ·  ADC0=%u(%.3fV) ADC1=%u(%.3fV)\n",
               g, g?"0V (MOSFET OFF)":"5V (MOSFET ON)", v, v*3.3f/4095.0f, i, i*3.3f/4095.0f);
        n++; sleep_ms(300);
    }
}
