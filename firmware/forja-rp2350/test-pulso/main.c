// FORJA Test PULSO — un pulso CONTROLADO del gate, con LÍMITE de corriente.
// Para 12V + alambre ABIERTO: confirma que llega el 12V (Vpunta) y que NO circula
// corriente (I~0) = power stage seguro. Si algo cierra y sube la corriente, ABORTA.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>
#define PIN_GATE     16
#define DIV_RATIO    5.0f
#define R_SHUNT      0.001f
#define I_LIMIT_CNT  40       // ~40 cuentas ≈ 32mV ≈ 32A -> ABORTA (seguridad)
#define PULSE_US     500      // 0.5 ms (corto)

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27);
    gpio_init(25); gpio_set_dir(25, GPIO_OUT);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE, GPIO_OUT);
    gpio_put(PIN_GATE, 1);                 // MOSFET OFF (inversor) al arrancar
    sleep_ms(2500);                        // deja conectar el 12V
    uint32_t n=0;
    while(true){
        // --- IDLE (gate OFF): lee 12V y corriente de reposo ---
        adc_select_input(0); uint16_t a0=adc_read();
        adc_select_input(1); uint16_t a1=adc_read();
        float Vpunta=a0*3.3f/4095.0f*DIV_RATIO;
        float Iidle=a1*3.3f/4095.0f/R_SHUNT;

        // --- PULSO controlado, muestreando corriente con límite ---
        uint16_t ipk=0; int aborted=0;
        adc_select_input(1);
        gpio_put(PIN_GATE, 0);             // MOSFET ON
        absolute_time_t t0=get_absolute_time();
        while(absolute_time_diff_us(t0, get_absolute_time()) < PULSE_US){
            uint16_t i=adc_read();
            if(i>ipk) ipk=i;
            if(i>I_LIMIT_CNT){ aborted=1; break; }   // corta al instante si hay corriente
        }
        gpio_put(PIN_GATE, 1);             // MOSFET OFF
        float Ipk=ipk*3.3f/4095.0f/R_SHUNT;

        printf("PULSO #%u (%dus) · IDLE Vpunta=%.2fV I=%.2fA · PICO I=%.2fA (%u cnt) %s\n",
               (unsigned)n++, PULSE_US, Vpunta, Iidle, Ipk, ipk,
               aborted?"<<< ABORTADO por corriente! >>>":"ok (sin corriente = abierto)");
        sleep_ms(2000);
    }
}
