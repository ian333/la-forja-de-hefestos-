// FORJA TEST-DESCARGA — verifica que el MOSFET de descarga (GP15) ENCIENDE.
// Boost OFF (sin subir voltaje). Alterna el MOSFET de descarga 1s ON / 1s OFF.
// MIDE EL GATE del MOSFET de descarga con el multímetro: debe oscilar 0V<->5V.
//   - DESCARGA ON  -> GP15 bajo -> KSP#2 no conduce -> pull-up 470Ω -> gate ~5V -> MOSFET ON
//   - DESCARGA OFF -> GP15 alto -> KSP#2 conduce -> gate ~0V -> MOSFET OFF
// Si el gate NO llega a ~5V en ON, el KSP#2 / pull-up está mal. Contacto ABIERTO = seguro.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>

#define PIN_BOOST  16
#define PIN_DISCH  15

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(28);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);
    // boost FORZADO OFF (GPIO alto = MOSFET off por el inversor)
    gpio_init(PIN_BOOST); gpio_set_dir(PIN_BOOST,GPIO_OUT); gpio_put(PIN_BOOST,1);
    gpio_init(PIN_DISCH); gpio_set_dir(PIN_DISCH,GPIO_OUT); gpio_put(PIN_DISCH,1);
    sleep_ms(1500);
    printf("== TEST-DESCARGA == mide el GATE del MOSFET de descarga: debe oscilar 0V<->5V\n");

    uint32_t n=0;
    while(true){
        gpio_put(PIN_DISCH,0); gpio_put(25,1);   // DESCARGA ON
        printf("#%u  DESCARGA *** ON ***  -> gate del MOSFET descarga debe medir ~5V\n",(unsigned)n);
        sleep_ms(4000);
        gpio_put(PIN_DISCH,1); gpio_put(25,0);   // DESCARGA OFF
        printf("#%u  DESCARGA     OFF      -> gate del MOSFET descarga debe medir ~0V\n",(unsigned)n++);
        sleep_ms(4000);
    }
}
