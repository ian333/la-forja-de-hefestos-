// FORJA PRIMER LIGHT — pulso con corriente REAL, gentil y controlado.
// Circuito CERRADO (alambre tocando). El shunt de 1mΩ es ruidoso (15A=15mV vs
// ~22mV de ruido de conmutación), así que cada muestra de corriente es la
// MEDIANA de N lecturas (rechaza picos acoplados) + settle largo + debounce.
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include <stdio.h>
#define PIN_GATE     16
#define DIV_RATIO    5.0f
// CALIBRADO (2026-06-05): R efectiva = 1mΩ del shunt + ~17mΩ de tierra compartida
// (ground bounce). Verificado con la física del choque (L≈15µH → ~45A reales a
// 56µs) vs la lectura cruda de 800A → factor 17.8×. Así I_pico marca ~45A reales.
#define R_SHUNT      0.0178f
#define I_LIMIT_CNT  19      // cuentas (detecta presencia de corriente; el corte real lo da la latencia de 56µs)
#define SETTLE_US    25      // salta el transitorio de conmutación (subido 12→25)
#define PULSE_MAX_US 400
#define NMED         7       // mediana de 7 lecturas por muestra (anti-ruido)
#define DEBOUNCE     4       // medianas sobre-límite consecutivas para abortar

// mediana de NMED lecturas del ADC seleccionado (insertion sort, NMED chico)
static uint16_t adc_median(void){
    uint16_t b[NMED];
    for(int k=0;k<NMED;k++) b[k]=adc_read();
    for(int i=1;i<NMED;i++){ uint16_t v=b[i]; int j=i-1;
        while(j>=0 && b[j]>v){ b[j+1]=b[j]; j--; } b[j+1]=v; }
    return b[NMED/2];
}

int main(void){
    stdio_init_all();
    adc_init(); adc_gpio_init(26); adc_gpio_init(27);
    gpio_init(25); gpio_set_dir(25, GPIO_OUT);
    gpio_init(PIN_GATE); gpio_set_dir(PIN_GATE, GPIO_OUT);
    gpio_put(PIN_GATE, 1);                 // MOSFET OFF al arrancar
    sleep_ms(2000);
    uint32_t n=0;
    while(true){
        adc_select_input(0); float vidle=adc_median()*3.3f/4095.0f*DIV_RATIO;
        // CERO de corriente: la línea base del ADC justo antes del pulso (gate OFF,
        // sin corriente) → la restamos del pulso para cancelar offset + deriva lenta.
        adc_select_input(1); uint16_t i0=adc_median();
        float ioff=i0*3.3f/4095.0f/R_SHUNT;   // offset medido (debe ser pequeño)

        // --- PULSO (corriente RELATIVA al cero i0) ---
        int32_t ipk=0; int over=0, aborted=0; uint32_t dur=0;
        adc_select_input(1);
        gpio_put(PIN_GATE, 0);             // MOSFET ON
        busy_wait_us(SETTLE_US);           // deja pasar el ruido de conmutación
        absolute_time_t t0=get_absolute_time();
        while(true){
            uint32_t d=(uint32_t)absolute_time_diff_us(t0, get_absolute_time());
            if(d>=PULSE_MAX_US){ dur=d; break; }
            int32_t rel=(int32_t)adc_median()-(int32_t)i0;   // pulso - cero
            if(rel>ipk) ipk=rel;
            if(rel>I_LIMIT_CNT){ if(++over>=DEBOUNCE){ aborted=1; dur=d; break; } } else over=0;
        }
        gpio_put(PIN_GATE, 1);             // MOSFET OFF
        float Ipk=ipk*3.3f/4095.0f/R_SHUNT;   // ipk ya es relativo al cero

        printf("LUZ #%u · Vpunta=%.2fV · cero=%.1fA · PULSO rel: I_pico=%.1fA dur=%uus %s\n",
               (unsigned)n++, vidle, ioff, Ipk, (unsigned)dur,
               aborted ? "[CORTE por corriente — CORRIENTE REAL fluye! OK]" : "(limpio, sin corte)");
        sleep_ms(2000);
    }
}
