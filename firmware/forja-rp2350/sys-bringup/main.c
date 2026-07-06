// FORJA SYS-BRINGUP — monitor del sistema NUEVO (boost + descarga), SIN potencia.
// Mapeo nuevo (2026-06-06): GP26(ADC0)=shunt UP, GP27(ADC1)=shunt DOWN (diferencial),
//   GP28(ADC2)=V_cap (divisor del boost). GP16=gate BOOST, GP15=gate DESCARGA.
// AMBOS MOSFET FORZADOS OFF (driver inversor: GPIO alto = MOSFET off). Seguro para
// prender las fuentes 1 por 1 y verificar lecturas ANTES de meter potencia.
//   - shunt diferencial: I = (ADC0 - ADC1)/R_shunt  (el ground bounce, comun, se cancela)
//   - V_cap: reporta el voltaje EN EL PIN + interpretaciones x5/x11/x16 (para que
//     identifiquemos el ratio real del divisor comparando con ~11.4V (boost OFF)).
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>

#define PIN_BOOST  16
#define PIN_DISCH  15
#define R_SHUNT    0.001f
#define VREF       3.3f
#define ADCMAX     4095.0f
#define NMED       7

static uint16_t med(void){
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27); adc_gpio_init(28);
    gpio_init(25); gpio_set_dir(25,GPIO_OUT);
    // ambos gates: salida en ALTO = MOSFET OFF (driver KSP inversor)
    gpio_init(PIN_BOOST); gpio_set_dir(PIN_BOOST,GPIO_OUT); gpio_put(PIN_BOOST,1);
    gpio_init(PIN_DISCH); gpio_set_dir(PIN_DISCH,GPIO_OUT); gpio_put(PIN_DISCH,1);
    sleep_ms(1500);
    printf("== SYS-BRINGUP == BOOST(GP16) y DESCARGA(GP15) FORZADOS OFF · shunt diff 26-27 · V_cap 28\n");

    uint32_t n=0;
    while(true){
        gpio_put(PIN_BOOST,1); gpio_put(PIN_DISCH,1);   // garantiza OFF cada vuelta
        gpio_put(25, n&1);

        adc_select_input(0); float up = med();   // shunt UP   (GP26)
        adc_select_input(1); float dn = med();   // shunt DOWN (GP27)
        adc_select_input(2); float vc = med();   // V_cap      (GP28)

        float A_per_count = VREF/ADCMAX/R_SHUNT;          // ~0.806 A/cuenta
        float I    = (up - dn) * A_per_count;             // diferencial
        float vpin = vc * VREF / ADCMAX;                  // voltaje en el pin GP28

        printf("SYS #%u | shunt up=%.0f dn=%.0f -> I=%.1fA | Vcap pin=%.3fV (x5=%.1f x11=%.1f x16=%.1f) | OFF\n",
               (unsigned)n++, (double)up, (double)dn, (double)I,
               (double)vpin, (double)(vpin*5.0f), (double)(vpin*11.0f), (double)(vpin*16.0f));
        sleep_ms(700);
    }
}
